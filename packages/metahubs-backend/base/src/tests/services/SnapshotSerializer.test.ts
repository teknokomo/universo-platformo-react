import { SnapshotSerializer } from '../../domains/publications/services/SnapshotSerializer'

const createEntityTypeComponents = () => ({
    dataSchema: { enabled: true },
    records: { enabled: true },
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
})

const createCodenameVlc = (primary: string, secondary?: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: { content: primary, version: 1, isActive: true },
        ...(secondary ? { ru: { content: secondary, version: 1, isActive: true } } : {})
    }
})

describe('SnapshotSerializer system field propagation', () => {
    it('serializes dedicated systemFields and keeps runtime business fields separate', async () => {
        const objectsService = {
            findAllByKind: jest.fn(async (_metahubId: string, kind: string) => {
                if (kind === 'catalog') {
                    return [
                        {
                            id: 'catalog-1',
                            codename: createCodenameVlc('products', 'товары'),
                            table_name: 'cat_products',
                            presentation: { name: { en: 'Products' }, description: {} },
                            config: { hubs: [] }
                        }
                    ]
                }
                return []
            })
        }
        const fieldDefinitionsService = {
            findAllFlatForSnapshot: jest.fn(async () => [
                {
                    id: 'field-1',
                    codename: createCodenameVlc('title', 'название'),
                    dataType: 'STRING',
                    isRequired: false,
                    isDisplayAttribute: true,
                    targetEntityId: null,
                    targetEntityKind: null,
                    targetConstantId: null,
                    name: { en: 'Title' },
                    description: {},
                    validationRules: {},
                    uiConfig: {},
                    sortOrder: 1,
                    parentAttributeId: null,
                    system: { isSystem: false, systemKey: null, isManaged: false, isEnabled: true }
                },
                {
                    id: 'field-system',
                    codename: '_app_deleted',
                    dataType: 'BOOLEAN',
                    isRequired: false,
                    isDisplayAttribute: false,
                    targetEntityId: null,
                    targetEntityKind: null,
                    targetConstantId: null,
                    name: { en: 'Deleted flag' },
                    description: {},
                    validationRules: {},
                    uiConfig: {},
                    sortOrder: 2,
                    parentAttributeId: null,
                    system: { isSystem: true, systemKey: 'app.deleted', isManaged: true, isEnabled: false }
                }
            ]),
            getCatalogSystemFieldsSnapshot: jest.fn(async () => ({
                fields: [{ key: 'app.deleted', enabled: false }],
                lifecycleContract: {
                    publish: { enabled: true, trackAt: true, trackBy: true },
                    archive: { enabled: true, trackAt: true, trackBy: true },
                    delete: { mode: 'hard', trackAt: false, trackBy: false }
                }
            }))
        }

        const entityTypeService = {
            listTypes: jest.fn(async () => [
                {
                    id: 'type-catalog',
                    kindKey: 'catalog',
                    codename: createCodenameVlc('catalog'),
                    presentation: { name: { en: 'Catalogs' }, description: {} },
                    components: createEntityTypeComponents(),
                    ui: {
                        iconName: 'IconDatabase',
                        tabs: ['general'],
                        sidebarSection: 'objects',
                        nameKey: 'metahubs:linkedCollections.title'
                    },
                    config: {},
                    published: true
                }
            ])
        }

        const serializer = new SnapshotSerializer(
            objectsService as never,
            fieldDefinitionsService as never,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            entityTypeService as never
        )
        const snapshot = await serializer.serializeMetahub('metahub-1')
        const runtimeEntities = serializer.deserializeSnapshot(snapshot)

        expect(snapshot.systemFields?.['catalog-1']).toEqual({
            fields: [{ key: 'app.deleted', enabled: false }],
            lifecycleContract: {
                publish: { enabled: true, trackAt: true, trackBy: true },
                archive: { enabled: true, trackAt: true, trackBy: true },
                delete: { mode: 'hard', trackAt: false, trackBy: false }
            }
        })
        expect(snapshot.entities['catalog-1'].fields).toHaveLength(1)
        expect(snapshot.entities['catalog-1'].codename).toEqual(createCodenameVlc('products', 'товары'))
        expect(snapshot.entities['catalog-1'].fields[0].codename).toEqual(createCodenameVlc('title', 'название'))
        expect(runtimeEntities[0].codename).toBe('products')
        expect(runtimeEntities[0].fields[0].codename).toBe('title')
        expect(runtimeEntities[0].config?.systemFields).toEqual(snapshot.systemFields?.['catalog-1'])
    })

    it('serializes shared sections and materializes them into runtime entities', async () => {
        const objectsService = {
            findAllByKind: jest.fn(async () => [])
        }
        const fieldDefinitionsService = {
            findAllFlatForSnapshot: jest.fn(async (_metahubId: string, objectId: string) => {
                if (objectId === 'shared-catalog-pool-id') {
                    return [
                        {
                            id: 'shared-field-1',
                            codename: createCodenameVlc('shared_title', 'общее_название'),
                            dataType: 'STRING',
                            isRequired: false,
                            isDisplayAttribute: false,
                            targetEntityId: null,
                            targetEntityKind: null,
                            targetConstantId: null,
                            name: { en: 'Shared Title' },
                            description: {},
                            validationRules: {},
                            uiConfig: {},
                            sortOrder: 0,
                            parentAttributeId: null,
                            system: { isSystem: false }
                        }
                    ]
                }

                return []
            }),
            getCatalogSystemFieldsSnapshot: jest.fn(async () => ({ fields: [], lifecycleContract: null }))
        }
        const fixedValuesService = {
            findAll: jest.fn(async (_metahubId: string, objectId: string) => {
                if (objectId === 'shared-set-pool-id') {
                    return [
                        {
                            id: 'shared-constant-1',
                            codename: createCodenameVlc('shared_size'),
                            dataType: 'STRING',
                            name: { en: 'Shared Size' },
                            validationRules: {},
                            uiConfig: {},
                            value: 'shared',
                            sortOrder: 0
                        }
                    ]
                }

                return []
            })
        }
        const optionValuesService = {
            findAll: jest.fn(async (_metahubId: string, objectId: string) => {
                if (objectId === 'shared-enum-pool-id') {
                    return [
                        {
                            id: 'shared-value-1',
                            codename: createCodenameVlc('shared_default'),
                            presentation: { name: { en: 'Shared Default' }, description: {} },
                            sortOrder: 0,
                            isDefault: false
                        }
                    ]
                }

                return []
            })
        }
        const sharedContainerService = {
            findContainerObjectId: jest.fn(async (_metahubId: string, kind: string) => {
                if (kind === 'shared-catalog-pool') return 'shared-catalog-pool-id'
                if (kind === 'shared-set-pool') return 'shared-set-pool-id'
                if (kind === 'shared-enumeration-pool') return 'shared-enum-pool-id'
                return null
            })
        }
        const sharedEntityOverridesService = {
            findAll: jest.fn(async () => [
                {
                    id: 'override-attribute-1',
                    entityKind: 'attribute',
                    sharedEntityId: 'shared-field-1',
                    targetObjectId: 'catalog-1',
                    isExcluded: false,
                    isActive: true,
                    sortOrder: 0,
                    version: 1
                },
                {
                    id: 'override-constant-1',
                    entityKind: 'constant',
                    sharedEntityId: 'shared-constant-1',
                    targetObjectId: 'set-1',
                    isExcluded: false,
                    isActive: true,
                    sortOrder: 0,
                    version: 1
                },
                {
                    id: 'override-value-1',
                    entityKind: 'value',
                    sharedEntityId: 'shared-value-1',
                    targetObjectId: 'enum-1',
                    isExcluded: true,
                    isActive: true,
                    sortOrder: 0,
                    version: 1
                }
            ])
        }

        const serializer = new SnapshotSerializer(
            objectsService as never,
            fieldDefinitionsService as never,
            undefined,
            undefined,
            optionValuesService as never,
            fixedValuesService as never,
            undefined,
            sharedContainerService as never,
            sharedEntityOverridesService as never
        )

        const exportedSnapshot = await serializer.serializeMetahub('metahub-1')

        expect(exportedSnapshot.versionEnvelope.snapshotFormatVersion).toBe(3)
        expect(exportedSnapshot.sharedFieldDefinitions).toHaveLength(1)
        expect(exportedSnapshot.sharedFixedValues).toHaveLength(1)
        expect(exportedSnapshot.sharedOptionValues).toHaveLength(1)
        expect(exportedSnapshot.sharedEntityOverrides).toHaveLength(3)

        const runtimeSnapshot = SnapshotSerializer.materializeSharedEntitiesForRuntime({
            ...exportedSnapshot,
            entities: {
                'catalog-1': {
                    id: 'catalog-1',
                    kind: 'catalog',
                    codename: createCodenameVlc('products'),
                    presentation: { name: { en: 'Products' }, description: {} },
                    config: {},
                    fields: [
                        {
                            id: 'local-field-1',
                            codename: createCodenameVlc('local_title'),
                            dataType: 'STRING',
                            isRequired: false,
                            isDisplayAttribute: false,
                            presentation: { name: { en: 'Local Title' }, description: {} },
                            validationRules: {},
                            uiConfig: {},
                            sortOrder: 1
                        }
                    ],
                    hubs: []
                },
                'set-1': {
                    id: 'set-1',
                    kind: 'set',
                    codename: createCodenameVlc('sizes'),
                    presentation: { name: { en: 'Sizes' }, description: {} },
                    config: {},
                    fields: [],
                    hubs: []
                },
                'enum-1': {
                    id: 'enum-1',
                    kind: 'enumeration',
                    codename: createCodenameVlc('statuses'),
                    presentation: { name: { en: 'Statuses' }, description: {} },
                    config: {},
                    fields: [],
                    hubs: []
                }
            },
            fixedValues: {
                'set-1': [
                    {
                        id: 'local-constant-1',
                        objectId: 'set-1',
                        codename: createCodenameVlc('local_size'),
                        dataType: 'STRING',
                        presentation: { name: { en: 'Local Size' } },
                        validationRules: {},
                        uiConfig: {},
                        value: 'local',
                        sortOrder: 1
                    }
                ]
            },
            optionValues: {
                'enum-1': [
                    {
                        id: 'local-value-1',
                        objectId: 'enum-1',
                        codename: createCodenameVlc('local_default'),
                        presentation: { name: { en: 'Local Default' }, description: {} },
                        sortOrder: 1,
                        isDefault: false
                    }
                ]
            }
        })

        expect(runtimeSnapshot.entities['catalog-1'].fields.map((field) => field.id)).toEqual(['shared-field-1', 'local-field-1'])
        expect(runtimeSnapshot.fixedValues?.['set-1']?.map((fixedValue) => fixedValue.id)).toEqual([
            'shared-constant-1',
            'local-constant-1'
        ])
        expect(runtimeSnapshot.optionValues?.['enum-1']?.map((value) => value.id)).toEqual(['local-value-1'])
    })

    it('serializes the direct standard hub through the hub stream without generic object fallback', async () => {
        const objectsService = {
            findAllByKind: jest.fn(async () => [])
        }
        const fieldDefinitionsService = {
            findAllFlatForSnapshot: jest.fn(async () => []),
            getCatalogSystemFieldsSnapshot: jest.fn(async () => null)
        }
        const treeEntitiesService = {
            findAll: jest.fn(async () => ({
                items: [
                    {
                        id: 'hub-1',
                        kind: 'hub',
                        codename: createCodenameVlc('workspace_hub'),
                        name: { en: 'Workspace Hub' },
                        description: {},
                        sort_order: 0,
                        parent_hub_id: null
                    }
                ],
                total: 1
            }))
        }
        const entityTypeService = {
            listTypes: jest.fn(async () => [
                {
                    id: 'type-hub',
                    kindKey: 'hub',
                    codename: createCodenameVlc('hub'),
                    presentation: { name: { en: 'Hub' }, description: {} },
                    components: createEntityTypeComponents(),
                    ui: {},
                    config: { hierarchyMode: 'tree' },
                    published: true
                }
            ])
        }

        const serializer = new SnapshotSerializer(
            objectsService as never,
            fieldDefinitionsService as never,
            undefined,
            treeEntitiesService as never,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            entityTypeService as never
        )

        const snapshot = await serializer.serializeMetahub('metahub-1')

        expect(objectsService.findAllByKind).not.toHaveBeenCalledWith('metahub-1', 'hub')
        expect(snapshot.entities['hub-1']).toEqual(
            expect.objectContaining({
                id: 'hub-1',
                kind: 'hub',
                codename: createCodenameVlc('workspace_hub'),
                config: expect.objectContaining({
                    sortOrder: 0,
                    parentTreeEntityId: null,
                    hierarchyMode: 'tree'
                })
            })
        )
    })

    it('preserves definition-level compatibility metadata for legacy-compatible custom objects in the generic entity stream', async () => {
        const objectsService = {
            findAllByKind: jest.fn(async (_metahubId: string, kind: string) => {
                if (kind === 'custom.value-group') {
                    return [
                        {
                            id: 'set-1',
                            kind: 'custom.value-group',
                            codename: createCodenameVlc('sizes'),
                            table_name: 'set_sizes',
                            presentation: { name: { en: 'Sizes' }, description: {} },
                            config: {
                                compatibility: { scope: 'workspace' },
                                displayMode: 'chips'
                            }
                        }
                    ]
                }

                return []
            })
        }
        const fieldDefinitionsService = {
            findAllFlatForSnapshot: jest.fn(async () => []),
            getCatalogSystemFieldsSnapshot: jest.fn(async () => null)
        }
        const entityTypeService = {
            listTypes: jest.fn(async () => [
                {
                    id: 'type-value-group',
                    kindKey: 'custom.value-group',
                    codename: createCodenameVlc('value_group'),
                    presentation: { name: { en: 'Value Group' }, description: {} },
                    components: {
                        dataSchema: false,
                        records: false,
                        treeAssignment: false,
                        optionValues: false,
                        fixedValues: { enabled: true },
                        hierarchy: false,
                        nestedCollections: false,
                        relations: false,
                        actions: false,
                        events: false,
                        scripting: false,
                        layoutConfig: false,
                        runtimeBehavior: false,
                        physicalTable: false
                    },
                    ui: {
                        iconName: 'IconFileText',
                        tabs: ['general'],
                        sidebarSection: 'objects',
                        nameKey: 'Value Groups'
                    },
                    config: {
                        compatibility: { legacyObjectKind: 'set', lifecycleMode: 'legacy' },
                        classification: 'design-time'
                    },
                    published: true
                }
            ])
        }

        const serializer = new SnapshotSerializer(
            objectsService as never,
            fieldDefinitionsService as never,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            entityTypeService as never
        )

        const snapshot = await serializer.serializeMetahub('metahub-1')

        expect(snapshot.entities['set-1']).toEqual(
            expect.objectContaining({
                id: 'set-1',
                kind: 'custom.value-group',
                config: {
                    classification: 'design-time',
                    displayMode: 'chips',
                    compatibility: {
                        legacyObjectKind: 'set',
                        lifecycleMode: 'legacy',
                        scope: 'workspace'
                    }
                }
            })
        )
    })

    it('serializes custom entity definitions and nested action/event metadata in snapshot v3', async () => {
        const objectsService = {
            findAllByKind: jest.fn(async (_metahubId: string, kind: string) => {
                if (kind === 'customer_registry') {
                    return [
                        {
                            id: 'custom-object-1',
                            kind: 'customer_registry',
                            codename: createCodenameVlc('customer_registry'),
                            table_name: 'cust_customer_registry',
                            presentation: { name: { en: 'Customer Registry' }, description: {} },
                            config: { hubs: [] }
                        }
                    ]
                }

                return []
            })
        }
        const fieldDefinitionsService = {
            findAllFlatForSnapshot: jest.fn(async () => [
                {
                    id: 'custom-field-1',
                    codename: createCodenameVlc('display_name'),
                    dataType: 'STRING',
                    isRequired: true,
                    isDisplayAttribute: true,
                    targetEntityId: null,
                    targetEntityKind: null,
                    targetConstantId: null,
                    name: { en: 'Display name' },
                    description: {},
                    validationRules: {},
                    uiConfig: {},
                    sortOrder: 1,
                    parentAttributeId: null,
                    system: { isSystem: false }
                }
            ]),
            listObjectSystemFieldDefinitions: jest.fn(async () => []),
            getObjectSystemFieldsSnapshot: jest.fn(async () => ({ fields: [], lifecycleContract: null }))
        }
        const recordsService = {
            findAllByObjectIds: jest.fn(async () => [
                {
                    id: 'element-1',
                    objectId: 'custom-object-1',
                    data: { code: 'A' },
                    sortOrder: 0
                }
            ])
        }
        const entityTypeService = {
            listTypes: jest.fn(async () => [
                {
                    id: 'type-1',
                    kindKey: 'customer_registry',
                    components: createEntityTypeComponents(),
                    ui: {
                        iconName: 'IconUsers',
                        tabs: ['general'],
                        sidebarSection: 'objects',
                        nameKey: 'metahubs:entities.customerRegistry'
                    },
                    codename: createCodenameVlc('customer_registry'),
                    presentation: { name: { en: 'Customer Registry' }, description: {} },
                    config: { publishedSection: true },
                    published: true
                }
            ])
        }
        const actionService = {
            listByObjectId: jest.fn(async () => [
                {
                    id: 'action-1',
                    codename: createCodenameVlc('sync_customer'),
                    presentation: { name: { en: 'Sync customer' } },
                    actionType: 'script',
                    scriptId: 'script-1',
                    config: { mode: 'sync' },
                    sortOrder: 2
                }
            ])
        }
        const eventBindingService = {
            listByObjectId: jest.fn(async () => [
                {
                    id: 'binding-1',
                    eventName: 'afterCreate',
                    actionId: 'action-1',
                    priority: 5,
                    isActive: true,
                    config: { trigger: 'runtime' }
                }
            ])
        }

        const serializer = new SnapshotSerializer(
            objectsService as never,
            fieldDefinitionsService as never,
            recordsService as never,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            entityTypeService as never,
            actionService as never,
            eventBindingService as never
        )

        const snapshot = await serializer.serializeMetahub('metahub-1')
        const runtimeEntities = serializer.deserializeSnapshot(snapshot)

        expect(snapshot.versionEnvelope.snapshotFormatVersion).toBe(3)
        expect(snapshot.entityTypeDefinitions?.customer_registry).toMatchObject({
            id: 'type-1',
            kindKey: 'customer_registry',
            published: true,
            components: expect.objectContaining({
                dataSchema: { enabled: true },
                actions: { enabled: true },
                events: { enabled: true }
            })
        })
        expect(snapshot.entities['custom-object-1']).toMatchObject({
            kind: 'customer_registry',
            tableName: 'cust_customer_registry',
            actions: [
                expect.objectContaining({
                    id: 'action-1',
                    actionType: 'script',
                    scriptId: 'script-1'
                })
            ],
            eventBindings: [
                expect.objectContaining({
                    id: 'binding-1',
                    eventName: 'afterCreate',
                    actionId: 'action-1'
                })
            ]
        })
        expect(runtimeEntities).toHaveLength(1)
        expect(runtimeEntities[0].kind).toBe('customer_registry')
        expect(runtimeEntities[0].physicalTableName).toBe('cust_customer_registry')
    })
})
