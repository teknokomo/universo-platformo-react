import { createKnexExecutor, createRlsExecutor } from '../knexExecutor'
import { createRlsOperationScope, runInRlsOperationScope } from '../rlsOperationScope'
import { createMockRlsKnex } from './knexExecutorTestUtils'

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
    const transactionFn = jest.fn(async (cb: (trx: { raw: typeof txRawFn }) => Promise<unknown>) => {
        const trx = { raw: txRawFn }
        return cb(trx)
    })

    const knex = {
        raw: rawFn,
        transaction: transactionFn
    } as unknown as Parameters<typeof createKnexExecutor>[0]

    return { knex, rawFn, connectionFn, transactionFn, txRawFn }
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

        const rawCalls = rawFn.mock.calls.map((call) => call[0])
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

        const rawCalls = rawFn.mock.calls.map((call) => call[0])
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

        const rawCalls = rawFn.mock.calls.map((call) => call[0])
        expect(rawCalls).toEqual(['BEGIN', 'SAVEPOINT rls_sp_2', 'SELECT 1', 'RELEASE SAVEPOINT rls_sp_2', 'COMMIT'])

        for (const call of connectionFn.mock.calls) {
            expect(call[0]).toBe(connection)
        }
    })

    it('nested transaction rollback uses ROLLBACK TO SAVEPOINT', async () => {
        const { knex, rawFn, connectionFn, connection } = createMockRlsKnex()

        const executor = createRlsExecutor(knex, connection)
        await expect(
            executor.transaction(async (tx) => {
                await tx
                    .transaction(async () => {
                        throw new Error('inner fail')
                    })
                    .catch(() => undefined)
            })
        ).rejects.toThrow('inner fail')

        const rawCalls = rawFn.mock.calls.map((call) => call[0])
        expect(rawCalls).toContain('SAVEPOINT rls_sp_2')
        expect(rawCalls).toContain('ROLLBACK TO SAVEPOINT rls_sp_2')
        expect(rawCalls).toContain('ROLLBACK')
        expect(rawCalls).not.toContain('COMMIT')

        for (const call of connectionFn.mock.calls) {
            expect(call[0]).toBe(connection)
        }
    })

    it('serializes parallel nested savepoints so a failed sibling cannot roll back a completed sibling', async () => {
        const { knex, rawFn, connectionFn, connection } = createMockRlsKnex()
        let releaseFirstQuery!: () => void
        let markFirstQueryStarted!: () => void
        let markSecondTransactionStarted!: () => void
        let releaseSecondTransaction!: () => void
        let secondTransactionStarted = false
        const firstQueryBarrier = new Promise<void>((resolve) => {
            releaseFirstQuery = resolve
        })
        const firstQueryStarted = new Promise<void>((resolve) => {
            markFirstQueryStarted = resolve
        })
        const secondTransactionBarrier = new Promise<void>((resolve) => {
            releaseSecondTransaction = resolve
        })
        const secondTransactionStartedSignal = new Promise<void>((resolve) => {
            markSecondTransactionStarted = resolve
        })
        rawFn.mockImplementation((sql: string) => ({
            rows: [],
            connection: async (pinnedConnection: unknown) => {
                connectionFn(pinnedConnection)
                if (sql === "SELECT 'first sibling'") {
                    markFirstQueryStarted()
                    await firstQueryBarrier
                }
                return { rows: [] }
            }
        }))
        const executor = createRlsExecutor(knex, connection)

        await expect(
            executor.transaction(async (tx) => {
                const firstTransaction = tx.transaction(async (firstTx) => {
                    await firstTx.query("SELECT 'first sibling'")
                })
                await firstQueryStarted

                const secondTransaction = tx
                    .transaction(async () => {
                        secondTransactionStarted = true
                        markSecondTransactionStarted()
                        await secondTransactionBarrier
                        throw new Error('Second sibling failed')
                    })
                    .catch((error: unknown) => error)

                await new Promise<void>((resolve) => setImmediate(resolve))
                expect(secondTransactionStarted).toBe(false)

                releaseFirstQuery()
                await firstTransaction
                await secondTransactionStartedSignal
                releaseSecondTransaction()
                await expect(secondTransaction).resolves.toEqual(new Error('Second sibling failed'))
            })
        ).rejects.toThrow('Second sibling failed')

        expect(rawFn.mock.calls.map((call) => call[0])).toEqual([
            'BEGIN',
            'SAVEPOINT rls_sp_2',
            "SELECT 'first sibling'",
            'RELEASE SAVEPOINT rls_sp_2',
            'SAVEPOINT rls_sp_2',
            'ROLLBACK TO SAVEPOINT rls_sp_2',
            'ROLLBACK'
        ])
        expect(connectionFn).toHaveBeenCalledWith(connection)
    })

    it('fences parent-scope queries until a failing nested savepoint has rolled back', async () => {
        const { knex, rawFn, connection } = createMockRlsKnex()
        let markNestedTransactionStarted!: () => void
        let releaseNestedTransaction!: () => void
        const nestedTransactionStarted = new Promise<void>((resolve) => {
            markNestedTransactionStarted = resolve
        })
        const nestedTransactionBarrier = new Promise<void>((resolve) => {
            releaseNestedTransaction = resolve
        })
        const executor = createRlsExecutor(knex, connection, { inTransaction: true })
        let parentQuery!: Promise<unknown[]>
        let requestQuery!: Promise<unknown[]>

        const transaction = executor.transaction(async (tx) => {
            const nestedTransaction = tx.transaction(async () => {
                markNestedTransactionStarted()
                await nestedTransactionBarrier
                throw new Error('nested savepoint failed')
            })
            await nestedTransactionStarted
            parentQuery = tx.query('SELECT parent-scope query')
            requestQuery = executor.query('SELECT request-scope query')
            await new Promise<void>((resolve) => setImmediate(resolve))
            expect(rawFn.mock.calls.map((call) => call[0])).toEqual(['SAVEPOINT rls_sp_2'])

            releaseNestedTransaction()
            await expect(nestedTransaction).rejects.toThrow('nested savepoint failed')
            await parentQuery
        })

        await expect(transaction).rejects.toThrow('nested savepoint failed')
        await requestQuery

        expect(rawFn.mock.calls.map((call) => call[0])).toEqual([
            'SAVEPOINT rls_sp_2',
            'ROLLBACK TO SAVEPOINT rls_sp_2',
            'SELECT parent-scope query',
            'SELECT request-scope query'
        ])
    })

    it('fences request-session queries behind a failing nested savepoint', async () => {
        const { knex, rawFn, connection } = createMockRlsKnex()
        let requestScope!: ReturnType<typeof createRlsOperationScope>
        let markNestedStarted!: () => void
        let releaseNested!: () => void
        const nestedStarted = new Promise<void>((resolve) => {
            markNestedStarted = resolve
        })
        const nestedBarrier = new Promise<void>((resolve) => {
            releaseNested = resolve
        })
        const executor = createRlsExecutor(knex, connection, {
            inTransaction: true,
            onRequestScopeCreated: (scope) => {
                requestScope = scope
            }
        })

        await expect(
            executor.transaction(async (tx) => {
                const nested = tx.transaction(async () => {
                    markNestedStarted()
                    await nestedBarrier
                    throw new Error('nested savepoint failed')
                })
                await nestedStarted

                const sessionQuery = runInRlsOperationScope(requestScope, async () => {
                    const result = await knex.raw('SELECT request session query', []).connection(connection)
                    return result.rows ?? result
                })
                await new Promise<void>((resolve) => setImmediate(resolve))
                expect(rawFn.mock.calls.map((call) => call[0])).toEqual(['SAVEPOINT rls_sp_2'])

                releaseNested()
                await expect(nested).rejects.toThrow('nested savepoint failed')
                await expect(sessionQuery).resolves.toEqual([])
            })
        ).rejects.toThrow('nested savepoint failed')

        expect(rawFn.mock.calls.map((call) => call[0])).toEqual([
            'SAVEPOINT rls_sp_2',
            'ROLLBACK TO SAVEPOINT rls_sp_2',
            'SELECT request session query'
        ])
    })

    it('fails the request transaction after a session SQL failure rolls back its savepoint', async () => {
        const { knex, rawFn, connection } = createMockRlsKnex()
        const failure = new Error('session query failed inside savepoint')
        rawFn.mockImplementation((sql: string) => ({
            connection: () => (sql === 'SELECT session failure' ? Promise.reject(failure) : Promise.resolve({ rows: [] }))
        }))
        let requestScope!: ReturnType<typeof createRlsOperationScope>
        const onOuterTransactionFailure = jest.fn()
        const executor = createRlsExecutor(knex, connection, {
            inTransaction: true,
            onOuterTransactionFailure,
            onRequestScopeCreated: (scope) => {
                requestScope = scope
            }
        })

        await expect(
            executor.transaction(async (tx) => {
                await expect(
                    tx.transaction(async () =>
                        runInRlsOperationScope(requestScope, async () => {
                            const result = await knex.raw('SELECT session failure', []).connection(connection)
                            return result.rows ?? result
                        })
                    )
                ).rejects.toBe(failure)
                await tx.query('SELECT parent must not continue')
            })
        ).rejects.toBe(failure)

        expect(rawFn.mock.calls.map((call) => call[0])).toEqual([
            'SAVEPOINT rls_sp_2',
            'SELECT session failure',
            'ROLLBACK TO SAVEPOINT rls_sp_2',
            'SELECT parent must not continue'
        ])
        expect(onOuterTransactionFailure).not.toHaveBeenCalled()
    })

    it('serializes concurrent top-level transactions on the pinned connection', async () => {
        const { knex, rawFn, connection, connectionFn } = createMockRlsKnex()
        let releaseFirstTransaction!: () => void
        let markFirstTransactionStarted!: () => void
        let markSecondTransactionStarted!: () => void
        let secondTransactionStarted = false
        const firstTransactionBarrier = new Promise<void>((resolve) => {
            releaseFirstTransaction = resolve
        })
        const firstTransactionStarted = new Promise<void>((resolve) => {
            markFirstTransactionStarted = resolve
        })
        const secondTransactionStartedSignal = new Promise<void>((resolve) => {
            markSecondTransactionStarted = resolve
        })
        const executor = createRlsExecutor(knex, connection)

        const firstTransaction = executor.transaction(async (tx) => {
            markFirstTransactionStarted()
            await firstTransactionBarrier
            await tx.query("SELECT 'first root transaction'")
        })
        await firstTransactionStarted

        const secondTransaction = executor.transaction(async (tx) => {
            secondTransactionStarted = true
            markSecondTransactionStarted()
            await tx.query("SELECT 'second root transaction'")
        })
        await new Promise<void>((resolve) => setImmediate(resolve))
        expect(secondTransactionStarted).toBe(false)

        releaseFirstTransaction()
        await firstTransaction
        await secondTransactionStartedSignal
        await secondTransaction

        expect(rawFn.mock.calls.map((call) => call[0])).toEqual([
            'BEGIN',
            "SELECT 'first root transaction'",
            'COMMIT',
            'BEGIN',
            "SELECT 'second root transaction'",
            'COMMIT'
        ])
        expect(connectionFn).toHaveBeenCalledWith(connection)
    })

    it('drains a top-level transaction admitted before lease closure while it waits in the queue', async () => {
        const { knex, rawFn, connection } = createMockRlsKnex()
        let leaseClosed = false
        let admittedOperations = 0
        let markFirstTransactionStarted!: () => void
        let markSecondOperationAdmitted!: () => void
        let releaseFirstTransaction!: () => void
        const firstTransactionStarted = new Promise<void>((resolve) => {
            markFirstTransactionStarted = resolve
        })
        const secondOperationAdmitted = new Promise<void>((resolve) => {
            markSecondOperationAdmitted = resolve
        })
        const firstTransactionBarrier = new Promise<void>((resolve) => {
            releaseFirstTransaction = resolve
        })
        const executor = createRlsExecutor(knex, connection, {
            inTransaction: true,
            isConnectionUnavailable: () => leaseClosed,
            runWithConnectionLease: async (operation) => {
                if (leaseClosed) throw new Error('RLS connection lease is closed')
                admittedOperations += 1
                if (admittedOperations === 2) markSecondOperationAdmitted()
                try {
                    return await operation()
                } finally {
                    admittedOperations -= 1
                }
            }
        })

        const firstTransaction = executor.transaction(async (tx) => {
            markFirstTransactionStarted()
            await firstTransactionBarrier
            await tx.query("SELECT 'first queued sibling'")
        })
        await firstTransactionStarted

        const secondTransaction = executor.transaction(async (tx) => {
            await tx.query("SELECT 'second queued sibling'")
        })
        await secondOperationAdmitted
        leaseClosed = true

        await expect(executor.transaction(async () => undefined)).rejects.toThrow('RLS connection lease is closed')
        releaseFirstTransaction()
        await Promise.all([firstTransaction, secondTransaction])

        expect(rawFn.mock.calls.map((call) => call[0])).toEqual(["SELECT 'first queued sibling'", "SELECT 'second queued sibling'"])
        expect(admittedOperations).toBe(0)
    })

    it('rolls back the outer transaction after a nested savepoint failure even when its promise is caught', async () => {
        const { knex, rawFn, connection, connectionFn } = createMockRlsKnex()
        let resolveNestedWork!: () => void
        let markNestedTransactionStarted!: () => void
        const nestedWorkBarrier = new Promise<void>((resolve) => {
            resolveNestedWork = resolve
        })
        const nestedTransactionStarted = new Promise<void>((resolve) => {
            markNestedTransactionStarted = resolve
        })
        const executor = createRlsExecutor(knex, connection)

        const outerTransaction = executor.transaction(async (tx) => {
            void tx
                .transaction(async () => {
                    markNestedTransactionStarted()
                    await nestedWorkBarrier
                    throw new Error('Handled nested transaction failure')
                })
                .catch(() => undefined)
            await nestedTransactionStarted
            return 'outer transaction remains valid'
        })
        await nestedTransactionStarted
        resolveNestedWork()

        await expect(outerTransaction).rejects.toThrow('Handled nested transaction failure')
        const rawCalls = rawFn.mock.calls.map((call) => call[0])
        expect(rawCalls).toEqual(['BEGIN', 'SAVEPOINT rls_sp_2', 'ROLLBACK TO SAVEPOINT rls_sp_2', 'ROLLBACK'])
        expect(connectionFn).toHaveBeenCalledTimes(4)
    })

    it('returns a native Promise and fails the parent after a recovered then/catch chain', async () => {
        const { knex, rawFn } = createMockRlsKnex()
        const failure = new Error('recovered chained savepoint failure')
        rawFn.mockImplementation((sql: string) => ({
            connection: () => (sql === 'SELECT chained failure' ? Promise.reject(failure) : Promise.resolve({ rows: [] }))
        }))
        const executor = createRlsExecutor(knex, Symbol('pinned-connection'))

        await expect(
            executor.transaction(async (tx) => {
                const nested = tx.transaction((innerTx) => innerTx.query('SELECT chained failure'))
                expect(nested).toBeInstanceOf(Promise)
                const recovered = await nested
                    .then((value) => value)
                    .catch((error) => {
                        expect(error).toBe(failure)
                        return []
                    })
                expect(recovered).toEqual([])
                return 'outer transaction remains valid'
            })
        ).rejects.toBe(failure)

        expect(rawFn.mock.calls.map(([sql]) => sql)).toEqual([
            'BEGIN',
            'SAVEPOINT rls_sp_2',
            'SELECT chained failure',
            'ROLLBACK TO SAVEPOINT rls_sp_2',
            'ROLLBACK'
        ])
    })

    it('detects a chained rejection that is rethrown and left unobserved', async () => {
        const { knex, rawFn } = createMockRlsKnex()
        const failure = new Error('rethrown chained savepoint failure')
        rawFn.mockImplementation((sql: string) => ({
            connection: () => (sql === 'SELECT chained failure' ? Promise.reject(failure) : Promise.resolve({ rows: [] }))
        }))
        const executor = createRlsExecutor(knex, Symbol('pinned-connection'))

        await expect(
            executor.transaction(async (tx) => {
                void tx
                    .transaction((innerTx) => innerTx.query('SELECT chained failure'))
                    .then((value) => value)
                    .catch((error) => {
                        throw error
                    })
                    .catch(() => undefined)
            })
        ).rejects.toBe(failure)

        expect(rawFn.mock.calls.map(([sql]) => sql)).toEqual([
            'BEGIN',
            'SAVEPOINT rls_sp_2',
            'SELECT chained failure',
            'ROLLBACK TO SAVEPOINT rls_sp_2',
            'ROLLBACK'
        ])
    })

    it('does not let Promise.resolve hide a failed nested transaction from its parent', async () => {
        const { knex, rawFn } = createMockRlsKnex()
        const failure = new Error('assimilated nested transaction failed')
        const executor = createRlsExecutor(knex, Symbol('pinned-connection'))

        await expect(
            executor.transaction(async (tx) => {
                void Promise.resolve(
                    tx.transaction(async () => {
                        throw failure
                    })
                ).catch(() => undefined)
            })
        ).rejects.toBe(failure)

        expect(rawFn.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'SAVEPOINT rls_sp_2', 'ROLLBACK TO SAVEPOINT rls_sp_2', 'ROLLBACK'])
    })

    it('propagates an unobserved nested transaction failure to its outer transaction', async () => {
        const { knex, rawFn, connection } = createMockRlsKnex()
        const failure = new Error('unobserved nested transaction failure')
        const executor = createRlsExecutor(knex, connection, { inTransaction: true })

        await expect(
            executor.transaction(async (tx) => {
                void tx
                    .transaction(async () => {
                        throw failure
                    })
                    .catch(() => undefined)
            })
        ).rejects.toBe(failure)

        expect(rawFn.mock.calls.map((call) => call[0])).toEqual(['SAVEPOINT rls_sp_2', 'ROLLBACK TO SAVEPOINT rls_sp_2'])
    })

    it('txDepth resets after transaction completes', async () => {
        const { knex, rawFn, connectionFn, connection } = createMockRlsKnex()

        const executor = createRlsExecutor(knex, connection)

        // First transaction
        await executor.transaction(async () => undefined)
        // Second transaction — should use BEGIN again (not SAVEPOINT)
        await executor.transaction(async () => undefined)

        const rawCalls = rawFn.mock.calls.map((call) => call[0])
        const beginCount = rawCalls.filter((c: string) => c === 'BEGIN').length
        const commitCount = rawCalls.filter((c: string) => c === 'COMMIT').length
        expect(beginCount).toBe(2)
        expect(commitCount).toBe(2)

        for (const call of connectionFn.mock.calls) {
            expect(call[0]).toBe(connection)
        }
    })
})
