const mockEnsureSchema = jest.fn()

import { MetahubAttributesService } from '../../domains/metahubs/services/MetahubAttributesService'

describe('MetahubAttributesService active-row filtering', () => {
    const schemaService = {
        ensureSchema: mockEnsureSchema
    } as any

    const mockExecQuery = jest.fn()
    const mockExec = {
        query: mockExecQuery,
        transaction: jest.fn(),
        isReleased: () => false
    }

    const service = new MetahubAttributesService(mockExec as any, schemaService)

    beforeEach(() => {
        jest.clearAllMocks()
        mockEnsureSchema.mockResolvedValue('mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        mockExecQuery.mockResolvedValue([])
    })

    it('adds branch active-row predicates to batch count reads', async () => {
        await service.countByObjectIds('metahub-1', ['object-1'], 'user-1')

        expect(mockExecQuery.mock.calls[0][0]).toContain('AND _upl_deleted = false AND _mhb_deleted = false')
        expect(mockExecQuery.mock.calls[0][1]).toEqual([['object-1']])
    })

    it('adds branch active-row predicates to child batch reads', async () => {
        await service.findChildAttributesByParentIds('metahub-1', ['parent-1'], 'user-1')

        expect(mockExecQuery.mock.calls[0][0]).toContain('AND _upl_deleted = false AND _mhb_deleted = false')
        expect(mockExecQuery.mock.calls[0][1]).toEqual([['parent-1']])
    })

    it('adds branch active-row predicates to attribute lookup by id', async () => {
        await service.findById('metahub-1', 'attr-1', 'user-1')

        expect(mockExecQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $1'), ['attr-1'])
        expect(mockExecQuery.mock.calls[0][0]).toContain('AND _upl_deleted = false AND _mhb_deleted = false')
    })

    it('adds branch active-row predicates to getAllAttributes reads', async () => {
        mockExecQuery.mockResolvedValueOnce([
            {
                id: 'attr-1',
                object_id: 'object-1',
                codename: 'name',
                presentation: { name: { en: 'Name' } },
                data_type: 'STRING',
                is_required: true,
                is_display_attribute: false,
                target_object_id: null,
                target_object_kind: null,
                target_constant_id: null,
                parent_attribute_id: null,
                sort_order: 1,
                validation_rules: null,
                ui_config: null,
                _upl_version: 1,
                _upl_created_at: '2026-03-13T00:00:00.000Z',
                _upl_updated_at: '2026-03-13T00:00:00.000Z'
            }
        ])

        const result = await service.getAllAttributes('metahub-1', 'user-1')

        expect(mockExecQuery.mock.calls[0][0]).toContain('_upl_deleted = false AND _mhb_deleted = false')
        expect(mockExecQuery.mock.calls[0][0]).toContain('ORDER BY sort_order ASC')
        expect(result).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'attr-1',
                    catalogId: 'object-1',
                    codename: 'name'
                })
            ])
        )
    })
})
