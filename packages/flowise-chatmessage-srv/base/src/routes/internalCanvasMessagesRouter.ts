/**
 * Internal Canvas Messages Router with Dependency Injection
 *
 * This router is used for internal API calls that don't go through
 * the external chatbot widget.
 */
import express, { Router } from 'express'
import { IChatMessagesController } from '../controllers/chatMessagesController'

/**
 * Configuration for Internal Canvas Messages router
 */
export interface InternalCanvasMessagesRouterConfig {
    chatMessagesController: IChatMessagesController
}

/**
 * Factory function to create Internal Canvas Messages router with DI
 */
export function createInternalCanvasMessagesRouter(config: InternalCanvasMessagesRouterConfig): Router {
    const { chatMessagesController } = config
    const router = express.Router()

    // READ - Get internal chat messages
    router.get(['/', '/:id'], chatMessagesController.getAllInternalChatMessages)

    return router
}
