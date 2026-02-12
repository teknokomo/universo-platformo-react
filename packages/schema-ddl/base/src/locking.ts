import type { Knex } from 'knex'

export type AdvisoryLockKey = number | string

type LockEntry = {
    connection: any
    knex: Knex
}

const lockConnections = new Map<string, LockEntry>()
const pendingLockAcquires = new Set<string>()

const DEBUG_LOG_LEVELS = new Set(['debug', 'verbose', 'silly', 'trace'])

const isDebugLoggingEnabled = (): boolean => {
    const logLevel = String(process.env.LOG_LEVEL ?? 'info').toLowerCase()
    return DEBUG_LOG_LEVELS.has(logLevel)
}

const logLockDebug = (message: string, payload?: unknown): void => {
    if (!isDebugLoggingEnabled()) return
    if (payload !== undefined) {
        console.log(message, payload)
        return
    }
    console.log(message)
}

/**
 * Builds a stable advisory lock key for a string resource.
 * Returned key is resolved to bigint inside PostgreSQL via hashtextextended().
 *
 * @param resourceKey - UUID, schema name, or namespaced resource ID
 * @returns String key for advisory lock hashing in PostgreSQL
 */
export function uuidToLockKey(resourceKey: string): string {
    const key = resourceKey.trim()
    if (!key) {
        throw new Error('Lock resource key must be non-empty')
    }
    return key
}

const getMapKey = (lockKey: AdvisoryLockKey): string => {
    return typeof lockKey === 'number' ? `n:${lockKey}` : `s:${lockKey}`
}

const buildLockSql = (lockKey: AdvisoryLockKey, unlock = false): { sql: string; params: unknown[] } => {
    if (typeof lockKey === 'number') {
        const fn = unlock ? 'pg_advisory_unlock' : 'pg_try_advisory_lock'
        return { sql: `SELECT ${fn}(?)`, params: [lockKey] }
    }

    const fn = unlock ? 'pg_advisory_unlock' : 'pg_try_advisory_lock'
    return { sql: `SELECT ${fn}(hashtextextended(?, 0))`, params: [lockKey] }
}

const setSessionStatementTimeout = async (knex: Knex, connection: any, timeoutMs: number): Promise<void> => {
    await knex.raw('SELECT set_config(?, ?, false)', ['statement_timeout', `${timeoutMs}ms`]).connection(connection)
}

const resetSessionStatementTimeout = async (knex: Knex, connection: any): Promise<void> => {
    await knex.raw('RESET statement_timeout').connection(connection)
}

/**
 * Acquire an advisory lock for DDL operations
 * This prevents concurrent schema modifications
 *
 * @param knex - Knex instance to use for the query
 * @param lockKey - Numeric lock key or string resource key
 * @param timeoutMs - How long to wait for the lock (default: 30s)
 * @returns true if lock acquired, false if timeout
 */
export async function acquireAdvisoryLock(knex: Knex, lockKey: AdvisoryLockKey, timeoutMs = 30000): Promise<boolean> {
    logLockDebug('[schema-ddl:lock] acquire requested', { lockKey, timeoutMs })

    // Validate timeout is a positive integer to prevent SQL injection
    const timeout = Number(timeoutMs)
    if (!Number.isInteger(timeout) || timeout <= 0 || timeout > 300000) {
        throw new Error('Invalid timeout value: must be a positive integer <= 300000ms')
    }
    if (typeof lockKey !== 'number' && (!lockKey || lockKey.trim().length === 0 || lockKey.length > 2048)) {
        throw new Error('Invalid lock key: string key must be non-empty and <= 2048 chars')
    }

    const startedAt = Date.now()
    const pollIntervalMs = 150
    const mapKey = getMapKey(lockKey)

    while (Date.now() - startedAt < timeout) {
        if (lockConnections.has(mapKey)) {
            logLockDebug('[schema-ddl:lock] lock already held in-process, waiting', {
                lockKey,
                elapsedMs: Date.now() - startedAt
            })
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
            continue
        }

        let connection: any | null = null
        pendingLockAcquires.add(mapKey)
        try {
            connection = await knex.client.acquireConnection()

            // Apply timeout at the session level for the current pooled connection.
            // SET LOCAL has no effect outside an explicit transaction block.
            await setSessionStatementTimeout(knex, connection, timeout)

            // Try to acquire exclusive session-level advisory lock
            const { sql, params } = buildLockSql(lockKey)
            const result = await knex.raw<{ rows: { pg_try_advisory_lock: boolean }[] }>(sql, params).connection(connection)
            const acquired = result.rows[0]?.pg_try_advisory_lock === true
            if (acquired) {
                await resetSessionStatementTimeout(knex, connection)
                lockConnections.set(mapKey, { connection, knex })
                logLockDebug('[schema-ddl:lock] lock acquired', {
                    lockKey,
                    elapsedMs: Date.now() - startedAt
                })
                return true
            }

            await resetSessionStatementTimeout(knex, connection)
            await knex.client.releaseConnection(connection)
            connection = null
        } catch (error) {
            console.error('[schema-ddl] Failed to acquire advisory lock:', error)
            try {
                if (connection) {
                    await resetSessionStatementTimeout(knex, connection)
                }
            } catch {
                // Ignore reset failures for broken connections.
            }
            if (connection) {
                await knex.client.releaseConnection(connection)
            }
            throw error
        } finally {
            pendingLockAcquires.delete(mapKey)
        }

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    }

    logLockDebug('[schema-ddl:lock] lock acquire timeout', {
        lockKey,
        timeoutMs: timeout
    })
    return false
}

/**
 * Release an advisory lock
 *
 * @param knex - Knex instance to use for the query
 * @param lockKey - The same key used to acquire the lock
 */
export async function releaseAdvisoryLock(knex: Knex, lockKey: AdvisoryLockKey): Promise<void> {
    const mapKey = getMapKey(lockKey)
    const entry = lockConnections.get(mapKey)
    const connection = entry?.connection
    const effectiveKnex = entry?.knex ?? knex

    try {
        const { sql, params } = buildLockSql(lockKey, true)
        if (connection) {
            await effectiveKnex.raw(sql, params).connection(connection)
            await resetSessionStatementTimeout(effectiveKnex, connection).catch(() => undefined)
        } else {
            await effectiveKnex.raw(sql, params)
        }
    } catch (error) {
        console.error('[schema-ddl] Failed to release advisory lock:', error)
    } finally {
        pendingLockAcquires.delete(mapKey)
        if (connection) {
            await effectiveKnex.client.releaseConnection(connection)
            lockConnections.delete(mapKey)
            logLockDebug('[schema-ddl:lock] lock released', { lockKey })
        }
    }
}
