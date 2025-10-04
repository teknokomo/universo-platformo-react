// Universo Platformo | Chat bot streaming controller
import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { v4 as uuidv4 } from 'uuid'
import predictionsServices from '../../services/predictions'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import { MODE } from '../../Interface'
import logger from '../../utils/logger'
import canvasService from '../../services/spacesCanvas'
import { ICommonObject } from 'flowise-components'
import { resolveRequestUserId, workspaceAccessService } from '../../services/access-control'

const ACCESS_DENIED_MESSAGE = 'Access denied: You do not have permission to access this canvas'

// Universo Platformo | Helper function to safely parse JSON (copied from chat.ts)
const safeParseJSON = (jsonString: string | null | undefined): ICommonObject => {
    try {
        return jsonString ? JSON.parse(jsonString) : {}
    } catch (error) {
        logger.error(`Error parsing JSON: ${error}`)
        return {}
    }
}

/**
 * Universo Platformo | Chat bot streaming controller
 */
export class ChatStreamingController {
    /**
     * Universo Platformo | Process request for chat bot streaming
     */
    getStreamingResponse = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
        try {
            const appServer = getRunningExpressApp()
            const canvasId = req.params.canvasId ?? (req.params as any).id
            if (!canvasId) {
                throw new InternalFlowiseError(
                    StatusCodes.PRECONDITION_FAILED,
                    `Error: ChatStreamingController.getStreamingResponse - canvasId not provided!`
                )
            }

            const sessionid = req.params.sessionid || uuidv4()
            logger.info(`Streaming request for chat bot (canvas: ${canvasId}, session: ${sessionid})`)

            // Universo Platformo | Check that the canvas exists and supports streaming
            const streamable = await canvasService.checkIfCanvasIsValidForStreaming(canvasId)
            if (!streamable || !streamable.isStreaming) {
                return res.status(400).json({ error: 'Canvas not configured for streaming' })
            }

            let canvasRecord
            try {
                canvasRecord = await canvasService.getCanvasById(canvasId)
            } catch (error: any) {
                if (typeof error?.status === 'number' && error.status === StatusCodes.NOT_FOUND) {
                    logger.error(`Canvas ${canvasId} not found`)
                    return res.status(StatusCodes.NOT_FOUND).json({
                        error: 'Chat Bot not found or not public'
                    })
                }
                throw error
            }

            if (!canvasRecord) {
                logger.error(`Canvas ${canvasId} not found`)
                return res.status(StatusCodes.NOT_FOUND).json({
                    error: 'Chat Bot not found or not public'
                })
            }

            // Universo Platformo | Check user access to the Unik this canvas belongs to
            const unikId = await workspaceAccessService.getUnikIdForCanvas(canvasId)
            if (unikId) {
                const userId = resolveRequestUserId(req)
                if (!userId) {
                    return res.status(401).json({ error: 'Unauthorized: User not authenticated' })
                }

                const hasAccess = await workspaceAccessService.hasUnikAccess(req, userId, unikId)
                if (!hasAccess) {
                    return res.status(403).json({ error: ACCESS_DENIED_MESSAGE })
                }
            }

            const config = safeParseJSON(canvasRecord.chatbotConfig)

            // Universo Platformo | Verify that this is a chat bot
            if (config.botType !== 'chat' && config.botType !== undefined) {
                logger.error(`Bot with ID ${canvasId} is not a chat bot (type: ${config.botType})`)
                return res.status(400).json({
                    error: 'Bot type mismatch',
                    message: 'The requested bot is not a chat bot.'
                })
            }

            // Universo Platformo | Set up streaming
            const sseStreamer = getRunningExpressApp().sseStreamer
            const chatId = sessionid

            try {
                // Universo Platformo | Set up SSE connection
                sseStreamer.addExternalClient(chatId, res)
                res.setHeader('Content-Type', 'text/event-stream')
                res.setHeader('Cache-Control', 'no-cache')
                res.setHeader('Connection', 'keep-alive')
                res.setHeader('X-Accel-Buffering', 'no') // nginx config
                res.flushHeaders()

                if (process.env.MODE === MODE.QUEUE) {
                    getRunningExpressApp().redisSubscriber.subscribe(chatId)
                }

                // Universo Platformo | Prepare request for streaming
                ;(req.params as any).id = canvasId
                req.body = {
                    question: req.query.q || '',
                    chatId: chatId,
                    streaming: true
                }

                // Universo Platformo | Process request using predictionsServices.buildCanvasFlow
                const apiResponse = await predictionsServices.buildCanvasFlow(req)
                sseStreamer.streamMetadataEvent(apiResponse.chatId, apiResponse)
            } catch (error) {
                logger.error(`Error in chat-streaming: ${getErrorMessage(error)}`)
                if (chatId) {
                    sseStreamer.streamErrorEvent(chatId, getErrorMessage(error))
                }
                next(error)
            } finally {
                // Universo Platformo | Delayed cleanup to finish streaming
                setTimeout(() => {
                    sseStreamer.removeClient(chatId)
                }, 5000)
            }
        } catch (error) {
            next(error)
        }
    }
}

// Universo Platformo | Create controller instance
const chatStreamingController = new ChatStreamingController()

export default chatStreamingController
