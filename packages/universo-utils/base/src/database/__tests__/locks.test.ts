import { describe, expect, it, vi } from 'vitest'
import { withAdvisoryLock, tryWithAdvisoryLock } from '../locks'
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
        expect(txExec.query).toHaveBeenNthCalledWith(1,
            "SET LOCAL lock_timeout TO '5000ms'"
        )
    })

    it('calls pg_advisory_xact_lock with hashtext', async () => {
        const exec = mockExecutor()
        const txExec = (exec as any)._txExecutor
        await withAdvisoryLock(exec, 'my-key', async () => 1)
        expect(txExec.query).toHaveBeenCalledWith(
            'SELECT pg_advisory_xact_lock(hashtext($1))',
            ['my-key']
        )
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
        await expect(
            withAdvisoryLock(exec, 'key', async () => 1, { timeoutMs: -1 })
        ).rejects.toThrow('Invalid lock_timeout')
    })

    it('rejects non-integer timeout', async () => {
        const exec = mockExecutor()
        await expect(
            withAdvisoryLock(exec, 'key', async () => 1, { timeoutMs: 1.5 })
        ).rejects.toThrow('Invalid lock_timeout')
    })

    it('rejects timeout exceeding 300000ms', async () => {
        const exec = mockExecutor()
        await expect(
            withAdvisoryLock(exec, 'key', async () => 1, { timeoutMs: 300001 })
        ).rejects.toThrow('Invalid lock_timeout')
    })
})
