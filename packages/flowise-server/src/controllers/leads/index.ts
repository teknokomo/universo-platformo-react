import { Request, Response, NextFunction } from 'express'
import leadsService from '../../services/leads'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'

const getAllLeadsForCanvas = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params.id === 'undefined' || req.params.id === '') {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: leadsController.getAllLeadsForCanvas - id not provided!`
            )
        }
        const canvasId = req.params.id
        const apiResponse = await leadsService.getAllLeads(canvasId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const createLeadForCanvas = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.body === 'undefined' || req.body === '') {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: leadsController.createLeadForCanvas - body not provided!`
            )
        }
        const payload = { ...req.body }
        if (!payload.canvasId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: leadsController.createLeadForCanvas - canvasId not provided!`
            )
        }
        const apiResponse = await leadsService.createLead(payload)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

export default {
    createLeadForCanvas,
    getAllLeadsForCanvas
}
