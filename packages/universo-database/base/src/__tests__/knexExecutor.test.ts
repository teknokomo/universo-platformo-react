import { createKnexExecutor, createRlsExecutor } from '../knexExecutor'

// ─── helpers ────────────────────────────────────────────────────────────────

function createMockKnex() {
    const rawFn = jest.fn()
    const connectionFn = jest.fn()

    // knex.raw(sql, params) — returns { rows }
    rawFn.mockImplementation(() => ({
        rows: [],
        connection: connectionFn.mockImplementation(() => Promise.resolve({ rows: [] }))
    }))

    // knex.transaction(cb) — executes cb with a trx that has .raw()
    const txRawFn = jest.fn().mockImplementation(() => Promise.resolve({ rows: [] }))
    const transactionFn = jest.fn().mockImplementation(async (cb: any) => {
        const trx = { raw: txRawFn }
        return cb(trx)
    })

    const knex: any = {
        raw: rawFn,
        transaction: transactionFn
    }

    return { knex, rawFn, connectionFn, transactionFn, txRawFn }
}

function createMockRlsKnex() {
    const connectionFn = jest.fn().mockImplementation(() => Promise.resolve({ rows: [] }))
    const rawFn = jest.fn().mockImplementation(() => ({
        rows: [],
        connection: connectionFn
    }))

    const knex: any = { raw: rawFn }
    const connection = Symbol('pinned-connection')

    return { knex, rawFn, connectionFn, connection }
}

// ─── createKnexExecutor ─────────────────────────────────────────────────────

describe('createKnexExecutor', () => {
    it('returns an executor with query, transaction, isReleased', () => {
        const { knex } = createMockKnex()
        const executor = createKnexExecutor(knex)

        expect(executor.query).toBeInstanceOf(Function)
        expect(executor.transaction).toBeInstanceOf(Function)
        expect(executor.isReleased).toBeInstanceOf(Function)
        expect(executor.isReleased()).toBe(false)
    })

    it('query delegates to knex.raw and returns rows', async () => {
        const { knex, rawFn } = createMockKnex()
        rawFn.mockReturnValue({ rows: [{ id: '1' }, { id: '2' }] })

        const executor = createKnexExecutor(knex)
        const result = await executor.query<{ id: string }>('SELECT 1', ['param'])

        // No $N placeholders → params pass through unchanged
        expect(rawFn).toHaveBeenCalledWith('SELECT 1', ['param'])
        expect(result).toEqual([{ id: '1' }, { id: '2' }])
    })

    it('query returns result directly when rows is undefined', async () => {
        const { knex, rawFn } = createMockKnex()
        rawFn.mockReturnValue([{ a: 1 }])

        const executor = createKnexExecutor(knex)
        const result = await executor.query('SELECT 1')

        expect(result).toEqual([{ a: 1 }])
    })

    it('transaction uses knex.transaction and provides a txExecutor', async () => {
        const { knex, transactionFn, txRawFn } = createMockKnex()
        txRawFn.mockReturnValue({ rows: [{ n: 42 }] })

        const executor = createKnexExecutor(knex)
        const result = await executor.transaction(async (tx) => {
            const rows = await tx.query<{ n: number }>('SELECT 42 AS n')
            return rows[0].n
        })

        expect(transactionFn).toHaveBeenCalled()
        expect(result).toBe(42)
    })

    it('nested transaction reuses the same transaction executor', async () => {
        const { knex, txRawFn } = createMockKnex()
        txRawFn.mockReturnValue({ rows: [] })

        const executor = createKnexExecutor(knex)
        await executor.transaction(async (tx) => {
            await tx.transaction(async (innerTx) => {
                await innerTx.query('SELECT 1')
            })
        })

        // Inner transaction should call txRawFn directly (no new knex.transaction)
        // convertPgBindings(sql, undefined) returns bindings: [] which is passed as empty array
        expect(txRawFn).toHaveBeenCalledWith('SELECT 1', [])
    })
})

// ─── createRlsExecutor ─────────────────────────────────────────────────────

