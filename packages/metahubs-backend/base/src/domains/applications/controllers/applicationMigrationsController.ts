import type { Request, Response } from 'express'
import { z } from 'zod'
import type { DbExecutor } from '@universo/utils'
import { ensureApplicationAccess, type ApplicationRole } from '@universo/applications-backend'
import { resolveUserId } from '../../shared/routeAuth'
import { createLogger } from '../../../utils/logger'
import { ApplicationSchemaStatus, type ApplicationMigrationStatusResponse, type StructuredBlocker } from '@universo/types'
import { determineSeverity } from '@universo/migration-guard-shared/utils'
import {
    findApplicationById,
    updateApplicationFields,
    findApplicationUser,
    findConnectorsByApplicationId,
    findFirstConnectorByApplicationId,
    findFirstConnectorPublication,
    findConnectorPublications
} from '../../../persistence'
import type { AppRow } from '../../../persistence'
import { findPublicationById } from '../../../persistence'
import {
    getDDLServices,
    ChangeType,
    buildFkConstraintName,
    uuidToLockKey,
    acquirePoolAdvisoryLock,
    releasePoolAdvisoryLock,
    poolKnexTransaction
} from '../../ddl'
import type { MigrationChangeRecord, SchemaSnapshot } from '../../ddl'
import { TARGET_APP_STRUCTURE_VERSION } from '../constants'

const log = createLogger('ApplicationMigrations')

/** Upper limit for fetching all migrations during rollback analysis */
const MAX_ROLLBACK_FETCH_LIMIT = 1000

// ═══════════════════════════════════════════════════════════════════════════
// Validation Schemas
// ═══════════════════════════════════════════════════════════════════════════

const listMigrationsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0)
})

const rollbackSchema = z
    .object({
        confirmDestructive: z.boolean().optional().default(false)
    })
    .strict()

// ═══════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════

const ADMIN_ROLES: ApplicationRole[] = ['owner', 'admin', 'editor']

type ResolutionError = { error: string; status: number; code: string }

async function resolveApplicationSchema(
    getDbExecutor: () => DbExecutor,
    applicationId: string
): Promise<{ application: AppRow; schemaName: string } | ResolutionError> {
    const exec = getDbExecutor()
    const application = await findApplicationById(exec, applicationId)

    if (!application) {
        return { error: 'Application not found', status: 404, code: 'NOT_FOUND' }
    }

    if (application.schemaName) {
        return { application, schemaName: application.schemaName }
    }

    const connectors = await findConnectorsByApplicationId(exec, applicationId)
    if (connectors.length === 0) {
        return { error: 'Application has no connectors configured', status: 400, code: 'NO_CONNECTORS' }
    }
    if (connectors.length > 1) {
        return {
            error: 'Application has multiple connectors; schemaName must be set explicitly on the application',
            status: 400,
            code: 'MULTIPLE_CONNECTORS'
        }
    }
    const connector = connectors[0]

    const connectorPublications = await findConnectorPublications(exec, connector.id)
    if (connectorPublications.length === 0) {
        return { error: 'Connector has no publication linked', status: 400, code: 'NO_PUBLICATION' }
    }
    if (connectorPublications.length > 1) {
        return {
            error: 'Connector is linked to multiple publications; schemaName must be set explicitly on the application',
            status: 400,
            code: 'MULTIPLE_PUBLICATIONS'
        }
    }
    const connectorPublication = connectorPublications[0]

    const publication = await findPublicationById(exec, connectorPublication.publicationId)
    if (!publication) {
        return { error: 'Linked publication not found', status: 400, code: 'PUBLICATION_NOT_FOUND' }
    }
    if (!publication.schemaName) {
        return { error: 'Publication does not have a schema configured', status: 400, code: 'NO_SCHEMA' }
    }

    return { application, schemaName: publication.schemaName }
}

async function ensureRoleAccess(
    getDbExecutor: () => DbExecutor,
    req: Request,
    roles?: ApplicationRole[]
): Promise<{ userId: string } | ResolutionError> {
    const userId = resolveUserId(req)
    if (!userId) {
        return { error: 'Unauthorized', status: 401, code: 'UNAUTHORIZED' }
    }

    const applicationId = req.params.applicationId
    try {
        await ensureApplicationAccess(getDbExecutor(), userId, applicationId, roles)
        return { userId }
    } catch (error) {
        const status = (error as { status?: number; statusCode?: number }).statusCode ?? (error as { status?: number }).status
        if (status === 403) {
            return { error: 'Access denied', status: 403, code: 'ACCESS_DENIED' }
        }
        throw error
    }
}

