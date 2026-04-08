const mockEnsureSchema = jest.fn()
const mockCompileScriptSource = jest.fn()
const mockFindStoredMetahubScriptByScope = jest.fn()
const mockFindStoredMetahubScriptById = jest.fn()
const mockInsertStoredMetahubScript = jest.fn()
const mockListStoredMetahubScripts = jest.fn()
const mockIncrementVersion = jest.fn()

jest.mock('@universo/scripting-engine', () => ({
    compileScriptSource: (...args: unknown[]) => mockCompileScriptSource(...args),
    extractSharedScriptImports: (sourceCode: string) => {
        const matches = sourceCode.match(/@shared\/([a-z][a-z0-9-]*)/g) ?? []
        return matches.map((match) => match.replace('@shared/', ''))
    }
}))

jest.mock('../../utils/optimisticLock', () => ({
    incrementVersion: (...args: unknown[]) => mockIncrementVersion(...args)
}))

jest.mock('../../domains/scripts/services/scriptsStore', () => {
    const actual = jest.requireActual('../../domains/scripts/services/scriptsStore')

    return {
        ...actual,
        findStoredMetahubScriptByScope: (...args: unknown[]) => mockFindStoredMetahubScriptByScope(...args),
        findStoredMetahubScriptById: (...args: unknown[]) => mockFindStoredMetahubScriptById(...args),
        listStoredMetahubScripts: (...args: unknown[]) => mockListStoredMetahubScripts(...args),
        insertStoredMetahubScript: (...args: unknown[]) => mockInsertStoredMetahubScript(...args)
    }
})

import { MetahubScriptsService } from '../../domains/scripts/services/MetahubScriptsService'

const createStoredScriptRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'script-1',
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
    source_code: 'export default class QuizWidgetScript {}',
    manifest: {
        className: 'QuizWidgetScript',
        sdkApiVersion: '1.0.0',
        moduleRole: 'widget',
        sourceKind: 'embedded',
        capabilities: ['metadata.read', 'rpc.client'],
        methods: [{ name: 'mount', target: 'client' }]
    },
    server_bundle: null,
    client_bundle: 'module.exports = class QuizWidgetScript {}',
    checksum: 'compiled-checksum',
    is_active: true,
    config: {},
    _upl_version: 1,
    _upl_updated_at: '2026-04-05T12:00:00.000Z',
    ...overrides
})

