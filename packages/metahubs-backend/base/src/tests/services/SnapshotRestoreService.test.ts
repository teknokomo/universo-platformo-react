const mockReadPlatformSystemAttributesPolicy = jest.fn(async () => ({
    publishEnabled: true,
    archiveEnabled: true,
    deleteEnabled: true
}))
const mockEnsureCatalogSystemAttributesSeed = jest.fn(async () => undefined)

jest.mock('../../domains/templates/services/systemAttributeSeed', () => ({
    __esModule: true,
    readPlatformSystemAttributesPolicyWithKnex: mockReadPlatformSystemAttributesPolicy,
    ensureCatalogSystemAttributesSeed: mockEnsureCatalogSystemAttributesSeed
}))

const mockResolveWidgetTableName = jest.fn(async () => '_mhb_widgets')

jest.mock('../../domains/templates/services/widgetTableResolver', () => ({
    __esModule: true,
    resolveWidgetTableName: mockResolveWidgetTableName
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
            const table = this._currentTable || '_unknown'
            const tableRows = insertedRows[table]
            const lastInsertedRow = Array.isArray(tableRows) ? tableRows[tableRows.length - 1] : null
            if (lastInsertedRow && typeof lastInsertedRow === 'object') {
                ;(lastInsertedRow as Record<string, unknown>).id = newId
            }
            return Promise.resolve([{ id: newId }])
        }),
        del: jest.fn().mockImplementation(function (this: any) {
            const table = this._currentTable || '_unknown'
            deletedTables.push(table)
            return Promise.resolve(1)
        })
    }

    const trxFn = jest.fn().mockImplementation(async (cb: (trx: any) => Promise<void>) => {
        await cb(mockBuilder)
    })

    const knex = {
        transaction: trxFn
    }

    return { knex, mockBuilder, insertedRows, deletedTables, trxFn }
}