function isResolutionError(result: unknown): result is ResolutionError {
    return typeof result === 'object' && result !== null && 'error' in result && 'status' in result
}

// ═══════════════════════════════════════════════════════════════════════════
// Controller factory
// ═══════════════════════════════════════════════════════════════════════════

export function createApplicationMigrationsController(getDbExecutor: () => DbExecutor) {
    const { generator, migrationManager } = getDDLServices()

    const status = async (req: Request, res: Response): Promise<void> => {
        const { applicationId } = req.params
        const accessResult = await ensureRoleAccess(getDbExecutor, req)
        if (isResolutionError(accessResult)) {
            res.status(accessResult.status).json({ error: accessResult.error, code: accessResult.code })
            return
        }

        const exec = getDbExecutor()
        const app = await findApplicationById(exec, applicationId)
        if (!app) {
            res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' })
            return
        }

        const { userId } = accessResult
        let currentUserRole: ApplicationRole | undefined
        const membership = await findApplicationUser(exec, applicationId, userId)
        if (membership) {
            currentUserRole = (membership.role || 'member') as ApplicationRole
        }

        const isMaintenance = app.schemaStatus === ApplicationSchemaStatus.MAINTENANCE

        const currentVersion = app.appStructureVersion ?? 0
        const targetVersion = TARGET_APP_STRUCTURE_VERSION
        const structureUpgradeRequired = currentVersion < targetVersion

        let publicationUpdateAvailable = false
        try {
            const connector = await findFirstConnectorByApplicationId(exec, applicationId)
            if (connector) {
                const connectorPub = await findFirstConnectorPublication(exec, connector.id)
                if (connectorPub) {
                    const publication = await findPublicationById(exec, connectorPub.publicationId)
                    if (publication?.activeVersionId) {
                        publicationUpdateAvailable = app.lastSyncedPublicationVersionId !== publication.activeVersionId
                    }
                }
            }
        } catch {
            // Non-critical: if we can't check, default to false
        }

        const blockers: StructuredBlocker[] = []
        const schemaExists = app.schemaName ? await generator.schemaExists(app.schemaName) : false

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

        res.json(response)
    }

    const list = async (req: Request, res: Response): Promise<void> => {
        const { applicationId } = req.params
        const accessResult = await ensureRoleAccess(getDbExecutor, req, ADMIN_ROLES)
        if (isResolutionError(accessResult)) {
            res.status(accessResult.status).json({ error: accessResult.error, code: accessResult.code })
            return
        }

        const queryParsed = listMigrationsQuerySchema.safeParse(req.query)
        if (!queryParsed.success) {
            res.status(400).json({
                error: 'Invalid query parameters',
                code: 'VALIDATION_ERROR',
                details: queryParsed.error.flatten()
            })
            return
        }

        const { limit, offset } = queryParsed.data

        const schemaResult = await resolveApplicationSchema(getDbExecutor, applicationId)
        if (isResolutionError(schemaResult)) {
            res.status(schemaResult.status).json({ error: schemaResult.error, code: schemaResult.code })
            return
        }
        const { schemaName } = schemaResult

        const { migrations, total } = await migrationManager.listMigrations(schemaName, { limit, offset })

        const items = migrations.map((m: import('../../ddl').MigrationRecord) => ({
            id: m.id,
            name: m.name,
            appliedAt: m.appliedAt.toISOString(),
            hasDestructive: m.meta.hasDestructive,
            summary: m.meta.summary,
            changesCount: m.meta.changes?.length ?? 0,
            hasSeedWarnings: Array.isArray(m.meta.seedWarnings) && m.meta.seedWarnings.length > 0
        }))

        res.json({ items, total, limit, offset })
    }

    const get = async (req: Request, res: Response): Promise<void> => {
        const { applicationId, migrationId } = req.params
        const accessResult = await ensureRoleAccess(getDbExecutor, req, ADMIN_ROLES)
        if (isResolutionError(accessResult)) {
            res.status(accessResult.status).json({ error: accessResult.error, code: accessResult.code })
            return
        }

        const schemaResult = await resolveApplicationSchema(getDbExecutor, applicationId)
        if (isResolutionError(schemaResult)) {
            res.status(schemaResult.status).json({ error: schemaResult.error, code: schemaResult.code })
            return
        }
        const { schemaName } = schemaResult

        const migration = await migrationManager.getMigration(schemaName, migrationId)
        if (!migration) {
            res.status(404).json({ error: 'Migration not found', code: 'NOT_FOUND' })
            return
        }

        res.json({
            id: migration.id,
            name: migration.name,
            appliedAt: migration.appliedAt.toISOString(),
            hasDestructive: migration.meta.hasDestructive,
            summary: migration.meta.summary,
            changes: migration.meta.changes,
            snapshotBefore: migration.meta.snapshotBefore,
            snapshotAfter: migration.meta.snapshotAfter,
            publicationSnapshot: migration.publicationSnapshot,
            publicationSnapshotHash: migration.meta.publicationSnapshotHash,
            publicationId: migration.meta.publicationId,
            publicationVersionId: migration.meta.publicationVersionId,
            seedWarnings: migration.meta.seedWarnings
        })
    }

    const analyze = async (req: Request, res: Response): Promise<void> => {
        const { applicationId, migrationId } = req.params
        const accessResult = await ensureRoleAccess(getDbExecutor, req, ADMIN_ROLES)
        if (isResolutionError(accessResult)) {
            res.status(accessResult.status).json({ error: accessResult.error, code: accessResult.code })
            return
        }

        const schemaResult = await resolveApplicationSchema(getDbExecutor, applicationId)
        if (isResolutionError(schemaResult)) {
            res.status(schemaResult.status).json({ error: schemaResult.error, code: schemaResult.code })
            return
        }
        const { schemaName } = schemaResult

        const migration = await migrationManager.getMigration(schemaName, migrationId)
        if (!migration) {
            res.status(404).json({ error: 'Migration not found', code: 'NOT_FOUND' })
            return
        }

        const analysis = await migrationManager.analyzeRollbackPath(schemaName, migrationId)

        res.json({
            migrationId,
            migrationName: migration.name,
            canRollback: analysis.canRollback,
            blockers: analysis.blockers,
            warnings: analysis.warnings,
            rollbackChanges: analysis.rollbackChanges.map((c: MigrationChangeRecord) => c.description)
        })
    }

    const rollback = async (req: Request, res: Response): Promise<void> => {
        const { applicationId, migrationId } = req.params
        const accessResult = await ensureRoleAccess(getDbExecutor, req, ADMIN_ROLES)
        if (isResolutionError(accessResult)) {
            res.status(accessResult.status).json({ error: accessResult.error, code: accessResult.code })
            return
        }

        const parsed = rollbackSchema.safeParse(req.body)
        if (!parsed.success) {
            res.status(400).json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() })
            return
        }

        const { confirmDestructive } = parsed.data

        const schemaResult = await resolveApplicationSchema(getDbExecutor, applicationId)
        if (isResolutionError(schemaResult)) {
            res.status(schemaResult.status).json({ error: schemaResult.error, code: schemaResult.code })
            return
        }
        const { schemaName } = schemaResult

        const targetMigration = await migrationManager.getMigration(schemaName, migrationId)
        if (!targetMigration) {
            res.status(404).json({ error: 'Migration not found', code: 'NOT_FOUND' })
            return
        }

        const analysis = await migrationManager.analyzeRollbackPath(schemaName, migrationId)

        if (!analysis.canRollback) {
            res.status(400).json({ error: 'Cannot rollback to this migration', code: 'ROLLBACK_BLOCKED', blockers: analysis.blockers })
            return
        }

        if (analysis.warnings.length > 0 && !confirmDestructive) {
            res.json({
                status: 'pending_confirmation',
                message: 'Rollback requires confirmation due to data loss',
                warnings: analysis.warnings,
                rollbackChanges: analysis.rollbackChanges.map((c: MigrationChangeRecord) => c.description)
            })
            return
        }

        const lockKey = uuidToLockKey(`application-migration-rollback:${schemaName}`)
        const lockAcquired = await acquirePoolAdvisoryLock(lockKey)

        if (!lockAcquired) {
            res.status(409).json({ error: 'Could not acquire lock. Another migration may be in progress.', code: 'LOCK_CONFLICT' })
            return
        }

        try {
            const { migrations } = await migrationManager.listMigrations(schemaName, { limit: MAX_ROLLBACK_FETCH_LIMIT })
            const targetAppliedAt = targetMigration.appliedAt.getTime()
            const migrationsToRollback = migrations
                .filter((m: import('../../ddl').MigrationRecord) => m.appliedAt.getTime() > targetAppliedAt)
                .sort(
                    (a: import('../../ddl').MigrationRecord, b: import('../../ddl').MigrationRecord) =>
                        b.appliedAt.getTime() - a.appliedAt.getTime()
                )

            let changesApplied = 0

            await poolKnexTransaction(async (trx) => {
                for (const migration of migrationsToRollback) {
                    for (const change of migration.meta.changes ?? []) {
                        await applyRollbackChange(schemaName, change, trx)
                        changesApplied++
                    }
                    await migrationManager.deleteMigration(schemaName, migration.id, trx)
                }

                if (targetMigration.meta.snapshotAfter) {
                    const entities = snapshotToEntities(targetMigration.meta.snapshotAfter)
                    await generator.syncSystemMetadata(schemaName, entities, { trx, removeMissing: true })
                }
            })

            const exec = getDbExecutor()
            const app = await findApplicationById(exec, applicationId)
            if (app && app.schemaName) {
                await updateApplicationFields(exec, applicationId, {
                    schemaSnapshot: targetMigration.meta.snapshotAfter as unknown as Record<string, unknown>,
                    schemaSyncedAt: new Date()
                })
            }

            res.json({
                status: 'rolled_back',
                message: `Successfully rolled back ${migrationsToRollback.length} migration(s)`,
                changesApplied,
                rolledBackMigrations: migrationsToRollback.map((m: import('../../ddl').MigrationRecord) => m.name),
                currentMigration: targetMigration.name
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            log.error('Rollback failed:', message)
            res.status(500).json({ error: 'Rollback failed', code: 'ROLLBACK_FAILED', message })
        } finally {
            await releasePoolAdvisoryLock(lockKey)
        }
    }

    return { status, list, get, analyze, rollback }
}

