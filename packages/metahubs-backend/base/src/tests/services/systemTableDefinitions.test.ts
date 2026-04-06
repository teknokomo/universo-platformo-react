import {
    SYSTEM_TABLES,
    SYSTEM_TABLE_VERSIONS,
    UPL_SYSTEM_FIELDS,
    MHB_SYSTEM_FIELDS,
    buildSystemStructureSnapshot,
    buildIndexSQL
} from '../../domains/metahubs/services/systemTableDefinitions'
import { codenamePrimaryTextSql } from '../../domains/shared/codename'
import { CURRENT_STRUCTURE_VERSION } from '../../domains/metahubs/services/structureVersions'

describe('systemTableDefinitions', () => {
    describe('SYSTEM_TABLES array', () => {
        it('contains expected system tables', () => {
            const tableNames = SYSTEM_TABLES.map((t) => t.name)
            expect(tableNames).toContain('_mhb_objects')
            expect(tableNames).toContain('_mhb_attributes')
            expect(tableNames).toContain('_mhb_constants')
            expect(tableNames).toContain('_mhb_values')
            expect(tableNames).toContain('_mhb_elements')
            expect(tableNames).toContain('_mhb_settings')
            expect(tableNames).toContain('_mhb_layouts')
            expect(tableNames).toContain('_mhb_widgets')
            expect(tableNames).toContain('_mhb_migrations')
            expect(tableNames).toContain('_mhb_scripts')
        })

        it('has no duplicate table names', () => {
            const names = SYSTEM_TABLES.map((t) => t.name)
            expect(new Set(names).size).toBe(names.length)
        })

        it('every table has at least an id primary key column', () => {
            for (const table of SYSTEM_TABLES) {
                const pk = table.columns.find((c) => c.primary)
                expect(pk).toBeDefined()
                expect(pk!.name).toBe('id')
                expect(pk!.type).toBe('uuid')
            }
        })

        it('every table has a description', () => {
            for (const table of SYSTEM_TABLES) {
                expect(table.description.length).toBeGreaterThan(0)
            }
        })

        it('no duplicate column names within a single table', () => {
            for (const table of SYSTEM_TABLES) {
                const colNames = table.columns.map((c) => c.name)
                expect(new Set(colNames).size).toBe(colNames.length)
            }
        })

        it('no duplicate index names within a single table', () => {
            for (const table of SYSTEM_TABLES) {
                if (!table.indexes) continue
                const idxNames = table.indexes.map((i) => i.name)
                expect(new Set(idxNames).size).toBe(idxNames.length)
            }
        })

        it('no duplicate index names across all tables', () => {
            const allIndexNames: string[] = []
            for (const table of SYSTEM_TABLES) {
                for (const idx of table.indexes ?? []) {
                    allIndexNames.push(idx.name)
                }
            }
            expect(new Set(allIndexNames).size).toBe(allIndexNames.length)
        })

        it('foreign keys reference existing tables', () => {
            const tableNames = new Set(SYSTEM_TABLES.map((t) => t.name))
            for (const table of SYSTEM_TABLES) {
                for (const fk of table.foreignKeys ?? []) {
                    expect(tableNames.has(fk.referencesTable)).toBe(true)
                }
            }
        })

        it('foreign key columns exist in the referencing table', () => {
            for (const table of SYSTEM_TABLES) {
                const colNames = new Set(table.columns.map((c) => c.name))
                for (const fk of table.foreignKeys ?? []) {
                    expect(colNames.has(fk.column)).toBe(true)
                }
            }
        })

        it('codename columns use jsonb type', () => {
            for (const table of SYSTEM_TABLES) {
                const codenameCol = table.columns.find((c) => c.name === 'codename')
                if (codenameCol) {
                    expect(codenameCol.type).toBe('jsonb')
                }
            }
        })

        it('all column types are valid', () => {
            const validTypes: Set<string> = new Set(['uuid', 'string', 'text', 'integer', 'boolean', 'jsonb', 'timestamptz'])
            for (const table of SYSTEM_TABLES) {
                for (const col of table.columns) {
                    expect(validTypes.has(col.type)).toBe(true)
                }
            }
        })
    })

    describe('shared system fields', () => {
        it('UPL_SYSTEM_FIELDS contains audit columns', () => {
            const names = UPL_SYSTEM_FIELDS.map((f) => f.name)
            expect(names).toContain('_upl_created_at')
            expect(names).toContain('_upl_updated_at')
            expect(names).toContain('_upl_deleted')
            expect(names).toContain('_upl_version')
        })

        it('MHB_SYSTEM_FIELDS contains lifecycle columns', () => {
            const names = MHB_SYSTEM_FIELDS.map((f) => f.name)
            expect(names).toContain('_mhb_published')
            expect(names).toContain('_mhb_archived')
            expect(names).toContain('_mhb_deleted')
        })

        it('no overlap between UPL and MHB field names', () => {
            const uplNames = new Set(UPL_SYSTEM_FIELDS.map((f) => f.name))
            const mhbNames = MHB_SYSTEM_FIELDS.map((f) => f.name)
            for (const name of mhbNames) {
                expect(uplNames.has(name)).toBe(false)
            }
        })
    })

    describe('SYSTEM_TABLE_VERSIONS', () => {
        it('maps current version to SYSTEM_TABLES', () => {
            const defs = SYSTEM_TABLE_VERSIONS.get(CURRENT_STRUCTURE_VERSION)
            expect(defs).toBeDefined()
            expect(defs).toBe(SYSTEM_TABLES)
        })

        it('keeps the previous script-table definition for version 2', () => {
            const previousDefs = SYSTEM_TABLE_VERSIONS.get(2)
            const previousScripts = previousDefs?.find((table) => table.name === '_mhb_scripts')
            const scopedIndex = previousScripts?.indexes?.find((index) => index.name === 'idx_mhb_scripts_codename_active_unique')

            expect(previousScripts).toBeDefined()
            expect(scopedIndex?.columns).toEqual([codenamePrimaryTextSql('codename')])
        })

        it('returns undefined for unknown version', () => {
            expect(SYSTEM_TABLE_VERSIONS.get(999)).toBeUndefined()
        })
    })

    describe('script scoped codename indexes', () => {
        it('scopes active script codename uniqueness by attachment and module role', () => {
            const scriptsTable = SYSTEM_TABLES.find((table) => table.name === '_mhb_scripts')
            const scopedIndex = scriptsTable?.indexes?.find((index) => index.name === 'idx_mhb_scripts_codename_active_unique')

            expect(scopedIndex).toBeDefined()
            expect(scopedIndex?.columns).toEqual([
                'attached_to_kind',
                "COALESCE(attached_to_id, '00000000-0000-0000-0000-000000000000'::uuid)",
                'module_role',
                codenamePrimaryTextSql('codename')
            ])
            expect(scopedIndex?.unique).toBe(true)
        })
    })

    describe('buildSystemStructureSnapshot', () => {
        it('builds snapshot for current version', () => {
            const snapshot = buildSystemStructureSnapshot(CURRENT_STRUCTURE_VERSION)
            expect(snapshot).not.toBeNull()
            expect(snapshot!.version).toBe(CURRENT_STRUCTURE_VERSION)
            expect(snapshot!.tables.length).toBe(SYSTEM_TABLES.length)
        })

        it('returns null for unknown version', () => {
            expect(buildSystemStructureSnapshot(999)).toBeNull()
        })

        it('snapshot tables match SYSTEM_TABLES names', () => {
            const snapshot = buildSystemStructureSnapshot(CURRENT_STRUCTURE_VERSION)!
            const snapshotNames = snapshot.tables.map((t) => t.name)
            const definitionNames = SYSTEM_TABLES.map((t) => t.name)
            expect(snapshotNames).toEqual(definitionNames)
        })

        it('snapshot is a deep clone (modifying it does not affect definitions)', () => {
            const snapshot = buildSystemStructureSnapshot(CURRENT_STRUCTURE_VERSION)!
            const originalName = snapshot.tables[0].name
            snapshot.tables[0].name = 'MODIFIED'
            expect(SYSTEM_TABLES[0].name).toBe(originalName)
        })
    })

    describe('buildIndexSQL', () => {
        it('generates CREATE INDEX for simple btree index', () => {
            const sql = buildIndexSQL('test_schema', '_mhb_objects', {
                name: 'idx_test',
                columns: ['kind']
            })
            expect(sql).toContain('CREATE INDEX IF NOT EXISTS "idx_test"')
            expect(sql).toContain('"test_schema"."_mhb_objects"')
            expect(sql).toContain('"kind"')
        })

        it('generates UNIQUE index', () => {
            const sql = buildIndexSQL('test_schema', '_mhb_objects', {
                name: 'uidx_test',
                columns: ['kind'],
                unique: true
            })
            expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS')
        })

        it('generates GIN index', () => {
            const sql = buildIndexSQL('test_schema', '_mhb_elements', {
                name: 'idx_gin_test',
                columns: ['data'],
                method: 'gin'
            })
            expect(sql).toContain('USING GIN')
        })

        it('generates partial index with WHERE clause', () => {
            const sql = buildIndexSQL('test_schema', '_mhb_objects', {
                name: 'idx_partial',
                columns: ['kind'],
                where: '_upl_deleted = false'
            })
            expect(sql).toContain('WHERE _upl_deleted = false')
        })

        it('preserves raw SQL expressions in columns (not quoted)', () => {
            const sql = buildIndexSQL('test_schema', '_mhb_objects', {
                name: 'idx_expr',
                columns: ["COALESCE(codename->>'_primary', '')"]
            })
            expect(sql).toContain("COALESCE(codename->>'_primary', '')")
            expect(sql).not.toContain('"COALESCE')
        })
    })
})
