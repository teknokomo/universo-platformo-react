import type { Request, Response, NextFunction } from 'express'
import Tokens from 'csrf'

const tokens = new Tokens()

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const EDITOR_COMPATIBILITY_MUTATION_PATH =
    /(?:^|\/)metahub\/[^/]+\/playcanvas\/editor-compatible\/projects\/[^/]+\/(?:assets(?:\/[^/]*)?|sourcefiles(?:\/[^/]*)?|settings\/[^/]+|scenes\/[^/]+|projects\/[^/]+\/repositories\/[^/]+\/sourcefiles(?:\/[^/]*)*)(?:\/[^/]*)?$/

const isEditorCompatibilityMutation = (req: Request): boolean => {
    // The compatibility route guard performs the cryptographic proof and
    // token/origin checks. The global middleware may only defer a request when
    // both transport credentials are present; a bare editor token must still
    // fail the normal CSRF check before route dispatch.
    if (SAFE_METHODS.has(req.method) || !req.get('x-playcanvas-editor-token') || !readToken(req)) return false
    const path = (req.path || req.originalUrl || '').split('?')[0]
    return EDITOR_COMPATIBILITY_MUTATION_PATH.test(path.replace(/^\/api\/v1/, ''))
}

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

        // Compatibility routes perform their own signed-token + CSRF-proof
        // validation. The proof is intentionally stateless because a
        // sandboxed cross-origin Editor frame cannot send the host session
        // cookie. Keep the bypass narrowly scoped to the mutation routes and
        // require both transport headers; the compatibility route guard then
        // verifies the signed proof before allowing the mutation. All other
        // API mutations retain the session-backed CSRF check below.
        if (isEditorCompatibilityMutation(req)) {
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
