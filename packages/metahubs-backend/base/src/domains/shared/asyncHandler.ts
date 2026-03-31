import type { Request, Response, RequestHandler } from 'express'

export const asyncHandler =
    (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    (req, res, next) => {
        Promise.resolve(fn(req, res)).catch(next)
    }
