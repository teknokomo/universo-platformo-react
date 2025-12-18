// Universo Platformo | Agents Backend - Validation Router
// Express router for canvas validation API

import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import type { DataSource } from 'typeorm'
import { createValidationService, ValidationServiceError, IValidationService } from '../services/validationService'
import type { IComponentNodes } from '../types'

/**
 * Request params schema for validation endpoint
 */
const ValidationParamsSchema = z.object({
    canvasId: z.string().uuid()
})

/**
 * Query params schema for validation endpoint
 */
const ValidationQuerySchema = z.object({
    unikId: z.string().uuid().optional()
})

const ValidationUnikIdSchema = z.string().uuid()

/**
 * Router factory options
 */
export interface ValidationRouterOptions {
    /** TypeORM DataSource or getter function */
    dataSource: DataSource | (() => DataSource)
    /** Component nodes pool or getter function (lazy access for runtime initialization) */
    componentNodes: IComponentNodes | (() => IComponentNodes)
    /** Canvas entity class for repository */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvasEntityClass: new () => any
    /** Optional authentication middleware */
    authMiddleware?: (req: Request, res: Response, next: NextFunction) => void
}

/**
 * Create validation router
 */
export function createValidationRouter(options: ValidationRouterOptions): Router {
    const { dataSource, componentNodes, canvasEntityClass, authMiddleware } = options
    const router = Router()

    // Create validation service
    const validationService: IValidationService = createValidationService({
        dataSource,
        componentNodes,
        canvasEntityClass
    })

    // Apply auth middleware if provided
    if (authMiddleware) {
        router.use(authMiddleware)
    }

    /**
     * GET /validation/:canvasId
     * Check flow validation for a canvas
     */
    router.get('/:canvasId', async (req: Request, res: Response) => {
        try {
            // Validate path params
            const paramsResult = ValidationParamsSchema.safeParse(req.params)
            if (!paramsResult.success) {
                return res.status(400).json({
                    error: 'Invalid canvas ID',
                    details: paramsResult.error.issues
                })
            }

            // Validate query params
            const queryResult = ValidationQuerySchema.safeParse(req.query)
            if (!queryResult.success) {
                return res.status(400).json({
                    error: 'Invalid query parameters',
                    details: queryResult.error.issues
                })
            }

            const { canvasId } = paramsResult.data

            // Prefer parent route param unikId/id when mounted under /unik/:unikId (mergeParams: true)
            const paramsUnikId = (req.params.unikId || (req.params as any).id) as string | undefined
            const queryUnikId = queryResult.data.unikId
            const rawUnikId = paramsUnikId ?? queryUnikId

            let unikId: string | undefined
            if (rawUnikId) {
                const unikIdResult = ValidationUnikIdSchema.safeParse(rawUnikId)
                if (!unikIdResult.success) {
                    return res.status(400).json({
                        error: 'Invalid unik ID',
                        details: unikIdResult.error.issues
                    })
                }
                unikId = unikIdResult.data
            }

            // Run validation
            const results = await validationService.checkFlowValidation(canvasId, unikId)

            return res.status(200).json({
                canvasId,
                isValid: results.length === 0,
                issues: results
            })
        } catch (error) {
            if (error instanceof ValidationServiceError) {
                return res.status(error.statusCode).json({
                    error: error.message
                })
            }

            console.error('[validation] Unexpected error:', error)
            return res.status(500).json({
                error: 'Internal server error'
            })
        }
    })

    return router
}

export default createValidationRouter
