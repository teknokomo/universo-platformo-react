import { Router, Request, Response, NextFunction, ErrorRequestHandler } from 'express'
import { StatusCodes } from 'http-status-codes'
import { VariablesServiceError, type IVariablesService } from '../services'

/**
 * Controller error class for variables routes
 */
export class VariablesControllerError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string
    ) {
        super(message)
        this.name = 'VariablesControllerError'
    }
}

/**
 * Middleware to validate unikId parameter
 */
const validateUnikId = (req: Request, _res: Response, next: NextFunction): void => {
    const unikId = req.params.unikId as string
    if (!unikId) {
        return next(
            new VariablesControllerError(
                StatusCodes.PRECONDITION_FAILED,
                'Error: variablesController - unikId not provided in request parameters!'
            )
        )
    }
    next()
}

/**
 * Middleware to validate id parameter (for variable ID)
 */
const validateVariableId = (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.params.id) {
        return next(
            new VariablesControllerError(
                StatusCodes.PRECONDITION_FAILED,
                'Error: variablesController - variable id not provided!'
            )
        )
    }
    next()
}

/**
 * Factory function to create variables router
 */
export function createVariablesRouter(variablesService: IVariablesService): Router {
    const router = Router({ mergeParams: true })

    // CREATE
    const createVariable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.body) {
                throw new VariablesControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: variablesController.createVariable - body not provided!'
                )
            }

            const unikId = req.params.unikId as string
            const result = await variablesService.createVariable({ ...req.body, unikId })
            res.json(result)
        } catch (error) {
            next(error)
        }
    }

    // READ ALL
    const getAllVariables = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const unikId = req.params.unikId as string
            const result = await variablesService.getAllVariables(unikId)
            res.json(result)
        } catch (error) {
            next(error)
        }
    }

    // READ ONE
    const getVariableById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const unikId = req.params.unikId as string
            const result = await variablesService.getVariableById(req.params.id, unikId)
            if (!result) {
                throw new VariablesControllerError(
                    StatusCodes.NOT_FOUND,
                    `Variable ${req.params.id} not found`
                )
            }
            res.json(result)
        } catch (error) {
            next(error)
        }
    }

    // UPDATE
    const updateVariable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.body) {
                throw new VariablesControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: variablesController.updateVariable - body not provided!'
                )
            }

            const unikId = req.params.unikId as string
            const result = await variablesService.updateVariable(req.params.id, req.body, unikId)
            res.json(result)
        } catch (error) {
            next(error)
        }
    }

    // DELETE
    const deleteVariable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const unikId = req.params.unikId as string
            const result = await variablesService.deleteVariable(req.params.id, unikId)
            res.json(result)
        } catch (error) {
            next(error)
        }
    }

    // Register routes with middleware validation
    router.post('/', validateUnikId, createVariable)
    router.get('/', validateUnikId, getAllVariables)
    router.get('/:id', validateUnikId, validateVariableId, getVariableById)
    router.put('/:id', validateUnikId, validateVariableId, updateVariable)
    router.delete('/:id', validateUnikId, validateVariableId, deleteVariable)

    return router
}

/**
 * Error handler middleware for variables routes
 */
export const variablesErrorHandler: ErrorRequestHandler = (err, _req, res, next): void => {
    if (err instanceof VariablesServiceError || err instanceof VariablesControllerError) {
        res.status(err.statusCode).json({ message: err.message })
        return
    }
    next(err)
}
