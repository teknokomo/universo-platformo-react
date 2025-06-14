// Universo Platformo | Bot controllers factory
import { Request, Response, NextFunction } from 'express'
import { ChatBotController } from './chat'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import logger from '../../utils/logger'
import { accessControlService } from '../../services/access-control'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'

// Universo Platformo | Add global declaration
declare global {
    var currentRequestType: string | undefined
}

/**
 * Universo Platformo | Factory for creating bot controller instances
 */
export class BotControllerFactory {
    private static chatBotController: ChatBotController

    /**
     * Universo Platformo | Get bot controller by type
     */
    static getController(botType: string): any {
        logger.debug(`Creating bot controller for type: ${botType}`)

        switch (botType?.toLowerCase()) {
            case 'chat':
            default:
                if (!this.chatBotController) {
                    this.chatBotController = new ChatBotController()
                }
                return this.chatBotController
        }
    }
}

/**
 * Universo Platformo | Get bot configuration
 * Universal method that determines bot type and uses the appropriate controller
 */
const getBotConfig = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    let botType = 'chat' // Default type
    try {
        const botId = req.params.id
        if (!botId) {
            logger.error('[BOT CONFIG] Missing bot ID in request')
            return res.status(400).set('Content-Type', 'application/json').json({
                error: 'Invalid Request: Bot ID is required'
            })
        }

        logger.info(`[BOT CONFIG] Getting bot config for ID: ${botId}`)

        // Universo Platformo | Retrieve chatflow to check its Unik ID
        const appServer = getRunningExpressApp()
        const chatflow = await appServer.AppDataSource.getRepository(ChatFlow).findOneBy({ id: botId })

        // Universo Platformo | If chatflow belongs to a Unik, verify user access
        if (chatflow && chatflow.unik && chatflow.unik.id) {
            // Universo Platformo | Check user access to this Unik
            const userId = (req as any).user?.sub
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized: User not authenticated' })
            }

            // Check if user has access to this Unik using AccessControlService
            const hasAccess = await accessControlService.checkUnikAccess(userId, chatflow.unik.id)
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied: You do not have permission to access this bot' })
            }
        }

        const requestedType = req.query.type as string

        // Universo Platformo | Use explicit request parameter when present
        if (requestedType === 'ar' || requestedType === 'chat') {
            logger.debug(`[BOT CONFIG] Using explicit bot type from request: ${requestedType}`)
            botType = requestedType
        } else {
            logger.debug(`[BOT CONFIG] No explicit type found, defaulting to 'chat'`)
            botType = 'chat'
        }

        // Universo Platformo | Get the controller based on determined type
        const controller = BotControllerFactory.getController(botType)

        // Universo Platformo | Delegate request to controller
        logger.debug(`[BOT CONFIG] Delegating to controller for type: ${botType}`)
        return controller.getBotConfig(req, res, next)
    } catch (error) {
        logger.error(`[BOT CONFIG] Error in getBotConfig: ${getErrorMessage(error)}`)
        // Try to delegate to default controller in case of error during type determination
        try {
            const controller = BotControllerFactory.getController('chat')
            return controller.getBotConfig(req, res, next)
        } catch (finalError) {
            logger.error(`[BOT CONFIG] Error delegating to default controller: ${getErrorMessage(finalError)}`)
            return res
                .status(500)
                .set('Content-Type', 'application/json')
                .json({
                    error: 'Error getting bot configuration',
                    message: getErrorMessage(error) // Return original error message
                })
        }
    }
}

/**
 * Universo Platformo | Render bot view
 * Universal method that determines bot type and uses the appropriate controller
 */
