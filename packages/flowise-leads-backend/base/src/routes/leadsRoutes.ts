import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { type ILeadsService, LeadsServiceError } from '../services/leadsService'

/**
 * Error class for Leads controller
 */
export class LeadsControllerError extends Error {
    constructor(public readonly statusCode: number, message: string) {
        super(message)
        this.name = 'LeadsControllerError'
    }
}

/**
 * Factory function to create leads router with dependency injection
 */
export function createLeadsRouter(leadsService: ILeadsService): Router {
    const router = Router()

    const createLead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Pass client IP for captcha validation
            const clientIp = req.ip || req.socket.remoteAddress || ''
            const apiResponse = await leadsService.createLead(req.body, { clientIp })
            res.json(apiResponse)
        } catch (error) {
            next(error)
        }
    }

    const getAllLeads = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const canvasId = req.params.id
            if (!canvasId || canvasId.trim() === '') {
                throw new LeadsControllerError(StatusCodes.BAD_REQUEST, 'Canvas ID is required')
            }
            const apiResponse = await leadsService.getAllLeads(canvasId)
            res.json(apiResponse)
        } catch (error) {
            next(error)
        }
    }

    // Routes
    router.post('/', createLead)
    router.get('/:id', getAllLeads)

    return router
}

/**
 * Error handler middleware for leads errors
 */
export function leadsErrorHandler(error: Error, _req: Request, res: Response, next: NextFunction): void {
    if (error instanceof LeadsServiceError || error instanceof LeadsControllerError) {
        res.status(error.statusCode).json({ error: error.message })
        return
    }
    next(error)
}
