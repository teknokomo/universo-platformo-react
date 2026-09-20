import type { DbExecutor } from './manager'

const MAX_LOCK_TIMEOUT_MS = 300_000

const assertLockTimeoutMs = (ms: number): number => {
    if (!Number.isInteger(ms) || ms <= 0 || ms > MAX_LOCK_TIMEOUT_MS) {
        throw new Error(`Invalid lock_timeout: must be a positive integer <= ${MAX_LOCK_TIMEOUT_MS}ms`)
    }
    return ms
}

const buildSetLocalLockTimeoutSql = (timeoutMs: number): string => `SET LOCAL lock_timeout TO '${assertLockTimeoutMs(timeoutMs)}ms'`

/**
 * Acquire a transaction-scoped advisory lock on the current connection.
 * Callers must already run inside a transaction: the lock is released with it.
 * Uses `hashtextextended(key, 0)` like the rest of the platform so all writers
 * hash a shared key into the same lock space.
 */
export async function acquireAdvisoryXactLock(executor: Pick<DbExecutor, 'query'>, lockKey: string): Promise<void> {
    await executor.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [lockKey])
}

/**
 * Acquire a transaction-scoped two-key advisory lock on the current connection.
 * PostgreSQL exposes a two-key variant only for 32-bit keys, so the pair is
 * combined into one unambiguous text key and hashed into the shared
 * `hashtextextended` space used by every other platform advisory lock.
 */
export async function acquireTwoKeyAdvisoryXactLock(executor: Pick<DbExecutor, 'query'>, leftKey: string, rightKey: string): Promise<void> {
    await executor.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [JSON.stringify([leftKey, rightKey])])
}

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
        await acquireAdvisoryXactLock(tx, lockKey)
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
            'SELECT pg_try_advisory_xact_lock(hashtextextended($1::text, 0)) AS acquired',
            [lockKey]
        )
        if (!acquired) return null
        return work(tx)
    })
}

/**
 * Run `work` inside a transaction that always rolls back on failure, even when
 * the executor reuses an outer middleware transaction (depth 0 is a passthrough
 * on request-scoped RLS executors, so a plain transaction() cannot roll back).
 * The nested call opens a SAVEPOINT in that case; standalone executors simply
 * nest a savepoint inside their own transaction.
 */
export async function withTransactionSavepoint<T>(executor: DbExecutor, work: (tx: DbExecutor) => Promise<T>): Promise<T> {
    return executor.transaction(async (outer) => outer.transaction((tx) => work(tx)))
}
