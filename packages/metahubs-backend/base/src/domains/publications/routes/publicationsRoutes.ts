/**
 * Publications Routes for Metahubs Backend
 *
 * These routes handle Publication (Information Base) CRUD and schema sync operations.
 * Publication is now a standalone entity in metahubs schema with direct FK to Metahub.
 *
 * Endpoints:
 * - GET    /metahub/:metahubId/publications                   - List publications for a Metahub
 * - POST   /metahub/:metahubId/publications                   - Create new publication
 * - GET    /metahub/:metahubId/publication/:id                - Get single publication
 * - PATCH  /metahub/:metahubId/publication/:id                - Update publication
 * - DELETE /metahub/:metahubId/publication/:id                - Delete publication and schema
 * - GET    /metahub/:metahubId/publication/:id/diff           - Get schema diff
 * - POST   /metahub/:metahubId/publication/:id/sync           - Sync/migrate schema
 * - GET    /metahub/:metahubId/publication/:id/applications   - Get linked applications
 */

import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import { sanitizeLocalizedInput, buildLocalizedContent } from '@universo/utils/vlc'
import { getRequestManager } from '../../../utils'
import { Metahub } from '../../../database/entities/Metahub'
import { Catalog } from '../../../database/entities/Catalog'
import { Attribute } from '../../../database/entities/Attribute'
import { Publication, PublicationSchemaStatus } from '../../../database/entities/Publication'
import { PublicationUser } from '../../../database/entities/PublicationUser'
import { SchemaGenerator, SchemaSnapshot, SchemaMigrator, SchemaDiff, buildCatalogDefinitions } from '../../ddl'
// Import applications entities for auto-create feature
import { Application, ApplicationUser, Connector, ConnectorMetahub } from '@universo/applications-backend'

