import { Router, Request, Response, RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import { quoteIdentifier } from '@universo/migrations-core'
import { localizedContent, OptimisticLockError } from '@universo/utils'
const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent
import { getRequestDbExecutor, getRequestDbSession, type DbExecutor } from '../../../utils'
import { ensureMetahubAccess } from '../../shared/guards'
import {
    findMetahubById,
    findBranchByIdAndMetahub,
    findPublicationById,
    findPublicationVersionById,
    findTemplateVersionById,
    listPublicationsByMetahub,
    listPublicationVersions,
    createPublication,
    updatePublication,
    createPublicationVersion,
    deactivatePublicationVersions,
    activatePublicationVersion,
    notifyLinkedAppsUpdateAvailable,
    resetLinkedAppsToSynced,
    softDelete,
    type SqlQueryable,
    type AppRow
} from '../../../persistence'
import { SnapshotSerializer, MetahubSnapshot } from '../services/SnapshotSerializer'
import { getDDLServices, generateSchemaName, isValidSchemaName, KnexClient, uuidToLockKey, acquireAdvisoryLock, releaseAdvisoryLock } from '../../ddl'
import type { SchemaSnapshot, SchemaDiff } from '../../ddl'
import { ApplicationSchemaStatus } from '@universo/types'
import { createLinkedApplication } from '../helpers/createLinkedApplication'
import { TARGET_APP_STRUCTURE_VERSION } from '../../applications/constants'
import { runPublishedApplicationRuntimeSync } from '../../applications/routes/applicationSyncRoutes'
import { persistApplicationSchemaSyncState } from '../../applications/services/ApplicationSchemaStateStore'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'
import { MetahubElementsService } from '../../metahubs/services/MetahubElementsService'
import { MetahubHubsService } from '../../metahubs/services/MetahubHubsService'
import { MetahubEnumerationValuesService } from '../../metahubs/services/MetahubEnumerationValuesService'
import { MetahubConstantsService } from '../../metahubs/services/MetahubConstantsService'
import { structureVersionToSemver } from '../../metahubs/services/structureVersions'
import { enrichDefinitionsWithSetConstants } from '../../shared/setConstantRefs'

// Helper: Resolve user ID from request
const resolveUserId = (req: Request): string | undefined => {
    const user = (req as unknown as { user?: { id?: string; sub?: string; user_id?: string; userId?: string } }).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

const resolveTemplateVersionLabel = async (exec: SqlQueryable, templateVersionId?: string | null): Promise<string | null> => {
    if (!templateVersionId) return null
    const templateVersion = await findTemplateVersionById(exec, templateVersionId)
    return templateVersion?.versionLabel ?? null
}

const activeApplicationRowPredicate = (alias?: string): string => {
    const prefix = alias ? `${alias}.` : ''
    return `COALESCE(${prefix}_upl_deleted, false) = false AND COALESCE(${prefix}_app_deleted, false) = false`
}

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error))

const assertManagedApplicationSchemaName = (schemaName: string): void => {
    if (!schemaName.startsWith('app_') || !isValidSchemaName(schemaName)) {
        throw new Error(`Invalid application schema name: ${schemaName}`)
    }
}

