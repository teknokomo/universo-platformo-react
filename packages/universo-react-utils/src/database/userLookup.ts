import type { SqlQueryable } from './manager'

/**
 * Lookup user email from auth.users table by user ID.
 * Used for enriching conflict responses with user email.
 *
 * @param conn - Any object with a `.query(sql, params)` method (DbExecutor, DataSource, Knex wrapper, etc.)
 * @param userId - User ID to lookup
 * @returns User email or null if not found or error occurred
 *
 * @example
 * ```typescript
 * const email = await lookupUserEmail(executor, conflict.updatedBy)
 * return res.status(409).json({
 *     conflict: { ...conflict, updatedByEmail: email }
 * })
 * ```
 */
export async function lookupUserEmail(conn: SqlQueryable, userId: string | null | undefined): Promise<string | null> {
    if (!userId) return null

    try {
        const result = await conn.query('SELECT email FROM auth.users WHERE id = $1', [userId])
        const rows = Array.isArray(result) ? result : []
        return (rows[0] as { email?: string })?.email ?? null
    } catch (error) {
        // Log error for debugging but don't block main functionality
        console.error('[lookupUserEmail] Failed to fetch user email:', error)
        return null
    }
}
