/**
 * Feedback Controller with Dependency Injection
 */
import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { IFeedbackService } from '../services/feedbackService'

/**
 * Error class for controller operations
 */
export class FeedbackControllerError extends Error {
    constructor(public readonly statusCode: number, message: string) {
        super(message)
        this.name = 'FeedbackControllerError'
    }
}

/**
 * Configuration for Feedback controller
 */
export interface FeedbackControllerConfig {
    feedbackService: IFeedbackService
}

/**
 * Feedback controller interface
 */
export interface IFeedbackController {
    getAllChatMessageFeedback: (req: Request, res: Response, next: NextFunction) => Promise<Response | void>
    createChatMessageFeedback: (req: Request, res: Response, next: NextFunction) => Promise<Response | void>
    updateChatMessageFeedback: (req: Request, res: Response, next: NextFunction) => Promise<Response | void>
}

/**
 * Factory function to create Feedback controller with DI
 */
export function createFeedbackController(config: FeedbackControllerConfig): IFeedbackController {
    const { feedbackService } = config

    const getAllChatMessageFeedback = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
        try {
            if (typeof req.params === 'undefined' || !req.params.id) {
                throw new FeedbackControllerError(StatusCodes.PRECONDITION_FAILED, 'Error: getAllChatMessageFeedback - id not provided!')
            }
            const canvasId = req.params.id
            const chatId = req.query?.chatId as string | undefined
            const sortOrder = req.query?.order as string | undefined
            const startDate = req.query?.startDate as string | undefined
            const endDate = req.query?.endDate as string | undefined
            const apiResponse = await feedbackService.getAllFeedback(canvasId, chatId, sortOrder, startDate, endDate)
            return res.json(apiResponse)
        } catch (error) {
            next(error)
        }
    }

    const createChatMessageFeedback = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
        try {
            if (!req.body) {
                throw new FeedbackControllerError(StatusCodes.PRECONDITION_FAILED, 'Error: createChatMessageFeedback - body not provided!')
            }
            const apiResponse = await feedbackService.createFeedback(req.body)
            return res.json(apiResponse)
        } catch (error) {
            next(error)
        }
    }

    const updateChatMessageFeedback = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
        try {
            if (!req.body) {
                throw new FeedbackControllerError(StatusCodes.PRECONDITION_FAILED, 'Error: updateChatMessageFeedback - body not provided!')
            }
            if (typeof req.params === 'undefined' || !req.params.id) {
                throw new FeedbackControllerError(StatusCodes.PRECONDITION_FAILED, 'Error: updateChatMessageFeedback - id not provided!')
            }
            const apiResponse = await feedbackService.updateFeedback(req.params.id, req.body)
            return res.json(apiResponse)
        } catch (error) {
            next(error)
        }
    }

    return {
        getAllChatMessageFeedback,
        createChatMessageFeedback,
        updateChatMessageFeedback
    }
}
