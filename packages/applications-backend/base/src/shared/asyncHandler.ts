import type { Request, Response, RequestHandler } from 'express'

export const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<Response | void>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next)
  }
