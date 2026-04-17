import type { Knex } from 'knex'
import type { DbExecutor } from '@universo/utils/database'
import { convertPgBindings } from './pgBindings'

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
export function createRlsExecutor(knex: Knex, connection: unknown, options?: { inTransaction?: boolean }): DbExecutor {
    const query = async <T = unknown>(sql: string, params?: unknown[]) => {
        const { sql: knexSql, bindings } = convertPgBindings(sql, params)
        const result = await knex.raw(knexSql, bindings as Knex.RawBinding[]).connection(connection)
        return (result.rows ?? result) as T[]
    }

    const reuseOuterTransaction = options?.inTransaction === true

    const createScopedExecutor = (depth: number): DbExecutor => ({
        query,
        transaction: async <T>(work: (executor: DbExecutor) => Promise<T>) => {
            if (reuseOuterTransaction && depth === 0) {
                return work(createScopedExecutor(depth + 1))
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
                const result = await work(createScopedExecutor(nextDepth))
                if (useSavepoint) {
                    await knex.raw(`RELEASE SAVEPOINT ${savepointName}`).connection(connection)
                } else {
                    await knex.raw('COMMIT').connection(connection)
                }
                return result
            } catch (err) {
                try {
                    if (useSavepoint) {
                        await knex.raw(`ROLLBACK TO SAVEPOINT ${savepointName}`).connection(connection)
                    } else {
                        await knex.raw('ROLLBACK').connection(connection)
                    }
                } catch {
                    /* best-effort rollback */
                }
                throw err
            }
        },
        isReleased: () => false
    })

    return createScopedExecutor(0)
}
