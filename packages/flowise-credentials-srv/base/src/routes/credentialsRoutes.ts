import { Router, Request, Response, NextFunction, ErrorRequestHandler } from 'express'
import { StatusCodes } from 'http-status-codes'
import { CredentialsServiceError, type ICredentialsService } from '../services'

/**
 * Controller error class for credentials routes
 */
export class CredentialsControllerError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string
    ) {
        super(message)
        this.name = 'CredentialsControllerError'
    }
}

/**
 * Middleware to validate unikId parameter
 */
const validateUnikId = (req: Request, _res: Response, next: NextFunction): void => {
    const unikId = req.params.unikId as string
    if (!unikId) {
        return next(new CredentialsControllerError(
            StatusCodes.PRECONDITION_FAILED,
            'Error: credentialsController - unikId not provided in request parameters!'
        ))
    }
    next()
}

/**
 * Middleware to validate id parameter (for credential ID)
 */
const validateCredentialId = (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.params.id) {
        return next(new CredentialsControllerError(
            StatusCodes.PRECONDITION_FAILED,
            'Error: credentialsController - credential id not provided!'
        ))
    }
    next()
}

/**
 * Factory function to create credentials router
 */
export function createCredentialsRouter(credentialsService: ICredentialsService): Router {
    const router = Router({ mergeParams: true })

    // CREATE
    const createCredential = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.body) {
                throw new CredentialsControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: credentialsController.createCredential - body not provided!'
                )
            }

            const unikId = req.params.unikId as string
            const result = await credentialsService.createCredential({ ...req.body, unikId })
            res.json(result)
        } catch (error) {
            next(error)
        }
    }

    // READ ALL
    const getAllCredentials = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const unikId = req.params.unikId as string
            const credentialName = req.query.credentialName as string | string[] | undefined
            const result = await credentialsService.getAllCredentials(credentialName, unikId)
            res.json(result)
        } catch (error) {
            next(error)
        }
    }

    // READ ONE
    const getCredentialById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const unikId = req.params.unikId as string
            const result = await credentialsService.getCredentialById(req.params.id, unikId)
            res.json(result)
        } catch (error) {
            next(error)
        }
    }

    // UPDATE
    const updateCredential = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.body) {
                throw new CredentialsControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: credentialsController.updateCredential - body not provided!'
                )
            }

            const unikId = req.params.unikId as string
            const result = await credentialsService.updateCredential(req.params.id, req.body, unikId)
            res.json(result)
        } catch (error) {
            next(error)
        }
    }

    // DELETE
    const deleteCredential = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const unikId = req.params.unikId as string
            const result = await credentialsService.deleteCredential(req.params.id, unikId)
            res.json(result)
        } catch (error) {
            next(error)
        }
    }

    // Register routes with middleware validation
    router.post('/', validateUnikId, createCredential)
    router.get('/', validateUnikId, getAllCredentials)
    router.get('/:id', validateUnikId, validateCredentialId, getCredentialById)
    router.put('/:id', validateUnikId, validateCredentialId, updateCredential)
    router.delete('/:id', validateUnikId, validateCredentialId, deleteCredential)

    return router
}

/**
 * Error handler middleware for credentials routes
 */
export const credentialsErrorHandler: ErrorRequestHandler = (err, _req, res, next): void => {
    if (err instanceof CredentialsServiceError || err instanceof CredentialsControllerError) {
        res.status(err.statusCode).json({ message: err.message })
        return
    }
    next(err)
}
