import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { OptimisticLockError, lookupUserEmail } from '@universo/utils'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getDataSource } from '../../DataSource'

/**
 * Check if error is an OptimisticLockError (by class or duck typing)
 * Duck typing needed because instanceof may fail across different module bundles
 */
function isOptimisticLockError(err: unknown): err is OptimisticLockError {
    if (err instanceof OptimisticLockError) return true
    // Duck typing fallback for cross-bundle compatibility
    if (err && typeof err === 'object') {
        const e = err as any
        return e.name === 'OptimisticLockError' ||
               (e.code === 'OPTIMISTIC_LOCK_CONFLICT' && e.conflict)
    }
    return false
}

// we need eslint because we have to pass next arg for the error middleware
// eslint-disable-next-line
async function errorHandlerMiddleware(err: InternalFlowiseError | any, req: Request, res: Response, next: NextFunction) {
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
