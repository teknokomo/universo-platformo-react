import { EntityActionExecutionService } from '../../domains/entities/services/EntityActionExecutionService'

const buildCodename = (value: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: {
            content: value,
            version: 1,
            isActive: true
        }
    }
})

describe('EntityActionExecutionService', () => {
    const schemaName = 'mhb_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

    it('dispatches matching script lifecycle handlers through the scripting engine', async () => {
        const dispatchEvent = jest.fn(async () => [])
        const script = {
            id: 'script-1',
            codename: buildCodename('script-one'),
            presentation: { name: buildCodename('Script One') },
            attachedToKind: 'custom.product',
            attachedToId: 'object-1',
            moduleRole: 'module',
            sourceKind: 'embedded',
            sdkApiVersion: '1.0.0',
            sourceCode: 'export default class ExampleScript {}',
            manifest: {
                className: 'ExampleScript',
                sdkApiVersion: '1.0.0',
                moduleRole: 'module',
                sourceKind: 'embedded',
                capabilities: ['metadata.read'],
                methods: [{ name: 'afterCreate', target: 'server', eventName: 'afterCreate' }]
            },
            serverBundle: 'module.exports = class ExampleScript {}',
            clientBundle: null,
            checksum: 'checksum-1',
            isActive: true,
            config: {},
            version: 1,
            updatedAt: null
        }

        const service = new EntityActionExecutionService(
            {
                getScriptByIdInSchema: jest.fn(async () => script)
            } as any,
            {
                dispatchEvent
            } as any
        )

        const executor = {
            query: jest.fn(async () => [
                {
                    id: 'object-1',
                    kind: 'custom.product',
                    codename: buildCodename('product-one'),
                    presentation: {
                        name: buildCodename('Product One'),
                        description: buildCodename('The current entity instance')
                    },
                    config: { enabled: true },
                    _upl_version: 4,
                    _upl_created_at: '2026-04-11T09:00:00.000Z',
                    _upl_updated_at: '2026-04-11T09:05:00.000Z',
                    _mhb_deleted: false,
                    _mhb_deleted_at: null
                }
            ])
        }

        await service.execute({
            metahubId: 'metahub-1',
            schemaName,
            objectId: 'object-1',
            eventName: 'afterCreate',
            binding: {
                id: 'binding-1',
                objectId: 'object-1',
                eventName: 'afterCreate',
                actionId: 'action-1',
                priority: 7,
                isActive: true,
                config: { retries: 2 },
                version: 1,
                updatedAt: null
            },
            action: {
                id: 'action-1',
                objectId: 'object-1',
                codename: buildCodename('action-one'),
                presentation: { name: 'Action One' },
                actionType: 'script',
                scriptId: 'script-1',
                config: { mode: 'strict' },
                sortOrder: 1,
                version: 1,
                updatedAt: null
            },
            payload: {
                previousRow: { id: 'old-row' },
                patch: { name: 'Updated product' },
                metadata: { source: 'entityInstancesController' }
            },
            userId: 'user-1',
            executor: executor as any
        })

        expect(dispatchEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                bundle: 'module.exports = class ExampleScript {}',
                eventName: 'afterCreate',
                manifest: script.manifest,
                payload: expect.objectContaining({
                    eventName: 'afterCreate',
                    entityCodename: 'product-one',
                    row: expect.objectContaining({
                        id: 'object-1',
                        kind: 'custom.product',
                        codename: 'product-one',
                        config: { enabled: true }
                    }),
                    previousRow: { id: 'old-row' },
                    patch: { name: 'Updated product' },
                    metadata: expect.objectContaining({
                        source: 'entityInstancesController',
                        metahubId: 'metahub-1',
                        objectId: 'object-1',
                        bindingId: 'binding-1',
                        actionId: 'action-1',
                        scriptId: 'script-1',
                        actionCodename: 'action-one',
                        scriptCodename: 'script-one'
                    })
                }),
                context: expect.objectContaining({
                    metahubId: 'metahub-1',
                    scriptId: 'script-1',
                    scriptCodename: 'script-one'
                })
            })
        )
    })

    it('skips actions when the referenced script has no matching lifecycle handler', async () => {
        const dispatchEvent = jest.fn(async () => [])
        const service = new EntityActionExecutionService(
            {
                getScriptByIdInSchema: jest.fn(async () => ({
                    id: 'script-1',
                    codename: buildCodename('script-one'),
                    presentation: { name: buildCodename('Script One') },
                    attachedToKind: 'custom.product',
                    attachedToId: 'object-1',
                    moduleRole: 'module',
                    sourceKind: 'embedded',
                    sdkApiVersion: '1.0.0',
                    sourceCode: 'export default class ExampleScript {}',
                    manifest: {
                        className: 'ExampleScript',
                        sdkApiVersion: '1.0.0',
                        moduleRole: 'module',
                        sourceKind: 'embedded',
                        capabilities: [],
                        methods: [{ name: 'mount', target: 'client', eventName: null }]
                    },
                    serverBundle: 'module.exports = class ExampleScript {}',
                    clientBundle: null,
                    checksum: 'checksum-1',
                    isActive: true,
                    config: {},
                    version: 1,
                    updatedAt: null
                }))
            } as any,
            {
                dispatchEvent
            } as any
        )

        await service.execute({
            metahubId: 'metahub-1',
            schemaName,
            objectId: 'object-1',
            eventName: 'afterUpdate',
            binding: {
                id: 'binding-1',
                objectId: 'object-1',
                eventName: 'afterUpdate',
                actionId: 'action-1',
                priority: 0,
                isActive: true,
                config: {},
                version: 1,
                updatedAt: null
            },
            action: {
                id: 'action-1',
                objectId: 'object-1',
                codename: buildCodename('action-one'),
                presentation: {},
                actionType: 'script',
                scriptId: 'script-1',
                config: {},
                sortOrder: 1,
                version: 1,
                updatedAt: null
            },
            executor: { query: jest.fn() } as any
        })

        expect(dispatchEvent).not.toHaveBeenCalled()
    })
})
