import type { Request, Response, NextFunction } from 'express'
import Tokens from 'csrf'

const tokens = new Tokens()

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Read token from standard locations following the same precedence as csurf:
 * body._csrf → query._csrf → headers (csrf-token, xsrf-token, x-csrf-token, x-xsrf-token).
 * Uses req.get() for headers to safely handle string | string[] values.
 */
function readToken(req: Request): string | undefined {
    return (
        ((req.body as Record<string, unknown> | undefined)?._csrf as string | undefined) ??
        ((req.query as Record<string, unknown> | undefined)?._csrf as string | undefined) ??
        req.get('csrf-token') ??
        req.get('xsrf-token') ??
        req.get('x-csrf-token') ??
        req.get('x-xsrf-token')
    )
}

export function createCsrfProtection() {
    return function csrfProtection(req: Request, res: Response, next: NextFunction) {
        if (!req.session.csrfSecret) {
            req.session.csrfSecret = tokens.secretSync()
        }

        const secret = req.session.csrfSecret
        req.csrfToken = () => tokens.create(secret)

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
