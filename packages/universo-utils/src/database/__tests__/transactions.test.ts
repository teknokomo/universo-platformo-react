import { describe, expect, it, vi } from 'vitest'
import { withTransaction } from '../transactions'
import type { DbExecutor } from '../manager'

function mockExecutor(): DbExecutor {
    const queries: string[] = []
    const txExecutor: DbExecutor = {
        query: vi.fn(async (sql: string) => {
            queries.push(sql)
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

describe('withTransaction', () => {
    it('wraps work in transaction', async () => {
        const exec = mockExecutor()
        const result = await withTransaction(exec, async () => 'hello')
        expect(result).toBe('hello')
        expect(exec.transaction).toHaveBeenCalledTimes(1)
    })

    it('sets statement_timeout when specified', async () => {
        const exec = mockExecutor()
        const txExec = (exec as any)._txExecutor
        await withTransaction(exec, async () => 1, { statementTimeoutMs: 10000 })
        expect(txExec.query).toHaveBeenCalledWith("SET LOCAL statement_timeout TO '10000ms'")
    })

    it('inherits 300s cap from statementTimeout helper', async () => {
        const exec = mockExecutor()
        await expect(withTransaction(exec, async () => 1, { statementTimeoutMs: 300001 })).rejects.toThrow('Invalid statement_timeout')
    })

    it('does not set timeout when not specified', async () => {
        const exec = mockExecutor()
        const txExec = (exec as any)._txExecutor
        await withTransaction(exec, async () => 1)
        expect(txExec.query).not.toHaveBeenCalled()
    })
})
