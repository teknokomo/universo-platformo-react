import { describe, expect, it, vi } from 'vitest'
import {
    createDbExecutor,
    createDbSession,
    createRequestDbContext,
    getRequestDbExecutor
} from '../manager'
import { withTransaction } from '../transactions'
import { withAdvisoryLock } from '../locks'
import type { DbExecutor } from '../manager'

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 7.1 — Cross-cutting integration contract tests
// Verifies DbExecutor contract invariants across query, transaction, lock layers
// ═══════════════════════════════════════════════════════════════════════════════

function makeExecutor(opts?: { released?: boolean }): DbExecutor & { calls: string[] } {
    const calls: string[] = []
    const txExec: DbExecutor = {
        query: vi.fn(async (sql: string) => {
            calls.push(`tx:${sql}`)
            return []
        }),
        transaction: vi.fn(async (cb) => cb(txExec)),
        isReleased: () => false
    }
    const exec = createDbExecutor({
        query: async (sql, params) => {
            calls.push(`pool:${sql}`)
            return []
        },
        transaction: async (cb) => cb(txExec),
        isReleased: () => opts?.released ?? false
    })
    return Object.assign(exec, { calls })
}

describe('executor contract invariants', () => {
    it('query always returns an array', async () => {
        const exec = makeExecutor()
        const result = await exec.query('SELECT 1')
        expect(Array.isArray(result)).toBe(true)
    })

    it('transaction callback receives a distinct executor', async () => {
        const exec = makeExecutor()
        let txRef: DbExecutor | null = null
        await exec.transaction(async (tx) => { txRef = tx })
        expect(txRef).not.toBeNull()
        expect(txRef).not.toBe(exec)
    })

    it('transaction propagates callback errors', async () => {
        const exec = makeExecutor()
        await expect(
            exec.transaction(async () => { throw new Error('rollback') })
        ).rejects.toThrow('rollback')
    })

    it('transaction returns callback result', async () => {
        const exec = makeExecutor()
        const result = await exec.transaction(async () => 42)
        expect(result).toBe(42)
    })
})

describe('request context isolation', () => {
    it('request executor is distinct from pool fallback', () => {
        const poolExec = makeExecutor()
        const reqSession = createDbSession({ query: vi.fn().mockResolvedValue([]), isReleased: () => false })
        const reqExec = createDbExecutor({
            query: vi.fn().mockResolvedValue([]),
            transaction: vi.fn(async (cb) => cb(reqExec)),
            isReleased: () => false
        })
        const ctx = createRequestDbContext(reqSession, reqExec)
        const req = { dbContext: ctx }

        const resolved = getRequestDbExecutor(req, poolExec)
        expect(resolved).toBe(reqExec)
        expect(resolved).not.toBe(poolExec)
    })

    it('pool fallback used when no request context', () => {
        const poolExec = makeExecutor()
        const resolved = getRequestDbExecutor({}, poolExec)
        expect(resolved).toBe(poolExec)
    })
})

describe('cross-layer: transaction + advisory lock', () => {
    it('advisory lock runs inside transaction boundary', async () => {
        const exec = makeExecutor()
        await withAdvisoryLock(exec, 'test-key', async () => 'ok')
        const lockCall = exec.calls.find((c) => c.includes('pg_advisory_xact_lock'))
        expect(lockCall).toBeDefined()
        expect(lockCall).toContain('tx:')
    })

    it('withTransaction + withAdvisoryLock compose without deadlock', async () => {
        const exec = makeExecutor()
        const result = await withTransaction(exec, async (tx) => {
            return withAdvisoryLock(tx, 'key', async () => 'composed')
        })
        expect(result).toBe('composed')
    })
})

describe('released executor contract', () => {
    it('isReleased reflects lifecycle state', () => {
        const active = makeExecutor({ released: false })
        expect(active.isReleased()).toBe(false)

        const released = makeExecutor({ released: true })
        expect(released.isReleased()).toBe(true)
    })
})
