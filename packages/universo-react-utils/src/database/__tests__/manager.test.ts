import { describe, expect, it, vi } from 'vitest'
import {
    createDbExecutor,
    createDbSession,
    createRequestDbContext,
    getRequestDbContext,
    getRequestDbExecutor,
    getRequestDbSession
} from '../manager'

describe('request db context helpers', () => {
    it('creates a neutral request db context from session and executor', async () => {
        const queryMock = vi.fn().mockResolvedValue([{ id: 1 }])
        const isReleasedMock = vi.fn().mockReturnValue(false)
        const session = createDbSession({
            query: queryMock,
            isReleased: isReleasedMock
        })
        const executor = createDbExecutor({
            query: vi.fn().mockResolvedValue([{ id: 2 }]),
            transaction: vi.fn(async (cb) => cb(executor)),
            isReleased: isReleasedMock
        })

        const context = createRequestDbContext(session, executor)

        expect(context.session).toBe(session)
        expect(context.executor).toBe(executor)
        expect(context.isReleased()).toBe(false)
        expect('manager' in context).toBe(false)
        expect('getRepository' in context).toBe(false)
        await expect(context.query('select 1')).resolves.toEqual([{ id: 1 }])
        expect(queryMock).toHaveBeenCalledWith('select 1', undefined)
    })

    it('returns request-scoped helpers when db context is attached', () => {
        const queryMock = vi.fn().mockResolvedValue([])
        const isReleasedMock = vi.fn().mockReturnValue(false)
        const session = createDbSession({
            query: queryMock,
            isReleased: isReleasedMock
        })
        const executor = createDbExecutor({
            query: vi.fn().mockResolvedValue([]),
            transaction: vi.fn(async (cb) => cb(executor)),
            isReleased: isReleasedMock
        })
        const context = createRequestDbContext(session, executor)
        const req = { dbContext: context }

        expect(getRequestDbContext(req)).toBe(context)
        expect(getRequestDbSession(req)).toBe(session)
        expect(getRequestDbExecutor(req, executor)).toBe(context.executor)
    })

    it('falls back to the provided executor when request has no db context', () => {
        const fallbackExecutor = createDbExecutor({
            query: vi.fn().mockResolvedValue([]),
            transaction: vi.fn(async (cb) => cb(fallbackExecutor)),
            isReleased: () => false
        })

        expect(getRequestDbContext({})).toBeUndefined()
        expect(getRequestDbSession({})).toBeUndefined()
        expect(getRequestDbExecutor({}, fallbackExecutor)).toBe(fallbackExecutor)
    })

    it('creates a standalone db executor', async () => {
        const queryMock = vi.fn().mockResolvedValue([{ id: 1 }])
        const transactionMock = vi.fn(async (callback) =>
            callback(
                createDbExecutor({
                    query: vi.fn().mockResolvedValue([{ id: 2 }]),
                    transaction: vi.fn(async (nested) =>
                        nested(
                            createDbExecutor({
                                query: vi.fn().mockResolvedValue([{ id: 3 }]),
                                transaction: vi.fn(async () => []),
                                isReleased: () => false
                            })
                        )
                    ),
                    isReleased: () => false
                })
            )
        )
        const executor = createDbExecutor({
            query: queryMock,
            transaction: transactionMock,
            isReleased: () => false
        })

        await expect(executor.query('select 1')).resolves.toEqual([{ id: 1 }])
        await expect(executor.transaction(async (tx) => tx.query('select 2'))).resolves.toEqual([{ id: 2 }])
        expect(queryMock).toHaveBeenCalledWith('select 1', undefined)
        expect(transactionMock).toHaveBeenCalled()
        expect(executor.isReleased()).toBe(false)
    })
})
