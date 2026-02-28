import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, type QueryRunner } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import { localizedContent, OptimisticLockError } from '@universo/utils'
const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent
import { getRequestManager } from '../../../utils'
import { ensureMetahubAccess } from '../../shared/guards'
import { Metahub } from '../../../database/entities/Metahub'
import { MetahubBranch } from '../../../database/entities/MetahubBranch'
import { Publication, PublicationSchemaStatus } from '../../../database/entities/Publication'
import { PublicationVersion } from '../../../database/entities/PublicationVersion'
import { TemplateVersion } from '../../../database/entities/TemplateVersion'
import { SnapshotSerializer, MetahubSnapshot } from '../services/SnapshotSerializer'
import { getDDLServices, generateSchemaName, KnexClient, uuidToLockKey, acquireAdvisoryLock, releaseAdvisoryLock } from '../../ddl'
import type { SchemaSnapshot, SchemaDiff } from '../../ddl'
// Import applications entities for auto-create feature
import { Application, ApplicationSchemaStatus, Connector, ConnectorPublication } from '@universo/applications-backend'
import { createLinkedApplication } from '../helpers/createLinkedApplication'
import { TARGET_APP_STRUCTURE_VERSION } from '../../applications/constants'
import {
    seedPredefinedElements,
    syncEnumerationValues,
    persistPublishedLayouts,
    persistPublishedWidgets,
    persistSeedWarnings
} from '../../applications/routes/applicationSyncRoutes'
// Import services
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'
import { MetahubElementsService } from '../../metahubs/services/MetahubElementsService'
import { MetahubHubsService } from '../../metahubs/services/MetahubHubsService'
import { MetahubEnumerationValuesService } from '../../metahubs/services/MetahubEnumerationValuesService'

