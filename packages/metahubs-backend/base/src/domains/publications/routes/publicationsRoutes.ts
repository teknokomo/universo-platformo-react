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
import { getDDLServices, buildCatalogDefinitions, generateSchemaName } from '../../ddl'
import type { SchemaSnapshot, SchemaDiff } from '../../ddl'
// Import applications entities for auto-create feature
import { Application, ApplicationUser, Connector, ConnectorPublication } from '@universo/applications-backend'

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
            metahubRepo: manager.getRepository(Metahub),
            catalogRepo: manager.getRepository(Catalog),
            attributeRepo: manager.getRepository(Attribute)
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GET /publications/available
    // List all publications available for linking to Connectors
    // Returns publications with their parent metahub info
    // Access is determined via metahubs_users (not publications_users)
    // ═══════════════════════════════════════════════════════════════════════

    router.get(
        '/publications/available',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const ds = getDataSource()
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' })
            }

            // Parse pagination params
            const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 100)
            const offset = Math.max(parseInt(req.query.offset as string) || 0, 0)

            // Get all publications user has access to via metahub membership
            // User has access to publication if they are a member of the parent metahub
            // Use request-scoped manager to preserve RLS context
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
                    COALESCE(m.slug, m.id::text) as "metahubCodename",
                    m.name as "metahubName"
                FROM metahubs.publications p
                JOIN metahubs.metahubs m ON m.id = p.metahub_id
                JOIN metahubs.metahubs_users mu ON mu.metahub_id = m.id
                WHERE mu.user_id = $1
                ORDER BY p.created_at DESC
                LIMIT $2 OFFSET $3
            `, [userId, limit, offset])

            // Transform to expected format with nested metahub
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

            // Get total count
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

            // Check if metahub already has a publication (single publication limit)
            const publicationRepo = ds.getRepository(Publication)
            const existingPublicationsCount = await publicationRepo.count({ where: { metahubId } })
            if (existingPublicationsCount > 0) {
                return res.status(400).json({
                    error: 'Single publication limit reached',
                    message: 'Currently, only one Publication per Metahub is supported. This restriction will be removed in future versions.'
                })
            }

            // Create Publication in a transaction
            const result = await ds.transaction(async (manager) => {
                const publicationRepoTx = manager.getRepository(Publication)

                // 1. Create Publication with direct metahubId reference
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

                // 3. Auto-create Application if flag is set
                if (autoCreateApplication && metahub) {
                    const applicationRepo = manager.getRepository(Application)
                    const appUserRepo = manager.getRepository(ApplicationUser)
                    const connectorRepo = manager.getRepository(Connector)
                    const connectorPublicationRepo = manager.getRepository(ConnectorPublication)

                    // 3a. Create Application with name/description from Publication
                    const application = applicationRepo.create({
                        name: publication.name!, // Copy VLC name from Publication
                        description: publication.description ?? undefined, // Copy VLC description from Publication
                        slug: `pub-${publication.id.slice(0, 8)}` // Generate unique slug
                        // NOTE: schemaName is NOT set here - it will be generated
                        // based on Application's UUID when first schema sync is triggered
                    })
                    await applicationRepo.save(application)

                    // 3a2. Generate schemaName based on Application's UUID (not Publication's!)
                    application.schemaName = generateSchemaName(application.id)
                    await applicationRepo.save(application)

                    // 3b. Create ApplicationUser as owner
                    const appUser = appUserRepo.create({
                        application_id: application.id, // snake_case as per entity definition
                        user_id: userId,
                        role: 'owner'
                    })
                    await appUserRepo.save(appUser)

                    // 3c. Create Connector with name/description from Metahub
                    const connector = connectorRepo.create({
                        applicationId: application.id,
                        name: metahub.name, // Copy VLC name from Metahub
                        description: metahub.description ?? undefined, // Copy VLC description from Metahub
                        sortOrder: 0
                    })
                    await connectorRepo.save(connector)

                    // 3d. Link Connector to Publication (not Metahub!)
                    const connectorPublication = connectorPublicationRepo.create({
                        connectorId: connector.id,
                        publicationId: publication.id, // Link to Publication, not Metahub
                        sortOrder: 0
                    })
                    await connectorPublicationRepo.save(connectorPublication)
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
                    const { generator } = getDDLServices()
                    await generator.dropSchema(publication.schemaName)
                } catch (err) {
                    console.warn(`[Publications] Failed to drop schema ${publication.schemaName}:`, err)
                    // Continue with deletion even if schema drop fails
                }
            }

            // Delete publication
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
            // Applications are linked via: Application → Connector → ConnectorPublication → Publication
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
            const { generator, migrator } = getDDLServices()
            const diff: SchemaDiff = migrator.calculateDiff(oldSnapshot, catalogDefs)

            // Check if schema exists
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

            const { generator, migrator, migrationManager } = getDDLServices()

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
                        migrationDescription: 'initial_schema',
                        migrationManager
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