// ═══════════════════════════════════════════════════════════════════════════
// Standalone helpers (pure functions, no closure dependencies)
// ═══════════════════════════════════════════════════════════════════════════

async function applyRollbackChange(schemaName: string, change: MigrationChangeRecord, trx: import('knex').Knex.Transaction): Promise<void> {
    log.info(`Rollback: ${change.description}`)

    switch (change.type) {
        case ChangeType.ADD_TABLE:
            if (change.tableName) {
                await trx.schema.withSchema(schemaName).dropTableIfExists(change.tableName)
            }
            break

        case ChangeType.ADD_COLUMN:
            if (change.tableName && change.columnName) {
                await trx.schema.withSchema(schemaName).alterTable(change.tableName, (table) => {
                    table.dropColumn(change.columnName!)
                })
            }
            break

        case ChangeType.ALTER_COLUMN:
            log.warn(`ALTER_COLUMN rollback skipped: ${change.description}`)
            break

        case ChangeType.ADD_FK:
            if (change.tableName && change.columnName) {
                const constraintName = buildFkConstraintName(change.tableName, change.columnName)
                await trx.raw(`ALTER TABLE ??.?? DROP CONSTRAINT IF EXISTS ??`, [schemaName, change.tableName, constraintName])
            }
            break

        case ChangeType.DROP_TABLE:
        case ChangeType.DROP_COLUMN:
        case ChangeType.DROP_FK:
            log.warn(`Cannot rollback ${change.type}: ${change.description}`)
            break

        default:
            log.warn(`Unknown change type: ${change.type}`)
    }
}

function snapshotToEntities(snapshot: SchemaSnapshot): import('@universo/schema-ddl').EntityDefinition[] {
    const entities: import('@universo/schema-ddl').EntityDefinition[] = []
    const now = new Date().toISOString()

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
        const fields: import('@universo/schema-ddl').Component[] = []

        for (const [fieldId, field] of Object.entries(entity.fields)) {
            fields.push({
                id: fieldId,
                codename: field.codename,
                dataType: field.dataType,
                isRequired: field.isRequired,
                isDisplayComponent: field.isDisplayComponent ?? false,
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
