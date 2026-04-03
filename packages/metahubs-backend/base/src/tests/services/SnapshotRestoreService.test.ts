const mockReadPlatformSystemAttributesPolicy = jest.fn(async () => ({
    publishEnabled: true,
    archiveEnabled: true,
    deleteEnabled: true,
}))
const mockEnsureCatalogSystemAttributesSeed = jest.fn(async () => undefined)

jest.mock('../../domains/templates/services/systemAttributeSeed', () => ({
    __esModule: true,
    readPlatformSystemAttributesPolicyWithKnex: mockReadPlatformSystemAttributesPolicy,
    ensureCatalogSystemAttributesSeed: mockEnsureCatalogSystemAttributesSeed,
}))

const mockResolveWidgetTableName = jest.fn(async () => '_mhb_widgets')

jest.mock('../../domains/templates/services/widgetTableResolver', () => ({
    __esModule: true,
    resolveWidgetTableName: mockResolveWidgetTableName,
}))

import { SnapshotRestoreService } from '../../domains/metahubs/services/SnapshotRestoreService'
import type { MetahubSnapshot } from '../../domains/publications/services/SnapshotSerializer'

function createMockKnex() {
    const insertedRows: Record<string, unknown[]> = {}
    const deletedTables: string[] = []
    let idCounter = 1

    const mockBuilder = {
        withSchema: jest.fn().mockReturnThis(),
        from: jest.fn().mockImplementation(function (this: any, tableName: string) {
            this._currentTable = tableName
            return this
        }),
        into: jest.fn().mockImplementation(function (this: any, tableName: string) {
            this._currentTable = tableName
            return this
        }),
        insert: jest.fn().mockImplementation(function (this: any, row: Record<string, unknown>) {
            const table = this._currentTable || '_unknown'
            if (!insertedRows[table]) insertedRows[table] = []
            insertedRows[table].push(row)
            return this
        }),
        returning: jest.fn().mockImplementation(function (this: any) {
            const newId = `generated-id-${idCounter++}`
            return Promise.resolve([{ id: newId }])
        }),
        del: jest.fn().mockImplementation(function (this: any) {
            const table = this._currentTable || '_unknown'
            deletedTables.push(table)
            return Promise.resolve(1)
        }),
    }

    const trxFn = jest.fn().mockImplementation(async (cb: (trx: any) => Promise<void>) => {
        await cb(mockBuilder)
    })

    const knex = {
        transaction: trxFn,
    }

    return { knex, mockBuilder, insertedRows, deletedTables, trxFn }
}

