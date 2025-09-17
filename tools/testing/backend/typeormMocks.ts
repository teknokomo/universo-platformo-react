import type {
  DataSource,
  EntityManager,
  EntityTarget,
  Repository
} from 'typeorm'

export interface MockSelectQueryBuilder<Entity> {
  select: jest.Mock<MockSelectQueryBuilder<Entity>, any>
  addSelect: jest.Mock<MockSelectQueryBuilder<Entity>, any>
  leftJoin: jest.Mock<MockSelectQueryBuilder<Entity>, any>
  leftJoinAndSelect: jest.Mock<MockSelectQueryBuilder<Entity>, any>
  innerJoin: jest.Mock<MockSelectQueryBuilder<Entity>, any>
  innerJoinAndSelect: jest.Mock<MockSelectQueryBuilder<Entity>, any>
  where: jest.Mock<MockSelectQueryBuilder<Entity>, any>
  andWhere: jest.Mock<MockSelectQueryBuilder<Entity>, any>
  orWhere: jest.Mock<MockSelectQueryBuilder<Entity>, any>
  orderBy: jest.Mock<MockSelectQueryBuilder<Entity>, any>
  groupBy: jest.Mock<MockSelectQueryBuilder<Entity>, any>
  having: jest.Mock<MockSelectQueryBuilder<Entity>, any>
  offset: jest.Mock<MockSelectQueryBuilder<Entity>, any>
  limit: jest.Mock<MockSelectQueryBuilder<Entity>, any>
  skip: jest.Mock<MockSelectQueryBuilder<Entity>, any>
  take: jest.Mock<MockSelectQueryBuilder<Entity>, any>
  getOne: jest.Mock<Promise<Entity | null>, []>
  getMany: jest.Mock<Promise<Entity[]>, []>
  getRawOne: jest.Mock<Promise<unknown>, []>
  getRawMany: jest.Mock<Promise<unknown[]>, []>
  getRawAndEntities: jest.Mock<Promise<{ raw: unknown[]; entities: Entity[] }>, []>
  getCount: jest.Mock<Promise<number>, []>
  execute: jest.Mock<Promise<unknown>, []>
}

const createChainableMethod = <Entity>(): jest.Mock<MockSelectQueryBuilder<Entity>, any> =>
  jest.fn().mockReturnThis()

export const createMockQueryBuilder = <Entity>(
  overrides: Partial<MockSelectQueryBuilder<Entity>> = {}
): MockSelectQueryBuilder<Entity> => {
  const builder: MockSelectQueryBuilder<Entity> = {
    select: createChainableMethod(),
    addSelect: createChainableMethod(),
    leftJoin: createChainableMethod(),
    leftJoinAndSelect: createChainableMethod(),
    innerJoin: createChainableMethod(),
    innerJoinAndSelect: createChainableMethod(),
    where: createChainableMethod(),
    andWhere: createChainableMethod(),
    orWhere: createChainableMethod(),
    orderBy: createChainableMethod(),
    groupBy: createChainableMethod(),
    having: createChainableMethod(),
    offset: createChainableMethod(),
    limit: createChainableMethod(),
    skip: createChainableMethod(),
    take: createChainableMethod(),
    getOne: jest.fn(),
    getMany: jest.fn(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
    getRawAndEntities: jest.fn(),
    getCount: jest.fn(),
    execute: jest.fn()
  }

  return Object.assign(builder, overrides)
}

export interface MockRepository<Entity> {
  find: jest.Mock<Promise<Entity[]>, any>
  findOne: jest.Mock<Promise<Entity | null>, any>
  findOneBy: jest.Mock<Promise<Entity | null>, any>
  findOneOrFail: jest.Mock<Promise<Entity>, any>
  findBy: jest.Mock<Promise<Entity[]>, any>
  count: jest.Mock<Promise<number>, any>
  create: jest.Mock<Entity, any>
  save: jest.Mock<Promise<Entity>, any>
  insert: jest.Mock<Promise<unknown>, any>
  update: jest.Mock<Promise<unknown>, any>
  delete: jest.Mock<Promise<unknown>, any>
  softDelete: jest.Mock<Promise<unknown>, any>
  restore: jest.Mock<Promise<unknown>, any>
  createQueryBuilder: jest.Mock<MockSelectQueryBuilder<Entity>, []>
  manager: EntityManager
  queryBuilder: MockSelectQueryBuilder<Entity>
}

export const createMockRepository = <Entity>(
  overrides: Partial<MockRepository<Entity>> = {},
  queryBuilderOverrides: Partial<MockSelectQueryBuilder<Entity>> = {}
): MockRepository<Entity> => {
  const queryBuilder = createMockQueryBuilder<Entity>(queryBuilderOverrides)
  const manager = {
    transaction: jest.fn(async <T>(run: (transactionManager: EntityManager) => Promise<T> | T) => {
      return run?.(manager as unknown as EntityManager) ?? (undefined as unknown as T)
    })
  } as unknown as EntityManager

  const repository: MockRepository<Entity> = {
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => null),
    findOneBy: jest.fn(async () => null),
    findOneOrFail: jest.fn(async () => {
      throw new Error('Entity not found')
    }),
    findBy: jest.fn(async () => []),
    count: jest.fn(async () => 0),
    create: jest.fn((entity?: Entity) => (entity ?? ({} as Entity))),
    save: jest.fn(async (entity?: Entity) => entity ?? ({} as Entity)),
    insert: jest.fn(async () => ({})),
    update: jest.fn(async () => ({})),
    delete: jest.fn(async () => ({})),
    softDelete: jest.fn(async () => ({})),
    restore: jest.fn(async () => ({})),
    createQueryBuilder: jest.fn(() => queryBuilder),
    manager,
    queryBuilder
  }

  return Object.assign(repository, overrides)
}

export type RepositoryFactory = <Entity>(target: EntityTarget<Entity>) => MockRepository<Entity>

export interface TransactionalEntityManager extends EntityManager {
  transaction: jest.Mock<Promise<unknown>, [(manager: EntityManager) => Promise<unknown> | unknown]>
}

export interface MockDataSource {
  isInitialized: boolean
  initialize: jest.Mock<Promise<DataSource>, []>
  destroy: jest.Mock<Promise<void>, []>
  getRepository: jest.Mock<MockRepository<any>, [EntityTarget<any>]>
  manager: TransactionalEntityManager
}

export const createMockDataSource = (
  repositoryFactory: RepositoryFactory | Record<string, MockRepository<any>> = {},
  overrides: Partial<MockDataSource> = {}
): MockDataSource => {
  const resolvedFactory: RepositoryFactory = (target) => {
    if (typeof repositoryFactory === 'function') {
      return repositoryFactory(target)
    }

    const key = typeof target === 'function' ? target.name : String(target)
    const repository = repositoryFactory[key]

    return repository ?? createMockRepository()
  }

  const manager = {
    transaction: jest.fn(async (callback: (manager: EntityManager) => Promise<unknown> | unknown) => {
      return callback?.(manager as unknown as EntityManager)
    })
  } as unknown as TransactionalEntityManager

  const dataSource: MockDataSource = {
    isInitialized: true,
    initialize: jest.fn(async () => dataSource as unknown as DataSource),
    destroy: jest.fn(async () => undefined),
    getRepository: jest.fn(resolvedFactory as RepositoryFactory),
    manager
  }

  return Object.assign(dataSource, overrides)
}

export const asMockRepository = <Entity>(repository: Repository<Entity> | MockRepository<Entity>): MockRepository<Entity> => {
  return repository as MockRepository<Entity>
}
