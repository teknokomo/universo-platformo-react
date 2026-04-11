import type { ApplicationLifecycleContract, ApplicationScriptDefinition } from '@universo/types'
import { RuntimeScriptsService } from '../../services/runtimeScriptsService'
import { createMockDbExecutor } from '../utils/dbMocks'

const defaultLifecycleContract: ApplicationLifecycleContract = {
    publish: { enabled: true, trackAt: true, trackBy: true },
    archive: { enabled: true, trackAt: true, trackBy: true },
    delete: { mode: 'soft', trackAt: true, trackBy: true }
}

const createRecordBinding = (overrides: Record<string, unknown> = {}) => ({
    object: {
        id: 'catalog-1',
        kind: 'catalog',
        codename: 'orders',
        table_name: 'orders',
        config: {},
        lifecycleContract: defaultLifecycleContract,
        hasWorkspaceColumn: false,
        ...((overrides.object as Record<string, unknown> | undefined) ?? {})
    },
    attrs: [
        {
            id: 'attr-1',
            codename: 'name',
            column_name: 'name',
            data_type: 'STRING',
            is_required: false
        },
        {
            id: 'attr-2',
            codename: 'codename',
            column_name: 'codename',
            data_type: 'STRING',
            is_required: false
        }
    ],
    tableIdent: '"app_runtime_test"."orders"',
    activeRowCondition: '_upl_deleted = false AND _app_deleted = false',
    ...overrides
})

const createScriptDefinition = (overrides: Partial<ApplicationScriptDefinition> = {}): ApplicationScriptDefinition => ({
    id: overrides.id ?? 'script-1',
    codename: overrides.codename ?? 'quiz-widget',
    presentation: overrides.presentation ?? {
        name: {
            _primary: 'en',
            locales: {
                en: { content: 'Quiz widget' }
            }
        }
    },
    attachedToKind: overrides.attachedToKind ?? 'catalog',
    attachedToId: overrides.attachedToId ?? 'catalog-1',
    moduleRole: overrides.moduleRole ?? 'widget',
    sourceKind: overrides.sourceKind ?? 'embedded',
    sdkApiVersion: overrides.sdkApiVersion ?? '1.0.0',
    manifest: overrides.manifest ?? {
        className: 'QuizWidgetScript',
        sdkApiVersion: '1.0.0',
        moduleRole: 'widget',
        sourceKind: 'embedded',
        capabilities: ['metadata.read', 'rpc.client'],
        methods: [{ name: 'mount', target: 'client' }],
        checksum: 'manifest-checksum'
    },
    serverBundle: overrides.serverBundle ?? 'module.exports = class ServerWidget {}',
    clientBundle: overrides.clientBundle ?? 'module.exports = class ClientWidget {}',
    checksum: overrides.checksum ?? 'bundle-checksum',
    isActive: overrides.isActive ?? true,
    config: overrides.config ?? {}
})

type RuntimeExecutionContext = {
    records: {
        list: (entityCodename: string, filters?: Record<string, unknown>) => Promise<unknown>
    }
    metadata: {
        getAttachedEntity: () => Promise<unknown>
    }
    callServerMethod: (methodName: string, args: unknown[]) => Promise<unknown>
}

