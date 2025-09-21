import type { Request, Response, NextFunction } from 'express'
import {
        ensureAuthenticated,
        ensureAndRefresh,
        type AuthenticatedRequest,
        type SessionTokens,
} from '../services/supabaseSession'

const setAuthorizationHeader = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const tokens: SessionTokens | undefined = req.session?.tokens
        if (!tokens?.access) {
                return res.status(401).json({ error: 'Unauthorized Access: Missing session token' })
        }

        req.headers.authorization = `Bearer ${tokens.access}`
        return next()
}

export const ensureAuth = (req: Request, res: Response, next: NextFunction) => {
        const request = req as AuthenticatedRequest
        ensureAuthenticated(request, res, async () => {
                await ensureAndRefresh(request, res, () => {
                        setAuthorizationHeader(request, res, next)
                })
        })
}

export default ensureAuth
