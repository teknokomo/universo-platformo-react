import type { Knex } from 'knex'

type LockEntry = {
    connection: any
    knex: Knex
}

const lockConnections = new Map<number, LockEntry>()

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
        hash = (hash << 5) - hash + char
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
export async function acquireAdvisoryLock(knex: Knex, lockKey: number, timeoutMs = 30000): Promise<boolean> {
    logLockDebug('[schema-ddl:lock] acquire requested', { lockKey, timeoutMs })

    // Validate timeout is a positive integer to prevent SQL injection
    const timeout = Number(timeoutMs)
    if (!Number.isInteger(timeout) || timeout <= 0 || timeout > 300000) {
        throw new Error('Invalid timeout value: must be a positive integer <= 300000ms')
    }

    const startedAt = Date.now()
    const pollIntervalMs = 150

    while (Date.now() - startedAt < timeout) {
        if (lockConnections.has(lockKey)) {
            logLockDebug('[schema-ddl:lock] lock already held in-process, waiting', {
                lockKey,
                elapsedMs: Date.now() - startedAt
            })
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
            continue
        }

        const connection = await knex.client.acquireConnection()
        try {
            // Set statement timeout for this session
            // Note: SET commands do not support parameter binding ($1), so we interpolate the validated number directly.
            await knex.raw(`SET LOCAL statement_timeout = ${timeout}`).connection(connection)

            // Try to acquire exclusive session-level advisory lock
            const result = await knex
                .raw<{ rows: { pg_try_advisory_lock: boolean }[] }>(`SELECT pg_try_advisory_lock(?)`, [lockKey])
                .connection(connection)
            const acquired = result.rows[0]?.pg_try_advisory_lock === true
            if (acquired) {
                lockConnections.set(lockKey, { connection, knex })
                logLockDebug('[schema-ddl:lock] lock acquired', {
                    lockKey,
                    elapsedMs: Date.now() - startedAt
                })
                return true
            }
        } catch (error) {
            console.error('[schema-ddl] Failed to acquire advisory lock:', error)
            await knex.client.releaseConnection(connection)
            return false
        }

        await knex.client.releaseConnection(connection)
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
export async function releaseAdvisoryLock(knex: Knex, lockKey: number): Promise<void> {
    const entry = lockConnections.get(lockKey)
    const connection = entry?.connection
    const effectiveKnex = entry?.knex ?? knex

    try {
        if (connection) {
            await effectiveKnex.raw(`SELECT pg_advisory_unlock(?)`, [lockKey]).connection(connection)
        } else {
            await effectiveKnex.raw(`SELECT pg_advisory_unlock(?)`, [lockKey])
        }
    } catch (error) {
        console.error('[schema-ddl] Failed to release advisory lock:', error)
    } finally {
        if (connection) {
            await effectiveKnex.client.releaseConnection(connection)
            lockConnections.delete(lockKey)
            logLockDebug('[schema-ddl:lock] lock released', { lockKey })
        }
    }
}
