const mockEnsureSchema = jest.fn()
const mockCompileScriptSource = jest.fn()
const mockFindStoredMetahubScriptByScope = jest.fn()
const mockFindStoredMetahubScriptById = jest.fn()
const mockInsertStoredMetahubScript = jest.fn()
const mockIncrementVersion = jest.fn()

jest.mock('@universo/scripting-engine', () => ({
    compileScriptSource: (...args: unknown[]) => mockCompileScriptSource(...args)
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
        insertStoredMetahubScript: (...args: unknown[]) => mockInsertStoredMetahubScript(...args)
    }
})

import { MetahubScriptsService } from '../../domains/scripts/services/MetahubScriptsService'

const createStoredScriptRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'script-1',
    codename: {
        _primary: 'en',
        locales: {
            en: { content: 'quiz-widget' }
        }
    },
    presentation: {
        name: {
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
})
