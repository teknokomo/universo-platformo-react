const mockReadPlatformSystemComponentsPolicy = jest.fn(async () => ({
    publishEnabled: true,
    archiveEnabled: true,
    deleteEnabled: true
}))
const mockEnsureCatalogSystemComponentsSeed = jest.fn(async () => undefined)

jest.mock('../../domains/templates/services/systemComponentSeed', () => ({
    __esModule: true,
    readPlatformSystemComponentsPolicyWithKnex: mockReadPlatformSystemComponentsPolicy,
    ensureObjectSystemComponentsSeed: mockEnsureCatalogSystemComponentsSeed
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
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(1),
        raw: jest.fn((sql: string) => ({ raw: sql })),
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
                'old-object-id': {
                    kind: 'object',
                    codename: 'products',
                    presentation: { name: { en: 'Products' }, description: {} },
                    config: {},
                    fields: [
                        {
                            id: 'old-field-id',
                            codename: 'title',
                            dataType: 'STRING',
                            isRequired: false,
                            isDisplayComponent: true,
                            presentation: { name: { en: 'Title' }, description: {} },
                            validationRules: {},
                            uiConfig: {},
                            sortOrder: 1
                        }
                    ]
                }
            },
            fixedValues: {},
            optionValues: {},
            elements: {},
            systemFields: {},
            ...overrides
        } as unknown as MetahubSnapshot)

    it('creates entities and components from a minimal snapshot', async () => {
        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        await service.restoreFromSnapshot('metahub-1', makeMinimalSnapshot(), 'user-1')

        expect(insertedRows['_mhb_objects']).toHaveLength(1)
        expect(insertedRows['_mhb_objects']![0]).toMatchObject({
            kind: 'object',
            codename: expect.objectContaining({ _schema: '1' })
        })
        expect(insertedRows['_mhb_components']).toHaveLength(1)
        expect(insertedRows['_mhb_components']![0]).toMatchObject({
            codename: expect.objectContaining({ _schema: '1' }),
            data_type: 'STRING'
        })
        expect(mockEnsureCatalogSystemComponentsSeed).toHaveBeenCalled()
    })

    it('rejects imported ledger configs with invalid field references before restoring entities', async () => {
        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')
        const snapshot = makeMinimalSnapshot({
            entities: {
                'old-ledger-id': {
                    kind: 'ledger',
                    codename: 'ProgressLedger',
                    presentation: { name: { en: 'Progress Ledger' }, description: {} },
                    config: {
                        ledger: {
                            fieldRoles: [{ fieldCodename: 'MissingField', role: 'dimension' }],
                            projections: [],
                            idempotency: { keyFields: [] }
                        }
                    },
                    fields: []
                }
            },
            entityTypeDefinitions: {
                ledger: {
                    id: 'type-ledger',
                    kindKey: 'ledger',
                    codename: 'ledger',
                    presentation: { name: { en: 'Ledgers' }, description: {} },
                    capabilities: {
                        dataSchema: { enabled: true },
                        physicalTable: { enabled: true },
                        ledgerSchema: { enabled: true }
                    },
                    ui: {
                        iconName: 'IconDatabase',
                        tabs: ['general', 'ledgerSchema'],
                        sidebarSection: 'objects',
                        nameKey: 'metahubs:ledgers.title'
                    },
                    config: {}
                }
            }
        })

        await expect(service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')).rejects.toMatchObject({
            message: 'Ledger schema config contains invalid field references',
            details: {
                field: 'config.ledger',
                errors: [expect.objectContaining({ code: 'FIELD_NOT_FOUND' })]
            }
        })
        expect(insertedRows['_mhb_objects']).toBeUndefined()
    })

    it('updates existing entity type definitions instead of inserting duplicates during snapshot restore', async () => {
        const { knex, mockBuilder, insertedRows } = createMockKnex()
        mockBuilder.first.mockResolvedValueOnce({ id: 'existing-page-type' })
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        await service.restoreFromSnapshot(
            'metahub-1',
            makeMinimalSnapshot({
                entityTypeDefinitions: {
                    page: {
                        id: 'old-page-type',
                        kindKey: 'page',
                        codename: 'page',
                        presentation: { name: { en: 'Pages' }, description: {} },
                        capabilities: { blockContent: { enabled: true } },
                        ui: { tabs: ['general'], sidebarSection: 'objects' },
                        config: {},
                        published: true
                    }
                }
            } as unknown as Partial<MetahubSnapshot>),
            'user-1'
        )

        expect(insertedRows['_mhb_entity_type_definitions']).toBeUndefined()
        expect(mockBuilder.update).toHaveBeenCalledWith(
            expect.objectContaining({
                kind_key: 'page',
                _upl_version: { raw: '_upl_version + 1' }
            })
        )
    })

    it('normalizes imported Page block content through the shared storage schema', async () => {
        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        await service.restoreFromSnapshot(
            'metahub-1',
            makeMinimalSnapshot({
                entities: {
                    'old-page-id': {
                        id: 'old-page-id',
                        kind: 'page',
                        codename: 'learner-home',
                        presentation: { name: { en: 'Learner Home' }, description: {} },
                        config: {
                            blockContent: {
                                time: 1,
                                version: '2.31.0',
                                blocks: [
                                    {
                                        id: 'welcome-title',
                                        type: 'header',
                                        data: { text: 'Welcome', level: 2 }
                                    }
                                ]
                            }
                        },
                        fields: [],
                        hubs: []
                    }
                },
                entityTypeDefinitions: {
                    page: {
                        id: 'old-page-type',
                        kindKey: 'page',
                        codename: 'page',
                        presentation: { name: { en: 'Pages' }, description: {} },
                        capabilities: {
                            blockContent: {
                                enabled: true,
                                storage: 'objectConfig',
                                defaultFormat: 'editorjs',
                                supportedFormats: ['editorjs'],
                                allowedBlockTypes: ['paragraph', 'header'],
                                maxBlocks: 500
                            }
                        },
                        ui: { tabs: ['general', 'content'], sidebarSection: 'objects', iconName: 'IconFileText', nameKey: 'Pages' },
                        config: {},
                        published: true
                    }
                }
            } as unknown as Partial<MetahubSnapshot>),
            'user-1'
        )

        expect(insertedRows['_mhb_objects']).toHaveLength(1)
        expect(insertedRows['_mhb_objects']![0]).toMatchObject({
            kind: 'page',
            config: {
                blockContent: {
                    format: 'editorjs',
                    data: {
                        version: '2.31.0',
                        blocks: [
                            {
                                id: 'welcome-title',
                                type: 'header',
                                data: { text: 'Welcome', level: 2 }
                            }
                        ]
                    }
                }
            }
        })
    })

    it('rejects unsafe imported Page block content before writing objects', async () => {
        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        await expect(
            service.restoreFromSnapshot(
                'metahub-1',
                makeMinimalSnapshot({
                    entities: {
                        'old-page-id': {
                            id: 'old-page-id',
                            kind: 'page',
                            codename: 'unsafe-page',
                            presentation: { name: { en: 'Unsafe Page' }, description: {} },
                            config: {
                                blockContent: {
                                    format: 'editorjs',
                                    blocks: [
                                        {
                                            id: 'unsafe-paragraph',
                                            type: 'paragraph',
                                            data: { text: '<script>alert(1)</script>' }
                                        }
                                    ]
                                }
                            },
                            fields: [],
                            hubs: []
                        }
                    },
                    entityTypeDefinitions: {
                        page: {
                            id: 'old-page-type',
                            kindKey: 'page',
                            codename: 'page',
                            presentation: { name: { en: 'Pages' }, description: {} },
                            capabilities: {
                                blockContent: {
                                    enabled: true,
                                    storage: 'objectConfig',
                                    defaultFormat: 'editorjs',
                                    supportedFormats: ['editorjs'],
                                    allowedBlockTypes: ['paragraph'],
                                    maxBlocks: 500
                                }
                            },
                            ui: { tabs: ['general', 'content'], sidebarSection: 'objects', iconName: 'IconFileText', nameKey: 'Pages' },
                            config: {},
                            published: true
                        }
                    }
                } as unknown as Partial<MetahubSnapshot>),
                'user-1'
            )
        ).rejects.toThrow('Invalid imported page block content')

        expect(insertedRows['_mhb_objects']).toBeUndefined()
    })

    it('rejects imported Page block content that violates Entity-specific block constraints', async () => {
        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        await expect(
            service.restoreFromSnapshot(
                'metahub-1',
                makeMinimalSnapshot({
                    entities: {
                        'old-page-id': {
                            id: 'old-page-id',
                            kind: 'page',
                            codename: 'disallowed-page',
                            presentation: { name: { en: 'Disallowed Page' }, description: {} },
                            config: {
                                blockContent: {
                                    format: 'editorjs',
                                    blocks: [
                                        {
                                            id: 'welcome-title',
                                            type: 'header',
                                            data: { text: 'Welcome', level: 2 }
                                        }
                                    ]
                                }
                            },
                            fields: [],
                            hubs: []
                        }
                    },
                    entityTypeDefinitions: {
                        page: {
                            id: 'old-page-type',
                            kindKey: 'page',
                            codename: 'page',
                            presentation: { name: { en: 'Pages' }, description: {} },
                            capabilities: {
                                blockContent: {
                                    enabled: true,
                                    storage: 'objectConfig',
                                    defaultFormat: 'editorjs',
                                    supportedFormats: ['editorjs'],
                                    allowedBlockTypes: ['paragraph'],
                                    maxBlocks: 500
                                }
                            },
                            ui: { tabs: ['general', 'content'], sidebarSection: 'objects', iconName: 'IconFileText', nameKey: 'Pages' },
                            config: {},
                            published: true
                        }
                    }
                } as unknown as Partial<MetahubSnapshot>),
                'user-1'
            )
        ).rejects.toThrow('Invalid imported page block content')

        expect(insertedRows['_mhb_objects']).toBeUndefined()
    })

    it('restores a legacy snapshot that omits v3 entity metadata sections', async () => {
        const snapshot = makeMinimalSnapshot({
            scripts: [
                {
                    id: 'old-script-id',
                    codename: {
                        _schema: '1',
                        _primary: 'en',
                        locales: {
                            en: { content: 'legacy_hook', version: 1, isActive: true }
                        }
                    },
                    presentation: { name: { en: 'Legacy hook' } },
                    attachedToKind: 'metahub',
                    attachedToId: null,
                    moduleRole: 'shared',
                    sourceKind: 'embedded',
                    sdkApiVersion: '1.0.0',
                    manifest: {
                        className: 'LegacyHook',
                        sdkApiVersion: '1.0.0',
                        moduleRole: 'shared',
                        sourceKind: 'embedded',
                        capabilities: ['rpc.server'],
                        methods: []
                    },
                    serverBundle: 'legacy-server-bundle',
                    clientBundle: null,
                    checksum: 'legacy-checksum',
                    isActive: true,
                    config: {},
                    sourceCode:
                        "import { ExtensionScript } from '@universo/extension-sdk'\nexport default class LegacyHook extends ExtensionScript {}"
                }
            ],
            entityTypeDefinitions: undefined
        } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(insertedRows['_mhb_objects']).toHaveLength(1)
        expect(insertedRows['_mhb_components']).toHaveLength(1)
        expect(insertedRows['_mhb_scripts']).toHaveLength(1)
        expect(insertedRows['_mhb_scripts']![0]).toMatchObject({
            codename: expect.objectContaining({ _schema: '1' }),
            source_code: expect.stringContaining('LegacyHook extends ExtensionScript')
        })
        expect(insertedRows['_mhb_entity_type_definitions']).toBeUndefined()
        expect(insertedRows['_mhb_actions']).toBeUndefined()
        expect(insertedRows['_mhb_event_bindings']).toBeUndefined()
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
                'old-object-id': {
                    id: 'old-object-id',
                    kind: 'object',
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

        // Hub is created first, then object references the new hub ID
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
            fixedValues: {
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

        expect(deletedTables).toEqual(['_mhb_scripts', '_mhb_widgets', '_mhb_layout_widget_overrides', '_mhb_layouts'])
        expect(insertedRows['_mhb_layouts']).toHaveLength(1)
        expect(insertedRows['_mhb_layouts']![0]).toMatchObject({
            scope_entity_id: null,
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
                'old-object-id': {
                    id: 'old-object-id',
                    kind: 'object',
                    codename: 'products',
                    presentation: { name: { en: 'Products' }, description: {} },
                    config: {},
                    fields: [
                        {
                            id: 'old-field-id',
                            codename: 'title',
                            dataType: 'STRING',
                            isRequired: false,
                            isDisplayComponent: true,
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
                    id: 'script-component-id',
                    codename: 'component-hook',
                    presentation: { name: { en: 'Component hook' } },
                    attachedToKind: 'component',
                    attachedToId: 'old-field-id',
                    moduleRole: 'lifecycle',
                    sourceKind: 'embedded',
                    sdkApiVersion: '1.0.0',
                    manifest: {
                        className: 'ComponentHook',
                        sdkApiVersion: '1.0.0',
                        moduleRole: 'lifecycle',
                        sourceKind: 'embedded',
                        capabilities: ['records.read', 'records.write', 'metadata.read', 'lifecycle'],
                        methods: []
                    },
                    serverBundle: 'component server bundle',
                    clientBundle: null,
                    checksum: 'checksum-component',
                    isActive: true,
                    config: {},
                    sourceCode:
                        "import { ExtensionScript } from '@universo/extension-sdk'\nexport default class ComponentHook extends ExtensionScript {}"
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
            attached_to_kind: 'component',
            attached_to_id: 'generated-id-2',
            source_code: expect.stringContaining('ComponentHook extends ExtensionScript'),
            server_bundle: 'component server bundle'
        })
    })

    it('restores snapshot v3 custom entity definitions with remapped actions and event bindings', async () => {
        const snapshot = makeMinimalSnapshot({
            entities: {
                'old-custom-object-id': {
                    id: 'old-custom-object-id',
                    kind: 'customer_registry',
                    codename: 'customer_registry',
                    presentation: { name: { en: 'Customer Registry' }, description: {} },
                    config: {},
                    tableName: 'cust_customer_registry',
                    fields: [],
                    hubs: [],
                    actions: [
                        {
                            id: 'old-action-id',
                            codename: 'sync_customer',
                            presentation: { name: { en: 'Sync customer' } },
                            actionType: 'script',
                            scriptId: 'old-script-id',
                            config: { mode: 'sync' },
                            sortOrder: 1
                        }
                    ],
                    eventBindings: [
                        {
                            id: 'old-binding-id',
                            eventName: 'afterCreate',
                            actionId: 'old-action-id',
                            priority: 2,
                            isActive: true,
                            config: { trigger: 'runtime' }
                        }
                    ]
                }
            },
            entityTypeDefinitions: {
                customer_registry: {
                    id: 'old-type-id',
                    kindKey: 'customer_registry',
                    codename: 'customer_registry',
                    presentation: { name: { en: 'Customer Registry' }, description: {} },
                    capabilities: {
                        dataSchema: { enabled: true },
                        records: false,
                        treeAssignment: false,
                        optionValues: false,
                        fixedValues: false,
                        hierarchy: false,
                        nestedCollections: false,
                        relations: false,
                        actions: { enabled: true },
                        events: { enabled: true },
                        scripting: false,
                        layoutConfig: false,
                        runtimeBehavior: false,
                        physicalTable: { enabled: true, prefix: 'cust' }
                    },
                    ui: {
                        iconName: 'IconUsers',
                        tabs: ['general'],
                        sidebarSection: 'objects',
                        nameKey: 'metahubs:entities.customerRegistry'
                    },
                    config: { publishedSection: true },
                    published: true
                }
            },
            scripts: [
                {
                    id: 'old-script-id',
                    codename: 'customer_hook',
                    presentation: { name: { en: 'Customer hook' } },
                    attachedToKind: 'metahub',
                    attachedToId: null,
                    moduleRole: 'lifecycle',
                    sourceKind: 'embedded',
                    sdkApiVersion: '1.0.0',
                    manifest: {
                        className: 'CustomerHook',
                        sdkApiVersion: '1.0.0',
                        moduleRole: 'lifecycle',
                        sourceKind: 'embedded',
                        capabilities: ['records.read', 'records.write', 'metadata.read', 'lifecycle'],
                        methods: []
                    },
                    serverBundle: 'customer hook bundle',
                    clientBundle: null,
                    checksum: 'checksum-customer-hook',
                    isActive: true,
                    config: {},
                    sourceCode:
                        "import { ExtensionScript } from '@universo/extension-sdk'\nexport default class CustomerHook extends ExtensionScript {}"
                }
            ]
        } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(insertedRows['_mhb_entity_type_definitions']).toHaveLength(1)
        expect(insertedRows['_mhb_entity_type_definitions']![0]).toMatchObject({
            kind_key: 'customer_registry',
            _mhb_published: true
        })

        expect(insertedRows['_mhb_actions']).toHaveLength(1)
        expect(insertedRows['_mhb_event_bindings']).toHaveLength(1)

        const objectRow = insertedRows['_mhb_objects']![0] as Record<string, unknown>
        const scriptRow = insertedRows['_mhb_scripts']![0] as Record<string, unknown>
        const actionRow = insertedRows['_mhb_actions']![0] as Record<string, unknown>
        const eventBindingRow = insertedRows['_mhb_event_bindings']![0] as Record<string, unknown>

        expect(objectRow).toMatchObject({
            kind: 'customer_registry',
            table_name: 'cust_customer_registry'
        })
        expect(actionRow).toMatchObject({
            object_id: objectRow.id,
            action_type: 'script',
            script_id: scriptRow.id
        })
        expect(eventBindingRow).toMatchObject({
            object_id: objectRow.id,
            event_name: 'afterCreate',
            action_id: actionRow.id,
            priority: 2,
            is_active: true
        })
    })

    it('clears seeded layouts even when snapshot has no layouts', async () => {
        const snapshot = makeMinimalSnapshot({ layouts: [], layoutZoneWidgets: [] } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows, deletedTables } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(deletedTables).toEqual(['_mhb_scripts', '_mhb_widgets', '_mhb_layout_widget_overrides', '_mhb_layouts'])
        expect(insertedRows['_mhb_layouts']).toBeUndefined()
        expect(insertedRows['_mhb_widgets']).toBeUndefined()
    })

    it('restores scoped layouts and sparse widget overrides with remapped ids', async () => {
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
            scopedLayouts: [
                {
                    id: 'old-object-layout-id',
                    scopeEntityId: 'old-object-id',
                    baseLayoutId: 'old-global-layout-id',
                    templateKey: 'dashboard',
                    name: { en: 'Entity override' },
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
                    layoutId: 'old-object-layout-id',
                    zone: 'right',
                    widgetKey: 'statsOverview',
                    sortOrder: 1,
                    config: { compact: true },
                    isActive: true
                }
            ],
            layoutWidgetOverrides: [
                {
                    id: 'old-override-id',
                    layoutId: 'old-object-layout-id',
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
        const scopedLayoutRow = insertedRows['_mhb_layouts']![1] as Record<string, unknown>
        const globalWidgetRow = insertedRows['_mhb_widgets']![0] as Record<string, unknown>
        const scopedWidgetRow = insertedRows['_mhb_widgets']![1] as Record<string, unknown>
        const overrideRow = insertedRows['_mhb_layout_widget_overrides']![0] as Record<string, unknown>

        expect(globalLayoutRow).toMatchObject({
            scope_entity_id: null,
            base_layout_id: null,
            template_key: 'dashboard',
            is_default: true
        })
        expect(scopedLayoutRow).toMatchObject({
            scope_entity_id: 'generated-id-1',
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
        expect(scopedWidgetRow).toMatchObject({
            layout_id: scopedLayoutRow.id,
            zone: 'right',
            widget_key: 'statsOverview'
        })

        expect(insertedRows['_mhb_layout_widget_overrides']).toHaveLength(1)
        expect(overrideRow).toMatchObject({
            layout_id: scopedLayoutRow.id,
            base_widget_id: globalWidgetRow.id,
            zone: 'top',
            sort_order: 2,
            is_active: true,
            is_deleted_override: false
        })
    })

    it('skips entities with missing entityIdMap (with warning)', async () => {
        const snapshot = makeMinimalSnapshot({
            fixedValues: {
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
                'old-object-id': {
                    id: 'old-object-id',
                    kind: 'object',
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
            sharedComponents: [
                {
                    id: 'old-shared-component-id',
                    codename: 'shared_title',
                    dataType: 'STRING',
                    isRequired: false,
                    isDisplayComponent: false,
                    presentation: { name: { en: 'Shared Title' }, description: {} },
                    validationRules: {},
                    uiConfig: {},
                    sortOrder: 0
                }
            ],
            sharedFixedValues: [
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
            sharedOptionValues: [
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
                    id: 'override-component-id',
                    entityKind: 'component',
                    sharedEntityId: 'old-shared-component-id',
                    targetObjectId: 'old-object-id',
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
        expect(objectRows.slice(3).map((row) => row.kind)).toEqual(['shared-object-pool', 'shared-set-pool', 'shared-enumeration-pool'])

        const sharedComponentRow = insertedRows['_mhb_components']![0] as Record<string, unknown>
        const sharedConstantRow = insertedRows['_mhb_constants']![0] as Record<string, unknown>
        const sharedValueRow = insertedRows['_mhb_values']![0] as Record<string, unknown>
        const overrideRows = insertedRows['_mhb_shared_entity_overrides'] as Record<string, unknown>[]

        expect(sharedComponentRow).toMatchObject({
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
            entity_kind: 'component',
            shared_entity_id: sharedComponentRow.id,
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
            fixedValues: {},
            optionValues: {},
            elements: {}
        })

        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(insertedRows['_mhb_objects']).toBeUndefined()
    })

    it('preserves snapshot ids for restored enumeration values and elements', async () => {
        const snapshot = makeMinimalSnapshot({
            entities: {
                'old-object-id': {
                    id: 'old-object-id',
                    kind: 'object',
                    codename: 'products',
                    presentation: { name: { en: 'Products' }, description: {} },
                    config: {},
                    fields: [
                        {
                            id: 'status-field-id',
                            codename: 'status',
                            dataType: 'REF',
                            isRequired: true,
                            isDisplayComponent: false,
                            targetEntityId: 'old-enum-id',
                            targetEntityKind: 'enumeration',
                            presentation: { name: { en: 'Status' }, description: {} },
                            validationRules: {},
                            uiConfig: {},
                            sortOrder: 1
                        }
                    ]
                },
                'old-enum-id': {
                    id: 'old-enum-id',
                    kind: 'enumeration',
                    codename: 'moduleStatus',
                    presentation: { name: { en: 'Module status' }, description: {} },
                    config: {},
                    fields: []
                }
            },
            optionValues: {
                'old-enum-id': [
                    {
                        id: 'enum-value-id',
                        objectId: 'old-enum-id',
                        codename: 'Published',
                        presentation: { name: { en: 'Published' } },
                        sortOrder: 1,
                        isDefault: true
                    }
                ]
            },
            elements: {
                'old-object-id': [
                    {
                        id: 'element-id',
                        objectId: 'old-object-id',
                        data: { status: 'enum-value-id' },
                        sortOrder: 1
                    }
                ]
            }
        } as unknown as MetahubSnapshot)

        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'test_schema')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(insertedRows['_mhb_values']?.[0]).toMatchObject({
            id: 'enum-value-id'
        })
        expect(insertedRows['_mhb_elements']?.[0]).toMatchObject({
            id: 'element-id',
            data: { status: 'enum-value-id' }
        })
    })
})
