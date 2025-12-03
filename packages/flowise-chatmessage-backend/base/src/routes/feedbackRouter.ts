/**
 * Feedback Router with Dependency Injection
 */
import express, { Router, Request, Response, NextFunction } from 'express'
import { IFeedbackController, FeedbackControllerError } from '../controllers/feedbackController'
import { FeedbackServiceError } from '../services/feedbackService'

/**
 * Configuration for Feedback router
 */
export interface FeedbackRouterConfig {
    feedbackController: IFeedbackController
}

/**
 * Factory function to create Feedback router with DI
 */
export function createFeedbackRouter(config: FeedbackRouterConfig): Router {
    const { feedbackController } = config
    const router = express.Router()

    // CREATE
    router.post(['/', '/:id'], feedbackController.createChatMessageFeedback)

    // READ
    router.get(['/', '/:id'], feedbackController.getAllChatMessageFeedback)

    // UPDATE
    router.put(['/', '/:id'], feedbackController.updateChatMessageFeedback)

    return router
}

/**
 * Error handler middleware for feedback errors
 */
export function feedbackErrorHandler(error: Error, _req: Request, res: Response, next: NextFunction): void {
    if (error instanceof FeedbackServiceError || error instanceof FeedbackControllerError) {
        res.status(error.statusCode).json({ error: error.message })
        return
    }
    next(error)
}
