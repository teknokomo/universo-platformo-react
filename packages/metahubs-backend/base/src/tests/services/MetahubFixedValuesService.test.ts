const mockEnsureSchema = jest.fn()

import { MetahubFixedValuesService } from '../../domains/metahubs/services/MetahubFixedValuesService'

describe('MetahubFixedValuesService compatibility-aware blocker queries', () => {
    const schemaService = {
        ensureSchema: mockEnsureSchema
    } as any

    const mockExecQuery = jest.fn()
    const mockExec = {
        query: mockExecQuery,
        transaction: jest.fn(),
        isReleased: () => false
    }

    const service = new MetahubFixedValuesService(mockExec as any, schemaService)

    beforeEach(() => {
        jest.clearAllMocks()
        mockEnsureSchema.mockResolvedValue('mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        mockExecQuery.mockResolvedValue([])
    })

    it('matches compatible set target kinds when finding set reference blockers', async () => {
        await service.findSetReferenceBlockers('metahub-1', 'set-1', 'user-1', ['set', 'custom.value-group'])

        expect(mockExecQuery).toHaveBeenCalled()
        expect(mockExecQuery.mock.calls[0][0]).toContain('attr.target_object_kind = ANY($2::text[])')
        expect(mockExecQuery.mock.calls[0][1]).toEqual(['set-1', ['set', 'custom.value-group']])
    })

    it('matches compatible set target kinds when finding constant attribute blockers', async () => {
        await service.findAttributeReferenceBlockersByConstant('metahub-1', 'set-1', 'constant-1', 'user-1', ['set', 'custom.value-group'])

        expect(mockExecQuery).toHaveBeenCalled()
        expect(mockExecQuery.mock.calls[0][0]).toContain('target_object_kind = ANY($2::text[])')
        expect(mockExecQuery.mock.calls[0][1]).toEqual(['set-1', ['set', 'custom.value-group'], 'constant-1'])
    })
})
