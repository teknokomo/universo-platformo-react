import type { Knex } from 'knex'
import { ChangeType } from './diff'
import type { SchemaChange, SchemaDiff } from './diff'
import type { MigrationMeta, MigrationRecord, MigrationChangeRecord, RollbackAnalysis, SchemaSnapshot } from './types'

/**
 * Generate migration name from description
 * Format: YYYYMMDD_HHMMSS_<description>
 * 
 * Exported as standalone function for use without MigrationManager instance.
 */
export function generateMigrationName(description: string): string {
    const now = new Date()
    const date = now.toISOString().slice(0, 10).replace(/-/g, '')
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '')
    const sanitized = description
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 50)
    return `${date}_${time}_${sanitized}`
}

/**
 * MigrationManager - Handles migration history recording, listing, and rollback analysis.
 *
 * Migration name format: YYYYMMDD_HHMMSS_<description>
 * Example: 20260117_143022_add_products_table
 *
 * Each migration stores:
 * - snapshotBefore: Schema state before migration
 * - snapshotAfter: Schema state after migration
 * - changes: List of applied changes
 * - hasDestructive: Whether migration contains DROP operations
 * 
 * Uses Dependency Injection pattern: receives Knex instance via constructor.
 */
export class MigrationManager {
    private knex: Knex

    constructor(knex: Knex) {
        this.knex = knex
    }

    /**
     * Convert SchemaChange array to MigrationChangeRecord array
     */
    private static toChangeRecords(changes: SchemaChange[]): MigrationChangeRecord[] {
        return changes.map((change) => ({
            type: change.type,
            entityCodename: change.entityCodename,
            fieldCodename: change.fieldCodename,
            tableName: change.tableName,
            columnName: change.columnName,
            isDestructive: change.isDestructive,
            description: change.description
        }))
    }

    /**
     * Record a migration after it has been applied
     */
    public async recordMigration(
        schemaName: string,
        name: string,
        snapshotBefore: SchemaSnapshot | null,
        snapshotAfter: SchemaSnapshot,
        diff: SchemaDiff,
        trx?: Knex.Transaction,
        extraMeta?: Pick<
            MigrationMeta,
            'publicationSnapshotHash' | 'publicationId' | 'publicationVersionId'
        >,
        publicationSnapshot?: Record<string, unknown> | null,
        userId?: string | null
    ): Promise<string> {
        const knex = trx ?? this.knex

        const allChanges = [...diff.destructive, ...diff.additive]
        const changeRecords = MigrationManager.toChangeRecords(allChanges)

        const meta: MigrationMeta = {
            snapshotBefore,
            snapshotAfter,
            changes: changeRecords,
            hasDestructive: diff.destructive.length > 0,
            summary: diff.summary,
            ...extraMeta
        }

        const result = await knex
            .withSchema(schemaName)
            .table('_app_migrations')
            .insert({
                name,
                meta: JSON.stringify(meta),
                publication_snapshot: publicationSnapshot ? JSON.stringify(publicationSnapshot) : null,
                _upl_created_by: userId ?? null,
                _upl_updated_by: userId ?? null,
            })
            .returning('id')

        const migrationId = result[0]?.id ?? result[0]
        console.log(`[MigrationManager] Recorded migration: ${name} (id: ${migrationId})`)

        return migrationId
    }

    /**
     * List all migrations for a schema, ordered by applied_at DESC
     */
    public async listMigrations(
        schemaName: string,
        options?: { limit?: number; offset?: number }
    ): Promise<{ migrations: MigrationRecord[]; total: number }> {
        const { limit = 50, offset = 0 } = options ?? {}

        // Check if schema exists
        const schemaExists = await this.knex.raw<{ rows: { exists: boolean }[] }>(
            `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = ?)`,
            [schemaName]
        )
        if (!schemaExists.rows[0]?.exists) {
            return { migrations: [], total: 0 }
        }

        // Check if _app_migrations table exists
        const tableExists = await this.knex.schema.withSchema(schemaName).hasTable('_app_migrations')
        if (!tableExists) {
            return { migrations: [], total: 0 }
        }

        // Get total count
        const countResult = await this.knex.withSchema(schemaName).table('_app_migrations').count('* as count').first()
        const total = Number(countResult?.count ?? 0)

        // Get migrations
        const rows = await this.knex
            .withSchema(schemaName)
            .table('_app_migrations')
            .select('id', 'name', 'applied_at', 'meta', 'publication_snapshot')
            .orderBy('applied_at', 'desc')
            .limit(limit)
            .offset(offset)

        const migrations: MigrationRecord[] = rows.map((row) => ({
            id: row.id,
            name: row.name,
            appliedAt: new Date(row.applied_at),
            meta: typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta,
            publicationSnapshot:
                typeof row.publication_snapshot === 'string'
                    ? JSON.parse(row.publication_snapshot)
                    : row.publication_snapshot ?? null
        }))

        return { migrations, total }
    }

