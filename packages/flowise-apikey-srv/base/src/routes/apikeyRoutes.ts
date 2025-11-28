import { Request, Response, NextFunction, Router } from 'express'
import { StatusCodes } from 'http-status-codes'
import { validate as validateUuid } from 'uuid'
import { type IApikeyService, ApikeyServiceError } from '../services/apikeyService'

/**
 * Error class for ApiKey controller
 */
export class ApikeyControllerError extends Error {
    constructor(public readonly statusCode: number, message: string) {
        super(message)
        this.name = 'ApikeyControllerError'
    }
}

/**
 * Middleware to validate unikId parameter
 */
function validateUnikId(req: Request, res: Response, next: NextFunction): void {
    const unikId = req.params.unikId as string
    if (!unikId) {
        res.status(StatusCodes.PRECONDITION_FAILED).json({
            error: 'unikId not provided'
        })
        return
    }
    if (!validateUuid(unikId)) {
        res.status(StatusCodes.BAD_REQUEST).json({
            error: 'Invalid unikId format'
        })
        return
    }
    next()
}

/**
 * Middleware to validate id parameter (API key ID)
 */
function validateApiKeyId(req: Request, res: Response, next: NextFunction): void {
    const id = req.params.id as string
    if (!id) {
        res.status(StatusCodes.PRECONDITION_FAILED).json({
            error: 'API key id not provided'
        })
        return
    }
    next()
}

/**
 * Factory function to create ApiKey router
 */
export function createApikeyRouter(apikeyService: IApikeyService): Router {
    const router = Router({ mergeParams: true })

    // All routes require unikId validation
    router.use(validateUnikId)

    const getAllApiKeys = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const unikId = req.params.unikId as string
            const apiResponse = await apikeyService.getAllApiKeys(unikId)
            res.json(apiResponse)
        } catch (error) {
            next(error)
        }
    }

    const createApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const unikId = req.params.unikId as string
            if (!req.body?.keyName) {
                throw new ApikeyControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: apikeyController.createApiKey - keyName not provided!'
                )
            }
            const apiResponse = await apikeyService.createApiKey(req.body.keyName, unikId)
            res.json(apiResponse)
        } catch (error) {
            next(error)
        }
    }

    const updateApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const unikId = req.params.unikId as string
            const id = req.params.id as string
            if (!req.body?.keyName) {
                throw new ApikeyControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: apikeyController.updateApiKey - keyName not provided!'
                )
            }
            const apiResponse = await apikeyService.updateApiKey(id, req.body.keyName, unikId)
            res.json(apiResponse)
        } catch (error) {
            next(error)
        }
    }

    const deleteApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const unikId = req.params.unikId as string
            const id = req.params.id as string
            const apiResponse = await apikeyService.deleteApiKey(id, unikId)
            res.json(apiResponse)
        } catch (error) {
            next(error)
        }
    }

    const importKeys = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const unikId = req.params.unikId as string
            if (!req.body?.jsonFile) {
                throw new ApikeyControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: apikeyController.importKeys - jsonFile not provided!'
                )
            }
            const apiResponse = await apikeyService.importKeys(req.body, unikId)
            res.json(apiResponse)
        } catch (error) {
            next(error)
        }
    }

    const verifyApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const unikId = req.params.unikId as string
            const apikey = req.params.apikey as string
            if (!apikey) {
                throw new ApikeyControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: apikeyController.verifyApiKey - apikey not provided!'
                )
            }
            const apiResponse = await apikeyService.verifyApiKey(apikey, unikId)
            res.json(apiResponse)
        } catch (error) {
            next(error)
        }
    }

    // Routes
    router.get('/', getAllApiKeys)
    router.post('/', createApiKey)
    router.post('/import', importKeys)
    router.put('/:id', validateApiKeyId, updateApiKey)
    router.delete('/:id', validateApiKeyId, deleteApiKey)
    router.get('/verify/:apikey', verifyApiKey)

    return router
}

/**
 * Error handler middleware for ApiKey routes
 */
export function apikeyErrorHandler(error: Error, req: Request, res: Response, next: NextFunction): void {
    if (error instanceof ApikeyServiceError || error instanceof ApikeyControllerError) {
        res.status(error.statusCode).json({ message: error.message })
        return
    }
    next(error)
}
