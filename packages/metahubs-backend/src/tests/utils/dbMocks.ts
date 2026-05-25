import type { DbExecutor } from '@universo/utils'

export function createMockDbExecutor(): DbExecutor {
    const mock: DbExecutor = {
        query: jest.fn().mockResolvedValue([]),
        transaction: jest.fn(async (fn: (exec: DbExecutor) => Promise<unknown>) => fn(mock)),
        isReleased: jest.fn().mockReturnValue(false)
    }
    return mock
}
