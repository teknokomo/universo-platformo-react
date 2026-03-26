const mockEnsureSchema = jest.fn()
const mockIncrementVersion = jest.fn()
const mockUpdateWithVersionCheck = jest.fn()

jest.mock('../../utils/optimisticLock', () => ({
    incrementVersion: (...args: unknown[]) => mockIncrementVersion(...args),
    updateWithVersionCheck: (...args: unknown[]) => mockUpdateWithVersionCheck(...args)
}))

import { MetahubEnumerationValuesService } from '../../domains/metahubs/services/MetahubEnumerationValuesService'

describe('MetahubEnumerationValuesService active-row filtering', () => {
    type MockTx = {
        query: typeof mockTxQuery
        transaction: jest.Mock
        isReleased: () => boolean
    }

    type MockExec = {
        query: typeof mockExecQuery
        transaction: jest.Mock
        isReleased: () => boolean
    }

    const schemaService = {
        ensureSchema: mockEnsureSchema
    } as unknown as ConstructorParameters<typeof MetahubEnumerationValuesService>[1]

    const mockExecQuery = jest.fn()
    const mockTxQuery = jest.fn()
    const mockTx: MockTx = {
        query: mockTxQuery,
        transaction: jest.fn(),
        isReleased: () => false
    }
    const mockExec: MockExec = {
        query: mockExecQuery,
        transaction: jest.fn(async (cb: (tx: MockTx) => Promise<unknown>) => cb(mockTx)),
        isReleased: () => false
    }

    const service = new MetahubEnumerationValuesService(
        mockExec as unknown as ConstructorParameters<typeof MetahubEnumerationValuesService>[0],
        schemaService
    )

    beforeEach(() => {
        jest.clearAllMocks()
        mockEnsureSchema.mockResolvedValue('mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        mockExecQuery.mockResolvedValue([])
        mockTxQuery.mockImplementation(async (sql: string) => {
            if (sql.includes('WITH ranked') || sql.includes('CREATE UNIQUE INDEX')) {
                return []
            }
            if (sql.includes('SELECT *') && sql.includes('WHERE id = $1')) {
                return [
                    {
                        id: 'value-1',
                        object_id: 'enum-1',
                        codename: 'open',
                        presentation: { name: { en: 'Open' }, description: null },
                        sort_order: 2,
                        is_default: true,
                        _upl_version: 1,
                        _upl_created_at: '2026-03-14T00:00:00.000Z',
                        _upl_updated_at: '2026-03-14T00:00:00.000Z'
                    }
                ]
            }
            if (sql.includes('SELECT id, sort_order')) {
                return [{ id: 'value-2', sort_order: 1 }]
            }
            return []
        })
        mockIncrementVersion.mockResolvedValue({
            id: 'value-1',
            object_id: 'enum-1',
            codename: 'open',
            presentation: { name: { en: 'Open' }, description: null },
            sort_order: 2,
            is_default: true,
            _upl_version: 2,
            _upl_created_at: '2026-03-14T00:00:00.000Z',
            _upl_updated_at: '2026-03-14T01:00:00.000Z'
        })
    })

    it('adds active-row predicates to lookup by id', async () => {
        await service.findById('metahub-1', 'value-1', 'user-1')

        expect(mockExecQuery).toHaveBeenCalledWith(
            expect.stringContaining('WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false'),
            ['value-1']
        )
    })

    it('returns the canonical codename JSONB on reads', async () => {
        mockExecQuery.mockResolvedValueOnce([
            {
                id: 'value-1',
                object_id: 'enum-1',
                codename: {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'open' },
                        ru: { content: 'otkryto' }
                    }
                },
                presentation: { name: { en: 'Open' }, description: null },
                sort_order: 2,
                is_default: true,
                _upl_version: 1,
                _upl_created_at: '2026-03-14T00:00:00.000Z',
                _upl_updated_at: '2026-03-14T00:00:00.000Z'
            }
        ])

        const result = await service.findById('metahub-1', 'value-1', 'user-1')

        expect(result).toMatchObject({
            codename: {
                _primary: 'en',
                locales: {
                    en: { content: 'open' },
                    ru: { content: 'otkryto' }
                }
            }
        })
    })

    it('stores codename only in the canonical column on create', async () => {
        mockTxQuery.mockImplementationOnce(async () => [])
        mockTxQuery.mockImplementationOnce(async () => [])
        mockTxQuery.mockImplementationOnce(async () => [])
        mockTxQuery.mockImplementationOnce(async (sql: string, params?: unknown[]) => {
            expect(sql).toContain('INSERT INTO')
            expect(sql).toContain('(object_id, codename, presentation, sort_order, is_default,')
            expect(sql).toContain('VALUES ($1, $2, $3, $4, $5, $6, $7, $6, $7)')
            expect(params?.[1]).toContain('"locales"')
            expect(params?.[2]).toBe(JSON.stringify({ name: { en: 'Open' }, description: undefined }))

            return [
                {
                    id: 'value-1',
                    object_id: 'enum-1',
                    codename: {
                        _schema: '1',
                        _primary: 'en',
                        locales: {
                            en: { content: 'open' }
                        }
                    },
                    presentation: { name: { en: 'Open' } },
                    sort_order: 1,
                    is_default: false,
                    _upl_version: 1,
                    _upl_created_at: '2026-03-14T00:00:00.000Z',
                    _upl_updated_at: '2026-03-14T00:00:00.000Z'
                }
            ]
        })

        await service.create(
            'metahub-1',
            {
                enumerationId: 'enum-1',
                codename: {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'open' },
                        ru: { content: 'otkryto' }
                    }
                },
                name: { en: 'Open' },
                sortOrder: 1,
                createdBy: 'user-1'
            },
            'user-1'
        )
    })

    it('fails closed on soft-deleted rows before update', async () => {
        await service.update('metahub-1', 'value-1', { codename: 'open-v2', updatedBy: 'user-1' }, 'user-1')

        expect(
            mockTxQuery.mock.calls.some((call) =>
                call[0].includes('WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false LIMIT 1')
            )
        ).toBe(true)
        expect(mockIncrementVersion).toHaveBeenCalledTimes(1)
        expect(mockUpdateWithVersionCheck).not.toHaveBeenCalled()
    })

    it('soft-deletes only active enumeration values instead of hard deleting them', async () => {
        await service.delete('metahub-1', 'value-1', 'user-1')

        expect(
            mockTxQuery.mock.calls.some((call) =>
                call[0].includes('WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false LIMIT 1')
            )
        ).toBe(true)
        expect(mockTxQuery.mock.calls.some((call) => call[0].includes('SET _mhb_deleted = true'))).toBe(true)
        expect(mockTxQuery.mock.calls.some((call) => call[0].includes('DELETE FROM'))).toBe(false)
    })
})
