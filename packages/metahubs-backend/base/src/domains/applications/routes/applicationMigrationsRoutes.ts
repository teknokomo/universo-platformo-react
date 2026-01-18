/**
 * Application Migrations Routes for Metahubs Backend
 *
 * These routes handle migration history viewing and rollback operations
 * for Application schemas. The routes are scoped by applicationId and
 * use the DDL module for all schema operations.
 *
 * Endpoints:
 * - GET    /application/:applicationId/migrations           - List migrations
 * - GET    /application/:applicationId/migration/:id        - Get single migration
 * - GET    /application/:applicationId/migration/:id/analyze - Analyze rollback possibility
 * - POST   /application/:applicationId/migration/:id/rollback - Rollback to this migration
 */

import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import { Application } from '@universo/applications-backend'
import { MigrationManager } from '../../ddl/MigrationManager'
import { SchemaGenerator } from '../../ddl/SchemaGenerator'
import { KnexClient } from '../../ddl/KnexClient'
import { ChangeType } from '../../ddl/diff'
import { buildFkConstraintName } from '../../ddl/naming'
import type { MigrationChangeRecord, SchemaSnapshot } from '../../ddl/types'

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

    const migrationManager = new MigrationManager()

    // Helper to get application and verify access
    const getApplicationOrFail = async (req: Request, res: Response, applicationId: string) => {
        const ds = getDataSource()
        const applicationRepo = ds.getRepository(Application)
        const application = await applicationRepo.findOneBy({ id: applicationId })

        if (!application) {
            return res.status(404).json({ error: 'Application not found' })
        }

        if (!application.schemaName) {
            return res.status(400).json({ error: 'Application has no schema configured' })
        }

        return application
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GET /application/:applicationId/migrations
    // List all migrations for an application
    // ═══════════════════════════════════════════════════════════════════════

    router.get(
        '/application/:applicationId/migrations',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { applicationId } = req.params

            const queryParsed = listMigrationsQuerySchema.safeParse(req.query)
            if (!queryParsed.success) {
                return res.status(400).json({
                    error: 'Invalid query parameters',
                    details: queryParsed.error.flatten()
                })
            }

            const { limit, offset } = queryParsed.data

            const application = await getApplicationOrFail(req, res, applicationId)
            if (!application || 'statusCode' in application) return

            const { migrations, total } = await migrationManager.listMigrations(application.schemaName!, { limit, offset })

            // Transform for API response (omit large snapshots for list view)
            const items = migrations.map((m) => ({
                id: m.id,
                name: m.name,
                appliedAt: m.appliedAt.toISOString(),
                hasDestructive: m.meta.hasDestructive,
                summary: m.meta.summary,
                changesCount: m.meta.changes?.length ?? 0
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

            const application = await getApplicationOrFail(req, res, applicationId)
            if (!application || 'statusCode' in application) return

            const migration = await migrationManager.getMigration(application.schemaName!, migrationId)

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
                snapshotAfter: migration.meta.snapshotAfter
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

            const application = await getApplicationOrFail(req, res, applicationId)
            if (!application || 'statusCode' in application) return

            const migration = await migrationManager.getMigration(application.schemaName!, migrationId)

            if (!migration) {
                return res.status(404).json({ error: 'Migration not found' })
            }

            const analysis = await migrationManager.analyzeRollbackPath(application.schemaName!, migrationId)

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

            const parsed = rollbackSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: parsed.error.flatten()
                })
            }

            const { confirmDestructive } = parsed.data

            const application = await getApplicationOrFail(req, res, applicationId)
            if (!application || 'statusCode' in application) return

            const schemaName = application.schemaName!

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
            const lockKey = KnexClient.uuidToLockKey(schemaName)
            const lockAcquired = await KnexClient.acquireAdvisoryLock(lockKey)

            if (!lockAcquired) {
                return res.status(409).json({
                    error: 'Could not acquire lock. Another migration may be in progress.'
                })
            }

            try {
                const knex = KnexClient.getInstance()
                const generator = new SchemaGenerator()

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

                // Update application schema status
                const ds = getDataSource()
                const applicationRepo = ds.getRepository(Application)
                application.schemaSnapshot = targetMigration.meta.snapshotAfter as unknown as Record<string, unknown>
                application.schemaSyncedAt = new Date()
                await applicationRepo.save(application)

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
                await KnexClient.releaseAdvisoryLock(lockKey)
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
function snapshotToEntities(snapshot: SchemaSnapshot): import('../../ddl/types').EntityDefinition[] {
    const entities: import('../../ddl/types').EntityDefinition[] = []
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
        const fields: import('../../ddl/types').FieldDefinition[] = []

        for (const [fieldId, field] of Object.entries(entity.fields)) {
            fields.push({
                id: fieldId,
                codename: field.codename,
                dataType: field.dataType,
                isRequired: field.isRequired,
                targetEntityId: field.targetEntityId ?? undefined,
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
