import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

/**
 * Middleware to verify JWT token received from Supabase.
 * If token is valid, its decoded payload is saved in req.user.
 * Returns 401 response if token is missing or verification fails.
 */
export const ensureAuth = (req: Request, res: Response, next: NextFunction) => {
    console.log('[up-auth] ensureAuth middleware triggered.')

    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error('[up-auth] Missing or invalid Authorization header:', authHeader)
        return res.status(401).json({ error: 'Unauthorized Access: Missing token' })
    }

    const token = authHeader.split(' ')[1]
    console.log('[up-auth] Received token:', token ? token.substring(0, 10) + '...' : 'none')

    try {
        const secret = process.env.SUPABASE_JWT_SECRET
        if (!secret) {
            console.error('[up-auth] SUPABASE_JWT_SECRET is not configured.')
            throw new Error('Supabase JWT secret not configured')
        }

        // Verify token
        const decoded = jwt.verify(token, secret)
        console.log('[up-auth] JWT token successfully verified. Decoded payload:', decoded)

        // Save token payload to req.user
        ;(req as any).user = decoded

        // Proceed to next middleware or route
        next()
    } catch (error) {
        console.error('[up-auth] JWT verification error:', error)
        return res.status(401).json({ error: 'Unauthorized Access: Invalid or expired token' })
    }
}

export default { ensureAuth }