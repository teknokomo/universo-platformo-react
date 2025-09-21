export type MockRepository<T> = {
  find: jest.Mock
  findOne: jest.Mock
  findOneBy: jest.Mock
  createQueryBuilder: jest.Mock
  queryBuilder: {
    update: jest.Mock
    set: jest.Mock
    where: jest.Mock
    returning: jest.Mock
    execute: jest.Mock
  }
  create: jest.Mock
  save: jest.Mock
  delete: jest.Mock
}

export const createMockRepository = <T extends object>(): MockRepository<T> => {
  const queryBuilder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute: jest.fn()
  }

  return {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
    queryBuilder,
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn()
  }
}

type RepoMap = Record<string, any>

export const createMockDataSource = (repositories: RepoMap) => {
  return {
    getRepository: jest.fn((entity: any) => {
      if (typeof entity === 'string') {
        return repositories[entity]
      }
      return repositories[entity?.name] ?? repositories[entity]
    })
  } as any
}
