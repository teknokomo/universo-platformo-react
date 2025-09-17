import { afterEach, expect, jest } from '@jest/globals'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  createMockDataSource,
  createMockQueryBuilder,
  createMockRepository,
  asMockRepository,
  type MockDataSource,
  type MockRepository,
  type MockSelectQueryBuilder,
  type TransactionalEntityManager
} from './typeormMocks'

type SupabaseClientMock = jest.Mocked<SupabaseClient<any, any, any>>

type QueryResult = {
  select: jest.Mock<any, any>
  insert: jest.Mock<any, any>
  update: jest.Mock<any, any>
  upsert: jest.Mock<any, any>
  'delete': jest.Mock<any, any>
  eq: jest.Mock<any, any>
  neq: jest.Mock<any, any>
  'in': jest.Mock<any, any>
  contains: jest.Mock<any, any>
  order: jest.Mock<any, any>
  range: jest.Mock<any, any>
  limit: jest.Mock<any, any>
  single: jest.Mock<any, any>
  maybeSingle: jest.Mock<any, any>
  throwOnError: jest.Mock<any, any>
}

const createQueryResult = (): QueryResult => {
  const result = {} as QueryResult
  const chain = () => jest.fn().mockReturnValue(result)

  Object.assign(result, {
    select: chain(),
    insert: chain(),
    update: chain(),
    upsert: chain(),
    'delete': chain(),
    eq: chain(),
    neq: chain(),
    'in': chain(),
    contains: chain(),
    order: chain(),
    range: chain(),
    limit: chain(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    throwOnError: chain()
  })

  return result
}

const createMockSupabaseClient = (
  overrides: Partial<SupabaseClientMock> = {}
): SupabaseClientMock => {
  const queryResult = createQueryResult()
  const storageBucket = {
    upload: jest.fn(),
    download: jest.fn(),
    remove: jest.fn()
  }

  const client = {
    auth: {
      getSession: jest.fn(),
      getUser: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn()
    },
    from: jest.fn(() => ({ ...queryResult })),
    rpc: jest.fn(),
    storage: {
      from: jest.fn(() => ({ ...storageBucket }))
    },
    functions: {
      invoke: jest.fn()
    },
    channel: jest.fn(),
    getChannels: jest.fn(() => []),
    removeChannel: jest.fn(),
    removeAllChannels: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn()
  } as unknown as SupabaseClientMock

  return Object.assign(client, overrides)
}

type JestMock = { mock: { calls: unknown[][] } }

declare global {
  // eslint-disable-next-line no-var
  var createMockSupabaseClient: (
    overrides?: Partial<SupabaseClientMock>
  ) => SupabaseClientMock
  // eslint-disable-next-line no-var
  var createMockRepository: typeof createMockRepository
  // eslint-disable-next-line no-var
  var createMockQueryBuilder: typeof createMockQueryBuilder
  // eslint-disable-next-line no-var
  var createMockDataSource: typeof createMockDataSource
}

declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveBeenCalledOnceWith(...expected: unknown[]): R
    }

    interface Expect {
      toHaveBeenCalledOnceWith(...expected: unknown[]): void
    }

    interface InverseAsymmetricMatchers {
      toHaveBeenCalledOnceWith(...expected: unknown[]): void
    }
  }
}

expect.extend({
  toHaveBeenCalledOnceWith(received: unknown, ...expected: unknown[]) {
    const matcherName = 'toHaveBeenCalledOnceWith'
    const passMessage = () =>
      `expected mock not to be called once with ${this.utils.printExpected(expected)}`
    const failMessage = (error: string) =>
      `${matcherName} expected a Jest mock. ${error}`

    if (!received || typeof received !== 'function' || !(received as JestMock).mock) {
      return {
        pass: false,
        message: () => failMessage('The received value is not a mock function.')
      }
    }

    const { calls } = (received as JestMock).mock
    const pass = calls.length === 1 && this.equals(calls[0], expected)

    return {
      pass,
      message: () =>
        pass
          ? passMessage()
          : `expected mock to be called exactly once with ${this.utils.printExpected(expected)} but received ${this.utils.printReceived(calls)}`
    }
  }
})

afterEach(() => {
  jest.clearAllMocks()
})

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test'
}

jest.mock('@supabase/supabase-js', () => {
  const actual = jest.requireActual('@supabase/supabase-js') as Record<string, unknown>

  return {
    __esModule: true,
    ...actual,
    createClient: jest.fn(() => createMockSupabaseClient())
  }
})

global.createMockSupabaseClient = createMockSupabaseClient
global.createMockRepository = createMockRepository
global.createMockQueryBuilder = createMockQueryBuilder
global.createMockDataSource = createMockDataSource

export {
  createMockSupabaseClient,
  createMockRepository,
  createMockQueryBuilder,
  createMockDataSource,
  asMockRepository,
  MockDataSource,
  MockRepository,
  MockSelectQueryBuilder,
  TransactionalEntityManager
}
