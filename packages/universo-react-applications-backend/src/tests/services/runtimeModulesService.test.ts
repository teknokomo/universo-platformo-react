import type { ApplicationLifecycleContract, ApplicationModuleDefinition } from '@universo-react/types'
import { RuntimeModulesService } from '../../services/runtimeModulesService'
import { createMockDbExecutor } from '../utils/dbMocks'

const defaultLifecycleContract: ApplicationLifecycleContract = {
    publish: { enabled: true, trackAt: true, trackBy: true },
    archive: { enabled: true, trackAt: true, trackBy: true },
    delete: { mode: 'soft', trackAt: true, trackBy: true }
}

const createRecordBinding = (overrides: Record<string, unknown> = {}) => ({
    object: {
        id: 'object-1',
        kind: 'object',
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
    tableIdent: '"app_018f8a787b8f7c1da1112222333346aa"."orders"',
    activeRowCondition: '_upl_deleted = false AND _app_deleted = false',
    ...overrides
})

const createModuleDefinition = (overrides: Partial<ApplicationModuleDefinition> = {}): ApplicationModuleDefinition => ({
    id: overrides.id ?? 'module-1',
    codename: overrides.codename ?? 'quiz-widget',
    presentation: overrides.presentation ?? {
        name: {
            _primary: 'en',
            locales: {
                en: { content: 'Quiz widget' }
            }
        }
    },
    attachedToKind: overrides.attachedToKind ?? 'object',
    attachedToId: overrides.attachedToId ?? 'object-1',
    moduleRole: overrides.moduleRole ?? 'widget',
    sourceKind: overrides.sourceKind ?? 'embedded',
    sdkApiVersion: overrides.sdkApiVersion ?? '1.0.0',
    manifest: overrides.manifest ?? {
        className: 'QuizWidgetModule',
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
    ledger: {
        list: () => Promise<unknown>
        append: (ledgerCodename: string, facts: Array<{ data: Record<string, unknown> }>) => Promise<unknown>
        reverse: (ledgerCodename: string, factIds: string[]) => Promise<unknown>
    }
    metadata: {
        getAttachedEntity: () => Promise<unknown>
    }
    callServerMethod: (methodName: string, args: unknown[]) => Promise<unknown>
}

describe('RuntimeModulesService', () => {
    const engine = {
        callMethod: jest.fn(),
        dispatchEvent: jest.fn().mockResolvedValue([])
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('redacts bundles, private config, and server-only metadata from listed runtime modules', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeModulesService(engine as never)

        executor.query.mockResolvedValueOnce([{ table_name: 'app_018f8a787b8f7c1da1112222333346aa._app_modules' }]).mockResolvedValueOnce([
            {
                id: 'module-1',
                codename: 'quiz-widget',
                presentation: {
                    name: {
                        _primary: 'en',
                        locales: { en: { content: 'Quiz widget' } }
                    }
                },
                attached_to_kind: 'object',
                attached_to_id: 'object-1',
                module_role: 'widget',
                source_kind: 'embedded',
                sdk_api_version: '1.0.0',
                manifest: {
                    className: 'QuizWidgetModule',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'widget',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read', 'rpc.client', 'records.read'],
                    methods: [
                        { name: 'mount', target: 'client' },
                        { name: 'submit', target: 'server' },
                        { name: 'afterUpdate', target: 'server', eventName: 'afterUpdate' }
                    ]
                },
                server_bundle: 'module.exports = class ServerWidget {}',
                client_bundle: 'module.exports = class ClientWidget {}',
                checksum: 'bundle-checksum',
                is_active: true,
                config: { apiKey: 'secret-api-key', token: 'secret-token' }
            }
        ])

        const items = await service.listClientModules({
            executor: executor as never,
            schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
            attachedToKind: 'object',
            attachedToId: 'object-1'
        })

        expect(items).toHaveLength(1)
        expect(items[0]).toMatchObject({
            id: 'module-1',
            config: {},
            manifest: expect.objectContaining({
                capabilities: ['metadata.read', 'rpc.client'],
                methods: [{ name: 'mount', target: 'client' }]
            })
        })
        expect(items[0]).not.toHaveProperty('clientBundle')
        expect(items[0]).not.toHaveProperty('serverBundle')
        expect(JSON.stringify(items[0])).not.toContain('secret-api-key')
        expect(JSON.stringify(items[0])).not.toContain('module.exports')
    })

    it('resolves an active server module by codename and role without exposing it through client listing', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeModulesService(engine as never)

        executor.query.mockResolvedValueOnce([{ table_name: 'app_018f8a787b8f7c1da1112222333346aa._app_modules' }]).mockResolvedValueOnce([
            {
                id: 'module-1',
                codename: 'fixed-tick-flight-runtime',
                presentation: { name: { _primary: 'en', locales: { en: { content: 'Realtime runtime' } } } },
                attached_to_kind: 'metahub',
                attached_to_id: null,
                module_role: 'module',
                source_kind: 'embedded',
                sdk_api_version: '1.0.0',
                manifest: {
                    className: 'FixedTickFlightRuntime',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'module',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read'],
                    methods: [{ name: 'createRealtimeRoomOptions', target: 'server' }]
                },
                server_bundle: 'module.exports = class FixedTickFlightRuntime {}',
                client_bundle: null,
                checksum: 'server-checksum',
                is_active: true,
                config: {}
            }
        ])

        const module = await service.getActiveModuleByCodename({
            executor: executor as never,
            schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
            codename: 'fixed-tick-flight-runtime',
            attachedToKind: 'metahub',
            moduleRole: 'module'
        })

        expect(module).toMatchObject({
            codename: 'fixed-tick-flight-runtime',
            moduleRole: 'module',
            serverBundle: 'module.exports = class FixedTickFlightRuntime {}',
            checksum: 'server-checksum'
        })
    })

    it('keeps internal server module calls separate from public RPC capability', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeModulesService(engine as never)
        engine.callMethod.mockResolvedValueOnce({ cruiseSpeed: 36 })

        executor.query.mockResolvedValueOnce([{ table_name: 'app_018f8a787b8f7c1da1112222333346aa._app_modules' }]).mockResolvedValueOnce([
            {
                id: 'module-1',
                codename: 'fixed-tick-flight-runtime',
                presentation: { name: { _primary: 'en', locales: { en: { content: 'Realtime runtime' } } } },
                attached_to_kind: 'metahub',
                attached_to_id: null,
                module_role: 'module',
                source_kind: 'embedded',
                sdk_api_version: '1.0.0',
                manifest: {
                    className: 'FixedTickFlightRuntime',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'module',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read'],
                    methods: [{ name: 'createRealtimeRoomOptions', target: 'server' }]
                },
                server_bundle: 'module.exports = class FixedTickFlightRuntime {}',
                client_bundle: null,
                checksum: 'server-checksum',
                is_active: true,
                config: {}
            }
        ])

        await expect(
            service.callInternalServerMethod({
                executor: executor as never,
                applicationId: '018f8a78-7b8f-7c1d-a111-2222333346aa',
                schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
                moduleCodename: 'fixed-tick-flight-runtime',
                attachedToKind: 'metahub',
                moduleRole: 'module',
                methodName: 'createRealtimeRoomOptions',
                args: [{ scene: null }]
            })
        ).resolves.toEqual({ cruiseSpeed: 36 })
        expect(engine.callMethod).toHaveBeenCalledWith(
            expect.objectContaining({
                bundle: 'module.exports = class FixedTickFlightRuntime {}',
                methodName: 'createRealtimeRoomOptions',
                args: [{ scene: null }]
            })
        )
    })

    it('keeps shared client/server methods visible on the runtime client list surface', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeModulesService(engine as never)

        executor.query.mockResolvedValueOnce([{ table_name: 'app_018f8a787b8f7c1da1112222333346aa._app_modules' }]).mockResolvedValueOnce([
            {
                id: 'module-1',
                codename: 'quiz-widget',
                presentation: {
                    name: {
                        _primary: 'en',
                        locales: { en: { content: 'Quiz widget' } }
                    }
                },
                attached_to_kind: 'object',
                attached_to_id: 'object-1',
                module_role: 'widget',
                source_kind: 'embedded',
                sdk_api_version: '1.0.0',
                manifest: {
                    className: 'QuizWidgetModule',
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

        const items = await service.listClientModules({
            executor: executor as never,
            schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
            attachedToKind: 'object',
            attachedToId: 'object-1'
        })

        expect(items).toHaveLength(1)
        expect(items[0]?.manifest.methods).toEqual([{ name: 'mount', target: 'server_and_client' }])
    })

    it('rejects direct client bundle fetches for modules without client-visible methods', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeModulesService(engine as never)
        const getActiveModuleByIdSpy = jest.spyOn(
            service as never as { getActiveModuleById: () => Promise<ApplicationModuleDefinition | null> },
            'getActiveModuleById'
        )

        getActiveModuleByIdSpy.mockResolvedValueOnce(
            createModuleDefinition({
                manifest: {
                    className: 'ServerOnlyModule',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'module',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read'],
                    methods: [{ name: 'afterCreate', target: 'server', eventName: 'afterCreate' }]
                },
                clientBundle: 'module.exports = class LeakedClientBundle {}'
            })
        )

        await expect(
            service.getClientModuleBundle({
                executor: executor as never,
                schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
                moduleId: 'module-1'
            })
        ).rejects.toThrow('Runtime module does not expose a client bundle')
    })

    it('returns direct client bundles for modules visible through the runtime client list', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeModulesService(engine as never)
        const getActiveModuleByIdSpy = jest.spyOn(
            service as never as { getActiveModuleById: () => Promise<ApplicationModuleDefinition | null> },
            'getActiveModuleById'
        )

        getActiveModuleByIdSpy.mockResolvedValueOnce(
            createModuleDefinition({
                manifest: {
                    className: 'QuizWidgetModule',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'widget',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read', 'rpc.client'],
                    methods: [{ name: 'mount', target: 'server_and_client' }]
                },
                clientBundle: 'module.exports = class QuizWidgetModule {}',
                checksum: 'client-visible-checksum'
            })
        )

        await expect(
            service.getClientModuleBundle({
                executor: executor as never,
                schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
                moduleId: 'module-1'
            })
        ).resolves.toEqual({
            bundle: 'module.exports = class QuizWidgetModule {}',
            checksum: 'client-visible-checksum'
        })
    })

    it('keeps the execution context fail-closed when a capability is not declared', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeModulesService(engine as never)
        const context = (
            service as never as {
                createExecutionContext: (params: Record<string, unknown>) => RuntimeExecutionContext
            }
        ).createExecutionContext({
            executor,
            applicationId: 'application-1',
            schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
            module: createModuleDefinition({
                manifest: {
                    className: 'QuizWidgetModule',
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

        await expect(context.records.list('orders')).rejects.toThrow('Module capability "records.read" is not enabled for this module')
        await expect(context.ledger.list()).rejects.toThrow('Module capability "ledger.read" is not enabled for this module')
        await expect(context.ledger.append('ProgressLedger', [])).rejects.toThrow(
            'Module capability "ledger.write" is not enabled for this module'
        )
        await expect(context.ledger.reverse('ProgressLedger', ['fact-1'])).rejects.toThrow(
            'Module capability "ledger.write" is not enabled for this module'
        )
        await expect(context.metadata.getAttachedEntity()).rejects.toThrow(
            'Module capability "metadata.read" is not enabled for this module'
        )
        await expect(context.callServerMethod('submit', [])).rejects.toThrow(
            'Module capability "rpc.client" is not enabled for this module'
        )
    })

    it('exposes ledger append only when ledger.write is declared', async () => {
        const { executor } = createMockDbExecutor()
        const ledgers = {
            appendFacts: jest.fn().mockResolvedValue([{ id: 'fact-1' }]),
            reverseFacts: jest.fn().mockResolvedValue([{ id: 'fact-2' }]),
            listLedgers: jest.fn(),
            listFacts: jest.fn(),
            queryProjection: jest.fn()
        }
        const service = new RuntimeModulesService(engine as never, ledgers as never)
        const context = (
            service as never as {
                createExecutionContext: (params: Record<string, unknown>) => RuntimeExecutionContext
            }
        ).createExecutionContext({
            executor,
            applicationId: 'application-1',
            schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
            module: createModuleDefinition({
                manifest: {
                    className: 'PostingModule',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'lifecycle',
                    sourceKind: 'embedded',
                    capabilities: ['ledger.write'],
                    methods: [{ name: 'afterPost', target: 'server', eventName: 'afterPost' }]
                }
            }),
            currentWorkspaceId: 'workspace-1',
            currentUserId: 'user-1',
            permissions: null
        })

        await expect(context.ledger.append('ProgressLedger', [{ data: { Learner: 'student-1' } }])).resolves.toEqual([{ id: 'fact-1' }])
        expect(ledgers.appendFacts).toHaveBeenCalledWith(
            expect.objectContaining({
                executor,
                schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
                ledgerCodename: 'ProgressLedger',
                currentWorkspaceId: 'workspace-1',
                currentUserId: 'user-1',
                facts: [{ data: { Learner: 'student-1' } }]
            })
        )

        await expect(context.ledger.reverse('ProgressLedger', ['fact-1'])).resolves.toEqual([{ id: 'fact-2' }])
        expect(ledgers.reverseFacts).toHaveBeenCalledWith(
            expect.objectContaining({
                executor,
                schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
                ledgerCodename: 'ProgressLedger',
                currentWorkspaceId: 'workspace-1',
                currentUserId: 'user-1',
                factIds: ['fact-1']
            })
        )
    })

    it('rejects public RPC calls when the module does not declare rpc.client', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeModulesService(engine as never)
        const getActiveModuleByIdSpy = jest.spyOn(
            service as never as { getActiveModuleById: () => Promise<ApplicationModuleDefinition | null> },
            'getActiveModuleById'
        )

        getActiveModuleByIdSpy.mockResolvedValueOnce(
            createModuleDefinition({
                manifest: {
                    className: 'ServerOnlyModule',
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
                schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
                moduleId: 'module-1',
                currentWorkspaceId: null,
                currentUserId: 'user-1',
                permissions: null,
                request: {
                    methodName: 'submit',
                    args: []
                }
            })
        ).rejects.toThrow('Module capability "rpc.client" is not enabled for this module')

        expect(engine.callMethod).not.toHaveBeenCalled()
    })

    it('rejects lifecycle handlers on the public RPC surface', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeModulesService(engine as never)
        const getActiveModuleByIdSpy = jest.spyOn(
            service as never as { getActiveModuleById: () => Promise<ApplicationModuleDefinition | null> },
            'getActiveModuleById'
        )

        getActiveModuleByIdSpy.mockResolvedValueOnce(
            createModuleDefinition({
                moduleRole: 'lifecycle',
                manifest: {
                    className: 'LifecycleModule',
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
                schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
                moduleId: 'module-1',
                currentWorkspaceId: null,
                currentUserId: 'user-1',
                permissions: null,
                request: {
                    methodName: 'afterCreate',
                    args: []
                }
            })
        ).rejects.toThrow('Runtime module lifecycle handlers are not callable through public RPC')

        expect(engine.callMethod).not.toHaveBeenCalled()
    })

    it('allows shared client/server methods on the public RPC surface when rpc.client is declared', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeModulesService(engine as never)
        const getActiveModuleByIdSpy = jest.spyOn(
            service as never as { getActiveModuleById: () => Promise<ApplicationModuleDefinition | null> },
            'getActiveModuleById'
        )

        getActiveModuleByIdSpy.mockResolvedValueOnce(
            createModuleDefinition({
                manifest: {
                    className: 'SharedModule',
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
                schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
                moduleId: 'module-1',
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
                    moduleId: 'module-1',
                    moduleCodename: 'quiz-widget'
                })
            })
        )
    })

    it('rejects runtime modules with unsupported sdkApiVersion metadata', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeModulesService(engine as never)

        executor.query.mockResolvedValueOnce([{ table_name: 'app_018f8a787b8f7c1da1112222333346aa._app_modules' }]).mockResolvedValueOnce([
            {
                id: 'module-1',
                codename: 'quiz-widget',
                presentation: {
                    name: {
                        _primary: 'en',
                        locales: { en: { content: 'Quiz widget' } }
                    }
                },
                attached_to_kind: 'object',
                attached_to_id: 'object-1',
                module_role: 'widget',
                source_kind: 'embedded',
                sdk_api_version: '2.0.0',
                manifest: {
                    className: 'QuizWidgetModule',
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
                schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
                moduleId: 'module-1',
                currentWorkspaceId: null,
                currentUserId: 'user-1',
                permissions: null,
                request: {
                    methodName: 'submit',
                    args: []
                }
            })
        ).rejects.toThrow('Unsupported module sdkApiVersion "2.0.0". Supported versions: 1.0.0')

        expect(engine.callMethod).not.toHaveBeenCalled()
    })

    it('dispatches lifecycle handlers only for modules that declare the lifecycle capability', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeModulesService(engine as never)
        const listActiveModulesSpy = jest.spyOn(
            service as never as { listActiveModules: () => Promise<ApplicationModuleDefinition[]> },
            'listActiveModules'
        )

        listActiveModulesSpy.mockResolvedValueOnce([
            createModuleDefinition({
                moduleRole: 'lifecycle',
                attachedToKind: 'object',
                attachedToId: 'object-1',
                manifest: {
                    className: 'LifecycleModule',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'lifecycle',
                    sourceKind: 'embedded',
                    capabilities: ['lifecycle'],
                    methods: [{ name: 'afterCreate', target: 'server', eventName: 'afterCreate' }]
                }
            }),
            createModuleDefinition({
                id: 'module-2',
                moduleRole: 'lifecycle',
                attachedToKind: 'object',
                attachedToId: 'object-1',
                manifest: {
                    className: 'LifecycleModuleWithoutCapability',
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
            schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
            attachmentKind: 'object',
            attachmentId: 'object-1',
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
        const service = new RuntimeModulesService(engine as never)
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
            schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
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
        const service = new RuntimeModulesService(engine as never)
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
            schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
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
        const service = new RuntimeModulesService(engine as never)
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
            schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
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