describe('RuntimeScriptsService', () => {
    const engine = {
        callMethod: jest.fn(),
        dispatchEvent: jest.fn().mockResolvedValue([])
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('strips server and client bundles from listed runtime scripts', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeScriptsService(engine as never)

        executor.query.mockResolvedValueOnce([{ table_name: 'app_runtime_test._app_scripts' }]).mockResolvedValueOnce([
            {
                id: 'script-1',
                codename: 'quiz-widget',
                presentation: {
                    name: {
                        _primary: 'en',
                        locales: { en: { content: 'Quiz widget' } }
                    }
                },
                attached_to_kind: 'catalog',
                attached_to_id: 'catalog-1',
                module_role: 'widget',
                source_kind: 'embedded',
                sdk_api_version: '1.0.0',
                manifest: {
                    className: 'QuizWidgetScript',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'widget',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read', 'rpc.client'],
                    methods: [{ name: 'mount', target: 'client' }]
                },
                server_bundle: 'module.exports = class ServerWidget {}',
                client_bundle: 'module.exports = class ClientWidget {}',
                checksum: 'bundle-checksum',
                is_active: true,
                config: {}
            }
        ])

        const items = await service.listClientScripts({
            executor: executor as never,
            schemaName: 'app_runtime_test',
            attachedToKind: 'catalog',
            attachedToId: 'catalog-1'
        })

        expect(items).toHaveLength(1)
        expect(items[0]).toMatchObject({
            id: 'script-1',
            clientBundle: null,
            serverBundle: null
        })
    })

    it('keeps shared client/server methods visible on the runtime client list surface', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeScriptsService(engine as never)

        executor.query.mockResolvedValueOnce([{ table_name: 'app_runtime_test._app_scripts' }]).mockResolvedValueOnce([
            {
                id: 'script-1',
                codename: 'quiz-widget',
                presentation: {
                    name: {
                        _primary: 'en',
                        locales: { en: { content: 'Quiz widget' } }
                    }
                },
                attached_to_kind: 'catalog',
                attached_to_id: 'catalog-1',
                module_role: 'widget',
                source_kind: 'embedded',
                sdk_api_version: '1.0.0',
                manifest: {
                    className: 'QuizWidgetScript',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'widget',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read', 'rpc.client'],
                    methods: [{ name: 'mount', target: 'server_and_client' }]
                },
                server_bundle: 'module.exports = class SharedWidget {}',
                client_bundle: 'module.exports = class SharedWidget {}',
                checksum: 'bundle-checksum',
                is_active: true,
                config: {}
            }
        ])

        const items = await service.listClientScripts({
            executor: executor as never,
            schemaName: 'app_runtime_test',
            attachedToKind: 'catalog',
            attachedToId: 'catalog-1'
        })

        expect(items).toHaveLength(1)
        expect(items[0]?.manifest.methods).toEqual([{ name: 'mount', target: 'server_and_client' }])
    })

    it('keeps the execution context fail-closed when a capability is not declared', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeScriptsService(engine as never)
        const context = (
            service as never as {
                createExecutionContext: (params: Record<string, unknown>) => RuntimeExecutionContext
            }
        ).createExecutionContext({
            executor,
            applicationId: 'application-1',
            schemaName: 'app_runtime_test',
            script: createScriptDefinition({
                manifest: {
                    className: 'QuizWidgetScript',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'widget',
                    sourceKind: 'embedded',
                    capabilities: [],
                    methods: [{ name: 'mount', target: 'client' }]
                }
            }),
            currentWorkspaceId: null,
            currentUserId: 'user-1',
            permissions: null
        })

        await expect(context.records.list('orders')).rejects.toThrow('Script capability "records.read" is not enabled for this module')
        await expect(context.metadata.getAttachedEntity()).rejects.toThrow(
            'Script capability "metadata.read" is not enabled for this module'
        )
        await expect(context.callServerMethod('submit', [])).rejects.toThrow(
            'Script capability "rpc.client" is not enabled for this module'
        )
    })

    it('rejects public RPC calls when the script does not declare rpc.client', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeScriptsService(engine as never)
        const getActiveScriptByIdSpy = jest.spyOn(
            service as never as { getActiveScriptById: () => Promise<ApplicationScriptDefinition | null> },
            'getActiveScriptById'
        )

        getActiveScriptByIdSpy.mockResolvedValueOnce(
            createScriptDefinition({
                manifest: {
                    className: 'ServerOnlyScript',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'module',
                    sourceKind: 'embedded',
                    capabilities: [],
                    methods: [{ name: 'submit', target: 'server' }]
                }
            })
        )

        await expect(
            service.callServerMethod({
                executor: executor as never,
                applicationId: 'application-1',
                schemaName: 'app_runtime_test',
                scriptId: 'script-1',
                currentWorkspaceId: null,
                currentUserId: 'user-1',
                permissions: null,
                request: {
                    methodName: 'submit',
                    args: []
                }
            })
        ).rejects.toThrow('Script capability "rpc.client" is not enabled for this module')

        expect(engine.callMethod).not.toHaveBeenCalled()
    })

    it('rejects lifecycle handlers on the public RPC surface', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeScriptsService(engine as never)
        const getActiveScriptByIdSpy = jest.spyOn(
            service as never as { getActiveScriptById: () => Promise<ApplicationScriptDefinition | null> },
            'getActiveScriptById'
        )

        getActiveScriptByIdSpy.mockResolvedValueOnce(
            createScriptDefinition({
                moduleRole: 'lifecycle',
                manifest: {
                    className: 'LifecycleScript',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'lifecycle',
                    sourceKind: 'embedded',
                    capabilities: ['lifecycle'],
                    methods: [{ name: 'afterCreate', target: 'server', eventName: 'afterCreate' }]
                }
            })
        )

        await expect(
            service.callServerMethod({
                executor: executor as never,
                applicationId: 'application-1',
                schemaName: 'app_runtime_test',
                scriptId: 'script-1',
                currentWorkspaceId: null,
                currentUserId: 'user-1',
                permissions: null,
                request: {
                    methodName: 'afterCreate',
                    args: []
                }
            })
        ).rejects.toThrow('Runtime script lifecycle handlers are not callable through public RPC')

        expect(engine.callMethod).not.toHaveBeenCalled()
    })

    it('allows shared client/server methods on the public RPC surface when rpc.client is declared', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeScriptsService(engine as never)
        const getActiveScriptByIdSpy = jest.spyOn(
            service as never as { getActiveScriptById: () => Promise<ApplicationScriptDefinition | null> },
            'getActiveScriptById'
        )

        getActiveScriptByIdSpy.mockResolvedValueOnce(
            createScriptDefinition({
                manifest: {
                    className: 'SharedScript',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'widget',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read', 'rpc.client'],
                    methods: [{ name: 'submit', target: 'server_and_client' }]
                }
            })
        )
        engine.callMethod.mockResolvedValueOnce({ ok: true })

        await expect(
            service.callServerMethod({
                executor: executor as never,
                applicationId: 'application-1',
                schemaName: 'app_runtime_test',
                scriptId: 'script-1',
                currentWorkspaceId: null,
                currentUserId: 'user-1',
                permissions: null,
                request: {
                    methodName: 'submit',
                    args: ['payload']
                }
            })
        ).resolves.toEqual({ ok: true })

        expect(engine.callMethod).toHaveBeenCalledWith(
            expect.objectContaining({
                bundle: 'module.exports = class ServerWidget {}',
                methodName: 'submit',
                args: ['payload'],
                context: expect.objectContaining({
                    applicationId: 'application-1',
                    scriptId: 'script-1',
                    scriptCodename: 'quiz-widget'
                })
            })
        )
    })

    it('rejects runtime scripts with unsupported sdkApiVersion metadata', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeScriptsService(engine as never)

        executor.query.mockResolvedValueOnce([{ table_name: 'app_runtime_test._app_scripts' }]).mockResolvedValueOnce([
            {
                id: 'script-1',
                codename: 'quiz-widget',
                presentation: {
                    name: {
                        _primary: 'en',
                        locales: { en: { content: 'Quiz widget' } }
                    }
                },
                attached_to_kind: 'catalog',
                attached_to_id: 'catalog-1',
                module_role: 'widget',
                source_kind: 'embedded',
                sdk_api_version: '2.0.0',
                manifest: {
                    className: 'QuizWidgetScript',
                    sdkApiVersion: '2.0.0',
                    moduleRole: 'widget',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read', 'rpc.client'],
                    methods: [{ name: 'submit', target: 'server' }]
                },
                server_bundle: 'module.exports = class ServerWidget {}',
                client_bundle: 'module.exports = class ClientWidget {}',
                checksum: 'bundle-checksum',
                is_active: true,
                config: {}
            }
        ])

        await expect(
            service.callServerMethod({
                executor: executor as never,
                applicationId: 'application-1',
                schemaName: 'app_runtime_test',
                scriptId: 'script-1',
                currentWorkspaceId: null,
                currentUserId: 'user-1',
                permissions: null,
                request: {
                    methodName: 'submit',
                    args: []
                }
            })
        ).rejects.toThrow('Unsupported script sdkApiVersion "2.0.0". Supported versions: 1.0.0')

        expect(engine.callMethod).not.toHaveBeenCalled()
    })

    it('dispatches lifecycle handlers only for scripts that declare the lifecycle capability', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeScriptsService(engine as never)
        const listActiveScriptsSpy = jest.spyOn(
            service as never as { listActiveScripts: () => Promise<ApplicationScriptDefinition[]> },
            'listActiveScripts'
        )

        listActiveScriptsSpy.mockResolvedValueOnce([
            createScriptDefinition({
                moduleRole: 'lifecycle',
                attachedToKind: 'catalog',
                attachedToId: 'catalog-1',
                manifest: {
                    className: 'LifecycleScript',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'lifecycle',
                    sourceKind: 'embedded',
                    capabilities: ['lifecycle'],
                    methods: [{ name: 'afterCreate', target: 'server', eventName: 'afterCreate' }]
                }
            }),
            createScriptDefinition({
                id: 'script-2',
                moduleRole: 'lifecycle',
                attachedToKind: 'catalog',
                attachedToId: 'catalog-1',
                manifest: {
                    className: 'LifecycleScriptWithoutCapability',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'lifecycle',
                    sourceKind: 'embedded',
                    capabilities: [],
                    methods: [{ name: 'afterCreate', target: 'server', eventName: 'afterCreate' }]
                }
            })
        ])

        await service.dispatchLifecycleEvent({
            executor: executor as never,
            applicationId: 'application-1',
            schemaName: 'app_runtime_test',
            attachmentKind: 'catalog',
            attachmentId: 'catalog-1',
            entityCodename: 'orders',
            currentWorkspaceId: null,
            currentUserId: 'user-1',
            permissions: null,
            payload: {
                eventName: 'afterCreate',
                row: { id: 'row-1' }
            }
        })

        expect(engine.dispatchEvent).toHaveBeenCalledTimes(1)
        expect(engine.dispatchEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                bundle: 'module.exports = class ServerWidget {}',
                eventName: 'afterCreate',
                payload: expect.objectContaining({ entityCodename: 'orders' })
            })
        )
    })

    it('runs Record API create hooks transactionally and dispatches afterCreate after commit', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const service = new RuntimeScriptsService(engine as never)
        const binding = createRecordBinding()
        const createdRow = { id: 'row-1', name: 'Order A' }

        jest.spyOn(service as never as { resolveRecordBinding: () => Promise<unknown> }, 'resolveRecordBinding').mockResolvedValue(binding)
        jest.spyOn(
            service as never as { buildWritableColumnValues: () => Promise<unknown> },
            'buildWritableColumnValues'
        ).mockResolvedValue([{ column: 'name', value: 'Order A' }])
        jest.spyOn(service as never as { getRecordById: () => Promise<unknown> }, 'getRecordById').mockResolvedValue(createdRow)
        const dispatchLifecycleEventSpy = jest.spyOn(service, 'dispatchLifecycleEvent').mockResolvedValue()

        txExecutor.query.mockResolvedValueOnce([{ id: 'row-1' }])

        const result = await (
            service as never as {
                createRecord: (params: Record<string, unknown>) => Promise<Record<string, unknown>>
            }
        ).createRecord({
            executor,
            applicationId: 'application-1',
            schemaName: 'app_runtime_test',
            currentWorkspaceId: null,
            currentUserId: 'user-1',
            permissions: { createContent: true },
            entityCodename: 'orders',
            data: { name: 'Order A' }
        })

        expect(result).toEqual(createdRow)
        expect(dispatchLifecycleEventSpy).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                executor: txExecutor,
                payload: expect.objectContaining({ eventName: 'beforeCreate' })
            })
        )
        expect(dispatchLifecycleEventSpy).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                executor,
                payload: expect.objectContaining({
                    eventName: 'afterCreate',
                    row: createdRow
                })
            })
        )
    })

    it('preserves custom attachment kinds for runtime lifecycle dispatch', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const service = new RuntimeScriptsService(engine as never)
        const binding = createRecordBinding({
            object: {
                kind: 'document'
            }
        })
        const createdRow = { id: 'row-1', name: 'Document A' }

        jest.spyOn(service as never as { resolveRecordBinding: () => Promise<unknown> }, 'resolveRecordBinding').mockResolvedValue(binding)
        jest.spyOn(
            service as never as { buildWritableColumnValues: () => Promise<unknown> },
            'buildWritableColumnValues'
        ).mockResolvedValue([{ column: 'name', value: 'Document A' }])
        jest.spyOn(service as never as { getRecordById: () => Promise<unknown> }, 'getRecordById').mockResolvedValue(createdRow)
        const dispatchLifecycleEventSpy = jest.spyOn(service, 'dispatchLifecycleEvent').mockResolvedValue()

        txExecutor.query.mockResolvedValueOnce([{ id: 'row-1' }])

        await (
            service as never as {
                createRecord: (params: Record<string, unknown>) => Promise<Record<string, unknown>>
            }
        ).createRecord({
            executor,
            applicationId: 'application-1',
            schemaName: 'app_runtime_test',
            currentWorkspaceId: null,
            currentUserId: 'user-1',
            permissions: { createContent: true },
            entityCodename: 'documents',
            data: { name: 'Document A' }
        })

        expect(dispatchLifecycleEventSpy).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                attachmentKind: 'document',
                executor: txExecutor,
                payload: expect.objectContaining({ eventName: 'beforeCreate' })
            })
        )
        expect(dispatchLifecycleEventSpy).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                attachmentKind: 'document',
                executor,
                payload: expect.objectContaining({ eventName: 'afterCreate' })
            })
        )
    })

    it('runs Record API hard deletes with beforeDelete and afterDelete lifecycle parity', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const service = new RuntimeScriptsService(engine as never)
        const binding = createRecordBinding({
            object: {
                lifecycleContract: {
                    ...defaultLifecycleContract,
                    delete: { mode: 'hard', trackAt: true, trackBy: true }
                }
            }
        })
        const previousRow = { id: 'row-1', name: 'Order A' }

        jest.spyOn(service as never as { resolveRecordBinding: () => Promise<unknown> }, 'resolveRecordBinding').mockResolvedValue(binding)
        jest.spyOn(service as never as { getRecordById: () => Promise<unknown> }, 'getRecordById').mockResolvedValue(previousRow)
        const dispatchLifecycleEventSpy = jest.spyOn(service, 'dispatchLifecycleEvent').mockResolvedValue()

        txExecutor.query.mockResolvedValueOnce([{ id: 'row-1', _upl_locked: false }]).mockResolvedValueOnce([{ id: 'row-1' }])

        await (
            service as never as {
                deleteRecord: (params: Record<string, unknown>) => Promise<void>
            }
        ).deleteRecord({
            executor,
            applicationId: 'application-1',
            schemaName: 'app_runtime_test',
            currentWorkspaceId: null,
            currentUserId: 'user-1',
            permissions: { deleteContent: true },
            entityCodename: 'orders',
            recordId: 'row-1'
        })

        expect(dispatchLifecycleEventSpy).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                executor: txExecutor,
                payload: expect.objectContaining({ eventName: 'beforeDelete' })
            })
        )
        expect(dispatchLifecycleEventSpy).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                executor,
                payload: expect.objectContaining({
                    eventName: 'afterDelete',
                    row: null,
                    previousRow
                })
            })
        )
        expect(txExecutor.query.mock.calls.find((call) => String(call[0]).includes('DELETE FROM'))).toBeDefined()
    })
})
