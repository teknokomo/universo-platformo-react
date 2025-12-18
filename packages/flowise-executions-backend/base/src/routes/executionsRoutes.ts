import { Router, Request, Response, NextFunction } from 'express'
import { IExecutionsService, ExecutionsServiceError, ExecutionState } from '../services'

/**
 * Custom error class for executions controller
 */
export class ExecutionsControllerError extends Error {
    constructor(public statusCode: number, message: string) {
        super(message)
        this.name = 'ExecutionsControllerError'
    }
}

/**
 * Error handler middleware for executions routes
 */
export function executionsErrorHandler(err: Error, _req: Request, res: Response, next: NextFunction): void {
    if (err instanceof ExecutionsServiceError || err instanceof ExecutionsControllerError) {
        res.status(err.statusCode).json({ error: err.message })
        return
    }
    next(err)
}

/**
 * Factory function to create executions router
 * Adapted from Flowise 3.0.12 with improvements:
 * - Uses mergeParams for nested route support
 * - Canvas-scoped operations
 * - Comprehensive error handling
 * - Support for both single and bulk delete
 */
export function createExecutionsRouter(executionsService: IExecutionsService): Router {
    const router = Router({ mergeParams: true })

    const chunkArray = <T>(items: T[], chunkSize: number): T[][] => {
        const chunks: T[][] = []
        for (let i = 0; i < items.length; i += chunkSize) {
            chunks.push(items.slice(i, i + chunkSize))
        }
        return chunks
    }

    /**
     * GET /executions
     * Get all executions for a canvas with optional filters
     */
    router.get('/', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { unikId, spaceId, canvasId } = req.params as { unikId?: string; spaceId?: string; canvasId?: string }
            const filters: any = {}

            if (unikId) {
                filters.unikId = unikId
            }
            if (spaceId) {
                filters.spaceId = spaceId
            }
            if (canvasId) {
                filters.canvasId = canvasId
            }

            // Extract query parameters
            if (req.query.id) {
                filters.id = req.query.id as string
            }
            if (req.query.sessionId) {
                filters.sessionId = req.query.sessionId as string
            }
            if (req.query.canvasName) {
                filters.canvasName = req.query.canvasName as string
            }

            // State filter - validate it's a valid ExecutionState
            if (req.query.state) {
                const stateValue = req.query.state as string
                if (Object.values(ExecutionState).includes(stateValue as ExecutionState)) {
                    filters.state = stateValue as ExecutionState
                }
            }

            // Date filters
            if (req.query.startDate) {
                filters.startDate = req.query.startDate as string
            }
            if (req.query.endDate) {
                filters.endDate = req.query.endDate as string
            }

            // Pagination
            if (req.query.page) {
                filters.page = parseInt(req.query.page as string, 10)
            }
            if (req.query.limit) {
                filters.limit = parseInt(req.query.limit as string, 10)
            }

            const result = await executionsService.getAllExecutions(filters)
            res.json(result)
        } catch (error) {
            next(error)
        }
    })

    /**
     * GET /executions/:id
     * Get execution by ID
     */
    router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { unikId, spaceId, canvasId } = req.params as { unikId?: string; spaceId?: string; canvasId?: string }
            const executionId = req.params.id

            if (canvasId) {
                const execution = await executionsService.getExecutionById(executionId, canvasId)
                res.json(execution)
                return
            }

            if (!unikId) {
                throw new ExecutionsControllerError(400, 'unikId param is required')
            }

            const result = await executionsService.getAllExecutions({ id: executionId, unikId, spaceId, page: 1, limit: 1 } as any)
            if (!result?.data?.length) {
                throw new ExecutionsControllerError(404, `Execution ${executionId} not found`)
            }
            res.json(result.data[0])
        } catch (error) {
            next(error)
        }
    })

    /**
     * PUT /executions/:id
     * Update execution
     */
    router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { unikId, spaceId, canvasId } = req.params as { unikId?: string; spaceId?: string; canvasId?: string }
            const executionId = req.params.id

            if (canvasId) {
                const execution = await executionsService.updateExecution(executionId, req.body, canvasId)
                res.json(execution)
                return
            }

            if (!unikId) {
                throw new ExecutionsControllerError(400, 'unikId param is required')
            }

            const verify = await executionsService.getAllExecutions({ id: executionId, unikId, spaceId, page: 1, limit: 1 } as any)
            if (!verify?.data?.length) {
                throw new ExecutionsControllerError(404, `Execution ${executionId} not found`)
            }

            const execution = await executionsService.updateExecution(executionId, req.body)
            res.json(execution)
        } catch (error) {
            next(error)
        }
    })

    /**
     * DELETE /executions/:id
     * Delete single execution (soft delete)
     */
    router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { unikId, spaceId, canvasId } = req.params as { unikId?: string; spaceId?: string; canvasId?: string }
            const executionId = req.params.id

            if (canvasId) {
                const result = await executionsService.deleteExecutions([executionId], canvasId)
                res.json(result)
                return
            }

            if (!unikId) {
                throw new ExecutionsControllerError(400, 'unikId param is required')
            }

            const verify = await executionsService.getAllExecutions({ id: executionId, unikId, spaceId, page: 1, limit: 1 } as any)
            if (!verify?.data?.length) {
                throw new ExecutionsControllerError(404, `Execution ${executionId} not found`)
            }

            const result = await executionsService.deleteExecutions([executionId])
            res.json(result)
        } catch (error) {
            next(error)
        }
    })

    /**
     * DELETE /executions
     * Delete multiple executions (soft delete)
     */
    router.delete('/', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { unikId, spaceId, canvasId } = req.params as { unikId?: string; spaceId?: string; canvasId?: string }
            const { executionIds } = req.body

            if (!Array.isArray(executionIds) || executionIds.length === 0) {
                throw new ExecutionsControllerError(400, 'No execution IDs provided')
            }

            if (canvasId) {
                const result = await executionsService.deleteExecutions(executionIds, canvasId)
                res.json(result)
                return
            }

            if (!unikId) {
                throw new ExecutionsControllerError(400, 'unikId param is required')
            }

            const allowedIds: string[] = []
            for (const chunk of chunkArray(executionIds, 100)) {
                const verified = await executionsService.getAllExecutions({
                    executionIds: chunk,
                    unikId,
                    spaceId,
                    page: 1,
                    limit: Math.min(100, chunk.length)
                } as any)

                for (const row of verified.data ?? []) {
                    allowedIds.push(row.id)
                }
            }

            if (allowedIds.length !== executionIds.length) {
                throw new ExecutionsControllerError(
                    404,
                    `Some executions were not found in scope (requested=${executionIds.length}, allowed=${allowedIds.length})`
                )
            }

            const result = await executionsService.deleteExecutions(allowedIds)
            res.json(result)
        } catch (error) {
            next(error)
        }
    })

    // Apply error handler
    router.use(executionsErrorHandler)

    return router
}

/**
 * Factory function to create public executions router
 *
 * GET /public-executions/:id
 * Returns execution details only when execution is marked as public.
 */
export function createPublicExecutionsRouter(executionsService: IExecutionsService): Router {
    const router = Router()

    router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const executionId = req.params.id
            const execution = await executionsService.getPublicExecutionById(executionId)
            res.json(execution)
        } catch (error) {
            next(error)
        }
    })

    router.use(executionsErrorHandler)

    return router
}
