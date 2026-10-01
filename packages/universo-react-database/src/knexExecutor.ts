import type { Knex } from 'knex'
import type { DbExecutor } from '@universo-react/utils/database'
import { convertPgBindings } from './pgBindings'
import {
    createRlsOperationScope,
    getActiveRlsOperationScope,
    runInRlsOperationScope,
    runWithRlsOperationScope,
    type RlsOperationScope
} from './rlsOperationScope'

/**
 * Pool-level executor — acquires connections from pool per-query.
 * Transactions use knex.transaction() (new connection from pool).
 *
 * All SQL goes through convertPgBindings() so stores can use
 * either PostgreSQL-native $1 placeholders or Knex ? placeholders.
 *
 * USE FOR: non-RLS routes (admin, bootstrap, public endpoints).
 */
export function createKnexExecutor(knex: Knex): DbExecutor {
    return {
        query: async <T = unknown>(sql: string, params?: unknown[]) => {
            const { sql: knexSql, bindings } = convertPgBindings(sql, params)
            const result = await knex.raw(knexSql, bindings as Knex.RawBinding[])
            return (result.rows ?? result) as T[]
        },
        transaction: async <T>(work: (executor: DbExecutor) => Promise<T>) => {
            return knex.transaction(async (trx) => {
                const txExecutor: DbExecutor = {
                    query: async <TRow = unknown>(sql: string, params?: unknown[]) => {
                        const { sql: knexSql, bindings } = convertPgBindings(sql, params)
                        const result = await trx.raw(knexSql, bindings as Knex.RawBinding[])
                        return (result.rows ?? result) as TRow[]
                    },
                    transaction: async <TInner>(innerWork: (executor: DbExecutor) => Promise<TInner>) => innerWork(txExecutor),
                    isReleased: () => false
                }
                return work(txExecutor)
            })
        },
        isReleased: () => false
    }
}

/**
 * RLS pinned-connection executor — all queries AND transactions stay on the
 * SAME pg connection where set_config('request.jwt.claims', ...) was called.
 *
 * Top-level transactions use BEGIN/COMMIT/ROLLBACK; explicit nested
 * transactions use SAVEPOINT/RELEASE SAVEPOINT on the same pinned connection.
 *
 * NEVER call knex.transaction() here — it would acquire a new pool connection
 * without RLS claims.
 *
 * USE FOR: RLS-protected routes (metahubs, applications, profile).
 *
 * Proven pattern: knex.raw(sql, params).connection(connection) — same approach
 * as locking.ts advisory locks and runner.ts session-lock queries.
 *
 * @param options.inTransaction — if true, the outer middleware already opened
 *   a BEGIN; top-level transaction() calls reuse that request transaction
 *   directly, while explicit nested transaction() calls still use SAVEPOINT.
 */
type RlsExecutorOptions = {
    inTransaction?: boolean
    /** Rejects executor work once request cleanup stops accepting operations. */
    isConnectionUnavailable?: () => boolean
    /** Holds the pinned connection lease until the complete executor operation settles. */
    runWithConnectionLease?: <T>(operation: () => Promise<T>) => Promise<T>
    /** Fails the HTTP response if PostgreSQL aborts a middleware-owned transaction. */
    onOuterTransactionFailure?: (error: unknown) => void
    /** Gives request middleware the scope drain used before finalizing its outer transaction. */
    onRequestScopeCreated?: (scope: RlsOperationScope) => void
}

const operationScopeOwners = new WeakMap<RlsOperationScope, object>()

const createOwnedOperationScope = (owner: object, options?: { trackTransactionFailures?: boolean }): RlsOperationScope => {
    const scope = createRlsOperationScope(options)
    operationScopeOwners.set(scope, owner)
    return scope
}

type ScopedExecutorScopeKind = 'request' | 'transaction'

