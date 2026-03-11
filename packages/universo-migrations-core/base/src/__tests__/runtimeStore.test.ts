import { hasRuntimeHistoryTable, listRuntimeHistory, getLastApplied } from '../runtimeStore'

// ---------------------------------------------------------------------------
// Knex mock helpers
// ---------------------------------------------------------------------------

type StoredRow = Record<string, unknown>

/**
 * Build a minimal Knex-like mock that exposes `.schema.withSchema().hasTable()`
 * and `.withSchema().from().select/count/orderBy/limit/offset/first()`.
 */
function createMockKnex(options?: { tableExists?: boolean; rows?: StoredRow[] }) {
    const tableExists = options?.tableExists ?? false
    const storedRows: StoredRow[] = options?.rows ?? []

    // --------------- schema builder ------------------
    const schemaBuilder = {
        hasTable: jest.fn(async () => tableExists)
    }

    const schema = {
        withSchema: jest.fn(() => schemaBuilder)
    }

    // --------------- query builder ------------------
    const createQueryBuilder = () => {
        let selectedColumns: string[] | null = null

        const qb = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn((...cols: string[]) => {
                selectedColumns = cols
                return qb
            }),
            count: jest.fn(() => {
                const countResult = { count: String(storedRows.length) }
                // `.count().first()` pattern
                return {
                    first: jest.fn(async () => countResult)
                }
            }),
            orderBy: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            offset: jest.fn().mockReturnThis(),
            // Terminal — resolve rows (respects limit/offset set via jest tracking)
            then: jest.fn((resolve: (v: StoredRow[]) => void) => {
                // Return a copy of stored rows (the real knex would apply limit/offset
                // at SQL level — here we just return all rows for assertion purposes)
                const projected = storedRows.map((row) => {
                    if (!selectedColumns) return row
                    const out: StoredRow = {}
                    for (const col of selectedColumns) {
                        out[col] = row[col]
                    }
                    return out
                })
                return resolve(projected)
            })
        }

        return qb
    }

    const knex = Object.assign(jest.fn(), {
        schema,
        withSchema: jest.fn(() => {
            const qb = createQueryBuilder()
            return qb
        })
    })

    return { knex, schemaBuilder }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('hasRuntimeHistoryTable', () => {
    it('returns true when the table exists', async () => {
        const { knex } = createMockKnex({ tableExists: true })
        const result = await hasRuntimeHistoryTable(knex as never, 'mhb_abc', '_mhb_migrations')

        expect(result).toBe(true)
        expect(knex.schema.withSchema).toHaveBeenCalledWith('mhb_abc')
    })

    it('returns false when the table does not exist', async () => {
        const { knex } = createMockKnex({ tableExists: false })
        const result = await hasRuntimeHistoryTable(knex as never, 'mhb_abc', '_mhb_migrations')

        expect(result).toBe(false)
    })
})

describe('listRuntimeHistory', () => {
    it('returns empty result when the table does not exist', async () => {
        const { knex } = createMockKnex({ tableExists: false })

        const result = await listRuntimeHistory(knex as never, 'mhb_abc', '_mhb_migrations')

        expect(result).toEqual({ records: [], total: 0 })
    })

    it('returns mapped records when the table exists', async () => {
        const now = new Date()
        const rows: StoredRow[] = [
            { id: 'r1', name: 'mig_001', applied_at: now.toISOString(), meta: JSON.stringify({ foo: 'bar' }) },
            { id: 'r2', name: 'mig_002', applied_at: now.toISOString(), meta: { baz: 42 } }
        ]
        const { knex } = createMockKnex({ tableExists: true, rows })

        const result = await listRuntimeHistory(knex as never, 'mhb_abc', '_mhb_migrations')

        expect(result.total).toBe(2)
        expect(result.records).toHaveLength(2)
        expect(result.records[0]).toEqual({
            id: 'r1',
            name: 'mig_001',
            appliedAt: expect.any(Date),
            meta: { foo: 'bar' }
        })
        // When meta is already an object (not a string), it should pass through
        expect(result.records[1]?.meta).toEqual({ baz: 42 })
    })

    it('handles null meta gracefully', async () => {
        const rows: StoredRow[] = [{ id: 'r1', name: 'mig_001', applied_at: new Date().toISOString(), meta: null }]
        const { knex } = createMockKnex({ tableExists: true, rows })

        const result = await listRuntimeHistory(knex as never, 'mhb_abc', '_mhb_migrations')

        expect(result.records[0]?.meta).toEqual({})
    })

    it('selects custom columns when specified', async () => {
        const rows: StoredRow[] = [
            {
                id: 'r1',
                name: 'mig_001',
                applied_at: new Date().toISOString(),
                meta: null,
                from_version: '1',
                to_version: '2'
            }
        ]
        const { knex } = createMockKnex({ tableExists: true, rows })

        await listRuntimeHistory(knex as never, 'mhb_abc', '_mhb_migrations', {
            columns: ['id', 'name', 'applied_at', 'meta', 'from_version', 'to_version']
        })

        // Verify withSchema was called with the correct schema
        expect(knex.withSchema).toHaveBeenCalledWith('mhb_abc')
    })
})

describe('getLastApplied', () => {
    it('returns null when the table does not exist', async () => {
        const { knex } = createMockKnex({ tableExists: false })

        const result = await getLastApplied(knex as never, 'mhb_abc', '_mhb_migrations')

        expect(result).toBeNull()
    })

    it('returns the first record from listRuntimeHistory', async () => {
        const rows: StoredRow[] = [
            { id: 'r1', name: 'mig_latest', applied_at: new Date().toISOString(), meta: JSON.stringify({}) }
        ]
        const { knex } = createMockKnex({ tableExists: true, rows })

        const result = await getLastApplied(knex as never, 'mhb_abc', '_mhb_migrations')

        expect(result).not.toBeNull()
        expect(result?.name).toBe('mig_latest')
    })

    it('returns null when the table exists but is empty', async () => {
        const { knex } = createMockKnex({ tableExists: true, rows: [] })

        const result = await getLastApplied(knex as never, 'mhb_abc', '_mhb_migrations')

        expect(result).toBeNull()
    })
})
