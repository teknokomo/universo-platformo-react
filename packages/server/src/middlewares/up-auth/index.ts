import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

/**
 * Middleware для проверки JWT-токена, полученного от Supabase.
 * Если токен корректный, его декодированный пейлоуд сохраняется в req.user.
 * При отсутствии токена или ошибке верификации возвращается ответ с кодом 401.
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

        // Проверяем и декодируем токен
        const decoded = jwt.verify(token, secret)
        console.log('[up-auth] JWT token successfully verified. Decoded payload:', decoded)

        // Сохраняем данные из токена в req.user
        ;(req as any).user = decoded

        // Переходим к следующему middleware или маршруту
        next()
    } catch (error) {
        console.error('[up-auth] JWT verification error:', error)
        return res.status(401).json({ error: 'Unauthorized Access: Invalid or expired token' })
    }
}

export default { ensureAuth }
