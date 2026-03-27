import type { Request, Response, NextFunction } from 'express'
import Tokens from 'csrf'

const tokens = new Tokens()

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Read token from standard locations: headers, body, query.
 * Header names follow the same convention as the deprecated csurf package.
 */
function readToken(req: Request): string | undefined {
    return (
        (req.headers['csrf-token'] as string | undefined) ??
        (req.headers['xsrf-token'] as string | undefined) ??
        (req.headers['x-csrf-token'] as string | undefined) ??
        (req.headers['x-xsrf-token'] as string | undefined) ??
        ((req.body as Record<string, unknown> | undefined)?._csrf as string | undefined)
    )
}

export function createCsrfProtection() {
    return function csrfProtection(req: Request, res: Response, next: NextFunction) {
        const session = req.session as typeof req.session & { csrfSecret?: string }

        if (!session.csrfSecret) {
            session.csrfSecret = tokens.secretSync()
        }

        const secret = session.csrfSecret
        ;(req as Request & { csrfToken: () => string }).csrfToken = () => tokens.create(secret)

        if (SAFE_METHODS.has(req.method)) {
            return next()
        }

        const token = readToken(req)
        if (!token || !tokens.verify(secret, token)) {
            const err: Error & { code?: string; status?: number } = new Error('invalid csrf token')
            err.code = 'EBADCSRFTOKEN'
            err.status = 403
            return next(err)
        }

        next()
    }
}
