/**
 * Application Schema Sync Routes
 *
 * These routes handle schema creation, synchronization and diff calculation
 * for Applications. They use the Application → Connector → ConnectorPublication → Publication
 * chain to determine the structure.
 *
 * Endpoints:
 * - POST   /application/:applicationId/sync  - Create or update schema
 * - GET    /application/:applicationId/diff  - Calculate schema diff
 */

import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import { Application, Connector, ConnectorPublication, ApplicationSchemaStatus } from '@universo/applications-backend'
import { Publication } from '../../../database/entities/Publication'
import { Catalog } from '../../../database/entities/Catalog'
import { Attribute } from '../../../database/entities/Attribute'
import { getDDLServices, buildCatalogDefinitions, generateSchemaName } from '../../ddl'
import type { SchemaSnapshot, SchemaChange } from '../../ddl'

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface RequestUser {
    id?: string
    sub?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

const resolveUserId = (req: Request): string | undefined => {
    const user = req.user as RequestUser | undefined
    return user?.id ?? user?.sub
}

const asyncHandler = (
    fn: (req: Request, res: Response) => Promise<Response | void>
): RequestHandler => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res)).catch(next)
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Access Check
// ═══════════════════════════════════════════════════════════════════════════

async function ensureApplicationAccess(
    ds: DataSource,
    userId: string,
    applicationId: string,
    allowedRoles: string[]
): Promise<void> {
    const result = await ds.query(
        `SELECT role FROM applications.applications_users 
         WHERE application_id = $1 AND user_id = $2`,
        [applicationId, userId]
    )

    const error = new Error('Access denied')
    ;(error as NodeJS.ErrnoException).code = 'FORBIDDEN'

    if (result.length === 0) {
        throw error
    }

    if (result.length > 1) {
        console.warn(`Multiple roles found for user ${userId} in application ${applicationId}`)
    }

    if (!allowedRoles.includes(result[0].role)) {
        throw error
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Route Factory
// ═══════════════════════════════════════════════════════════════════════════

export function createApplicationSyncRoutes(
    ensureAuth: RequestHandler,
    getDataSource: () => DataSource,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router()

    // ════════════════════════════════════════════════════════════════════
    // POST /application/:applicationId/sync - Create or update schema
    // ════════════════════════════════════════════════════════════════════
    router.post(
        '/application/:applicationId/sync',
        ensureAuth,
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const ds = getDataSource()

            // Check access
            try {
                await ensureApplicationAccess(ds, userId, applicationId, ['admin', 'owner'])
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'FORBIDDEN') {
                    return res.status(403).json({ error: 'Access denied' })
                }
                throw error
            }

            // Parse request body
            const syncSchema = z.object({
                confirmDestructive: z.boolean().optional().default(false)
            })
            const parsed = syncSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }
            const { confirmDestructive } = parsed.data

            // Get application
            const applicationRepo = ds.getRepository(Application)
            const application = await applicationRepo.findOneBy({ id: applicationId })
            if (!application) {
                return res.status(404).json({ error: 'Application not found' })
            }

            // Find connector for this application
            const connectorRepo = ds.getRepository(Connector)
            const connector = await connectorRepo.findOne({
                where: { applicationId }
            })
            if (!connector) {
                return res.status(400).json({ error: 'No connector found for this application. Create a connector first.' })
            }

            // Find linked publication through ConnectorPublication
            const connectorPublicationRepo = ds.getRepository(ConnectorPublication)
            const connectorPublication = await connectorPublicationRepo.findOne({
                where: { connectorId: connector.id }
            })
            if (!connectorPublication) {
                return res.status(400).json({ error: 'Connector is not linked to any Publication. Link a Publication first.' })
            }

            // Get publication to find metahubId for catalog definitions
            const publicationRepo = ds.getRepository(Publication)
            const publication = await publicationRepo.findOneBy({ id: connectorPublication.publicationId })
            if (!publication) {
                return res.status(400).json({ error: 'Linked publication not found' })
            }

            const metahubId = publication.metahubId

            // Build catalog definitions from the linked Metahub
            const catalogRepo = ds.getRepository(Catalog)
            const attributeRepo = ds.getRepository(Attribute)
            const catalogDefs = await buildCatalogDefinitions(catalogRepo, attributeRepo, metahubId)

            const { generator, migrator, migrationManager } = getDDLServices()

            // Ensure schemaName exists
            if (!application.schemaName) {
                application.schemaName = generateSchemaName(application.id)
                await applicationRepo.save(application)
            }

            // Check if schema exists
            const schemaExists = await generator.schemaExists(application.schemaName)

            // Update status to pending
            application.schemaStatus = ApplicationSchemaStatus.PENDING
            await applicationRepo.save(application)

            try {
                if (!schemaExists) {
                    // Create new schema with initial migration recording
                    const result = await generator.generateFullSchema(application.schemaName!, catalogDefs, {
                        recordMigration: true,
                        migrationDescription: 'initial_schema',
                        migrationManager
                    })

                    if (!result.success) {
                        application.schemaStatus = ApplicationSchemaStatus.ERROR
                        application.schemaError = result.errors.join('; ')
                        await applicationRepo.save(application)

                        return res.status(500).json({
                            status: 'error',
                            message: 'Schema creation failed',
                            errors: result.errors
                        })
                    }

                    // Generate snapshot and save
                    const snapshot = generator.generateSnapshot(catalogDefs)
                    application.schemaStatus = ApplicationSchemaStatus.SYNCED
                    application.schemaError = null
                    application.schemaSyncedAt = new Date()
                    application.schemaSnapshot = snapshot as unknown as Record<string, unknown>
                    await applicationRepo.save(application)

                    return res.json({
                        status: 'created',
                        schemaName: result.schemaName,
                        tablesCreated: result.tablesCreated,
                        message: `Schema created with ${result.tablesCreated.length} table(s)`
                    })
                }

                // Schema exists - calculate diff
                const oldSnapshot = application.schemaSnapshot as SchemaSnapshot | null
                const diff = migrator.calculateDiff(oldSnapshot, catalogDefs)
                const hasDestructiveChanges = diff.destructive.length > 0

                if (!diff.hasChanges) {
                    await generator.syncSystemMetadata(application.schemaName!, catalogDefs)

                    application.schemaStatus = ApplicationSchemaStatus.SYNCED
                    application.schemaError = null
                    await applicationRepo.save(application)

                    return res.json({
                        status: 'no_changes',
                        message: 'Schema is already up to date'
                    })
                }

                // Check for destructive changes that need confirmation
                if (hasDestructiveChanges && !confirmDestructive) {
                    application.schemaStatus = ApplicationSchemaStatus.OUTDATED
                    await applicationRepo.save(application)

                    return res.json({
                        status: 'pending_confirmation',
                        diff: {
                            hasChanges: diff.hasChanges,
                            hasDestructiveChanges,
                            additive: diff.additive.map((c: SchemaChange) => c.description),
                            destructive: diff.destructive.map((c: SchemaChange) => c.description),
                            summary: diff.summary
                        },
                        message: 'Destructive changes detected. Set confirmDestructive=true to proceed.'
                    })
                }

                // Apply migration using applyAllChanges
                const migrationResult = await migrator.applyAllChanges(
                    application.schemaName!,
                    diff,
                    catalogDefs,
                    confirmDestructive
                )

                if (!migrationResult.success) {
                    application.schemaStatus = ApplicationSchemaStatus.ERROR
                    application.schemaError = migrationResult.errors.join('; ')
                    await applicationRepo.save(application)

                    return res.status(500).json({
                        status: 'error',
                        message: 'Schema migration failed',
                        errors: migrationResult.errors
                    })
                }

                // Update snapshot and status
                const newSnapshot = generator.generateSnapshot(catalogDefs)
                application.schemaStatus = ApplicationSchemaStatus.SYNCED
                application.schemaError = null
                application.schemaSyncedAt = new Date()
                application.schemaSnapshot = newSnapshot as unknown as Record<string, unknown>
                await applicationRepo.save(application)

                return res.json({
                    status: 'migrated',
                    schemaName: application.schemaName,
                    changesApplied: migrationResult.changesApplied,
                    message: 'Schema migration applied successfully'
                })
            } catch (error) {
                application.schemaStatus = ApplicationSchemaStatus.ERROR
                application.schemaError = error instanceof Error ? error.message : 'Unknown error'
                await applicationRepo.save(application)

                return res.status(500).json({
                    status: 'error',
                    message: 'Schema sync failed',
                    error: error instanceof Error ? error.message : 'Unknown error'
                })
            }
        })
    )

    // ════════════════════════════════════════════════════════════════════
    // GET /application/:applicationId/diff - Calculate schema diff
    // ════════════════════════════════════════════════════════════════════
    router.get(
        '/application/:applicationId/diff',
        ensureAuth,
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const ds = getDataSource()

            try {
                await ensureApplicationAccess(ds, userId, applicationId, ['member', 'editor', 'admin', 'owner'])
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'FORBIDDEN') {
                    return res.status(403).json({ error: 'Access denied' })
                }
                throw error
            }

            const applicationRepo = ds.getRepository(Application)
            const application = await applicationRepo.findOneBy({ id: applicationId })
            if (!application) {
                return res.status(404).json({ error: 'Application not found' })
            }

            // Find connector
            const connectorRepo = ds.getRepository(Connector)
            const connector = await connectorRepo.findOne({ where: { applicationId } })
            if (!connector) {
                return res.status(400).json({ error: 'No connector found' })
            }

            // Find linked publication
            const connectorPublicationRepo = ds.getRepository(ConnectorPublication)
            const connectorPublication = await connectorPublicationRepo.findOne({
                where: { connectorId: connector.id }
            })
            if (!connectorPublication) {
                return res.status(400).json({ error: 'Connector not linked to Publication' })
            }

            // Get publication to find metahubId
            const publicationRepo = ds.getRepository(Publication)
            const publication = await publicationRepo.findOneBy({ id: connectorPublication.publicationId })
            if (!publication) {
                return res.status(400).json({ error: 'Linked publication not found' })
            }

            const metahubId = publication.metahubId

            // Build catalog definitions
            const catalogRepo = ds.getRepository(Catalog)
            const attributeRepo = ds.getRepository(Attribute)
            const catalogDefs = await buildCatalogDefinitions(catalogRepo, attributeRepo, metahubId)

            const { generator, migrator } = getDDLServices()

            // Check if schema exists
            const schemaName = application.schemaName || generateSchemaName(application.id)
            const schemaExists = await generator.schemaExists(schemaName)

            if (!schemaExists) {
                // Schema doesn't exist - show what will be created
                // Generate a "diff" from empty to full catalog definitions
                const additive = catalogDefs.map((cat) => {
                    const fieldCount = cat.fields?.length ?? 0
                    return `Create table "${cat.codename}" with ${fieldCount} field(s)`
                })

                return res.json({
                    schemaExists: false,
                    schemaName,
                    diff: {
                        hasChanges: true,
                        hasDestructiveChanges: false,
                        additive,
                        destructive: [],
                        summary: `Create ${catalogDefs.length} table(s) in new schema`
                    },
                    message: 'Schema does not exist yet. These tables will be created.'
                })
            }

            // Calculate diff
            const oldSnapshot = application.schemaSnapshot as SchemaSnapshot | null
            const diff = migrator.calculateDiff(oldSnapshot, catalogDefs)
            const hasDestructiveChanges = diff.destructive.length > 0

            return res.json({
                schemaExists: true,
                schemaName,
                diff: {
                    hasChanges: diff.hasChanges,
                    hasDestructiveChanges,
                    additive: diff.additive.map((c: SchemaChange) => c.description),
                    destructive: diff.destructive.map((c: SchemaChange) => c.description),
                    summary: diff.summary
                }
            })
        })
    )

    return router
}
