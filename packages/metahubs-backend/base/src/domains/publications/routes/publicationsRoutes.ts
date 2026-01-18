/**
 * Publications Routes for Metahubs Backend
 *
 * These routes handle Publication (Information Base) CRUD and schema sync operations
 * from the Metahub context. The Publication entity is defined in @universo/applications-backend,
 * but the schema generation/migration logic lives here in metahubs-backend.
 *
 * Endpoints:
 * - GET    /metahub/:metahubId/publications           - List publications linked to a Metahub
 * - POST   /metahub/:metahubId/publications           - Create new publication with default connector
 * - GET    /metahub/:metahubId/publication/:id        - Get single publication
 * - PATCH  /metahub/:metahubId/publication/:id        - Update publication
 * - DELETE /metahub/:metahubId/publication/:id        - Delete publication and schema
 * - GET    /metahub/:metahubId/publication/:id/diff   - Get schema diff
 * - POST   /metahub/:metahubId/publication/:id/sync   - Sync/migrate schema
 */

import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, In } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import {
    Application as Publication,
    ApplicationSchemaStatus as PublicationSchemaStatus,
    ApplicationUser as PublicationUser,
    Connector,
    ConnectorMetahub
} from '@universo/applications-backend'
import { sanitizeLocalizedInput, buildLocalizedContent } from '@universo/utils/vlc'
import { getRequestManager } from '../../../utils'
import { Metahub } from '../../../database/entities/Metahub'
import { Catalog } from '../../../database/entities/Catalog'
import { Attribute } from '../../../database/entities/Attribute'
import { SchemaGenerator, SchemaSnapshot, SchemaMigrator, SchemaDiff, buildCatalogDefinitions } from '../../ddl'

// ═══════════════════════════════════════════════════════════════════════════
// Helper: Resolve user ID from request
// ═══════════════════════════════════════════════════════════════════════════

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as any).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

// ═══════════════════════════════════════════════════════════════════════════
// Validation Schemas
// ═══════════════════════════════════════════════════════════════════════════

const localizedInputSchema = z
    .union([z.string(), z.record(z.string())])
    .transform((val) => (typeof val === 'string' ? { en: val } : val))

const createPublicationSchema = z.object({
    name: localizedInputSchema.optional(),
    description: localizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
})

const updatePublicationSchema = z.object({
    name: localizedInputSchema.optional(),
    description: localizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
})

const syncSchema = z.object({
    confirmDestructive: z.boolean().optional().default(false),
})