    /**
     * Get a single migration by ID
     */
    public async getMigration(schemaName: string, migrationId: string): Promise<MigrationRecord | null> {
        const tableExists = await this.knex.schema.withSchema(schemaName).hasTable('_app_migrations')
        if (!tableExists) {
            return null
        }

        const row = await this.knex
            .withSchema(schemaName)
            .table('_app_migrations')
            .where('id', migrationId)
            .first()

        if (!row) {
            return null
        }

        return {
            id: row.id,
            name: row.name,
            appliedAt: new Date(row.applied_at),
            meta: typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta,
            publicationSnapshot:
                typeof row.publication_snapshot === 'string'
                    ? JSON.parse(row.publication_snapshot)
                    : row.publication_snapshot ?? null
        }
    }

    /**
     * Analyze if rollback to a specific migration is safe
     *
     * Rollback is blocked if any migration in the rollback path contains:
     * - DROP_TABLE
     * - DROP_COLUMN
     * - Destructive ALTER_COLUMN (type change that loses data)
     */
    public async analyzeRollbackPath(schemaName: string, targetMigrationId: string): Promise<RollbackAnalysis> {
        const result: RollbackAnalysis = {
            canRollback: true,
            blockers: [],
            warnings: [],
            rollbackChanges: []
        }

        // Get target migration
        const targetMigration = await this.getMigration(schemaName, targetMigrationId)
        if (!targetMigration) {
            return {
                canRollback: false,
                blockers: ['Target migration not found'],
                warnings: [],
                rollbackChanges: []
            }
        }

        // Get all migrations applied after the target
        const { migrations: allMigrations } = await this.listMigrations(schemaName, { limit: 1000 })

        // Find migrations to rollback (those applied after target)
        const targetAppliedAt = targetMigration.appliedAt.getTime()
        const migrationsToRollback = allMigrations.filter((m) => m.appliedAt.getTime() > targetAppliedAt)

        if (migrationsToRollback.length === 0) {
            return {
                canRollback: false,
                blockers: ['No migrations to rollback - target is the latest migration'],
                warnings: [],
                rollbackChanges: []
            }
        }

        // Check each migration for destructive changes
        const destructiveTypes = new Set([ChangeType.DROP_TABLE, ChangeType.DROP_COLUMN])

        for (const migration of migrationsToRollback) {
            const changes = migration.meta.changes ?? []

            for (const change of changes) {
                // Check for DROP operations
                if (destructiveTypes.has(change.type as ChangeType)) {
                    result.canRollback = false
                    result.blockers.push(`Migration "${migration.name}" contains ${change.type}: ${change.description}`)
                }

                // Check for destructive ALTER_COLUMN
                if (change.type === ChangeType.ALTER_COLUMN && change.isDestructive) {
                    result.canRollback = false
                    result.blockers.push(`Migration "${migration.name}" contains destructive column alteration: ${change.description}`)
                }

                // Collect inverse changes for rollback
                const inverseChange = this.getInverseChange(change)
                if (inverseChange) {
                    result.rollbackChanges.push(inverseChange)
                }
            }

            // Warnings for ADD operations (data will be lost)
            if (migration.meta.changes?.some((c) => c.type === ChangeType.ADD_TABLE)) {
                result.warnings.push(`Rolling back "${migration.name}" will drop tables and lose all data in them`)
            }
        }

        return result
    }

    /**
     * Get the inverse change for rollback purposes
     */
    private getInverseChange(change: MigrationChangeRecord): MigrationChangeRecord | null {
        switch (change.type) {
            case ChangeType.ADD_TABLE:
                return {
                    ...change,
                    type: ChangeType.DROP_TABLE,
                    isDestructive: true,
                    description: `Drop table "${change.entityCodename}"`
                }
            case ChangeType.ADD_COLUMN:
                return {
                    ...change,
                    type: ChangeType.DROP_COLUMN,
                    isDestructive: true,
                    description: `Drop column "${change.columnName}" from "${change.tableName}"`
                }
            case ChangeType.DROP_TABLE:
            case ChangeType.DROP_COLUMN:
                // Cannot inverse DROP operations - data is lost
                return null
            case ChangeType.ALTER_COLUMN:
                // For nullable changes, can inverse
                return {
                    ...change,
                    isDestructive: false,
                    description: `Revert column "${change.columnName}" in "${change.tableName}"`
                }
            default:
                return null
        }
    }

    /**
     * Delete migration record (used after successful rollback)
     */
    public async deleteMigration(schemaName: string, migrationId: string, trx?: Knex.Transaction): Promise<void> {
        const knex = trx ?? this.knex
        await knex.withSchema(schemaName).table('_app_migrations').where('id', migrationId).del()
        console.log(`[MigrationManager] Deleted migration record: ${migrationId}`)
    }

    /**
     * Get the latest migration for a schema
     */
    public async getLatestMigration(schemaName: string): Promise<MigrationRecord | null> {
        const { migrations } = await this.listMigrations(schemaName, { limit: 1 })
        return migrations[0] ?? null
    }
}

export default MigrationManager
