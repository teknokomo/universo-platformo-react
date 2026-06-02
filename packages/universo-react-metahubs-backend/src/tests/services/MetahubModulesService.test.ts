const mockEnsureSchema = jest.fn()
const mockCompileModuleSource = jest.fn()
const mockFindStoredMetahubModuleByScope = jest.fn()
const mockFindStoredMetahubModuleById = jest.fn()
const mockFindStoredMetahubModuleBySourcePath = jest.fn()
const mockInsertStoredMetahubModule = jest.fn()
const mockDeleteStoredMetahubModuleById = jest.fn()
const mockListStoredMetahubModules = jest.fn()
const mockIncrementVersion = jest.fn()
const mockUpdateWithVersionCheck = jest.fn()
const mockListEditableTypes = jest.fn()
const mockListMetahubPackages = jest.fn()
const editorPackageName = `@universo-react/${'playcanvas-editor'}`
const computeTestChecksum = (sourceCode: string) => require('crypto').createHash('sha256').update(sourceCode, 'utf8').digest('hex')

jest.mock('@universo-react/modules-engine', () => ({
    compileModuleSource: (...args: unknown[]) => mockCompileModuleSource(...args),
    extractSharedModuleImports: (sourceCode: string) => {
        const matches = sourceCode.match(/@shared\/([a-z][a-z0-9-]*)/g) ?? []
        return matches.map((match) => match.replace('@shared/', ''))
    }
}))

jest.mock('../../utils/optimisticLock', () => ({
    incrementVersion: (...args: unknown[]) => mockIncrementVersion(...args),
    updateWithVersionCheck: (...args: unknown[]) => mockUpdateWithVersionCheck(...args)
}))

jest.mock('../../domains/modules/services/modulesStore', () => {
    const actual = jest.requireActual('../../domains/modules/services/modulesStore')

    return {
        ...actual,
        findStoredMetahubModuleByScope: (...args: unknown[]) => mockFindStoredMetahubModuleByScope(...args),
        findStoredMetahubModuleById: (...args: unknown[]) => mockFindStoredMetahubModuleById(...args),
        findStoredMetahubModuleBySourcePath: (...args: unknown[]) => mockFindStoredMetahubModuleBySourcePath(...args),
        listStoredMetahubModules: (...args: unknown[]) => mockListStoredMetahubModules(...args),
        insertStoredMetahubModule: (...args: unknown[]) => mockInsertStoredMetahubModule(...args),
        deleteStoredMetahubModuleById: (...args: unknown[]) => mockDeleteStoredMetahubModuleById(...args)
    }
})

jest.mock('../../domains/entities/services/EntityTypeService', () => ({
    __esModule: true,
    EntityTypeService: jest.fn().mockImplementation(() => ({
        listEditableTypes: (...args: unknown[]) => mockListEditableTypes(...args)
    }))
}))