const renderBot = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    let botType = 'chat' // Default type
    try {
        const botId = req.params.id
        if (!botId) {
            logger.error('[BOT RENDER] Missing bot ID in request')
            return res.status(400).set('Content-Type', 'application/json').json({
                error: 'Invalid Request: Bot ID is required'
            })
        }

        logger.info(`[BOT RENDER] Rendering bot for ID: ${botId}`)

        // Universo Platformo | Retrieve chatflow to check its Unik ID
        const appServer = getRunningExpressApp()
        const chatflow = await appServer.AppDataSource.getRepository(ChatFlow).findOneBy({ id: botId })

        // Universo Platformo | If chatflow belongs to a Unik, verify user access
        if (chatflow && chatflow.unik && chatflow.unik.id) {
            // Universo Platformo | Check user access to this Unik
            const userId = (req as any).user?.sub
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized: User not authenticated' })
            }

            // Check if user has access to this Unik using AccessControlService
            const hasAccess = await accessControlService.checkUnikAccess(userId, chatflow.unik.id)
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied: You do not have permission to access this bot' })
            }
        }

        const requestedType = req.query.type as string

        // Universo Platformo | Use explicit request parameter when present
        if (requestedType === 'ar' || requestedType === 'chat') {
            logger.debug(`[BOT RENDER] Using explicit bot type from request: ${requestedType}`)
            botType = requestedType
        } else {
            logger.debug(`[BOT RENDER] No explicit type found, defaulting to 'chat'`)
            botType = 'chat'
        }

        // Universo Platformo | Get the controller based on determined type
        const controller = BotControllerFactory.getController(botType)

        // Universo Platformo | Check if controller has renderBot method
        if (typeof controller.renderBot !== 'function') {
            logger.warn(`[BOT RENDER] Controller for type '${botType}' does not support rendering.`)
            return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({
                error: `Rendering not supported for bot type '${botType}'`
            })
        }

        // Universo Platformo | Delegate request to controller
        logger.debug(`[BOT RENDER] Delegating to controller for type: ${botType}`)
        return controller.renderBot(req, res, next)
    } catch (error) {
        logger.error(`[BOT RENDER] Error in renderBot: ${getErrorMessage(error)}`)
        // Try to delegate to default controller in case of error during type determination
        try {
            const controller = BotControllerFactory.getController('chat')
            return controller.renderBot(req, res, next)
        } catch (finalError) {
            logger.error(`[BOT RENDER] Error delegating to default controller: ${getErrorMessage(finalError)}`)
            return res
                .status(500)
                .set('Content-Type', 'application/json')
                .json({
                    error: 'Error rendering bot',
                    message: getErrorMessage(error) // Return original error message
                })
        }
    }
}

/**
 * Universo Platformo | Stream data support
 * Redirects request to streaming controller
 */
const streamBot = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        if (!req.params.id) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, 'Error: botsController.streamBot - id not provided!')
        }

        const botId = req.params.id

        // Universo Platformo | Retrieve chatflow to check its Unik ID
        const appServer = getRunningExpressApp()
        const chatflow = await appServer.AppDataSource.getRepository(ChatFlow).findOneBy({ id: botId })

        // Universo Platformo | If chatflow belongs to a Unik, verify user access
        if (chatflow && chatflow.unik && chatflow.unik.id) {
            // Universo Platformo | Check user access to this Unik
            const userId = (req as any).user?.sub
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized: User not authenticated' })
            }

            // Check if user has access to this Unik using AccessControlService
            const hasAccess = await accessControlService.checkUnikAccess(userId, chatflow.unik.id)
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied: You do not have permission to access this bot' })
            }
        }

        // Universo Platformo | Use existing streaming controller
        const streamController = require('../chatflows-streaming').default

        // Universo Platformo | Modify request parameters to match controller expectations
        req.params.chatflowid = req.params.id

        // Universo Platformo | Delegate request to streaming controller
        return streamController.getResponse(req, res, next)
    } catch (error) {
        logger.error(`Error in streamBot: ${getErrorMessage(error)}`)
        next(error)
    }
}

// Universo Platformo | Export methods for use in routes
export default {
    getBotConfig,
    renderBot,
    streamBot
}
