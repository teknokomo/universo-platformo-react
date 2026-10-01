import { createRlsExecutor } from '../knexExecutor'
import { createMockRlsKnex } from './knexExecutorTestUtils'

describe('createRlsExecutor request scope', () => {
    it('reuses the outer request transaction when created with inTransaction', async () => {
        const { knex, rawFn, connectionFn, connection } = createMockRlsKnex()

        const executor = createRlsExecutor(knex, connection, { inTransaction: true })
        await executor.transaction(async (tx) => {
            await tx.query('SELECT 1')
        })

        const rawCalls = rawFn.mock.calls.map((call) => call[0])
        expect(rawCalls).toEqual(['SELECT 1'])

        for (const call of connectionFn.mock.calls) {
            expect(call[0]).toBe(connection)
        }
    })

    it('routes base-executor queries and nested transactions through the active request transaction', async () => {
        const { knex, rawFn, connectionFn, connection } = createMockRlsKnex()
        const executor = createRlsExecutor(knex, connection, { inTransaction: true })

        await executor.transaction(async (tx) => {
            await executor.query('SELECT request metadata')
            await executor.transaction(async (nestedTx) => {
                await nestedTx.query('SELECT nested request transaction')
            })
            await tx.query('SELECT transaction executor')
        })

        expect(rawFn.mock.calls.map((call) => call[0])).toEqual([
            'SELECT request metadata',
            'SAVEPOINT rls_sp_2',
            'SELECT nested request transaction',
            'RELEASE SAVEPOINT rls_sp_2',
            'SELECT transaction executor'
        ])
        for (const call of connectionFn.mock.calls) {
            expect(call[0]).toBe(connection)
        }
    })

    it('does not inherit an unrelated executor scope or skip its connection lease', async () => {
        const { knex, rawFn, connectionFn, connection: firstConnection } = createMockRlsKnex()
        const secondConnection = Symbol('second-pinned-connection')
        let firstLeaseCount = 0
        let secondLeaseCount = 0
        const firstExecutor = createRlsExecutor(knex, firstConnection, {
            inTransaction: true,
            runWithConnectionLease: async (operation) => {
                firstLeaseCount += 1
                return operation()
            }
        })
        const secondExecutor = createRlsExecutor(knex, secondConnection, {
            runWithConnectionLease: async (operation) => {
                secondLeaseCount += 1
                return operation()
            }
        })

        await firstExecutor.transaction(async (firstTx) => {
            await firstExecutor.query('SELECT first executor before')
            await secondExecutor.query('SELECT second executor request query')
            await secondExecutor.transaction((secondTx) => secondTx.query('SELECT second executor transaction query'))
            await firstTx.query('SELECT first executor after')
        })

        expect(rawFn.mock.calls.map(([sql]) => sql)).toEqual([
            'SELECT first executor before',
            'SELECT second executor request query',
            'BEGIN',
            'SELECT second executor transaction query',
            'COMMIT',
            'SELECT first executor after'
        ])
        expect(connectionFn.mock.calls.map(([activeConnection]) => activeConnection)).toEqual([
            firstConnection,
            secondConnection,
            secondConnection,
            secondConnection,
            secondConnection,
            firstConnection
        ])
        expect(firstLeaseCount).toBe(1)
        expect(secondLeaseCount).toBe(2)
    })

    it('does not treat an application error as an aborted PostgreSQL request transaction', async () => {
        const { knex, rawFn, connection } = createMockRlsKnex()
        const onOuterTransactionFailure = jest.fn()
        const failure = new Error('domain validation failed')
        const executor = createRlsExecutor(knex, connection, {
            inTransaction: true,
            onOuterTransactionFailure
        })

        await expect(
            executor.transaction(async () => {
                throw failure
            })
        ).rejects.toBe(failure)

        expect(onOuterTransactionFailure).not.toHaveBeenCalled()
        // The request middleware owns BEGIN/ROLLBACK for this executor.
        expect(rawFn).not.toHaveBeenCalled()
    })

    it('keeps a caught SQL failure from appearing successful in a request transaction', async () => {
        const { knex, rawFn, connectionFn, connection } = createMockRlsKnex()
        const onOuterTransactionFailure = jest.fn()
        const failure = new Error('statement aborted the request transaction')
        connectionFn.mockRejectedValueOnce(failure)
        const executor = createRlsExecutor(knex, connection, {
            inTransaction: true,
            onOuterTransactionFailure
        })

        await expect(
            executor.transaction(async (tx) => {
                await tx.query('SELECT failing_statement').catch(() => undefined)
                return 'would otherwise look successful'
            })
        ).rejects.toBe(failure)

        expect(onOuterTransactionFailure).toHaveBeenCalledWith(failure)
        expect(rawFn).toHaveBeenCalledWith('SELECT failing_statement', [])
    })

    it('reports failed direct SQL even when a request handler catches the query error', async () => {
        const { knex, rawFn, connectionFn, connection } = createMockRlsKnex()
        const onOuterTransactionFailure = jest.fn()
        const failure = new Error('statement aborted the request transaction')
        connectionFn.mockRejectedValueOnce(failure)
        const executor = createRlsExecutor(knex, connection, {
            inTransaction: true,
            onOuterTransactionFailure
        })

        await expect(executor.query('SELECT failing_statement')).rejects.toBe(failure)

        expect(rawFn).toHaveBeenCalledWith('SELECT failing_statement', [])
        expect(onOuterTransactionFailure).toHaveBeenCalledWith(failure)
    })

    it('reports a request transaction failure when the request scope drains', async () => {
        const { knex, connectionFn, connection } = createMockRlsKnex()
        const failure = new Error('unobserved request SQL failure')
        const onOuterTransactionFailure = jest.fn()
        let drainRequestScope!: () => Promise<Array<{ kind: string; reason: unknown }>>
        connectionFn.mockRejectedValueOnce(failure)

        const executor = createRlsExecutor(knex, connection, {
            inTransaction: true,
            onOuterTransactionFailure,
            onRequestScopeCreated: (scope) => {
                drainRequestScope = scope.closeAndDrain as typeof drainRequestScope
            }
        })
        void executor.transaction((tx) => tx.query('SELECT unobserved request failure')).catch(() => undefined)

        await expect(drainRequestScope()).resolves.toEqual([{ kind: 'transaction', reason: failure }])
        expect(onOuterTransactionFailure).toHaveBeenCalledWith(failure)
    })

    it('does not report connection lease rejection as a PostgreSQL transaction failure', async () => {
        const { knex, rawFn, connection } = createMockRlsKnex()
        const onOuterTransactionFailure = jest.fn()
        const executor = createRlsExecutor(knex, connection, {
            inTransaction: true,
            isConnectionUnavailable: () => true,
            onOuterTransactionFailure
        })

        await expect(executor.query('SELECT 1')).rejects.toThrow('RLS connection is unavailable')

        expect(onOuterTransactionFailure).not.toHaveBeenCalled()
        expect(rawFn).not.toHaveBeenCalled()
    })

    it('allows explicit nested savepoints inside a middleware-owned transaction', async () => {
        const { knex, rawFn, connectionFn, connection } = createMockRlsKnex()

        const executor = createRlsExecutor(knex, connection, { inTransaction: true })
        await executor.transaction(async (tx) => {
            await tx.transaction(async (innerTx) => {
                await innerTx.query('SELECT 1')
            })
        })

        const rawCalls = rawFn.mock.calls.map((call) => call[0])
        expect(rawCalls).toEqual(['SAVEPOINT rls_sp_2', 'SELECT 1', 'RELEASE SAVEPOINT rls_sp_2'])

        for (const call of connectionFn.mock.calls) {
            expect(call[0]).toBe(connection)
        }
    })

    it('holds one connection lease across nested request transactions and rejects use after release', async () => {
        const { knex, rawFn, connection } = createMockRlsKnex()
        const leaseEvents: string[] = []
        let released = false
        const executor = createRlsExecutor(knex, connection, {
            inTransaction: true,
            isConnectionUnavailable: () => released,
            runWithConnectionLease: async (operation) => {
                leaseEvents.push('enter')
                try {
                    return await operation()
                } finally {
                    leaseEvents.push('leave')
                }
            }
        })

        await executor.transaction((tx) => tx.transaction((nestedTx) => nestedTx.query('SELECT 1')))

        expect(leaseEvents).toEqual(['enter', 'leave'])
        released = true
        const callsBeforeReleasedUse = rawFn.mock.calls.length

        await expect(executor.query('SELECT 2')).rejects.toThrow('RLS connection is unavailable')
        await expect(executor.transaction(async () => undefined)).rejects.toThrow('RLS connection is unavailable')
        expect(executor.isReleased()).toBe(true)
        expect(rawFn).toHaveBeenCalledTimes(callsBeforeReleasedUse)
    })

    it('finishes already accepted transaction work after request cleanup closes the connection lease', async () => {
        const { knex, rawFn, connection, connectionFn } = createMockRlsKnex()
        let unavailable = false
        let resolveTransactionWork!: () => void
        let markTransactionStarted!: () => void
        const transactionBarrier = new Promise<void>((resolve) => {
            resolveTransactionWork = resolve
        })
        const transactionStarted = new Promise<void>((resolve) => {
            markTransactionStarted = resolve
        })
        const executor = createRlsExecutor(knex, connection, {
            inTransaction: true,
            isConnectionUnavailable: () => unavailable,
            runWithConnectionLease: async (operation) => {
                if (unavailable) throw new Error('RLS connection lease is closed')
                return operation()
            }
        })

        const transaction = executor.transaction(async (tx) => {
            markTransactionStarted()
            await transactionBarrier
            await tx.query('SELECT 1')
        })
        await transactionStarted
        unavailable = true

        await expect(executor.query('SELECT 2')).rejects.toThrow('RLS connection lease is closed')
        resolveTransactionWork()
        await transaction

        expect(rawFn.mock.calls.map((call) => call[0])).toContain('SELECT 1')
        expect(connectionFn).toHaveBeenCalledWith(connection)
        expect(executor.isReleased()).toBe(true)
    })

    it('drains unawaited queries started inside a transaction before it completes', async () => {
        const { knex, connection, connectionFn } = createMockRlsKnex()
        let resolveQuery!: () => void
        let markQueryStarted!: () => void
        let markCallbackReturned!: () => void
        let transactionSettled = false
        const queryBarrier = new Promise<void>((resolve) => {
            resolveQuery = resolve
        })
        const queryStarted = new Promise<void>((resolve) => {
            markQueryStarted = resolve
        })
        const callbackReturned = new Promise<void>((resolve) => {
            markCallbackReturned = resolve
        })
        connectionFn.mockImplementationOnce(async () => {
            markQueryStarted()
            await queryBarrier
            return { rows: [] }
        })
        const executor = createRlsExecutor(knex, connection, { inTransaction: true })

        const transaction = executor
            .transaction(async (tx) => {
                void tx.query('SELECT 1')
                await queryStarted
                markCallbackReturned()
            })
            .finally(() => {
                transactionSettled = true
            })
        await callbackReturned
        await Promise.resolve()

        expect(transactionSettled).toBe(false)
        resolveQuery()
        await transaction
        expect(transactionSettled).toBe(true)
    })

    it('rolls back when an unawaited query fails before the transaction callback finishes', async () => {
        const { knex, rawFn, connectionFn, connection } = createMockRlsKnex()
        let rejectQuery!: () => void
        let markQueryStarted!: () => void
        let markQueryFailureHandled!: () => void
        let resolveUnrelatedWork!: () => void
        let transactionSettled = false
        const queryBarrier = new Promise<void>((resolve) => {
            rejectQuery = resolve
        })
        const queryStarted = new Promise<void>((resolve) => {
            markQueryStarted = resolve
        })
        const queryFailureHandled = new Promise<void>((resolve) => {
            markQueryFailureHandled = resolve
        })
        const unrelatedWork = new Promise<void>((resolve) => {
            resolveUnrelatedWork = resolve
        })
        connectionFn
            .mockImplementationOnce(async () => ({ rows: [] }))
            .mockImplementationOnce(async () => {
                markQueryStarted()
                await queryBarrier
                throw new Error('Early in-flight transaction query failed')
            })
        const executor = createRlsExecutor(knex, connection)

        const transaction = executor
            .transaction(async (tx) => {
                void tx.query('SELECT 1').catch(() => markQueryFailureHandled())
                await queryStarted
                await unrelatedWork
                return 'must not commit'
            })
            .finally(() => {
                transactionSettled = true
            })
        await queryStarted
        rejectQuery()
        await queryFailureHandled

        expect(transactionSettled).toBe(false)
        resolveUnrelatedWork()
        await expect(transaction).rejects.toThrow('Early in-flight transaction query failed')
        expect(rawFn.mock.calls.map((call) => call[0])).toEqual(['BEGIN', 'SELECT 1', 'ROLLBACK'])
    })

    it('rolls back when a query started inside a transaction fails while the transaction drains', async () => {
        const { knex, rawFn, connectionFn, connection } = createMockRlsKnex()
        let rejectQuery!: () => void
        let markQueryStarted!: () => void
        const queryBarrier = new Promise<void>((resolve) => {
            rejectQuery = resolve
        })
        const queryStarted = new Promise<void>((resolve) => {
            markQueryStarted = resolve
        })
        connectionFn
            .mockImplementationOnce(async () => ({ rows: [] }))
            .mockImplementationOnce(async () => {
                markQueryStarted()
                await queryBarrier
                throw new Error('In-flight transaction query failed')
            })
        const executor = createRlsExecutor(knex, connection)

        const transaction = executor.transaction(async (tx) => {
            void tx.query('SELECT 1').catch(() => undefined)
            await queryStarted
            return 'must not commit'
        })
        await queryStarted
        rejectQuery()

        await expect(transaction).rejects.toThrow('In-flight transaction query failed')
        const rawCalls = rawFn.mock.calls.map((call) => call[0])
        expect(rawCalls).toEqual(['BEGIN', 'SELECT 1', 'ROLLBACK'])
    })
})
