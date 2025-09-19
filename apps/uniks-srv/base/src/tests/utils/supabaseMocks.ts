import type { Request, Response, NextFunction } from 'express'

export type SupabaseHandler = jest.Mock<Promise<any>, [
  {
    table: string
    method: string
    filters: Array<{ column: string; value: string }>
    payload?: any
    returning: boolean
  }
]>

export type SupabaseTableMocks = Record<string, Partial<Record<'select' | 'insert' | 'update' | 'delete', SupabaseHandler>>>

export type SupabaseClientMockConfig = SupabaseTableMocks

export const createSupabaseClientMock = (config: SupabaseClientMockConfig) => {
  const client: any = {
    from: jest.fn((table: string) => {
      const handlers = config[table] || {}
      return {
        select: handlers.select || jest.fn().mockResolvedValue({ data: null, error: null }),
        insert: handlers.insert || jest.fn().mockResolvedValue({ data: null, error: null }),
        update: handlers.update || jest.fn().mockResolvedValue({ data: null, error: null }),
        delete: handlers.delete || jest.fn().mockResolvedValue({ data: null, error: null })
      }
    })
  }

  return client
}

export const ensureAuth = (user?: { sub: string }) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (user) {
      ;(req as any).user = user
    }
    next()
  }
