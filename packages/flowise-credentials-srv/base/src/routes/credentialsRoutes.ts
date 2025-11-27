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
            if (!unikId) {
                throw new CredentialsControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: credentialsController.createCredential - unikId not provided!'
                )
            }

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
            if (!req.params.id) {
                throw new CredentialsControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: credentialsController.getCredentialById - id not provided!'
                )
            }

            const unikId = req.params.unikId as string
            if (!unikId) {
                throw new CredentialsControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: credentialsController.getCredentialById - unikId not provided!'
                )
            }

            const result = await credentialsService.getCredentialById(req.params.id, unikId)
            res.json(result)
        } catch (error) {
            next(error)
        }
    }

    // UPDATE
    const updateCredential = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.params.id) {
                throw new CredentialsControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: credentialsController.updateCredential - id not provided!'
                )
            }

            if (!req.body) {
                throw new CredentialsControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: credentialsController.updateCredential - body not provided!'
                )
            }

            const unikId = req.params.unikId as string
            if (!unikId) {
                throw new CredentialsControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: credentialsController.updateCredential - unikId not provided!'
                )
            }

            const result = await credentialsService.updateCredential(req.params.id, req.body, unikId)
            res.json(result)
        } catch (error) {
            next(error)
        }
    }

    // DELETE
    const deleteCredential = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.params.id) {
                throw new CredentialsControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: credentialsController.deleteCredential - id not provided!'
                )
            }

            const unikId = req.params.unikId as string
            if (!unikId) {
                throw new CredentialsControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: credentialsController.deleteCredential - unikId not provided!'
                )
            }

            const result = await credentialsService.deleteCredential(req.params.id, unikId)
            res.json(result)
        } catch (error) {
            next(error)
        }
    }

    // Register routes
    router.post('/', createCredential)
    router.get('/', getAllCredentials)
    router.get('/:id', getCredentialById)
    router.put('/:id', updateCredential)
    router.delete('/:id', deleteCredential)

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
