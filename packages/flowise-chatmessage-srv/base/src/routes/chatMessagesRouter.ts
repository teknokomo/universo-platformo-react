/**
 * Chat Messages Router with Dependency Injection
 */
import express, { Router, Request, Response, NextFunction } from 'express'
import { IChatMessagesController, ChatMessagesControllerError } from '../controllers/chatMessagesController'
import { ChatMessagesServiceError } from '../services/chatMessagesService'

/**
 * Configuration for Chat Messages router
 */
export interface ChatMessagesRouterConfig {
    chatMessagesController: IChatMessagesController
}

/**
 * Factory function to create Chat Messages router with DI
 */
export function createChatMessagesRouter(config: ChatMessagesRouterConfig): Router {
    const { chatMessagesController } = config
    const router = express.Router()

    // CREATE
    router.post(['/', '/:id'], chatMessagesController.createChatMessage)

    // READ
    router.get(['/', '/:id'], chatMessagesController.getAllChatMessages)

    // UPDATE (abort)
    router.put(['/abort/', '/abort/:canvasId/:chatId'], chatMessagesController.abortChatMessage)

    // DELETE
    router.delete(['/', '/:id'], chatMessagesController.removeAllChatMessages)

    return router
}

/**
 * Error handler middleware for chat messages errors
 */
export function chatMessagesErrorHandler(error: Error, _req: Request, res: Response, next: NextFunction): void {
    if (error instanceof ChatMessagesServiceError || error instanceof ChatMessagesControllerError) {
        res.status(error.statusCode).json({ error: error.message })
        return
    }
    next(error)
}
