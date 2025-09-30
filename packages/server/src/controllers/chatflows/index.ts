import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import apiKeyService from '../../services/apikey'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { Unik } from '@universo/uniks-srv'
import { RateLimiterManager } from '../../utils/rateLimit'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import { ChatflowType } from '../../Interface'
import chatflowsService from '../../services/chatflows'
import logger from '../../utils/logger'
import {
    ensureUnikMembershipResponse,
    resolveRequestUserId,
    workspaceAccessService
} from '../../services/access-control'

const ACCESS_DENIED_MESSAGE = 'Access denied: You do not have permission to access this Unik'

const checkIfChatflowIsValidForStreaming = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsRouter.checkIfChatflowIsValidForStreaming - id not provided!`
            )
        }
        const apiResponse = await chatflowsService.checkIfChatflowIsValidForStreaming(req.params.id)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const checkIfChatflowIsValidForUploads = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsRouter.checkIfChatflowIsValidForUploads - id not provided!`
            )
        }
        const apiResponse = await chatflowsService.checkIfChatflowIsValidForUploads(req.params.id)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const deleteChatflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.unikId) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: chatflowsRouter.deleteChatflow - unikId not provided!`)
        }
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: chatflowsRouter.deleteChatflow - unikId not provided!`)
        }

        const userId = await ensureUnikMembershipResponse(req, res, unikId, {
            errorMessage: ACCESS_DENIED_MESSAGE
        })
        if (!userId) return

        const apiResponse = await chatflowsService.deleteChatflow(req.params.id, unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getAllChatflows = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: chatflowsRouter.getAllChatflows - unikId not provided!`)
        }

        const userId = await ensureUnikMembershipResponse(req, res, unikId, {
            errorMessage: ACCESS_DENIED_MESSAGE
        })
        if (!userId) return

        const apiResponse = await chatflowsService.getAllChatflows(req.query?.type as ChatflowType, unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

// Get specific chatflow via api key
const getChatflowByApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.apikey) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsRouter.getChatflowByApiKey - apikey not provided!`
            )
        }
        const apikey = await apiKeyService.getApiKey(req.params.apikey)
        if (!apikey) {
            return res.status(401).send('Unauthorized')
        }
        const keyOnly = typeof req.query.keyonly === 'string' ? req.query.keyonly : undefined
        const apiResponse = await chatflowsService.getChatflowByApiKey(apikey.id, keyOnly)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getChatflowById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.unikId) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: chatflowsRouter.getChatflowById - unikId not provided!`)
        }
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: chatflowsRouter.getChatflowById - unikId not provided!`)
        }

        const userId = await ensureUnikMembershipResponse(req, res, unikId, {
            errorMessage: ACCESS_DENIED_MESSAGE
        })
        if (!userId) return

        const apiResponse = await chatflowsService.getChatflowById(req.params.id, unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const saveChatflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.body) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: chatflowsRouter.saveChatflow - body not provided!`)
        }
        const body = req.body

        // Universo Platformo | Check if unik_id is provided
        if (!body.unik_id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsRouter.saveChatflow - unik_id not provided in request body!`
            )
        }

        const userId = await ensureUnikMembershipResponse(req, res, body.unik_id, {
            errorMessage: ACCESS_DENIED_MESSAGE
        })
        if (!userId) return

        const newChatFlow = new ChatFlow()
        Object.assign(newChatFlow, body)
        // If the unik_id field is passed in the body, create a Unik object and assign it to the unik property
        if (body.unik_id) {
            const unik = new Unik()
            unik.id = body.unik_id
            newChatFlow.unik = unik
        }
        const apiResponse = await chatflowsService.saveChatflow(newChatFlow)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const importChatflows = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const chatflows: Partial<ChatFlow>[] = req.body.Chatflows
        const apiResponse = await chatflowsService.importChatflows(chatflows)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const updateChatflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.unikId) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: chatflowsRouter.updateChatflow - unikId not provided!`)
        }
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: chatflowsRouter.updateChatflow - unikId not provided!`)
        }

        const userId = await ensureUnikMembershipResponse(req, res, unikId, {
            errorMessage: ACCESS_DENIED_MESSAGE
        })
        if (!userId) return

        const chatflow = await chatflowsService.getChatflowById(req.params.id, unikId)
        if (!chatflow) {
            return res.status(404).send(`Chatflow ${req.params.id} not found`)
        }

        const body = req.body
        const updateChatFlow = new ChatFlow()
        Object.assign(updateChatFlow, body)

        const canvasId = chatflow.canvasId
        updateChatFlow.id = canvasId
        const rateLimiterManager = RateLimiterManager.getInstance()
        await rateLimiterManager.updateRateLimiter(updateChatFlow)

        const apiResponse = await chatflowsService.updateChatflow(chatflow, updateChatFlow, unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getSinglePublicChatflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsRouter.getSinglePublicChatflow - id not provided!`
            )
        }

        // Get the chatflow - service will handle public access validation
        const chatflow = await chatflowsService.getSinglePublicChatflow(req.params.id)

        return res.json(chatflow)
    } catch (error) {
        next(error)
    }
}

// Universo Platformo | Use the new bot controller that automatically determines the bot type
const getSinglePublicBotConfig = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsRouter.getSinglePublicBotConfig - id not provided!`
            )
        }

        // Universo Platformo | Retrieve chatflow to check its Unik ID
        const chatflowId = req.params.id
        const chatflow = await chatflowsService.getSinglePublicChatflow(chatflowId)

        // Universo Platformo | If chatflow belongs to a Unik, verify user access
        if (chatflow && chatflow.unikId) {
            const userId = resolveRequestUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized: User not authenticated' })
            }

            const hasAccess = await workspaceAccessService.hasUnikAccess(req, userId, chatflow.unikId)
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied: You do not have permission to access this bot' })
            }
        }

        // Universo Platformo | Call the corresponding method
        const botsController = require('../bots').default

        return botsController.getBotConfig(req, res, next)
    } catch (error) {
        logger.error(`Error getting unified bot config: ${getErrorMessage(error)}`)
        return res.status(500).json({ error: getErrorMessage(error) })
    }
}

export default {
    checkIfChatflowIsValidForStreaming,
    checkIfChatflowIsValidForUploads,
    deleteChatflow,
    getAllChatflows,
    getChatflowByApiKey,
    getChatflowById,
    saveChatflow,
    importChatflows,
    updateChatflow,
    getSinglePublicChatflow,
    getSinglePublicBotConfig
}
