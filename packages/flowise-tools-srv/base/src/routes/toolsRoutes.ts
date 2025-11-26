import { Request, Response, NextFunction, Router } from 'express'
import { StatusCodes } from 'http-status-codes'
import { type IToolsService, ToolsServiceError } from '../services/toolsService'

/**
 * Error class for Tools controller
 */
export class ToolsControllerError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string
    ) {
        super(message)
        this.name = 'ToolsControllerError'
    }
}

/**
 * Factory function to create tools router
 */
export function createToolsRouter(toolsService: IToolsService): Router {
    const router = Router({ mergeParams: true })

    const createTool = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.body) {
                throw new ToolsControllerError(StatusCodes.PRECONDITION_FAILED, 'Error: toolsController.createTool - body not provided!')
            }
            const unikId = req.params.unikId as string
            if (!unikId) {
                throw new ToolsControllerError(StatusCodes.PRECONDITION_FAILED, 'Error: toolsController.createTool - unikId not provided!')
            }
            const apiResponse = await toolsService.createTool({ ...req.body, unikId })
            res.json(apiResponse)
        } catch (error) {
            next(error)
        }
    }

    const deleteTool = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (typeof req.params === 'undefined' || !req.params.id) {
                throw new ToolsControllerError(StatusCodes.PRECONDITION_FAILED, 'Error: toolsController.deleteTool - id not provided!')
            }
            const unikId = req.params.unikId as string
            if (!unikId) {
                throw new ToolsControllerError(StatusCodes.PRECONDITION_FAILED, 'Error: toolsController.deleteTool - unikId not provided!')
            }
            const apiResponse = await toolsService.deleteTool(req.params.id, unikId)
            res.json(apiResponse)
        } catch (error) {
            next(error)
        }
    }

    const getAllTools = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const unikId = req.params.unikId as string
            const apiResponse = await toolsService.getAllTools(unikId)
            res.json(apiResponse)
        } catch (error) {
            next(error)
        }
    }

    const getToolById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (typeof req.params === 'undefined' || !req.params.id) {
                throw new ToolsControllerError(StatusCodes.PRECONDITION_FAILED, 'Error: toolsController.getToolById - id not provided!')
            }
            const unikId = req.params.unikId as string
            if (!unikId) {
                throw new ToolsControllerError(StatusCodes.PRECONDITION_FAILED, 'Error: toolsController.getToolById - unikId not provided!')
            }
            const apiResponse = await toolsService.getToolById(req.params.id, unikId)
            res.json(apiResponse)
        } catch (error) {
            next(error)
        }
    }

    const updateTool = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (typeof req.params === 'undefined' || !req.params.id) {
                throw new ToolsControllerError(StatusCodes.PRECONDITION_FAILED, 'Error: toolsController.updateTool - id not provided!')
            }
            if (!req.body) {
                throw new ToolsControllerError(StatusCodes.PRECONDITION_FAILED, 'Error: toolsController.updateTool - body not provided!')
            }
            const unikId = req.params.unikId as string
            if (!unikId) {
                throw new ToolsControllerError(StatusCodes.PRECONDITION_FAILED, 'Error: toolsController.updateTool - unikId not provided!')
            }
            const apiResponse = await toolsService.updateTool(req.params.id, { ...req.body, unikId })
            res.json(apiResponse)
        } catch (error) {
            next(error)
        }
    }

    // Register routes
    router.post('/', createTool)
    router.get('/', getAllTools)
    router.get('/:id', getToolById)
    router.put('/:id', updateTool)
    router.delete('/:id', deleteTool)

    return router
}

/**
 * Error handler middleware for tools errors
 */
export function toolsErrorHandler(error: Error, _req: Request, res: Response, next: NextFunction): void {
    if (error instanceof ToolsServiceError || error instanceof ToolsControllerError) {
        res.status(error.statusCode).json({ error: error.message })
        return
    }
    next(error)
}
