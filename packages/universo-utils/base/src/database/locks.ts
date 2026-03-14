import type { DbExecutor } from './manager'

const MAX_LOCK_TIMEOUT_MS = 300_000

const assertLockTimeoutMs = (ms: number): number => {
    if (!Number.isInteger(ms) || ms <= 0 || ms > MAX_LOCK_TIMEOUT_MS) {
        throw new Error(
            `Invalid lock_timeout: must be a positive integer <= ${MAX_LOCK_TIMEOUT_MS}ms`
        )
    }
    return ms
}

const buildSetLocalLockTimeoutSql = (timeoutMs: number): string =>
    `SET LOCAL lock_timeout TO '${assertLockTimeoutMs(timeoutMs)}ms'`

/**
 * Acquire a transaction-scoped advisory lock inside an executor transaction.
 * The lock is automatically released when the transaction commits or rolls back.
 * Uses blocking pg_advisory_xact_lock — if timeout is specified, PostgreSQL will
 * raise an error after the timeout expires.
 */
export async function withAdvisoryLock<T>(
    executor: DbExecutor,
    lockKey: string,
    work: (tx: DbExecutor) => Promise<T>,
    options?: { timeoutMs?: number }
): Promise<T> {
    return executor.transaction(async (tx) => {
        if (options?.timeoutMs) {
            await tx.query(buildSetLocalLockTimeoutSql(options.timeoutMs))
        }
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey])
        return work(tx)
    })
}

/**
 * Try to acquire advisory lock without blocking.
 * Returns null if lock is not available.
 */
export async function tryWithAdvisoryLock<T>(
    executor: DbExecutor,
    lockKey: string,
    work: (tx: DbExecutor) => Promise<T>
): Promise<T | null> {
    return executor.transaction(async (tx) => {
        const [{ acquired }] = await tx.query<{ acquired: boolean }>(
            'SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired',
            [lockKey]
        )
        if (!acquired) return null
        return work(tx)
    })
}
