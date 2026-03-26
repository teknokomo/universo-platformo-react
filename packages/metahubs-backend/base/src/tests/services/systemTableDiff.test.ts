import { calculateSystemTableDiff, SystemChangeType } from '../../domains/metahubs/services/systemTableDiff'
import type { SystemTableDef } from '../../domains/metahubs/services/systemTableDefinitions'

const baseTable = (overrides: Partial<SystemTableDef> = {}): SystemTableDef => ({
    name: '_mhb_test',
    description: 'Test table',
    columns: [{ name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' }],
    ...overrides
})

describe('calculateSystemTableDiff', () => {
    describe('table-level changes', () => {
        it('detects no changes when definitions are identical', () => {
            const table = baseTable()
            const diff = calculateSystemTableDiff([table], [table], 1, 2)
            expect(diff.hasChanges).toBe(false)
            expect(diff.additive).toHaveLength(0)
            expect(diff.destructive).toHaveLength(0)
            expect(diff.summary).toBe('No changes')
        })

        it('detects ADD_TABLE for new table', () => {
            const newTable = baseTable({ name: '_mhb_new' })
            const diff = calculateSystemTableDiff([], [newTable], 1, 2)
            expect(diff.hasChanges).toBe(true)
            expect(diff.additive).toHaveLength(1)
            expect(diff.additive[0].type).toBe(SystemChangeType.ADD_TABLE)
            expect(diff.additive[0].tableName).toBe('_mhb_new')
            expect(diff.additive[0].isDestructive).toBe(false)
        })

        it('detects DROP_TABLE as destructive', () => {
            const oldTable = baseTable()
            const diff = calculateSystemTableDiff([oldTable], [], 1, 2)
            expect(diff.hasChanges).toBe(true)
            expect(diff.destructive).toHaveLength(1)
            expect(diff.destructive[0].type).toBe(SystemChangeType.DROP_TABLE)
            expect(diff.destructive[0].isDestructive).toBe(true)
        })

        it('detects RENAME_TABLE via renamedFrom mapping', () => {
            const oldTable = baseTable({ name: '_mhb_old' })
            const newTable = baseTable({ name: '_mhb_new', renamedFrom: ['_mhb_old'] })
            const diff = calculateSystemTableDiff([oldTable], [newTable], 1, 2)
            expect(diff.additive.some((c) => c.type === SystemChangeType.RENAME_TABLE)).toBe(true)
            const rename = diff.additive.find((c) => c.type === SystemChangeType.RENAME_TABLE)!
            expect(rename.tableName).toBe('_mhb_new')
            expect(rename.fromTableName).toBe('_mhb_old')
            expect(rename.isDestructive).toBe(false)
        })

        it('treats unmatched table without renamedFrom as ADD + DROP', () => {
            const oldTable = baseTable({ name: '_mhb_old' })
            const newTable = baseTable({ name: '_mhb_new' })
            const diff = calculateSystemTableDiff([oldTable], [newTable], 1, 2)
            expect(diff.additive.some((c) => c.type === SystemChangeType.ADD_TABLE)).toBe(true)
            expect(diff.destructive.some((c) => c.type === SystemChangeType.DROP_TABLE)).toBe(true)
        })
    })

    describe('column-level changes', () => {
        it('detects ADD_COLUMN for new column', () => {
            const oldTable = baseTable()
            const newTable = baseTable({
                columns: [
                    { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
                    { name: 'title', type: 'string', nullable: true }
                ]
            })
            const diff = calculateSystemTableDiff([oldTable], [newTable], 1, 2)
            const addCol = diff.additive.find((c) => c.type === SystemChangeType.ADD_COLUMN && c.columnName === 'title')
            expect(addCol).toBeDefined()
            expect(addCol!.isDestructive).toBe(false)
        })

        it('detects DROP_COLUMN as destructive', () => {
            const oldTable = baseTable({
                columns: [
                    { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
                    { name: 'title', type: 'string', nullable: true }
                ]
            })
            const newTable = baseTable()
            const diff = calculateSystemTableDiff([oldTable], [newTable], 1, 2)
            const dropCol = diff.destructive.find((c) => c.type === SystemChangeType.DROP_COLUMN && c.columnName === 'title')
            expect(dropCol).toBeDefined()
            expect(dropCol!.isDestructive).toBe(true)
        })

        it('detects type change as destructive ALTER_COLUMN', () => {
            const oldTable = baseTable({
                columns: [
                    { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
                    { name: 'value', type: 'string', nullable: true }
                ]
            })
            const newTable = baseTable({
                columns: [
                    { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
                    { name: 'value', type: 'integer', nullable: true }
                ]
            })
            const diff = calculateSystemTableDiff([oldTable], [newTable], 1, 2)
            const altered = diff.destructive.find((c) => c.type === SystemChangeType.ALTER_COLUMN && c.columnName === 'value')
            expect(altered).toBeDefined()
            expect(altered!.isDestructive).toBe(true)
        })

        it('detects nullable relaxation (NOT NULL → NULL) as additive', () => {
            const oldTable = baseTable({
                columns: [
                    { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
                    { name: 'name', type: 'string', nullable: false }
                ]
            })
            const newTable = baseTable({
                columns: [
                    { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
                    { name: 'name', type: 'string', nullable: true }
                ]
            })
            const diff = calculateSystemTableDiff([oldTable], [newTable], 1, 2)
            const altered = diff.additive.find((c) => c.type === SystemChangeType.ALTER_COLUMN && c.columnName === 'name')
            expect(altered).toBeDefined()
            expect(altered!.isDestructive).toBe(false)
        })

        it('detects nullable tightening (NULL → NOT NULL) as destructive', () => {
            const oldTable = baseTable({
                columns: [
                    { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
                    { name: 'name', type: 'string', nullable: true }
                ]
            })
            const newTable = baseTable({
                columns: [
                    { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
                    { name: 'name', type: 'string', nullable: false }
                ]
            })
            const diff = calculateSystemTableDiff([oldTable], [newTable], 1, 2)
            const altered = diff.destructive.find((c) => c.type === SystemChangeType.ALTER_COLUMN && c.columnName === 'name')
            expect(altered).toBeDefined()
            expect(altered!.isDestructive).toBe(true)
        })
    })

    describe('index-level changes', () => {
        it('detects ADD_INDEX for new index', () => {
            const oldTable = baseTable()
            const newTable = baseTable({
                indexes: [{ name: 'idx_test', columns: ['id'] }]
            })
            const diff = calculateSystemTableDiff([oldTable], [newTable], 1, 2)
            const addIdx = diff.additive.find((c) => c.type === SystemChangeType.ADD_INDEX)
            expect(addIdx).toBeDefined()
            expect(addIdx!.indexName).toBe('idx_test')
        })

        it('detects DROP_INDEX as destructive', () => {
            const oldTable = baseTable({
                indexes: [{ name: 'idx_test', columns: ['id'] }]
            })
            const newTable = baseTable()
            const diff = calculateSystemTableDiff([oldTable], [newTable], 1, 2)
            const dropIdx = diff.destructive.find((c) => c.type === SystemChangeType.DROP_INDEX)
            expect(dropIdx).toBeDefined()
            expect(dropIdx!.isDestructive).toBe(true)
        })

        it('detects RENAME_INDEX via renamedFrom mapping', () => {
            const oldTable = baseTable({
                indexes: [{ name: 'idx_old', columns: ['id'] }]
            })
            const newTable = baseTable({
                indexes: [{ name: 'idx_new', columns: ['id'], renamedFrom: ['idx_old'] }]
            })
            const diff = calculateSystemTableDiff([oldTable], [newTable], 1, 2)
            const rename = diff.additive.find((c) => c.type === SystemChangeType.RENAME_INDEX)
            expect(rename).toBeDefined()
            expect(rename!.indexName).toBe('idx_new')
            expect(rename!.fromIndexName).toBe('idx_old')
        })

        it('detects ALTER_INDEX when columns change', () => {
            const oldTable = baseTable({
                indexes: [{ name: 'idx_test', columns: ['id'] }]
            })
            const newTable = baseTable({
                columns: [
                    { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
                    { name: 'kind', type: 'string' }
                ],
                indexes: [{ name: 'idx_test', columns: ['id', 'kind'] }]
            })
            const diff = calculateSystemTableDiff([oldTable], [newTable], 1, 2)
            const alter = diff.additive.find((c) => c.type === SystemChangeType.ALTER_INDEX)
            expect(alter).toBeDefined()
            expect(alter!.indexName).toBe('idx_test')
        })

        it('detects ALTER_INDEX when unique flag changes', () => {
            const oldTable = baseTable({
                indexes: [{ name: 'idx_test', columns: ['id'] }]
            })
            const newTable = baseTable({
                indexes: [{ name: 'idx_test', columns: ['id'], unique: true }]
            })
            const diff = calculateSystemTableDiff([oldTable], [newTable], 1, 2)
            const alter = diff.additive.find((c) => c.type === SystemChangeType.ALTER_INDEX)
            expect(alter).toBeDefined()
        })

        it('detects ALTER_INDEX when WHERE clause changes', () => {
            const oldTable = baseTable({
                indexes: [{ name: 'idx_test', columns: ['id'], where: 'deleted = false' }]
            })
            const newTable = baseTable({
                indexes: [{ name: 'idx_test', columns: ['id'], where: 'deleted = false AND archived = false' }]
            })
            const diff = calculateSystemTableDiff([oldTable], [newTable], 1, 2)
            const alter = diff.additive.find((c) => c.type === SystemChangeType.ALTER_INDEX)
            expect(alter).toBeDefined()
        })

        it('detects ALTER_INDEX when method changes', () => {
            const oldTable = baseTable({
                indexes: [{ name: 'idx_test', columns: ['data'] }]
            })
            const newTable = baseTable({
                indexes: [{ name: 'idx_test', columns: ['data'], method: 'gin' }]
            })
            const diff = calculateSystemTableDiff([oldTable], [newTable], 1, 2)
            const alter = diff.additive.find((c) => c.type === SystemChangeType.ALTER_INDEX)
            expect(alter).toBeDefined()
        })
    })

    describe('foreign key changes', () => {
        it('detects ADD_FK for new foreign key', () => {
            const refTable = baseTable({ name: '_mhb_ref' })
            const oldTable = baseTable({
                columns: [
                    { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
                    { name: 'ref_id', type: 'uuid', nullable: true }
                ]
            })
            const newTable = baseTable({
                columns: [
                    { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
                    { name: 'ref_id', type: 'uuid', nullable: true }
                ],
                foreignKeys: [{ column: 'ref_id', referencesTable: '_mhb_ref', referencesColumn: 'id', onDelete: 'CASCADE' }]
            })
            const diff = calculateSystemTableDiff([oldTable, refTable], [newTable, refTable], 1, 2)
            const addFk = diff.additive.find((c) => c.type === SystemChangeType.ADD_FK)
            expect(addFk).toBeDefined()
            expect(addFk!.columnName).toBe('ref_id')
        })

        it('detects DROP_FK as destructive', () => {
            const refTable = baseTable({ name: '_mhb_ref' })
            const oldTable = baseTable({
                columns: [
                    { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
                    { name: 'ref_id', type: 'uuid', nullable: true }
                ],
                foreignKeys: [{ column: 'ref_id', referencesTable: '_mhb_ref', referencesColumn: 'id', onDelete: 'CASCADE' }]
            })
            const newTable = baseTable({
                columns: [
                    { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
                    { name: 'ref_id', type: 'uuid', nullable: true }
                ]
            })
            const diff = calculateSystemTableDiff([oldTable, refTable], [newTable, refTable], 1, 2)
            const dropFk = diff.destructive.find((c) => c.type === SystemChangeType.DROP_FK)
            expect(dropFk).toBeDefined()
            expect(dropFk!.isDestructive).toBe(true)
        })
    })

    describe('summary formatting', () => {
        it('reports additive count', () => {
            const diff = calculateSystemTableDiff([], [baseTable()], 1, 2)
            expect(diff.summary).toContain('additive')
            expect(diff.summary).toContain('V1→V2')
        })

        it('reports destructive count', () => {
            const diff = calculateSystemTableDiff([baseTable()], [], 1, 2)
            expect(diff.summary).toContain('DESTRUCTIVE')
        })

        it('reports both additive and destructive', () => {
            const oldTable = baseTable({ name: '_mhb_old' })
            const newTable = baseTable({ name: '_mhb_new' })
            const diff = calculateSystemTableDiff([oldTable], [newTable], 1, 2)
            expect(diff.summary).toContain('additive')
            expect(diff.summary).toContain('DESTRUCTIVE')
        })
    })
})