describe('createRlsExecutor', () => {
    it('returns an executor with query, transaction, isReleased', () => {
        const { knex, connection } = createMockRlsKnex()
        const executor = createRlsExecutor(knex, connection)

        expect(executor.query).toBeInstanceOf(Function)
        expect(executor.transaction).toBeInstanceOf(Function)
        expect(executor.isReleased).toBeInstanceOf(Function)
        expect(executor.isReleased()).toBe(false)
    })

    it('query uses pinned connection via knex.raw().connection()', async () => {
        const { knex, rawFn, connectionFn, connection } = createMockRlsKnex()
        connectionFn.mockResolvedValue({ rows: [{ id: 'a' }] })

        const executor = createRlsExecutor(knex, connection)
        const result = await executor.query<{ id: string }>('SELECT $1', ['val'])

        // $1 is converted to ? by convertPgBindings
        expect(rawFn).toHaveBeenCalledWith('SELECT ?', ['val'])
        expect(connectionFn).toHaveBeenCalledWith(connection)
        expect(result).toEqual([{ id: 'a' }])
    })

    it('transaction issues BEGIN/COMMIT on pinned connection', async () => {
        const { knex, rawFn, connectionFn, connection } = createMockRlsKnex()

        const executor = createRlsExecutor(knex, connection)
        await executor.transaction(async (tx) => {
            await tx.query('INSERT INTO t VALUES ($1)', ['x'])
        })

        const rawCalls = rawFn.mock.calls.map((c: any) => c[0])
        expect(rawCalls).toContain('BEGIN')
        // $1 is converted to ? by convertPgBindings
        expect(rawCalls).toContain('INSERT INTO t VALUES (?)')
        expect(rawCalls).toContain('COMMIT')

        // All calls should use the pinned connection
        for (const call of connectionFn.mock.calls) {
            expect(call[0]).toBe(connection)
        }
    })

    it('transaction issues ROLLBACK on error', async () => {
        const { knex, rawFn, connectionFn, connection } = createMockRlsKnex()

        const executor = createRlsExecutor(knex, connection)
        await expect(
            executor.transaction(async () => {
                throw new Error('boom')
            })
        ).rejects.toThrow('boom')

        const rawCalls = rawFn.mock.calls.map((c: any) => c[0])
        expect(rawCalls).toContain('BEGIN')
        expect(rawCalls).toContain('ROLLBACK')
        expect(rawCalls).not.toContain('COMMIT')

        for (const call of connectionFn.mock.calls) {
            expect(call[0]).toBe(connection)
        }
    })

    it('nested transaction uses SAVEPOINT / RELEASE SAVEPOINT', async () => {
        const { knex, rawFn, connectionFn, connection } = createMockRlsKnex()

        const executor = createRlsExecutor(knex, connection)
        await executor.transaction(async (tx) => {
            await tx.transaction(async (innerTx) => {
                await innerTx.query('SELECT 1')
            })
        })

        const rawCalls = rawFn.mock.calls.map((c: any) => c[0])
        expect(rawCalls).toEqual(['BEGIN', 'SAVEPOINT rls_sp_2', 'SELECT 1', 'RELEASE SAVEPOINT rls_sp_2', 'COMMIT'])

        for (const call of connectionFn.mock.calls) {
            expect(call[0]).toBe(connection)
        }
    })

    it('nested transaction rollback uses ROLLBACK TO SAVEPOINT', async () => {
        const { knex, rawFn, connectionFn, connection } = createMockRlsKnex()

        const executor = createRlsExecutor(knex, connection)
        await executor.transaction(async (tx) => {
            await tx
                .transaction(async () => {
                    throw new Error('inner fail')
                })
                .catch(() => {
                    /* swallow to test outer still commits */
                })
        })

        const rawCalls = rawFn.mock.calls.map((c: any) => c[0])
        expect(rawCalls).toContain('SAVEPOINT rls_sp_2')
        expect(rawCalls).toContain('ROLLBACK TO SAVEPOINT rls_sp_2')
        expect(rawCalls).toContain('COMMIT')
        expect(rawCalls).not.toContain('ROLLBACK')

        for (const call of connectionFn.mock.calls) {
            expect(call[0]).toBe(connection)
        }
    })

    it('txDepth resets after transaction completes', async () => {
        const { knex, rawFn, connectionFn, connection } = createMockRlsKnex()

        const executor = createRlsExecutor(knex, connection)

        // First transaction
        await executor.transaction(async () => {})
        // Second transaction — should use BEGIN again (not SAVEPOINT)
        await executor.transaction(async () => {})

        const rawCalls = rawFn.mock.calls.map((c: any) => c[0])
        const beginCount = rawCalls.filter((c: string) => c === 'BEGIN').length
        const commitCount = rawCalls.filter((c: string) => c === 'COMMIT').length
        expect(beginCount).toBe(2)
        expect(commitCount).toBe(2)

        for (const call of connectionFn.mock.calls) {
            expect(call[0]).toBe(connection)
        }
    })
})
