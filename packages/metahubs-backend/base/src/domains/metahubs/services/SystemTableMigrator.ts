import { randomBytes } from 'crypto'
import type { Knex } from 'knex'
import type { SystemColumnDef, SystemForeignKeyDef, SystemTableDef } from './systemTableDefinitions'
import { SystemTableDDLGenerator } from './SystemTableDDLGenerator'
import { calculateSystemTableDiff, SystemChangeType, type SystemTableDiff } from './systemTableDiff'
import { SYSTEM_TABLE_VERSIONS, buildColumnOnTable, buildIndexSQL } from './systemTableDefinitions'

/**
 * Result of a system table migration.
 */
export interface SystemMigrationResult {
    fromVersion: number
    toVersion: number
    applied: string[]
    skippedDestructive: string[]
    success: boolean
    error?: string
}

/**
 * SystemTableMigrator — applies additive schema changes to a metahub dynamic schema.
 *
 * Only safe (additive) changes are applied automatically:
 * - ADD_TABLE: creates the new table with all columns, indexes, FKs.
 * - ADD_COLUMN: adds a new nullable column to an existing table.
 * - ADD_INDEX: creates a new index.
 * - ADD_FK: adds a new foreign key constraint.
 *
 * Destructive changes (DROP_TABLE, DROP_COLUMN, DROP_INDEX, DROP_FK) are logged
 * but NOT applied. They must be handled manually or via a separate
 * destructive migration command.
 *
 * Migration history is recorded in _mhb_migrations (when available).
 */
export class SystemTableMigrator {
    constructor(private readonly knex: Knex, private readonly schemaName: string) {}

    /**
     * Migrate the schema from `fromVersion` to `toVersion`.
     * Applies all intermediate version diffs (from → from+1, …, to−1 → to).
     *
     * Returns a combined migration result.
     */
    async migrate(fromVersion: number, toVersion: number): Promise<SystemMigrationResult> {
        if (fromVersion >= toVersion) {
            return { fromVersion, toVersion, applied: [], skippedDestructive: [], success: true }
        }

        const allApplied: string[] = []
        const allSkipped: string[] = []

        for (let v = fromVersion; v < toVersion; v++) {
            const oldDefs = SYSTEM_TABLE_VERSIONS.get(v)
            const newDefs = SYSTEM_TABLE_VERSIONS.get(v + 1)

            if (!oldDefs) {
                return {
                    fromVersion,
                    toVersion,
                    applied: allApplied,
                    skippedDestructive: allSkipped,
                    success: false,
                    error: `Missing table definitions for structure version ${v}`
                }
            }
            if (!newDefs) {
                return {
                    fromVersion,
                    toVersion,
                    applied: allApplied,
                    skippedDestructive: allSkipped,
                    success: false,
                    error: `Missing table definitions for structure version ${v + 1}`
                }
            }

            const diff = calculateSystemTableDiff(oldDefs, newDefs, v, v + 1)
            if (!diff.hasChanges) continue

            const stepResult = await this.applyDiff(diff)
            allApplied.push(...stepResult.applied)
            allSkipped.push(...stepResult.skippedDestructive)

            if (!stepResult.success) {
                return {
                    fromVersion,
                    toVersion,
                    applied: allApplied,
                    skippedDestructive: allSkipped,
                    success: false,
                    error: stepResult.error
                }
            }
        }

        return { fromVersion, toVersion, applied: allApplied, skippedDestructive: allSkipped, success: true }
    }

