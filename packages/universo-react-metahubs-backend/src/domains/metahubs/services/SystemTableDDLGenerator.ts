import type { Knex } from 'knex'
import type { SystemTableDef, SystemForeignKeyDef, SystemCompositeForeignKeyDef } from './systemTableDefinitions'
import { UPL_SYSTEM_FIELDS, MHB_SYSTEM_FIELDS, buildColumnOnTable, buildIndexSQL } from './systemTableDefinitions'

/**
 * Generates DDL (CREATE TABLE, indexes, foreign keys) from declarative SystemTableDef definitions.
 *
 * All tables automatically receive shared _upl_* and _mhb_* system fields.
 * Tables are created in order; foreign keys between system tables are resolved
 * by prefixing `schemaName` to the referenced table.
 */
export class SystemTableDDLGenerator {
    constructor(private readonly knex: Knex, private readonly schemaName: string) {}

    /**
     * Creates all system tables described by the given definitions.
     * Idempotent: skips tables that already exist.
     */
    async createAll(tables: readonly SystemTableDef[]): Promise<void> {
        for (const tableDef of tables) {
            await this.createTable(tableDef)
        }
    }

    /**
     * Creates a single system table if it doesn't already exist.
     */
    async createTable(tableDef: SystemTableDef): Promise<void> {
        const exists = await this.knex.schema.withSchema(this.schemaName).hasTable(tableDef.name)
        if (exists) return

        const selfReferencingCompositeForeignKeys = (tableDef.compositeForeignKeys ?? []).filter(
            (foreignKey) => foreignKey.referencesTable === tableDef.name
        )
        const inlineCompositeForeignKeys = (tableDef.compositeForeignKeys ?? []).filter(
            (foreignKey) => foreignKey.referencesTable !== tableDef.name
        )

        // Merge own columns + shared system columns
        const allColumns = [...tableDef.columns, ...UPL_SYSTEM_FIELDS, ...MHB_SYSTEM_FIELDS]

        await this.knex.schema.withSchema(this.schemaName).createTable(tableDef.name, (t) => {
            // 1. Define columns
            for (const col of allColumns) {
                buildColumnOnTable(t, col, this.knex)
            }

            // 2. Inline foreign keys (via Knex fluent API)
            if (tableDef.foreignKeys?.length) {
                for (const fk of tableDef.foreignKeys) {
                    this.addForeignKey(t, fk)
                }
            }
            if (inlineCompositeForeignKeys.length > 0) {
                for (const fk of inlineCompositeForeignKeys) {
                    this.addCompositeForeignKey(t, fk)
                }
            }

            // 3. Inline indexes (simple btree, non-partial)
            for (const col of allColumns) {
                if (col.index && !col.primary) {
                    t.index([col.name])
                }
            }

            // 4. Unique constraints
            if (tableDef.uniqueConstraints?.length) {
                for (const cols of tableDef.uniqueConstraints) {
                    t.unique(cols)
                }
            }

            // 5. Static table checks declared alongside the fresh table definition.
            if (tableDef.checkConstraints?.length) {
                for (const check of tableDef.checkConstraints) {
                    t.check(check.expression, {}, check.name)
                }
            }
        })

        // Knex emits foreign keys before unique constraints from CREATE TABLE builders. A
        // self-referencing composite FK therefore cannot see its referenced unique key
        // unless it is added after the table (and its unique constraints) exists.
        for (const foreignKey of selfReferencingCompositeForeignKeys) {
            await this.knex.schema.withSchema(this.schemaName).alterTable(tableDef.name, (table) => {
                this.addCompositeForeignKey(table, foreignKey)
            })
        }

        // 5. Named indexes (may be partial, GIN, unique, or expression-based)
        if (tableDef.indexes?.length) {
            for (const idx of tableDef.indexes) {
                await this.createIndex(tableDef.name, idx)
            }
        }
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private addForeignKey(t: Knex.CreateTableBuilder, fk: SystemForeignKeyDef): void {
        const qualifiedTable = `${this.schemaName}.${fk.referencesTable}`
        const chain = t.foreign(fk.column, fk.name).references(fk.referencesColumn).inTable(qualifiedTable)
        if (fk.onDelete) {
            chain.onDelete(fk.onDelete)
        }
    }

    private addCompositeForeignKey(t: Knex.TableBuilder, fk: SystemCompositeForeignKeyDef): void {
        const qualifiedTable = `${this.schemaName}.${fk.referencesTable}`
        const chain = t.foreign(fk.columns, fk.name).references(fk.referencesColumns).inTable(qualifiedTable)
        if (fk.onDelete) {
            chain.onDelete(fk.onDelete)
        }
    }

    private async createIndex(tableName: string, idx: import('./systemTableDefinitions').SystemIndexDef): Promise<void> {
        await this.knex.raw(buildIndexSQL(this.schemaName, tableName, idx))
    }
}
