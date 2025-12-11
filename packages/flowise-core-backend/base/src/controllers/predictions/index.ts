import { Request, Response, NextFunction } from 'express'
import { RateLimiterManager } from '../../utils/rateLimit'
import canvasService from '../../services/spacesCanvas'
import logger from '../../utils/logger'
import predictionsServices from '../../services/predictions'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { uuid } from '@universo/utils'
import { getErrorMessage } from '../../errors/utils'
import { MODE } from '../../Interface'

// Send input message and get prediction result (External)
const createPrediction = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const canvasId = req.params?.canvasId ?? req.params?.id
        if (!canvasId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: predictionsController.createPrediction - canvasId not provided!`
            )
        }
        if (!req.body) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: predictionsController.createPrediction - body not provided!`
            )
        }
        // Preserve legacy consumers expecting req.params.id
        if (!req.params.id) {
            ;(req.params as any).id = canvasId
        }

        const canvas = await canvasService.getCanvasById(canvasId)
        if (!canvas) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Canvas ${canvasId} not found`)
        }
        let isDomainAllowed = true
        let unauthorizedOriginError = 'This site is not allowed to access this chatbot'
        logger.info(`[server]: Request originated from ${req.headers.origin || 'UNKNOWN ORIGIN'}`)
        if (canvas.chatbotConfig) {
            const parsedConfig = JSON.parse(canvas.chatbotConfig)
            // check whether the first one is not empty. if it is empty that means the user set a value and then removed it.
            const isValidAllowedOrigins = parsedConfig.allowedOrigins?.length && parsedConfig.allowedOrigins[0] !== ''
            unauthorizedOriginError = parsedConfig.allowedOriginsError || 'This site is not allowed to access this chatbot'
            if (isValidAllowedOrigins && req.headers.origin) {
                const originHeader = req.headers.origin
                const origin = new URL(originHeader).host
                isDomainAllowed =
                    parsedConfig.allowedOrigins.filter((domain: string) => {
                        try {
                            const allowedOrigin = new URL(domain).host
                            return origin === allowedOrigin
                        } catch (e) {
                            return false
                        }
                    }).length > 0
            }
        }
        if (isDomainAllowed) {
            const streamable = await canvasService.checkIfCanvasIsValidForStreaming(canvasId)
            const isStreamingRequested = req.body.streaming === 'true' || req.body.streaming === true
            if (streamable?.isStreaming && isStreamingRequested) {
                const sseStreamer = getRunningExpressApp().sseStreamer

                let chatId = req.body.chatId
                if (!req.body.chatId) {
                    chatId = req.body.chatId ?? req.body.overrideConfig?.sessionId ?? uuid.generateUuidV7()
                    req.body.chatId = chatId
                }
                try {
                    sseStreamer.addExternalClient(chatId, res)
                    res.setHeader('Content-Type', 'text/event-stream')
                    res.setHeader('Cache-Control', 'no-cache')
                    res.setHeader('Connection', 'keep-alive')
                    res.setHeader('X-Accel-Buffering', 'no') //nginx config: https://serverfault.com/a/801629
                    res.flushHeaders()

                    if (process.env.MODE === MODE.QUEUE) {
                        getRunningExpressApp().redisSubscriber.subscribe(chatId)
                    }

                    const apiResponse = await predictionsServices.buildCanvasFlow(req)
                    sseStreamer.streamMetadataEvent(apiResponse.chatId, apiResponse)
                } catch (error) {
                    if (chatId) {
                        sseStreamer.streamErrorEvent(chatId, getErrorMessage(error))
                    }
                    next(error)
                } finally {
                    sseStreamer.removeClient(chatId)
                }
            } else {
                const apiResponse = await predictionsServices.buildCanvasFlow(req)
                return res.json(apiResponse)
            }
        } else {
            const isStreamingRequested = req.body.streaming === 'true' || req.body.streaming === true
            if (isStreamingRequested) {
                return res.status(StatusCodes.FORBIDDEN).send(unauthorizedOriginError)
            }
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, unauthorizedOriginError)
        }
    } catch (error) {
        next(error)
    }
}

const getRateLimiterMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        return RateLimiterManager.getInstance().getRateLimiter()(req, res, next)
    } catch (error) {
        next(error)
    }
}

export default {
    createPrediction,
    getRateLimiterMiddleware
}