describe('MetahubScriptsService', () => {
    const schemaName = 'mhb_1234567890abcdef1234567890abcdef'

    const schemaService = {
        ensureSchema: mockEnsureSchema
    } as unknown as ConstructorParameters<typeof MetahubScriptsService>[1]

    const executor = {
        query: jest.fn(),
        transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(executor)),
        isReleased: jest.fn(() => false)
    } as unknown as ConstructorParameters<typeof MetahubScriptsService>[0]

    const service = new MetahubScriptsService(executor, schemaService)

    beforeEach(() => {
        jest.clearAllMocks()
        mockEnsureSchema.mockResolvedValue(schemaName)
        mockFindStoredMetahubScriptByScope.mockResolvedValue(null)
        mockFindStoredMetahubScriptById.mockResolvedValue(createStoredScriptRow())
        mockListStoredMetahubScripts.mockResolvedValue([])
        mockCompileScriptSource.mockResolvedValue({
            manifest: {
                className: 'QuizWidgetScript',
                sdkApiVersion: '1.0.0',
                moduleRole: 'widget',
                sourceKind: 'embedded',
                capabilities: ['metadata.read', 'rpc.client'],
                methods: [{ name: 'mount', target: 'client' }]
            },
            serverBundle: null,
            clientBundle: 'module.exports = class QuizWidgetScript {}',
            checksum: 'compiled-checksum'
        })
        mockInsertStoredMetahubScript.mockResolvedValue(createStoredScriptRow())
        mockIncrementVersion.mockResolvedValue(createStoredScriptRow())
    })

    it('normalizes widget scripts to embedded sources with role defaults before compilation', async () => {
        const result = await service.createScript(
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
                sourceCode: 'export default class QuizWidgetScript {}'
            },
            'user-1'
        )

        expect(mockCompileScriptSource).toHaveBeenCalledWith(
            expect.objectContaining({
                codename: 'quizwidget',
                moduleRole: 'widget',
                sourceKind: 'embedded',
                capabilities: ['metadata.read', 'rpc.client']
            })
        )
        expect(mockInsertStoredMetahubScript).toHaveBeenCalledWith(
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

    it('creates general library scripts with a null attachment id and shared compilation context', async () => {
        mockInsertStoredMetahubScript.mockResolvedValue(
            createStoredScriptRow({
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

        await service.createScript(
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

        expect(mockCompileScriptSource).toHaveBeenCalledWith(
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
        expect(mockInsertStoredMetahubScript).toHaveBeenCalledWith(
            expect.anything(),
            schemaName,
            expect.objectContaining({
                attachedToKind: 'general',
                attachedToId: null,
                moduleRole: 'library'
            })
        )
    })

    it('rejects general scripts that do not use the library module role', async () => {
        await expect(
            service.createScript('metahub-1', {
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
        ).rejects.toThrow('General scripts must use the library module role')

        expect(mockCompileScriptSource).not.toHaveBeenCalled()
        expect(mockInsertStoredMetahubScript).not.toHaveBeenCalled()
    })

    it('rejects library scripts outside the Common general scope', async () => {
        await expect(
            service.createScript('metahub-1', {
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
        ).rejects.toThrow('Library scripts must use the general attachment scope')

        expect(mockCompileScriptSource).not.toHaveBeenCalled()
        expect(mockInsertStoredMetahubScript).not.toHaveBeenCalled()
    })

    it('rejects capabilities that are not allowed for the selected module role', async () => {
        await expect(
            service.createScript('metahub-1', {
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
                sourceCode: 'export default class QuizWidgetScript {}',
                capabilities: ['lifecycle']
            })
        ).rejects.toThrow('Script capabilities are not allowed for the selected module role')

        expect(mockCompileScriptSource).not.toHaveBeenCalled()
        expect(mockInsertStoredMetahubScript).not.toHaveBeenCalled()
    })

    it('rejects non-embedded sources during authoring in v1', async () => {
        await expect(
            service.createScript('metahub-1', {
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
                sourceCode: 'export default class QuizWidgetScript {}'
            })
        ).rejects.toThrow('Only embedded script sources are supported in v1')

        expect(mockCompileScriptSource).not.toHaveBeenCalled()
    })

    it('rejects unsupported sdkApiVersion values before persisting a script', async () => {
        await expect(
            service.createScript('metahub-1', {
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
                sourceCode: 'export default class QuizWidgetScript {}'
            })
        ).rejects.toThrow('Unsupported script sdkApiVersion "2.0.0". Supported versions: 1.0.0')

        expect(mockCompileScriptSource).not.toHaveBeenCalled()
        expect(mockInsertStoredMetahubScript).not.toHaveBeenCalled()
    })

    it('recompiles and persists updated source metadata for existing scripts', async () => {
        mockFindStoredMetahubScriptById.mockResolvedValue(
            createStoredScriptRow({
                module_role: 'module',
                source_code: 'export default class ExistingScript extends ExtensionScript {}',
                manifest: {
                    className: 'ExistingScript',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'module',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read'],
                    methods: [{ name: 'mount', target: 'client' }]
                },
                client_bundle: 'module.exports = class ExistingScript {}'
            })
        )
        mockIncrementVersion.mockResolvedValue(
            createStoredScriptRow({
                source_code: 'export default class RuntimeQuizWidget extends ExtensionScript {}',
                manifest: {
                    className: 'QuizWidgetScript',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'widget',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read', 'rpc.client'],
                    methods: [{ name: 'mount', target: 'client' }]
                },
                client_bundle: 'module.exports = class QuizWidgetScript {}'
            })
        )

        await service.updateScript(
            'metahub-1',
            'script-1',
            {
                moduleRole: 'widget',
                sourceCode: 'export default class RuntimeQuizWidget extends ExtensionScript {}',
                capabilities: ['metadata.read', 'rpc.client']
            },
            'user-2'
        )

        expect(mockCompileScriptSource).toHaveBeenCalledWith(
            expect.objectContaining({
                codename: 'quiz-widget',
                moduleRole: 'widget',
                sourceCode: 'export default class RuntimeQuizWidget extends ExtensionScript {}',
                capabilities: ['metadata.read', 'rpc.client']
            })
        )
        expect(mockIncrementVersion).toHaveBeenCalledWith(
            expect.anything(),
            schemaName,
            expect.anything(),
            'script-1',
            expect.objectContaining({
                attached_to_kind: 'metahub',
                attached_to_id: null,
                module_role: 'widget',
                source_code: 'export default class RuntimeQuizWidget extends ExtensionScript {}',
                sdk_api_version: '1.0.0',
                client_bundle: 'module.exports = class QuizWidgetScript {}',
                _upl_updated_by: 'user-2'
            })
        )
    })

    it('rejects update requests that move Common scripts out of the library role', async () => {
        mockFindStoredMetahubScriptById.mockResolvedValue(
            createStoredScriptRow({
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
            service.updateScript('metahub-1', 'script-1', {
                moduleRole: 'widget'
            })
        ).rejects.toThrow('General scripts must use the library module role')

        expect(mockCompileScriptSource).not.toHaveBeenCalled()
        expect(mockIncrementVersion).not.toHaveBeenCalled()
    })

    it('rejects update requests that move entity scripts into the library role outside Common', async () => {
        mockFindStoredMetahubScriptById.mockResolvedValue(createStoredScriptRow())

        await expect(
            service.updateScript('metahub-1', 'script-1', {
                moduleRole: 'library'
            })
        ).rejects.toThrow('Library scripts must use the general attachment scope')

        expect(mockCompileScriptSource).not.toHaveBeenCalled()
        expect(mockIncrementVersion).not.toHaveBeenCalled()
    })

    it('preserves legacy global rows when updating their source without changing role or attachment', async () => {
        mockFindStoredMetahubScriptById.mockResolvedValue(
            createStoredScriptRow({
                attached_to_kind: 'metahub',
                attached_to_id: null,
                module_role: 'global',
                manifest: {
                    className: 'LegacyGlobalScript',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'global',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read'],
                    methods: []
                }
            })
        )

        await service.updateScript(
            'metahub-1',
            'script-1',
            {
                sourceCode: 'export default class LegacyGlobalScript {}'
            },
            'user-2'
        )

        expect(mockCompileScriptSource).toHaveBeenCalledWith(
            expect.objectContaining({
                moduleRole: 'library'
            })
        )
        expect(mockIncrementVersion).toHaveBeenCalledWith(
            expect.anything(),
            schemaName,
            expect.anything(),
            'script-1',
            expect.objectContaining({
                attached_to_kind: 'metahub',
                attached_to_id: null,
                module_role: 'global',
                _upl_updated_by: 'user-2'
            })
        )
    })

    it('preserves legacy global rows when the UI sends back the normalized library role on save', async () => {
        mockFindStoredMetahubScriptById.mockResolvedValue(
            createStoredScriptRow({
                attached_to_kind: 'metahub',
                attached_to_id: null,
                module_role: 'global',
                manifest: {
                    className: 'LegacyGlobalScript',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'global',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read'],
                    methods: []
                }
            })
        )

        await service.updateScript(
            'metahub-1',
            'script-1',
            {
                moduleRole: 'library',
                sourceCode: 'export default class LegacyGlobalScript {}'
            },
            'user-2'
        )

        expect(mockCompileScriptSource).toHaveBeenCalledWith(
            expect.objectContaining({
                moduleRole: 'library'
            })
        )
        expect(mockIncrementVersion).toHaveBeenCalledWith(
            expect.anything(),
            schemaName,
            expect.anything(),
            'script-1',
            expect.objectContaining({
                attached_to_kind: 'metahub',
                attached_to_id: null,
                module_role: 'global',
                _upl_updated_by: 'user-2'
            })
        )
    })

    it('rejects update requests that would collide with another script codename in the same scope', async () => {
        mockFindStoredMetahubScriptById.mockResolvedValue(createStoredScriptRow())
        mockFindStoredMetahubScriptByScope.mockResolvedValue(createStoredScriptRow({ id: 'script-2' }))

        await expect(
            service.updateScript('metahub-1', 'script-1', {
                codename: 'quiz-widget'
            })
        ).rejects.toThrow('Script codename already exists in this attachment scope')

        expect(mockIncrementVersion).not.toHaveBeenCalled()
    })

    it('soft deletes scripts through optimistic version updates', async () => {
        mockFindStoredMetahubScriptById.mockResolvedValue(createStoredScriptRow())

        await service.deleteScript('metahub-1', 'script-1', 'user-3')

        expect(mockIncrementVersion).toHaveBeenCalledWith(
            expect.anything(),
            schemaName,
            expect.anything(),
            'script-1',
            expect.objectContaining({
                _mhb_deleted: true,
                _mhb_deleted_by: 'user-3',
                _upl_updated_by: 'user-3'
            })
        )
        expect(mockCompileScriptSource).not.toHaveBeenCalled()
    })

    it('blocks deleting a shared library while other scripts still import it', async () => {
        mockFindStoredMetahubScriptById.mockResolvedValue(
            createStoredScriptRow({
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
        mockListStoredMetahubScripts.mockResolvedValue([
            createStoredScriptRow({
                id: 'script-2',
                attached_to_kind: 'catalog',
                attached_to_id: 'catalog-1',
                module_role: 'module',
                source_code: "import SharedHelpers from '@shared/shared-helpers'\nexport default class ConsumerScript {}"
            })
        ])

        await expect(service.deleteScript('metahub-1', 'script-1', 'user-3')).rejects.toThrow(
            'Shared library is still imported by other scripts'
        )

        expect(mockIncrementVersion).not.toHaveBeenCalled()
    })

    it('validates shared libraries in topological order during publication and reuses one shared-library load', async () => {
        mockListStoredMetahubScripts.mockResolvedValue([
            createStoredScriptRow({
                id: 'script-consumer',
                codename: {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'consumer-script' }
                    }
                },
                attached_to_kind: 'catalog',
                attached_to_id: 'catalog-1',
                module_role: 'module',
                source_code: "import SharedHelpers from '@shared/shared-helpers'\nexport default class ConsumerScript {}",
                manifest: {
                    className: 'ConsumerScript',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'module',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read'],
                    methods: []
                },
                client_bundle: 'compiled:consumer-script',
                checksum: 'checksum:consumer-script'
            }),
            createStoredScriptRow({
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
            createStoredScriptRow({
                id: 'plain-script',
                codename: {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'plain-script' }
                    }
                },
                attached_to_kind: 'metahub',
                attached_to_id: null,
                module_role: 'module',
                source_code: 'export default class PlainScript {}',
                manifest: {
                    className: 'PlainScript',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'module',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read'],
                    methods: []
                },
                client_bundle: 'compiled:plain-script',
                checksum: 'checksum:plain-script'
            }),
            createStoredScriptRow({
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
        mockCompileScriptSource.mockImplementation((input: Record<string, unknown>) => ({
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

        const result = await service.listPublishedScripts('metahub-1')

        expect(mockListStoredMetahubScripts).toHaveBeenCalledTimes(1)
        expect(mockCompileScriptSource).toHaveBeenCalledTimes(3)
        expect(mockCompileScriptSource).toHaveBeenNthCalledWith(
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
        expect(mockCompileScriptSource).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                codename: 'shared-helpers',
                moduleRole: 'library'
            })
        )
        expect(mockCompileScriptSource).toHaveBeenNthCalledWith(
            3,
            expect.objectContaining({
                codename: 'consumer-script',
                moduleRole: 'module'
            })
        )
        expect(result.map((script) => script.id)).toEqual(['script-consumer', 'plain-script'])
        expect(result[0]).toEqual(
            expect.objectContaining({
                clientBundle: 'compiled:consumer-script',
                checksum: 'checksum:consumer-script'
            })
        )
        expect(result[1]).toEqual(
            expect.objectContaining({
                clientBundle: 'compiled:plain-script',
                checksum: 'checksum:plain-script'
            })
        )
    })

    it('fails publication listing when shared libraries form a circular dependency graph', async () => {
        mockListStoredMetahubScripts.mockResolvedValue([
            createStoredScriptRow({
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
            createStoredScriptRow({
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

        await expect(service.listPublishedScripts('metahub-1')).rejects.toMatchObject({
            message: 'Script compilation failed',
            details: {
                message: 'Circular @shared imports detected: shared-a -> shared-b -> shared-a'
            }
        })

        expect(mockCompileScriptSource).not.toHaveBeenCalled()
    })
})