export function createRlsExecutor(knex: Knex, connection: unknown, options?: RlsExecutorOptions): DbExecutor {
    const isConnectionUnavailable = options?.isConnectionUnavailable ?? (() => false)
    const runWithConnectionLease = options?.runWithConnectionLease ?? (<T>(operation: () => Promise<T>): Promise<T> => operation())
    const assertConnectionAvailable = () => {
        if (isConnectionUnavailable()) throw new Error('RLS connection is unavailable')
    }
    const reuseOuterTransaction = options?.inTransaction === true
    const operationScopeOwner = {}
    const requestOperationScope = createOwnedOperationScope(operationScopeOwner, {
        trackTransactionFailures: reuseOuterTransaction
    })
    let outerTransactionFailureReported = false
    const reportOuterTransactionFailure = (error: unknown) => {
        if (!reuseOuterTransaction || outerTransactionFailureReported) return
        outerTransactionFailureReported = true
        options?.onOuterTransactionFailure?.(error)
    }

    const executeTransaction = async <T>(depth: number, work: (executor: DbExecutor) => Promise<T>): Promise<T> => {
        const operationScope = createOwnedOperationScope(operationScopeOwner)
        if (reuseOuterTransaction && depth === 0) {
            try {
                const result = await runWithRlsOperationScope(operationScope, () =>
                    work(createScopedExecutor(depth + 1, operationScope, 'transaction'))
                )
                const failures = await operationScope.closeAndDrain()
                const databaseFailure = failures.find((failure) => failure.kind === 'database')
                if (databaseFailure) {
                    reportOuterTransactionFailure(databaseFailure.reason)
                    throw databaseFailure.reason
                }
                if (failures.length > 0) throw failures[0].reason
                return result
            } catch (error) {
                const failures = await operationScope.closeAndDrain()
                const databaseFailure = failures.find((failure) => failure.kind === 'database')
                if (databaseFailure) reportOuterTransactionFailure(databaseFailure.reason)
                throw error
            }
        }

        const nextDepth = depth + 1
        const savepointName = `rls_sp_${nextDepth}`
        const useSavepoint = nextDepth > 1

        if (useSavepoint) {
            await knex.raw(`SAVEPOINT ${savepointName}`).connection(connection)
        } else {
            await knex.raw('BEGIN').connection(connection)
        }

        try {
            const result = await runWithRlsOperationScope(operationScope, () =>
                work(createScopedExecutor(nextDepth, operationScope, 'transaction'))
            )
            const failures = await operationScope.closeAndDrain()
            if (failures.length > 0) throw failures[0].reason
            if (useSavepoint) {
                await knex.raw(`RELEASE SAVEPOINT ${savepointName}`).connection(connection)
            } else {
                await knex.raw('COMMIT').connection(connection)
            }
            return result
        } catch (err) {
            const failures = await operationScope.closeAndDrain()
            try {
                if (useSavepoint) {
                    await knex.raw(`ROLLBACK TO SAVEPOINT ${savepointName}`).connection(connection)
                } else {
                    await knex.raw('ROLLBACK').connection(connection)
                }
            } catch (rollbackError) {
                /* best-effort rollback */
                if (reuseOuterTransaction) reportOuterTransactionFailure(rollbackError)
            }
            const databaseFailure = failures.find((failure) => failure.kind === 'database')
            if (databaseFailure && !useSavepoint) reportOuterTransactionFailure(databaseFailure.reason)
            throw err
        }
    }

    const createScopedExecutor = (depth: number, operationScope: RlsOperationScope, scopeKind: ScopedExecutorScopeKind): DbExecutor => ({
        query: async <T = unknown>(sql: string, params?: unknown[]) => {
            const executeQuery = async () => {
                const { sql: knexSql, bindings } = convertPgBindings(sql, params)
                try {
                    const result = await knex.raw(knexSql, bindings as Knex.RawBinding[]).connection(connection)
                    return (result.rows ?? result) as T[]
                } catch (error) {
                    if (scopeKind === 'transaction') operationScope.recordFailure(error)
                    if (scopeKind === 'request') reportOuterTransactionFailure(error)
                    throw error
                }
            }
            if (depth > 0) return operationScope.run(executeQuery)

            const activeScope = getActiveRlsOperationScope()
            if (activeScope && activeScope !== operationScope) {
                if (operationScopeOwners.get(activeScope) !== operationScopeOwner) {
                    return runWithConnectionLease(async () => {
                        assertConnectionAvailable()
                        return runWithRlsOperationScope(operationScope, () => operationScope.run(executeQuery))
                    })
                }
                assertConnectionAvailable()
                return runInRlsOperationScope(operationScope, executeQuery)
            }

            return runWithConnectionLease(async () => {
                assertConnectionAvailable()
                return operationScope.run(executeQuery)
            })
        },
        transaction: <T>(work: (executor: DbExecutor) => Promise<T>) => {
            const activeScope = getActiveRlsOperationScope()
            const inheritedTransactionScope =
                depth === 0 &&
                activeScope &&
                activeScope !== operationScope &&
                operationScopeOwners.get(activeScope) === operationScopeOwner
                    ? activeScope
                    : undefined
            if (inheritedTransactionScope) assertConnectionAvailable()

            const acquireRequestLease = !inheritedTransactionScope && depth === 0
            const task = (inheritedTransactionScope ?? operationScope).runSerializedTransaction(
                () => executeTransaction(inheritedTransactionScope ? depth + 1 : depth, work),
                acquireRequestLease
                    ? (operation) =>
                          runWithConnectionLease(async () => {
                              assertConnectionAvailable()
                              return operation()
                          })
                    : undefined
            )
            return task.promise
        },
        isReleased: () => operationScope.isClosed() || isConnectionUnavailable()
    })

    if (reuseOuterTransaction) options?.onRequestScopeCreated?.(requestOperationScope)
    return createScopedExecutor(0, requestOperationScope, 'request')
}
