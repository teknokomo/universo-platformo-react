const mockEnsureSchema = jest.fn()
const mockCompileModuleSource = jest.fn()
const mockFindStoredMetahubModuleByScope = jest.fn()
const mockFindStoredMetahubModuleById = jest.fn()
const mockInsertStoredMetahubModule = jest.fn()
const mockListStoredMetahubModules = jest.fn()
const mockIncrementVersion = jest.fn()
const mockListEditableTypes = jest.fn()

jest.mock('@universo/modules-engine', () => ({
    compileModuleSource: (...args: unknown[]) => mockCompileModuleSource(...args),
    extractSharedModuleImports: (sourceCode: string) => {
        const matches = sourceCode.match(/@shared\/([a-z][a-z0-9-]*)/g) ?? []
        return matches.map((match) => match.replace('@shared/', ''))
    }
}))

jest.mock('../../utils/optimisticLock', () => ({
    incrementVersion: (...args: unknown[]) => mockIncrementVersion(...args)
}))

jest.mock('../../domains/modules/services/modulesStore', () => {
    const actual = jest.requireActual('../../domains/modules/services/modulesStore')

    return {
        ...actual,
        findStoredMetahubModuleByScope: (...args: unknown[]) => mockFindStoredMetahubModuleByScope(...args),
        findStoredMetahubModuleById: (...args: unknown[]) => mockFindStoredMetahubModuleById(...args),
        listStoredMetahubModules: (...args: unknown[]) => mockListStoredMetahubModules(...args),
        insertStoredMetahubModule: (...args: unknown[]) => mockInsertStoredMetahubModule(...args)
    }
})

jest.mock('../../domains/entities/services/EntityTypeService', () => ({
    __esModule: true,
    EntityTypeService: jest.fn().mockImplementation(() => ({
        listEditableTypes: (...args: unknown[]) => mockListEditableTypes(...args)
    }))
}))

import { MetahubModulesService } from '../../domains/modules/services/MetahubModulesService'

const createStoredModuleRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'module-1',
    codename: {
        _schema: '1',
        _primary: 'en',
        locales: {
            en: { content: 'quiz-widget' }
        }
    },
    presentation: {
        name: {
            _schema: '1',
            _primary: 'en',
            locales: {
                en: { content: 'Quiz widget' }
            }
        }
    },
    attached_to_kind: 'metahub',
    attached_to_id: null,
    module_role: 'widget',
    source_kind: 'embedded',
    sdk_api_version: '1.0.0',
    source_code: 'export default class QuizWidgetModule {}',
    manifest: {
        className: 'QuizWidgetModule',
        sdkApiVersion: '1.0.0',
        moduleRole: 'widget',
        sourceKind: 'embedded',
        capabilities: ['metadata.read', 'rpc.client'],
        methods: [{ name: 'mount', target: 'client' }]
    },
    server_bundle: null,
    client_bundle: 'module.exports = class QuizWidgetModule {}',
    checksum: 'compiled-checksum',
    is_active: true,
    config: {},
    _upl_version: 1,
    _upl_updated_at: '2026-04-05T12:00:00.000Z',
    ...overrides
})

