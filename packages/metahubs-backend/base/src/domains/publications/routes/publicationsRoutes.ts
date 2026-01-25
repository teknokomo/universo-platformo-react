import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import { localizedContent } from '@universo/utils'
const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent
import { getRequestManager } from '../../../utils'
import { Metahub } from '../../../database/entities/Metahub'
import { MetahubBranch } from '../../../database/entities/MetahubBranch'
import { Publication, PublicationSchemaStatus } from '../../../database/entities/Publication'
import { PublicationVersion } from '../../../database/entities/PublicationVersion'
import { SnapshotSerializer, MetahubSnapshot } from '../services/SnapshotSerializer'
import { getDDLServices, generateSchemaName } from '../../ddl'
import type { SchemaSnapshot, SchemaDiff } from '../../ddl'
// Import applications entities for auto-create feature
import { Application, ApplicationUser, Connector, ConnectorPublication } from '@universo/applications-backend'
// Import services
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'
import { MetahubElementsService } from '../../metahubs/services/MetahubElementsService'
import { MetahubHubsService } from '../../metahubs/services/MetahubHubsService'

// Helper: Resolve user ID from request
const resolveUserId = (req: Request): string | undefined => {
    const user = (req as unknown as { user?: { id?: string; sub?: string; user_id?: string; userId?: string } }).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

// Validation Schemas
const localizedInputSchema = z
    .union([z.string(), z.record(z.string())])
    .transform((val) => (typeof val === 'string' ? { en: val } : val))

const createPublicationSchema = z.object({
    name: localizedInputSchema.optional(),
    description: localizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    autoCreateApplication: z.boolean().optional().default(false),
    // First version data
    versionName: localizedInputSchema.optional(),
    versionDescription: localizedInputSchema.optional(),
    versionNamePrimaryLocale: z.string().optional(),
    versionDescriptionPrimaryLocale: z.string().optional(),
    versionBranchId: z.string().uuid().optional()
})

const updatePublicationSchema = z.object({
    name: localizedInputSchema.optional(),
    description: localizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional()
})

const syncSchema = z.object({
    confirmDestructive: z.boolean().optional().default(false)
})

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

    // Helper to get repositories and services
    const repos = (req: Request) => {
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)

        const schemaService = new MetahubSchemaService(ds)
        const objectsService = new MetahubObjectsService(schemaService)
        const attributesService = new MetahubAttributesService(schemaService)
        const elementsService = new MetahubElementsService(schemaService, objectsService, attributesService)

        return {
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
            const publications = await manager.query(`
                SELECT 
                    p.id,
                    p.schema_name as "codename",
                    p.schema_name as "schemaName",
                    p.name,
                    p.description,
                    p.created_at as "createdAt",
                    m.id as "metahubId",
                    COALESCE(m.codename, m.slug, m.id::text) as "metahubCodename",
                    m.name as "metahubName"
                FROM metahubs.publications p
                JOIN metahubs.metahubs m ON m.id = p.metahub_id
                JOIN metahubs.metahubs_users mu ON mu.metahub_id = m.id
                WHERE mu.user_id = $1
                ORDER BY p.created_at DESC
                LIMIT $2 OFFSET $3
            `, [userId, limit, offset])

            const items = publications.map((pub: any) => ({
                id: pub.id,
                codename: pub.codename,
                schemaName: pub.schemaName,
                name: pub.name,
                description: pub.description,
                createdAt: pub.createdAt,
                metahub: {
                    id: pub.metahubId,
                    codename: pub.metahubCodename,
                    name: pub.metahubName
                }
            }))

            const countResult = await manager.query(`
                SELECT COUNT(*) as total
                FROM metahubs.publications p
                JOIN metahubs.metahubs m ON m.id = p.metahub_id
                JOIN metahubs.metahubs_users mu ON mu.metahub_id = m.id
                WHERE mu.user_id = $1
            `, [userId])

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
            const { publicationRepo, metahubRepo } = repos(req)

            const metahub = await metahubRepo.findOneBy({ id: metahubId })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publications = await publicationRepo.find({
                where: { metahubId },
                order: { createdAt: 'DESC' }
            })

            const enrichedPublications = publications.map((publication) => ({
                ...publication,
                metahubId
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

            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' })
            }

            const parsed = createPublicationSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: parsed.error.flatten()
                })
            }

            const {
                name, description, namePrimaryLocale, descriptionPrimaryLocale, autoCreateApplication,
                versionName, versionDescription, versionNamePrimaryLocale, versionDescriptionPrimaryLocale,
                versionBranchId
            } = parsed.data

            const metahubRepo = ds.getRepository(Metahub)
            const metahub = await metahubRepo.findOneBy({ id: metahubId })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publicationRepo = ds.getRepository(Publication)
            const existingPublicationsCount = await publicationRepo.count({ where: { metahubId } })
            if (existingPublicationsCount > 0) {
                return res.status(400).json({
                    error: 'Single publication limit reached',
                    message: 'Currently, only one Publication per Metahub is supported. This restriction will be removed in future versions.'
                })
            }

            const branchRepo = ds.getRepository(MetahubBranch)
            const effectiveBranchId = versionBranchId ?? metahub.defaultBranchId ?? null
            if (!effectiveBranchId) {
                return res.status(400).json({ error: 'Default branch is not configured' })
            }
            const branch = await branchRepo.findOne({ where: { id: effectiveBranchId, metahub_id: metahubId } })
            if (!branch) {
                return res.status(400).json({ error: 'Branch not found' })
            }

            const schemaService = new MetahubSchemaService(ds, effectiveBranchId)
            const objectsService = new MetahubObjectsService(schemaService)
            const attributesService = new MetahubAttributesService(schemaService)
            const elementsService = new MetahubElementsService(schemaService, objectsService, attributesService)
            const hubsService = new MetahubHubsService(schemaService)
            const serializer = new SnapshotSerializer(objectsService, attributesService, elementsService, hubsService)
            const snapshot = await serializer.serializeMetahub(metahubId)
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
                    autoCreateApplication: autoCreateApplication ?? false
                })
                await publicationRepoTx.save(publication)

                // 2. Generate schema name
                const schemaName = generateSchemaName(publication.id)
                publication.schemaName = schemaName
                await publicationRepoTx.save(publication)

                // 3. Auto-create Application
                if (autoCreateApplication && metahub) {
                    const applicationRepo = manager.getRepository(Application)
                    const appUserRepo = manager.getRepository(ApplicationUser)
                    const connectorRepo = manager.getRepository(Connector)
                    const connectorPublicationRepo = manager.getRepository(ConnectorPublication)

                    const application = applicationRepo.create({
                        name: publication.name!,
                        description: publication.description ?? undefined,
                        slug: `pub-${publication.id.slice(0, 8)}`
                    })
                    await applicationRepo.save(application)

                    application.schemaName = generateSchemaName(application.id)
                    await applicationRepo.save(application)

                    const appUser = appUserRepo.create({
                        application_id: application.id,
                        user_id: userId,
                        role: 'owner'
                    })
                    await appUserRepo.save(appUser)

                    const connector = connectorRepo.create({
                        applicationId: application.id,
                        name: metahub.name,
                        description: metahub.description ?? undefined,
                        sortOrder: 0
                    })
                    await connectorRepo.save(connector)

                    const connectorPublication = connectorPublicationRepo.create({
                        connectorId: connector.id,
                        publicationId: publication.id,
                        sortOrder: 0
                    })
                    await connectorPublicationRepo.save(connectorPublication)
                }

                // 4. Auto-create first version (v1)
                const versionRepoTx = manager.getRepository(PublicationVersion)
                const firstVersion = new PublicationVersion()
                firstVersion.publicationId = publication.id
                firstVersion.versionNumber = 1

                // Use provided version data or defaults
                const defaultVersionName = { en: 'Initial Version', ru: 'Начальная версия' }

                firstVersion.name = versionName && Object.keys(versionName).length > 0
                    ? buildLocalizedContent(sanitizeLocalizedInput(versionName), versionNamePrimaryLocale || 'en')!
                    : buildLocalizedContent(defaultVersionName, 'en')!

                // Description is optional - only set if provided
                firstVersion.description = versionDescription && Object.keys(versionDescription).length > 0
                    ? buildLocalizedContent(sanitizeLocalizedInput(versionDescription), versionDescriptionPrimaryLocale || 'en')!
                    : null

                firstVersion.isActive = true
                firstVersion.snapshotJson = snapshot as unknown as Record<string, unknown>
                firstVersion.snapshotHash = snapshotHash
                firstVersion.branchId = effectiveBranchId
                firstVersion.createdBy = userId
                await versionRepoTx.save(firstVersion)

                publication.activeVersionId = firstVersion.id
                await publicationRepoTx.save(publication)

                return publication
            })

            return res.status(201).json({
                ...result,
                metahubId
            })
        })
    )

    // GET SINGLE
    router.get(
        '/metahub/:metahubId/publication/:publicationId',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, publicationId } = req.params
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
                ...publication,
                metahubId
            })
        })
    )

    // UPDATE
    router.patch(
        '/metahub/:metahubId/publication/:publicationId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, publicationId } = req.params
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

            const { name, description, namePrimaryLocale, descriptionPrimaryLocale } = parsed.data

            if (name) {
                const nameVlc = buildLocalizedContent(sanitizeLocalizedInput(name), namePrimaryLocale || 'en')
                if (nameVlc) publication.name = nameVlc
            }
            if (description) {
                const descVlc = buildLocalizedContent(sanitizeLocalizedInput(description), descriptionPrimaryLocale || 'en')
                publication.description = descVlc ?? null
            }

            await publicationRepo.save(publication)

            return res.json({
                ...publication,
                metahubId
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

            if (!confirm) {
                return res.status(400).json({ error: 'Deletion requires confirmation' })
            }

            const metahubRepo = ds.getRepository(Metahub)
            const metahub = await metahubRepo.findOneBy({ id: metahubId })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publicationRepo = ds.getRepository(Publication)
            const publication = await publicationRepo.findOneBy({ id: publicationId })
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
            }

            if (publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
            }

            if (publication.schemaName) {
                try {
                    const { generator } = getDDLServices()
                    await generator.dropSchema(publication.schemaName)
                } catch (err) {
                    console.warn(`[Publications] Failed to drop schema ${publication.schemaName}:`, err)
                }
            }

            await publicationRepo.remove(publication)

            return res.json({
                success: true,
                message: `Publication and schema "${publication.schemaName}" deleted`
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

            const metahubRepo = ds.getRepository(Metahub)
            if (!(await metahubRepo.findOneBy({ id: metahubId }))) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publicationRepo = ds.getRepository(Publication)
            const publication = await publicationRepo.findOneBy({ id: publicationId })
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
            }

            if (publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
            }

            const linkedApps = await ds.query(
                `
                SELECT DISTINCT a.id, a.name, a.description, a.slug, a.created_at as "createdAt"
                FROM applications.applications a
                JOIN applications.connectors c ON c.application_id = a.id
                JOIN applications.connectors_publications cp ON cp.connector_id = c.id
                WHERE cp.publication_id = $1
                ORDER BY a.created_at DESC
            `,
                [publicationId]
            )

            return res.json({ items: linkedApps, total: linkedApps.length })
        })
    )

    // GET DIFF
    router.get(
        '/metahub/:metahubId/publication/:publicationId/diff',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, publicationId } = req.params
            const { publicationRepo, metahubRepo, objectsService, attributesService } = repos(req)

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

            const versionRepo = getDataSource().getRepository(PublicationVersion)
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
            const { publicationRepo, metahubRepo, objectsService, attributesService } = repos(req)
            const ds = getDataSource()

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

            const versionRepo = ds.getRepository(PublicationVersion)
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
                    await generator.syncSystemMetadata(publication.schemaName!, catalogDefs)
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

                const migrationResult = await migrator.applyAllChanges(
                    publication.schemaName!,
                    diff,
                    catalogDefs,
                    confirmDestructive,
                    { recordMigration: true, migrationDescription: 'schema_sync' }
                )

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
            const { publicationId } = req.params
            console.log('[Versions] GET /metahub/:metahubId/publication/:publicationId/versions', { publicationId })
            const { versionRepo } = repos(req)

            const versions = await versionRepo.find({
                where: { publicationId },
                order: { versionNumber: 'DESC' },
                select: ['id', 'versionNumber', 'name', 'description', 'isActive', 'createdAt', 'createdBy', 'branchId']
            })

            console.log('[Versions] Found versions:', versions.length, versions)
            return res.json({ items: versions })
        })
    )

    // CREATE VERSION
    router.post(
        '/metahub/:metahubId/publication/:publicationId/versions',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, publicationId } = req.params
            const { versionRepo, publicationRepo, metahubRepo } = repos(req)
            const userId = resolveUserId(req)

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' })
            }

            const publication = await publicationRepo.findOneBy({ id: publicationId })
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
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
            const branch = await branchRepo.findOne({ where: { id: effectiveBranchId, metahub_id: metahubId } })
            if (!branch) {
                return res.status(400).json({ error: 'Branch not found' })
            }

            const schemaService = new MetahubSchemaService(getDataSource(), effectiveBranchId)
            const objectsService = new MetahubObjectsService(schemaService)
            const attributesService = new MetahubAttributesService(schemaService)
            const elementsService = new MetahubElementsService(schemaService, objectsService, attributesService)
            const hubsService = new MetahubHubsService(schemaService)
            const serializer = new SnapshotSerializer(objectsService, attributesService, elementsService, hubsService)
            const snapshot = await serializer.serializeMetahub(metahubId ?? publication.metahubId)
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
                version.description = description && Object.keys(description).length > 0
                    ? buildLocalizedContent(sanitizeLocalizedInput(description), descriptionPrimaryLocale || 'en')!
                    : null
                version.snapshotJson = snapshot as unknown as Record<string, unknown>
                version.snapshotHash = snapshotHash
                version.branchId = effectiveBranchId
                version.createdBy = userId

                // Deactivate all other versions and make this one active
                await versionRepoTx.update({ publicationId }, { isActive: false })
                version.isActive = true

                const savedVersion = await versionRepoTx.save(version)
                await publicationRepoTx.update({ id: publicationId }, { activeVersionId: savedVersion.id })

                return savedVersion
            })

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
            const { publicationId, versionId } = req.params
            const { versionRepo, publicationRepo } = repos(req)

            const publication = await publicationRepo.findOneBy({ id: publicationId })
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
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

            return res.json({ success: true, version })
        })
    )

    // UPDATE VERSION
    router.patch(
        '/metahub/:metahubId/publication/:publicationId/versions/:versionId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { publicationId, versionId } = req.params
            const { versionRepo, publicationRepo } = repos(req)

            const publication = await publicationRepo.findOneBy({ id: publicationId })
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
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
                version.description = description && Object.keys(description).length > 0
                    ? buildLocalizedContent(sanitizeLocalizedInput(description), descriptionPrimaryLocale || 'en')!
                    : null
            }

            await versionRepo.save(version)

            return res.json(version)
        })
    )

    return router
}