// Helper: Resolve user ID from request
const resolveUserId = (req: Request): string | undefined => {
    const user = (req as unknown as { user?: { id?: string; sub?: string; user_id?: string; userId?: string } }).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

interface RequestWithDbContext extends Request {
    dbContext?: {
        queryRunner?: QueryRunner
    }
}

const getRequestQueryRunner = (req: Request): QueryRunner | undefined => {
    return (req as RequestWithDbContext).dbContext?.queryRunner
}

const resolveTemplateVersionLabel = async (dataSource: DataSource, templateVersionId?: string | null): Promise<string | null> => {
    if (!templateVersionId) return null
    const templateVersion = await dataSource.getRepository(TemplateVersion).findOneBy({ id: templateVersionId })
    return templateVersion?.versionLabel ?? null
}

// Validation Schemas
const localizedInputSchema = z.union([z.string(), z.record(z.string())]).transform((val) => (typeof val === 'string' ? { en: val } : val))

const createPublicationSchema = z.object({
    name: localizedInputSchema.optional(),
    description: localizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    autoCreateApplication: z.boolean().optional().default(false),
    createApplicationSchema: z.boolean().optional().default(false),
    // First version data
    versionName: localizedInputSchema.optional(),
    versionDescription: localizedInputSchema.optional(),
    versionNamePrimaryLocale: z.string().optional(),
    versionDescriptionPrimaryLocale: z.string().optional(),
    versionBranchId: z.string().uuid().optional(),
    // Optional custom application name/description
    applicationName: localizedInputSchema.optional(),
    applicationDescription: localizedInputSchema.optional(),
    applicationNamePrimaryLocale: z.string().optional(),
    applicationDescriptionPrimaryLocale: z.string().optional()
})

const updatePublicationSchema = z.object({
    name: localizedInputSchema.optional(),
    description: localizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    expectedVersion: z.number().int().positive().optional()
})

const syncSchema = z.object({
    confirmDestructive: z.boolean().optional().default(false)
})

/**
 * Injects layout + zone-widget data into an existing MetahubSnapshot **in place**.
 * Must be called after `serializeMetahub()` to produce a complete snapshot.
 *
 * @see SnapshotSerializer.serializeMetahub — produces the base snapshot without layouts.
 */
const attachLayoutsToSnapshot = async (options: {
    schemaService: MetahubSchemaService
    snapshot: MetahubSnapshot
    metahubId: string
    userId: string
}): Promise<void> => {
    const { schemaService, snapshot, metahubId, userId } = options

    try {
        const knex = KnexClient.getInstance()
        const branchSchemaName = await schemaService.ensureSchema(metahubId, userId)

        const layoutRows = await knex
            .withSchema(branchSchemaName)
            .from('_mhb_layouts')
            .where({ _upl_deleted: false, _mhb_deleted: false })
            .select(['id', 'template_key', 'name', 'description', 'config', 'is_active', 'is_default', 'sort_order'])
            .orderBy([
                { column: 'sort_order', order: 'asc' },
                { column: '_upl_created_at', order: 'asc' }
            ])

        const layouts = (layoutRows ?? []).map((r: any) => ({
            id: String(r.id),
            templateKey: String(r.template_key ?? 'dashboard'),
            name: (r.name as Record<string, unknown>) ?? {},
            description: (r.description as Record<string, unknown> | null) ?? null,
            config: (r.config as Record<string, unknown>) ?? {},
            isActive: Boolean(r.is_active),
            isDefault: Boolean(r.is_default),
            sortOrder: typeof r.sort_order === 'number' ? r.sort_order : 0
        }))

        const activeLayouts = layouts.filter((layout) => layout.isActive)
        const defaultLayout = activeLayouts.find((layout) => layout.isDefault) ?? activeLayouts[0] ?? null

        snapshot.layouts = activeLayouts
        snapshot.defaultLayoutId = defaultLayout?.id ?? null
        snapshot.layoutConfig = defaultLayout?.config ?? {}

        const hasLayoutZoneWidgets = await knex.schema.withSchema(branchSchemaName).hasTable('_mhb_widgets')
        if (hasLayoutZoneWidgets) {
            // Collect active (non-deleted) layout IDs to exclude orphan widgets
            const activeLayoutIds = (snapshot.layouts ?? []).map((l) => l.id)

            const zoneRows = await knex
                .withSchema(branchSchemaName)
                .from('_mhb_widgets')
                .where({ _upl_deleted: false, _mhb_deleted: false })
                .modify((qb) => {
                    if (activeLayoutIds.length > 0) {
                        qb.whereIn('layout_id', activeLayoutIds)
                    }
                })
                .select(['id', 'layout_id', 'zone', 'widget_key', 'sort_order', 'config', 'is_active'])
                .orderBy([
                    { column: 'layout_id', order: 'asc' },
                    { column: 'zone', order: 'asc' },
                    { column: 'sort_order', order: 'asc' },
                    { column: '_upl_created_at', order: 'asc' }
                ])

            snapshot.layoutZoneWidgets = (zoneRows ?? []).map((row: any) => ({
                id: String(row.id),
                layoutId: String(row.layout_id),
                zone: String(row.zone),
                widgetKey: String(row.widget_key),
                sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
                config: row.config && typeof row.config === 'object' ? row.config : {},
                isActive: row.is_active !== false
            }))
        } else {
            snapshot.layoutZoneWidgets = []
        }
    } catch (e) {
        console.warn('[Publications] Failed to load metahub layout config (ignored)', e)
        snapshot.layouts = []
        snapshot.layoutZoneWidgets = []
        snapshot.defaultLayoutId = null
        snapshot.layoutConfig = {}
    }
}

/**
 * Marks applications linked to a publication as UPDATE_AVAILABLE when the
 * active publication version changes. Only affects applications whose
 * current schema is SYNCED and whose lastSyncedPublicationVersionId differs
 * from the new active version.
 *
 * Uses a single UPDATE query with sub-select to avoid N+1 loops.
 */
async function notifyLinkedApplicationsUpdateAvailable(ds: DataSource, publicationId: string, newActiveVersionId: string): Promise<void> {
    try {
        const applicationRepo = ds.getRepository(Application)

        // Single query: update all SYNCED applications linked to this publication
        // whose lastSyncedPublicationVersionId differs from the new active version
        await applicationRepo
            .createQueryBuilder()
            .update(Application)
            .set({ schemaStatus: ApplicationSchemaStatus.UPDATE_AVAILABLE })
            .where(
                'id IN (' +
                    applicationRepo
                        .createQueryBuilder('app')
                        .select('app.id')
                        .innerJoin(Connector, 'c', 'c.applicationId = app.id')
                        .innerJoin(ConnectorPublication, 'cp', 'cp.connectorId = c.id')
                        .where('cp.publicationId = :publicationId')
                        .andWhere('app.schemaStatus = :synced')
                        .andWhere('(app.lastSyncedPublicationVersionId IS NULL OR app.lastSyncedPublicationVersionId != :newVer)')
                        .getQuery() +
                    ')'
            )
            .setParameters({
                publicationId,
                synced: ApplicationSchemaStatus.SYNCED,
                newVer: newActiveVersionId
            })
            .execute()
    } catch (err) {
        // Non-critical: log and continue — the migration guard will still detect the delta
        console.warn('[Publications] Failed to notify linked applications of update:', err)
    }
}

export function createPublicationsRoutes(
    ensureAuth: RequestHandler,
    getDataSource: () => DataSource,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    const ensureMetahubRouteAccess = async (
        req: Request,
        res: Response,
        metahubId: string,
        permission?: 'manageMembers' | 'manageMetahub' | 'createContent' | 'editContent' | 'deleteContent'
    ): Promise<string | null> => {
        const userId = resolveUserId(req)
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' })
            return null
        }

        await ensureMetahubAccess(getDataSource(), userId, metahubId, permission, getRequestQueryRunner(req))
        return userId
    }

    // Helper to get repositories and services
    const repos = (req: Request) => {
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)

        const schemaService = new MetahubSchemaService(ds, undefined, manager)
        const objectsService = new MetahubObjectsService(schemaService)
        const attributesService = new MetahubAttributesService(schemaService)
        const elementsService = new MetahubElementsService(schemaService, objectsService, attributesService)

        return {
            manager,
            publicationRepo: manager.getRepository(Publication),
            metahubRepo: manager.getRepository(Metahub),
            versionRepo: manager.getRepository(PublicationVersion),
            objectsService,
            attributesService,
            elementsService
        }
    }

    // LIST AVAILABLE
    router.get(
        '/publications/available',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const ds = getDataSource()
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' })
            }

            const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 100)
            const offset = Math.max(parseInt(req.query.offset as string) || 0, 0)

            const manager = getRequestManager(req, ds)
            const publications = await manager.query(
                `
                SELECT
                    p.id,
                    p.schema_name as "codename",
                    p.schema_name as "schemaName",
                    p.name,
                    p.description,
                    p._upl_version as "version",
                    p._upl_created_at as "createdAt",
                    m.id as "metahubId",
                    COALESCE(m.codename, m.slug, m.id::text) as "metahubCodename",
                    m.name as "metahubName"
                FROM metahubs.publications p
                JOIN metahubs.metahubs m ON m.id = p.metahub_id
                JOIN metahubs.metahubs_users mu ON mu.metahub_id = m.id
                WHERE mu.user_id = $1
                ORDER BY p._upl_created_at DESC
                LIMIT $2 OFFSET $3
            `,
                [userId, limit, offset]
            )

            const items = publications.map((pub: any) => ({
                id: pub.id,
                codename: pub.codename,
                schemaName: pub.schemaName,
                name: pub.name,
                description: pub.description,
                version: pub.version || 1,
                createdAt: pub.createdAt,
                metahub: {
                    id: pub.metahubId,
                    codename: pub.metahubCodename,
                    name: pub.metahubName
                }
            }))

            const countResult = await manager.query(
                `
                SELECT COUNT(*) as total
                FROM metahubs.publications p
                JOIN metahubs.metahubs m ON m.id = p.metahub_id
                JOIN metahubs.metahubs_users mu ON mu.metahub_id = m.id
                WHERE mu.user_id = $1
            `,
                [userId]
            )

            return res.json({
                items,
                total: parseInt(countResult[0]?.total || '0', 10)
            })
        })
    )

    // LIST BY METAHUB
    router.get(
        '/metahub/:metahubId/publications',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const userId = await ensureMetahubRouteAccess(req, res, metahubId)
            if (!userId) return
            const { publicationRepo, metahubRepo } = repos(req)

            const metahub = await metahubRepo.findOneBy({ id: metahubId })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publications = await publicationRepo.find({
                where: { metahubId },
                order: { _uplCreatedAt: 'DESC' }
            })

            const enrichedPublications = publications.map((publication) => ({
                id: publication.id,
                metahubId,
                name: publication.name,
                description: publication.description,
                schemaName: publication.schemaName,
                schemaStatus: publication.schemaStatus,
                schemaError: publication.schemaError,
                schemaSyncedAt: publication.schemaSyncedAt,
                accessMode: publication.accessMode,
                autoCreateApplication: publication.autoCreateApplication,
                activeVersionId: publication.activeVersionId,
                version: publication._uplVersion || 1,
                createdAt: publication._uplCreatedAt,
                updatedAt: publication._uplUpdatedAt
            }))

            return res.json({
                items: enrichedPublications,
                total: enrichedPublications.length
            })
        })
    )

    // CREATE
    router.post(
        '/metahub/:metahubId/publications',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const ds = getDataSource()
            const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
            if (!userId) return
            const manager = getRequestManager(req, ds)

            const parsed = createPublicationSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: parsed.error.flatten()
                })
            }

            const {
                name,
                description,
                namePrimaryLocale,
                descriptionPrimaryLocale,
                autoCreateApplication,
                createApplicationSchema,
                versionName,
                versionDescription,
                versionNamePrimaryLocale,
                versionDescriptionPrimaryLocale,
                versionBranchId,
                applicationName,
                applicationDescription,
                applicationNamePrimaryLocale,
                applicationDescriptionPrimaryLocale
            } = parsed.data

            const metahubRepo = manager.getRepository(Metahub)
            const metahub = await metahubRepo.findOneBy({ id: metahubId })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publicationRepo = manager.getRepository(Publication)
            const existingPublicationsCount = await publicationRepo.count({ where: { metahubId } })
            if (existingPublicationsCount > 0) {
                return res.status(400).json({
                    error: 'Single publication limit reached',
                    message:
                        'Currently, only one Publication per Metahub is supported. This restriction will be removed in future versions.'
                })
            }

            const branchRepo = manager.getRepository(MetahubBranch)
            const effectiveBranchId = versionBranchId ?? metahub.defaultBranchId ?? null
            if (!effectiveBranchId) {
                return res.status(400).json({ error: 'Default branch is not configured' })
            }
            const branch = await branchRepo.findOne({ where: { id: effectiveBranchId, metahubId } })
            if (!branch) {
                return res.status(400).json({ error: 'Branch not found' })
            }

            const schemaService = new MetahubSchemaService(ds, effectiveBranchId, manager)
            const objectsService = new MetahubObjectsService(schemaService)
            const attributesService = new MetahubAttributesService(schemaService)
            const elementsService = new MetahubElementsService(schemaService, objectsService, attributesService)
            const hubsService = new MetahubHubsService(schemaService)
            const enumerationValuesService = new MetahubEnumerationValuesService(schemaService)
            const serializer = new SnapshotSerializer(
                objectsService,
                attributesService,
                elementsService,
                hubsService,
                enumerationValuesService
            )
            const templateVersionLabel = await resolveTemplateVersionLabel(ds, metahub.templateVersionId)
            const snapshot = await serializer.serializeMetahub(metahubId, {
                structureVersion: branch.structureVersion ?? 1,
                templateVersion: templateVersionLabel
            })

            await attachLayoutsToSnapshot({ schemaService, snapshot, metahubId, userId })
            const snapshotHash = serializer.calculateHash(snapshot)

            const result = await ds.transaction(async (manager) => {
                const publicationRepoTx = manager.getRepository(Publication)

                // 1. Create Publication
                const publication = publicationRepoTx.create({
                    metahubId,
                    name: buildLocalizedContent(sanitizeLocalizedInput(name || {}), namePrimaryLocale || 'en'),
                    description: description
                        ? buildLocalizedContent(sanitizeLocalizedInput(description), descriptionPrimaryLocale || 'en')
                        : undefined,
                    schemaStatus: PublicationSchemaStatus.DRAFT,
                    autoCreateApplication: autoCreateApplication ?? false,
                    _uplCreatedBy: userId,
                    _uplUpdatedBy: userId
                })
                await publicationRepoTx.save(publication)

                // 2. Generate schema name (use raw update to avoid version increment)
                const schemaName = generateSchemaName(publication.id)
                publication.schemaName = schemaName
                await publicationRepoTx
                    .createQueryBuilder()
                    .update(Publication)
                    .set({ schemaName })
                    .where('id = :id', { id: publication.id })
                    .execute()

                // 3. Auto-create Application via shared helper
                let applicationData: { application: Application; appSchemaName: string } | null = null
                if (autoCreateApplication && metahub) {
                    // Use custom application name/description if provided, else fall back to publication name
                    const appName = applicationName && Object.keys(applicationName).length > 0
                        ? (buildLocalizedContent(sanitizeLocalizedInput(applicationName), applicationNamePrimaryLocale || 'en') ?? null)
                        : publication.name
                    const appDescription = applicationDescription && Object.keys(applicationDescription).length > 0
                        ? (buildLocalizedContent(sanitizeLocalizedInput(applicationDescription), applicationDescriptionPrimaryLocale || 'en') ?? null)
                        : publication.description
                    const linked = await createLinkedApplication({
                        manager,
                        publicationId: publication.id,
                        publicationName: appName,
                        publicationDescription: appDescription,
                        metahubName: metahub.name,
                        metahubDescription: metahub.description,
                        userId
                    })
                    applicationData = { application: linked.application, appSchemaName: linked.appSchemaName }
                }

                // 4. Auto-create first version (v1)
                const versionRepoTx = manager.getRepository(PublicationVersion)
                const firstVersion = new PublicationVersion()
                firstVersion.publicationId = publication.id
                firstVersion.versionNumber = 1

                // Use provided version data or defaults
                const defaultVersionName = { en: 'Initial Version', ru: 'Начальная версия' }

                firstVersion.name =
                    versionName && Object.keys(versionName).length > 0
                        ? buildLocalizedContent(sanitizeLocalizedInput(versionName), versionNamePrimaryLocale || 'en')!
                        : buildLocalizedContent(defaultVersionName, 'en')!

                // Description is optional - only set if provided
                firstVersion.description =
                    versionDescription && Object.keys(versionDescription).length > 0
                        ? buildLocalizedContent(sanitizeLocalizedInput(versionDescription), versionDescriptionPrimaryLocale || 'en')!
                        : null

                firstVersion.isActive = true
                firstVersion.snapshotJson = snapshot as unknown as Record<string, unknown>
                firstVersion.snapshotHash = snapshotHash
                firstVersion.branchId = effectiveBranchId
                firstVersion._uplCreatedBy = userId
                firstVersion._uplUpdatedBy = userId
                await versionRepoTx.save(firstVersion)

                // Update activeVersionId using raw update to avoid version increment
                publication.activeVersionId = firstVersion.id
                await publicationRepoTx
                    .createQueryBuilder()
                    .update(Publication)
                    .set({ activeVersionId: firstVersion.id })
                    .where('id = :id', { id: publication.id })
                    .execute()

                return { publication, firstVersion, applicationData }
            })

            // DDL generation OUTSIDE transaction (avoids Knex/TypeORM deadlock)
            if (createApplicationSchema && result.applicationData) {
                try {
                    const { generator, migrationManager } = getDDLServices()
                    const catalogDefs = serializer.deserializeSnapshot(snapshot)

                    const genResult = await generator.generateFullSchema(result.applicationData.appSchemaName, catalogDefs, {
                        recordMigration: true,
                        migrationDescription: 'initial_schema_from_publication',
                        migrationManager,
                        migrationMeta: {
                            publicationSnapshotHash: snapshotHash,
                            publicationId: result.publication.id,
                            publicationVersionId: result.firstVersion.id
                        }
                    })

                    if (genResult.success) {
                        const appSchemaName = result.applicationData.appSchemaName
                        const applicationRepo = ds.getRepository(Application)
                        await applicationRepo
                            .createQueryBuilder()
                            .update(Application)
                            .set({
                                schemaStatus: ApplicationSchemaStatus.SYNCED,
                                schemaSyncedAt: new Date(),
                                schemaSnapshot: generator.generateSnapshot(catalogDefs) as unknown as Record<string, unknown> as any,
                                appStructureVersion: TARGET_APP_STRUCTURE_VERSION,
                                lastSyncedPublicationVersionId: result.firstVersion.id,
                                _uplUpdatedBy: userId
                            })
                            .where('id = :id', { id: result.applicationData.application.id })
                            .execute()

                        // Post-DDL operations: sync system metadata, layouts, widgets, enumerations, seed elements
                        // Same as applicationSyncRoutes initial creation path
                        await generator.syncSystemMetadata(appSchemaName, catalogDefs, {
                            userId,
                            removeMissing: true
                        })
                        await persistPublishedLayouts({ schemaName: appSchemaName, snapshot, userId })
                        await persistPublishedWidgets({ schemaName: appSchemaName, snapshot, userId })
                        await syncEnumerationValues(appSchemaName, snapshot, userId)

                        try {
                            const seedWarnings = await seedPredefinedElements(appSchemaName, snapshot, catalogDefs, userId)
                            await persistSeedWarnings(appSchemaName, migrationManager, seedWarnings)
                        } catch (seedErr: unknown) {
                            const msg = seedErr instanceof Error ? seedErr.message : String(seedErr)
                            console.warn(`[Publications] Seed predefined elements failed (non-fatal): ${msg}`)
                        }
                    }
                    // If genResult is not successful, application exists with schemaStatus=DRAFT
                    // User can trigger sync manually later
                } catch (ddlError) {
                    // Non-fatal: publication + application created successfully,
                    // but schema not generated. Log and continue.
                    console.error('DDL schema generation failed (non-fatal):', ddlError)
                }
            }

            return res.status(201).json({
                id: result.publication.id,
                metahubId,
                name: result.publication.name,
                description: result.publication.description,
                schemaName: result.publication.schemaName,
                schemaStatus: result.publication.schemaStatus,
                schemaError: result.publication.schemaError,
                schemaSyncedAt: result.publication.schemaSyncedAt,
                accessMode: result.publication.accessMode,
                autoCreateApplication: result.publication.autoCreateApplication,
                activeVersionId: result.publication.activeVersionId,
                version: result.publication._uplVersion || 1,
                createdAt: result.publication._uplCreatedAt,
                updatedAt: result.publication._uplUpdatedAt
            })
        })
    )

    // GET SINGLE
    router.get(
        '/metahub/:metahubId/publication/:publicationId',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, publicationId } = req.params
            const userId = await ensureMetahubRouteAccess(req, res, metahubId)
            if (!userId) return
            const { publicationRepo, metahubRepo } = repos(req)

            const metahub = await metahubRepo.findOneBy({ id: metahubId })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publication = await publicationRepo.findOneBy({ id: publicationId })
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
            }

            if (publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
            }

            return res.json({
                id: publication.id,
                metahubId,
                name: publication.name,
                description: publication.description,
                schemaName: publication.schemaName,
                schemaStatus: publication.schemaStatus,
                schemaError: publication.schemaError,
                schemaSyncedAt: publication.schemaSyncedAt,
                accessMode: publication.accessMode,
                accessConfig: publication.accessConfig,
                autoCreateApplication: publication.autoCreateApplication,
                activeVersionId: publication.activeVersionId,
                schemaSnapshot: publication.schemaSnapshot,
                version: publication._uplVersion || 1,
                createdAt: publication._uplCreatedAt,
                updatedAt: publication._uplUpdatedAt
            })
        })
    )

    // UPDATE
    router.patch(
        '/metahub/:metahubId/publication/:publicationId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, publicationId } = req.params
            const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
            if (!userId) return
            const { publicationRepo, metahubRepo } = repos(req)

            const parsed = updatePublicationSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }

            const metahub = await metahubRepo.findOneBy({ id: metahubId })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publication = await publicationRepo.findOneBy({ id: publicationId })
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
            }

            if (publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
            }

            const { name, description, namePrimaryLocale, descriptionPrimaryLocale, expectedVersion } = parsed.data

            // Optimistic locking check
            if (expectedVersion !== undefined) {
                const currentVersion = publication._uplVersion || 1
                if (currentVersion !== expectedVersion) {
                    throw new OptimisticLockError({
                        entityId: publicationId,
                        entityType: 'publication',
                        expectedVersion,
                        actualVersion: currentVersion,
                        updatedAt: publication._uplUpdatedAt,
                        updatedBy: publication._uplUpdatedBy ?? null
                    })
                }
            }

            if (name) {
                const nameVlc = buildLocalizedContent(sanitizeLocalizedInput(name), namePrimaryLocale || 'en')
                if (nameVlc) publication.name = nameVlc
            }
            if (description) {
                const descVlc = buildLocalizedContent(sanitizeLocalizedInput(description), descriptionPrimaryLocale || 'en')
                publication.description = descVlc ?? null
            }

            publication._uplUpdatedBy = userId

            await publicationRepo.save(publication)

            return res.json({
                id: publication.id,
                metahubId,
                name: publication.name,
                description: publication.description,
                schemaName: publication.schemaName,
                schemaStatus: publication.schemaStatus,
                schemaError: publication.schemaError,
                schemaSyncedAt: publication.schemaSyncedAt,
                accessMode: publication.accessMode,
                accessConfig: publication.accessConfig,
                autoCreateApplication: publication.autoCreateApplication,
                activeVersionId: publication.activeVersionId,
                schemaSnapshot: publication.schemaSnapshot,
                version: publication._uplVersion || 1,
                createdAt: publication._uplCreatedAt,
                updatedAt: publication._uplUpdatedAt
            })
        })
    )

    // DELETE
    router.delete(
        '/metahub/:metahubId/publication/:publicationId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, publicationId } = req.params
            const confirm = req.query.confirm === 'true'
            const ds = getDataSource()
            const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
            if (!userId) return

            if (!confirm) {
                return res.status(400).json({ error: 'Deletion requires confirmation' })
            }

            const manager = getRequestManager(req, ds)
            const metahubRepo = manager.getRepository(Metahub)
            const metahub = await metahubRepo.findOneBy({ id: metahubId })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publicationRepo = manager.getRepository(Publication)
            const publication = await publicationRepo.findOneBy({ id: publicationId })
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
            }

            if (publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
            }

            const lockKey = uuidToLockKey(`publication-delete:${publicationId}`)
            const lockAcquired = await acquireAdvisoryLock(KnexClient.getInstance(), lockKey)
            if (!lockAcquired) {
                return res.status(409).json({
                    error: 'Could not acquire publication delete lock. Please retry.'
                })
            }

            let deletedSchemaName: string | null = publication.schemaName
            try {
                await ds.transaction(async (txManager) => {
                    const metahubRepoTx = txManager.getRepository(Metahub)
                    const publicationRepoTx = txManager.getRepository(Publication)

                    const metahubLocked = await metahubRepoTx
                        .createQueryBuilder('metahub')
                        .setLock('pessimistic_write')
                        .where('metahub.id = :id', { id: metahubId })
                        .getOne()
                    if (!metahubLocked) {
                        throw new Error('Metahub not found')
                    }

                    const publicationLocked = await publicationRepoTx
                        .createQueryBuilder('publication')
                        .setLock('pessimistic_write')
                        .where('publication.id = :id', { id: publicationId })
                        .andWhere('publication.metahubId = :metahubId', { metahubId })
                        .getOne()
                    if (!publicationLocked) {
                        throw new Error('Publication not found')
                    }

                    deletedSchemaName = publicationLocked.schemaName
                    if (deletedSchemaName) {
                        const { generator } = getDDLServices()
                        await generator.dropSchema(deletedSchemaName)
                    }

                    // Reset UPDATE_AVAILABLE → SYNCED on applications linked to this publication.
                    // Must run BEFORE remove() because FK fk_cp_publication has ON DELETE CASCADE —
                    // removing the publication would delete ConnectorPublication rows first.
                    // Uses a single UPDATE with sub-select to avoid N+1 loops.
                    const txApplicationRepo = txManager.getRepository(Application)
                    await txApplicationRepo
                        .createQueryBuilder()
                        .update(Application)
                        .set({ schemaStatus: ApplicationSchemaStatus.SYNCED })
                        .where(
                            'id IN (' +
                                txApplicationRepo
                                    .createQueryBuilder('app')
                                    .select('app.id')
                                    .innerJoin(Connector, 'c', 'c.applicationId = app.id')
                                    .innerJoin(ConnectorPublication, 'cp', 'cp.connectorId = c.id')
                                    .where('cp.publicationId = :publicationId')
                                    .andWhere('app.schemaStatus = :updateAvailable')
                                    .getQuery() +
                                ')'
                        )
                        .setParameters({
                            publicationId,
                            updateAvailable: ApplicationSchemaStatus.UPDATE_AVAILABLE
                        })
                        .execute()

                    await publicationRepoTx.remove(publicationLocked)
                })
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to delete publication'
                const statusCode = message === 'Metahub not found' || message === 'Publication not found' ? 404 : 500
                return res.status(statusCode).json({ error: message })
            } finally {
                await releaseAdvisoryLock(KnexClient.getInstance(), lockKey)
            }

            return res.json({
                success: true,
                message: `Publication and schema "${deletedSchemaName}" deleted`
            })
        })
    )

    // GET LINKED APPS
    // (Unchanged logic except standard refactoring)
    router.get(
        '/metahub/:metahubId/publication/:publicationId/applications',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, publicationId } = req.params
            const ds = getDataSource()
            const userId = await ensureMetahubRouteAccess(req, res, metahubId)
            if (!userId) return
            const manager = getRequestManager(req, ds)

            const metahubRepo = manager.getRepository(Metahub)
            if (!(await metahubRepo.findOneBy({ id: metahubId }))) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publicationRepo = manager.getRepository(Publication)
            const publication = await publicationRepo.findOneBy({ id: publicationId })
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
            }

            if (publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
            }

            const linkedApps = await manager.query(
                `
                SELECT DISTINCT a.id, a.name, a.description, a.slug, a._upl_created_at as "createdAt"
                FROM applications.applications a
                JOIN applications.connectors c ON c.application_id = a.id
                JOIN applications.connectors_publications cp ON cp.connector_id = c.id
                WHERE cp.publication_id = $1
                ORDER BY a._upl_created_at DESC
            `,
                [publicationId]
            )

            return res.json({ items: linkedApps, total: linkedApps.length })
        })
    )

    // CREATE LINKED APPLICATION for a publication
    const createApplicationForPublicationSchema = z.object({
        name: localizedInputSchema.optional(),
        description: localizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        createApplicationSchema: z.boolean().optional().default(false)
    })

    router.post(
        '/metahub/:metahubId/publication/:publicationId/applications',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, publicationId } = req.params
            const ds = getDataSource()
            const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
            if (!userId) return

            const parsed = createApplicationForPublicationSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }

            const manager = getRequestManager(req, ds)
            const metahubRepo = manager.getRepository(Metahub)
            const metahub = await metahubRepo.findOneBy({ id: metahubId })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publicationRepo = manager.getRepository(Publication)
            const publication = await publicationRepo.findOneBy({ id: publicationId })
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
            }
            if (publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
            }

            const { name, description, namePrimaryLocale, descriptionPrimaryLocale, createApplicationSchema } = parsed.data

            // Build localized name — use provided or fall back to publication name
            const appName =
                name && Object.keys(name).length > 0
                    ? buildLocalizedContent(sanitizeLocalizedInput(name), namePrimaryLocale || 'en')
                    : publication.name
            const appDescription =
                description && Object.keys(description).length > 0
                    ? buildLocalizedContent(sanitizeLocalizedInput(description), descriptionPrimaryLocale || 'en')
                    : publication.description

            // Create application inside transaction
            const result = await ds.transaction(async (txManager) => {
                const linked = await createLinkedApplication({
                    manager: txManager,
                    publicationId: publication.id,
                    publicationName: appName ?? null,
                    publicationDescription: appDescription ?? null,
                    metahubName: metahub.name,
                    metahubDescription: metahub.description ?? null,
                    userId
                })
                return linked
            })

            // DDL generation OUTSIDE transaction (same pattern as CREATE publication)
            if (createApplicationSchema && publication.activeVersionId) {
                try {
                    const versionRepo = ds.getRepository(PublicationVersion)
                    const activeVersion = await versionRepo.findOneBy({ id: publication.activeVersionId })
                    if (activeVersion?.snapshotJson) {
                        const branchId = activeVersion.branchId ?? metahub.defaultBranchId
                        if (!branchId) {
                            console.error('[Publications] Cannot generate schema for new application: missing branchId on active publication version and metahub.defaultBranchId')
                            return res.status(201).json({
                                application: {
                                    id: result.application.id,
                                    name: result.application.name,
                                    description: result.application.description,
                                    slug: result.application.slug,
                                    schemaName: result.appSchemaName
                                },
                                connector: {
                                    id: result.connector.id
                                },
                                warning: 'Application created but schema generation skipped: no valid branchId'
                            })
                        }
                        const snapshotData = activeVersion.snapshotJson as unknown as MetahubSnapshot
                        const schemaService = new MetahubSchemaService(ds, branchId, manager)
                        const objectsService = new MetahubObjectsService(schemaService)
                        const attributesService = new MetahubAttributesService(schemaService)
                        const snapshotSerializer = new SnapshotSerializer(objectsService, attributesService)
                        const catalogDefs = snapshotSerializer.deserializeSnapshot(snapshotData)

                        const { generator, migrationManager } = getDDLServices()
                        const genResult = await generator.generateFullSchema(result.appSchemaName, catalogDefs, {
                            recordMigration: true,
                            migrationDescription: 'initial_schema_from_publication',
                            migrationManager,
                            migrationMeta: {
                                publicationSnapshotHash: activeVersion.snapshotHash,
                                publicationId: publication.id,
                                publicationVersionId: activeVersion.id
                            }
                        })

                        if (genResult.success) {
                            const applicationRepo = ds.getRepository(Application)
                            await applicationRepo
                                .createQueryBuilder()
                                .update(Application)
                                .set({
                                    schemaStatus: ApplicationSchemaStatus.SYNCED,
                                    schemaSyncedAt: new Date(),
                                    schemaSnapshot: generator.generateSnapshot(catalogDefs) as unknown as Record<string, unknown> as any,
                                    appStructureVersion: TARGET_APP_STRUCTURE_VERSION,
                                    lastSyncedPublicationVersionId: activeVersion.id,
                                    _uplUpdatedBy: userId
                                })
                                .where('id = :id', { id: result.application.id })
                                .execute()

                            // Post-DDL operations: sync system metadata, layouts, widgets, enumerations, seed elements
                            await generator.syncSystemMetadata(result.appSchemaName, catalogDefs, {
                                userId,
                                removeMissing: true
                            })
                            await persistPublishedLayouts({ schemaName: result.appSchemaName, snapshot: snapshotData, userId })
                            await persistPublishedWidgets({ schemaName: result.appSchemaName, snapshot: snapshotData, userId })
                            await syncEnumerationValues(result.appSchemaName, snapshotData, userId)

                            try {
                                const seedWarnings = await seedPredefinedElements(result.appSchemaName, snapshotData, catalogDefs, userId)
                                await persistSeedWarnings(result.appSchemaName, migrationManager, seedWarnings)
                            } catch (seedErr: unknown) {
                                const msg = seedErr instanceof Error ? seedErr.message : String(seedErr)
                                console.warn(`[Publications] Seed predefined elements for new application failed (non-fatal): ${msg}`)
                            }
                        }
                    }
                } catch (ddlError) {
                    console.error('DDL schema generation for new application failed (non-fatal):', ddlError)
                }
            }

            return res.status(201).json({
                application: {
                    id: result.application.id,
                    name: result.application.name,
                    description: result.application.description,
                    slug: result.application.slug,
                    schemaName: result.appSchemaName
                },
                connector: {
                    id: result.connector.id
                }
            })
        })
    )

    // GET DIFF
    router.get(
        '/metahub/:metahubId/publication/:publicationId/diff',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, publicationId } = req.params
            const userId = await ensureMetahubRouteAccess(req, res, metahubId)
            if (!userId) return
            const { publicationRepo, metahubRepo, versionRepo, objectsService, attributesService } = repos(req)

            const metahub = await metahubRepo.findOneBy({ id: metahubId })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publication = await publicationRepo.findOneBy({ id: publicationId })
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
            }

            if (publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
            }

            if (!publication.activeVersionId) {
                return res.status(400).json({
                    error: 'No active version found',
                    message: 'Publication must have an active version to sync.'
                })
            }

            const activeVersion = await versionRepo.findOneBy({ id: publication.activeVersionId })
            if (!activeVersion) {
                return res.status(404).json({ error: 'Active version data not found' })
            }

            const snapshot = activeVersion.snapshotJson as unknown as MetahubSnapshot
            if (!snapshot || typeof snapshot !== 'object' || !snapshot.entities || typeof snapshot.entities !== 'object') {
                return res.status(400).json({ error: 'Invalid publication snapshot' })
            }

            const serializer = new SnapshotSerializer(objectsService, attributesService)
            const catalogDefs = serializer.deserializeSnapshot(snapshot)

            const oldSnapshot = publication.schemaSnapshot as SchemaSnapshot | null

            const { generator, migrator } = getDDLServices()
            const diff: SchemaDiff = migrator.calculateDiff(oldSnapshot, catalogDefs)

            const schemaExists = await generator.schemaExists(publication.schemaName || '')

            return res.json({
                schemaExists,
                diff: {
                    hasChanges: diff.hasChanges,
                    summary: diff.summary,
                    additive: diff.additive.map((c: any) => c.description),
                    destructive: diff.destructive.map((c: any) => c.description)
                }
            })
        })
    )

    // SYNC
    router.post(
        '/metahub/:metahubId/publication/:publicationId/sync',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, publicationId } = req.params
            const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
            if (!userId) return
            const { publicationRepo, metahubRepo, versionRepo, objectsService, attributesService } = repos(req)

            const parsed = syncSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }

            const { confirmDestructive } = parsed.data

            const metahub = await metahubRepo.findOneBy({ id: metahubId })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publication = await publicationRepo.findOneBy({ id: publicationId })
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
            }

            if (publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
            }

            if (!publication.activeVersionId) {
                return res.status(400).json({
                    error: 'No active version found',
                    message: 'Publication must have an active version to sync.'
                })
            }

            const activeVersion = await versionRepo.findOneBy({ id: publication.activeVersionId })
            if (!activeVersion) {
                return res.status(404).json({ error: 'Active version data not found' })
            }

            const snapshot = activeVersion.snapshotJson as unknown as MetahubSnapshot
            if (!snapshot || typeof snapshot !== 'object' || !snapshot.entities || typeof snapshot.entities !== 'object') {
                return res.status(400).json({ error: 'Invalid publication snapshot' })
            }

            const serializer = new SnapshotSerializer(objectsService, attributesService)
            const catalogDefs = serializer.deserializeSnapshot(snapshot)

            const { generator, migrator, migrationManager } = getDDLServices()

            const schemaExists = await generator.schemaExists(publication.schemaName || '')

            publication.schemaStatus = PublicationSchemaStatus.PENDING
            await publicationRepo.save(publication)

            try {
                if (!schemaExists) {
                    const result = await generator.generateFullSchema(publication.schemaName!, catalogDefs, {
                        recordMigration: true,
                        migrationDescription: 'initial_schema',
                        migrationManager
                    })

                    if (!result.success) {
                        publication.schemaStatus = PublicationSchemaStatus.ERROR
                        publication.schemaError = result.errors.join('; ')
                        await publicationRepo.save(publication)

                        return res.status(500).json({ status: 'error', errors: result.errors })
                    }

                    // Generate snapshot
                    // Use SnapshotSerializer which now handles new services logic wrapper if handy,
                    // OR use generic generator snapshot.
                    // But SnapshotSerializer includes Hubs info which DDL generator might miss (DDL generator is generic).
                    // Let's use SnapshotSerializer to be safe and consistent with logic.
                    // But `generator.generateSnapshot` takes `catalogDefs`.
                    // `SnapshotSerializer` takes `metahubId`.
                    // The stored snapshot is used for DIFF.
                    // If we use `SnapshotSerializer`, we get `MetahubSnapshot`.
                    // `migrator.calculateDiff` expects `SchemaSnapshot`.
                    // Are they compatible? `MetahubSnapshot` extends `SchemaSnapshot` likely (or contains entities).
                    // `SnapshotSerializer` returns `MetaEntityDefinition` like structure.
                    // So we should use `SnapshotSerializer` if we want full fidelity for Metahub logic,
                    // but for DDL syncing `catalogDefs` (SchemaSnapshot) is what matters for Tables.
                    // The existing code used `generator.generateSnapshot(catalogDefs)`.
                    // I will stick to that to minimize risk of breaking Diffing.

                    const snapshot = generator.generateSnapshot(catalogDefs)

                    publication.schemaName = result.schemaName
                    publication.schemaStatus = PublicationSchemaStatus.SYNCED
                    publication.schemaError = null
                    publication.schemaSyncedAt = new Date()
                    publication.schemaSnapshot = snapshot as unknown as Record<string, unknown>
                    await publicationRepo.save(publication)

                    return res.json({
                        status: 'created',
                        schemaName: result.schemaName,
                        tablesCreated: result.tablesCreated
                    })
                }

                const oldSnapshot = publication.schemaSnapshot as SchemaSnapshot | null
                const diff = migrator.calculateDiff(oldSnapshot, catalogDefs)

                if (!diff.hasChanges) {
                    await generator.syncSystemMetadata(publication.schemaName!, catalogDefs, {
                        removeMissing: true
                    })
                    const snapshot = generator.generateSnapshot(catalogDefs)
                    publication.schemaStatus = PublicationSchemaStatus.SYNCED
                    publication.schemaSnapshot = snapshot as unknown as Record<string, unknown>
                    await publicationRepo.save(publication)
                    return res.json({ status: 'synced', message: 'Schema up to date' })
                }

                if (diff.destructive.length > 0 && !confirmDestructive) {
                    publication.schemaStatus = PublicationSchemaStatus.OUTDATED
                    await publicationRepo.save(publication)
                    return res.json({
                        status: 'pending_confirmation',
                        diff: {
                            summary: diff.summary,
                            destructive: diff.destructive.map((c: any) => c.description)
                        }
                    })
                }

                const migrationResult = await migrator.applyAllChanges(publication.schemaName!, diff, catalogDefs, confirmDestructive, {
                    recordMigration: true,
                    migrationDescription: 'schema_sync'
                })

                if (!migrationResult.success) {
                    publication.schemaStatus = PublicationSchemaStatus.ERROR
                    publication.schemaError = migrationResult.errors.join('; ')
                    await publicationRepo.save(publication)
                    return res.status(500).json({ status: 'error', errors: migrationResult.errors })
                }

                const newSnapshot = generator.generateSnapshot(catalogDefs)
                publication.schemaStatus = PublicationSchemaStatus.SYNCED
                publication.schemaError = null
                publication.schemaSyncedAt = new Date()
                publication.schemaSnapshot = newSnapshot as unknown as Record<string, unknown>
                await publicationRepo.save(publication)

                return res.json({
                    status: 'migrated',
                    changesApplied: migrationResult.changesApplied
                })
            } catch (error) {
                publication.schemaStatus = PublicationSchemaStatus.ERROR
                publication.schemaError = error instanceof Error ? error.message : 'Unknown error'
                await publicationRepo.save(publication)
                return res.status(500).json({ status: 'error', message: publication.schemaError })
            }
        })
    )

    // GET VERSIONS
    router.get(
        '/metahub/:metahubId/publication/:publicationId/versions',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, publicationId } = req.params
            const userId = await ensureMetahubRouteAccess(req, res, metahubId)
            if (!userId) return
            const { versionRepo, publicationRepo } = repos(req)

            const publication = await publicationRepo.findOneBy({ id: publicationId })
            if (!publication || publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
            }

            const versions = await versionRepo.find({
                where: { publicationId },
                order: { versionNumber: 'DESC' },
                select: ['id', 'versionNumber', 'name', 'description', 'isActive', '_uplCreatedAt', '_uplCreatedBy', 'branchId']
            })

            // Map internal field names to API response format
            const mappedVersions = versions.map((v) => ({
                id: v.id,
                versionNumber: v.versionNumber,
                name: v.name,
                description: v.description,
                isActive: v.isActive,
                createdAt: v._uplCreatedAt,
                createdBy: v._uplCreatedBy,
                branchId: v.branchId
            }))

            return res.json({ items: mappedVersions })
        })
    )

    // CREATE VERSION
    router.post(
        '/metahub/:metahubId/publication/:publicationId/versions',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, publicationId } = req.params
            const { versionRepo, publicationRepo, metahubRepo, manager } = repos(req)
            const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
            if (!userId) return

            const publication = await publicationRepo.findOneBy({ id: publicationId })
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
            }
            if (publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
            }

            const { name, description, namePrimaryLocale, descriptionPrimaryLocale, branchId } = req.body
            if (!name || typeof name !== 'object' || Object.keys(name).length === 0) {
                return res.status(400).json({ error: 'Name is required' })
            }

            const metahub = await metahubRepo.findOneBy({ id: metahubId })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const branchRepo = metahubRepo.manager.getRepository(MetahubBranch)
            const requestedBranchId = typeof branchId === 'string' ? branchId : null
            const effectiveBranchId = requestedBranchId ?? metahub.defaultBranchId ?? null
            if (!effectiveBranchId) {
                return res.status(400).json({ error: 'Default branch is not configured' })
            }
            const branch = await branchRepo.findOne({ where: { id: effectiveBranchId, metahubId } })
            if (!branch) {
                return res.status(400).json({ error: 'Branch not found' })
            }

            const schemaService = new MetahubSchemaService(getDataSource(), effectiveBranchId, manager)
            const objectsService = new MetahubObjectsService(schemaService)
            const attributesService = new MetahubAttributesService(schemaService)
            const elementsService = new MetahubElementsService(schemaService, objectsService, attributesService)
            const hubsService = new MetahubHubsService(schemaService)
            const enumerationValuesService = new MetahubEnumerationValuesService(schemaService)
            const serializer = new SnapshotSerializer(
                objectsService,
                attributesService,
                elementsService,
                hubsService,
                enumerationValuesService
            )
            const templateVersionLabel = await resolveTemplateVersionLabel(getDataSource(), metahub.templateVersionId)
            const snapshot = await serializer.serializeMetahub(metahubId ?? publication.metahubId, {
                structureVersion: branch.structureVersion ?? 1,
                templateVersion: templateVersionLabel
            })

            await attachLayoutsToSnapshot({ schemaService, snapshot, metahubId: metahubId ?? publication.metahubId, userId })
            const snapshotHash = serializer.calculateHash(snapshot)

            // Get next version number
            const lastVersion = await versionRepo.findOne({
                where: { publicationId },
                order: { versionNumber: 'DESC' }
            })
            const nextVersionNumber = (lastVersion?.versionNumber || 0) + 1
            const isDuplicate = lastVersion?.snapshotHash === snapshotHash

            const result = await getDataSource().transaction(async (manager) => {
                const versionRepoTx = manager.getRepository(PublicationVersion)
                const publicationRepoTx = manager.getRepository(Publication)

                const version = new PublicationVersion()
                version.publicationId = publicationId
                version.versionNumber = nextVersionNumber
                version.name = buildLocalizedContent(sanitizeLocalizedInput(name), namePrimaryLocale || 'en')!
                version.description =
                    description && Object.keys(description).length > 0
                        ? buildLocalizedContent(sanitizeLocalizedInput(description), descriptionPrimaryLocale || 'en')!
                        : null
                version.snapshotJson = snapshot as unknown as Record<string, unknown>
                version.snapshotHash = snapshotHash
                version.branchId = effectiveBranchId
                version._uplCreatedBy = userId
                version._uplUpdatedBy = userId

                // Deactivate all other versions and make this one active
                await versionRepoTx.update({ publicationId }, { isActive: false })
                version.isActive = true

                const savedVersion = await versionRepoTx.save(version)
                await publicationRepoTx.update({ id: publicationId }, { activeVersionId: savedVersion.id })

                return savedVersion
            })

            // Notify linked applications about new active version (fire-and-forget)
            await notifyLinkedApplicationsUpdateAvailable(getDataSource(), publicationId, result.id)

            return res.status(201).json({
                ...result,
                isDuplicate
            })
        })
    )

    // ACTIVATE VERSION
    router.post(
        '/metahub/:metahubId/publication/:publicationId/versions/:versionId/activate',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, publicationId, versionId } = req.params
            const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
            if (!userId) return
            const { versionRepo, publicationRepo } = repos(req)

            const publication = await publicationRepo.findOneBy({ id: publicationId })
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
            }
            if (publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
            }

            const version = await versionRepo.findOneBy({ id: versionId, publicationId })
            if (!version) {
                return res.status(404).json({ error: 'Version not found' })
            }

            // Deactivate all other versions
            await versionRepo.update({ publicationId }, { isActive: false })

            // Activate this version
            version.isActive = true
            await versionRepo.save(version)
            await publicationRepo.update({ id: publicationId }, { activeVersionId: version.id })

            // Notify linked applications about new active version
            await notifyLinkedApplicationsUpdateAvailable(getDataSource(), publicationId, version.id)

            return res.json({ success: true, version })
        })
    )

    // UPDATE VERSION
    router.patch(
        '/metahub/:metahubId/publication/:publicationId/versions/:versionId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, publicationId, versionId } = req.params
            const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
            if (!userId) return
            const { versionRepo, publicationRepo } = repos(req)

            const publication = await publicationRepo.findOneBy({ id: publicationId })
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
            }
            if (publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
            }

            const version = await versionRepo.findOneBy({ id: versionId, publicationId })
            if (!version) {
                return res.status(404).json({ error: 'Version not found' })
            }

            const { name, description, namePrimaryLocale, descriptionPrimaryLocale } = req.body

            if (name && typeof name === 'object' && Object.keys(name).length > 0) {
                version.name = buildLocalizedContent(sanitizeLocalizedInput(name), namePrimaryLocale || 'en')!
            }

            if (description !== undefined) {
                version.description =
                    description && Object.keys(description).length > 0
                        ? buildLocalizedContent(sanitizeLocalizedInput(description), descriptionPrimaryLocale || 'en')!
                        : null
            }

            await versionRepo.save(version)

            return res.json(version)
        })
    )

    // DELETE VERSION
    router.delete(
        '/metahub/:metahubId/publication/:publicationId/versions/:versionId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, publicationId, versionId } = req.params
            const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
            if (!userId) return
            const { versionRepo, publicationRepo } = repos(req)

            const publication = await publicationRepo.findOneBy({ id: publicationId })
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
            }
            if (publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
            }

            const version = await versionRepo.findOneBy({ id: versionId, publicationId })
            if (!version) {
                return res.status(404).json({ error: 'Version not found' })
            }

            if (version.isActive) {
                return res.status(400).json({ error: 'Cannot delete an active version' })
            }

            await versionRepo.remove(version)

            return res.json({ success: true })
        })
    )

    return router
}
