import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'

// we need eslint because we have to pass next arg for the error middleware
// eslint-disable-next-line
async function errorHandlerMiddleware(err: InternalFlowiseError | any, req: Request, res: Response, next: NextFunction) {
    if (res.headersSent) {
        return next(err)
    }

    const errCode = err?.code as string | undefined

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
