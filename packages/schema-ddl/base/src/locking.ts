import type { Knex } from 'knex'

/**
 * Generate a numeric lock key from a UUID string
 * Uses a simple hash function to convert UUID to int32
 *
 * @param uuid - Application UUID or schema name
 * @returns Numeric lock key
 */
export function uuidToLockKey(uuid: string): number {
    const cleanUuid = uuid.replace(/-/g, '')
    let hash = 0
    for (let i = 0; i < cleanUuid.length; i++) {
        const char = cleanUuid.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
}

/**
 * Acquire an advisory lock for DDL operations
 * This prevents concurrent schema modifications
 *
 * @param knex - Knex instance to use for the query
 * @param lockKey - Unique numeric key for the lock (use applicationId hash)
 * @param timeoutMs - How long to wait for the lock (default: 30s)
 * @returns true if lock acquired, false if timeout
 */
export async function acquireAdvisoryLock(
    knex: Knex,
    lockKey: number,
    timeoutMs = 30000
): Promise<boolean> {
    // Set statement timeout for this session
    await knex.raw('SET LOCAL statement_timeout = ?', [timeoutMs])

    try {
        // Try to acquire exclusive session-level advisory lock
        const result = await knex.raw<{ rows: { pg_try_advisory_lock: boolean }[] }>(
            `SELECT pg_try_advisory_lock(?)`,
            [lockKey]
        )
        return result.rows[0]?.pg_try_advisory_lock === true
    } catch (error) {
        console.error('[schema-ddl] Failed to acquire advisory lock:', error)
        return false
    }
}

/**
 * Release an advisory lock
 *
 * @param knex - Knex instance to use for the query
 * @param lockKey - The same key used to acquire the lock
 */
export async function releaseAdvisoryLock(knex: Knex, lockKey: number): Promise<void> {
    try {
        await knex.raw(`SELECT pg_advisory_unlock(?)`, [lockKey])
    } catch (error) {
        console.error('[schema-ddl] Failed to release advisory lock:', error)
    }
}
