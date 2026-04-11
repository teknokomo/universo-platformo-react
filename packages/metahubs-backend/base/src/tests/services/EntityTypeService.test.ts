import { BuiltinEntityKinds } from '@universo/types'
import { EntityTypeService } from '../../domains/entities/services/EntityTypeService'

describe('EntityTypeService', () => {
    const schemaName = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'
    const mockEnsureSchema = jest.fn(async () => schemaName)

    const createExecutor = (queryImpl: jest.Mock) => ({
        query: queryImpl,
        transaction: jest.fn(async (cb: any) => cb({ query: queryImpl, transaction: jest.fn(), isReleased: () => false })),
        isReleased: () => false
    })

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('lists builtin and custom entity types together', async () => {
        const queryMock = jest.fn(async (sql: string) => {
            if (sql.includes('_mhb_entity_type_definitions')) {
                return [
                    {
                        id: 'custom-type-1',
                        kind_key: 'custom-order',
                        codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-order' } } },
                        presentation: { name: { en: 'Custom Order' } },
                        components: {
                            dataSchema: { enabled: true },
                            predefinedElements: false,
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
                            physicalTable: false
                        },
                        ui_config: {
                            iconName: 'IconBolt',
                            tabs: ['general'],
                            sidebarSection: 'objects',
                            nameKey: 'Custom Order'
                        },
                        config: {},
                        is_builtin: false,
                        _mhb_published: true,
                        _upl_version: 1
                    }
                ]
            }
            return []
        })

        const service = new EntityTypeService(createExecutor(queryMock) as any, { ensureSchema: mockEnsureSchema } as any)
        const result = await service.listResolvedTypes('metahub-1', 'user-1')

        expect(result.some((item) => item.kindKey === BuiltinEntityKinds.CATALOG && item.source === 'builtin')).toBe(true)
        expect(result.some((item) => item.kindKey === 'custom-order' && item.source === 'custom')).toBe(true)
        expect(result.find((item) => item.kindKey === 'custom-order')?.published).toBe(true)
    })

    it('rejects attempts to redefine builtin entity kinds as custom types', async () => {
        const service = new EntityTypeService(createExecutor(jest.fn(async () => [])) as any, { ensureSchema: mockEnsureSchema } as any)

        await expect(
            service.createCustomType('metahub-1', {
                kindKey: BuiltinEntityKinds.CATALOG,
                codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'catalog' } } },
                components: {
                    dataSchema: { enabled: true },
                    predefinedElements: false,
                    hubAssignment: false,
                    enumerationValues: false,
                    constants: false,
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
                    iconName: 'IconTest',
                    tabs: ['general'],
                    sidebarSection: 'objects',
                    nameKey: 'Catalog clone'
                }
            })
        ).rejects.toThrow('Built-in entity kinds cannot be redefined as custom types')
    })

    it('creates a custom entity type when the kindKey is free and dependencies are valid', async () => {
        const queryMock = jest.fn(async (sql: string) => {
            if (sql.includes('WHERE kind_key =')) {
                return []
            }
            if (sql.includes('INSERT INTO')) {
                return [
                    {
                        id: 'custom-type-2',
                        kind_key: 'custom-order',
                        codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-order' } } },
                        presentation: {},
                        components: {
                            dataSchema: { enabled: true },
                            predefinedElements: false,
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
                            physicalTable: false
                        },
                        ui_config: {
                            iconName: 'IconBolt',
                            tabs: ['general'],
                            sidebarSection: 'objects',
                            nameKey: 'Custom Order'
                        },
                        config: {},
                        is_builtin: false,
                        _mhb_published: true,
                        _upl_version: 1
                    }
                ]
            }
            return []
        })

        const service = new EntityTypeService(createExecutor(queryMock) as any, { ensureSchema: mockEnsureSchema } as any)
        const result = await service.createCustomType('metahub-1', {
            kindKey: 'custom-order',
            codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-order' } } },
            components: {
                dataSchema: { enabled: true },
                predefinedElements: false,
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
                physicalTable: false
            },
            ui: {
                iconName: 'IconBolt',
                tabs: ['general'],
                sidebarSection: 'objects',
                nameKey: 'Custom Order'
            }
        })

        expect(result.kindKey).toBe('custom-order')
        expect(result.source).toBe('custom')
        expect(result.published).toBe(true)
    })

    it('persists an explicit unpublished custom entity type when requested by the builder', async () => {
        const queryMock = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('WHERE kind_key =')) {
                return []
            }
            if (sql.includes('INSERT INTO')) {
                expect(params?.[8]).toBe(false)
                return [
                    {
                        id: 'custom-type-3',
                        kind_key: 'custom-hidden',
                        codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-hidden' } } },
                        presentation: {},
                        components: {
                            dataSchema: { enabled: true },
                            predefinedElements: false,
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
                            physicalTable: false
                        },
                        ui_config: {
                            iconName: 'IconEyeOff',
                            tabs: ['general'],
                            sidebarSection: 'objects',
                            nameKey: 'Hidden Custom'
                        },
                        config: {},
                        is_builtin: false,
                        _mhb_published: false,
                        _upl_version: 1
                    }
                ]
            }
            return []
        })

        const service = new EntityTypeService(createExecutor(queryMock) as any, { ensureSchema: mockEnsureSchema } as any)
        const result = await service.createCustomType('metahub-1', {
            kindKey: 'custom-hidden',
            codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-hidden' } } },
            components: {
                dataSchema: { enabled: true },
                predefinedElements: false,
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
                physicalTable: false
            },
            ui: {
                iconName: 'IconEyeOff',
                tabs: ['general'],
                sidebarSection: 'objects',
                nameKey: 'Hidden Custom'
            },
            published: false
        })

        expect(result.published).toBe(false)
    })

    it('updates the published flag without mutating the rest of the entity type contract', async () => {
        const queryMock = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false')) {
                return [
                    {
                        id: 'custom-type-1',
                        kind_key: 'custom-order',
                        codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-order' } } },
                        presentation: {},
                        components: {
                            dataSchema: { enabled: true },
                            predefinedElements: false,
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
                            physicalTable: false
                        },
                        ui_config: {
                            iconName: 'IconBolt',
                            tabs: ['general'],
                            sidebarSection: 'objects',
                            nameKey: 'Custom Order'
                        },
                        config: {},
                        is_builtin: false,
                        _mhb_published: true,
                        _upl_version: 3
                    }
                ]
            }

            if (sql.includes('WHERE kind_key =')) {
                return []
            }

            if (sql.includes('UPDATE') && sql.includes('_mhb_entity_type_definitions')) {
                expect(params).toEqual(expect.arrayContaining([false]))
                return [
                    {
                        id: 'custom-type-1',
                        kind_key: 'custom-order',
                        codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-order' } } },
                        presentation: {},
                        components: {
                            dataSchema: { enabled: true },
                            predefinedElements: false,
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
                            physicalTable: false
                        },
                        ui_config: {
                            iconName: 'IconBolt',
                            tabs: ['general'],
                            sidebarSection: 'objects',
                            nameKey: 'Custom Order'
                        },
                        config: {},
                        is_builtin: false,
                        _mhb_published: false,
                        _upl_version: 4
                    }
                ]
            }

            return []
        })

        const service = new EntityTypeService(createExecutor(queryMock) as any, { ensureSchema: mockEnsureSchema } as any)
        const result = await service.updateCustomType(
            'metahub-1',
            'custom-type-1',
            {
                published: false
            },
            'user-1'
        )

        expect(result.published).toBe(false)
    })

    it('blocks deleting a custom entity type while dependent entity instances still exist', async () => {
        const queryMock = jest.fn(async (sql: string) => {
            if (sql.includes('WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false')) {
                return [
                    {
                        id: 'custom-type-1',
                        kind_key: 'custom-order',
                        codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-order' } } },
                        presentation: {},
                        components: {
                            dataSchema: { enabled: true },
                            predefinedElements: false,
                            hubAssignment: false,
                            enumerationValues: false,
                            constants: false,
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
                        ui_config: {
                            iconName: 'IconBolt',
                            tabs: ['general'],
                            sidebarSection: 'objects',
                            nameKey: 'Custom Order'
                        },
                        config: {},
                        is_builtin: false,
                        _mhb_published: true,
                        _upl_version: 3
                    }
                ]
            }

            if (sql.includes('SELECT COUNT(*) AS count') && sql.includes('_mhb_objects')) {
                return [{ count: '2' }]
            }

            if (sql.includes('UPDATE') && sql.includes('_mhb_entity_type_definitions')) {
                throw new Error('delete should not update while dependent instances exist')
            }

            return []
        })

        const service = new EntityTypeService(createExecutor(queryMock) as any, { ensureSchema: mockEnsureSchema } as any)

        await expect(service.deleteCustomType('metahub-1', 'custom-type-1', 'user-1')).rejects.toThrow(
            'Entity type cannot be deleted while dependent entity instances still exist'
        )
    })

    it('soft deletes a custom entity type after confirming that no dependent instances remain', async () => {
        const queryMock = jest.fn(async (sql: string) => {
            if (sql.includes('WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false')) {
                return [
                    {
                        id: 'custom-type-1',
                        kind_key: 'custom-order',
                        codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-order' } } },
                        presentation: {},
                        components: {
                            dataSchema: { enabled: true },
                            predefinedElements: false,
                            hubAssignment: false,
                            enumerationValues: false,
                            constants: false,
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
                        ui_config: {
                            iconName: 'IconBolt',
                            tabs: ['general'],
                            sidebarSection: 'objects',
                            nameKey: 'Custom Order'
                        },
                        config: {},
                        is_builtin: false,
                        _mhb_published: true,
                        _upl_version: 3
                    }
                ]
            }

            if (sql.includes('SELECT COUNT(*) AS count') && sql.includes('_mhb_objects')) {
                return [{ count: '0' }]
            }

            if (sql.includes('UPDATE') && sql.includes('_mhb_entity_type_definitions')) {
                return [
                    {
                        id: 'custom-type-1',
                        kind_key: 'custom-order',
                        codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-order' } } },
                        presentation: {},
                        components: {
                            dataSchema: { enabled: true },
                            predefinedElements: false,
                            hubAssignment: false,
                            enumerationValues: false,
                            constants: false,
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
                        ui_config: {
                            iconName: 'IconBolt',
                            tabs: ['general'],
                            sidebarSection: 'objects',
                            nameKey: 'Custom Order'
                        },
                        config: {},
                        is_builtin: false,
                        _mhb_published: true,
                        _upl_version: 4,
                        _mhb_deleted: true
                    }
                ]
            }

            return []
        })

        const service = new EntityTypeService(createExecutor(queryMock) as any, { ensureSchema: mockEnsureSchema } as any)

        await expect(service.deleteCustomType('metahub-1', 'custom-type-1', 'user-1')).resolves.toBeUndefined()
    })
})
