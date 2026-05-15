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

    const createStandardCatalogRow = () => ({
        id: 'standard-type-object',
        kind_key: BuiltinEntityKinds.OBJECT,
        codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'object' } } },
        presentation: { name: { en: 'Objects' } },
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
            physicalTable: false
        },
        ui_config: {
            iconName: 'IconDatabase',
            tabs: ['general'],
            sidebarSection: 'objects',
            nameKey: 'metahubs:objects.title',
            resourceSurfaces: [
                {
                    key: 'components',
                    capability: 'dataSchema',
                    routeSegment: 'components',
                    title: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Components' } } },
                    fallbackTitle: 'Components'
                }
            ]
        },
        config: {},
        _mhb_published: true,
        _upl_version: 1
    })

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('lists standard and custom entity types from the schema-backed definitions table', async () => {
        const queryMock = jest.fn(async (sql: string) => {
            if (sql.includes('_mhb_entity_type_definitions')) {
                return [
                    {
                        id: 'standard-type-object',
                        kind_key: BuiltinEntityKinds.OBJECT,
                        codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'object' } } },
                        presentation: { name: { en: 'Objects' } },
                        capabilities: {
                            dataSchema: { enabled: true },
                            records: false,
                            treeAssignment: { enabled: true },
                            optionValues: false,
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
                            iconName: 'IconDatabase',
                            tabs: ['general'],
                            sidebarSection: 'objects',
                            nameKey: 'metahubs:objects.title'
                        },
                        config: {},
                        _mhb_published: true,
                        _upl_version: 1
                    },
                    {
                        id: 'custom-type-1',
                        kind_key: 'custom-order',
                        codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-order' } } },
                        presentation: { name: { en: 'Custom Order' } },
                        capabilities: {
                            dataSchema: { enabled: true },
                            records: false,
                            treeAssignment: false,
                            optionValues: false,
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
                        _mhb_published: true,
                        _upl_version: 1
                    }
                ]
            }
            return []
        })

        const service = new EntityTypeService(createExecutor(queryMock) as any, { ensureSchema: mockEnsureSchema } as any)
        const result = await service.listTypes('metahub-1', 'user-1')

        expect(result.some((item) => item.kindKey === BuiltinEntityKinds.OBJECT)).toBe(true)
        expect(result.some((item) => item.kindKey === 'custom-order')).toBe(true)
        expect(result.find((item) => item.kindKey === 'custom-order')?.published).toBe(true)
    })

    it('does not synthesize missing standard entity types when the schema table only contains custom definitions', async () => {
        const queryMock = jest.fn(async (sql: string) => {
            if (sql.includes('_mhb_entity_type_definitions')) {
                return [
                    {
                        id: 'custom-type-1',
                        kind_key: 'custom-order',
                        codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-order' } } },
                        presentation: { name: { en: 'Custom Order' } },
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
                            physicalTable: false
                        },
                        ui_config: {
                            iconName: 'IconBolt',
                            tabs: ['general'],
                            sidebarSection: 'objects',
                            nameKey: 'Custom Order'
                        },
                        config: {},
                        _mhb_published: true,
                        _upl_version: 1
                    }
                ]
            }
            return []
        })

        const service = new EntityTypeService(createExecutor(queryMock) as any, { ensureSchema: mockEnsureSchema } as any)
        const result = await service.listTypes('metahub-1', 'user-1')

        expect(result).toHaveLength(1)
        expect(result.some((item) => item.kindKey === BuiltinEntityKinds.HUB)).toBe(false)
        expect(result.some((item) => item.kindKey === BuiltinEntityKinds.OBJECT)).toBe(false)
        expect(result.some((item) => item.kindKey === BuiltinEntityKinds.SET)).toBe(false)
        expect(result.some((item) => item.kindKey === BuiltinEntityKinds.ENUMERATION)).toBe(false)
        expect(result.find((item) => item.kindKey === 'custom-order')?.published).toBe(true)
    })

    it('rejects attempts to redefine standard entity kinds as custom types', async () => {
        const service = new EntityTypeService(createExecutor(jest.fn(async () => [])) as any, { ensureSchema: mockEnsureSchema } as any)

        await expect(
            service.createType('metahub-1', {
                kindKey: BuiltinEntityKinds.OBJECT,
                codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'object' } } },
                capabilities: {
                    dataSchema: { enabled: true },
                    records: false,
                    treeAssignment: false,
                    optionValues: false,
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
                    nameKey: 'Object clone'
                }
            })
        ).rejects.toThrow('Standard entity kinds are reserved for platform-provided entity types')
    })

    it('allows safe localized resource title updates for persisted standard entity types', async () => {
        const standardCatalogRow = createStandardCatalogRow()
        const nextUi = {
            ...standardCatalogRow.ui_config,
            resourceSurfaces: [
                {
                    ...standardCatalogRow.ui_config.resourceSurfaces[0],
                    title: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Properties' }, ru: { content: 'Свойства' } } },
                    fallbackTitle: 'Properties'
                }
            ]
        }
        const queryMock = jest.fn(async (sql: string) => {
            if (sql.includes('WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false')) {
                return [standardCatalogRow]
            }

            if (sql.includes('WHERE kind_key =')) {
                return [standardCatalogRow]
            }

            if (sql.includes("LOWER(COALESCE(codename->'locales'->(codename->>'_primary')->>'content'")) {
                return [standardCatalogRow]
            }

            if (sql.includes('UPDATE') && sql.includes('_mhb_entity_type_definitions')) {
                return [
                    {
                        ...standardCatalogRow,
                        ui_config: nextUi,
                        _upl_version: 2
                    }
                ]
            }

            return []
        })

        const service = new EntityTypeService(createExecutor(queryMock) as any, { ensureSchema: mockEnsureSchema } as any)
        const result = await service.updateType(
            'metahub-1',
            'standard-type-object',
            {
                ui: nextUi
            },
            'user-1'
        )

        expect(result.ui.resourceSurfaces?.[0]?.title).toEqual(nextUi.resourceSurfaces[0].title)
    })

    it('rejects structural component changes for persisted standard entity types', async () => {
        const standardCatalogRow = createStandardCatalogRow()
        const queryMock = jest.fn(async (sql: string) => {
            if (sql.includes('WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false')) {
                return [standardCatalogRow]
            }

            return []
        })

        const service = new EntityTypeService(createExecutor(queryMock) as any, { ensureSchema: mockEnsureSchema } as any)

        await expect(
            service.updateType(
                'metahub-1',
                'standard-type-object',
                {
                    capabilities: {
                        ...standardCatalogRow.capabilities,
                        records: { enabled: true }
                    }
                },
                'user-1'
            )
        ).rejects.toThrow('Standard entity type capabilities cannot be changed through the Entities constructor')
    })

    it('rejects structural resource surface changes for persisted standard entity types', async () => {
        const standardCatalogRow = createStandardCatalogRow()
        const nextUi = {
            ...standardCatalogRow.ui_config,
            resourceSurfaces: [
                {
                    ...standardCatalogRow.ui_config.resourceSurfaces[0],
                    routeSegment: 'properties'
                }
            ]
        }
        const queryMock = jest.fn(async (sql: string) => {
            if (sql.includes('WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false')) {
                return [standardCatalogRow]
            }

            return []
        })

        const service = new EntityTypeService(createExecutor(queryMock) as any, { ensureSchema: mockEnsureSchema } as any)

        await expect(
            service.updateType(
                'metahub-1',
                'standard-type-object',
                {
                    ui: nextUi
                },
                'user-1'
            )
        ).rejects.toThrow('Standard entity type UI structure cannot be changed through the Entities constructor')
    })

    it('rejects publication state changes for persisted standard entity types', async () => {
        const standardCatalogRow = createStandardCatalogRow()
        const queryMock = jest.fn(async (sql: string) => {
            if (sql.includes('WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false')) {
                return [standardCatalogRow]
            }

            return []
        })

        const service = new EntityTypeService(createExecutor(queryMock) as any, { ensureSchema: mockEnsureSchema } as any)

        await expect(
            service.updateType(
                'metahub-1',
                'standard-type-object',
                {
                    published: false
                },
                'user-1'
            )
        ).rejects.toThrow('Standard entity type publication state cannot be changed through the Entities constructor')

        expect(queryMock).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE'), expect.anything())
    })

    it('creates a custom entity type when the kindKey is free and dependencies are valid', async () => {
        const queryMock = jest.fn(async (sql: string) => {
            if (sql.includes('WHERE kind_key =')) {
                return []
            }
            if (sql.includes("LOWER(COALESCE(codename->'locales'->(codename->>'_primary')->>'content'")) {
                return []
            }
            if (sql.includes('INSERT INTO')) {
                return [
                    {
                        id: 'custom-type-2',
                        kind_key: 'custom-order',
                        codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-order' } } },
                        presentation: {},
                        capabilities: {
                            dataSchema: { enabled: true },
                            records: false,
                            treeAssignment: false,
                            optionValues: false,
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
                        _mhb_published: true,
                        _upl_version: 1
                    }
                ]
            }
            return []
        })

        const service = new EntityTypeService(createExecutor(queryMock) as any, { ensureSchema: mockEnsureSchema } as any)
        const result = await service.createType('metahub-1', {
            kindKey: 'custom-order',
            codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-order' } } },
            capabilities: {
                dataSchema: { enabled: true },
                records: false,
                treeAssignment: false,
                optionValues: false,
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
        expect(result.published).toBe(true)
    })

    it('rejects creating a custom entity type when another active entity type already uses the same codename', async () => {
        const queryMock = jest.fn(async (sql: string) => {
            if (sql.includes('WHERE kind_key =')) {
                return []
            }
            if (sql.includes("LOWER(COALESCE(codename->'locales'->(codename->>'_primary')->>'content'")) {
                return [
                    {
                        id: 'custom-type-existing',
                        kind_key: 'custom-existing',
                        codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-order' } } },
                        presentation: {},
                        capabilities: {
                            dataSchema: { enabled: true },
                            records: false,
                            treeAssignment: false,
                            optionValues: false,
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
                            nameKey: 'Custom Existing'
                        },
                        config: {},
                        _mhb_published: true,
                        _upl_version: 1
                    }
                ]
            }
            return []
        })

        const service = new EntityTypeService(createExecutor(queryMock) as any, { ensureSchema: mockEnsureSchema } as any)

        await expect(
            service.createType('metahub-1', {
                kindKey: 'custom-order',
                codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-order' } } },
                capabilities: {
                    dataSchema: { enabled: true },
                    records: false,
                    treeAssignment: false,
                    optionValues: false,
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
        ).rejects.toThrow('Entity type codename already exists')
    })

    it('maps database codename unique violations during create to a conflict error', async () => {
        const duplicateKeyError = Object.assign(new Error('duplicate key value violates unique constraint'), {
            code: '23505',
            constraint: 'idx_mhb_entity_type_definitions_codename_active'
        })
        const queryMock = jest.fn(async (sql: string) => {
            if (sql.includes('WHERE kind_key =')) {
                return []
            }
            if (sql.includes("LOWER(COALESCE(codename->'locales'->(codename->>'_primary')->>'content'")) {
                return []
            }
            if (sql.includes('INSERT INTO')) {
                throw duplicateKeyError
            }
            return []
        })

        const service = new EntityTypeService(createExecutor(queryMock) as any, { ensureSchema: mockEnsureSchema } as any)

        await expect(
            service.createType('metahub-1', {
                kindKey: 'custom-order',
                codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-order' } } },
                capabilities: {
                    dataSchema: { enabled: true },
                    records: false,
                    treeAssignment: false,
                    optionValues: false,
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
        ).rejects.toThrow('Entity type codename already exists')
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
                        capabilities: {
                            dataSchema: { enabled: true },
                            records: false,
                            treeAssignment: false,
                            optionValues: false,
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
                        _mhb_published: false,
                        _upl_version: 1
                    }
                ]
            }
            return []
        })

        const service = new EntityTypeService(createExecutor(queryMock) as any, { ensureSchema: mockEnsureSchema } as any)
        const result = await service.createType('metahub-1', {
            kindKey: 'custom-hidden',
            codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-hidden' } } },
            capabilities: {
                dataSchema: { enabled: true },
                records: false,
                treeAssignment: false,
                optionValues: false,
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

    it('accepts custom resource surface keys and route segments for enabled capabilities', async () => {
        const queryMock = jest.fn(async (sql: string) => {
            if (sql.includes('WHERE kind_key =')) {
                return []
            }
            if (sql.includes("LOWER(COALESCE(codename->'locales'->(codename->>'_primary')->>'content'")) {
                return []
            }
            if (sql.includes('INSERT INTO')) {
                return [
                    {
                        id: 'custom-type-4',
                        kind_key: 'custom-knowledge',
                        codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-knowledge' } } },
                        presentation: {},
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
                            physicalTable: false
                        },
                        ui_config: {
                            iconName: 'IconBook',
                            tabs: ['general'],
                            sidebarSection: 'objects',
                            nameKey: 'Knowledge',
                            resourceSurfaces: [
                                {
                                    key: 'components',
                                    capability: 'dataSchema',
                                    routeSegment: 'components',
                                    fallbackTitle: 'Components'
                                }
                            ]
                        },
                        config: {},
                        _mhb_published: true,
                        _upl_version: 1
                    }
                ]
            }
            return []
        })

        const service = new EntityTypeService(createExecutor(queryMock) as any, { ensureSchema: mockEnsureSchema } as any)
        const result = await service.createType('metahub-1', {
            kindKey: 'custom-knowledge',
            codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-knowledge' } } },
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
                physicalTable: false
            },
            ui: {
                iconName: 'IconBook',
                tabs: ['general'],
                sidebarSection: 'objects',
                nameKey: 'Knowledge',
                resourceSurfaces: [
                    {
                        key: 'components',
                        capability: 'dataSchema',
                        routeSegment: 'components',
                        fallbackTitle: 'Components'
                    }
                ]
            }
        })

        expect(result.ui.resourceSurfaces).toEqual([
            expect.objectContaining({
                key: 'components',
                capability: 'dataSchema',
                routeSegment: 'components'
            })
        ])
    })

    it('rejects resource surfaces when the matching capability is disabled', async () => {
        const service = new EntityTypeService(createExecutor(jest.fn(async () => [])) as any, { ensureSchema: mockEnsureSchema } as any)

        await expect(
            service.createType('metahub-1', {
                kindKey: 'custom-invalid-surface',
                codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-invalid-surface' } } },
                capabilities: {
                    dataSchema: false,
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
                    physicalTable: false
                },
                ui: {
                    iconName: 'IconAlertCircle',
                    tabs: ['general'],
                    sidebarSection: 'objects',
                    nameKey: 'Invalid Surface',
                    resourceSurfaces: [
                        {
                            key: 'components',
                            capability: 'dataSchema',
                            routeSegment: 'components',
                            fallbackTitle: 'Components'
                        }
                    ]
                }
            })
        ).rejects.toThrow('Entity resource surface components requires enabled component dataSchema')
    })

    it('rejects duplicate resource surface route segments even when keys differ', async () => {
        const service = new EntityTypeService(createExecutor(jest.fn(async () => [])) as any, { ensureSchema: mockEnsureSchema } as any)

        await expect(
            service.createType('metahub-1', {
                kindKey: 'custom-duplicate-route',
                codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-duplicate-route' } } },
                capabilities: {
                    dataSchema: { enabled: true },
                    records: false,
                    treeAssignment: false,
                    optionValues: { enabled: true },
                    fixedValues: false,
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
                    iconName: 'IconAlertCircle',
                    tabs: ['general'],
                    sidebarSection: 'objects',
                    nameKey: 'Duplicate Route',
                    resourceSurfaces: [
                        {
                            key: 'components',
                            capability: 'dataSchema',
                            routeSegment: 'shared-tab',
                            fallbackTitle: 'Components'
                        },
                        {
                            key: 'values',
                            capability: 'optionValues',
                            routeSegment: 'shared-tab',
                            fallbackTitle: 'Values'
                        }
                    ]
                }
            })
        ).rejects.toThrow('Entity type UI config resourceSurfaces must not contain duplicate routeSegment shared-tab')
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
                        capabilities: {
                            dataSchema: { enabled: true },
                            records: false,
                            treeAssignment: false,
                            optionValues: false,
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
                        capabilities: {
                            dataSchema: { enabled: true },
                            records: false,
                            treeAssignment: false,
                            optionValues: false,
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
                        _mhb_published: false,
                        _upl_version: 4
                    }
                ]
            }

            return []
        })

        const service = new EntityTypeService(createExecutor(queryMock) as any, { ensureSchema: mockEnsureSchema } as any)
        const result = await service.updateType(
            'metahub-1',
            'custom-type-1',
            {
                published: false
            },
            'user-1'
        )

        expect(result.published).toBe(false)
    })

    it('rejects updating a custom entity type when another active entity type already uses the same codename', async () => {
        const queryMock = jest.fn(async (sql: string) => {
            if (sql.includes('WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false')) {
                return [
                    {
                        id: 'custom-type-1',
                        kind_key: 'custom-order',
                        codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-order' } } },
                        presentation: {},
                        capabilities: {
                            dataSchema: { enabled: true },
                            records: false,
                            treeAssignment: false,
                            optionValues: false,
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
                        _mhb_published: true,
                        _upl_version: 3
                    }
                ]
            }

            if (sql.includes('WHERE kind_key =')) {
                return []
            }

            if (sql.includes("LOWER(COALESCE(codename->'locales'->(codename->>'_primary')->>'content'")) {
                return [
                    {
                        id: 'custom-type-2',
                        kind_key: 'custom-existing',
                        codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'duplicate-codename' } } },
                        presentation: {},
                        capabilities: {
                            dataSchema: { enabled: true },
                            records: false,
                            treeAssignment: false,
                            optionValues: false,
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
                            nameKey: 'Custom Existing'
                        },
                        config: {},
                        _mhb_published: true,
                        _upl_version: 2
                    }
                ]
            }

            return []
        })

        const service = new EntityTypeService(createExecutor(queryMock) as any, { ensureSchema: mockEnsureSchema } as any)

        await expect(
            service.updateType(
                'metahub-1',
                'custom-type-1',
                {
                    codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'duplicate-codename' } } }
                },
                'user-1'
            )
        ).rejects.toThrow('Entity type codename already exists')
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
                        capabilities: {
                            dataSchema: { enabled: true },
                            records: false,
                            treeAssignment: false,
                            optionValues: false,
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

        await expect(service.deleteType('metahub-1', 'custom-type-1', 'user-1')).rejects.toThrow(
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
                        capabilities: {
                            dataSchema: { enabled: true },
                            records: false,
                            treeAssignment: false,
                            optionValues: false,
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
                        capabilities: {
                            dataSchema: { enabled: true },
                            records: false,
                            treeAssignment: false,
                            optionValues: false,
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
                        _mhb_published: true,
                        _upl_version: 4,
                        _mhb_deleted: true
                    }
                ]
            }

            return []
        })

        const service = new EntityTypeService(createExecutor(queryMock) as any, { ensureSchema: mockEnsureSchema } as any)

        await expect(service.deleteType('metahub-1', 'custom-type-1', 'user-1')).resolves.toBeUndefined()
    })
})
