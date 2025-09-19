export type MockRepository<T> = {
  find: jest.Mock
  findOne: jest.Mock
  findOneBy: jest.Mock
  createQueryBuilder: jest.Mock
  queryBuilder: {
    where: jest.Mock
    andWhere: jest.Mock
    getOne: jest.Mock
  }
  create: jest.Mock
  save: jest.Mock
  update: jest.Mock
  delete: jest.Mock
}

export const createMockRepository = <T extends object>(): MockRepository<T> => {
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn()
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
