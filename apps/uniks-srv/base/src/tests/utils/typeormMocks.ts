export type MockRepository<_T = any> = {
    find: jest.Mock
    findOne: jest.Mock
    findOneBy: jest.Mock
    createQueryBuilder: jest.Mock
    create: jest.Mock
    save: jest.Mock
    delete: jest.Mock
}

export const createMockRepository = <T extends object>(): MockRepository<T> => {
    const queryBuilder = {
        // Basic query methods
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn(),
        // Query builder methods for uniksRoutes
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
        getMany: jest.fn().mockResolvedValue([]),
        getOne: jest.fn().mockResolvedValue(null)
    }

    return {
        find: jest.fn(),
        findOne: jest.fn(),
        findOneBy: jest.fn(),
        createQueryBuilder: jest.fn(() => queryBuilder),
        create: jest.fn(),
        save: jest.fn(),
        delete: jest.fn()
    }
}

type RepoMap = Record<string, any>

export const createMockDataSource = (repositories: RepoMap, overrides?: { transaction?: jest.Mock }) => {
    const dataSource: any = {
        getRepository: jest.fn((entity: any) => {
            if (typeof entity === 'string') {
                return repositories[entity]
            }
            return repositories[entity?.name] ?? repositories[entity]
        }),
        transaction: overrides?.transaction ?? jest.fn()
    }

    return dataSource as any
}
