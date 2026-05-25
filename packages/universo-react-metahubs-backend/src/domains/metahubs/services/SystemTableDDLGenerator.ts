import type { Knex } from 'knex'
import type { SystemTableDef, SystemForeignKeyDef } from './systemTableDefinitions'
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
        })

        // 5. Named indexes (may be partial, GIN, unique, or expression-based)
        if (tableDef.indexes?.length) {
            for (const idx of tableDef.indexes) {
                await this.createIndex(tableDef.name, idx)
            }
        }
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private addForeignKey(t: Knex.CreateTableBuilder, fk: SystemForeignKeyDef): void {
        const chain = t.foreign(fk.column).references(fk.referencesColumn).inTable(`${this.schemaName}.${fk.referencesTable}`)
        if (fk.onDelete) {
            chain.onDelete(fk.onDelete)
        }
    }

    private async createIndex(tableName: string, idx: import('./systemTableDefinitions').SystemIndexDef): Promise<void> {
        await this.knex.raw(buildIndexSQL(this.schemaName, tableName, idx))
    }
}
