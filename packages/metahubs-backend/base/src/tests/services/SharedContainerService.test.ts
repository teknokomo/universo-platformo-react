import { SHARED_OBJECT_KINDS } from '@universo/types'
import { SharedContainerService } from '../../domains/shared/services/SharedContainerService'

describe('SharedContainerService', () => {
    const schemaName = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'

    type MockExecutor = {
        query: jest.Mock
        transaction: jest.Mock
        isReleased: () => boolean
    }

    const mockEnsureSchema = jest.fn()
    const mockQuery = jest.fn()
    const mockTxQuery = jest.fn()
    const mockExec: MockExecutor = {
        query: mockQuery,
        transaction: jest.fn(),
        isReleased: () => false
    }

    const schemaService = {
        ensureSchema: mockEnsureSchema
    } as unknown as ConstructorParameters<typeof SharedContainerService>[1]

    const service = new SharedContainerService(
        mockExec as unknown as ConstructorParameters<typeof SharedContainerService>[0],
        schemaService
    )

    beforeEach(() => {
        jest.clearAllMocks()
        mockEnsureSchema.mockResolvedValue(schemaName)
        mockExec.transaction.mockImplementation(async (callback: (tx: { query: typeof mockTxQuery }) => Promise<unknown>) =>
            callback({ query: mockTxQuery })
        )
    })

    it('creates a virtual shared container lazily under an advisory lock', async () => {
        mockTxQuery.mockImplementation((sql: string) => {
            if (sql.includes('SELECT id, kind')) return []
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('INSERT INTO')) return [{ id: 'shared-container-1' }]
            return []
        })

        const result = await service.resolveContainerObjectId('metahub-1', SHARED_OBJECT_KINDS.SHARED_CATALOG_POOL, undefined, 'user-1')

        expect(result).toBe('shared-container-1')
        expect(mockTxQuery.mock.calls.some((call) => String(call[0]).includes('pg_advisory_xact_lock'))).toBe(true)

        const insertCall = mockTxQuery.mock.calls.find((call) => String(call[0]).includes('INSERT INTO'))
        expect(insertCall).toBeDefined()
        expect(JSON.parse(String(insertCall?.[1][3]))).toEqual(
            expect.objectContaining({
                isVirtualContainer: true,
                sharedEntityKind: 'attribute',
                targetObjectKind: 'catalog'
            })
        )
    })

    it('reuses an existing shared container without inserting a duplicate row', async () => {
        mockTxQuery.mockImplementation((sql: string) => {
            if (sql.includes('SELECT id, kind')) return [{ id: 'existing-container', kind: SHARED_OBJECT_KINDS.SHARED_SET_POOL }]
            return []
        })

        const result = await service.resolveContainerObjectId('metahub-1', SHARED_OBJECT_KINDS.SHARED_SET_POOL, undefined, 'user-1')

        expect(result).toBe('existing-container')
        expect(mockTxQuery.mock.calls.some((call) => String(call[0]).includes('INSERT INTO'))).toBe(false)
        expect(mockTxQuery.mock.calls.some((call) => String(call[0]).includes('pg_advisory_xact_lock'))).toBe(false)
    })

    it('lists existing shared containers without acquiring locks or inserting rows', async () => {
        mockQuery.mockImplementation((sql: string) => {
            if (sql.includes('SELECT id, kind')) {
                return [
                    { id: 'shared-attr-container', kind: SHARED_OBJECT_KINDS.SHARED_CATALOG_POOL },
                    { id: 'shared-value-container', kind: SHARED_OBJECT_KINDS.SHARED_ENUM_POOL }
                ]
            }

            return []
        })

        const result = await service.findAllContainerObjectIds('metahub-1', 'user-1')

        expect(result).toEqual({
            [SHARED_OBJECT_KINDS.SHARED_CATALOG_POOL]: 'shared-attr-container',
            [SHARED_OBJECT_KINDS.SHARED_ENUM_POOL]: 'shared-value-container'
        })
        expect(mockExec.transaction).not.toHaveBeenCalled()
        expect(mockQuery.mock.calls.some((call) => String(call[0]).includes('INSERT INTO'))).toBe(false)
        expect(mockQuery.mock.calls.some((call) => String(call[0]).includes('pg_advisory_xact_lock'))).toBe(false)
    })
})
