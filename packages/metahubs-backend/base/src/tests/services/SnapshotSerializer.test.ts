import { SnapshotSerializer } from '../../domains/publications/services/SnapshotSerializer'

describe('SnapshotSerializer system field propagation', () => {
    it('serializes dedicated systemFields and keeps runtime business fields separate', async () => {
        const objectsService = {
            findAllByKind: jest.fn(async (_metahubId: string, kind: string) => {
                if (kind === 'catalog') {
                    return [
                        {
                            id: 'catalog-1',
                            codename: 'products',
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
            findAllFlat: jest.fn(async () => [
                {
                    id: 'field-1',
                    codename: 'title',
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
        expect(snapshot.entities['catalog-1'].fields[0].codename).toBe('title')
        expect(runtimeEntities[0].config?.systemFields).toEqual(snapshot.systemFields?.['catalog-1'])
    })
})
