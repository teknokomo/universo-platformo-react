import { SnapshotSerializer } from '../../domains/publications/services/SnapshotSerializer'

const createCustomTypeComponents = () => ({
    dataSchema: { enabled: true },
    predefinedElements: { enabled: true },
    hubAssignment: false,
    enumerationValues: false,
    constants: false,
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
        const attributesService = {
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

        const serializer = new SnapshotSerializer(objectsService as never, attributesService as never)
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
        const attributesService = {
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
        const constantsService = {
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
        const enumerationValuesService = {
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
            attributesService as never,
            undefined,
            undefined,
            enumerationValuesService as never,
            constantsService as never,
            undefined,
            sharedContainerService as never,
            sharedEntityOverridesService as never
        )

        const exportedSnapshot = await serializer.serializeMetahub('metahub-1')

        expect(exportedSnapshot.versionEnvelope.snapshotFormatVersion).toBe(3)
        expect(exportedSnapshot.sharedAttributes).toHaveLength(1)
        expect(exportedSnapshot.sharedConstants).toHaveLength(1)
        expect(exportedSnapshot.sharedEnumerationValues).toHaveLength(1)
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
            constants: {
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
            enumerationValues: {
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
        expect(runtimeSnapshot.constants?.['set-1']?.map((constant) => constant.id)).toEqual(['shared-constant-1', 'local-constant-1'])
        expect(runtimeSnapshot.enumerationValues?.['enum-1']?.map((value) => value.id)).toEqual(['local-value-1'])
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
        const attributesService = {
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
            listObjectSystemAttributes: jest.fn(async () => []),
            getObjectSystemFieldsSnapshot: jest.fn(async () => ({ fields: [], lifecycleContract: null }))
        }
        const elementsService = {
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
            listCustomTypes: jest.fn(async () => [
                {
                    id: 'type-1',
                    kindKey: 'customer_registry',
                    isBuiltin: false,
                    components: createCustomTypeComponents(),
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
            attributesService as never,
            elementsService as never,
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
