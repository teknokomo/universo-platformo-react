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
 * Top-level transactions use BEGIN/COMMIT/ROLLBACK; nested transactions use
 * SAVEPOINT/RELEASE SAVEPOINT on the same pinned connection.
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
 *   a BEGIN; top-level transaction() calls use SAVEPOINT instead of BEGIN.
 */
export function createRlsExecutor(knex: Knex, connection: unknown, options?: { inTransaction?: boolean }): DbExecutor {
    let txDepth = options?.inTransaction ? 1 : 0

    const executor: DbExecutor = {
        query: async <T = unknown>(sql: string, params?: unknown[]) => {
            const { sql: knexSql, bindings } = convertPgBindings(sql, params)
            const result = await knex.raw(knexSql, bindings as Knex.RawBinding[]).connection(connection)
            return (result.rows ?? result) as T[]
        },
        transaction: async <T>(work: (executor: DbExecutor) => Promise<T>) => {
            const nextDepth = txDepth + 1
            const savepointName = `rls_sp_${nextDepth}`

            if (txDepth === 0) {
                await knex.raw('BEGIN').connection(connection)
            } else {
                await knex.raw(`SAVEPOINT ${savepointName}`).connection(connection)
            }

            txDepth = nextDepth
            try {
                const result = await work(executor)
                if (nextDepth === 1) {
                    await knex.raw('COMMIT').connection(connection)
                } else {
                    await knex.raw(`RELEASE SAVEPOINT ${savepointName}`).connection(connection)
                }
                return result
            } catch (err) {
                try {
                    if (nextDepth === 1) {
                        await knex.raw('ROLLBACK').connection(connection)
                    } else {
                        await knex.raw(`ROLLBACK TO SAVEPOINT ${savepointName}`).connection(connection)
                    }
                } catch {
                    /* best-effort rollback */
                }
                throw err
            } finally {
                txDepth -= 1
            }
        },
        isReleased: () => false
    }

    return executor
}
