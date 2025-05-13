// Universo Platformo | Error handling middleware
import { Request, Response, NextFunction } from 'express'

interface ApiError extends Error {
    status?: number
    code?: string
}

/**
 * Global error handler middleware for Express
 */
export const errorHandler = (err: ApiError, req: Request, res: Response, next: NextFunction): void => {
    const status = err.status || 500
    const message = err.message || 'Internal Server Error'
    const code = err.code || 'INTERNAL_ERROR'

    console.error(`[ERROR] ${status} (${code}): ${message}`)
    if (err.stack) {
        console.error(err.stack)
    }

    res.status(status).json({
        error: {
            message,
            code,
            status
        }
    })
}

export default errorHandler
