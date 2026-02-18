/**
 * Application Migrations Routes for Metahubs Backend
 *
 * These routes handle migration history viewing and rollback operations
 * for Application schemas. The routes are scoped by applicationId and
 * use the DDL module for all schema operations.
 *
 * Endpoints:
 * - GET    /application/:applicationId/migrations/status     - Migration status for guard
 * - GET    /application/:applicationId/migrations            - List migrations
 * - GET    /application/:applicationId/migration/:id         - Get single migration
 * - GET    /application/:applicationId/migration/:id/analyze - Analyze rollback possibility
 * - POST   /application/:applicationId/migration/:id/rollback - Rollback to this migration
 */

import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import {
    Application,
    ApplicationUser,
    ApplicationSchemaStatus,
    Connector,
    ConnectorPublication,
    ensureApplicationAccess,
    type ApplicationRole
} from '@universo/applications-backend'
import { UpdateSeverity, type ApplicationMigrationStatusResponse, type StructuredBlocker } from '@universo/types'
import { determineSeverity } from '@universo/migration-guard-shared/utils'
import { Publication } from '../../../database/entities/Publication'
import {
    getDDLServices,
    KnexClient,
    ChangeType,
    buildFkConstraintName,
    uuidToLockKey,
    acquireAdvisoryLock,
    releaseAdvisoryLock
} from '../../ddl'
import type { MigrationChangeRecord, SchemaSnapshot } from '../../ddl'
import { TARGET_APP_STRUCTURE_VERSION } from '../constants'

// ═══════════════════════════════════════════════════════════════════════════
// Validation Schemas
// ═══════════════════════════════════════════════════════════════════════════

const listMigrationsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0)
})

const rollbackSchema = z.object({
    confirmDestructive: z.boolean().optional().default(false)
})

// ═══════════════════════════════════════════════════════════════════════════
// Route Factory
// ═══════════════════════════════════════════════════════════════════════════

