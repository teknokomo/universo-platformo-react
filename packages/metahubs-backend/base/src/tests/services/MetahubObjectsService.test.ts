import { MetahubObjectsService } from '../../domains/metahubs/services/MetahubObjectsService'

describe('MetahubObjectsService mutation fail-closed behavior', () => {
    type MockExecutor = {
        query: jest.Mock
        transaction: jest.Mock
        isReleased: () => boolean
    }

    const mockEnsureSchema = jest.fn()
    const mockQuery = jest.fn()
    const mockExec: MockExecutor = {
        query: mockQuery,
        transaction: jest.fn(),
        isReleased: () => false
    }

    const schemaService = {
        ensureSchema: mockEnsureSchema
    } as unknown as ConstructorParameters<typeof MetahubObjectsService>[1]

    const service = new MetahubObjectsService(
        mockExec as unknown as ConstructorParameters<typeof MetahubObjectsService>[0],
        schemaService
    )

    beforeEach(() => {
        jest.clearAllMocks()
        mockEnsureSchema.mockResolvedValue('mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        mockQuery.mockResolvedValue([{ id: 'object-1' }])
    })

    it('soft-deletes only active metahub object rows', async () => {
        await service.delete('metahub-1', 'object-1', 'user-1')

        const [sql, params] = mockQuery.mock.calls[0]
        expect(sql).toContain('UPDATE "mhb_a1b2c3d4e5f67890abcdef1234567890_b1"."_mhb_objects"')
        expect(sql).toContain('SET _mhb_deleted = TRUE')
        expect(sql).toContain('WHERE id = $3 AND _upl_deleted = false AND _mhb_deleted = false')
        expect(sql).toContain('RETURNING id')
        expect(params[1]).toBe('user-1')
        expect(params[2]).toBe('object-1')
    })

    it('fails closed when soft delete touches no active rows', async () => {
        mockQuery.mockResolvedValueOnce([])

        await expect(service.delete('metahub-1', 'missing-object', 'user-1')).rejects.toThrow(
            'Object missing-object not found while soft deleting metahub object'
        )
    })

    it('restores only metahub object rows that are currently in trash', async () => {
        await service.restore('metahub-1', 'object-1', 'user-1')

        const [sql, params] = mockQuery.mock.calls[0]
        expect(sql).toContain('SET _mhb_deleted = FALSE')
        expect(sql).toContain('WHERE id = $3 AND _upl_deleted = false AND _mhb_deleted = true')
        expect(sql).toContain('RETURNING id')
        expect(params[1]).toBe('user-1')
        expect(params[2]).toBe('object-1')
    })

    it('fails closed when restore touches no deleted rows', async () => {
        mockQuery.mockResolvedValueOnce([])

        await expect(service.restore('metahub-1', 'missing-object', 'user-1')).rejects.toThrow(
            'Object missing-object not found while restoring metahub object'
        )
    })

    it('permanently deletes only rows that still exist in the metahub schema', async () => {
        await service.permanentDelete('metahub-1', 'object-1', 'user-1')

        const [sql, params] = mockQuery.mock.calls[0]
        expect(sql).toContain('DELETE FROM "mhb_a1b2c3d4e5f67890abcdef1234567890_b1"."_mhb_objects"')
        expect(sql).toContain('WHERE id = $1 AND _upl_deleted = false')
        expect(sql).toContain('RETURNING id')
        expect(params).toEqual(['object-1'])
    })

    it('fails closed when permanent delete touches no rows', async () => {
        mockQuery.mockResolvedValueOnce([])

        await expect(service.permanentDelete('metahub-1', 'missing-object', 'user-1')).rejects.toThrow(
            'Object missing-object not found while permanently deleting metahub object'
        )
    })
})