describe('SnapshotRestoreService', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    const makeMinimalSnapshot = (overrides?: Partial<MetahubSnapshot>): MetahubSnapshot =>
        ({
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
                            sortOrder: 1
                        }
                    ]
                }
            },
            constants: {},
            enumerationValues: {},
            elements: {},
            systemFields: {},
            ...overrides
        } as unknown as MetahubSnapshot)

    it('creates entities and attributes from a minimal snapshot', async () => {
        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        await service.restoreFromSnapshot('metahub-1', makeMinimalSnapshot(), 'user-1')

        expect(insertedRows['_mhb_objects']).toHaveLength(1)
        expect(insertedRows['_mhb_objects']![0]).toMatchObject({
            kind: 'catalog',
            codename: expect.objectContaining({ _schema: '1' })
        })
        expect(insertedRows['_mhb_attributes']).toHaveLength(1)
        expect(insertedRows['_mhb_attributes']![0]).toMatchObject({
            codename: expect.objectContaining({ _schema: '1' }),
            data_type: 'STRING'
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
                    hubs: []
                },
                'old-catalog-id': {
                    id: 'old-catalog-id',
                    kind: 'catalog',
                    codename: 'products',
                    presentation: { name: { en: 'Products' }, description: {} },
                    config: {},
                    hubs: ['old-hub-id'],
                    fields: []
                }
            }
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
                    fields: []
                }
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
                        sortOrder: 0
                    }
                ]
            }
        } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(insertedRows['_mhb_constants']).toHaveLength(1)
        expect(insertedRows['_mhb_constants']![0]).toMatchObject({
            codename: expect.objectContaining({ _schema: '1' }),
            data_type: 'STRING'
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
                    sortOrder: 0
                }
            ],
            layoutZoneWidgets: [
                {
                    layoutId: 'old-layout-id',
                    zone: 'main',
                    widgetKey: 'details-table',
                    sortOrder: 0,
                    config: {},
                    isActive: true
                }
            ]
        } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows, deletedTables } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(deletedTables).toEqual(['_mhb_scripts', '_mhb_widgets', '_mhb_catalog_widget_overrides', '_mhb_layouts'])
        expect(insertedRows['_mhb_layouts']).toHaveLength(1)
        expect(insertedRows['_mhb_layouts']![0]).toMatchObject({
            catalog_id: null,
            base_layout_id: null,
            template_key: 'dashboard',
            is_default: true
        })
        expect(insertedRows['_mhb_widgets']).toHaveLength(1)
        expect(insertedRows['_mhb_widgets']![0]).toMatchObject({
            zone: 'main',
            widget_key: 'details-table'
        })
    })

    it('restores scripts with sourceCode and remaps attachment ids', async () => {
        const snapshot = makeMinimalSnapshot({
            entities: {
                'old-catalog-id': {
                    id: 'old-catalog-id',
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
                            sortOrder: 1
                        }
                    ]
                }
            },
            scripts: [
                {
                    id: 'script-metahub-id',
                    codename: 'quiz-widget',
                    presentation: { name: { en: 'Quiz widget' } },
                    attachedToKind: 'metahub',
                    attachedToId: null,
                    moduleRole: 'widget',
                    sourceKind: 'embedded',
                    sdkApiVersion: '1.0.0',
                    manifest: {
                        className: 'QuizWidget',
                        sdkApiVersion: '1.0.0',
                        moduleRole: 'widget',
                        sourceKind: 'embedded',
                        capabilities: ['metadata.read', 'rpc.client'],
                        methods: []
                    },
                    serverBundle: 'server bundle',
                    clientBundle: 'client bundle',
                    checksum: 'checksum-metahub',
                    isActive: true,
                    config: { scriptCodename: 'quiz-widget' },
                    sourceCode:
                        "import { ExtensionScript } from '@universo/extension-sdk'\nexport default class QuizWidget extends ExtensionScript {}"
                },
                {
                    id: 'script-attribute-id',
                    codename: 'attribute-hook',
                    presentation: { name: { en: 'Attribute hook' } },
                    attachedToKind: 'attribute',
                    attachedToId: 'old-field-id',
                    moduleRole: 'lifecycle',
                    sourceKind: 'embedded',
                    sdkApiVersion: '1.0.0',
                    manifest: {
                        className: 'AttributeHook',
                        sdkApiVersion: '1.0.0',
                        moduleRole: 'lifecycle',
                        sourceKind: 'embedded',
                        capabilities: ['records.read', 'records.write', 'metadata.read', 'lifecycle'],
                        methods: []
                    },
                    serverBundle: 'attribute server bundle',
                    clientBundle: null,
                    checksum: 'checksum-attribute',
                    isActive: true,
                    config: {},
                    sourceCode:
                        "import { ExtensionScript } from '@universo/extension-sdk'\nexport default class AttributeHook extends ExtensionScript {}"
                }
            ]
        } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows, deletedTables } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(deletedTables).toContain('_mhb_scripts')
        expect(insertedRows['_mhb_scripts']).toHaveLength(2)
        expect(insertedRows['_mhb_scripts']![0]).toMatchObject({
            attached_to_kind: 'metahub',
            attached_to_id: null,
            source_code: expect.stringContaining('QuizWidget extends ExtensionScript'),
            _mhb_published: true
        })
        expect(insertedRows['_mhb_scripts']![1]).toMatchObject({
            attached_to_kind: 'attribute',
            attached_to_id: 'generated-id-2',
            source_code: expect.stringContaining('AttributeHook extends ExtensionScript'),
            server_bundle: 'attribute server bundle'
        })
    })

    it('clears seeded layouts even when snapshot has no layouts', async () => {
        const snapshot = makeMinimalSnapshot({ layouts: [], layoutZoneWidgets: [] } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows, deletedTables } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(deletedTables).toEqual(['_mhb_scripts', '_mhb_widgets', '_mhb_catalog_widget_overrides', '_mhb_layouts'])
        expect(insertedRows['_mhb_layouts']).toBeUndefined()
        expect(insertedRows['_mhb_widgets']).toBeUndefined()
    })

    it('restores catalog layouts and sparse widget overrides with remapped ids', async () => {
        const snapshot = makeMinimalSnapshot({
            layouts: [
                {
                    id: 'old-global-layout-id',
                    templateKey: 'dashboard',
                    name: { en: 'Global default' },
                    description: null,
                    config: { showHeader: true },
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            catalogLayouts: [
                {
                    id: 'old-catalog-layout-id',
                    catalogId: 'old-catalog-id',
                    baseLayoutId: 'old-global-layout-id',
                    templateKey: 'dashboard',
                    name: { en: 'Catalog override' },
                    description: null,
                    config: { showHeader: false },
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            layoutZoneWidgets: [
                {
                    id: 'old-global-widget-id',
                    layoutId: 'old-global-layout-id',
                    zone: 'left',
                    widgetKey: 'menuWidget',
                    sortOrder: 1,
                    config: { showTitle: true },
                    isActive: true
                },
                {
                    id: 'old-owned-widget-id',
                    layoutId: 'old-catalog-layout-id',
                    zone: 'right',
                    widgetKey: 'statsOverview',
                    sortOrder: 1,
                    config: { compact: true },
                    isActive: true
                }
            ],
            catalogLayoutWidgetOverrides: [
                {
                    id: 'old-override-id',
                    catalogLayoutId: 'old-catalog-layout-id',
                    baseWidgetId: 'old-global-widget-id',
                    zone: 'top',
                    sortOrder: 2,
                    config: { showTitle: false },
                    isActive: true,
                    isDeletedOverride: false
                }
            ]
        } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(insertedRows['_mhb_layouts']).toHaveLength(2)
        const globalLayoutRow = insertedRows['_mhb_layouts']![0] as Record<string, unknown>
        const catalogLayoutRow = insertedRows['_mhb_layouts']![1] as Record<string, unknown>
        const globalWidgetRow = insertedRows['_mhb_widgets']![0] as Record<string, unknown>
        const catalogWidgetRow = insertedRows['_mhb_widgets']![1] as Record<string, unknown>
        const overrideRow = insertedRows['_mhb_catalog_widget_overrides']![0] as Record<string, unknown>

        expect(globalLayoutRow).toMatchObject({
            catalog_id: null,
            base_layout_id: null,
            template_key: 'dashboard',
            is_default: true
        })
        expect(catalogLayoutRow).toMatchObject({
            catalog_id: 'generated-id-1',
            base_layout_id: globalLayoutRow.id,
            template_key: 'dashboard',
            is_default: true
        })

        expect(insertedRows['_mhb_widgets']).toHaveLength(2)
        expect(globalWidgetRow).toMatchObject({
            layout_id: globalLayoutRow.id,
            zone: 'left',
            widget_key: 'menuWidget'
        })
        expect(catalogWidgetRow).toMatchObject({
            layout_id: catalogLayoutRow.id,
            zone: 'right',
            widget_key: 'statsOverview'
        })

        expect(insertedRows['_mhb_catalog_widget_overrides']).toHaveLength(1)
        expect(overrideRow).toMatchObject({
            catalog_layout_id: catalogLayoutRow.id,
            base_widget_id: globalWidgetRow.id,
            zone: 'top',
            sort_order: 2,
            is_active: true,
            is_deleted_override: false
        })
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
                        sortOrder: 0
                    }
                ]
            }
        } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        // Should not throw; orphaned constants are skipped with a warning
        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(insertedRows['_mhb_constants']).toBeUndefined()
    })

    it('restores shared containers, shared entities, and remapped shared overrides', async () => {
        const snapshot = makeMinimalSnapshot({
            entities: {
                'old-catalog-id': {
                    id: 'old-catalog-id',
                    kind: 'catalog',
                    codename: 'products',
                    presentation: { name: { en: 'Products' }, description: {} },
                    config: {},
                    fields: [],
                    hubs: []
                },
                'old-set-id': {
                    id: 'old-set-id',
                    kind: 'set',
                    codename: 'sizes',
                    presentation: { name: { en: 'Sizes' }, description: {} },
                    config: {},
                    fields: [],
                    hubs: []
                },
                'old-enum-id': {
                    id: 'old-enum-id',
                    kind: 'enumeration',
                    codename: 'statuses',
                    presentation: { name: { en: 'Statuses' }, description: {} },
                    config: {},
                    fields: [],
                    hubs: []
                }
            },
            sharedAttributes: [
                {
                    id: 'old-shared-attribute-id',
                    codename: 'shared_title',
                    dataType: 'STRING',
                    isRequired: false,
                    isDisplayAttribute: false,
                    presentation: { name: { en: 'Shared Title' }, description: {} },
                    validationRules: {},
                    uiConfig: {},
                    sortOrder: 0
                }
            ],
            sharedConstants: [
                {
                    id: 'old-shared-constant-id',
                    objectId: 'old-shared-set-container-id',
                    codename: 'shared_size',
                    dataType: 'STRING',
                    presentation: { name: { en: 'Shared Size' } },
                    validationRules: {},
                    uiConfig: {},
                    value: 'shared',
                    sortOrder: 0
                }
            ],
            sharedEnumerationValues: [
                {
                    id: 'old-shared-value-id',
                    objectId: 'old-shared-enum-container-id',
                    codename: 'shared_default',
                    presentation: { name: { en: 'Shared Default' }, description: {} },
                    sortOrder: 0,
                    isDefault: false
                }
            ],
            sharedEntityOverrides: [
                {
                    id: 'override-attribute-id',
                    entityKind: 'attribute',
                    sharedEntityId: 'old-shared-attribute-id',
                    targetObjectId: 'old-catalog-id',
                    isExcluded: false,
                    isActive: true,
                    sortOrder: 0
                },
                {
                    id: 'override-constant-id',
                    entityKind: 'constant',
                    sharedEntityId: 'old-shared-constant-id',
                    targetObjectId: 'old-set-id',
                    isExcluded: false,
                    isActive: true,
                    sortOrder: 0
                },
                {
                    id: 'override-value-id',
                    entityKind: 'value',
                    sharedEntityId: 'old-shared-value-id',
                    targetObjectId: 'old-enum-id',
                    isExcluded: true,
                    isActive: true,
                    sortOrder: 1
                }
            ]
        } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        const objectRows = (insertedRows['_mhb_objects'] ?? []) as Record<string, unknown>[]
        expect(objectRows).toHaveLength(6)
        expect(objectRows.slice(3).map((row) => row.kind)).toEqual(['shared-catalog-pool', 'shared-set-pool', 'shared-enumeration-pool'])

        const sharedAttributeRow = insertedRows['_mhb_attributes']![0] as Record<string, unknown>
        const sharedConstantRow = insertedRows['_mhb_constants']![0] as Record<string, unknown>
        const sharedValueRow = insertedRows['_mhb_values']![0] as Record<string, unknown>
        const overrideRows = insertedRows['_mhb_shared_entity_overrides'] as Record<string, unknown>[]

        expect(sharedAttributeRow).toMatchObject({
            object_id: objectRows[3]?.id,
            codename: expect.objectContaining({ _schema: '1' })
        })
        expect(sharedConstantRow).toMatchObject({
            object_id: objectRows[4]?.id,
            codename: expect.objectContaining({ _schema: '1' })
        })
        expect(sharedValueRow).toMatchObject({
            object_id: objectRows[5]?.id,
            codename: expect.objectContaining({ _schema: '1' })
        })

        expect(overrideRows).toHaveLength(3)
        expect(overrideRows[0]).toMatchObject({
            entity_kind: 'attribute',
            shared_entity_id: sharedAttributeRow.id,
            target_object_id: objectRows[0]?.id,
            is_excluded: false,
            is_active: true,
            sort_order: 0
        })
        expect(overrideRows[1]).toMatchObject({
            entity_kind: 'constant',
            shared_entity_id: sharedConstantRow.id,
            target_object_id: objectRows[1]?.id,
            is_excluded: false,
            is_active: true,
            sort_order: 0
        })
        expect(overrideRows[2]).toMatchObject({
            entity_kind: 'value',
            shared_entity_id: sharedValueRow.id,
            target_object_id: objectRows[2]?.id,
            is_excluded: true,
            is_active: true,
            sort_order: 1
        })
    })

    it('handles empty snapshot gracefully', async () => {
        const snapshot = makeMinimalSnapshot({
            entities: {},
            constants: {},
            enumerationValues: {},
            elements: {}
        })

        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(insertedRows['_mhb_objects']).toBeUndefined()
    })
})
