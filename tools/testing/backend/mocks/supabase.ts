import type { SupabaseClient } from '@supabase/supabase-js'

type SupabaseMethod = 'select' | 'insert' | 'update' | 'delete'

type Filter = {
  column: string
  value: unknown
}

export interface SupabaseQueryContext {
  table: string
  method: SupabaseMethod
  filters: Filter[]
  payload?: unknown
  returning: boolean
}

export type SupabaseHandler = (
  context: SupabaseQueryContext
) => Promise<{ data?: any; error?: any }> | { data?: any; error?: any }

export interface SupabaseTableMockConfig {
  select?: SupabaseHandler
  insert?: SupabaseHandler
  update?: SupabaseHandler
  delete?: SupabaseHandler
}

export interface SupabaseClientMockConfig {
  [table: string]: SupabaseTableMockConfig
}

type SupabaseQueryResult = { data?: any; error?: any }

interface SupabaseQueryBuilder {
  select: jest.Mock<SupabaseQueryBuilder, []>
  insert: jest.Mock<SupabaseQueryBuilder, [unknown]>
  update: jest.Mock<SupabaseQueryBuilder, [unknown]>
  delete: jest.Mock<SupabaseQueryBuilder, []>
  eq: jest.Mock<SupabaseQueryBuilder, [string, unknown]>
  single: jest.Mock<Promise<SupabaseQueryResult>, []>
  maybeSingle: jest.Mock<Promise<SupabaseQueryResult>, []>
  throwOnError: jest.Mock<SupabaseQueryBuilder, []>
  then: jest.Mock<Promise<SupabaseQueryResult>, [any, any?]>
}

const resolveResult = async (
  handler: SupabaseHandler | undefined,
  context: SupabaseQueryContext
) => {
  if (!handler) {
    return { data: undefined, error: null }
  }

  return handler(context)
}

export const createSupabaseClientMock = (
  config: SupabaseClientMockConfig = {}
): jest.Mocked<Pick<SupabaseClient<any, any, any>, 'from'>> & {
  getTableHandler: (table: string) => SupabaseTableMockConfig
} => {
  const getTableHandler = (table: string) => config[table] ?? {}

  const client = {
    from: jest.fn((table: string) => {
      const tableHandlers = getTableHandler(table)
      let method: SupabaseMethod = 'select'
      let payload: unknown
      let returning = false
      const filters: Filter[] = []

      const run = () =>
        Promise.resolve(
          resolveResult(tableHandlers[method], {
            table,
            method,
            filters: [...filters],
            payload,
            returning
          })
        )

      const query: Partial<SupabaseQueryBuilder> = {}

      query.select = jest.fn(() => {
        if (method === 'insert' || method === 'update' || method === 'delete') {
          returning = true
        } else {
          method = 'select'
          returning = true
        }
        return query as SupabaseQueryBuilder
      })

      query.insert = jest.fn((value: unknown) => {
        method = 'insert'
        payload = value
        returning = false
        return query as SupabaseQueryBuilder
      })

      query.update = jest.fn((value: unknown) => {
        method = 'update'
        payload = value
        returning = false
        return query as SupabaseQueryBuilder
      })

      query.delete = jest.fn(() => {
        method = 'delete'
        payload = undefined
        returning = false
        return query as SupabaseQueryBuilder
      })

      query.eq = jest.fn((column: string, value: unknown) => {
        filters.push({ column, value })
        return query as SupabaseQueryBuilder
      })

      query.single = jest.fn(() => {
        returning = true
        return run()
      })

      query.maybeSingle = jest.fn(() => {
        returning = true
        return run()
      })

      query.throwOnError = jest.fn(() => query as SupabaseQueryBuilder)
      query.then = jest.fn((resolve: any, reject: any) => run().then(resolve, reject))

      return query as SupabaseQueryBuilder
    })
  } as jest.Mocked<Pick<SupabaseClient<any, any, any>, 'from'>>

  return Object.assign(client, { getTableHandler })
}

