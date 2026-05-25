import { SharedEntityOverridesService } from '../../domains/shared/services/SharedEntityOverridesService'

describe('SharedEntityOverridesService', () => {
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
    } as unknown as ConstructorParameters<typeof SharedEntityOverridesService>[1]

    const service = new SharedEntityOverridesService(
        mockExec as unknown as ConstructorParameters<typeof SharedEntityOverridesService>[0],
        schemaService
    )

    beforeEach(() => {
        jest.clearAllMocks()
        mockEnsureSchema.mockResolvedValue(schemaName)
        mockExec.transaction.mockImplementation(async (callback: (tx: { query: typeof mockTxQuery }) => Promise<unknown>) =>
            callback({ query: mockTxQuery })
        )
    })

    it('rejects target exclusion when sharedBehavior.canExclude is false', async () => {
        mockTxQuery.mockImplementation((sql: string, params: unknown[]) => {
            if (sql.includes(`FROM "${schemaName}"."_mhb_components" entity`)) {
                return [{ id: 'attr-1', object_id: 'shared-pool-1', shared_behavior: { canExclude: false } }]
            }
            if (sql.includes(`FROM "${schemaName}"."_mhb_objects"`) && params[1] === 'object') {
                return [{ id: 'object-1' }]
            }
            return []
        })

        await expect(
            service.upsertOverride({
                metahubId: 'metahub-1',
                entityKind: 'component',
                sharedEntityId: 'attr-1',
                targetObjectId: 'object-1',
                isExcluded: true,
                userId: 'user-1'
            })
        ).rejects.toThrow('cannot be excluded')

        expect(mockTxQuery.mock.calls.some((call) => String(call[0]).includes('INSERT INTO'))).toBe(false)
    })

    it('soft-deletes override rows when the target returns to inherited default state', async () => {
        mockTxQuery.mockImplementation((sql: string, params: unknown[]) => {
            if (sql.includes(`FROM "${schemaName}"."_mhb_constants" entity`)) {
                return [{ id: 'constant-1', object_id: 'shared-pool-2', shared_behavior: {} }]
            }
            if (sql.includes(`FROM "${schemaName}"."_mhb_objects"`) && params[1] === 'set') {
                return [{ id: 'set-1' }]
            }
            if (sql.includes(`FROM "${schemaName}"."_mhb_shared_entity_overrides"`) && sql.includes('LIMIT 1')) {
                return [
                    {
                        id: 'override-1',
                        entity_kind: 'constant',
                        shared_entity_id: 'constant-1',
                        target_object_id: 'set-1',
                        is_excluded: true,
                        is_active: null,
                        sort_order: null,
                        _upl_version: 3
                    }
                ]
            }
            if (sql.includes(`UPDATE "${schemaName}"."_mhb_shared_entity_overrides"`)) {
                return [{ id: 'override-1' }]
            }
            return []
        })

        const result = await service.upsertOverride({
            metahubId: 'metahub-1',
            entityKind: 'constant',
            sharedEntityId: 'constant-1',
            targetObjectId: 'set-1',
            isExcluded: false,
            userId: 'user-1'
        })

        expect(result).toBeNull()
        expect(mockTxQuery.mock.calls.some((call) => String(call[0]).includes('SET _upl_deleted = true'))).toBe(true)
    })

    it('reuses an explicit runner instead of opening a nested transaction', async () => {
        const explicitRunnerQuery = jest.fn((sql: string, params: unknown[]) => {
            if (sql.includes(`FROM "${schemaName}"."_mhb_components" entity`)) {
                return [{ id: 'attr-2', object_id: 'shared-pool-1', shared_behavior: {} }]
            }
            if (sql.includes(`FROM "${schemaName}"."_mhb_objects"`) && params[1] === 'object') {
                return [{ id: 'object-2' }]
            }
            if (sql.includes(`FROM "${schemaName}"."_mhb_shared_entity_overrides"`) && sql.includes('LIMIT 1')) {
                return []
            }
            if (sql.includes(`INSERT INTO "${schemaName}"."_mhb_shared_entity_overrides"`)) {
                return [
                    {
                        id: 'override-2',
                        entity_kind: 'component',
                        shared_entity_id: 'attr-2',
                        target_object_id: 'object-2',
                        is_excluded: true,
                        is_active: null,
                        sort_order: null,
                        _upl_version: 1
                    }
                ]
            }
            return []
        })

        const result = await service.upsertOverride({
            metahubId: 'metahub-1',
            entityKind: 'component',
            sharedEntityId: 'attr-2',
            targetObjectId: 'object-2',
            isExcluded: true,
            userId: 'user-1',
            db: { query: explicitRunnerQuery } as { query: typeof explicitRunnerQuery }
        })

        expect(result?.id).toBe('override-2')
        expect(mockExec.transaction).not.toHaveBeenCalled()
        expect(explicitRunnerQuery.mock.calls.some((call) => String(call[0]).includes('INSERT INTO'))).toBe(true)
    })
})