    /**
     * Apply a single version diff within a transaction.
     */
    private async applyDiff(diff: SystemTableDiff): Promise<SystemMigrationResult> {
        const applied: string[] = []
        const skippedDestructive: string[] = []

        try {
            await this.knex.transaction(async (trx) => {
                const generator = new SystemTableDDLGenerator(trx, this.schemaName)

                for (const change of diff.additive) {
                    switch (change.type) {
                        case SystemChangeType.ADD_TABLE: {
                            const tableDef = change.definition as SystemTableDef
                            await generator.createTable(tableDef)
                            applied.push(change.description)
                            break
                        }
                        case SystemChangeType.ADD_COLUMN: {
                            const colDef = change.definition as SystemColumnDef
                            await this.addColumn(trx, change.tableName, colDef)
                            applied.push(change.description)
                            break
                        }
                        case SystemChangeType.ADD_INDEX: {
                            await this.addIndex(
                                trx,
                                change.tableName,
                                change.definition as import('./systemTableDefinitions').SystemIndexDef
                            )
                            applied.push(change.description)
                            break
                        }
                        case SystemChangeType.ADD_FK: {
                            await this.addForeignKey(trx, change.tableName, change.fkDef!)
                            applied.push(change.description)
                            break
                        }
                    }
                }

                // Record migration in _mhb_migrations (if the table exists in this transaction)
                await this.recordMigration(trx, diff.fromVersion, diff.toVersion, applied, skippedDestructive)
            })

            // Log destructive changes (not applied within the transaction)
            for (const change of diff.destructive) {
                console.warn(`[SystemTableMigrator] Skipped destructive: ${change.description}`)
                skippedDestructive.push(change.description)
            }

            return { fromVersion: diff.fromVersion, toVersion: diff.toVersion, applied, skippedDestructive, success: true }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            console.error(`[SystemTableMigrator] Migration V${diff.fromVersion}→V${diff.toVersion} failed:`, message)
            return {
                fromVersion: diff.fromVersion,
                toVersion: diff.toVersion,
                applied,
                skippedDestructive,
                success: false,
                error: message
            }
        }
    }

    /**
     * Adds a new column to an existing table.
     * New columns are always nullable (safe additive change).
     */
    private async addColumn(trx: Knex, tableName: string, col: SystemColumnDef): Promise<void> {
        const exists = await trx.schema.withSchema(this.schemaName).hasColumn(tableName, col.name)
        if (exists) return

        await trx.schema.withSchema(this.schemaName).alterTable(tableName, (t) => {
            buildColumnOnTable(t, col, trx, true)
        })
    }

    /**
     * Creates an index on an existing table.
     */
    private async addIndex(trx: Knex, tableName: string, idx: import('./systemTableDefinitions').SystemIndexDef): Promise<void> {
        await trx.raw(buildIndexSQL(this.schemaName, tableName, idx))
    }

    /**
     * Adds a foreign key constraint to an existing table.
     * Idempotent: checks if the constraint already exists.
     */
    private async addForeignKey(trx: Knex, tableName: string, fk: SystemForeignKeyDef): Promise<void> {
        const constraintName = `fk_${tableName}_${fk.column}_${fk.referencesTable}`

        const existing = await trx.raw(
            `SELECT 1 FROM information_schema.table_constraints
             WHERE constraint_schema = ? AND table_name = ? AND constraint_name = ?`,
            [this.schemaName, tableName, constraintName]
        )

        if (existing.rows.length > 0) return

        const qualifiedRef = `${this.schemaName}.${fk.referencesTable}`
        await trx.schema.withSchema(this.schemaName).alterTable(tableName, (t) => {
            const chain = t.foreign(fk.column, constraintName).references(fk.referencesColumn).inTable(qualifiedRef)
            if (fk.onDelete) chain.onDelete(fk.onDelete)
        })
    }

    /**
     * Records migration history in _mhb_migrations (if the table exists).
     * Called inside the migration transaction so the record is atomic with DDL changes.
     */
    private async recordMigration(
        trx: Knex,
        fromVersion: number,
        toVersion: number,
        applied: string[],
        skippedDestructive: string[]
    ): Promise<void> {
        const hasMigTable = await trx.schema.withSchema(this.schemaName).hasTable('_mhb_migrations')
        if (!hasMigTable) return

        const suffix = `${Date.now()}_${randomBytes(4).toString('hex')}`
        const name = `structure_v${fromVersion}_to_v${toVersion}_${suffix}`
        await trx
            .withSchema(this.schemaName)
            .into('_mhb_migrations')
            .insert({
                name,
                from_version: fromVersion,
                to_version: toVersion,
                meta: {
                    applied,
                    skippedDestructive,
                    migratedAt: new Date().toISOString()
                }
            })
    }
}
