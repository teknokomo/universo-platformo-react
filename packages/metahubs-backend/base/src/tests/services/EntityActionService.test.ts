import { ActionService } from '../../domains/entities/services/ActionService'

describe('ActionService', () => {
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

    it('rejects action creation when the target object type does not enable actions', async () => {
        const queryMock = jest.fn(async (sql: string) => {
            if (sql.includes(`FROM "${schemaName}"."_mhb_objects"`)) {
                return [{ id: 'object-1', kind: 'enumeration' }]
            }
            return []
        })

        const service = new ActionService(
            createExecutor(queryMock) as any,
            { ensureSchema: mockEnsureSchema } as any,
            { resolveTypeInSchema: jest.fn(async () => ({ components: { actions: false } })) } as any
        )

        await expect(
            service.create('metahub-1', {
                objectId: 'object-1',
                codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'run-script' } } },
                actionType: 'builtin'
            })
        ).rejects.toThrow('does not enable actions')
    })

    it('requires an existing script for script actions', async () => {
        const queryMock = jest.fn(async (sql: string) => {
            if (sql.includes(`FROM "${schemaName}"."_mhb_objects"`)) {
                return [{ id: 'object-1', kind: 'catalog' }]
            }
            if (sql.includes(`FROM "${schemaName}"."_mhb_actions"`) && sql.includes('codename')) {
                return []
            }
            if (sql.includes(`FROM "${schemaName}"."_mhb_scripts"`)) {
                return []
            }
            return []
        })

        const service = new ActionService(
            createExecutor(queryMock) as any,
            { ensureSchema: mockEnsureSchema } as any,
            { resolveTypeInSchema: jest.fn(async () => ({ components: { actions: { enabled: true } } })) } as any
        )

        await expect(
            service.create('metahub-1', {
                objectId: 'object-1',
                codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'run-script' } } },
                actionType: 'script',
                scriptId: 'script-404'
            })
        ).rejects.toThrow('Script not found')
    })

    it('creates a builtin action for an action-enabled object', async () => {
        const queryMock = jest.fn(async (sql: string) => {
            if (sql.includes(`FROM "${schemaName}"."_mhb_objects"`)) {
                return [{ id: 'object-1', kind: 'catalog' }]
            }
            if (sql.includes(`FROM "${schemaName}"."_mhb_actions"`) && sql.includes('codename')) {
                return []
            }
            if (sql.includes('SELECT COALESCE(MAX(sort_order), 0)')) {
                return [{ max_sort_order: 0 }]
            }
            if (sql.includes(`INSERT INTO "${schemaName}"."_mhb_actions"`)) {
                return [
                    {
                        id: 'action-1',
                        object_id: 'object-1',
                        codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'run-script' } } },
                        presentation: {},
                        action_type: 'builtin',
                        script_id: null,
                        config: {},
                        sort_order: 1,
                        _upl_version: 1
                    }
                ]
            }
            return []
        })

        const service = new ActionService(
            createExecutor(queryMock) as any,
            { ensureSchema: mockEnsureSchema } as any,
            { resolveTypeInSchema: jest.fn(async () => ({ components: { actions: { enabled: true } } })) } as any
        )

        const result = await service.create('metahub-1', {
            objectId: 'object-1',
            codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'run-script' } } },
            actionType: 'builtin'
        })

        expect(result.id).toBe('action-1')
        expect(result.actionType).toBe('builtin')
    })
})
