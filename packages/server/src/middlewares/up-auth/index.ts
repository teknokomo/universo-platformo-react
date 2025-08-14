import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

/**
 * Middleware to verify JWT token received from Supabase.
 * If token is valid, its decoded payload is saved in req.user.
 * Returns 401 response if token is missing or verification fails.
 */
export const ensureAuth = (req: Request, res: Response, next: NextFunction) => {
	const authHeader = req.headers.authorization
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return res.status(401).json({ error: 'Unauthorized Access: Missing token' })
	}

	const token = authHeader.split(' ')[1]

	try {
		const secret = process.env.SUPABASE_JWT_SECRET
		if (!secret) throw new Error('Supabase JWT secret not configured')

		const decoded = jwt.verify(token, secret)
		;(req as any).user = decoded
		next()
	} catch (error) {
		return res.status(401).json({ error: 'Unauthorized Access: Invalid or expired token' })
	}
}

export default { ensureAuth }
