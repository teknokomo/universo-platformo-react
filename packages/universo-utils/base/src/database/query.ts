import type { z } from 'zod'
import type { SqlQueryable, DbExecutor } from './manager'

/**
 * Execute SQL and return all rows.
 * Optional Zod validation for API boundaries and migration snapshots.
 */
export async function queryMany<T>(
    db: SqlQueryable,
    sql: string,
    params: readonly unknown[] = [],
    schema?: z.ZodType<T>
): Promise<T[]> {
    const rows = await db.query<unknown>(sql, [...params])
    if (!schema) return rows as T[]
    return rows.map((row) => schema.parse(row))
}

/**
 * Execute SQL and return the first row or null.
 */
export async function queryOne<T>(
    db: SqlQueryable,
    sql: string,
    params: readonly unknown[] = [],
    schema?: z.ZodType<T>
): Promise<T | null> {
    const rows = await queryMany(db, sql, params, schema)
    return rows[0] ?? null
}

export class NotFoundError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'NotFoundError'
    }
}

/**
 * Execute SQL and return the first row, or throw NotFoundError.
 *
 * Throws a plain Error (not http-errors) to keep @universo/utils transport-agnostic.
 * Route handlers should catch and wrap with createError(404) from http-errors.
 * Callers can supply a custom error factory:
 *   queryOneOrThrow(db, sql, params, schema, () => createError(404, 'Not found'))
 */
export async function queryOneOrThrow<T>(
    db: SqlQueryable,
    sql: string,
    params: readonly unknown[] = [],
    schema?: z.ZodType<T>,
    errorOrMessage: string | (() => Error) = 'Not found'
): Promise<T> {
    const row = await queryOne(db, sql, params, schema)
    if (!row) {
        throw typeof errorOrMessage === 'function'
            ? errorOrMessage()
            : new NotFoundError(errorOrMessage)
    }
    return row
}

/**
 * Execute a DML statement with RETURNING clause and return the count of
 * affected rows. All mutating DML MUST use RETURNING to guarantee correct
 * counts through the SqlQueryable normalization layer (which exposes only
 * `rows`, not `rowCount`).
 *
 * Example: `executeCount(db, 'DELETE FROM t WHERE id = $1 RETURNING id', [id])`
 */
export async function executeCount(
    db: SqlQueryable,
    sql: string,
    params: readonly unknown[] = []
): Promise<number> {
    const rows = await db.query<Record<string, unknown>>(sql, [...params])
    return rows.length
}
