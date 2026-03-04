import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { OptimisticLockError, lookupUserEmail } from '@universo/utils'
import { getDataSource } from '../../DataSource'

/**
 * Check if error is an OptimisticLockError (by class or duck typing)
 * Duck typing needed because instanceof may fail across different module bundles.
 * Requires valid conflict payload to prevent crashes when spreading conflict data.
 */
function isOptimisticLockError(err: unknown): err is OptimisticLockError {
    if (err instanceof OptimisticLockError && err.conflict && typeof err.conflict === 'object') {
        return true
    }
    // Duck typing fallback for cross-bundle compatibility
    if (err && typeof err === 'object') {
        const e = err as { name?: string; code?: string; conflict?: unknown }
        const hasValidConflict = !!e.conflict && typeof e.conflict === 'object'
        return hasValidConflict && (e.name === 'OptimisticLockError' || e.code === 'OPTIMISTIC_LOCK_CONFLICT')
    }
    return false
}

/** Shape of error properties that Express error handlers may receive */
interface ErrorLike {
    message?: string
    stack?: string
    code?: string
    statusCode?: number
    status?: number
}

// Express error middleware requires exactly 4 args (including unused next) for Express to recognize it
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function errorHandlerMiddleware(err: ErrorLike, req: Request, res: Response, next: NextFunction) {
    if (res.headersSent) {
        return next(err)
    }

    const errCode = err?.code as string | undefined

    // Handle Optimistic Lock Conflicts (409)
    if (isOptimisticLockError(err)) {
        const conflict = err.conflict
        const updatedByEmail = await lookupUserEmail(getDataSource(), conflict.updatedBy)

        res.setHeader('Content-Type', 'application/json')
        return res.status(409).json({
            error: 'Conflict: entity was modified by another user',
            code: err.code,
            conflict: { ...conflict, updatedByEmail }
        })
    }

    // Align CSRF error handling with frontend behavior (auth client clears CSRF on 419).
    const isCsrfError = errCode === 'EBADCSRFTOKEN'
    if (isCsrfError) {
        const displayedError = {
            statusCode: 419,
            success: false,
            message: 'CSRF token expired',
            stack: process.env.NODE_ENV === 'development' ? err?.stack : {}
        }
        res.setHeader('Content-Type', 'application/json')
        return res.status(displayedError.statusCode).json(displayedError)
    }

    if (typeof err?.message === 'string' && err.message.includes('401 Incorrect API key provided')) {
        err.message = '401 Invalid model key or Incorrect local model configuration.'
    }

    const rawStatus = err?.statusCode ?? err?.status
    const statusCode = typeof rawStatus === 'number' ? rawStatus : StatusCodes.INTERNAL_SERVER_ERROR

    const displayedError = {
        statusCode,
        success: false,
        message: err?.message ?? 'Server error',
        // Provide error stack trace only in development
        stack: process.env.NODE_ENV === 'development' ? err?.stack : {}
    }

    if (!req.body || !req.body.streaming || req.body.streaming === 'false') {
        res.setHeader('Content-Type', 'application/json')
        return res.status(displayedError.statusCode).json(displayedError)
    }
}

export default errorHandlerMiddleware
