/**
 * Internal Flowise Error class for consistent error handling
 */
export class InternalFlowiseError extends Error {
    statusCode: number

    constructor(statusCode: number, message: string) {
        super(message)
        this.statusCode = statusCode
        this.name = 'InternalFlowiseError'
        Error.captureStackTrace(this, this.constructor)
    }
}
