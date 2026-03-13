const mockEnsureSchema = jest.fn()
const mockQuery = jest.fn()
const mockWithSchema = jest.fn()
const mockFrom = jest.fn()
const mockAndWhere = jest.fn()
const mockOrderBy = jest.fn()

let builderRows: any[] = []

const mockQueryBuilder: any = {
    andWhere: mockAndWhere,
    orderBy: mockOrderBy,
    then: (resolve: (rows: any[]) => unknown) => Promise.resolve(resolve(builderRows))
}

const mockKnex = {
    withSchema: mockWithSchema
}

jest.mock('../../domains/ddl', () => ({
    __esModule: true,
    KnexClient: {
        getInstance: () => mockKnex
    }
}))

import { MetahubAttributesService } from '../../domains/metahubs/services/MetahubAttributesService'

describe('MetahubAttributesService active-row filtering', () => {
    const schemaService = {
        ensureSchema: mockEnsureSchema,
        query: mockQuery
    } as any

    const service = new MetahubAttributesService(schemaService)

    beforeEach(() => {
        jest.clearAllMocks()
        mockEnsureSchema.mockResolvedValue('mhb_test_schema')
        mockQuery.mockResolvedValue([])
        builderRows = [
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
        ]
        mockWithSchema.mockReturnValue({ from: mockFrom })
        mockFrom.mockReturnValue(mockQueryBuilder)
        mockAndWhere.mockReturnValue(mockQueryBuilder)
        mockOrderBy.mockReturnValue(mockQueryBuilder)
    })

    it('adds branch active-row predicates to batch count reads', async () => {
        await service.countByObjectIds('metahub-1', ['object-1'], 'user-1')

        expect(mockQuery.mock.calls[0][0]).toContain('AND _upl_deleted = false AND _mhb_deleted = false')
        expect(mockQuery.mock.calls[0][1]).toEqual([['object-1']])
    })

    it('adds branch active-row predicates to child batch reads', async () => {
        await service.findChildAttributesByParentIds('metahub-1', ['parent-1'], 'user-1')

        expect(mockQuery.mock.calls[0][0]).toContain('AND _upl_deleted = false AND _mhb_deleted = false')
        expect(mockQuery.mock.calls[0][1]).toEqual([['parent-1']])
    })

    it('adds branch active-row predicates to attribute lookup by id', async () => {
        await service.findById('metahub-1', 'attr-1', 'user-1')

        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $1'), ['attr-1'])
        expect(mockQuery.mock.calls[0][0]).toContain('AND _upl_deleted = false AND _mhb_deleted = false')
    })

    it('adds branch active-row predicates to getAllAttributes query-builder reads', async () => {
        const result = await service.getAllAttributes('metahub-1', 'user-1')

        expect(mockWithSchema).toHaveBeenCalledWith('mhb_test_schema')
        expect(mockFrom).toHaveBeenCalledWith('_mhb_attributes')
        expect(mockAndWhere).toHaveBeenNthCalledWith(1, '_upl_deleted', false)
        expect(mockAndWhere).toHaveBeenNthCalledWith(2, '_mhb_deleted', false)
        expect(mockOrderBy).toHaveBeenNthCalledWith(1, 'sort_order', 'asc')
        expect(mockOrderBy).toHaveBeenNthCalledWith(2, '_upl_created_at', 'asc')
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