const markCreatedApplicationDeleted = async (
    executor: SqlQueryable,
    input: { applicationId: string; schemaName: string; userId?: string }
): Promise<void> => {
    assertManagedApplicationSchemaName(input.schemaName)
    await executor.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(input.schemaName)} CASCADE`)

    await executor.query(
        `
        UPDATE applications.connectors
        SET _upl_deleted = true,
            _upl_deleted_at = NOW(),
            _upl_deleted_by = $2,
            _upl_updated_at = NOW(),
            _upl_version = COALESCE(_upl_version, 1) + 1
        WHERE application_id = $1
          AND ${activeApplicationRowPredicate()}
        `,
        [input.applicationId, input.userId ?? null]
    )

    await executor.query(
        `
        UPDATE applications.connectors_publications cp
        SET _upl_deleted = true,
            _upl_deleted_at = NOW(),
            _upl_deleted_by = $2,
            _upl_updated_at = NOW(),
            _upl_version = COALESCE(_upl_version, 1) + 1
        FROM applications.connectors c
        WHERE cp.connector_id = c.id
          AND c.application_id = $1
          AND ${activeApplicationRowPredicate('cp')}
        `,
        [input.applicationId, input.userId ?? null]
    )

    await executor.query(
        `
        UPDATE applications.applications_users
        SET _upl_deleted = true,
            _upl_deleted_at = NOW(),
            _upl_deleted_by = $2,
            _upl_updated_at = NOW(),
            _upl_version = COALESCE(_upl_version, 1) + 1
        WHERE application_id = $1
          AND ${activeApplicationRowPredicate()}
        `,
        [input.applicationId, input.userId ?? null]
    )

    await executor.query(
        `
        UPDATE applications.applications
        SET _upl_deleted = true,
            _upl_deleted_at = NOW(),
            _upl_deleted_by = $2,
            _upl_updated_at = NOW(),
            _upl_version = COALESCE(_upl_version, 1) + 1
        WHERE id = $1
          AND ${activeApplicationRowPredicate()}
        `,
        [input.applicationId, input.userId ?? null]
    )
}

const compensateCreatedApplication = async (
    executor: DbExecutor,
    input: { applicationId: string; schemaName: string; userId?: string }
): Promise<void> => {
    await executor.transaction(async (tx) => {
        await markCreatedApplicationDeleted(tx, input)
    })
}

const compensateCreatedPublication = async (
    executor: DbExecutor,
    input: {
        publicationId: string
        publicationVersionId: string
        linkedApplication?: { applicationId: string; schemaName: string } | null
        userId?: string
    }
): Promise<void> => {
    await executor.transaction(async (tx) => {
        if (input.linkedApplication) {
            await markCreatedApplicationDeleted(tx, {
                applicationId: input.linkedApplication.applicationId,
                schemaName: input.linkedApplication.schemaName,
                userId: input.userId
            })
        }

        await softDelete(tx, 'metahubs', 'publications_versions', input.publicationVersionId, input.userId)
        await softDelete(tx, 'metahubs', 'publications', input.publicationId, input.userId)
    })
}

const assertSchemaGenerationSucceeded = (result: { success: boolean; errors: string[] }, context: string): void => {
    if (result.success) return
    const errorMessage = result.errors.length > 0 ? result.errors.join('; ') : 'Unknown DDL generation failure'
    throw new Error(`${context}: ${errorMessage}`)
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

const createVersionSchema = z.object({
    name: localizedInputSchema,
    description: localizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    branchId: z.string().uuid().optional()
})

const updateVersionSchema = z.object({
    name: localizedInputSchema.optional(),
    description: localizedInputSchema.optional().nullable(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional()
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
async function notifyLinkedApplicationsUpdateAvailable(
    exec: SqlQueryable,
    publicationId: string,
    newActiveVersionId: string
): Promise<void> {
    try {
        await notifyLinkedAppsUpdateAvailable(exec, publicationId, newActiveVersionId)
    } catch (err) {
        // Non-critical: log and continue — the migration guard will still detect the delta
        console.warn('[Publications] Failed to notify linked applications of update:', err)
    }
}

export function createPublicationsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
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

        const exec = getRequestDbExecutor(req, getDbExecutor())
        await ensureMetahubAccess(exec, userId, metahubId, permission, getRequestDbSession(req))
        return userId
    }

    // Helper to get services
    const services = (req: Request) => {
        const exec = getRequestDbExecutor(req, getDbExecutor())

        const schemaService = new MetahubSchemaService(exec)
        const objectsService = new MetahubObjectsService(schemaService)
        const attributesService = new MetahubAttributesService(schemaService)
        const elementsService = new MetahubElementsService(schemaService, objectsService, attributesService)

        return {
            exec,
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
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' })
            }

            const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 100)
            const offset = Math.max(parseInt(req.query.offset as string) || 0, 0)

            const exec = getRequestDbExecutor(req, getDbExecutor())
            const publications = await exec.query<{
                id: string
                codename: string
                schemaName: string
                name: unknown
                description: unknown
                version: number
                createdAt: Date
                metahubId: string
                metahubCodename: string
                metahubName: unknown
            }>(
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

            const countResult = await exec.query<{ total: string }>(
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
            const { exec } = services(req)

            const metahub = await findMetahubById(exec, metahubId)
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publications = await listPublicationsByMetahub(exec, metahubId)

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
            const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
            if (!userId) return
            const exec = getRequestDbExecutor(req, getDbExecutor())

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

            const metahub = await findMetahubById(exec, metahubId)
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const existingCountRows = await exec.query<{ count: number }>(
                'SELECT COUNT(*)::int AS count FROM metahubs.publications WHERE metahub_id = $1',
                [metahubId]
            )
            if ((existingCountRows[0]?.count ?? 0) > 0) {
                return res.status(400).json({
                    error: 'Single publication limit reached',
                    message:
                        'Currently, only one Publication per Metahub is supported. This restriction will be removed in future versions.'
                })
            }

            const effectiveBranchId = versionBranchId ?? metahub.defaultBranchId ?? null
            if (!effectiveBranchId) {
                return res.status(400).json({ error: 'Default branch is not configured' })
            }
            const branch = await findBranchByIdAndMetahub(exec, effectiveBranchId, metahubId)
            if (!branch) {
                return res.status(400).json({ error: 'Branch not found' })
            }

            const schemaService = new MetahubSchemaService(exec, effectiveBranchId)
            const objectsService = new MetahubObjectsService(schemaService)
            const attributesService = new MetahubAttributesService(schemaService)
            const elementsService = new MetahubElementsService(schemaService, objectsService, attributesService)
            const hubsService = new MetahubHubsService(schemaService)
            const enumerationValuesService = new MetahubEnumerationValuesService(schemaService)
            const constantsService = new MetahubConstantsService(schemaService)
            const serializer = new SnapshotSerializer(
                objectsService,
                attributesService,
                elementsService,
                hubsService,
                enumerationValuesService,
                constantsService
            )
            const templateVersionLabel = await resolveTemplateVersionLabel(exec, metahub.templateVersionId)
            const snapshot = await serializer.serializeMetahub(metahubId, {
                structureVersion: structureVersionToSemver(branch.structureVersion),
                templateVersion: templateVersionLabel
            })

            await attachLayoutsToSnapshot({ schemaService, snapshot, metahubId, userId })
            const snapshotHash = serializer.calculateHash(snapshot)

            const result = await exec.transaction(async (tx) => {
                // 1. Create Publication
                const publication = await createPublication(tx, {
                    metahubId,
                    name: buildLocalizedContent(sanitizeLocalizedInput(name || {}), namePrimaryLocale || 'en')!,
                    description: description
                        ? buildLocalizedContent(sanitizeLocalizedInput(description), descriptionPrimaryLocale || 'en')
                        : undefined,
                    autoCreateApplication: autoCreateApplication ?? false,
                    userId
                })

                // 2. Generate schema name (use raw update to avoid version increment)
                const schemaName = generateSchemaName(publication.id)
                await tx.query('UPDATE metahubs.publications SET schema_name = $1 WHERE id = $2', [schemaName, publication.id])

                // 3. Auto-create Application via shared helper
                let applicationData: { application: AppRow; appSchemaName: string } | null = null
                if (autoCreateApplication && metahub) {
                    const appName =
                        applicationName && Object.keys(applicationName).length > 0
                            ? buildLocalizedContent(sanitizeLocalizedInput(applicationName), applicationNamePrimaryLocale || 'en') ?? null
                            : publication.name
                    const appDescription =
                        applicationDescription && Object.keys(applicationDescription).length > 0
                            ? buildLocalizedContent(
                                  sanitizeLocalizedInput(applicationDescription),
                                  applicationDescriptionPrimaryLocale || 'en'
                              ) ?? null
                            : publication.description
                    const linked = await createLinkedApplication({
                        exec: tx,
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
                const defaultVersionName = { en: 'Initial Version', ru: 'Начальная версия' }

                const firstVersion = await createPublicationVersion(tx, {
                    publicationId: publication.id,
                    versionNumber: 1,
                    name:
                        versionName && Object.keys(versionName).length > 0
                            ? buildLocalizedContent(sanitizeLocalizedInput(versionName), versionNamePrimaryLocale || 'en')!
                            : buildLocalizedContent(defaultVersionName, 'en')!,
                    description:
                        versionDescription && Object.keys(versionDescription).length > 0
                            ? buildLocalizedContent(sanitizeLocalizedInput(versionDescription), versionDescriptionPrimaryLocale || 'en')
                            : null,
                    isActive: true,
                    snapshotJson: snapshot as unknown as Record<string, unknown>,
                    snapshotHash,
                    branchId: effectiveBranchId,
                    userId
                })

                // Update activeVersionId using raw update to avoid version increment
                await tx.query('UPDATE metahubs.publications SET active_version_id = $1 WHERE id = $2', [firstVersion.id, publication.id])

                return {
                    publication: { ...publication, schemaName, activeVersionId: firstVersion.id },
                    firstVersion,
                    applicationData
                }
            })

            // DDL generation stays outside the metadata transaction, so failures must
            // compensate created rows before the request is allowed to fail.
            if (createApplicationSchema && result.applicationData) {
                try {
                    const { generator, migrationManager } = getDDLServices()
                    const rawCatalogDefs = serializer.deserializeSnapshot(snapshot)
                    const catalogDefs = enrichDefinitionsWithSetConstants(rawCatalogDefs, snapshot)

                    const genResult = await generator.generateFullSchema(result.applicationData.appSchemaName, catalogDefs, {
                        recordMigration: true,
                        migrationDescription: 'initial_schema_from_publication',
                        migrationManager,
                        migrationMeta: {
                            publicationSnapshotHash: snapshotHash,
                            publicationId: result.publication.id,
                            publicationVersionId: result.firstVersion.id
                        },
                        userId,
                        publicationSnapshot: snapshot as unknown as Record<string, unknown>,
                        afterMigrationRecorded: async ({ trx, snapshotAfter, migrationId }) => {
                            await runPublishedApplicationRuntimeSync({
                                trx,
                                schemaName: result.applicationData!.appSchemaName,
                                snapshot,
                                entities: catalogDefs,
                                migrationManager,
                                migrationId,
                                userId
                            })

                            await persistApplicationSchemaSyncState(trx, {
                                applicationId: result.applicationData!.application.id,
                                schemaStatus: ApplicationSchemaStatus.SYNCED,
                                schemaError: null,
                                schemaSyncedAt: new Date(),
                                schemaSnapshot: snapshotAfter as unknown as Record<string, unknown>,
                                lastSyncedPublicationVersionId: result.firstVersion.id,
                                appStructureVersion: TARGET_APP_STRUCTURE_VERSION,
                                userId
                            })
                        }
                    })

                    assertSchemaGenerationSucceeded(genResult, 'Failed to generate application schema from publication')

                    if (genResult.success) {
                        result.applicationData.application.schemaStatus = ApplicationSchemaStatus.SYNCED
                        result.applicationData.application.schemaSyncedAt = new Date()
                        result.applicationData.application.schemaSnapshot = generator.generateSnapshot(catalogDefs) as unknown as Record<
                            string,
                            unknown
                        >
                        result.applicationData.application.appStructureVersion = TARGET_APP_STRUCTURE_VERSION
                        result.applicationData.application.lastSyncedPublicationVersionId = result.firstVersion.id
                    }
                } catch (ddlError) {
                    console.error('DDL schema generation failed; compensating publication creation:', ddlError)

                    try {
                        await compensateCreatedPublication(getDbExecutor(), {
                            publicationId: result.publication.id,
                            publicationVersionId: result.firstVersion.id,
                            linkedApplication: {
                                applicationId: result.applicationData.application.id,
                                schemaName: result.applicationData.appSchemaName
                            },
                            userId
                        })
                    } catch (cleanupError) {
                        console.error('Publication compensation failed after DDL error:', cleanupError)
                        throw new Error(
                            `Failed to create publication schema and cleanup also failed: ${getErrorMessage(ddlError)} | cleanup: ${getErrorMessage(cleanupError)}`
                        )
                    }

                    throw new Error(`Failed to create publication schema: ${getErrorMessage(ddlError)}`)
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
            const { exec } = services(req)

            const metahub = await findMetahubById(exec, metahubId)
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publication = await findPublicationById(exec, publicationId)
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
            const { exec } = services(req)

            const parsed = updatePublicationSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }

            const metahub = await findMetahubById(exec, metahubId)
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publication = await findPublicationById(exec, publicationId)
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

            const updateInput: Parameters<typeof updatePublication>[2] = { userId, expectedVersion }

            if (name) {
                const nameVlc = buildLocalizedContent(sanitizeLocalizedInput(name), namePrimaryLocale || 'en')
                if (nameVlc) updateInput.name = nameVlc
            }
            if (description) {
                const descVlc = buildLocalizedContent(sanitizeLocalizedInput(description), descriptionPrimaryLocale || 'en')
                updateInput.description = descVlc ?? null
            }

            const updated = await updatePublication(exec, publicationId, updateInput)
            if (!updated) {
                throw new OptimisticLockError({
                    entityId: publicationId,
                    entityType: 'publication',
                    expectedVersion: expectedVersion ?? (publication._uplVersion || 1),
                    actualVersion: null as unknown as number,
                    updatedAt: publication._uplUpdatedAt,
                    updatedBy: publication._uplUpdatedBy ?? null
                })
            }

            return res.json({
                id: updated.id,
                metahubId,
                name: updated.name,
                description: updated.description,
                schemaName: updated.schemaName,
                schemaStatus: updated.schemaStatus,
                schemaError: updated.schemaError,
                schemaSyncedAt: updated.schemaSyncedAt,
                accessMode: updated.accessMode,
                accessConfig: updated.accessConfig,
                autoCreateApplication: updated.autoCreateApplication,
                activeVersionId: updated.activeVersionId,
                schemaSnapshot: updated.schemaSnapshot,
                version: updated._uplVersion || 1,
                createdAt: updated._uplCreatedAt,
                updatedAt: updated._uplUpdatedAt
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
            const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
            if (!userId) return
            const exec = getRequestDbExecutor(req, getDbExecutor())

            if (!confirm) {
                return res.status(400).json({ error: 'Deletion requires confirmation' })
            }

            const metahub = await findMetahubById(exec, metahubId)
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publication = await findPublicationById(exec, publicationId)
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
                await exec.transaction(async (tx) => {
                    // Lock metahub row
                    const metahubLocked = await tx.query<{ id: string }>('SELECT id FROM metahubs.metahubs WHERE id = $1 FOR UPDATE', [
                        metahubId
                    ])
                    if (metahubLocked.length === 0) {
                        throw new Error('Metahub not found')
                    }

                    // Lock publication row
                    const publicationLocked = await tx.query<{ id: string; schemaName: string | null }>(
                        'SELECT id, schema_name AS "schemaName" FROM metahubs.publications WHERE id = $1 AND metahub_id = $2 FOR UPDATE',
                        [publicationId, metahubId]
                    )
                    if (publicationLocked.length === 0) {
                        throw new Error('Publication not found')
                    }

                    deletedSchemaName = publicationLocked[0].schemaName
                    if (deletedSchemaName) {
                        const { generator } = getDDLServices()
                        await generator.dropSchema(deletedSchemaName)
                    }

                    // Reset UPDATE_AVAILABLE → SYNCED on linked applications before delete
                    await resetLinkedAppsToSynced(tx, publicationId)

                    await softDelete(tx, 'metahubs', 'publications', publicationId, userId)
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
            const userId = await ensureMetahubRouteAccess(req, res, metahubId)
            if (!userId) return
            const exec = getRequestDbExecutor(req, getDbExecutor())

            if (!(await findMetahubById(exec, metahubId))) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publication = await findPublicationById(exec, publicationId)
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
            }

            if (publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
            }

            const linkedApps = await exec.query<{
                id: string
                name: unknown
                description: unknown
                slug: string
                createdAt: Date
            }>(
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
            const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
            if (!userId) return
            const exec = getRequestDbExecutor(req, getDbExecutor())

            const parsed = createApplicationForPublicationSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }

            const metahub = await findMetahubById(exec, metahubId)
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publication = await findPublicationById(exec, publicationId)
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

            let activeVersion: Awaited<ReturnType<typeof findPublicationVersionById>> | null = null
            if (createApplicationSchema) {
                if (!publication.activeVersionId) {
                    return res.status(409).json({ error: 'Publication has no active version to build an application schema from' })
                }

                activeVersion = await findPublicationVersionById(exec, publication.activeVersionId)
                if (!activeVersion?.snapshotJson) {
                    return res.status(409).json({ error: 'Publication active version has no snapshot to build an application schema from' })
                }

                const branchId = activeVersion.branchId ?? metahub.defaultBranchId ?? null
                if (!branchId) {
                    return res.status(400).json({ error: 'Default branch is not configured for application schema generation' })
                }
            }

            // Create application inside transaction
            const result = await exec.transaction(async (tx) => {
                const linked = await createLinkedApplication({
                    exec: tx,
                    publicationId: publication.id,
                    publicationName: appName ?? null,
                    publicationDescription: appDescription ?? null,
                    metahubName: metahub.name,
                    metahubDescription: metahub.description ?? null,
                    userId
                })
                return linked
            })

            // DDL generation remains separate from metadata creation, so failures must
            // compensate the just-created application before surfacing to the caller.
            if (createApplicationSchema && activeVersion?.snapshotJson) {
                try {
                    const branchId = activeVersion.branchId ?? metahub.defaultBranchId!
                    const snapshotData = activeVersion.snapshotJson as unknown as MetahubSnapshot
                    const schemaService = new MetahubSchemaService(exec, branchId)
                    const objectsService = new MetahubObjectsService(schemaService)
                    const attributesService = new MetahubAttributesService(schemaService)
                    const snapshotSerializer = new SnapshotSerializer(objectsService, attributesService)
                    const rawCatalogDefs = snapshotSerializer.deserializeSnapshot(snapshotData)
                    const catalogDefs = enrichDefinitionsWithSetConstants(rawCatalogDefs, snapshotData)

                    const { generator, migrationManager } = getDDLServices()
                    const genResult = await generator.generateFullSchema(result.appSchemaName, catalogDefs, {
                        recordMigration: true,
                        migrationDescription: 'initial_schema_from_publication',
                        migrationManager,
                        migrationMeta: {
                            publicationSnapshotHash: activeVersion.snapshotHash,
                            publicationId: publication.id,
                            publicationVersionId: activeVersion.id
                        },
                        userId,
                        publicationSnapshot: snapshotData as unknown as Record<string, unknown>,
                        afterMigrationRecorded: async ({ trx, snapshotAfter, migrationId }) => {
                            await runPublishedApplicationRuntimeSync({
                                trx,
                                schemaName: result.appSchemaName,
                                snapshot: snapshotData,
                                entities: catalogDefs,
                                migrationManager,
                                migrationId,
                                userId
                            })

                            await persistApplicationSchemaSyncState(trx, {
                                applicationId: result.application.id,
                                schemaStatus: ApplicationSchemaStatus.SYNCED,
                                schemaError: null,
                                schemaSyncedAt: new Date(),
                                schemaSnapshot: snapshotAfter as unknown as Record<string, unknown>,
                                lastSyncedPublicationVersionId: activeVersion.id,
                                appStructureVersion: TARGET_APP_STRUCTURE_VERSION,
                                userId
                            })
                        }
                    })

                    assertSchemaGenerationSucceeded(genResult, 'Failed to generate application schema for linked publication application')

                    if (genResult.success) {
                        result.application.schemaStatus = ApplicationSchemaStatus.SYNCED
                        result.application.schemaSyncedAt = new Date()
                        result.application.schemaSnapshot = generator.generateSnapshot(catalogDefs) as unknown as Record<string, unknown>
                        result.application.appStructureVersion = TARGET_APP_STRUCTURE_VERSION
                        result.application.lastSyncedPublicationVersionId = activeVersion.id
                    }
                } catch (ddlError) {
                    console.error('DDL schema generation for new linked application failed; compensating:', ddlError)

                    try {
                        await compensateCreatedApplication(getDbExecutor(), {
                            applicationId: result.application.id,
                            schemaName: result.appSchemaName,
                            userId
                        })
                    } catch (cleanupError) {
                        console.error('Linked application compensation failed after DDL error:', cleanupError)
                        throw new Error(
                            `Failed to create application schema and cleanup also failed: ${getErrorMessage(ddlError)} | cleanup: ${getErrorMessage(cleanupError)}`
                        )
                    }

                    throw new Error(`Failed to create linked application schema: ${getErrorMessage(ddlError)}`)
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
            const { exec, objectsService, attributesService } = services(req)

            const metahub = await findMetahubById(exec, metahubId)
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publication = await findPublicationById(exec, publicationId)
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

            const activeVersion = await findPublicationVersionById(exec, publication.activeVersionId)
            if (!activeVersion) {
                return res.status(404).json({ error: 'Active version data not found' })
            }

            const snapshot = activeVersion.snapshotJson as unknown as MetahubSnapshot
            if (!snapshot || typeof snapshot !== 'object' || !snapshot.entities || typeof snapshot.entities !== 'object') {
                return res.status(400).json({ error: 'Invalid publication snapshot' })
            }

            const serializer = new SnapshotSerializer(objectsService, attributesService)
            const rawCatalogDefs = serializer.deserializeSnapshot(snapshot)
            const catalogDefs = enrichDefinitionsWithSetConstants(rawCatalogDefs, snapshot)

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
            const { exec, objectsService, attributesService } = services(req)

            const parsed = syncSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }

            const { confirmDestructive } = parsed.data

            const metahub = await findMetahubById(exec, metahubId)
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publication = await findPublicationById(exec, publicationId)
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

            const activeVersion = await findPublicationVersionById(exec, publication.activeVersionId)
            if (!activeVersion) {
                return res.status(404).json({ error: 'Active version data not found' })
            }

            const snapshot = activeVersion.snapshotJson as unknown as MetahubSnapshot
            if (!snapshot || typeof snapshot !== 'object' || !snapshot.entities || typeof snapshot.entities !== 'object') {
                return res.status(400).json({ error: 'Invalid publication snapshot' })
            }

            const serializer = new SnapshotSerializer(objectsService, attributesService)
            const rawCatalogDefs = serializer.deserializeSnapshot(snapshot)
            const catalogDefs = enrichDefinitionsWithSetConstants(rawCatalogDefs, snapshot)

            const { generator, migrator, migrationManager } = getDDLServices()

            const schemaExists = await generator.schemaExists(publication.schemaName || '')

            await updatePublication(exec, publicationId, { schemaStatus: 'pending' })

            try {
                if (!schemaExists) {
                    const result = await generator.generateFullSchema(publication.schemaName!, catalogDefs, {
                        recordMigration: true,
                        migrationDescription: 'initial_schema',
                        migrationManager
                    })

                    if (!result.success) {
                        await updatePublication(exec, publicationId, {
                            schemaStatus: 'error',
                            schemaError: result.errors.join('; ')
                        })

                        return res.status(500).json({ status: 'error', errors: result.errors })
                    }

                    const newSchemaSnapshot = generator.generateSnapshot(catalogDefs)

                    await updatePublication(exec, publicationId, {
                        schemaName: result.schemaName,
                        schemaStatus: 'synced',
                        schemaError: null,
                        schemaSyncedAt: new Date(),
                        schemaSnapshot: newSchemaSnapshot as unknown as Record<string, unknown>
                    })

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
                    const syncedSnapshot = generator.generateSnapshot(catalogDefs)
                    await updatePublication(exec, publicationId, {
                        schemaStatus: 'synced',
                        schemaSnapshot: syncedSnapshot as unknown as Record<string, unknown>
                    })
                    return res.json({ status: 'synced', message: 'Schema up to date' })
                }

                if (diff.destructive.length > 0 && !confirmDestructive) {
                    await updatePublication(exec, publicationId, { schemaStatus: 'outdated' })
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
                    await updatePublication(exec, publicationId, {
                        schemaStatus: 'error',
                        schemaError: migrationResult.errors.join('; ')
                    })
                    return res.status(500).json({ status: 'error', errors: migrationResult.errors })
                }

                const migratedSnapshot = generator.generateSnapshot(catalogDefs)
                await updatePublication(exec, publicationId, {
                    schemaStatus: 'synced',
                    schemaError: null,
                    schemaSyncedAt: new Date(),
                    schemaSnapshot: migratedSnapshot as unknown as Record<string, unknown>
                })

                return res.json({
                    status: 'migrated',
                    changesApplied: migrationResult.changesApplied
                })
            } catch (error) {
                const schemaError = error instanceof Error ? error.message : 'Unknown error'
                await updatePublication(exec, publicationId, {
                    schemaStatus: 'error',
                    schemaError
                })
                return res.status(500).json({ status: 'error', message: schemaError })
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
            const { exec } = services(req)

            const publication = await findPublicationById(exec, publicationId)
            if (!publication || publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
            }

            const versions = await listPublicationVersions(exec, publicationId)

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
            const { exec } = services(req)
            const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
            if (!userId) return

            const publication = await findPublicationById(exec, publicationId)
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
            }
            if (publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
            }

            const parsed = createVersionSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }
            const { name, description, namePrimaryLocale, descriptionPrimaryLocale, branchId } = parsed.data

            const metahub = await findMetahubById(exec, metahubId)
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const requestedBranchId = typeof branchId === 'string' ? branchId : null
            const effectiveBranchId = requestedBranchId ?? metahub.defaultBranchId ?? null
            if (!effectiveBranchId) {
                return res.status(400).json({ error: 'Default branch is not configured' })
            }
            const branch = await findBranchByIdAndMetahub(exec, effectiveBranchId, metahubId)
            if (!branch) {
                return res.status(400).json({ error: 'Branch not found' })
            }

            const schemaService = new MetahubSchemaService(exec, effectiveBranchId)
            const objectsService = new MetahubObjectsService(schemaService)
            const attributesService = new MetahubAttributesService(schemaService)
            const elementsService = new MetahubElementsService(schemaService, objectsService, attributesService)
            const hubsService = new MetahubHubsService(schemaService)
            const enumerationValuesService = new MetahubEnumerationValuesService(schemaService)
            const constantsService = new MetahubConstantsService(schemaService)
            const serializer = new SnapshotSerializer(
                objectsService,
                attributesService,
                elementsService,
                hubsService,
                enumerationValuesService,
                constantsService
            )
            const templateVersionLabel = await resolveTemplateVersionLabel(exec, metahub.templateVersionId)
            const snapshot = await serializer.serializeMetahub(metahubId ?? publication.metahubId, {
                structureVersion: structureVersionToSemver(branch.structureVersion),
                templateVersion: templateVersionLabel
            })

            await attachLayoutsToSnapshot({ schemaService, snapshot, metahubId: metahubId ?? publication.metahubId, userId })
            const snapshotHash = serializer.calculateHash(snapshot)

            // Get all versions to determine next number and detect duplicates
            const existingVersions = await listPublicationVersions(exec, publicationId)
            const lastVersion = existingVersions[0] ?? null
            const nextVersionNumber = (lastVersion?.versionNumber || 0) + 1
            const isDuplicate = lastVersion?.snapshotHash === snapshotHash

            const result = await exec.transaction(async (tx) => {
                // Deactivate all other versions
                await deactivatePublicationVersions(tx, publicationId)

                // Create new active version
                const version = await createPublicationVersion(tx, {
                    publicationId,
                    versionNumber: nextVersionNumber,
                    name: buildLocalizedContent(sanitizeLocalizedInput(name), namePrimaryLocale || 'en')!,
                    description:
                        description && Object.keys(description).length > 0
                            ? buildLocalizedContent(sanitizeLocalizedInput(description), descriptionPrimaryLocale || 'en')
                            : null,
                    snapshotJson: snapshot as unknown as Record<string, unknown>,
                    snapshotHash,
                    branchId: effectiveBranchId,
                    isActive: true,
                    userId
                })

                // Update publication's activeVersionId
                await tx.query('UPDATE metahubs.publications SET active_version_id = $1 WHERE id = $2', [version.id, publicationId])

                return version
            })

            // Notify linked applications about new active version (fire-and-forget)
            await notifyLinkedApplicationsUpdateAvailable(exec, publicationId, result.id)

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
            const { exec } = services(req)

            const publication = await findPublicationById(exec, publicationId)
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
            }
            if (publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
            }

            const version = await findPublicationVersionById(exec, versionId)
            if (!version || version.publicationId !== publicationId) {
                return res.status(404).json({ error: 'Version not found' })
            }

            // Wrap in transaction to ensure atomicity of deactivate + activate + update activeVersionId
            await exec.transaction(async (tx) => {
                // Deactivate all other versions
                await deactivatePublicationVersions(tx, publicationId)

                // Activate this version
                await activatePublicationVersion(tx, versionId)
                await tx.query('UPDATE metahubs.publications SET active_version_id = $1 WHERE id = $2', [version.id, publicationId])
            })

            // Notify linked applications about new active version
            await notifyLinkedApplicationsUpdateAvailable(exec, publicationId, version.id)

            // Re-read for fresh response
            const activatedVersion = await findPublicationVersionById(exec, versionId)

            return res.json({ success: true, version: activatedVersion })
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
            const { exec } = services(req)

            const publication = await findPublicationById(exec, publicationId)
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
            }
            if (publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
            }

            const version = await findPublicationVersionById(exec, versionId)
            if (!version || version.publicationId !== publicationId) {
                return res.status(404).json({ error: 'Version not found' })
            }

            const parsed = updateVersionSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }
            const { name, description, namePrimaryLocale, descriptionPrimaryLocale } = parsed.data

            const setClauses: string[] = []
            const params: unknown[] = []
            let idx = 1

            if (name) {
                const nameVlc = buildLocalizedContent(sanitizeLocalizedInput(name), namePrimaryLocale || 'en')
                if (nameVlc) {
                    setClauses.push(`name = $${idx}`)
                    params.push(JSON.stringify(nameVlc))
                    idx++
                }
            }

            if (description !== undefined) {
                const descVlc =
                    description && typeof description === 'object' && Object.keys(description).length > 0
                        ? buildLocalizedContent(sanitizeLocalizedInput(description), descriptionPrimaryLocale || 'en')
                        : null
                setClauses.push(`description = $${idx}`)
                params.push(descVlc ? JSON.stringify(descVlc) : null)
                idx++
            }

            if (setClauses.length > 0) {
                setClauses.push('_upl_updated_at = NOW()')
                setClauses.push(`_upl_updated_by = $${idx}`)
                params.push(userId)
                idx++
                setClauses.push('_upl_version = COALESCE(_upl_version, 1) + 1')

                params.push(versionId)
                await exec.query(`UPDATE metahubs.publications_versions SET ${setClauses.join(', ')} WHERE id = $${idx}`, params)
            }

            const updatedVersion = await findPublicationVersionById(exec, versionId)
            return res.json(updatedVersion)
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
            const { exec } = services(req)

            const publication = await findPublicationById(exec, publicationId)
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
            }
            if (publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
            }

            const version = await findPublicationVersionById(exec, versionId)
            if (!version || version.publicationId !== publicationId) {
                return res.status(404).json({ error: 'Version not found' })
            }

            if (version.isActive) {
                return res.status(400).json({ error: 'Cannot delete an active version' })
            }

            await softDelete(exec, 'metahubs', 'publications_versions', versionId, userId)

            return res.json({ success: true })
        })
    )

    return router
}
