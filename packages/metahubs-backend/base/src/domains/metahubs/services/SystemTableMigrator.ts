import { randomBytes } from 'crypto'
import type { Knex } from 'knex'
import type { SystemColumnDef, SystemForeignKeyDef, SystemIndexDef, SystemTableDef } from './systemTableDefinitions'
import { SystemTableDDLGenerator } from './SystemTableDDLGenerator'
import { calculateSystemTableDiff, SystemChangeType, type SystemTableDiff } from './systemTableDiff'
import { SYSTEM_TABLE_VERSIONS, buildColumnOnTable, buildIndexSQL, buildSystemStructureSnapshot } from './systemTableDefinitions'
import { buildStructureMigrationMeta } from './metahubMigrationMeta'

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
        const skippedDestructive = diff.destructive.map((change) => change.description)

        if (skippedDestructive.length > 0) {
            const message =
                `Destructive system-table changes detected for V${diff.fromVersion}→V${diff.toVersion}. ` +
                'Automatic migration is blocked until a dedicated destructive migration path is implemented.'
            console.error(`[SystemTableMigrator] ${message}`, { skippedDestructive })
            return {
                fromVersion: diff.fromVersion,
                toVersion: diff.toVersion,
                applied,
                skippedDestructive,
                success: false,
                error: message
            }
        }

        try {
            await this.knex.transaction(async (trx) => {
                const generator = new SystemTableDDLGenerator(trx, this.schemaName)
                const orderedChanges = [...diff.additive].sort((left, right) => {
                    const priority: Record<SystemChangeType, number> = {
                        [SystemChangeType.RENAME_TABLE]: 10,
                        [SystemChangeType.ADD_TABLE]: 20,
                        [SystemChangeType.RENAME_INDEX]: 30,
                        [SystemChangeType.ADD_COLUMN]: 40,
                        [SystemChangeType.ALTER_COLUMN]: 50,
                        [SystemChangeType.ADD_INDEX]: 60,
                        [SystemChangeType.ADD_FK]: 70,
                        [SystemChangeType.DROP_TABLE]: 1000,
                        [SystemChangeType.DROP_COLUMN]: 1000,
                        [SystemChangeType.DROP_INDEX]: 1000,
                        [SystemChangeType.DROP_FK]: 1000
                    }
                    return priority[left.type] - priority[right.type]
                })

                for (const change of orderedChanges) {
                    switch (change.type) {
                        case SystemChangeType.RENAME_TABLE: {
                            if (!change.fromTableName) {
                                throw new Error(`Missing source table name for table rename to "${change.tableName}"`)
                            }
                            await this.renameTable(trx, change.fromTableName, change.tableName)
                            applied.push(change.description)
                            break
                        }
                        case SystemChangeType.ADD_TABLE: {
                            const tableDef = change.definition as SystemTableDef
                            await generator.createTable(tableDef)
                            applied.push(change.description)
                            break
                        }
                        case SystemChangeType.RENAME_INDEX: {
                            if (!change.fromIndexName || !change.indexName) {
                                throw new Error(`Missing index rename arguments on table "${change.tableName}"`)
                            }
                            await this.renameIndex(trx, change.fromIndexName, change.indexName)
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
                            await this.addIndex(trx, change.tableName, change.definition as SystemIndexDef)
                            applied.push(change.description)
                            break
                        }
                        case SystemChangeType.ADD_FK: {
                            await this.addForeignKey(trx, change.tableName, change.fkDef!)
                            applied.push(change.description)
                            break
                        }
                        case SystemChangeType.ALTER_COLUMN: {
                            const colDef = change.definition as SystemColumnDef
                            await this.alterColumn(trx, change.tableName, colDef)
                            applied.push(change.description)
                            break
                        }
                        default:
                            throw new Error(`Unsupported additive system change type: ${change.type}`)
                    }
                }

                // Record migration in _mhb_migrations (if the table exists in this transaction)
                await this.recordMigration(trx, diff.fromVersion, diff.toVersion, applied, skippedDestructive)
            })

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
     * Renames an existing table inside schema.
     * Idempotent: if target table already exists and source does not, no-op.
     */
    private async renameTable(trx: Knex, fromTableName: string, toTableName: string): Promise<void> {
        const [fromExists, toExists] = await Promise.all([
            trx.schema.withSchema(this.schemaName).hasTable(fromTableName),
            trx.schema.withSchema(this.schemaName).hasTable(toTableName)
        ])

        if (!fromExists && toExists) return
        if (!fromExists && !toExists) {
            throw new Error(`Cannot rename table "${fromTableName}" to "${toTableName}": source and target tables do not exist`)
        }
        if (fromExists && toExists) {
            throw new Error(`Cannot rename table "${fromTableName}" to "${toTableName}": both source and target tables already exist`)
        }

        await trx.schema.withSchema(this.schemaName).renameTable(fromTableName, toTableName)
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
    private async addIndex(trx: Knex, tableName: string, idx: SystemIndexDef): Promise<void> {
        await trx.raw(buildIndexSQL(this.schemaName, tableName, idx))
    }

    /**
     * Renames an existing index inside schema.
     * Idempotent: if target index exists and source does not, no-op.
     */
    private async renameIndex(trx: Knex, fromIndexName: string, toIndexName: string): Promise<void> {
        const [fromIndexRows, toIndexRows] = await Promise.all([
            trx.raw<{ rows: Array<{ exists: number }> }>(
                `SELECT 1 as exists FROM pg_indexes WHERE schemaname = ? AND indexname = ? LIMIT 1`,
                [this.schemaName, fromIndexName]
            ),
            trx.raw<{ rows: Array<{ exists: number }> }>(
                `SELECT 1 as exists FROM pg_indexes WHERE schemaname = ? AND indexname = ? LIMIT 1`,
                [this.schemaName, toIndexName]
            )
        ])

        const fromExists = (fromIndexRows.rows?.length ?? 0) > 0
        const toExists = (toIndexRows.rows?.length ?? 0) > 0

        if (!fromExists && toExists) return
        if (!fromExists && !toExists) {
            throw new Error(`Cannot rename index "${fromIndexName}" to "${toIndexName}": source and target indexes do not exist`)
        }
        if (fromExists && toExists) {
            throw new Error(`Cannot rename index "${fromIndexName}" to "${toIndexName}": both source and target indexes already exist`)
        }

        const qSchema = this.quoteIdent(this.schemaName)
        const qFrom = this.quoteIdent(fromIndexName)
        const qTo = this.quoteIdent(toIndexName)
        await trx.raw(`ALTER INDEX ${qSchema}.${qFrom} RENAME TO ${qTo}`)
    }

    /**
     * Alters an existing column.
     * Only safe nullable relaxation (DROP NOT NULL) is auto-applied.
     */
    private async alterColumn(trx: Knex, tableName: string, col: SystemColumnDef): Promise<void> {
        const exists = await trx.schema.withSchema(this.schemaName).hasColumn(tableName, col.name)
        if (!exists) return

        const info = await trx.raw<{ rows: Array<{ is_nullable: 'YES' | 'NO' }> }>(
            `
                SELECT is_nullable
                FROM information_schema.columns
                WHERE table_schema = ? AND table_name = ? AND column_name = ?
            `,
            [this.schemaName, tableName, col.name]
        )

        const oldIsNullable = info.rows?.[0]?.is_nullable === 'YES'
        const newIsNullable = col.nullable !== false
        if (oldIsNullable === newIsNullable) return

        if (!newIsNullable) {
            throw new Error(`Nullable tightening is destructive and must be applied manually: ${this.schemaName}.${tableName}.${col.name}`)
        }

        const qSchema = this.quoteIdent(this.schemaName)
        const qTable = this.quoteIdent(tableName)
        const qColumn = this.quoteIdent(col.name)
        await trx.raw(`ALTER TABLE ${qSchema}.${qTable} ALTER COLUMN ${qColumn} DROP NOT NULL`)
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
        const snapshotBefore = buildSystemStructureSnapshot(fromVersion)
        const snapshotAfter = buildSystemStructureSnapshot(toVersion)
        const meta = buildStructureMigrationMeta({
            applied,
            skippedDestructive,
            snapshotBefore,
            snapshotAfter
        })
        await trx.withSchema(this.schemaName).into('_mhb_migrations').insert({
            name,
            from_version: fromVersion,
            to_version: toVersion,
            meta
        })
    }

    private quoteIdent(identifier: string): string {
        return `"${identifier.replace(/"/g, '""')}"`
    }
}
