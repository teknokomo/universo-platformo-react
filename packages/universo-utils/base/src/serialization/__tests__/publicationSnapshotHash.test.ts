import { describe, expect, it } from 'vitest'
import { normalizePublicationSnapshotForHash } from '../publicationSnapshotHash'

const createCodenameVlc = (primary: string, secondary?: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: { content: primary, version: 1, isActive: true },
        ...(secondary ? { ru: { content: secondary, version: 1, isActive: true } } : {})
    }
})

describe('normalizePublicationSnapshotForHash', () => {
    it('normalizes application and metahub snapshot variants into a stable structure', () => {
        const normalized = normalizePublicationSnapshotForHash({
            version: 1,
            metahubId: 'metahub-1',
            entities: {
                catalogB: {
                    id: 'catalog-b',
                    kind: 'catalog',
                    codename: createCodenameVlc('products', 'товары'),
                    physicalTableName: 'cat_products',
                    presentation: { name: { en: 'Products' } },
                    config: { featured: true },
                    hubs: ['hub-2', 'hub-1'],
                    fields: [
                        {
                            id: 'field-2',
                            codename: createCodenameVlc('details', 'детали'),
                            dataType: 'TABLE',
                            isRequired: false,
                            sortOrder: 2,
                            childFields: [
                                {
                                    id: 'child-2',
                                    codename: createCodenameVlc('second', 'второй'),
                                    dataType: 'STRING',
                                    isRequired: false,
                                    sortOrder: 2
                                },
                                {
                                    id: 'child-1',
                                    codename: createCodenameVlc('first', 'первый'),
                                    dataType: 'STRING',
                                    isRequired: true,
                                    sortOrder: 1
                                }
                            ]
                        },
                        {
                            id: 'field-1',
                            codename: createCodenameVlc('title', 'название'),
                            dataType: 'STRING',
                            isRequired: true,
                            sortOrder: 1
                        }
                    ]
                },
                catalogA: {
                    id: 'catalog-a',
                    kind: 'catalog',
                    codename: createCodenameVlc('articles', 'статьи'),
                    tableName: 'cat_articles',
                    fields: []
                }
            },
            elements: {
                'catalog-b': [
                    { id: 'element-2', data: { title: 'B' }, sortOrder: 2 },
                    { id: 'element-1', data: { title: 'A' }, sortOrder: 1 }
                ]
            },
            optionValues: {
                'enum-1': [
                    { id: 'value-2', codename: createCodenameVlc('beta', 'бета'), sortOrder: 2, isDefault: false },
                    { id: 'value-1', codename: createCodenameVlc('alpha', 'альфа'), sortOrder: 1, isDefault: true }
                ]
            },
            constants: {
                'set-1': [
                    { id: 'constant-2', codename: createCodenameVlc('two', 'два'), dataType: 'STRING', sortOrder: 2, value: '2' },
                    { id: 'constant-1', codename: createCodenameVlc('one', 'один'), dataType: 'STRING', sortOrder: 1, value: '1' }
                ]
            },
            systemFields: {
                'catalog-b': {
                    fields: [
                        { key: 'app.deleted_by', enabled: true },
                        { key: 'app.deleted', enabled: true }
                    ],
                    lifecycleContract: {
                        publish: { enabled: true, trackAt: true, trackBy: true },
                        archive: { enabled: true, trackAt: true, trackBy: true },
                        delete: { mode: 'soft', trackAt: true, trackBy: true }
                    }
                }
            },
            scripts: [
                {
                    id: 'script-2',
                    codename: createCodenameVlc('zeta', 'зета'),
                    presentation: { name: { en: 'Zeta' } },
                    attachedToKind: 'metahub',
                    attachedToId: null,
                    moduleRole: 'shared',
                    sourceKind: 'embedded',
                    sdkApiVersion: '1.0.0',
                    sourceCode: 'export const z = 2',
                    manifest: {
                        className: 'ZetaModule',
                        sdkApiVersion: '1.0.0',
                        moduleRole: 'shared',
                        sourceKind: 'embedded',
                        capabilities: ['rpc.server', 'rpc.client'],
                        methods: [
                            { name: 'zMethod', target: 'server' },
                            { name: 'aMethod', target: 'client' }
                        ],
                        checksum: 'manifest-z'
                    },
                    serverBundle: 'server-z',
                    clientBundle: 'client-z',
                    checksum: 'checksum-z',
                    isActive: true,
                    config: { scope: 'global' }
                },
                {
                    id: 'script-1',
                    codename: createCodenameVlc('alpha', 'альфа'),
                    presentation: { name: { en: 'Alpha' } },
                    attachedToKind: 'metahub',
                    attachedToId: null,
                    moduleRole: 'shared',
                    sourceKind: 'embedded',
                    sdkApiVersion: '1.0.0',
                    sourceCode: 'export const a = 1',
                    manifest: {
                        className: 'AlphaModule',
                        sdkApiVersion: '1.0.0',
                        moduleRole: 'shared',
                        sourceKind: 'embedded',
                        capabilities: ['rpc.server', 'rpc.client'],
                        methods: [
                            { name: 'onArchive', target: 'server', eventName: 'archive' },
                            { name: 'publish', target: 'server' }
                        ],
                        checksum: 'manifest-a'
                    },
                    serverBundle: 'server-a',
                    clientBundle: null,
                    checksum: 'checksum-a',
                    isActive: false,
                    config: { scope: 'catalog' }
                }
            ],
            layouts: [
                { id: 'layout-2', templateKey: 'dashboard', isDefault: false, isActive: true, sortOrder: 2 },
                { id: 'layout-1', templateKey: 'dashboard', isDefault: true, isActive: true, sortOrder: 1 }
            ],
            scopedLayouts: [
                {
                    id: 'entity-layout-2',
                    scopeEntityId: 'catalog-b',
                    baseLayoutId: 'layout-2',
                    templateKey: 'dashboard',
                    name: { en: 'Products Layout' },
                    config: { searchMode: 'simple' },
                    isDefault: false,
                    isActive: true,
                    sortOrder: 2
                },
                {
                    id: 'entity-layout-1',
                    scopeEntityId: 'catalog-a',
                    baseLayoutId: 'layout-1',
                    templateKey: 'dashboard',
                    name: { en: 'Articles Layout' },
                    config: { searchMode: 'advanced' },
                    isDefault: true,
                    isActive: true,
                    sortOrder: 1
                }
            ],
            layoutZoneWidgets: [
                { id: 'widget-2', layoutId: 'layout-1', zone: 'main', widgetKey: 'table', sortOrder: 2, isActive: true },
                { id: 'widget-1', layoutId: 'layout-1', zone: 'main', widgetKey: 'hero', sortOrder: 1, isActive: true }
            ],
            layoutWidgetOverrides: [
                {
                    id: 'override-2',
                    layoutId: 'entity-layout-1',
                    baseWidgetId: 'widget-2',
                    zone: 'aside',
                    sortOrder: 2,
                    config: { hidden: true },
                    isActive: true,
                    isDeletedOverride: false
                },
                {
                    id: 'override-1',
                    layoutId: 'entity-layout-1',
                    baseWidgetId: 'widget-1',
                    zone: 'main',
                    sortOrder: 1,
                    config: null,
                    isActive: false,
                    isDeletedOverride: true
                }
            ],
            defaultLayoutId: 'layout-1',
            layoutConfig: { sections: ['hero'] }
        })

        expect(normalized).toMatchObject({
            version: 1,
            metahubId: 'metahub-1',
            defaultLayoutId: 'layout-1',
            layoutConfig: { sections: ['hero'] }
        })

        expect(normalized.entities).toEqual([
            expect.objectContaining({
                id: 'catalog-a',
                codename: createCodenameVlc('articles', 'статьи'),
                tableName: 'cat_articles',
                hubs: []
            }),
            expect.objectContaining({
                id: 'catalog-b',
                codename: createCodenameVlc('products', 'товары'),
                tableName: 'cat_products',
                hubs: ['hub-1', 'hub-2']
            })
        ])
        const normalizedEntityFields = (
            normalized.entities as Array<{
                fields: Array<{
                    codename: unknown
                    childFields?: Array<{ codename: unknown }>
                }>
            }>
        )[1].fields

        expect(normalizedEntityFields).toEqual([
            expect.objectContaining({ codename: createCodenameVlc('title', 'название') }),
            expect.objectContaining({
                codename: createCodenameVlc('details', 'детали'),
                childFields: [
                    expect.objectContaining({ codename: createCodenameVlc('first', 'первый') }),
                    expect.objectContaining({ codename: createCodenameVlc('second', 'второй') })
                ]
            })
        ])
        expect(normalized.elements).toEqual([
            {
                objectId: 'catalog-b',
                elements: [
                    { id: 'element-1', data: { title: 'A' }, sortOrder: 1 },
                    { id: 'element-2', data: { title: 'B' }, sortOrder: 2 }
                ]
            }
        ])
        expect(normalized.optionValues).toEqual([
            {
                objectId: 'enum-1',
                values: [
                    { id: 'value-1', codename: createCodenameVlc('alpha', 'альфа'), presentation: {}, sortOrder: 1, isDefault: true },
                    { id: 'value-2', codename: createCodenameVlc('beta', 'бета'), presentation: {}, sortOrder: 2, isDefault: false }
                ]
            }
        ])
        expect(normalized.fixedValues).toEqual([
            {
                objectId: 'set-1',
                constants: [
                    {
                        id: 'constant-1',
                        codename: createCodenameVlc('one', 'один'),
                        dataType: 'STRING',
                        presentation: {},
                        validationRules: {},
                        uiConfig: {},
                        value: '1',
                        sortOrder: 1
                    },
                    {
                        id: 'constant-2',
                        codename: createCodenameVlc('two', 'два'),
                        dataType: 'STRING',
                        presentation: {},
                        validationRules: {},
                        uiConfig: {},
                        value: '2',
                        sortOrder: 2
                    }
                ]
            }
        ])
        expect(normalized.systemFields).toEqual([
            expect.objectContaining({
                entityId: 'catalog-b',
                fields: [
                    { key: 'app.deleted', enabled: true },
                    { key: 'app.deleted_by', enabled: true }
                ]
            })
        ])
        expect(normalized.scripts).toEqual([
            expect.objectContaining({
                id: 'script-1',
                codename: createCodenameVlc('alpha', 'альфа'),
                isActive: false,
                manifest: {
                    className: 'AlphaModule',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'shared',
                    sourceKind: 'embedded',
                    capabilities: ['rpc.client', 'rpc.server'],
                    methods: [
                        { name: 'publish', target: 'server', eventName: null },
                        { name: 'onArchive', target: 'server', eventName: 'archive' }
                    ],
                    checksum: 'manifest-a'
                }
            }),
            expect.objectContaining({
                id: 'script-2',
                codename: createCodenameVlc('zeta', 'зета'),
                isActive: true,
                manifest: {
                    className: 'ZetaModule',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'shared',
                    sourceKind: 'embedded',
                    capabilities: ['rpc.client', 'rpc.server'],
                    methods: [
                        { name: 'aMethod', target: 'client', eventName: null },
                        { name: 'zMethod', target: 'server', eventName: null }
                    ],
                    checksum: 'manifest-z'
                }
            })
        ])
        expect(normalized.layouts).toEqual([
            expect.objectContaining({ id: 'layout-1', isDefault: true, sortOrder: 1 }),
            expect.objectContaining({ id: 'layout-2', isDefault: false, sortOrder: 2 })
        ])
        expect(normalized.scopedLayouts).toEqual([
            expect.objectContaining({ id: 'entity-layout-1', scopeEntityId: 'catalog-a', baseLayoutId: 'layout-1', sortOrder: 1 }),
            expect.objectContaining({ id: 'entity-layout-2', scopeEntityId: 'catalog-b', baseLayoutId: 'layout-2', sortOrder: 2 })
        ])
        expect(normalized.layoutZoneWidgets).toEqual([
            expect.objectContaining({ id: 'widget-1', layoutId: 'layout-1', zone: 'main', sortOrder: 1 }),
            expect.objectContaining({ id: 'widget-2', layoutId: 'layout-1', zone: 'main', sortOrder: 2 })
        ])
        expect(normalized.layoutWidgetOverrides).toEqual([
            {
                id: 'override-1',
                layoutId: 'entity-layout-1',
                baseWidgetId: 'widget-1',
                zone: 'main',
                sortOrder: 1,
                config: null,
                isActive: false,
                isDeletedOverride: true
            },
            {
                id: 'override-2',
                layoutId: 'entity-layout-1',
                baseWidgetId: 'widget-2',
                zone: 'aside',
                sortOrder: 2,
                config: { hidden: true },
                isActive: true,
                isDeletedOverride: false
            }
        ])
    })

    it('applies a fallback version envelope when the snapshot omits it', () => {
        const normalized = normalizePublicationSnapshotForHash(
            {
                entities: {},
                layoutConfig: null
            },
            {
                defaultVersionEnvelope: {
                    structureVersion: '53.0.0',
                    templateVersion: null,
                    snapshotFormatVersion: 1
                }
            }
        )

        expect(normalized.versionEnvelope).toEqual({
            structureVersion: '53.0.0',
            templateVersion: null,
            snapshotFormatVersion: 1
        })
        expect(normalized.layoutConfig).toEqual({})
        expect(normalized.entities).toEqual([])
    })
})
