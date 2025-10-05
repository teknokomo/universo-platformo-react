export type MockRepository<_T> = {
    find: jest.Mock
    findOne: jest.Mock
    findOneBy: jest.Mock
    createQueryBuilder: jest.Mock
    queryBuilder: {
        where: jest.Mock
        andWhere: jest.Mock
        innerJoin: jest.Mock
        leftJoin: jest.Mock
        select: jest.Mock
        addSelect: jest.Mock
        groupBy: jest.Mock
        addGroupBy: jest.Mock
        orderBy: jest.Mock
        limit: jest.Mock
        offset: jest.Mock
        getOne: jest.Mock
        getMany: jest.Mock
        getRawOne: jest.Mock
        getRawMany: jest.Mock
    }
    create: jest.Mock
    save: jest.Mock
    update: jest.Mock
    delete: jest.Mock
}

export function createMockRepository<_T>(): MockRepository<_T> {
    const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
        getMany: jest.fn(),
        getRawOne: jest.fn(),
        getRawMany: jest.fn()
    }

    return {
        find: jest.fn(),
        findOne: jest.fn(),
        findOneBy: jest.fn(),
        createQueryBuilder: jest.fn(() => queryBuilder),
        queryBuilder,
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
    }
}

type RepoMap = Record<string, any> | Map<any, any>

export const createMockDataSource = (repositories: RepoMap, options: { isInitialized?: boolean } = {}) => {
    const mapLookup = repositories instanceof Map
    const dataSource: any = {
        isInitialized: options.isInitialized ?? false,
        initialize: jest.fn(async () => {
            dataSource.isInitialized = true
            return dataSource
        }),
        getRepository: jest.fn((entity: any) => {
            if (mapLookup) {
                return (repositories as Map<any, any>).get(entity) || (repositories as Map<any, any>).get(entity?.name)
            }
            if (typeof entity === 'string') {
                return (repositories as Record<string, any>)[entity]
            }
            return (repositories as Record<string, any>)[entity?.name] || (repositories as Record<string, any>)[entity]
        })
    }
    return dataSource
}
