const mockEnsureSchema = jest.fn()
const mockIncrementVersion = jest.fn()
const mockUpdateWithVersionCheck = jest.fn()

jest.mock('../../utils/optimisticLock', () => ({
    incrementVersion: (...args: unknown[]) => mockIncrementVersion(...args),
    updateWithVersionCheck: (...args: unknown[]) => mockUpdateWithVersionCheck(...args)
}))

import { MetahubHubsService } from '../../domains/metahubs/services/MetahubHubsService'

describe('MetahubHubsService active-row filtering', () => {
    type MockExecutor = {
        query: typeof mockExecQuery
        transaction: jest.Mock
        isReleased: () => boolean
    }

    const schemaService = {
        ensureSchema: mockEnsureSchema
    } as unknown as ConstructorParameters<typeof MetahubHubsService>[1]

    const mockExecQuery = jest.fn()
    const mockExec: MockExecutor = {
        query: mockExecQuery,
        transaction: jest.fn(async (cb: (tx: MockExecutor) => Promise<unknown>) => cb(mockExec)),
        isReleased: () => false
    }

    const service = new MetahubHubsService(mockExec as unknown as ConstructorParameters<typeof MetahubHubsService>[0], schemaService)

    beforeEach(() => {
        jest.clearAllMocks()
        mockEnsureSchema.mockResolvedValue('mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        mockExecQuery.mockResolvedValue([])
        mockIncrementVersion.mockResolvedValue({
            id: 'hub-1',
            codename: 'main-hub',
            presentation: { name: { en: 'Main hub' }, description: null },
            config: { sortOrder: 1, parentHubId: null },
            _upl_version: 2,
            _upl_created_at: '2026-03-14T00:00:00.000Z',
            _upl_updated_at: '2026-03-14T01:00:00.000Z'
        })
    })

    it('adds active-row predicates to list and count reads', async () => {
        mockExecQuery
            .mockResolvedValueOnce([
                {
                    id: 'hub-1',
                    codename: 'main-hub',
                    presentation: { name: { en: 'Main hub' }, description: null },
                    config: { sortOrder: 1, parentHubId: null },
                    _upl_version: 1,
                    _upl_created_at: '2026-03-14T00:00:00.000Z',
                    _upl_updated_at: '2026-03-14T00:00:00.000Z'
                }
            ])
            .mockResolvedValueOnce([{ total: '1' }])

        const result = await service.findAll('metahub-1', {}, 'user-1')

        expect(mockExecQuery.mock.calls[0][0]).toContain("kind = 'hub' AND _upl_deleted = false AND _mhb_deleted = false")
        expect(mockExecQuery.mock.calls[1][0]).toContain("kind = 'hub' AND _upl_deleted = false AND _mhb_deleted = false")
        expect(result.total).toBe(1)
        expect(result.items).toEqual([
            expect.objectContaining({
                id: 'hub-1',
                codename: 'main-hub'
            })
        ])
    })

    it('adds active-row predicates to lookup reads', async () => {
        await service.findById('metahub-1', 'hub-1', 'user-1')
        await service.findByCodename('metahub-1', 'main-hub', 'user-1')
        await service.findByIds('metahub-1', ['hub-1'], 'user-1')
        await service.count('metahub-1', 'user-1')

        expect(mockExecQuery.mock.calls[0][0]).toContain("WHERE id = $1 AND kind = 'hub' AND _upl_deleted = false AND _mhb_deleted = false")
        expect(mockExecQuery.mock.calls[1][0]).toContain(
            "WHERE codename = $1 AND kind = 'hub' AND _upl_deleted = false AND _mhb_deleted = false"
        )
        expect(mockExecQuery.mock.calls[2][0]).toContain(
            "WHERE kind = 'hub' AND _upl_deleted = false AND _mhb_deleted = false AND id = ANY($1::uuid[])"
        )
        expect(mockExecQuery.mock.calls[3][0]).toContain("WHERE kind = 'hub' AND _upl_deleted = false AND _mhb_deleted = false")
    })

    it('fails closed on soft-deleted rows before update', async () => {
        mockExecQuery.mockResolvedValueOnce([
            {
                id: 'hub-1',
                codename: 'main-hub',
                presentation: { name: { en: 'Main hub' }, description: null },
                config: { sortOrder: 1, parentHubId: null },
                _upl_version: 1,
                _upl_created_at: '2026-03-14T00:00:00.000Z',
                _upl_updated_at: '2026-03-14T00:00:00.000Z'
            }
        ])

        await service.update('metahub-1', 'hub-1', { name: { en: 'Renamed hub' }, updatedBy: 'user-1' }, 'user-1')

        expect(mockExecQuery.mock.calls[0][0]).toContain("WHERE id = $1 AND kind = 'hub' AND _upl_deleted = false AND _mhb_deleted = false")
        expect(mockIncrementVersion).toHaveBeenCalledTimes(1)
        expect(mockUpdateWithVersionCheck).not.toHaveBeenCalled()
    })

    it('soft-deletes only active hub rows instead of hard deleting them', async () => {
        await service.delete('metahub-1', 'hub-1', 'user-1')

        expect(mockExecQuery).toHaveBeenCalledTimes(1)
        expect(mockExecQuery.mock.calls[0][0]).toContain('UPDATE "mhb_a1b2c3d4e5f67890abcdef1234567890_b1"."_mhb_objects"')
        expect(mockExecQuery.mock.calls[0][0]).toContain('_mhb_deleted = true')
        expect(mockExecQuery.mock.calls[0][0]).toContain("WHERE id = $3 AND kind = 'hub' AND _upl_deleted = false AND _mhb_deleted = false")
        expect(mockExecQuery.mock.calls[0][0]).not.toContain('DELETE FROM')
    })
})
