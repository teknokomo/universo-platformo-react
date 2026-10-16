import type { DbExecutor } from '@universo-react/utils'

export interface MockDbExecutor extends DbExecutor {
    query: jest.Mock
    transaction: jest.Mock
    isReleased: jest.Mock
}

export function createMockDbExecutor(): { executor: MockDbExecutor; txExecutor: MockDbExecutor } {
    // Keep the historical empty-result default when a test never configures
    // `executor.query`.
    const executorQuery: jest.Mock = jest.fn().mockResolvedValue([])

    // Nested transaction callbacks route unconfigured `txExecutor.query` calls
    // through the parent's query mock, mirroring the real RLS executor where a
    // savepoint shares the parent connection. Tests that configure
    // `txExecutor.query.mockImplementation(...)` replace the delegation.
    const txQuery: jest.Mock = jest.fn(async (sql: string, params?: unknown[]) => executorQuery(sql, params))

    const txExecutor: MockDbExecutor = {
        query: txQuery,
        transaction: jest.fn(async (fn: (exec: DbExecutor) => Promise<unknown>) => fn(txExecutor)),
        isReleased: jest.fn().mockReturnValue(false)
    }
    const executor: MockDbExecutor = {
        query: executorQuery,
        transaction: jest.fn(async (fn: (exec: DbExecutor) => Promise<unknown>) => fn(txExecutor)),
        isReleased: jest.fn().mockReturnValue(false)
    }
    return { executor, txExecutor }
}

export interface MockDataStore {
    find: jest.Mock
    findOne: jest.Mock
    save: jest.Mock
    update: jest.Mock
    count: jest.Mock
}

export function createMockDataStore(): MockDataStore {
    return {
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue(null),
        save: jest
            .fn()
            .mockImplementation((entity: unknown) =>
                Promise.resolve({ ...(entity as object), id: (entity as { id?: string }).id || 'mock-id' })
            ),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        count: jest.fn().mockResolvedValue(0)
    }
}
