import { MetahubObjectsService } from '../../domains/metahubs/services/MetahubObjectsService'
import { MetahubNotFoundError } from '../../domains/shared/domainErrors'

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

    const service = new MetahubObjectsService(mockExec as unknown as ConstructorParameters<typeof MetahubObjectsService>[0], schemaService)

    beforeEach(() => {
        jest.clearAllMocks()
        mockEnsureSchema.mockResolvedValue('mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        mockQuery.mockResolvedValue([{ id: 'object-1' }])
    })

    it('soft-deletes only active metahub object rows', async () => {
        await service.delete('metahub-1', 'object-1', 'user-1')

        const [sql, params] = mockQuery.mock.calls[1]
        expect(sql).toContain('UPDATE "mhb_a1b2c3d4e5f67890abcdef1234567890_b1"."_mhb_objects"')
        expect(sql).toContain('SET _mhb_deleted = TRUE')
        expect(sql).toContain('WHERE id = $3 AND _upl_deleted = false AND _mhb_deleted = false')
        expect(sql).toContain('RETURNING id')
        expect(params[1]).toBe('user-1')
        expect(params[2]).toBe('object-1')
    })

    it('fails closed when soft delete touches no active rows', async () => {
        mockQuery.mockResolvedValueOnce([{ id: 'missing-object', kind: 'catalog' }]).mockResolvedValueOnce([])

        await expect(service.delete('metahub-1', 'missing-object', 'user-1')).rejects.toThrow(MetahubNotFoundError)
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

        await expect(service.restore('metahub-1', 'missing-object', 'user-1')).rejects.toThrow(MetahubNotFoundError)
    })

    it('permanently deletes only rows that still exist in the metahub schema', async () => {
        await service.permanentDelete('metahub-1', 'object-1', 'user-1')

        const [sql, params] = mockQuery.mock.calls[1]
        expect(sql).toContain('DELETE FROM "mhb_a1b2c3d4e5f67890abcdef1234567890_b1"."_mhb_objects"')
        expect(sql).toContain('WHERE id = $1 AND _upl_deleted = false')
        expect(sql).toContain('RETURNING id')
        expect(params).toEqual(['object-1'])
    })

    it('fails closed when permanent delete touches no rows', async () => {
        mockQuery.mockResolvedValueOnce([{ id: 'missing-object', kind: 'catalog' }]).mockResolvedValueOnce([])

        await expect(service.permanentDelete('metahub-1', 'missing-object', 'user-1')).rejects.toThrow(MetahubNotFoundError)
    })

    it('omits undefined presentation and config fields when updating a catalog', async () => {
        const localizedName = {
            _schema: 'v1',
            _primary: 'en',
            locales: { en: { content: 'Products updated' } }
        }

        jest.spyOn(service, 'findById').mockResolvedValue({
            id: 'catalog-1',
            kind: 'catalog',
            codename: {
                _schema: 'v1',
                _primary: 'en',
                locales: { en: { content: 'Products' } }
            },
            presentation: {
                name: {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: { en: { content: 'Products' } }
                },
                description: undefined
            },
            config: {
                hubs: [],
                isSingleHub: false,
                isRequiredHub: false,
                runtimeConfig: undefined
            }
        } as never)

        mockQuery.mockResolvedValueOnce([{ id: 'catalog-1' }])

        await service.updateCatalog(
            'metahub-1',
            'catalog-1',
            {
                name: localizedName,
                config: {
                    hubs: [],
                    isSingleHub: false,
                    isRequiredHub: false,
                    sortOrder: 3,
                    runtimeConfig: undefined
                },
                updatedBy: 'user-1'
            },
            'user-1'
        )

        const [sql, params] = mockQuery.mock.calls[0]
        expect(sql).toContain('UPDATE "mhb_a1b2c3d4e5f67890abcdef1234567890_b1"."_mhb_objects"')
        expect(params[2]).toEqual({ name: localizedName })
        expect(params[3]).toEqual({ hubs: [], isSingleHub: false, isRequiredHub: false, sortOrder: 3 })
    })

    it('filters virtual shared containers out of standard object lists and counts', async () => {
        mockQuery.mockResolvedValueOnce([
            { id: 'catalog-1', kind: 'catalog', codename: { _primary: 'en', locales: { en: { content: 'catalog' } } } }
        ])

        await service.findAllByKind('metahub-1', 'catalog', 'user-1')
        await service.countByKind('metahub-1', 'catalog', 'user-1')

        expect(mockQuery.mock.calls[0][0]).toContain("COALESCE((config->>'isVirtualContainer')::boolean, false) = false")
        expect(mockQuery.mock.calls[1][0]).toContain("COALESCE((config->>'isVirtualContainer')::boolean, false) = false")
    })
})