export function createApplicationMigrationsRoutes(
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

    const { generator, migrationManager } = getDDLServices()
    const ADMIN_ROLES: ApplicationRole[] = ['owner', 'admin', 'editor']

    // Helper to get application with schema name
    // If application.schemaName is not set, try to find it via Connector → ConnectorPublication → Publication chain
    const getApplicationWithSchema = async (
        req: Request,
        res: Response,
        applicationId: string
    ): Promise<{ application: Application; schemaName: string } | Response> => {
        const ds = getDataSource()
        const applicationRepo = ds.getRepository(Application)
        const application = await applicationRepo.findOneBy({ id: applicationId })

        if (!application) {
            return res.status(404).json({ error: 'Application not found' })
        }

        // If application has schemaName, use it
        if (application.schemaName) {
            return { application, schemaName: application.schemaName }
        }

        // Otherwise, try to find schemaName via Connector → ConnectorPublication → Publication
        const connectorRepo = ds.getRepository(Connector)
        const connectorPublicationRepo = ds.getRepository(ConnectorPublication)
        const publicationRepo = ds.getRepository(Publication)

        // Find connectors for this application – must be exactly one
        const connectors = await connectorRepo.find({ where: { applicationId } })
        if (connectors.length === 0) {
            return res.status(400).json({ error: 'Application has no connectors configured' })
        }
        if (connectors.length > 1) {
            return res
                .status(400)
                .json({ error: 'Application has multiple connectors; schemaName must be set explicitly on the application' })
        }
        const connector = connectors[0]

        // Find linked publications – must be exactly one
        const connectorPublications = await connectorPublicationRepo.find({ where: { connectorId: connector.id } })
        if (connectorPublications.length === 0) {
            return res.status(400).json({ error: 'Connector has no publication linked' })
        }
        if (connectorPublications.length > 1) {
            return res
                .status(400)
                .json({ error: 'Connector is linked to multiple publications; schemaName must be set explicitly on the application' })
        }
        const connectorPublication = connectorPublications[0]

        // Get publication by ID (direct link now)
        const publication = await publicationRepo.findOneBy({ id: connectorPublication.publicationId })
        if (!publication) {
            return res.status(400).json({ error: 'Linked publication not found' })
        }
        if (!publication.schemaName) {
            return res.status(400).json({ error: 'Publication does not have a schema configured' })
        }

        return { application, schemaName: publication.schemaName }
    }

    const ensureAdminAccess = async (req: Request, res: Response, applicationId: string): Promise<boolean> => {
        const user = req.user as { id?: string; sub?: string } | undefined
        const userId = user?.id ?? user?.sub
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' })
            return false
        }

        try {
            await ensureApplicationAccess(getDataSource(), userId, applicationId, ADMIN_ROLES)
            return true
        } catch (error) {
            const status = (error as { status?: number; statusCode?: number }).statusCode ?? (error as { status?: number }).status
            if (status === 403) {
                res.status(403).json({ error: 'Access denied' })
                return false
            }
            throw error
        }
    }

    /** Ensures the requesting user is any member of the application (any role). */
    const ensureMemberAccess = async (req: Request, res: Response, applicationId: string): Promise<boolean> => {
        const user = req.user as { id?: string; sub?: string } | undefined
        const userId = user?.id ?? user?.sub
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' })
            return false
        }

        try {
            await ensureApplicationAccess(getDataSource(), userId, applicationId)
            return true
        } catch (error) {
            const status = (error as { status?: number; statusCode?: number }).statusCode ?? (error as { status?: number }).status
            if (status === 403) {
                res.status(403).json({ error: 'Access denied' })
                return false
            }
            throw error
        }
    }

    // ═════════════════════════════════════════════════════════════════════
    // GET /application/:applicationId/migrations/status
    // Migration status for ApplicationMigrationGuard
    // ═════════════════════════════════════════════════════════════════════

    router.get(
        '/application/:applicationId/migrations/status',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { applicationId } = req.params
            const hasAccess = await ensureMemberAccess(req, res, applicationId)
            if (!hasAccess) return

            const ds = getDataSource()
            const applicationRepo = ds.getRepository(Application)
            const app = await applicationRepo.findOneBy({ id: applicationId })
            if (!app) {
                return res.status(404).json({ error: 'Application not found' })
            }

            // Determine requesting user's role in this application
            const user = req.user as { id?: string; sub?: string } | undefined
            const userId = user?.id ?? user?.sub
            let currentUserRole: ApplicationRole | undefined
            if (userId) {
                const membership = await ds.getRepository(ApplicationUser).findOne({
                    where: { applicationId, userId }
                })
                if (membership) {
                    currentUserRole = (membership.role || 'member') as ApplicationRole
                }
            }

            const isMaintenance = app.schemaStatus === ApplicationSchemaStatus.MAINTENANCE

            const currentVersion = app.appStructureVersion ?? 0
            const targetVersion = TARGET_APP_STRUCTURE_VERSION
            const structureUpgradeRequired = currentVersion < targetVersion

            // Check if publication has been updated since last sync
            let publicationUpdateAvailable = false
            try {
                const connectorRepo = ds.getRepository(Connector)
                const connectorPubRepo = ds.getRepository(ConnectorPublication)
                const publicationRepo = ds.getRepository(Publication)

                const connector = await connectorRepo.findOne({ where: { applicationId } })
                if (connector) {
                    const connectorPub = await connectorPubRepo.findOne({ where: { connectorId: connector.id } })
                    if (connectorPub) {
                        const publication = await publicationRepo.findOneBy({ id: connectorPub.publicationId })
                        if (publication?.activeVersionId) {
                            publicationUpdateAvailable = app.lastSyncedPublicationVersionId !== publication.activeVersionId
                        }
                    }
                }
            } catch {
                // Non-critical: if we can't check, default to false
            }

            const blockers: StructuredBlocker[] = []
            const schemaExists = Boolean(app.schemaName)

            if (!schemaExists) {
                blockers.push({
                    code: 'schema_not_created',
                    params: {},
                    message: 'Application schema has not been created yet'
                })
            }

            const migrationRequired = structureUpgradeRequired || publicationUpdateAvailable || !schemaExists

            const severity = determineSeverity({
                migrationRequired,
                isMandatory: !schemaExists || structureUpgradeRequired
            })

            const response: ApplicationMigrationStatusResponse = {
                applicationId,
                schemaName: app.schemaName ?? null,
                schemaExists,
                currentAppStructureVersion: currentVersion,
                targetAppStructureVersion: targetVersion,
                structureUpgradeRequired,
                publicationUpdateAvailable,
                migrationRequired,
                severity,
                blockers,
                currentUserRole,
                isMaintenance,
                status: blockers.length > 0 ? 'blocked' : migrationRequired ? 'requires_migration' : 'up_to_date',
                code: blockers.length > 0 ? 'MIGRATION_BLOCKED' : migrationRequired ? 'MIGRATION_REQUIRED' : 'UP_TO_DATE'
            }

            return res.json(response)
        })
    )

    // ═══════════════════════════════════════════════════════════════════════
    // GET /application/:applicationId/migrations
    // List all migrations for an application
    // ═══════════════════════════════════════════════════════════════════════

    router.get(
        '/application/:applicationId/migrations',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { applicationId } = req.params
            const hasAccess = await ensureAdminAccess(req, res, applicationId)
            if (!hasAccess) return

            const queryParsed = listMigrationsQuerySchema.safeParse(req.query)
            if (!queryParsed.success) {
                return res.status(400).json({
                    error: 'Invalid query parameters',
                    details: queryParsed.error.flatten()
                })
            }

            const { limit, offset } = queryParsed.data

            const result = await getApplicationWithSchema(req, res, applicationId)
            if (!result || 'statusCode' in result) return
            const { schemaName } = result

            const { migrations, total } = await migrationManager.listMigrations(schemaName, { limit, offset })

            // Transform for API response (omit large snapshots for list view)
            const items = migrations.map((m) => ({
                id: m.id,
                name: m.name,
                appliedAt: m.appliedAt.toISOString(),
                hasDestructive: m.meta.hasDestructive,
                summary: m.meta.summary,
                changesCount: m.meta.changes?.length ?? 0,
                hasSeedWarnings: Array.isArray(m.meta.seedWarnings) && m.meta.seedWarnings.length > 0
            }))

            return res.json({
                items,
                total,
                limit,
                offset
            })
        })
    )

    // ═══════════════════════════════════════════════════════════════════════
    // GET /application/:applicationId/migration/:migrationId
    // Get a single migration with full details
    // ═══════════════════════════════════════════════════════════════════════

    router.get(
        '/application/:applicationId/migration/:migrationId',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { applicationId, migrationId } = req.params
            const hasAccess = await ensureAdminAccess(req, res, applicationId)
            if (!hasAccess) return

            const result = await getApplicationWithSchema(req, res, applicationId)
            if (!result || 'statusCode' in result) return
            const { schemaName } = result

            const migration = await migrationManager.getMigration(schemaName, migrationId)

            if (!migration) {
                return res.status(404).json({ error: 'Migration not found' })
            }

            return res.json({
                id: migration.id,
                name: migration.name,
                appliedAt: migration.appliedAt.toISOString(),
                hasDestructive: migration.meta.hasDestructive,
                summary: migration.meta.summary,
                changes: migration.meta.changes,
                // Include snapshots for detailed view
                snapshotBefore: migration.meta.snapshotBefore,
                snapshotAfter: migration.meta.snapshotAfter,
                publicationSnapshot: migration.publicationSnapshot,
                publicationSnapshotHash: migration.meta.publicationSnapshotHash,
                publicationId: migration.meta.publicationId,
                publicationVersionId: migration.meta.publicationVersionId,
                seedWarnings: migration.meta.seedWarnings
            })
        })
    )

    // ═══════════════════════════════════════════════════════════════════════
    // GET /application/:applicationId/migration/:migrationId/analyze
    // Analyze if rollback to this migration is possible
    // ═══════════════════════════════════════════════════════════════════════

    router.get(
        '/application/:applicationId/migration/:migrationId/analyze',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { applicationId, migrationId } = req.params
            const hasAccess = await ensureAdminAccess(req, res, applicationId)
            if (!hasAccess) return

            const result = await getApplicationWithSchema(req, res, applicationId)
            if (!result || 'statusCode' in result) return
            const { schemaName } = result

            const migration = await migrationManager.getMigration(schemaName, migrationId)

            if (!migration) {
                return res.status(404).json({ error: 'Migration not found' })
            }

            const analysis = await migrationManager.analyzeRollbackPath(schemaName, migrationId)

            return res.json({
                migrationId,
                migrationName: migration.name,
                canRollback: analysis.canRollback,
                blockers: analysis.blockers,
                warnings: analysis.warnings,
                rollbackChanges: analysis.rollbackChanges.map((c) => c.description)
            })
        })
    )

    // ═══════════════════════════════════════════════════════════════════════
    // POST /application/:applicationId/migration/:migrationId/rollback
    // Rollback to a specific migration (apply inverse changes)
    // ═══════════════════════════════════════════════════════════════════════

    router.post(
        '/application/:applicationId/migration/:migrationId/rollback',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { applicationId, migrationId } = req.params
            const hasAccess = await ensureAdminAccess(req, res, applicationId)
            if (!hasAccess) return

            const parsed = rollbackSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: parsed.error.flatten()
                })
            }

            const { confirmDestructive } = parsed.data

            const result = await getApplicationWithSchema(req, res, applicationId)
            if (!result || 'statusCode' in result) return
            const { schemaName } = result

            // Get target migration
            const targetMigration = await migrationManager.getMigration(schemaName, migrationId)
            if (!targetMigration) {
                return res.status(404).json({ error: 'Migration not found' })
            }

            // Analyze rollback possibility
            const analysis = await migrationManager.analyzeRollbackPath(schemaName, migrationId)

            if (!analysis.canRollback) {
                return res.status(400).json({
                    error: 'Cannot rollback to this migration',
                    blockers: analysis.blockers
                })
            }

            // Check if user confirmed destructive changes
            if (analysis.warnings.length > 0 && !confirmDestructive) {
                return res.json({
                    status: 'pending_confirmation',
                    message: 'Rollback requires confirmation due to data loss',
                    warnings: analysis.warnings,
                    rollbackChanges: analysis.rollbackChanges.map((c) => c.description)
                })
            }

            // Acquire advisory lock
            const lockKey = uuidToLockKey(`application-migration-rollback:${schemaName}`)
            const lockAcquired = await acquireAdvisoryLock(KnexClient.getInstance(), lockKey)

            if (!lockAcquired) {
                return res.status(409).json({
                    error: 'Could not acquire lock. Another migration may be in progress.'
                })
            }

            try {
                const knex = KnexClient.getInstance()

                // Get all migrations to rollback
                const { migrations } = await migrationManager.listMigrations(schemaName, { limit: 1000 })
                const targetAppliedAt = targetMigration.appliedAt.getTime()
                const migrationsToRollback = migrations
                    .filter((m) => m.appliedAt.getTime() > targetAppliedAt)
                    .sort((a, b) => b.appliedAt.getTime() - a.appliedAt.getTime()) // newest first

                let changesApplied = 0

                await knex.transaction(async (trx) => {
                    // Apply rollback changes for each migration in reverse order
                    for (const migration of migrationsToRollback) {
                        for (const change of migration.meta.changes ?? []) {
                            await applyRollbackChange(schemaName, change, trx)
                            changesApplied++
                        }

                        // Delete migration record
                        await migrationManager.deleteMigration(schemaName, migration.id, trx)
                    }

                    // Sync system metadata with target state
                    if (targetMigration.meta.snapshotAfter) {
                        // Rebuild entities from snapshot for metadata sync
                        const entities = snapshotToEntities(targetMigration.meta.snapshotAfter)
                        await generator.syncSystemMetadata(schemaName, entities, {
                            trx,
                            removeMissing: true
                        })
                    }
                })

                // Update application schema status (if application has schemaName)
                const ds = getDataSource()
                const applicationRepo = ds.getRepository(Application)
                const app = await applicationRepo.findOneBy({ id: applicationId })
                if (app && app.schemaName) {
                    app.schemaSnapshot = targetMigration.meta.snapshotAfter as unknown as Record<string, unknown>
                    app.schemaSyncedAt = new Date()
                    await applicationRepo.save(app)
                }

                return res.json({
                    status: 'rolled_back',
                    message: `Successfully rolled back ${migrationsToRollback.length} migration(s)`,
                    changesApplied,
                    rolledBackMigrations: migrationsToRollback.map((m) => m.name),
                    currentMigration: targetMigration.name
                })
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                console.error('[ApplicationMigrationsRoutes] Rollback failed:', message)

                return res.status(500).json({
                    error: 'Rollback failed',
                    message
                })
            } finally {
                await releaseAdvisoryLock(KnexClient.getInstance(), lockKey)
            }
        })
    )

    return router
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Apply a rollback change (inverse of original change)
 */
