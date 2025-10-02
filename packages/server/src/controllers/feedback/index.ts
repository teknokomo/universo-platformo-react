import { Request, Response, NextFunction } from 'express'
import feedbackService from '../../services/feedback'
import { validateFeedbackForCreation, validateFeedbackForUpdate } from '../../services/feedback/validation'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'

const getAllChatMessageFeedback = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: feedbackController.getAllChatMessageFeedback - id not provided!`
            )
        }
        const canvasId = req.params.id
        const chatId = req.query?.chatId as string | undefined
        const sortOrder = req.query?.order as string | undefined
        const startDate = req.query?.startDate as string | undefined
        const endDate = req.query?.endDate as string | undefined
        const apiResponse = await feedbackService.getAllChatMessageFeedback(canvasId, chatId, sortOrder, startDate, endDate)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const createChatMessageFeedbackForChatflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.body) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: feedbackController.createChatMessageFeedbackForChatflow - body not provided!`
            )
        }
        const payload = { ...req.body }
        await validateFeedbackForCreation(payload)
        const apiResponse = await feedbackService.createChatMessageFeedbackForChatflow(payload)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const updateChatMessageFeedbackForChatflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.body) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: feedbackController.updateChatMessageFeedbackForChatflow - body not provided!`
            )
        }
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: feedbackController.updateChatMessageFeedbackForChatflow - id not provided!`
            )
        }
        const payload = { ...req.body }
        await validateFeedbackForUpdate(req.params.id, payload)
        const apiResponse = await feedbackService.updateChatMessageFeedbackForChatflow(req.params.id, payload)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

export default {
    getAllChatMessageFeedback,
    createChatMessageFeedbackForChatflow,
    updateChatMessageFeedbackForChatflow
}
