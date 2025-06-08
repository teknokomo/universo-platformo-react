// Universo Platformo | Chat bots streaming routes
import express from 'express'
import chatStreamingController from '../../controllers/bots/chat-streaming'
import logger from '../../utils/logger'

const router = express.Router()

/**
 * Universo Platformo | Route for streaming chatbot responses
 * Uses the new streaming controller from the bots architecture
 */
router.get(['/:chatflowid', '/:chatflowid/', '/:chatflowid/:sessionid', '/:chatflowid/:sessionid/'], async (req, res, next) => {
    try {
        logger.debug(`Chat streaming request received for chatflow: ${req.params.chatflowid}`)

        // Universo Platformo | Use the new controller for streaming
        await chatStreamingController.getStreamingResponse(req, res, next)
    } catch (error) {
        logger.error(`Error in chat-streaming route: ${error instanceof Error ? error.message : String(error)}`)
        next(error)
    }
})

export default router