// ═══════════════════════════════════════════════════════════════════════════
// Helper: Resolve user ID from request
// ═══════════════════════════════════════════════════════════════════════════

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as unknown as { user?: { id?: string; sub?: string; user_id?: string; userId?: string } }).user
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
    autoCreateApplication: z.boolean().optional().default(false)
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
            publicationUserRepo: manager.getRepository(PublicationUser),
            metahubRepo: manager.getRepository(Metahub),
            catalogRepo: manager.getRepository(Catalog),
            attributeRepo: manager.getRepository(Attribute)
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GET /metahub/:metahubId/publications
    // List all publications for a Metahub
    // ═══════════════════════════════════════════════════════════════════════

    router.get(
        '/metahub/:metahubId/publications',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const { publicationRepo, metahubRepo } = repos(req)

            // Verify metahub exists
            const metahub = await metahubRepo.findOneBy({ id: metahubId })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            // Direct query: publications belong to this metahub
            const publications = await publicationRepo.find({
                where: { metahubId },
                order: { createdAt: 'DESC' }
            })

            // Enrich with metahubId for frontend compatibility
            const enrichedPublications = publications.map((publication) => ({
                ...publication,
                metahubId // Frontend expects this field
            }))

            return res.json({
                items: enrichedPublications,
                total: enrichedPublications.length
            })
        })
    )

    // ═══════════════════════════════════════════════════════════════════════
    // POST /metahub/:metahubId/publications
    // Create a new publication
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
                    details: parsed.error.flatten()
                })
            }

            const { name, description, namePrimaryLocale, descriptionPrimaryLocale, autoCreateApplication } = parsed.data

            // Verify metahub exists
            const metahubRepo = ds.getRepository(Metahub)
            const metahub = await metahubRepo.findOneBy({ id: metahubId })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            // Create Publication and PublicationUser in a single transaction
            const result = await ds.transaction(async (manager) => {
                const publicationRepo = manager.getRepository(Publication)
                const publicationUserRepo = manager.getRepository(PublicationUser)

                // 1. Create Publication with direct metahubId reference
                const publication = publicationRepo.create({
                    metahubId,
                    name: buildLocalizedContent(sanitizeLocalizedInput(name || {}), namePrimaryLocale || 'en'),
                    description: description
                        ? buildLocalizedContent(sanitizeLocalizedInput(description), descriptionPrimaryLocale || 'en')
                        : undefined,
                    schemaStatus: PublicationSchemaStatus.DRAFT,
                    autoCreateApplication: autoCreateApplication ?? false
                })
                await publicationRepo.save(publication)

                // 2. Generate schema name
                const schemaName = SchemaGenerator.generateSchemaName(publication.id)
                publication.schemaName = schemaName
                await publicationRepo.save(publication)

                // 3. Create PublicationUser as owner
                const publicationUser = publicationUserRepo.create({
                    publicationId: publication.id,
                    userId,
                    role: 'owner'
                })
                await publicationUserRepo.save(publicationUser)

                // 4. Auto-create Application if flag is set
                if (autoCreateApplication && metahub) {
                    const applicationRepo = manager.getRepository(Application)
                    const appUserRepo = manager.getRepository(ApplicationUser)
                    const connectorRepo = manager.getRepository(Connector)
                    const connectorMetahubRepo = manager.getRepository(ConnectorMetahub)

                    // 4a. Create Application with name/description from Publication
                    const application = applicationRepo.create({
                        name: publication.name!, // Copy VLC name from Publication
                        description: publication.description ?? undefined, // Copy VLC description from Publication
                        slug: `pub-${publication.id.slice(0, 8)}` // Generate unique slug
                        // NOTE: schemaName is NOT set here - it will be generated
                        // based on Application's UUID when first schema sync is triggered
                    })
                    await applicationRepo.save(application)

                    // 4a2. Generate schemaName based on Application's UUID (not Publication's!)
                    application.schemaName = SchemaGenerator.generateSchemaName(application.id)
                    await applicationRepo.save(application)

                    // 4b. Create ApplicationUser as owner
                    const appUser = appUserRepo.create({
                        application_id: application.id, // snake_case as per entity definition
                        user_id: userId,
                        role: 'owner'
                    })
                    await appUserRepo.save(appUser)

                    // 4c. Create Connector with name/description from Metahub
                    const connector = connectorRepo.create({
                        applicationId: application.id,
                        name: metahub.name, // Copy VLC name from Metahub
                        description: metahub.description ?? undefined, // Copy VLC description from Metahub
                        sortOrder: 0
                    })
                    await connectorRepo.save(connector)

                    // 4d. Link Connector to Metahub
                    const connectorMetahub = connectorMetahubRepo.create({
                        connectorId: connector.id,
                        metahubId: metahub.id,
                        sortOrder: 0
                    })
                    await connectorMetahubRepo.save(connectorMetahub)
                }

                return publication
            })

            // Return with metahubId for frontend compatibility
            return res.status(201).json({
                ...result,
                metahubId
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
            const { publicationRepo, metahubRepo } = repos(req)

            // Verify metahub exists
            const metahub = await metahubRepo.findOneBy({ id: metahubId })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publication = await publicationRepo.findOneBy({ id: publicationId })
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
            }

            // Verify publication belongs to this metahub
            if (publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
            }

            return res.json({
                ...publication,
                metahubId
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
            const { publicationRepo, metahubRepo } = repos(req)

            const parsed = updatePublicationSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: parsed.error.flatten()
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

            // Verify publication belongs to this metahub
            if (publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
            }

            const { name, description, namePrimaryLocale, descriptionPrimaryLocale } = parsed.data

            if (name) {
                const nameVlc = buildLocalizedContent(sanitizeLocalizedInput(name), namePrimaryLocale || 'en')
                if (nameVlc) {
                    publication.name = nameVlc
                }
            }
            if (description) {
                const descVlc = buildLocalizedContent(
                    sanitizeLocalizedInput(description),
                    descriptionPrimaryLocale || 'en'
                )
                publication.description = descVlc ?? null
            }

            await publicationRepo.save(publication)

            return res.json({
                ...publication,
                metahubId
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
                    message: 'Add ?confirm=true to confirm deletion of the publication and its data schema'
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

            // Verify publication belongs to this metahub
            if (publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
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

            // Delete publication (cascades to publications_users)
            await publicationRepo.remove(publication)

            return res.json({
                success: true,
                message: `Publication and schema "${publication.schemaName}" deleted`
            })
        })
    )

    // ═══════════════════════════════════════════════════════════════════════
    // GET /metahub/:metahubId/publication/:publicationId/applications
    // Get applications linked to this publication via connectors
    // ═══════════════════════════════════════════════════════════════════════

    router.get(
        '/metahub/:metahubId/publication/:publicationId/applications',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, publicationId } = req.params
            const ds = getDataSource()

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

            // Verify publication belongs to this metahub
            if (publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
            }

            // Cross-schema join to get linked applications
            // Applications are linked via: Application → Connector → ConnectorMetahub → Metahub ← Publication
            const linkedApps = await ds.query(
                `
                SELECT DISTINCT a.id, a.name, a.description, a.slug, a.created_at as "createdAt"
                FROM applications.applications a
                JOIN applications.connectors c ON c.application_id = a.id
                JOIN applications.connectors_metahubs cm ON cm.connector_id = c.id
                WHERE cm.metahub_id = $1
                ORDER BY a.created_at DESC
            `,
                [metahubId]
            )

            return res.json({
                items: linkedApps,
                total: linkedApps.length
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
            const { publicationRepo, metahubRepo, catalogRepo, attributeRepo } = repos(req)

            // Verify metahub exists
            const metahub = await metahubRepo.findOneBy({ id: metahubId })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const publication = await publicationRepo.findOneBy({ id: publicationId })
            if (!publication) {
                return res.status(404).json({ error: 'Publication not found' })
            }

            // Verify publication belongs to this metahub
            if (publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
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
                    destructive: diff.destructive.map((c) => c.description)
                }
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
                    details: parsed.error.flatten()
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

            // Verify publication belongs to this metahub
            if (publication.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Publication not found in this Metahub' })
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
                    const result = await generator.generateFullSchema(publication.schemaName!, catalogDefs, {
                        recordMigration: true,
                        migrationDescription: 'initial_schema'
                    })

                    if (!result.success) {
                        publication.schemaStatus = PublicationSchemaStatus.ERROR
                        publication.schemaError = result.errors.join('; ')
                        await publicationRepo.save(publication)

                        return res.status(500).json({
                            status: 'error',
                            message: 'Schema creation failed',
                            errors: result.errors
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
                        message: `Schema created with ${result.tablesCreated.length} table(s)`
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
                        message: 'Schema is already up to date'
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
                            destructive: diff.destructive.map((c) => c.description)
                        }
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
                        errors: migrationResult.errors
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
                    message: `Applied ${migrationResult.changesApplied} change(s)`
                })
            } catch (error) {
                publication.schemaStatus = PublicationSchemaStatus.ERROR
                publication.schemaError = error instanceof Error ? error.message : 'Unknown error'
                await publicationRepo.save(publication)

                return res.status(500).json({
                    status: 'error',
                    message: 'Sync failed',
                    error: publication.schemaError
                })
            }
        })
    )

    return router
}