async function applyRollbackChange(schemaName: string, change: MigrationChangeRecord, trx: import('knex').Knex.Transaction): Promise<void> {
    console.log(`[ApplicationMigrationsRoutes] Rollback: ${change.description}`)

    switch (change.type) {
        case ChangeType.ADD_TABLE:
            // Inverse: drop the table
            if (change.tableName) {
                await trx.schema.withSchema(schemaName).dropTableIfExists(change.tableName)
            }
            break

        case ChangeType.ADD_COLUMN:
            // Inverse: drop the column
            if (change.tableName && change.columnName) {
                await trx.schema.withSchema(schemaName).alterTable(change.tableName, (table) => {
                    table.dropColumn(change.columnName!)
                })
            }
            break

        case ChangeType.ALTER_COLUMN:
            // For nullable changes, we can reverse
            // Note: type changes cannot be safely reversed
            console.warn(`[ApplicationMigrationsRoutes] ALTER_COLUMN rollback skipped: ${change.description}`)
            break

        case ChangeType.ADD_FK:
            // Inverse: drop FK constraint
            if (change.tableName && change.columnName) {
                const constraintName = buildFkConstraintName(change.tableName, change.columnName)
                await trx.raw(`ALTER TABLE ??.?? DROP CONSTRAINT IF EXISTS ??`, [schemaName, change.tableName, constraintName])
            }
            break

        case ChangeType.DROP_TABLE:
        case ChangeType.DROP_COLUMN:
        case ChangeType.DROP_FK:
            // Cannot rollback DROP operations - data is lost
            console.warn(`[ApplicationMigrationsRoutes] Cannot rollback ${change.type}: ${change.description}`)
            break

        default:
            console.warn(`[ApplicationMigrationsRoutes] Unknown change type: ${change.type}`)
    }
}

