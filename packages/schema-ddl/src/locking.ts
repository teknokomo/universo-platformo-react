import type { Knex } from 'knex'
import { buildSetLocalStatementTimeoutSql } from '@universo/utils/database'

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

const buildLockSql = (lockKey: AdvisoryLockKey): { sql: string; params: unknown[] } => {
    if (typeof lockKey === 'number') {
        return { sql: `SELECT pg_try_advisory_xact_lock(?)`, params: [lockKey] }
    }

    return { sql: `SELECT pg_try_advisory_xact_lock(hashtextextended(?, 0))`, params: [lockKey] }
}

/**
 * Acquire a transaction-level advisory lock for DDL operations.
 * The lock is held within a transaction on a pinned connection and auto-releases
 * on COMMIT/ROLLBACK via releaseAdvisoryLock().
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

            // Begin a transaction to hold the advisory xact lock.
            // Transaction-level locks auto-release on COMMIT/ROLLBACK.
            await knex.raw('BEGIN').connection(connection)
            await knex.raw(buildSetLocalStatementTimeoutSql(timeout)).connection(connection)

            // Try to acquire transaction-level advisory lock
            const { sql, params } = buildLockSql(lockKey)
            const result = await knex.raw<{ rows: { pg_try_advisory_xact_lock: boolean }[] }>(sql, params).connection(connection)
            const acquired = result.rows[0]?.pg_try_advisory_xact_lock === true
            if (acquired) {
                lockConnections.set(mapKey, { connection, knex })
                logLockDebug('[schema-ddl:lock] lock acquired', {
                    lockKey,
                    elapsedMs: Date.now() - startedAt
                })
                return true
            }

            // Lock not acquired — rollback and release
            await knex.raw('ROLLBACK').connection(connection)
            await knex.client.releaseConnection(connection)
            connection = null
        } catch (error) {
            console.error('[schema-ddl] Failed to acquire advisory lock:', error)
            try {
                if (connection) {
                    await knex.raw('ROLLBACK').connection(connection)
                }
            } catch {
                // Ignore rollback failures for broken connections.
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
 * Release an advisory lock by committing the holding transaction.
 * Transaction-level advisory locks auto-release on COMMIT/ROLLBACK.
 *
 * @param knex - Knex instance (used as fallback if entry not found)
 * @param lockKey - The same key used to acquire the lock
 */
export async function releaseAdvisoryLock(knex: Knex, lockKey: AdvisoryLockKey): Promise<void> {
    const mapKey = getMapKey(lockKey)
    const entry = lockConnections.get(mapKey)
    const connection = entry?.connection
    const effectiveKnex = entry?.knex ?? knex

    try {
        if (connection) {
            // COMMIT releases the transaction-level advisory lock automatically
            await effectiveKnex.raw('COMMIT').connection(connection)
        }
    } catch (error) {
        console.error('[schema-ddl] Failed to release advisory lock (COMMIT):', error)
        try {
            if (connection) {
                await effectiveKnex.raw('ROLLBACK').connection(connection)
            }
        } catch {
            /* best-effort rollback */
        }
    } finally {
        pendingLockAcquires.delete(mapKey)
        if (connection) {
            await effectiveKnex.client.releaseConnection(connection)
            lockConnections.delete(mapKey)
            logLockDebug('[schema-ddl:lock] lock released', { lockKey })
        }
    }
}
