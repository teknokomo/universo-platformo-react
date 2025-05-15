// Universo Platformo | Simple auth middleware for publish service
import { Request, Response, NextFunction } from 'express'

/**
 * Middleware для проверки авторизации
 * В реальной имплементации здесь должна быть проверка JWT токена или другой механизм
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    try {
        // Проверка наличия заголовка Authorization
        const authHeader = req.headers.authorization

        // В реальном приложении здесь будет полноценная проверка токена
        // Для демо версии просто проверяем наличие заголовка
        if (!authHeader) {
            // Для демонстрационных целей мы пропускаем запросы даже без авторизации
            console.log('[authMiddleware] Warning: Request without authorization header, allowing for demo purposes')
            // return res.status(401).json({ error: 'Unauthorized: No authentication token provided' });
        }

        next()
    } catch (error) {
        console.error('[authMiddleware] Error verifying token:', error)
        res.status(500).json({ error: 'Internal server error during authentication' })
    }
}