describe('MetahubModulesService', () => {
    const schemaName = 'mhb_1234567890abcdef1234567890abcdef'

    const schemaService = {
        ensureSchema: mockEnsureSchema
    } as unknown as ConstructorParameters<typeof MetahubModulesService>[1]

    const executor = {
        query: jest.fn(),
        transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(executor)),
        isReleased: jest.fn(() => false)
    } as unknown as ConstructorParameters<typeof MetahubModulesService>[0]

    const service = new MetahubModulesService(executor, schemaService)

    beforeEach(() => {
        jest.clearAllMocks()
        mockEnsureSchema.mockResolvedValue(schemaName)
        mockFindStoredMetahubModuleByScope.mockResolvedValue(null)
        mockFindStoredMetahubModuleById.mockResolvedValue(createStoredModuleRow())
        mockListStoredMetahubModules.mockResolvedValue([])
        mockListEditableTypes.mockResolvedValue([])
        mockCompileModuleSource.mockResolvedValue({
            manifest: {
                className: 'QuizWidgetModule',
                sdkApiVersion: '1.0.0',
                moduleRole: 'widget',
                sourceKind: 'embedded',
                capabilities: ['metadata.read', 'rpc.client'],
                methods: [{ name: 'mount', target: 'client' }]
            },
            serverBundle: null,
            clientBundle: 'module.exports = class QuizWidgetModule {}',
            checksum: 'compiled-checksum'
        })
        mockInsertStoredMetahubModule.mockResolvedValue(createStoredModuleRow())
        mockIncrementVersion.mockResolvedValue(createStoredModuleRow())
    })

    it('normalizes widget modules to embedded sources with role defaults before compilation', async () => {
        const result = await service.createModule(
            'metahub-1',
            {
                codename: 'QuizWidget',
                presentation: {
                    name: {
                        _primary: 'en',
                        locales: {
                            en: { content: 'Quiz widget' }
                        }
                    }
                },
                attachedToKind: 'metahub',
                attachedToId: 'metahub-1',
                moduleRole: 'widget',
                sourceCode: 'export default class QuizWidgetModule {}'
            },
            'user-1'
        )

        expect(mockCompileModuleSource).toHaveBeenCalledWith(
            expect.objectContaining({
                codename: 'quizwidget',
                moduleRole: 'widget',
                sourceKind: 'embedded',
                capabilities: ['metadata.read', 'rpc.client']
            })
        )
        expect(mockInsertStoredMetahubModule).toHaveBeenCalledWith(
            expect.anything(),
            schemaName,
            expect.objectContaining({
                attachedToKind: 'metahub',
                attachedToId: null,
                moduleRole: 'widget',
                sourceKind: 'embedded'
            })
        )
        expect(result.manifest.capabilities).toEqual(['metadata.read', 'rpc.client'])
    })

    it('creates general library modules with a null attachment id and shared compilation context', async () => {
        mockInsertStoredMetahubModule.mockResolvedValue(
            createStoredModuleRow({
                attached_to_kind: 'general',
                attached_to_id: null,
                module_role: 'library',
                manifest: {
                    className: 'SharedHelpers',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'library',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read'],
                    methods: []
                }
            })
        )

        await service.createModule(
            'metahub-1',
            {
                codename: 'SharedHelpers',
                presentation: {
                    name: {
                        _primary: 'en',
                        locales: {
                            en: { content: 'Shared helpers' }
                        }
                    }
                },
                attachedToKind: 'general',
                attachedToId: 'metahub-1',
                moduleRole: 'library',
                sourceCode: 'export default class SharedHelpers {}'
            },
            'user-1'
        )

        expect(mockCompileModuleSource).toHaveBeenCalledWith(
            expect.objectContaining({
                codename: 'sharedhelpers',
                moduleRole: 'library',
                sharedLibraries: {
                    sharedhelpers: {
                        codename: 'sharedhelpers',
                        sourceCode: 'export default class SharedHelpers {}'
                    }
                }
            })
        )
        expect(mockInsertStoredMetahubModule).toHaveBeenCalledWith(
            expect.anything(),
            schemaName,
            expect.objectContaining({
                attachedToKind: 'general',
                attachedToId: null,
                moduleRole: 'library'
            })
        )
    })

    it('accepts object module attachments for the direct standard object kind', async () => {
        mockListEditableTypes.mockResolvedValue([
            {
                kindKey: 'object',
                config: {
                    compatibility: {
                        legacyObjectKind: 'object'
                    }
                }
            }
        ])
        ;(executor.query as jest.Mock).mockResolvedValueOnce([{ id: 'object-1' }])
        mockInsertStoredMetahubModule.mockResolvedValueOnce(
            createStoredModuleRow({
                attached_to_kind: 'object',
                attached_to_id: 'object-1',
                module_role: 'module'
            })
        )

        await service.createModule(
            'metahub-1',
            {
                codename: 'CatalogRules',
                presentation: {
                    name: {
                        _primary: 'en',
                        locales: {
                            en: { content: 'Object rules' }
                        }
                    }
                },
                attachedToKind: 'object',
                attachedToId: 'object-1',
                moduleRole: 'module',
                sourceCode: 'export default class CatalogRules {}'
            },
            'user-1'
        )

        expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('kind = ANY($2::text[])'), ['object-1', ['object']])
        expect(mockInsertStoredMetahubModule).toHaveBeenCalledWith(
            expect.anything(),
            schemaName,
            expect.objectContaining({
                attachedToKind: 'object',
                attachedToId: 'object-1'
            })
        )
    })

    it('rejects general modules that do not use the library module role', async () => {
        await expect(
            service.createModule('metahub-1', {
                codename: 'SharedHelpers',
                presentation: {
                    name: {
                        _primary: 'en',
                        locales: {
                            en: { content: 'Shared helpers' }
                        }
                    }
                },
                attachedToKind: 'general',
                attachedToId: 'metahub-1',
                moduleRole: 'widget',
                sourceCode: 'export default class SharedHelpers {}'
            })
        ).rejects.toThrow('General modules must use the library module role')

        expect(mockCompileModuleSource).not.toHaveBeenCalled()
        expect(mockInsertStoredMetahubModule).not.toHaveBeenCalled()
    })

    it('rejects library modules outside the Common general scope', async () => {
        await expect(
            service.createModule('metahub-1', {
                codename: 'SharedHelpers',
                presentation: {
                    name: {
                        _primary: 'en',
                        locales: {
                            en: { content: 'Shared helpers' }
                        }
                    }
                },
                attachedToKind: 'metahub',
                attachedToId: 'metahub-1',
                moduleRole: 'library',
                sourceCode: 'export default class SharedHelpers {}'
            })
        ).rejects.toThrow('Library modules must use the general attachment scope')

        expect(mockCompileModuleSource).not.toHaveBeenCalled()
        expect(mockInsertStoredMetahubModule).not.toHaveBeenCalled()
    })

    it('rejects capabilities that are not allowed for the selected module role', async () => {
        await expect(
            service.createModule('metahub-1', {
                codename: 'QuizWidget',
                presentation: {
                    name: {
                        _primary: 'en',
                        locales: {
                            en: { content: 'Quiz widget' }
                        }
                    }
                },
                attachedToKind: 'metahub',
                attachedToId: 'metahub-1',
                moduleRole: 'widget',
                sourceCode: 'export default class QuizWidgetModule {}',
                capabilities: ['lifecycle']
            })
        ).rejects.toThrow('Module capabilities are not allowed for the selected module role')

        expect(mockCompileModuleSource).not.toHaveBeenCalled()
        expect(mockInsertStoredMetahubModule).not.toHaveBeenCalled()
    })

    it('rejects non-embedded sources during authoring in v1', async () => {
        await expect(
            service.createModule('metahub-1', {
                codename: 'QuizWidget',
                presentation: {
                    name: {
                        _primary: 'en',
                        locales: {
                            en: { content: 'Quiz widget' }
                        }
                    }
                },
                attachedToKind: 'metahub',
                attachedToId: 'metahub-1',
                moduleRole: 'widget',
                sourceKind: 'external',
                sourceCode: 'export default class QuizWidgetModule {}'
            })
        ).rejects.toThrow('Only embedded module sources are supported in v1')

        expect(mockCompileModuleSource).not.toHaveBeenCalled()
    })

    it('rejects unsupported sdkApiVersion values before persisting a module', async () => {
        await expect(
            service.createModule('metahub-1', {
                codename: 'QuizWidget',
                presentation: {
                    name: {
                        _primary: 'en',
                        locales: {
                            en: { content: 'Quiz widget' }
                        }
                    }
                },
                attachedToKind: 'metahub',
                attachedToId: 'metahub-1',
                moduleRole: 'widget',
                sdkApiVersion: '2.0.0',
                sourceCode: 'export default class QuizWidgetModule {}'
            })
        ).rejects.toThrow('Unsupported module sdkApiVersion "2.0.0". Supported versions: 1.0.0')

        expect(mockCompileModuleSource).not.toHaveBeenCalled()
        expect(mockInsertStoredMetahubModule).not.toHaveBeenCalled()
    })

    it('recompiles and persists updated source metadata for existing modules', async () => {
        mockFindStoredMetahubModuleById.mockResolvedValue(
            createStoredModuleRow({
                module_role: 'module',
                source_code: 'export default class ExistingModule extends ExtensionModule {}',
                manifest: {
                    className: 'ExistingModule',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'module',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read'],
                    methods: [{ name: 'mount', target: 'client' }]
                },
                client_bundle: 'module.exports = class ExistingModule {}'
            })
        )
        mockIncrementVersion.mockResolvedValue(
            createStoredModuleRow({
                source_code: 'export default class RuntimeQuizWidget extends ExtensionModule {}',
                manifest: {
                    className: 'QuizWidgetModule',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'widget',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read', 'rpc.client'],
                    methods: [{ name: 'mount', target: 'client' }]
                },
                client_bundle: 'module.exports = class QuizWidgetModule {}'
            })
        )

        await service.updateModule(
            'metahub-1',
            'module-1',
            {
                moduleRole: 'widget',
                sourceCode: 'export default class RuntimeQuizWidget extends ExtensionModule {}',
                capabilities: ['metadata.read', 'rpc.client']
            },
            'user-2'
        )

        expect(mockCompileModuleSource).toHaveBeenCalledWith(
            expect.objectContaining({
                codename: 'quiz-widget',
                moduleRole: 'widget',
                sourceCode: 'export default class RuntimeQuizWidget extends ExtensionModule {}',
                capabilities: ['metadata.read', 'rpc.client']
            })
        )
        expect(mockIncrementVersion).toHaveBeenCalledWith(
            expect.anything(),
            schemaName,
            expect.anything(),
            'module-1',
            expect.objectContaining({
                attached_to_kind: 'metahub',
                attached_to_id: null,
                module_role: 'widget',
                source_code: 'export default class RuntimeQuizWidget extends ExtensionModule {}',
                sdk_api_version: '1.0.0',
                client_bundle: 'module.exports = class QuizWidgetModule {}',
                _upl_updated_by: 'user-2'
            })
        )
    })

    it('rejects update requests that move Common modules out of the library role', async () => {
        mockFindStoredMetahubModuleById.mockResolvedValue(
            createStoredModuleRow({
                attached_to_kind: 'general',
                attached_to_id: null,
                module_role: 'library',
                manifest: {
                    className: 'SharedHelpers',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'library',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read'],
                    methods: []
                }
            })
        )

        await expect(
            service.updateModule('metahub-1', 'module-1', {
                moduleRole: 'widget'
            })
        ).rejects.toThrow('General modules must use the library module role')

        expect(mockCompileModuleSource).not.toHaveBeenCalled()
        expect(mockIncrementVersion).not.toHaveBeenCalled()
    })

    it('rejects update requests that move entity modules into the library role outside Common', async () => {
        mockFindStoredMetahubModuleById.mockResolvedValue(createStoredModuleRow())

        await expect(
            service.updateModule('metahub-1', 'module-1', {
                moduleRole: 'library'
            })
        ).rejects.toThrow('Library modules must use the general attachment scope')

        expect(mockCompileModuleSource).not.toHaveBeenCalled()
        expect(mockIncrementVersion).not.toHaveBeenCalled()
    })

    it('rejects existing out-of-scope library modules during update instead of preserving legacy state', async () => {
        mockFindStoredMetahubModuleById.mockResolvedValue(
            createStoredModuleRow({
                attached_to_kind: 'metahub',
                attached_to_id: null,
                module_role: 'library',
                manifest: {
                    className: 'LegacySharedModule',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'library',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read'],
                    methods: []
                }
            })
        )

        await expect(
            service.updateModule('metahub-1', 'module-1', {
                presentation: {
                    name: {
                        _primary: 'en',
                        locales: {
                            en: { content: 'Renamed legacy shared module' }
                        }
                    }
                }
            })
        ).rejects.toThrow('Library modules must use the general attachment scope')

        expect(mockCompileModuleSource).not.toHaveBeenCalled()
        expect(mockIncrementVersion).not.toHaveBeenCalled()
    })

    it('rejects update requests that would collide with another module codename in the same scope', async () => {
        mockFindStoredMetahubModuleById.mockResolvedValue(createStoredModuleRow())
        mockFindStoredMetahubModuleByScope.mockResolvedValue(createStoredModuleRow({ id: 'module-2' }))

        await expect(
            service.updateModule('metahub-1', 'module-1', {
                codename: 'quiz-widget'
            })
        ).rejects.toThrow('Module codename already exists in this attachment scope')

        expect(mockIncrementVersion).not.toHaveBeenCalled()
    })

    it('soft deletes modules through optimistic version updates', async () => {
        mockFindStoredMetahubModuleById.mockResolvedValue(createStoredModuleRow())

        await service.deleteModule('metahub-1', 'module-1', 'user-3')

        expect(mockIncrementVersion).toHaveBeenCalledWith(
            expect.anything(),
            schemaName,
            expect.anything(),
            'module-1',
            expect.objectContaining({
                _mhb_deleted: true,
                _mhb_deleted_by: 'user-3',
                _upl_updated_by: 'user-3'
            })
        )
        expect(mockCompileModuleSource).not.toHaveBeenCalled()
    })

    it('blocks deleting a shared library while other modules still import it', async () => {
        mockFindStoredMetahubModuleById.mockResolvedValue(
            createStoredModuleRow({
                attached_to_kind: 'general',
                attached_to_id: null,
                module_role: 'library',
                codename: {
                    _primary: 'en',
                    locales: {
                        en: { content: 'shared-helpers' }
                    }
                }
            })
        )
        mockListStoredMetahubModules.mockResolvedValue([
            createStoredModuleRow({
                id: 'module-2',
                attached_to_kind: 'object',
                attached_to_id: 'object-1',
                module_role: 'module',
                source_code: "import SharedHelpers from '@shared/shared-helpers'\nexport default class ConsumerModule {}"
            })
        ])

        await expect(service.deleteModule('metahub-1', 'module-1', 'user-3')).rejects.toThrow(
            'Shared library is still imported by other modules'
        )

        expect(mockIncrementVersion).not.toHaveBeenCalled()
    })

    it('validates shared libraries in topological order during publication and reuses one shared-library load', async () => {
        mockListStoredMetahubModules.mockResolvedValue([
            createStoredModuleRow({
                id: 'module-consumer',
                codename: {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'consumer-module' }
                    }
                },
                attached_to_kind: 'object',
                attached_to_id: 'object-1',
                module_role: 'module',
                source_code: "import SharedHelpers from '@shared/shared-helpers'\nexport default class ConsumerModule {}",
                manifest: {
                    className: 'ConsumerModule',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'module',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read'],
                    methods: []
                },
                client_bundle: 'compiled:consumer-module',
                checksum: 'checksum:consumer-module'
            }),
            createStoredModuleRow({
                id: 'shared-helpers',
                codename: {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'shared-helpers' }
                    }
                },
                attached_to_kind: 'general',
                attached_to_id: null,
                module_role: 'library',
                source_code: "import SharedCore from '@shared/shared-core'\nexport default class SharedHelpers {}",
                manifest: {
                    className: 'SharedHelpers',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'library',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read'],
                    methods: []
                },
                client_bundle: null,
                checksum: 'checksum:shared-helpers'
            }),
            createStoredModuleRow({
                id: 'plain-module',
                codename: {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'plain-module' }
                    }
                },
                attached_to_kind: 'metahub',
                attached_to_id: null,
                module_role: 'module',
                source_code: 'export default class PlainModule {}',
                manifest: {
                    className: 'PlainModule',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'module',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read'],
                    methods: []
                },
                client_bundle: 'compiled:plain-module',
                checksum: 'checksum:plain-module'
            }),
            createStoredModuleRow({
                id: 'shared-core',
                codename: {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'shared-core' }
                    }
                },
                attached_to_kind: 'general',
                attached_to_id: null,
                module_role: 'library',
                source_code: 'export default class SharedCore {}',
                manifest: {
                    className: 'SharedCore',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'library',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read'],
                    methods: []
                },
                client_bundle: null,
                checksum: 'checksum:shared-core'
            })
        ])
        mockCompileModuleSource.mockImplementation((input: Record<string, unknown>) => ({
            manifest: {
                className: String(input.codename),
                sdkApiVersion: '1.0.0',
                moduleRole: input.moduleRole,
                sourceKind: 'embedded',
                capabilities: ['metadata.read'],
                methods: []
            },
            serverBundle: null,
            clientBundle: `compiled:${String(input.codename)}`,
            checksum: `checksum:${String(input.codename)}`
        }))

        const result = await service.listPublishedModules('metahub-1')

        expect(mockListStoredMetahubModules).toHaveBeenCalledTimes(1)
        expect(mockCompileModuleSource).toHaveBeenCalledTimes(4)
        expect(mockCompileModuleSource).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                codename: 'shared-core',
                moduleRole: 'library',
                sharedLibraries: {
                    'shared-core': {
                        codename: 'shared-core',
                        sourceCode: 'export default class SharedCore {}'
                    },
                    'shared-helpers': {
                        codename: 'shared-helpers',
                        sourceCode: "import SharedCore from '@shared/shared-core'\nexport default class SharedHelpers {}"
                    }
                }
            })
        )
        expect(mockCompileModuleSource).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                codename: 'shared-helpers',
                moduleRole: 'library'
            })
        )
        expect(mockCompileModuleSource).toHaveBeenNthCalledWith(
            3,
            expect.objectContaining({
                codename: 'plain-module',
                moduleRole: 'module'
            })
        )
        expect(mockCompileModuleSource).toHaveBeenNthCalledWith(
            4,
            expect.objectContaining({
                codename: 'consumer-module',
                moduleRole: 'module'
            })
        )
        expect(result.map((module) => module.id)).toEqual(['plain-module', 'module-consumer'])
        expect(result.find((module) => module.id === 'module-consumer')).toEqual(
            expect.objectContaining({
                clientBundle: 'compiled:consumer-module',
                checksum: 'checksum:consumer-module'
            })
        )
        expect(result.find((module) => module.id === 'plain-module')).toEqual(
            expect.objectContaining({
                clientBundle: 'compiled:plain-module',
                checksum: 'checksum:plain-module'
            })
        )
    })

    it('fails publication listing when shared libraries form a circular dependency graph', async () => {
        mockListStoredMetahubModules.mockResolvedValue([
            createStoredModuleRow({
                id: 'shared-a',
                codename: {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'shared-a' }
                    }
                },
                attached_to_kind: 'general',
                attached_to_id: null,
                module_role: 'library',
                source_code: "import SharedB from '@shared/shared-b'\nexport default class SharedA {}",
                manifest: {
                    className: 'SharedA',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'library',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read'],
                    methods: []
                }
            }),
            createStoredModuleRow({
                id: 'shared-b',
                codename: {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'shared-b' }
                    }
                },
                attached_to_kind: 'general',
                attached_to_id: null,
                module_role: 'library',
                source_code: "import SharedA from '@shared/shared-a'\nexport default class SharedB {}",
                manifest: {
                    className: 'SharedB',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'library',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read'],
                    methods: []
                }
            })
        ])

        await expect(service.listPublishedModules('metahub-1')).rejects.toMatchObject({
            message: 'Module compilation failed',
            details: {
                message: 'Circular @shared imports detected: shared-a -> shared-b -> shared-a'
            }
        })

        expect(mockCompileModuleSource).not.toHaveBeenCalled()
    })
})
