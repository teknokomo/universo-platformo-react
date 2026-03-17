import { describe, expect, it } from 'vitest'
import { normalizePublicationSnapshotForHash } from '../publicationSnapshotHash'

describe('normalizePublicationSnapshotForHash', () => {
    it('normalizes application and metahub snapshot variants into a stable structure', () => {
        const normalized = normalizePublicationSnapshotForHash({
            version: 1,
            metahubId: 'metahub-1',
            entities: {
                catalogB: {
                    id: 'catalog-b',
                    kind: 'catalog',
                    codename: 'products',
                    physicalTableName: 'cat_products',
                    presentation: { name: { en: 'Products' } },
                    config: { featured: true },
                    hubs: ['hub-2', 'hub-1'],
                    fields: [
                        {
                            id: 'field-2',
                            codename: 'details',
                            dataType: 'TABLE',
                            isRequired: false,
                            sortOrder: 2,
                            childFields: [
                                {
                                    id: 'child-2',
                                    codename: 'second',
                                    dataType: 'STRING',
                                    isRequired: false,
                                    sortOrder: 2
                                },
                                {
                                    id: 'child-1',
                                    codename: 'first',
                                    dataType: 'STRING',
                                    isRequired: true,
                                    sortOrder: 1
                                }
                            ]
                        },
                        {
                            id: 'field-1',
                            codename: 'title',
                            dataType: 'STRING',
                            isRequired: true,
                            sortOrder: 1
                        }
                    ]
                },
                catalogA: {
                    id: 'catalog-a',
                    kind: 'catalog',
                    codename: 'articles',
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
            enumerationValues: {
                'enum-1': [
                    { id: 'value-2', codename: 'beta', sortOrder: 2, isDefault: false },
                    { id: 'value-1', codename: 'alpha', sortOrder: 1, isDefault: true }
                ]
            },
            constants: {
                'set-1': [
                    { id: 'constant-2', codename: 'two', dataType: 'STRING', sortOrder: 2, value: '2' },
                    { id: 'constant-1', codename: 'one', dataType: 'STRING', sortOrder: 1, value: '1' }
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
            layouts: [
                { id: 'layout-2', templateKey: 'dashboard', isDefault: false, isActive: true, sortOrder: 2 },
                { id: 'layout-1', templateKey: 'dashboard', isDefault: true, isActive: true, sortOrder: 1 }
            ],
            layoutZoneWidgets: [
                { id: 'widget-2', layoutId: 'layout-1', zone: 'main', widgetKey: 'table', sortOrder: 2, isActive: true },
                { id: 'widget-1', layoutId: 'layout-1', zone: 'main', widgetKey: 'hero', sortOrder: 1, isActive: true }
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
            expect.objectContaining({ id: 'catalog-a', codename: 'articles', tableName: 'cat_articles', hubs: [] }),
            expect.objectContaining({ id: 'catalog-b', codename: 'products', tableName: 'cat_products', hubs: ['hub-1', 'hub-2'] })
        ])
        const normalizedEntityFields = (
            normalized.entities as Array<{
                fields: Array<{
                    codename: string
                    childFields?: Array<{ codename: string }>
                }>
            }>
        )[1].fields

        expect(normalizedEntityFields).toEqual([
            expect.objectContaining({ codename: 'title' }),
            expect.objectContaining({
                codename: 'details',
                childFields: [expect.objectContaining({ codename: 'first' }), expect.objectContaining({ codename: 'second' })]
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
        expect(normalized.enumerationValues).toEqual([
            {
                objectId: 'enum-1',
                values: [
                    { id: 'value-1', codename: 'alpha', presentation: {}, sortOrder: 1, isDefault: true },
                    { id: 'value-2', codename: 'beta', presentation: {}, sortOrder: 2, isDefault: false }
                ]
            }
        ])
        expect(normalized.constants).toEqual([
            {
                objectId: 'set-1',
                constants: [
                    {
                        id: 'constant-1',
                        codename: 'one',
                        dataType: 'STRING',
                        presentation: {},
                        validationRules: {},
                        uiConfig: {},
                        value: '1',
                        sortOrder: 1
                    },
                    {
                        id: 'constant-2',
                        codename: 'two',
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
        expect(normalized.layouts).toEqual([
            expect.objectContaining({ id: 'layout-1', isDefault: true, sortOrder: 1 }),
            expect.objectContaining({ id: 'layout-2', isDefault: false, sortOrder: 2 })
        ])
        expect(normalized.layoutZoneWidgets).toEqual([
            expect.objectContaining({ id: 'widget-1', layoutId: 'layout-1', zone: 'main', sortOrder: 1 }),
            expect.objectContaining({ id: 'widget-2', layoutId: 'layout-1', zone: 'main', sortOrder: 2 })
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
