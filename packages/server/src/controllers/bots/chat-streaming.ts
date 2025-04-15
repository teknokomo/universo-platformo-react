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
import chatflowsService from '../../services/chatflows'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { ICommonObject } from 'flowise-components'

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
            const chatflowid = req.params.chatflowid
            if (!chatflowid) {
                throw new InternalFlowiseError(
                    StatusCodes.PRECONDITION_FAILED,
                    `Error: ChatStreamingController.getStreamingResponse - chatflowid not provided!`
                )
            }

            const sessionid = req.params.sessionid || uuidv4()
            logger.info(`Streaming request for chat bot (chatflow: ${chatflowid}, session: ${sessionid})`)

            // Universo Platformo | Check that the chatflow exists and supports streaming
            const streamable = await chatflowsService.checkIfChatflowIsValidForStreaming(chatflowid)
            if (!streamable || !streamable.isStreaming) {
                return res.status(400).json({ error: 'Chatflow not configured for streaming' })
            }

            // Universo Platformo | Get ChatFlow directly from DB to check botType
            const chatflow = await appServer.AppDataSource.getRepository(ChatFlow).findOneBy({ id: chatflowid })
            if (!chatflow) {
                logger.error(`Chatflow ${chatflowid} not found`)
                return res.status(404).json({
                    error: 'Chat Bot not found or not public'
                })
            }
            const config = safeParseJSON(chatflow.chatbotConfig)

            // Universo Platformo | Verify that this is a chat bot
            if (config.botType !== 'chat' && config.botType !== undefined) {
                logger.error(`Bot with ID ${chatflowid} is not a chat bot (type: ${config.botType})`)
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
                req.body = {
                    question: req.query.q || '',
                    chatId: chatId,
                    streaming: true
                }

                // Universo Platformo | Process request using predictionsServices.buildChatflow
                const apiResponse = await predictionsServices.buildChatflow(req)
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