// ═══════════════════════════════════════════════════════════════════════════
// Route Factory
// ═══════════════════════════════════════════════════════════════════════════

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

    // Helper to get repositories from current transaction/datasource
    const repos = (req: Request) => {
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)
        return {
            publicationRepo: manager.getRepository(Publication),
            connectorRepo: manager.getRepository(Connector),
            connectorMetahubRepo: manager.getRepository(ConnectorMetahub),
            metahubRepo: manager.getRepository(Metahub),
            catalogRepo: manager.getRepository(Catalog),
            attributeRepo: manager.getRepository(Attribute),
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GET /metahub/:metahubId/publications
    // List all publications linked to a Metahub
    // ═══════════════════════════════════════════════════════════════════════

    router.get(
        '/metahub/:metahubId/publications',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const { publicationRepo, connectorMetahubRepo, metahubRepo } = repos(req)

            // Verify metahub exists
            const metahub = await metahubRepo.findOneBy({ id: metahubId })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            // Find all publications that have a connector linked to this metahub
            // This is a cross-schema query via the junction table
            const connectorMetahubs = await connectorMetahubRepo.find({
                where: { metahubId },
                relations: ['connector'],
            })

            if (connectorMetahubs.length === 0) {
                return res.json({ items: [], total: 0 })
            }

            // Get unique publication IDs from connectors and map to first connectorId
            const publicationConnectorMap = new Map<string, string>()
            for (const cm of connectorMetahubs) {
                const pubId = cm.connector.applicationId
                // Keep first connector for each publication
                if (!publicationConnectorMap.has(pubId)) {
                    publicationConnectorMap.set(pubId, cm.connectorId)
                }
            }
            const publicationIds = [...publicationConnectorMap.keys()]

            const publications = await publicationRepo.find({
                where: { id: In(publicationIds) },
                order: { createdAt: 'DESC' },
            })

            // Enrich with metahubId and connectorId for navigation
            const enrichedPublications = publications.map((publication) => ({
                ...publication,
                metahubId, // Frontend expects this field
                connectorId: publicationConnectorMap.get(publication.id), // For navigation to connector
            }))

            return res.json({
                items: enrichedPublications,
                total: enrichedPublications.length,
            })
        })
    )

    // ═══════════════════════════════════════════════════════════════════════
    // POST /metahub/:metahubId/publications
    // Create a new publication with a default connector linked to this metahub
    // ═══════════════════════════════════════════════════════════════════════

    router.post(
        '/metahub/:metahubId/publications',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const ds = getDataSource()

            // Resolve current user for owner assignment
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' })
            }

            const parsed = createPublicationSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: parsed.error.flatten(),
                })
            }

            const { name, description, namePrimaryLocale, descriptionPrimaryLocale } = parsed.data

            // Verify metahub exists and fetch its data for Connector
            const metahubRepo = ds.getRepository(Metahub)
            const metahub = await metahubRepo.findOneBy({ id: metahubId })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            // Create Publication, Connector, ConnectorMetahub, and PublicationUser in a single transaction
            const result = await ds.transaction(async (manager) => {
                const publicationRepo = manager.getRepository(Publication)
                const connectorRepo = manager.getRepository(Connector)
                const connectorMetahubRepo = manager.getRepository(ConnectorMetahub)
                const publicationUserRepo = manager.getRepository(PublicationUser)

                // 1. Create Publication
                const publication = publicationRepo.create({
                    name: buildLocalizedContent(
                        sanitizeLocalizedInput(name || {}),
                        namePrimaryLocale || 'en'
                    ),
                    description: description
                        ? buildLocalizedContent(
                              sanitizeLocalizedInput(description),
                              descriptionPrimaryLocale || 'en'
                          )
                        : undefined,
                    schemaStatus: PublicationSchemaStatus.DRAFT,
                })
                await publicationRepo.save(publication)

                // 2. Generate schema name
                const schemaName = SchemaGenerator.generateSchemaName(publication.id)
                publication.schemaName = schemaName
                await publicationRepo.save(publication)

                // 3. Create PublicationUser as owner
                const publicationUser = publicationUserRepo.create({
                    application_id: publication.id,
                    user_id: userId,
                    role: 'owner',
                })
                await publicationUserRepo.save(publicationUser)

                // 4. Create Connector with Metahub name/description (not "Default Connector")
                // Copy metahub name/description to connector for better UX
                const connector = connectorRepo.create({
                    applicationId: publication.id,
                    name: metahub.name, // Copy from Metahub
                    description: metahub.description, // Copy from Metahub
                    codename: 'default',
                    sortOrder: 0,
                    isSingleMetahub: true,
                    isRequiredMetahub: true,
                })
                await connectorRepo.save(connector)

                // 5. Create ConnectorMetahub link
                const connectorMetahub = connectorMetahubRepo.create({
                    connectorId: connector.id,
                    metahubId,
                    sortOrder: 0,
                })
                await connectorMetahubRepo.save(connectorMetahub)

                return { publication, connector }
            })

            // Return with metahubId and connectorId for frontend compatibility
            return res.status(201).json({
                ...result.publication,
                metahubId,
                connectorId: result.connector.id,
            })
        })
    )

    // ═══════════════════════════════════════════════════════════════════════
    // GET /metahub/:metahubId/publication/:publicationId
    // Get a single publication
    // ═══════════════════════════════════════════════════════════════════════

    router.get(
        '/metahub/:metahubId/publication/:publicationId',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, publicationId } = req.params
            const { publicationRepo, connectorMetahubRepo, metahubRepo, connectorRepo } = repos(req)

            // Verify metahub exists
            const metahub = await metahubRepo.findOneBy({ id: metahubId })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publication = await publicationRepo.findOneBy({ id: publicationId })
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
            }

            // Verify publication is linked to this metahub
            const link = await connectorMetahubRepo
                .createQueryBuilder('cm')
                .innerJoin('cm.connector', 'c')
                .where('c.applicationId = :publicationId', { publicationId })
                .andWhere('cm.metahubId = :metahubId', { metahubId })
                .getOne()

            if (!link) {
                return res.status(404).json({ error: 'Publication not linked to this Metahub' })
            }

            // Get the first connector for this publication (for navigation)
            const connector = await connectorRepo.findOne({
                where: { applicationId: publicationId },
                order: { sortOrder: 'ASC' }
            })

            return res.json({
                ...publication,
                metahubId,
                connectorId: connector?.id,
            })
        })
    )

    // ═══════════════════════════════════════════════════════════════════════
    // PATCH /metahub/:metahubId/publication/:publicationId
    // Update publication metadata (not schema)
    // ═══════════════════════════════════════════════════════════════════════

    router.patch(
        '/metahub/:metahubId/publication/:publicationId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, publicationId } = req.params
            const { publicationRepo, connectorMetahubRepo, metahubRepo } = repos(req)

            const parsed = updatePublicationSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: parsed.error.flatten(),
                })
            }

            // Verify metahub exists
            const metahub = await metahubRepo.findOneBy({ id: metahubId })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publication = await publicationRepo.findOneBy({ id: publicationId })
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
            }

            // Verify publication is linked to this metahub
            const link = await connectorMetahubRepo
                .createQueryBuilder('cm')
                .innerJoin('cm.connector', 'c')
                .where('c.applicationId = :publicationId', { publicationId })
                .andWhere('cm.metahubId = :metahubId', { metahubId })
                .getOne()

            if (!link) {
                return res.status(404).json({ error: 'Publication not linked to this Metahub' })
            }

            const { name, description, namePrimaryLocale, descriptionPrimaryLocale } = parsed.data

            if (name) {
                const nameVlc = buildLocalizedContent(
                    sanitizeLocalizedInput(name),
                    namePrimaryLocale || 'en'
                )
                if (nameVlc) {
                    publication.name = nameVlc
                }
            }
            if (description) {
                publication.description = buildLocalizedContent(
                    sanitizeLocalizedInput(description),
                    descriptionPrimaryLocale || 'en'
                )
            }

            await publicationRepo.save(publication)

            return res.json({
                ...publication,
                metahubId,
            })
        })
    )

    // ═══════════════════════════════════════════════════════════════════════
    // DELETE /metahub/:metahubId/publication/:publicationId
    // Delete publication and its schema
    // ═══════════════════════════════════════════════════════════════════════

    router.delete(
        '/metahub/:metahubId/publication/:publicationId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, publicationId } = req.params
            const confirm = req.query.confirm === 'true'
            const ds = getDataSource()

            if (!confirm) {
                return res.status(400).json({
                    error: 'Deletion requires confirmation',
                    message: 'Add ?confirm=true to confirm deletion of the publication and its data schema',
                })
            }

            // Verify metahub exists
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

            // Verify publication is linked to this metahub
            const connectorMetahubRepo = ds.getRepository(ConnectorMetahub)
            const link = await connectorMetahubRepo
                .createQueryBuilder('cm')
                .innerJoin('cm.connector', 'c')
                .where('c.applicationId = :publicationId', { publicationId })
                .andWhere('cm.metahubId = :metahubId', { metahubId })
                .getOne()

            if (!link) {
                return res.status(404).json({ error: 'Publication not linked to this Metahub' })
            }

            // Drop schema if it exists
            if (publication.schemaName) {
                try {
                    const generator = new SchemaGenerator()
                    await generator.dropSchema(publication.schemaName)
                } catch (err) {
                    console.warn(`[Publications] Failed to drop schema ${publication.schemaName}:`, err)
                    // Continue with deletion even if schema drop fails
                }
            }

            // Delete publication (cascades to connectors and connectors_metahubs)
            await publicationRepo.remove(publication)

            return res.json({
                success: true,
                message: `Publication and schema "${publication.schemaName}" deleted`,
            })
        })
    )

    // ═══════════════════════════════════════════════════════════════════════
    // GET /metahub/:metahubId/publication/:publicationId/diff
    // Calculate schema diff without applying changes
    // ═══════════════════════════════════════════════════════════════════════

    router.get(
        '/metahub/:metahubId/publication/:publicationId/diff',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, publicationId } = req.params
            const { publicationRepo, connectorMetahubRepo, metahubRepo, catalogRepo, attributeRepo } = repos(req)

            // Verify metahub exists
            const metahub = await metahubRepo.findOneBy({ id: metahubId })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publication = await publicationRepo.findOneBy({ id: publicationId })
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
            }

            // Verify publication is linked to this metahub
            const link = await connectorMetahubRepo
                .createQueryBuilder('cm')
                .innerJoin('cm.connector', 'c')
                .where('c.applicationId = :publicationId', { publicationId })
                .andWhere('cm.metahubId = :metahubId', { metahubId })
                .getOne()

            if (!link) {
                return res.status(404).json({ error: 'Publication not linked to this Metahub' })
            }

            // Build catalog definitions from current Metahub
            const catalogDefs = await buildCatalogDefinitions(catalogRepo, attributeRepo, metahubId)

            // Get old snapshot from publication
            const oldSnapshot = publication.schemaSnapshot as SchemaSnapshot | null

            // Calculate diff
            const migrator = new SchemaMigrator()
            const diff: SchemaDiff = migrator.calculateDiff(oldSnapshot, catalogDefs)

            // Check if schema exists
            const generator = new SchemaGenerator()
            const schemaExists = await generator.schemaExists(publication.schemaName || '')

            return res.json({
                schemaExists,
                diff: {
                    hasChanges: diff.hasChanges,
                    summary: diff.summary,
                    additive: diff.additive.map((c) => c.description),
                    destructive: diff.destructive.map((c) => c.description),
                },
            })
        })
    )

    // ═══════════════════════════════════════════════════════════════════════
    // POST /metahub/:metahubId/publication/:publicationId/sync
    // Synchronize/migrate schema
    // ═══════════════════════════════════════════════════════════════════════

    router.post(
        '/metahub/:metahubId/publication/:publicationId/sync',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, publicationId } = req.params
            const ds = getDataSource()

            const parsed = syncSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: parsed.error.flatten(),
                })
            }

            const { confirmDestructive } = parsed.data

            // Verify metahub exists
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

            // Verify publication is linked to this metahub
            const connectorMetahubRepo = ds.getRepository(ConnectorMetahub)
            const link = await connectorMetahubRepo
                .createQueryBuilder('cm')
                .innerJoin('cm.connector', 'c')
                .where('c.applicationId = :publicationId', { publicationId })
                .andWhere('cm.metahubId = :metahubId', { metahubId })
                .getOne()

            if (!link) {
                return res.status(404).json({ error: 'Publication not linked to this Metahub' })
            }

            // Build catalog definitions
            const catalogRepo = ds.getRepository(Catalog)
            const attributeRepo = ds.getRepository(Attribute)
            const catalogDefs = await buildCatalogDefinitions(catalogRepo, attributeRepo, metahubId)

            const generator = new SchemaGenerator()
            const migrator = new SchemaMigrator()

            // Check if schema exists
            const schemaExists = await generator.schemaExists(publication.schemaName || '')

            // Update status to pending
            publication.schemaStatus = PublicationSchemaStatus.PENDING
            await publicationRepo.save(publication)

            try {
                if (!schemaExists) {
                    // Create new schema with initial migration recording
                    const result = await generator.generateFullSchema(
                        publication.schemaName!,
                        catalogDefs,
                        { recordMigration: true, migrationDescription: 'initial_schema' }
                    )

                    if (!result.success) {
                        publication.schemaStatus = PublicationSchemaStatus.ERROR
                        publication.schemaError = result.errors.join('; ')
                        await publicationRepo.save(publication)

                        return res.status(500).json({
                            status: 'error',
                            message: 'Schema creation failed',
                            errors: result.errors,
                        })
                    }

                    // Generate snapshot and save
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
                        tablesCreated: result.tablesCreated,
                        message: `Schema created with ${result.tablesCreated.length} table(s)`,
                    })
                }

                // Schema exists - calculate diff
                const oldSnapshot = publication.schemaSnapshot as SchemaSnapshot | null
                const diff = migrator.calculateDiff(oldSnapshot, catalogDefs)

                if (!diff.hasChanges) {
                    await generator.syncSystemMetadata(publication.schemaName!, catalogDefs)

                    const snapshot = generator.generateSnapshot(catalogDefs)
                    publication.schemaStatus = PublicationSchemaStatus.SYNCED
                    publication.schemaSnapshot = snapshot as unknown as Record<string, unknown>
                    publication.schemaError = null
                    publication.schemaSyncedAt = new Date()
                    await publicationRepo.save(publication)

                    return res.json({
                        status: 'synced',
                        message: 'Schema is already up to date',
                    })
                }

                // Check for destructive changes
                if (diff.destructive.length > 0 && !confirmDestructive) {
                    publication.schemaStatus = PublicationSchemaStatus.OUTDATED
                    await publicationRepo.save(publication)

                    return res.json({
                        status: 'pending_confirmation',
                        message: 'Destructive changes require confirmation',
                        diff: {
                            summary: diff.summary,
                            additive: diff.additive.map((c) => c.description),
                            destructive: diff.destructive.map((c) => c.description),
                        },
                    })
                }

                // Apply migration with recording
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

                    return res.status(500).json({
                        status: 'error',
                        message: 'Migration failed',
                        errors: migrationResult.errors,
                    })
                }

                // Update snapshot
                const newSnapshot = generator.generateSnapshot(catalogDefs)
                publication.schemaStatus = PublicationSchemaStatus.SYNCED
                publication.schemaError = null
                publication.schemaSyncedAt = new Date()
                publication.schemaSnapshot = newSnapshot as unknown as Record<string, unknown>
                await publicationRepo.save(publication)

                return res.json({
                    status: 'migrated',
                    changesApplied: migrationResult.changesApplied,
                    message: `Applied ${migrationResult.changesApplied} change(s)`,
                })
            } catch (error) {
                publication.schemaStatus = PublicationSchemaStatus.ERROR
                publication.schemaError = error instanceof Error ? error.message : 'Unknown error'
                await publicationRepo.save(publication)

                return res.status(500).json({
                    status: 'error',
                    message: 'Sync failed',
                    error: publication.schemaError,
                })
            }
        })
    )

    return router
}
