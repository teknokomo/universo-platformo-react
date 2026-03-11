import type { DbExecutor } from '@universo/utils'

export interface MockDbExecutor extends DbExecutor {
    query: jest.Mock
    transaction: jest.Mock
    isReleased: jest.Mock
}

export function createMockDbExecutor(): { executor: MockDbExecutor; txExecutor: MockDbExecutor } {
    const txExecutor: MockDbExecutor = {
        query: jest.fn().mockResolvedValue([]),
        transaction: jest.fn(async (fn: (exec: DbExecutor) => Promise<unknown>) => fn(txExecutor)),
        isReleased: jest.fn().mockReturnValue(false)
    }
    const executor: MockDbExecutor = {
        query: jest.fn().mockResolvedValue([]),
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
