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

        if (tableDef.name === '_mhb_widgets') {
            await this.createWidgetParentLayoutConstraint()
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

    private async createWidgetParentLayoutConstraint(): Promise<void> {
        const functionName = `${this.schemaName}.validate_mhb_widget_parent_layout`
        const widgetsTable = `${this.schemaName}._mhb_widgets`
        const layoutsTable = `${this.schemaName}._mhb_layouts`
        await this.knex.raw(
            `CREATE OR REPLACE FUNCTION ??()
             RETURNS trigger
             LANGUAGE plpgsql
             AS $widget_parent_layout$
             DECLARE
                 parent_layout_id uuid;
                 child_base_layout_id uuid;
                 has_children boolean;
                 has_invalid_children boolean;
             BEGIN
                 IF TG_TABLE_NAME = '_mhb_widgets' THEN
                     IF TG_OP = 'UPDATE' AND NEW.layout_id IS DISTINCT FROM OLD.layout_id THEN
                         EXECUTE format(
                             'SELECT EXISTS (SELECT 1 FROM %I._mhb_widgets WHERE parent_widget_id = $1)',
                             TG_TABLE_SCHEMA
                         ) INTO has_children USING OLD.id;
                         IF has_children THEN
                             RAISE EXCEPTION 'A widget with children cannot change layouts'
                                 USING ERRCODE = '23514', CONSTRAINT = 'chk_mhb_widgets_parent_same_or_base_layout';
                         END IF;
                     END IF;

                     IF NEW.parent_widget_id IS NULL THEN
                         RETURN NEW;
                     END IF;

                     EXECUTE format(
                         'SELECT layout_id FROM %I._mhb_widgets WHERE id = $1 FOR SHARE',
                         TG_TABLE_SCHEMA
                     ) INTO parent_layout_id USING NEW.parent_widget_id;
                     IF parent_layout_id IS NULL THEN
                         RETURN NEW;
                     END IF;
                     IF parent_layout_id = NEW.layout_id THEN
                         RETURN NEW;
                     END IF;

                     EXECUTE format(
                         'SELECT base_layout_id FROM %I._mhb_layouts WHERE id = $1 FOR SHARE',
                         TG_TABLE_SCHEMA
                     ) INTO child_base_layout_id USING NEW.layout_id;
                     IF child_base_layout_id = parent_layout_id THEN
                         RETURN NEW;
                     END IF;

                     RAISE EXCEPTION 'A widget parent must belong to the same layout or its declared base layout'
                         USING ERRCODE = '23514', CONSTRAINT = 'chk_mhb_widgets_parent_same_or_base_layout';
                 ELSIF TG_TABLE_NAME = '_mhb_layouts' THEN
                     IF TG_OP = 'UPDATE' AND NEW.base_layout_id IS DISTINCT FROM OLD.base_layout_id THEN
                         EXECUTE format(
                             'SELECT EXISTS (
                                 SELECT 1
                                 FROM %I._mhb_widgets child
                                 JOIN %I._mhb_widgets parent ON parent.id = child.parent_widget_id
                                 WHERE child.layout_id = $1
                                   AND parent.layout_id <> child.layout_id
                                   AND parent.layout_id IS DISTINCT FROM $2
                             )',
                             TG_TABLE_SCHEMA,
                             TG_TABLE_SCHEMA
                         ) INTO has_invalid_children USING NEW.id, NEW.base_layout_id;
                         IF has_invalid_children THEN
                             RAISE EXCEPTION 'A layout base cannot change while widgets reference a different base layout'
                                 USING ERRCODE = '23514', CONSTRAINT = 'chk_mhb_widgets_parent_same_or_base_layout';
                         END IF;
                     END IF;
                     RETURN NEW;
                 END IF;

                 RETURN NEW;
             END;
             $widget_parent_layout$;`,
            [functionName]
        )
        await this.knex.raw(
            'CREATE OR REPLACE TRIGGER ?? AFTER INSERT OR UPDATE OF layout_id, parent_widget_id ON ?? FOR EACH ROW EXECUTE FUNCTION ??()',
            ['trg_mhb_widgets_parent_layout', widgetsTable, functionName]
        )
        await this.knex.raw('CREATE OR REPLACE TRIGGER ?? AFTER UPDATE OF base_layout_id ON ?? FOR EACH ROW EXECUTE FUNCTION ??()', [
            'trg_mhb_layouts_widget_parent_layout',
            layoutsTable,
            functionName
        ])
    }
}
