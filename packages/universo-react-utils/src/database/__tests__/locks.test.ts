import { describe, expect, it, vi } from 'vitest'
import { acquireTwoKeyAdvisoryXactLock, tryWithAdvisoryLock, withAdvisoryLock, withTransactionSavepoint } from '../locks'
import type { DbExecutor } from '../manager'

function mockExecutor(): DbExecutor {
    const queries: { sql: string; params?: unknown[] }[] = []
    const txExecutor: DbExecutor = {
        query: vi.fn(async (sql: string, params?: unknown[]) => {
            queries.push({ sql, params })
            if (sql.includes('pg_try_advisory_xact_lock')) {
                return [{ acquired: true }]
            }
            return []
        }),
        transaction: vi.fn(async (cb) => cb(txExecutor)),
        isReleased: () => false
    }
    const executor: DbExecutor = {
        query: vi.fn(),
        transaction: vi.fn(async (cb) => cb(txExecutor)),
        isReleased: () => false
    }
    return Object.assign(executor, { _queries: queries, _txExecutor: txExecutor })
}

describe('withAdvisoryLock', () => {
    it('acquires lock and runs work in transaction', async () => {
        const exec = mockExecutor()
        const result = await withAdvisoryLock(exec, 'test-lock', async () => 42)
        expect(result).toBe(42)
        expect(exec.transaction).toHaveBeenCalledTimes(1)
    })

    it('sets lock_timeout when timeoutMs is specified', async () => {
        const exec = mockExecutor()
        const txExec = (exec as any)._txExecutor
        await withAdvisoryLock(exec, 'test-lock', async () => 1, { timeoutMs: 5000 })
        expect(txExec.query).toHaveBeenNthCalledWith(1, "SET LOCAL lock_timeout TO '5000ms'")
    })

    it('calls pg_advisory_xact_lock with the shared hashtextextended space', async () => {
        const exec = mockExecutor()
        const txExec = (exec as any)._txExecutor
        await withAdvisoryLock(exec, 'my-key', async () => 1)
        expect(txExec.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', ['my-key'])
    })
})

describe('acquireTwoKeyAdvisoryXactLock', () => {
    it('hashes one unambiguous pair key into the shared hashtextextended space', async () => {
        const exec = mockExecutor()
        await acquireTwoKeyAdvisoryXactLock(exec, 'interpretation-network:reorder', 'app:workspace:widget')
        expect(exec.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [
            JSON.stringify(['interpretation-network:reorder', 'app:workspace:widget'])
        ])
    })

    it('does not collide swapped or concatenated-looking pairs', async () => {
        const exec = mockExecutor()
        await acquireTwoKeyAdvisoryXactLock(exec, 'a', 'bc')
        await acquireTwoKeyAdvisoryXactLock(exec, 'ab', 'c')
        await acquireTwoKeyAdvisoryXactLock(exec, 'bc', 'a')
        const keys = vi.mocked(exec.query).mock.calls.map(([, params]) => (params as string[])[0])
        expect(new Set(keys).size).toBe(3)
    })
})

describe('tryWithAdvisoryLock', () => {
    it('runs work when lock acquired', async () => {
        const exec = mockExecutor()
        const result = await tryWithAdvisoryLock(exec, 'key', async () => 'done')
        expect(result).toBe('done')
    })

    it('returns null when lock not acquired', async () => {
        const exec = mockExecutor()
        const txExec = (exec as any)._txExecutor
        txExec.query = vi.fn(async (sql: string) => {
            if (sql.includes('pg_try_advisory_xact_lock')) return [{ acquired: false }]
            return []
        })
        const result = await tryWithAdvisoryLock(exec, 'key', async () => 'done')
        expect(result).toBeNull()
    })
})

describe('lock timeout validation', () => {
    it('rejects negative timeout', async () => {
        const exec = mockExecutor()
        await expect(withAdvisoryLock(exec, 'key', async () => 1, { timeoutMs: -1 })).rejects.toThrow('Invalid lock_timeout')
    })

    it('rejects non-integer timeout', async () => {
        const exec = mockExecutor()
        await expect(withAdvisoryLock(exec, 'key', async () => 1, { timeoutMs: 1.5 })).rejects.toThrow('Invalid lock_timeout')
    })

    it('rejects timeout exceeding 300000ms', async () => {
        const exec = mockExecutor()
        await expect(withAdvisoryLock(exec, 'key', async () => 1, { timeoutMs: 300001 })).rejects.toThrow('Invalid lock_timeout')
    })
})

describe('withTransactionSavepoint', () => {
    it('opens a nested transaction so failures roll back inside a reused outer transaction', async () => {
        const outerQueries: string[] = []
        const innerExecutor = {
            query: vi.fn(async () => []),
            transaction: vi.fn(async (cb: (exec: unknown) => Promise<unknown>) => cb({ query: vi.fn(async () => []) })),
            isReleased: () => false
        }
        const outerExecutor = {
            transaction: vi.fn(async (cb: (exec: unknown) => Promise<unknown>) => {
                outerQueries.push('outer')
                return cb(innerExecutor)
            }),
            query: vi.fn(async () => []),
            isReleased: () => false
        }

        let received: unknown
        const result = await withTransactionSavepoint(outerExecutor as never, async (executor) => {
            received = executor
            return 'ok'
        })

        expect(result).toBe('ok')
        expect(received).toBeDefined()
        expect(received).not.toBe(innerExecutor)
        expect(outerExecutor.transaction).toHaveBeenCalledTimes(1)
        expect(innerExecutor.transaction).toHaveBeenCalledTimes(1)
        await expect(
            withTransactionSavepoint(outerExecutor as never, async () => {
                throw new Error('boom')
            })
        ).rejects.toThrow('boom')
    })
})
