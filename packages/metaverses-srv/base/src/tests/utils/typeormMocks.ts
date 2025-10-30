export type MockRepository<_T> = {
    createQueryBuilder: jest.Mock
    find: jest.Mock
    findOne: jest.Mock
    create: jest.Mock
    save: jest.Mock
    update: jest.Mock
    delete: jest.Mock
    remove: jest.Mock
}

export const createMockRepository = <T extends object>(): MockRepository<T> => {
    const queryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
        getOne: jest.fn().mockResolvedValue(null),
        getMany: jest.fn().mockResolvedValue([]),
        getSql: jest.fn().mockReturnValue('SELECT * FROM mock'),
        getParameters: jest.fn().mockReturnValue({})
    }

    return {
        createQueryBuilder: jest.fn(() => queryBuilder),
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((entity: any) => ({ ...entity, id: 'mock-id' })),
        save: jest.fn().mockImplementation((entity: any) => Promise.resolve({ ...entity, id: entity.id || 'mock-id' })),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
        remove: jest.fn().mockImplementation((entity: any) => Promise.resolve(entity))
    }
}

type RepoMap = Record<string, any>

export const createMockDataSource = (repositories: RepoMap, options: { isInitialized?: boolean } = {}) => {
    const getRepository = jest.fn((entity: any) => {
        if (typeof entity === 'string') {
            return repositories[entity]
        }
        return repositories[entity?.name] || repositories[entity]
    })

    const manager: any = {
        getRepository
    }

    const dataSource: any = {
        isInitialized: options.isInitialized ?? false,
        initialize: jest.fn(async () => {
            dataSource.isInitialized = true
            return dataSource
        }),
        getRepository,
        manager
    }
    return dataSource
}