/**
 * Convert snapshot to entity definitions for metadata sync
 * This is a simplified conversion for rollback purposes
 */
function snapshotToEntities(snapshot: SchemaSnapshot): import('@universo/schema-ddl').EntityDefinition[] {
    const entities: import('@universo/schema-ddl').EntityDefinition[] = []
    const now = new Date().toISOString()

    // Create empty presentation structure that matches MetaPresentation
    const createEmptyPresentation = (codename: string): import('@universo/types').MetaPresentation => ({
        name: {
            _schema: '1' as const,
            _primary: 'en',
            locales: {
                en: {
                    content: codename,
                    version: 1,
                    isActive: true,
                    createdAt: now,
                    updatedAt: now
                }
            }
        }
    })

    for (const [entityId, entity] of Object.entries(snapshot.entities)) {
        const fields: import('@universo/schema-ddl').FieldDefinition[] = []

        for (const [fieldId, field] of Object.entries(entity.fields)) {
            fields.push({
                id: fieldId,
                codename: field.codename,
                dataType: field.dataType,
                isRequired: field.isRequired,
                isDisplayAttribute: field.isDisplayAttribute ?? false,
                targetEntityId: field.targetEntityId ?? undefined,
                targetEntityKind: field.targetEntityKind ?? undefined,
                presentation: createEmptyPresentation(field.codename)
            })
        }

        entities.push({
            id: entityId,
            kind: entity.kind,
            codename: entity.codename,
            fields,
            presentation: createEmptyPresentation(entity.codename)
        })
    }

    return entities
}
