const mockListEditableTypesInSchema = jest.fn()

jest.mock('../../domains/entities/services/EntityTypeService', () => ({
    __esModule: true,
    EntityTypeService: jest.fn().mockImplementation(() => ({
        listEditableTypesInSchema: (...args: unknown[]) => mockListEditableTypesInSchema(...args)
    }))
}))

import { MetahubSettingsService } from '../../domains/settings/services/MetahubSettingsService'

describe('MetahubSettingsService', () => {
    const mockEnsureSchema = jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')

    const createExec = (queryImpl?: (sql: string, params?: unknown[]) => Promise<unknown[]>) => ({
        query: jest.fn(queryImpl ?? (async () => [])),
        transaction: jest.fn(),
        isReleased: () => false
    })

    beforeEach(() => {
        jest.clearAllMocks()
        mockEnsureSchema.mockResolvedValue('mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        mockListEditableTypesInSchema.mockResolvedValue([])
    })

    it('clearHubNesting updates the direct standard hub kind on the unified settings surface', async () => {
        mockListEditableTypesInSchema.mockResolvedValue([
            {
                kindKey: 'custom.workspace-hub',
                config: { compatibility: { legacyObjectKind: 'hub' } }
            }
        ])

        const exec = createExec(async () => [{ id: 'hub-1' }, { id: 'hub-2' }])
        const service = new MetahubSettingsService(exec as never, { ensureSchema: mockEnsureSchema } as never)

        const cleared = await service.clearHubNesting('metahub-1', 'test-user-id')

        expect(cleared).toBe(2)
        expect(exec.query).toHaveBeenCalledWith(expect.stringContaining('WHERE kind = ANY($3::text[])'), [
            expect.any(Date),
            'test-user-id',
            ['hub']
        ])
    })

    it('hasHubNesting checks the direct standard hub kind on the unified settings surface', async () => {
        mockListEditableTypesInSchema.mockResolvedValue([
            {
                kindKey: 'custom.workspace-hub',
                config: { compatibility: { legacyObjectKind: 'hub' } }
            }
        ])

        const exec = createExec(async () => [{ total: '1' }])
        const service = new MetahubSettingsService(exec as never, { ensureSchema: mockEnsureSchema } as never)

        await expect(service.hasHubNesting('metahub-1', 'test-user-id')).resolves.toBe(true)
        expect(exec.query).toHaveBeenCalledWith(expect.stringContaining('WHERE kind = ANY($1::text[])'), [['hub']])
    })
})
