import { EntityEventRouter } from '../../domains/entities/services/EntityEventRouter'
import { EntityMutationService } from '../../domains/entities/services/EntityMutationService'

describe('Entity lifecycle services', () => {
    it('dispatches resolved bindings through the action executor in priority order', async () => {
        const actionExecutor = jest.fn(async () => undefined)
        const router = new EntityEventRouter(
            {
                listActiveBindingsInSchema: jest.fn(async () => [
                    { id: 'binding-2', actionId: 'action-2', priority: 5 },
                    { id: 'binding-1', actionId: 'action-1', priority: 10 }
                ])
            } as any,
            {
                findByIdInSchema: jest
                    .fn()
                    .mockResolvedValueOnce({ id: 'action-2', actionType: 'builtin' })
                    .mockResolvedValueOnce({ id: 'action-1', actionType: 'builtin' })
            } as any
        )

        const result = await router.dispatchInSchema({
            metahubId: 'metahub-1',
            schemaName: 'mhb_test_schema',
            objectId: 'object-1',
            eventName: 'beforeCreate',
            executor: { query: jest.fn() } as any,
            actionExecutor
        })

        expect(result.map((item) => item.binding.id)).toEqual(['binding-2', 'binding-1'])
        expect(actionExecutor).toHaveBeenCalledTimes(2)
    })

    it('runs before events in transaction and after events after commit', async () => {
        const calls: string[] = []
        const transactionExecutor = { query: jest.fn(), isReleased: () => false }
        const exec = {
            query: jest.fn(),
            transaction: jest.fn(async (cb: any) => cb(transactionExecutor)),
            isReleased: () => false
        }

        const service = new EntityMutationService(
            exec as any,
            { ensureSchema: jest.fn(async () => 'mhb_test_schema') } as any,
            {
                dispatchInSchema: jest.fn(async ({ metahubId, eventName }: { metahubId: string; eventName: string }) => {
                    calls.push(`${metahubId}:${eventName}`)
                    return []
                })
            } as any
        )

        const result = await service.run({
            metahubId: 'metahub-1',
            objectId: 'object-1',
            beforeEvent: 'beforeCreate',
            afterEvent: 'afterCreate',
            mutation: async () => {
                calls.push('mutation')
                return 'ok'
            }
        })

        expect(result).toBe('ok')
        expect(calls).toEqual(['metahub-1:beforeCreate', 'mutation', 'metahub-1:afterCreate'])
    })

    it('allows after-commit events to target the created object id resolved from the mutation result', async () => {
        const calls: string[] = []
        const transactionExecutor = { query: jest.fn(), isReleased: () => false }
        const exec = {
            query: jest.fn(),
            transaction: jest.fn(async (cb: any) => cb(transactionExecutor)),
            isReleased: () => false
        }

        const service = new EntityMutationService(
            exec as any,
            { ensureSchema: jest.fn(async () => 'mhb_test_schema') } as any,
            {
                dispatchInSchema: jest.fn(
                    async ({ metahubId, eventName, objectId }: { metahubId: string; eventName: string; objectId: string }) => {
                        calls.push(`${metahubId}:${eventName}:${objectId}`)
                        return []
                    }
                )
            } as any
        )

        const result = await service.run({
            metahubId: 'metahub-1',
            objectId: '11111111-1111-4111-8111-111111111111',
            beforeEvent: 'beforeCreate',
            afterEvent: 'afterCreate',
            afterEventObjectId: (createdEntity: { id: string }) => createdEntity.id,
            mutation: async () => ({ id: '22222222-2222-4222-8222-222222222222' })
        })

        await new Promise((resolve) => setImmediate(resolve))

        expect(result).toEqual({ id: '22222222-2222-4222-8222-222222222222' })
        expect(calls).toEqual([
            'metahub-1:beforeCreate:11111111-1111-4111-8111-111111111111',
            'metahub-1:afterCreate:22222222-2222-4222-8222-222222222222'
        ])
    })

    it('logs and suppresses after-commit failures without failing the mutation result', async () => {
        const transactionExecutor = { query: jest.fn(), isReleased: () => false }
        const exec = {
            query: jest.fn(),
            transaction: jest.fn(async (cb: any) => cb(transactionExecutor)),
            isReleased: () => false
        }
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

        const service = new EntityMutationService(
            exec as any,
            { ensureSchema: jest.fn(async () => 'mhb_test_schema') } as any,
            {
                dispatchInSchema: jest.fn(async ({ eventName }: { eventName: string }) => {
                    if (eventName === 'afterCreate') {
                        throw new Error('afterCreate failed')
                    }

                    return []
                })
            } as any
        )

        const result = await service.run({
            metahubId: 'metahub-1',
            objectId: 'object-1',
            afterEvent: 'afterCreate',
            mutation: async () => 'ok'
        })

        await new Promise((resolve) => setImmediate(resolve))

        expect(result).toBe('ok')
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            '[EntityMutationService]',
            'After-commit lifecycle dispatch failed for afterCreate on object object-1',
            expect.any(Error)
        )

        consoleErrorSpy.mockRestore()
    })
})