jest.mock('../../persistence', () => ({
    __esModule: true,
    listMetahubPackages: (...args: unknown[]) => mockListMetahubPackages(...args)
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
        ;(executor.query as jest.Mock).mockResolvedValue([])
        mockEnsureSchema.mockResolvedValue(schemaName)
        mockFindStoredMetahubModuleByScope.mockResolvedValue(null)
        mockFindStoredMetahubModuleById.mockResolvedValue(createStoredModuleRow())
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(null)
        mockListStoredMetahubModules.mockResolvedValue([])
        mockListEditableTypes.mockResolvedValue([])
        mockListMetahubPackages.mockResolvedValue([])
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
        mockDeleteStoredMetahubModuleById.mockResolvedValue(undefined)
        mockIncrementVersion.mockResolvedValue(createStoredModuleRow())
        mockUpdateWithVersionCheck.mockResolvedValue(createStoredModuleRow({ _upl_version: 2 }))
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

    it('rejects duplicate file-backed source paths before writing module files', async () => {
        const write = jest.fn()
        const read = jest.fn()
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/metahub/quiz-widget.ts'),
            write,
            read
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)

        ;(executor.query as jest.Mock).mockResolvedValue([{ available: true }])
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(createStoredModuleRow({ id: 'module-2' }))

        await expect(
            fileService.createModule('metahub-1', {
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
                storageMode: 'file',
                sourcePath: 'modules/metahub/quiz-widget.ts',
                sourceCode: 'export default class QuizWidgetModule {}'
            })
        ).rejects.toThrow('Module source path is already used by another module')

        expect(write).not.toHaveBeenCalled()
        expect(read).not.toHaveBeenCalled()
        expect(mockCompileModuleSource).not.toHaveBeenCalled()
        expect(mockInsertStoredMetahubModule).not.toHaveBeenCalled()
    })

    it('removes a pre-insert file-backed source write when database insert fails', async () => {
        const sourceCode = 'export default class QuizWidgetModule {}'
        const sourceChecksum = computeTestChecksum(sourceCode)
        let fileWritten = false
        const write = jest.fn(async () => {
            fileWritten = true
        })
        const remove = jest.fn()
        const missingFileError = Object.assign(new Error('missing source file'), { code: 'ENOENT' })
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/metahub/quiz-widget.ts'),
            write,
            read: jest.fn(async () => {
                if (!fileWritten) {
                    throw missingFileError
                }
                return {
                    sourceCode,
                    checksum: sourceChecksum,
                    sourcePath: 'modules/metahub/quiz-widget.ts',
                    absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
                }
            }),
            delete: remove
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)

        ;(executor.query as jest.Mock).mockResolvedValue([{ available: true }])
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(null)
        mockInsertStoredMetahubModule.mockRejectedValue(new Error('duplicate source path'))

        await expect(
            fileService.createModule('metahub-1', {
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
                storageMode: 'file',
                sourcePath: 'modules/metahub/quiz-widget.ts',
                sourceCode
            })
        ).rejects.toThrow('duplicate source path')

        expect(write).toHaveBeenCalledWith({ metahubId: 'metahub-1', branchSlug: schemaName }, 'modules/metahub/quiz-widget.ts', sourceCode)
        expect(mockInsertStoredMetahubModule).toHaveBeenCalled()
        expect(remove).toHaveBeenCalledWith({ metahubId: 'metahub-1', branchSlug: schemaName }, 'modules/metahub/quiz-widget.ts')
    })

    it('rejects file-backed creates that would overwrite an unmanaged existing source file', async () => {
        const write = jest.fn()
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/metahub/quiz-widget.ts'),
            write,
            read: jest.fn(async () => ({
                sourceCode: 'export default class ExistingUnmanagedModule {}',
                checksum: 'existing-file-checksum',
                sourcePath: 'modules/metahub/quiz-widget.ts',
                absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
            }))
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)

        ;(executor.query as jest.Mock).mockResolvedValue([{ available: true }])
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(null)

        await expect(
            fileService.createModule('metahub-1', {
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
                storageMode: 'file',
                sourcePath: 'modules/metahub/quiz-widget.ts',
                sourceCode: 'export default class NewModule {}'
            })
        ).rejects.toThrow('File-backed module source creates require an expected source checksum')

        expect(write).not.toHaveBeenCalled()
        expect(mockCompileModuleSource).not.toHaveBeenCalled()
        expect(mockInsertStoredMetahubModule).not.toHaveBeenCalled()
    })

    it('maps missing external file-backed source creates to a domain validation error without absolute paths', async () => {
        const absolutePath = '/tmp/upl-storage/metahubs/metahub-1/branches/main/modules/general/shared.ts'
        const missingFileError = Object.assign(new Error(`ENOENT: no such file or directory, open '${absolutePath}'`), {
            code: 'ENOENT'
        })
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/general/shared.ts'),
            read: jest.fn(async () => {
                throw missingFileError
            }),
            write: jest.fn()
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)

        ;(executor.query as jest.Mock).mockResolvedValue([{ available: true }])
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(null)

        const create = () =>
            fileService.createModule('metahub-1', {
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
                attachedToId: null,
                moduleRole: 'library',
                storageMode: 'file',
                sourcePath: 'modules/general/shared.ts'
            })

        await expect(create()).rejects.toMatchObject({
            message: 'File-backed module source file is missing',
            details: {
                sourcePath: 'modules/general/shared.ts',
                messageCode: 'modules.sourcePath.missing'
            }
        })
        await expect(create()).rejects.not.toThrow(absolutePath)

        expect(mockCompileModuleSource).not.toHaveBeenCalled()
        expect(mockInsertStoredMetahubModule).not.toHaveBeenCalled()
    })

    it('rechecks missing file-backed create targets immediately before writing source files', async () => {
        const write = jest.fn()
        const remove = jest.fn()
        const missingFileError = Object.assign(new Error('missing source file'), { code: 'ENOENT' })
        const read = jest.fn().mockRejectedValueOnce(missingFileError).mockRejectedValueOnce(missingFileError).mockResolvedValueOnce({
            sourceCode: 'export default class RacingModule {}',
            checksum: 'racing-file-checksum',
            sourcePath: 'modules/metahub/quiz-widget.ts',
            absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
        })
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/metahub/quiz-widget.ts'),
            write,
            read,
            delete: remove
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)

        ;(executor.query as jest.Mock).mockResolvedValue([{ available: true }])
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(null)

        await expect(
            fileService.createModule('metahub-1', {
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
                storageMode: 'file',
                sourcePath: 'modules/metahub/quiz-widget.ts',
                sourceCode: 'export default class NewModule {}'
            })
        ).rejects.toThrow('File-backed module source was created by another writer')

        expect(mockInsertStoredMetahubModule).not.toHaveBeenCalled()
        expect(mockDeleteStoredMetahubModuleById).not.toHaveBeenCalled()
        expect(mockIncrementVersion).not.toHaveBeenCalled()
        expect(write).not.toHaveBeenCalled()
    })

    it('returns hydrated source metadata after creating a file-backed module with a new source file', async () => {
        const sourceCode = 'export default class QuizWidgetModule {}'
        const sourceChecksum = computeTestChecksum(sourceCode)
        const missingFileError = Object.assign(new Error('missing source file'), { code: 'ENOENT' })
        const read = jest
            .fn()
            .mockRejectedValueOnce(missingFileError)
            .mockRejectedValueOnce(missingFileError)
            .mockRejectedValueOnce(missingFileError)
            .mockResolvedValueOnce({
                sourceCode,
                checksum: sourceChecksum,
                sourcePath: 'modules/metahub/quiz-widget.ts',
                absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
            })
        const write = jest.fn()
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/metahub/quiz-widget.ts'),
            read,
            write,
            delete: jest.fn()
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)
        mockInsertStoredMetahubModule.mockResolvedValue(
            createStoredModuleRow({
                source_code: null,
                storage_mode: 'file',
                source_path: 'modules/metahub/quiz-widget.ts',
                source_checksum: sourceChecksum,
                source_last_read_at: '2026-06-02T00:00:00.000Z',
                source_last_compile_status: 'success'
            })
        )
        ;(executor.query as jest.Mock).mockResolvedValue([{ available: true }])
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(null)

        const result = await fileService.createModule('metahub-1', {
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
            storageMode: 'file',
            sourcePath: 'modules/metahub/quiz-widget.ts',
            sourceCode
        })

        expect(write).toHaveBeenCalledWith({ metahubId: 'metahub-1', branchSlug: schemaName }, 'modules/metahub/quiz-widget.ts', sourceCode)
        expect(result.sourceCode).toBe(sourceCode)
        expect(result.sourceStatus).toBe('ready')
        expect(result.sourceStorage.content).toBe(sourceCode)
        expect(result.sourceStorage.status).toBe('ready')
        expect(result.sourceStorage.checksum).toBe(sourceChecksum)
        expect(result.sourceStorage.absolutePath).toBe('/tmp/modules/metahub/quiz-widget.ts')
    })

    it('removes a newly written source file when the surrounding create transaction commit fails', async () => {
        const sourceCode = 'export default class QuizWidgetModule {}'
        const sourceChecksum = computeTestChecksum(sourceCode)
        const missingFileError = Object.assign(new Error('missing source file'), { code: 'ENOENT' })
        const read = jest
            .fn()
            .mockRejectedValueOnce(missingFileError)
            .mockRejectedValueOnce(missingFileError)
            .mockRejectedValueOnce(missingFileError)
            .mockResolvedValueOnce({
                sourceCode,
                checksum: sourceChecksum,
                sourcePath: 'modules/metahub/quiz-widget.ts',
                absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
            })
            .mockResolvedValueOnce({
                sourceCode,
                checksum: sourceChecksum,
                sourcePath: 'modules/metahub/quiz-widget.ts',
                absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
            })
        const write = jest.fn()
        const remove = jest.fn()
        const commitFailingExecutor = {
            query: jest.fn(async () => [{ available: true }]),
            transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
                await callback(commitFailingExecutor)
                throw new Error('transaction commit failed')
            }),
            isReleased: jest.fn(() => false)
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[0]
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/metahub/quiz-widget.ts'),
            read,
            write,
            delete: remove
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(commitFailingExecutor, schemaService, sourceFileService)
        mockInsertStoredMetahubModule.mockResolvedValue(
            createStoredModuleRow({
                source_code: null,
                storage_mode: 'file',
                source_path: 'modules/metahub/quiz-widget.ts',
                source_checksum: sourceChecksum
            })
        )
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(null)

        await expect(
            fileService.createModule('metahub-1', {
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
                storageMode: 'file',
                sourcePath: 'modules/metahub/quiz-widget.ts',
                sourceCode
            })
        ).rejects.toThrow('transaction commit failed')

        expect(write).toHaveBeenCalledWith({ metahubId: 'metahub-1', branchSlug: schemaName }, 'modules/metahub/quiz-widget.ts', sourceCode)
        expect(remove).toHaveBeenCalledWith({ metahubId: 'metahub-1', branchSlug: schemaName }, 'modules/metahub/quiz-widget.ts')
    })

    it('hydrates schema-scoped file-backed modules when a metahub id is provided', async () => {
        const sourceCode = 'export default class ActionModule {}'
        const sourceChecksum = computeTestChecksum(sourceCode)
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/object/action-module.ts'),
            read: jest.fn(async () => ({
                sourceCode,
                checksum: sourceChecksum,
                sourcePath: 'modules/object/action-module.ts',
                absolutePath: '/tmp/modules/object/action-module.ts'
            })),
            write: jest.fn(),
            delete: jest.fn()
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)
        mockFindStoredMetahubModuleById.mockResolvedValue(
            createStoredModuleRow({
                source_code: null,
                storage_mode: 'file',
                source_path: 'modules/object/action-module.ts',
                source_checksum: sourceChecksum
            })
        )

        const result = await fileService.getModuleByIdInSchema(schemaName, 'module-1', executor, 'metahub-1')

        expect(sourceFileService.read).toHaveBeenCalledWith(
            { metahubId: 'metahub-1', branchSlug: schemaName },
            'modules/object/action-module.ts'
        )
        expect(result?.sourceCode).toBe(sourceCode)
        expect(result?.sourceStorage.content).toBe(sourceCode)
        expect(result?.sourceStorage.status).toBe('ready')
        expect(result?.sourceStorage.absolutePath).toBe('/tmp/modules/object/action-module.ts')
    })

    it('wraps file-backed source writes in a database advisory lock', async () => {
        const sourceCode = 'export default class QuizWidgetModule {}'
        const sourceChecksum = computeTestChecksum(sourceCode)
        const missingFileError = Object.assign(new Error('missing source file'), { code: 'ENOENT' })
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/metahub/quiz-widget.ts'),
            read: jest
                .fn()
                .mockRejectedValueOnce(missingFileError)
                .mockRejectedValueOnce(missingFileError)
                .mockRejectedValueOnce(missingFileError)
                .mockResolvedValueOnce({
                    sourceCode,
                    checksum: sourceChecksum,
                    sourcePath: 'modules/metahub/quiz-widget.ts',
                    absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
                }),
            write: jest.fn(),
            delete: jest.fn()
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)
        mockInsertStoredMetahubModule.mockResolvedValue(
            createStoredModuleRow({
                source_code: null,
                storage_mode: 'file',
                source_path: 'modules/metahub/quiz-widget.ts',
                source_checksum: sourceChecksum
            })
        )
        ;(executor.query as jest.Mock).mockResolvedValue([{ available: true }])
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(null)

        await fileService.createModule('metahub-1', {
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
            storageMode: 'file',
            sourcePath: 'modules/metahub/quiz-widget.ts',
            sourceCode
        })

        expect(executor.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1))', [
            `metahub-module-source:metahub-1:${schemaName}:modules/metahub/quiz-widget.ts`
        ])
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
        ;(executor.query as jest.Mock).mockResolvedValueOnce([{ id: 'object-1' }]).mockResolvedValueOnce([])
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

    it('requires an expected checksum before writing file-backed source updates', async () => {
        const write = jest.fn()
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/metahub/quiz-widget.ts'),
            write,
            read: jest.fn(async () => ({
                sourceCode: 'export default class ExistingModule {}',
                checksum: 'old-source-checksum',
                sourcePath: 'modules/metahub/quiz-widget.ts',
                absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
            }))
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)
        const existing = createStoredModuleRow({
            storage_mode: 'file',
            source_path: 'modules/metahub/quiz-widget.ts',
            source_code: null,
            source_checksum: 'old-source-checksum'
        })

        ;(executor.query as jest.Mock).mockResolvedValue([{ available: true }])
        mockFindStoredMetahubModuleById.mockResolvedValue(existing)
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(existing)

        await expect(
            fileService.updateModule('metahub-1', 'module-1', {
                storageMode: 'file',
                sourcePath: 'modules/metahub/quiz-widget.ts',
                sourceCode: 'export default class BrokenModule {',
                expectedVersion: 1
            })
        ).rejects.toThrow('File-backed module source updates require an expected source checksum')

        expect(write).not.toHaveBeenCalled()
        expect(mockCompileModuleSource).not.toHaveBeenCalled()
        expect(mockIncrementVersion).not.toHaveBeenCalled()
    })

    it('requires an expected module version before file-backed source updates', async () => {
        const write = jest.fn()
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/metahub/quiz-widget.ts'),
            write,
            read: jest.fn()
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)

        mockFindStoredMetahubModuleById.mockResolvedValue(
            createStoredModuleRow({
                storage_mode: 'file',
                source_path: 'modules/metahub/quiz-widget.ts',
                source_code: null,
                source_checksum: 'old-source-checksum'
            })
        )

        await expect(
            fileService.updateModule('metahub-1', 'module-1', {
                storageMode: 'file',
                sourcePath: 'modules/metahub/quiz-widget.ts',
                sourceCode: 'export default class UpdatedModule {}',
                expectedSourceChecksum: 'old-source-checksum'
            })
        ).rejects.toThrow('File-backed module updates require an expected module version')

        expect(sourceFileService.read).not.toHaveBeenCalled()
        expect(write).not.toHaveBeenCalled()
        expect(mockCompileModuleSource).not.toHaveBeenCalled()
        expect(mockUpdateWithVersionCheck).not.toHaveBeenCalled()
        expect(mockIncrementVersion).not.toHaveBeenCalled()
    })

    it('writes file-backed source updates when the expected checksum matches', async () => {
        let currentSourceCode = 'export default class ExistingModule {}'
        let currentChecksum = 'old-source-checksum'
        const write = jest.fn(async (_context: unknown, _sourcePath: string, sourceCode: string) => {
            currentSourceCode = sourceCode
            currentChecksum = 'updated-source-checksum'
        })
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/metahub/quiz-widget.ts'),
            write,
            read: jest.fn(async () => ({
                sourceCode: currentSourceCode,
                checksum: currentChecksum,
                sourcePath: 'modules/metahub/quiz-widget.ts',
                absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
            }))
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)
        const existing = createStoredModuleRow({
            storage_mode: 'file',
            source_path: 'modules/metahub/quiz-widget.ts',
            source_code: null,
            source_checksum: 'old-source-checksum'
        })

        ;(executor.query as jest.Mock).mockResolvedValue([{ available: true }])
        mockFindStoredMetahubModuleById.mockResolvedValue(existing)
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(existing)
        mockUpdateWithVersionCheck.mockResolvedValue(
            createStoredModuleRow({
                storage_mode: 'file',
                source_path: 'modules/metahub/quiz-widget.ts',
                source_code: null,
                source_checksum: 'updated-source-checksum'
            })
        )

        const result = await fileService.updateModule('metahub-1', 'module-1', {
            storageMode: 'file',
            sourcePath: 'modules/metahub/quiz-widget.ts',
            sourceCode: 'export default class UpdatedModule {}',
            expectedVersion: 1,
            expectedSourceChecksum: 'old-source-checksum'
        })

        expect(write).toHaveBeenCalledWith(
            { metahubId: 'metahub-1', branchSlug: schemaName },
            'modules/metahub/quiz-widget.ts',
            'export default class UpdatedModule {}'
        )
        expect(mockCompileModuleSource).toHaveBeenCalledWith(
            expect.objectContaining({
                diagnosticFileName: 'modules/metahub/quiz-widget.ts',
                sourceCode: 'export default class UpdatedModule {}'
            })
        )
        expect(mockUpdateWithVersionCheck).toHaveBeenCalledWith(
            expect.objectContaining({
                schemaName,
                entityId: 'module-1',
                entityType: 'module',
                expectedVersion: 1,
                updateData: expect.objectContaining({
                    source_code: null,
                    storage_mode: 'file',
                    source_path: 'modules/metahub/quiz-widget.ts'
                })
            })
        )
        expect(result.sourceCode).toBe('export default class UpdatedModule {}')
        expect(result.sourceStorage.content).toBe('export default class UpdatedModule {}')
        expect(result.sourceStatus).toBe('ready')
    })

    it('maps missing external file-backed source updates to a domain validation error without absolute paths', async () => {
        const absolutePath = '/tmp/upl-storage/metahubs/metahub-1/branches/main/modules/general/shared.ts'
        const missingFileError = Object.assign(new Error(`ENOENT: no such file or directory, open '${absolutePath}'`), {
            code: 'ENOENT'
        })
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/general/shared.ts'),
            read: jest.fn(async () => {
                throw missingFileError
            }),
            write: jest.fn(),
            delete: jest.fn()
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)
        const existing = createStoredModuleRow({
            id: 'module-1',
            attached_to_kind: 'general',
            attached_to_id: null,
            module_role: 'library',
            storage_mode: 'file',
            source_path: 'modules/general/shared.ts',
            source_code: null,
            source_checksum: 'old-source-checksum'
        })

        ;(executor.query as jest.Mock).mockResolvedValue([{ available: true }])
        mockFindStoredMetahubModuleById.mockResolvedValue(existing)
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(existing)

        const update = () =>
            fileService.updateModule('metahub-1', 'module-1', {
                presentation: {
                    name: {
                        _primary: 'en',
                        locales: {
                            en: { content: 'Shared helpers' }
                        }
                    }
                },
                expectedVersion: 1
            })

        await expect(update()).rejects.toMatchObject({
            message: 'File-backed module source file is missing',
            details: {
                sourcePath: 'modules/general/shared.ts',
                messageCode: 'modules.sourcePath.missing'
            }
        })
        await expect(update()).rejects.not.toThrow(absolutePath)

        expect(mockCompileModuleSource).not.toHaveBeenCalled()
        expect(mockIncrementVersion).not.toHaveBeenCalled()
    })

    it('recompiles an existing file-backed module when the external file checksum changed', async () => {
        const write = jest.fn()
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/metahub/quiz-widget.ts'),
            write,
            read: jest.fn(async () => ({
                sourceCode: 'export default class UpdatedFromDiskModule {}',
                checksum: 'new-source-checksum',
                sourcePath: 'modules/metahub/quiz-widget.ts',
                absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
            }))
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)
        const existing = createStoredModuleRow({
            storage_mode: 'file',
            source_path: 'modules/metahub/quiz-widget.ts',
            source_code: null,
            source_checksum: 'old-source-checksum'
        })

        ;(executor.query as jest.Mock).mockResolvedValue([{ available: true }])
        mockFindStoredMetahubModuleById.mockResolvedValue(existing)
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(existing)

        await fileService.updateModule('metahub-1', 'module-1', {
            isActive: true,
            expectedVersion: 1,
            expectedSourceChecksum: 'new-source-checksum'
        })

        expect(write).not.toHaveBeenCalled()
        expect(mockCompileModuleSource).toHaveBeenCalledWith(
            expect.objectContaining({
                diagnosticFileName: 'modules/metahub/quiz-widget.ts',
                sourceCode: 'export default class UpdatedFromDiskModule {}'
            })
        )
        expect(mockUpdateWithVersionCheck).toHaveBeenCalledWith(
            expect.objectContaining({
                schemaName,
                entityId: 'module-1',
                entityType: 'module',
                expectedVersion: 1,
                updateData: expect.objectContaining({
                    source_code: null,
                    storage_mode: 'file',
                    source_path: 'modules/metahub/quiz-widget.ts',
                    source_checksum: 'new-source-checksum',
                    client_bundle: 'module.exports = class QuizWidgetModule {}',
                    checksum: 'compiled-checksum'
                })
            })
        )
    })

    it('skips recompilation for an unchanged file-backed module metadata save', async () => {
        const write = jest.fn()
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/metahub/quiz-widget.ts'),
            write,
            read: jest.fn(async () => ({
                sourceCode: 'export default class ExistingModule {}',
                checksum: 'same-source-checksum',
                sourcePath: 'modules/metahub/quiz-widget.ts',
                absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
            }))
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)
        const existing = createStoredModuleRow({
            storage_mode: 'file',
            source_path: 'modules/metahub/quiz-widget.ts',
            source_code: null,
            source_checksum: 'same-source-checksum'
        })

        ;(executor.query as jest.Mock).mockResolvedValue([{ available: true }])
        mockFindStoredMetahubModuleById.mockResolvedValue(existing)
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(existing)

        await fileService.updateModule('metahub-1', 'module-1', {
            isActive: true,
            expectedVersion: 1,
            expectedSourceChecksum: 'same-source-checksum'
        })

        expect(write).not.toHaveBeenCalled()
        expect(mockCompileModuleSource).not.toHaveBeenCalled()
        expect(mockUpdateWithVersionCheck).toHaveBeenCalledWith(
            expect.objectContaining({
                schemaName,
                entityId: 'module-1',
                entityType: 'module',
                expectedVersion: 1,
                updateData: expect.objectContaining({
                    source_code: null,
                    storage_mode: 'file',
                    source_path: 'modules/metahub/quiz-widget.ts',
                    source_checksum: 'same-source-checksum',
                    client_bundle: 'module.exports = class QuizWidgetModule {}',
                    checksum: 'compiled-checksum'
                })
            })
        )
    })

    it('creates a missing file-backed source file when converting an inline module with source content', async () => {
        const write = jest.fn()
        const missingFileError = Object.assign(new Error('missing source file'), { code: 'ENOENT' })
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/metahub/quiz-widget.ts'),
            write,
            read: jest.fn(async () => {
                throw missingFileError
            })
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)
        const existing = createStoredModuleRow({
            storage_mode: 'inline',
            source_path: null,
            source_code: 'export default class ExistingInlineModule {}',
            source_checksum: null
        })

        ;(executor.query as jest.Mock).mockResolvedValue([{ available: true }])
        mockFindStoredMetahubModuleById.mockResolvedValue(existing)
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(null)

        await fileService.updateModule('metahub-1', 'module-1', {
            storageMode: 'file',
            sourcePath: 'modules/metahub/quiz-widget.ts',
            sourceCode: 'export default class ConvertedModule {}',
            expectedVersion: 1
        })

        expect(write).toHaveBeenCalledWith(
            { metahubId: 'metahub-1', branchSlug: schemaName },
            'modules/metahub/quiz-widget.ts',
            'export default class ConvertedModule {}'
        )
        expect(mockCompileModuleSource).toHaveBeenCalledWith(
            expect.objectContaining({
                diagnosticFileName: 'modules/metahub/quiz-widget.ts',
                sourceCode: 'export default class ConvertedModule {}'
            })
        )
    })

    it('deletes the previous file-backed source file after a successful source path change when it has no active owner', async () => {
        const deleteFile = jest.fn()
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/metahub/quiz-widget-v2.ts'),
            write: jest.fn(),
            delete: deleteFile,
            read: jest.fn(async (_scope, sourcePath: string) => ({
                sourceCode:
                    sourcePath === 'modules/metahub/quiz-widget.ts'
                        ? 'export default class OldModule {}'
                        : 'export default class MovedModule {}',
                checksum: sourcePath === 'modules/metahub/quiz-widget.ts' ? 'old-source-checksum' : 'moved-source-checksum',
                sourcePath,
                absolutePath: `/tmp/${sourcePath}`
            }))
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)
        const existing = createStoredModuleRow({
            storage_mode: 'file',
            source_path: 'modules/metahub/quiz-widget.ts',
            source_code: null,
            source_checksum: 'old-source-checksum'
        })

        ;(executor.query as jest.Mock).mockResolvedValue([{ available: true }])
        mockFindStoredMetahubModuleById.mockResolvedValue(existing)
        mockFindStoredMetahubModuleBySourcePath.mockImplementation(async (_exec, _schema, sourcePath: string) => {
            if (sourcePath === 'modules/metahub/quiz-widget-v2.ts') {
                return existing
            }
            return null
        })
        mockUpdateWithVersionCheck.mockResolvedValue(
            createStoredModuleRow({
                storage_mode: 'file',
                source_path: 'modules/metahub/quiz-widget-v2.ts',
                source_code: null,
                source_checksum: 'moved-source-checksum'
            })
        )

        await fileService.updateModule('metahub-1', 'module-1', {
            storageMode: 'file',
            sourcePath: 'modules/metahub/quiz-widget-v2.ts',
            expectedVersion: 1,
            expectedSourceChecksum: 'old-source-checksum'
        })

        expect(deleteFile).toHaveBeenCalledWith({ metahubId: 'metahub-1', branchSlug: schemaName }, 'modules/metahub/quiz-widget.ts')
    })

    it('keeps file-backed source path updates successful when old source cleanup fails', async () => {
        const deleteFile = jest.fn().mockRejectedValue(new Error('cleanup failed'))
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/metahub/quiz-widget-v2.ts'),
            write: jest.fn(),
            delete: deleteFile,
            read: jest.fn(async (_scope, sourcePath: string) => ({
                sourceCode:
                    sourcePath === 'modules/metahub/quiz-widget.ts'
                        ? 'export default class OldModule {}'
                        : 'export default class MovedModule {}',
                checksum: sourcePath === 'modules/metahub/quiz-widget.ts' ? 'old-source-checksum' : 'moved-source-checksum',
                sourcePath,
                absolutePath: `/tmp/${sourcePath}`
            }))
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)
        const existing = createStoredModuleRow({
            storage_mode: 'file',
            source_path: 'modules/metahub/quiz-widget.ts',
            source_code: null,
            source_checksum: 'old-source-checksum'
        })
        const updated = createStoredModuleRow({
            storage_mode: 'file',
            source_path: 'modules/metahub/quiz-widget-v2.ts',
            source_code: null,
            source_checksum: 'moved-source-checksum'
        })

        ;(executor.query as jest.Mock).mockResolvedValue([{ available: true }])
        mockFindStoredMetahubModuleById.mockResolvedValue(existing)
        mockFindStoredMetahubModuleBySourcePath.mockImplementation(async (_exec, _schema, sourcePath: string) => {
            if (sourcePath === 'modules/metahub/quiz-widget-v2.ts') {
                return existing
            }
            return null
        })
        mockUpdateWithVersionCheck.mockResolvedValue(updated)

        await expect(
            fileService.updateModule('metahub-1', 'module-1', {
                storageMode: 'file',
                sourcePath: 'modules/metahub/quiz-widget-v2.ts',
                expectedVersion: 1,
                expectedSourceChecksum: 'old-source-checksum'
            })
        ).resolves.toMatchObject({
            sourcePath: 'modules/metahub/quiz-widget-v2.ts',
            sourceStatus: 'ready'
        })

        expect(deleteFile).toHaveBeenCalledWith({ metahubId: 'metahub-1', branchSlug: schemaName }, 'modules/metahub/quiz-widget.ts')
    })

    it('restores pre-existing target file content when file-backed update persistence fails', async () => {
        const write = jest.fn()
        const deleteFile = jest.fn()
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/metahub/quiz-widget.ts'),
            write,
            delete: deleteFile,
            read: jest
                .fn()
                .mockResolvedValueOnce({
                    sourceCode: 'export default class ExistingTargetFile {}',
                    checksum: 'target-source-checksum',
                    sourcePath: 'modules/metahub/quiz-widget.ts',
                    absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
                })
                .mockResolvedValueOnce({
                    sourceCode: 'export default class ExistingTargetFile {}',
                    checksum: 'target-source-checksum',
                    sourcePath: 'modules/metahub/quiz-widget.ts',
                    absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
                })
                .mockResolvedValueOnce({
                    sourceCode: 'export default class ExistingTargetFile {}',
                    checksum: 'target-source-checksum',
                    sourcePath: 'modules/metahub/quiz-widget.ts',
                    absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
                })
                .mockResolvedValueOnce({
                    sourceCode: 'export default class ConvertedModule {}',
                    checksum: computeTestChecksum('export default class ConvertedModule {}'),
                    sourcePath: 'modules/metahub/quiz-widget.ts',
                    absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
                })
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)
        const existing = createStoredModuleRow({
            storage_mode: 'inline',
            source_path: null,
            source_code: 'export default class ExistingInlineModule {}',
            source_checksum: null
        })

        ;(executor.query as jest.Mock).mockResolvedValue([{ available: true }])
        mockFindStoredMetahubModuleById.mockResolvedValue(existing)
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(null)
        mockUpdateWithVersionCheck.mockRejectedValue(new Error('database update failed'))

        await expect(
            fileService.updateModule('metahub-1', 'module-1', {
                storageMode: 'file',
                sourcePath: 'modules/metahub/quiz-widget.ts',
                sourceCode: 'export default class ConvertedModule {}',
                expectedVersion: 1,
                expectedSourceChecksum: 'target-source-checksum'
            })
        ).rejects.toThrow('database update failed')

        expect(write).toHaveBeenNthCalledWith(
            1,
            { metahubId: 'metahub-1', branchSlug: schemaName },
            'modules/metahub/quiz-widget.ts',
            'export default class ConvertedModule {}'
        )
        expect(write).toHaveBeenNthCalledWith(
            2,
            { metahubId: 'metahub-1', branchSlug: schemaName },
            'modules/metahub/quiz-widget.ts',
            'export default class ExistingTargetFile {}'
        )
        expect(deleteFile).not.toHaveBeenCalled()
    })

    it('restores pre-existing target file content when the surrounding update transaction commit fails', async () => {
        const previousSource = 'export default class ExistingTargetFile {}'
        const nextSource = 'export default class ConvertedModule {}'
        const write = jest.fn()
        const deleteFile = jest.fn()
        const commitFailingExecutor = {
            query: jest.fn(async () => [{ available: true }]),
            transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
                await callback(commitFailingExecutor)
                throw new Error('transaction commit failed')
            }),
            isReleased: jest.fn(() => false)
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[0]
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/metahub/quiz-widget.ts'),
            write,
            delete: deleteFile,
            read: jest
                .fn()
                .mockResolvedValueOnce({
                    sourceCode: previousSource,
                    checksum: 'target-source-checksum',
                    sourcePath: 'modules/metahub/quiz-widget.ts',
                    absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
                })
                .mockResolvedValueOnce({
                    sourceCode: previousSource,
                    checksum: 'target-source-checksum',
                    sourcePath: 'modules/metahub/quiz-widget.ts',
                    absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
                })
                .mockResolvedValueOnce({
                    sourceCode: previousSource,
                    checksum: 'target-source-checksum',
                    sourcePath: 'modules/metahub/quiz-widget.ts',
                    absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
                })
                .mockResolvedValueOnce({
                    sourceCode: nextSource,
                    checksum: computeTestChecksum(nextSource),
                    sourcePath: 'modules/metahub/quiz-widget.ts',
                    absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
                })
                .mockResolvedValueOnce({
                    sourceCode: nextSource,
                    checksum: computeTestChecksum(nextSource),
                    sourcePath: 'modules/metahub/quiz-widget.ts',
                    absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
                })
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(commitFailingExecutor, schemaService, sourceFileService)
        const existing = createStoredModuleRow({
            storage_mode: 'inline',
            source_path: null,
            source_code: 'export default class ExistingInlineModule {}',
            source_checksum: null
        })

        mockFindStoredMetahubModuleById.mockResolvedValue(existing)
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(null)
        mockUpdateWithVersionCheck.mockResolvedValue(
            createStoredModuleRow({
                storage_mode: 'file',
                source_path: 'modules/metahub/quiz-widget.ts',
                source_checksum: computeTestChecksum(nextSource)
            })
        )

        await expect(
            fileService.updateModule('metahub-1', 'module-1', {
                storageMode: 'file',
                sourcePath: 'modules/metahub/quiz-widget.ts',
                sourceCode: nextSource,
                expectedVersion: 1,
                expectedSourceChecksum: 'target-source-checksum'
            })
        ).rejects.toThrow('transaction commit failed')

        expect(write).toHaveBeenNthCalledWith(
            1,
            { metahubId: 'metahub-1', branchSlug: schemaName },
            'modules/metahub/quiz-widget.ts',
            nextSource
        )
        expect(write).toHaveBeenNthCalledWith(
            2,
            { metahubId: 'metahub-1', branchSlug: schemaName },
            'modules/metahub/quiz-widget.ts',
            previousSource
        )
        expect(deleteFile).not.toHaveBeenCalled()
    })

    it('does not delete a concurrently created source file when create detects a pre-write conflict', async () => {
        const write = jest.fn()
        const deleteFile = jest.fn()
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/metahub/quiz-widget.ts'),
            write,
            delete: deleteFile,
            read: jest
                .fn()
                .mockRejectedValueOnce(Object.assign(new Error('missing during prepare'), { code: 'ENOENT' }))
                .mockRejectedValueOnce(Object.assign(new Error('missing before create'), { code: 'ENOENT' }))
                .mockResolvedValueOnce({
                    sourceCode: 'export default class ConcurrentFile {}',
                    checksum: 'concurrent-source-checksum',
                    sourcePath: 'modules/metahub/quiz-widget.ts',
                    absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
                })
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)

        ;(executor.query as jest.Mock).mockResolvedValue([{ available: true }])
        mockFindStoredMetahubModuleByScope.mockResolvedValue(null)
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(null)
        mockInsertStoredMetahubModule.mockResolvedValue(createStoredModuleRow({ storage_mode: 'file' }))

        await expect(
            fileService.createModule('metahub-1', {
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
                attachedToId: null,
                moduleRole: 'widget',
                storageMode: 'file',
                sourcePath: 'modules/metahub/quiz-widget.ts',
                sourceCode: 'export default class QuizWidgetModule {}'
            })
        ).rejects.toThrow('File-backed module source was created by another writer')

        expect(write).not.toHaveBeenCalled()
        expect(deleteFile).not.toHaveBeenCalled()
    })

    it('rejects existing-file module creates when the source disappears before the locked insert', async () => {
        const missingFileError = Object.assign(new Error('missing source file'), { code: 'ENOENT' })
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/general/shared.ts'),
            write: jest.fn(),
            delete: jest.fn(),
            read: jest
                .fn()
                .mockResolvedValueOnce({
                    sourceCode: 'export default class ExistingSharedModule {}',
                    checksum: 'existing-source-checksum',
                    sourcePath: 'modules/general/shared.ts',
                    absolutePath: '/tmp/modules/general/shared.ts'
                })
                .mockRejectedValueOnce(missingFileError)
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)

        ;(executor.query as jest.Mock).mockResolvedValue([{ available: true }])
        mockFindStoredMetahubModuleByScope.mockResolvedValue(null)
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(null)

        await expect(
            fileService.createModule('metahub-1', {
                codename: 'SharedModule',
                presentation: {
                    name: {
                        _primary: 'en',
                        locales: {
                            en: { content: 'Shared module' }
                        }
                    }
                },
                attachedToKind: 'general',
                attachedToId: null,
                moduleRole: 'library',
                storageMode: 'file',
                sourcePath: 'modules/general/shared.ts'
            })
        ).rejects.toMatchObject({
            message: 'File-backed module source file is missing',
            details: {
                sourcePath: 'modules/general/shared.ts',
                messageCode: 'modules.sourcePath.missing'
            }
        })

        expect(executor.transaction).toHaveBeenCalled()
        expect(mockInsertStoredMetahubModule).not.toHaveBeenCalled()
    })

    it('rejects existing-file module updates when the source changes before the locked update', async () => {
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/metahub/quiz-widget.ts'),
            write: jest.fn(),
            delete: jest.fn(),
            read: jest
                .fn()
                .mockResolvedValueOnce({
                    sourceCode: 'export default class ExistingModule {}',
                    checksum: 'old-source-checksum',
                    sourcePath: 'modules/metahub/quiz-widget.ts',
                    absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
                })
                .mockResolvedValueOnce({
                    sourceCode: 'export default class ConcurrentlyChangedModule {}',
                    checksum: 'concurrent-source-checksum',
                    sourcePath: 'modules/metahub/quiz-widget.ts',
                    absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
                })
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)

        ;(executor.query as jest.Mock).mockResolvedValue([{ available: true }])
        mockFindStoredMetahubModuleById.mockResolvedValue(
            createStoredModuleRow({
                storage_mode: 'file',
                source_path: 'modules/metahub/quiz-widget.ts',
                source_code: null,
                source_checksum: 'old-source-checksum'
            })
        )
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(createStoredModuleRow({ id: 'module-1' }))

        await expect(
            fileService.updateModule('metahub-1', 'module-1', {
                isActive: false,
                expectedVersion: 1,
                expectedSourceChecksum: 'old-source-checksum'
            })
        ).rejects.toMatchObject({
            message: 'File-backed module source was changed by another writer',
            details: {
                sourcePath: 'modules/metahub/quiz-widget.ts',
                expectedSourceChecksum: 'old-source-checksum',
                actualSourceChecksum: 'concurrent-source-checksum',
                messageCode: 'modules.sourcePath.checksumConflict'
            }
        })

        expect(executor.transaction).toHaveBeenCalled()
        expect(mockUpdateWithVersionCheck).not.toHaveBeenCalled()
        expect(mockIncrementVersion).not.toHaveBeenCalled()
    })

    it('rejects stale file-backed updates before writing the source file', async () => {
        const write = jest.fn()
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/metahub/quiz-widget.ts'),
            write,
            delete: jest.fn(),
            read: jest.fn()
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)

        ;(executor.query as jest.Mock).mockResolvedValue([{ available: true }])
        mockFindStoredMetahubModuleById.mockResolvedValue(
            createStoredModuleRow({
                _upl_version: 2,
                storage_mode: 'file',
                source_path: 'modules/metahub/quiz-widget.ts',
                source_code: null,
                source_checksum: 'current-source-checksum'
            })
        )
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(createStoredModuleRow({ id: 'module-1' }))

        await expect(
            fileService.updateModule('metahub-1', 'module-1', {
                storageMode: 'file',
                sourcePath: 'modules/metahub/quiz-widget.ts',
                sourceCode: 'export default class UpdatedModule {}',
                expectedVersion: 1,
                expectedSourceChecksum: 'current-source-checksum'
            })
        ).rejects.toThrow('Optimistic lock conflict')

        expect(write).not.toHaveBeenCalled()
        expect(mockUpdateWithVersionCheck).not.toHaveBeenCalled()
        expect(mockIncrementVersion).not.toHaveBeenCalled()
    })

    it('updates stored file checksums and bundles for metadata-only updates when the client observed the changed file checksum', async () => {
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/metahub/quiz-widget.ts'),
            write: jest.fn(),
            read: jest.fn(async () => ({
                sourceCode: 'export default class ExternallyChangedModule {}',
                checksum: 'new-source-checksum',
                sourcePath: 'modules/metahub/quiz-widget.ts',
                absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
            }))
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)
        const existing = createStoredModuleRow({
            storage_mode: 'file',
            source_path: 'modules/metahub/quiz-widget.ts',
            source_code: null,
            source_checksum: 'old-source-checksum',
            source_last_read_at: '2026-06-01T10:00:00.000Z',
            source_last_compile_at: '2026-06-01T10:01:00.000Z',
            source_last_compile_status: 'success'
        })

        ;(executor.query as jest.Mock).mockResolvedValue([{ available: true }])
        mockFindStoredMetahubModuleById.mockResolvedValue(existing)
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(existing)

        await fileService.updateModule('metahub-1', 'module-1', {
            presentation: {
                name: {
                    _primary: 'en',
                    locales: {
                        en: { content: 'Renamed quiz widget' }
                    }
                }
            },
            expectedVersion: 1,
            expectedSourceChecksum: 'new-source-checksum'
        })

        expect(mockCompileModuleSource).toHaveBeenCalledWith(
            expect.objectContaining({
                diagnosticFileName: 'modules/metahub/quiz-widget.ts',
                sourceCode: 'export default class ExternallyChangedModule {}'
            })
        )
        expect(mockUpdateWithVersionCheck).toHaveBeenCalledWith(
            expect.objectContaining({
                schemaName,
                entityId: 'module-1',
                entityType: 'module',
                expectedVersion: 1,
                updateData: expect.objectContaining({
                    source_checksum: 'new-source-checksum',
                    source_last_compile_status: 'success'
                })
            })
        )
    })

    it('rejects metadata-only file-backed saves when the external file changed after the client loaded it', async () => {
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/metahub/quiz-widget.ts'),
            write: jest.fn(),
            read: jest.fn(async () => ({
                sourceCode: 'export default class ExternallyChangedModule {}',
                checksum: 'new-source-checksum',
                sourcePath: 'modules/metahub/quiz-widget.ts',
                absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
            }))
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)

        ;(executor.query as jest.Mock).mockResolvedValue([{ available: true }])
        mockFindStoredMetahubModuleById.mockResolvedValue(
            createStoredModuleRow({
                storage_mode: 'file',
                source_path: 'modules/metahub/quiz-widget.ts',
                source_code: null,
                source_checksum: 'old-source-checksum'
            })
        )
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(createStoredModuleRow({ id: 'module-1' }))

        await expect(
            fileService.updateModule('metahub-1', 'module-1', {
                presentation: {
                    name: {
                        _primary: 'en',
                        locales: {
                            en: { content: 'Renamed quiz widget' }
                        }
                    }
                },
                expectedVersion: 1,
                expectedSourceChecksum: 'old-source-checksum'
            })
        ).rejects.toMatchObject({
            message: 'File-backed module source was changed by another writer',
            details: {
                sourcePath: 'modules/metahub/quiz-widget.ts',
                expectedSourceChecksum: 'old-source-checksum',
                actualSourceChecksum: 'new-source-checksum',
                messageCode: 'modules.sourcePath.checksumConflict'
            }
        })

        expect(mockCompileModuleSource).not.toHaveBeenCalled()
        expect(mockUpdateWithVersionCheck).not.toHaveBeenCalled()
        expect(mockIncrementVersion).not.toHaveBeenCalled()
    })

    it('converts file-backed modules to inline from the current file when the expected checksum matches', async () => {
        const deleteFile = jest.fn()
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/metahub/quiz-widget.ts'),
            write: jest.fn(),
            delete: deleteFile,
            read: jest.fn().mockResolvedValue({
                sourceCode: 'export default class CurrentFileModule {}',
                checksum: 'current-source-checksum',
                sourcePath: 'modules/metahub/quiz-widget.ts',
                absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
            })
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)

        ;(executor.query as jest.Mock).mockResolvedValue([{ available: true }])
        mockFindStoredMetahubModuleById.mockResolvedValue(
            createStoredModuleRow({
                storage_mode: 'file',
                source_path: 'modules/metahub/quiz-widget.ts',
                source_code: null,
                source_checksum: 'current-source-checksum'
            })
        )
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(null)
        mockUpdateWithVersionCheck.mockResolvedValue(
            createStoredModuleRow({
                storage_mode: 'inline',
                source_path: null,
                source_code: 'export default class CurrentFileModule {}',
                source_checksum: 'current-source-checksum'
            })
        )

        await fileService.updateModule('metahub-1', 'module-1', {
            storageMode: 'inline',
            sourceCode: 'export default class StalePayloadModule {}',
            expectedVersion: 1,
            expectedSourceChecksum: 'current-source-checksum'
        })

        expect(mockCompileModuleSource).toHaveBeenCalledWith(
            expect.objectContaining({
                sourceCode: 'export default class CurrentFileModule {}'
            })
        )
        expect(mockUpdateWithVersionCheck).toHaveBeenCalledWith(
            expect.objectContaining({
                updateData: expect.objectContaining({
                    storage_mode: 'inline',
                    source_path: null,
                    source_code: 'export default class CurrentFileModule {}'
                })
            })
        )
        expect(deleteFile).toHaveBeenCalledWith({ metahubId: 'metahub-1', branchSlug: schemaName }, 'modules/metahub/quiz-widget.ts')
    })

    it('cleans up file-backed sources after inline conversion using the current file checksum when the stored checksum is stale', async () => {
        const deleteFile = jest.fn()
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/metahub/quiz-widget.ts'),
            write: jest.fn(),
            delete: deleteFile,
            read: jest.fn().mockResolvedValue({
                sourceCode: 'export default class CurrentFileModule {}',
                checksum: 'current-source-checksum',
                sourcePath: 'modules/metahub/quiz-widget.ts',
                absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
            })
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)

        ;(executor.query as jest.Mock).mockResolvedValue([{ available: true }])
        mockFindStoredMetahubModuleById.mockResolvedValue(
            createStoredModuleRow({
                storage_mode: 'file',
                source_path: 'modules/metahub/quiz-widget.ts',
                source_code: null,
                source_checksum: 'stale-db-source-checksum'
            })
        )
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(null)
        mockUpdateWithVersionCheck.mockResolvedValue(
            createStoredModuleRow({
                storage_mode: 'inline',
                source_path: null,
                source_code: 'export default class CurrentFileModule {}',
                source_checksum: 'current-source-checksum'
            })
        )

        await fileService.updateModule('metahub-1', 'module-1', {
            storageMode: 'inline',
            expectedVersion: 1,
            expectedSourceChecksum: 'current-source-checksum'
        })

        expect(deleteFile).toHaveBeenCalledWith({ metahubId: 'metahub-1', branchSlug: schemaName }, 'modules/metahub/quiz-widget.ts')
    })

    it('rejects file-backed to inline conversion when the external file changed after the client loaded it', async () => {
        const deleteFile = jest.fn()
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(() => 'modules/metahub/quiz-widget.ts'),
            write: jest.fn(),
            delete: deleteFile,
            read: jest.fn().mockResolvedValue({
                sourceCode: 'export default class ExternallyChangedModule {}',
                checksum: 'new-source-checksum',
                sourcePath: 'modules/metahub/quiz-widget.ts',
                absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
            })
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)

        ;(executor.query as jest.Mock).mockResolvedValue([{ available: true }])
        mockFindStoredMetahubModuleById.mockResolvedValue(
            createStoredModuleRow({
                storage_mode: 'file',
                source_path: 'modules/metahub/quiz-widget.ts',
                source_code: null,
                source_checksum: 'old-source-checksum'
            })
        )
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(null)

        await expect(
            fileService.updateModule('metahub-1', 'module-1', {
                storageMode: 'inline',
                sourceCode: 'export default class InlineModule {}',
                expectedVersion: 1,
                expectedSourceChecksum: 'old-source-checksum'
            })
        ).rejects.toMatchObject({
            message: 'File-backed module source was changed by another writer',
            details: {
                sourcePath: 'modules/metahub/quiz-widget.ts',
                expectedSourceChecksum: 'old-source-checksum',
                actualSourceChecksum: 'new-source-checksum',
                messageCode: 'modules.sourcePath.checksumConflict'
            }
        })

        expect(mockUpdateWithVersionCheck).not.toHaveBeenCalled()
        expect(mockCompileModuleSource).not.toHaveBeenCalled()
        expect(deleteFile).not.toHaveBeenCalled()
    })

    it('uses version-checked updates when the client provides an expected module version', async () => {
        await service.updateModule(
            'metahub-1',
            'module-1',
            {
                presentation: {
                    name: {
                        _primary: 'en',
                        locales: {
                            en: { content: 'Renamed quiz widget' }
                        }
                    }
                },
                expectedVersion: 1
            },
            'user-2'
        )

        expect(mockUpdateWithVersionCheck).toHaveBeenCalledWith(
            expect.objectContaining({
                schemaName,
                tableName: expect.any(String),
                entityId: 'module-1',
                entityType: 'module',
                expectedVersion: 1,
                wrapInTransaction: false,
                updateData: expect.objectContaining({
                    _upl_updated_by: 'user-2'
                })
            })
        )
        expect(mockIncrementVersion).not.toHaveBeenCalled()
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

    it('uses version-checked soft deletes when the client provides an expected module version', async () => {
        mockFindStoredMetahubModuleById.mockResolvedValue(createStoredModuleRow({ _upl_version: 1 }))

        await service.deleteModule('metahub-1', 'module-1', 'user-3', { expectedVersion: 1 })

        expect(mockUpdateWithVersionCheck).toHaveBeenCalledWith(
            expect.objectContaining({
                schemaName,
                tableName: expect.any(String),
                entityId: 'module-1',
                entityType: 'module',
                expectedVersion: 1,
                wrapInTransaction: false,
                updateData: expect.objectContaining({
                    _mhb_deleted: true,
                    _mhb_deleted_by: 'user-3',
                    _upl_updated_by: 'user-3'
                })
            })
        )
        expect(mockIncrementVersion).not.toHaveBeenCalled()
    })

    it('rejects stale deletes before removing file-backed source files', async () => {
        const deleteFile = jest.fn()
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(),
            read: jest.fn(),
            write: jest.fn(),
            delete: deleteFile
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)
        mockFindStoredMetahubModuleById.mockResolvedValue(
            createStoredModuleRow({
                _upl_version: 2,
                storage_mode: 'file',
                source_path: 'modules/metahub/quiz-widget.ts',
                source_checksum: 'old-source-checksum',
                source_code: null
            })
        )

        await expect(
            fileService.deleteModule('metahub-1', 'module-1', 'user-3', {
                expectedVersion: 1,
                expectedSourceChecksum: 'old-source-checksum'
            })
        ).rejects.toThrow('Optimistic lock conflict')

        expect(mockUpdateWithVersionCheck).not.toHaveBeenCalled()
        expect(mockIncrementVersion).not.toHaveBeenCalled()
        expect(deleteFile).not.toHaveBeenCalled()
    })

    it('rejects file-backed deletes when the live source file changed before metadata deletion', async () => {
        const deleteFile = jest.fn()
        const readFile = jest.fn().mockResolvedValue({
            sourceCode: 'export default class ChangedModule {}',
            checksum: 'new-source-checksum',
            sourcePath: 'modules/metahub/quiz-widget.ts',
            absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
        })
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(),
            read: readFile,
            write: jest.fn(),
            delete: deleteFile
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)
        mockFindStoredMetahubModuleById.mockResolvedValue(
            createStoredModuleRow({
                storage_mode: 'file',
                source_path: 'modules/metahub/quiz-widget.ts',
                source_checksum: 'old-source-checksum',
                source_code: null
            })
        )

        await expect(
            fileService.deleteModule('metahub-1', 'module-1', 'user-3', {
                expectedVersion: 1,
                expectedSourceChecksum: 'old-source-checksum'
            })
        ).rejects.toMatchObject({
            message: 'File-backed module source was changed by another writer',
            details: {
                sourcePath: 'modules/metahub/quiz-widget.ts',
                expectedSourceChecksum: 'old-source-checksum',
                actualSourceChecksum: 'new-source-checksum',
                messageCode: 'modules.sourcePath.checksumConflict'
            }
        })

        expect(readFile).toHaveBeenCalledWith({ metahubId: 'metahub-1', branchSlug: schemaName }, 'modules/metahub/quiz-widget.ts')
        expect(mockUpdateWithVersionCheck).not.toHaveBeenCalled()
        expect(mockIncrementVersion).not.toHaveBeenCalled()
        expect(deleteFile).not.toHaveBeenCalled()
    })

    it('requires optimistic guards before deleting file-backed modules', async () => {
        const deleteFile = jest.fn()
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(),
            read: jest.fn(),
            write: jest.fn(),
            delete: deleteFile
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)
        mockFindStoredMetahubModuleById.mockResolvedValue(
            createStoredModuleRow({
                storage_mode: 'file',
                source_path: 'modules/metahub/quiz-widget.ts',
                source_checksum: 'old-source-checksum',
                source_code: null
            })
        )

        await expect(fileService.deleteModule('metahub-1', 'module-1', 'user-3')).rejects.toThrow(
            'File-backed module deletes require an expected module version'
        )

        await expect(fileService.deleteModule('metahub-1', 'module-1', 'user-3', { expectedVersion: 1 })).rejects.toThrow(
            'File-backed module deletes require an expected source checksum'
        )

        expect(mockUpdateWithVersionCheck).not.toHaveBeenCalled()
        expect(mockIncrementVersion).not.toHaveBeenCalled()
        expect(deleteFile).not.toHaveBeenCalled()
    })

    it('deletes an unowned file-backed source file after module soft delete', async () => {
        const deleteFile = jest.fn()
        const readFile = jest.fn().mockResolvedValue({ checksum: 'old-source-checksum' })
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(),
            read: readFile,
            write: jest.fn(),
            delete: deleteFile
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)
        mockFindStoredMetahubModuleById.mockResolvedValue(
            createStoredModuleRow({
                storage_mode: 'file',
                source_path: 'modules/metahub/quiz-widget.ts',
                source_checksum: 'old-source-checksum',
                source_code: null
            })
        )
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(null)

        await fileService.deleteModule('metahub-1', 'module-1', 'user-3', {
            expectedVersion: 1,
            expectedSourceChecksum: 'old-source-checksum'
        })

        expect(mockUpdateWithVersionCheck).toHaveBeenCalled()
        expect(readFile).toHaveBeenCalledWith({ metahubId: 'metahub-1', branchSlug: schemaName }, 'modules/metahub/quiz-widget.ts')
        expect(deleteFile).toHaveBeenCalledWith({ metahubId: 'metahub-1', branchSlug: schemaName }, 'modules/metahub/quiz-widget.ts')
    })

    it('rejects physical file cleanup when file-backed source changed outside the platform before delete metadata mutation', async () => {
        const deleteFile = jest.fn()
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(),
            read: jest.fn().mockResolvedValue({
                sourceCode: 'export default class ChangedModule {}',
                checksum: 'new-source-checksum',
                sourcePath: 'modules/metahub/quiz-widget.ts',
                absolutePath: '/tmp/modules/metahub/quiz-widget.ts'
            }),
            write: jest.fn(),
            delete: deleteFile
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)
        mockFindStoredMetahubModuleById.mockResolvedValue(
            createStoredModuleRow({
                storage_mode: 'file',
                source_path: 'modules/metahub/quiz-widget.ts',
                source_checksum: 'old-source-checksum',
                source_code: null
            })
        )
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(null)

        await expect(
            fileService.deleteModule('metahub-1', 'module-1', 'user-3', {
                expectedVersion: 1,
                expectedSourceChecksum: 'old-source-checksum'
            })
        ).rejects.toMatchObject({
            message: 'File-backed module source was changed by another writer',
            details: {
                sourcePath: 'modules/metahub/quiz-widget.ts',
                expectedSourceChecksum: 'old-source-checksum',
                actualSourceChecksum: 'new-source-checksum',
                messageCode: 'modules.sourcePath.checksumConflict'
            }
        })

        expect(mockUpdateWithVersionCheck).not.toHaveBeenCalled()
        expect(mockIncrementVersion).not.toHaveBeenCalled()
        expect(deleteFile).not.toHaveBeenCalled()
    })

    it('keeps module soft delete successful when post-delete file cleanup fails', async () => {
        const deleteFile = jest.fn().mockRejectedValue(new Error('cleanup failed'))
        const sourceFileService = {
            buildDefaultSourcePath: jest.fn(),
            read: jest.fn().mockResolvedValue({ checksum: 'old-source-checksum' }),
            write: jest.fn(),
            delete: deleteFile
        } as unknown as ConstructorParameters<typeof MetahubModulesService>[2]
        const fileService = new MetahubModulesService(executor, schemaService, sourceFileService)
        mockFindStoredMetahubModuleById.mockResolvedValue(
            createStoredModuleRow({
                storage_mode: 'file',
                source_path: 'modules/metahub/quiz-widget.ts',
                source_checksum: 'old-source-checksum',
                source_code: null
            })
        )
        mockFindStoredMetahubModuleBySourcePath.mockResolvedValue(null)

        await expect(
            fileService.deleteModule('metahub-1', 'module-1', 'user-3', {
                expectedVersion: 1,
                expectedSourceChecksum: 'old-source-checksum'
            })
        ).resolves.toBeUndefined()

        expect(mockUpdateWithVersionCheck).toHaveBeenCalled()
        expect(deleteFile).toHaveBeenCalledWith({ metahubId: 'metahub-1', branchSlug: schemaName }, 'modules/metahub/quiz-widget.ts')
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
        expect(result.map((module) => module.id)).toEqual(['shared-core', 'shared-helpers', 'plain-module', 'module-consumer'])
        expect(result.find((module) => module.id === 'shared-core')).toEqual(
            expect.objectContaining({
                sourceCode: 'export default class SharedCore {}',
                serverBundle: null,
                clientBundle: null,
                checksum: 'checksum:shared-core'
            })
        )
        expect(result.find((module) => module.id === 'shared-helpers')).toEqual(
            expect.objectContaining({
                sourceCode: "import SharedCore from '@shared/shared-core'\nexport default class SharedHelpers {}",
                serverBundle: null,
                clientBundle: null,
                checksum: 'checksum:shared-helpers'
            })
        )
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

    it('excludes authoring-only packages from module package import allowlists', async () => {
        mockListMetahubPackages.mockResolvedValue([
            {
                packageName: '@universo-react/playcanvas-engine',
                version: '0.1.0',
                source: {
                    runtimeTargets: ['client']
                }
            },
            {
                packageName: editorPackageName,
                version: '0.1.0',
                source: {
                    runtimeTargets: []
                }
            }
        ])
        mockListStoredMetahubModules.mockResolvedValue([
            createStoredModuleRow({
                id: 'module-with-package-import',
                codename: {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'module-with-package-import' }
                    }
                }
            })
        ])

        await service.listPublishedModules('metahub-1')

        expect(mockCompileModuleSource).toHaveBeenCalledWith(
            expect.objectContaining({
                allowedPackageImports: [
                    {
                        packageName: '@universo-react/playcanvas-engine',
                        version: '0.1.0',
                        targets: ['client']
                    }
                ]
            })
        )
    })
})
