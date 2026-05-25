import { EventBindingService } from '../../domains/entities/services/EventBindingService'

describe('EventBindingService', () => {
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

    it('rejects bindings when the target object type does not enable events', async () => {
        const queryMock = jest.fn(async (sql: string) => {
            if (sql.includes(`FROM "${schemaName}"."_mhb_objects"`)) {
                return [{ id: 'object-1', kind: 'enumeration' }]
            }
            return []
        })

        const service = new EventBindingService(
            createExecutor(queryMock) as any,
            { ensureSchema: mockEnsureSchema } as any,
            { resolveTypeInSchema: jest.fn(async () => ({ capabilities: { events: false } })) } as any
        )

        await expect(
            service.create('metahub-1', {
                objectId: 'object-1',
                eventName: 'beforeCreate',
                actionId: 'action-1'
            })
        ).rejects.toThrow('does not enable events')
    })

    it('rejects bindings that point to an action owned by a different object', async () => {
        const queryMock = jest.fn(async (sql: string) => {
            if (sql.includes(`FROM "${schemaName}"."_mhb_objects"`)) {
                return [{ id: 'object-1', kind: 'object' }]
            }
            if (sql.includes(`FROM "${schemaName}"."_mhb_actions"`)) {
                return [{ id: 'action-1', object_id: 'other-object' }]
            }
            return []
        })

        const service = new EventBindingService(
            createExecutor(queryMock) as any,
            { ensureSchema: mockEnsureSchema } as any,
            { resolveTypeInSchema: jest.fn(async () => ({ capabilities: { events: { enabled: true } } })) } as any
        )

        await expect(
            service.create('metahub-1', {
                objectId: 'object-1',
                eventName: 'beforeCreate',
                actionId: 'action-1'
            })
        ).rejects.toThrow('same object')
    })

    it('creates an active event binding for an event-enabled object', async () => {
        const queryMock = jest.fn(async (sql: string) => {
            if (sql.includes(`FROM "${schemaName}"."_mhb_objects"`)) {
                return [{ id: 'object-1', kind: 'object' }]
            }
            if (sql.includes(`FROM "${schemaName}"."_mhb_actions"`)) {
                return [{ id: 'action-1', object_id: 'object-1' }]
            }
            if (sql.includes(`FROM "${schemaName}"."_mhb_event_bindings"`) && sql.includes('action_id =')) {
                return []
            }
            if (sql.includes(`INSERT INTO "${schemaName}"."_mhb_event_bindings"`)) {
                return [
                    {
                        id: 'binding-1',
                        object_id: 'object-1',
                        event_name: 'beforeCreate',
                        action_id: 'action-1',
                        priority: 0,
                        is_active: true,
                        config: {},
                        _upl_version: 1
                    }
                ]
            }
            return []
        })

        const service = new EventBindingService(
            createExecutor(queryMock) as any,
            { ensureSchema: mockEnsureSchema } as any,
            { resolveTypeInSchema: jest.fn(async () => ({ capabilities: { events: { enabled: true } } })) } as any
        )

        const result = await service.create('metahub-1', {
            objectId: 'object-1',
            eventName: 'beforeCreate',
            actionId: 'action-1'
        })

        expect(result.id).toBe('binding-1')
        expect(result.eventName).toBe('beforeCreate')
        expect(result.isActive).toBe(true)
    })
})