describe('SnapshotRestoreService', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    const makeMinimalSnapshot = (overrides?: Partial<MetahubSnapshot>): MetahubSnapshot => ({
        version: '1.0.0',
        metahubId: '00000000-0000-0000-0000-000000000001',
        entities: {
            'old-catalog-id': {
                kind: 'catalog',
                codename: 'products',
                presentation: { name: { en: 'Products' }, description: {} },
                config: {},
                fields: [
                    {
                        id: 'old-field-id',
                        codename: 'title',
                        dataType: 'STRING',
                        isRequired: false,
                        isDisplayAttribute: true,
                        presentation: { name: { en: 'Title' }, description: {} },
                        validationRules: {},
                        uiConfig: {},
                        sortOrder: 1,
                    },
                ],
            },
        },
        constants: {},
        enumerationValues: {},
        elements: {},
        systemFields: {},
        ...overrides,
    } as unknown as MetahubSnapshot)

    it('creates entities and attributes from a minimal snapshot', async () => {
        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        await service.restoreFromSnapshot('metahub-1', makeMinimalSnapshot(), 'user-1')

        expect(insertedRows['_mhb_objects']).toHaveLength(1)
        expect(insertedRows['_mhb_objects']![0]).toMatchObject({
            kind: 'catalog',
            codename: expect.objectContaining({ _schema: '1' }),
        })
        expect(insertedRows['_mhb_attributes']).toHaveLength(1)
        expect(insertedRows['_mhb_attributes']![0]).toMatchObject({
            codename: expect.objectContaining({ _schema: '1' }),
            data_type: 'STRING',
        })
        expect(mockEnsureCatalogSystemAttributesSeed).toHaveBeenCalled()
    })

    it('remaps hub references in entity config', async () => {
        const snapshot = makeMinimalSnapshot({
            entities: {
                'old-hub-id': {
                    id: 'old-hub-id',
                    kind: 'hub',
                    codename: 'main-hub',
                    presentation: { name: { en: 'Main Hub' }, description: {} },
                    config: {},
                    fields: [],
                    hubs: [],
                },
                'old-catalog-id': {
                    id: 'old-catalog-id',
                    kind: 'catalog',
                    codename: 'products',
                    presentation: { name: { en: 'Products' }, description: {} },
                    config: {},
                    hubs: ['old-hub-id'],
                    fields: [],
                },
            },
        } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        // Hub is created first, then catalog references the new hub ID
        expect(insertedRows['_mhb_objects']).toHaveLength(2)
        const catalogRow = insertedRows['_mhb_objects']![1]
        expect((catalogRow as any).config).toHaveProperty('hubs')
        expect((catalogRow as any).config.hubs).toHaveLength(1)
        // The hub ID should be the generated-id, not the old one
        expect((catalogRow as any).config.hubs[0]).toMatch(/^generated-id-/)
    })

    it('restores constants and maps IDs', async () => {
        const snapshot = makeMinimalSnapshot({
            entities: {
                'old-set-id': {
                    kind: 'set',
                    codename: 'sizes',
                    presentation: { name: { en: 'Sizes' }, description: {} },
                    config: {},
                    fields: [],
                },
            },
            constants: {
                'old-set-id': [
                    {
                        id: 'old-const-id',
                        codename: 'size-s',
                        dataType: 'STRING',
                        presentation: { name: { en: 'S' } },
                        validationRules: {},
                        uiConfig: {},
                        value: 'small',
                        sortOrder: 0,
                    },
                ],
            },
        } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(insertedRows['_mhb_constants']).toHaveLength(1)
        expect(insertedRows['_mhb_constants']![0]).toMatchObject({
            codename: expect.objectContaining({ _schema: '1' }),
            data_type: 'STRING',
        })
    })

    it('restores layouts and zone widgets', async () => {
        const snapshot = makeMinimalSnapshot({
            layouts: [
                {
                    id: 'old-layout-id',
                    templateKey: 'dashboard',
                    name: { en: 'Default' },
                    description: null,
                    config: { showHeader: true },
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0,
                },
            ],
            layoutZoneWidgets: [
                {
                    layoutId: 'old-layout-id',
                    zone: 'main',
                    widgetKey: 'details-table',
                    sortOrder: 0,
                    config: {},
                    isActive: true,
                },
            ],
        } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows, deletedTables } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(deletedTables).toEqual(['_mhb_widgets', '_mhb_layouts'])
        expect(insertedRows['_mhb_layouts']).toHaveLength(1)
        expect(insertedRows['_mhb_layouts']![0]).toMatchObject({
            template_key: 'dashboard',
            is_default: true,
        })
        expect(insertedRows['_mhb_widgets']).toHaveLength(1)
        expect(insertedRows['_mhb_widgets']![0]).toMatchObject({
            zone: 'main',
            widget_key: 'details-table',
        })
    })

    it('clears seeded layouts even when snapshot has no layouts', async () => {
        const snapshot = makeMinimalSnapshot({ layouts: [], layoutZoneWidgets: [] } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows, deletedTables } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(deletedTables).toEqual(['_mhb_widgets', '_mhb_layouts'])
        expect(insertedRows['_mhb_layouts']).toBeUndefined()
        expect(insertedRows['_mhb_widgets']).toBeUndefined()
    })

    it('skips entities with missing entityIdMap (with warning)', async () => {
        const snapshot = makeMinimalSnapshot({
            constants: {
                'non-existent-entity-id': [
                    {
                        id: 'const-1',
                        codename: 'orphan',
                        dataType: 'STRING',
                        presentation: { name: { en: 'Orphan' } },
                        validationRules: {},
                        uiConfig: {},
                        value: 'x',
                        sortOrder: 0,
                    },
                ],
            },
        } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        // Should not throw; orphaned constants are skipped with a warning
        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(insertedRows['_mhb_constants']).toBeUndefined()
    })

    it('handles empty snapshot gracefully', async () => {
        const snapshot = makeMinimalSnapshot({
            entities: {},
            constants: {},
            enumerationValues: {},
            elements: {},
        })

        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(insertedRows['_mhb_objects']).toBeUndefined()
    })
})
