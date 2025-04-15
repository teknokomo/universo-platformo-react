// Universo Platformo | Chat bot controller
import { Request, Response, NextFunction } from 'express'
import logger from '../../utils/logger'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { StatusCodes } from 'http-status-codes'
import { ICommonObject } from 'flowise-components'

// Universo Platformo | Helper function to safely parse JSON
const safeParseJSON = (jsonString: string | null | undefined): ICommonObject => {
    try {
        return jsonString ? JSON.parse(jsonString) : {}
    } catch (error) {
        logger.error(`Error parsing JSON: ${error}`)
        return {}
    }
}

/**
 * Controller for chat bots
 */
export class ChatBotController {
    /**
     * Render chat bot
     */
    renderBot = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
        try {
            const appServer = getRunningExpressApp()
            const id = req.params.id
            logger.info(`[CHAT CONTROLLER] Rendering Chat Bot with ID: ${id}`)

            if (!id) {
                logger.error(`[CHAT CONTROLLER] Missing bot ID in request`)
                return res.status(400).set('Content-Type', 'application/json').json({
                    error: 'Invalid Request: Bot ID is required',
                    botType: 'chat'
                })
            }

            // Universo Platformo | Get ChatFlow directly from DB
            const chatflow = await appServer.AppDataSource.getRepository(ChatFlow).findOneBy({ id })

            if (!chatflow) {
                logger.error(`[CHAT CONTROLLER] Chatflow ${id} not found`)
                return res.status(404).set('Content-Type', 'application/json').json({
                    error: 'Chat Bot config not found',
                    botType: 'chat'
                })
            }

            // Universo Platformo | Get config from chatbotConfig
            const config = safeParseJSON(chatflow.chatbotConfig)
            config.botType = 'chat' // Ensure type is set

            logger.debug(`[CHAT CONTROLLER] Rendering Chat Bot with config`)

            res.render('chatbot/index', {
                id,
                botConfig: JSON.stringify(config),
                title: config.title || 'Chat Bot',
                backgroundColor: config.backgroundColor || '#ffffff',
                textColor: config.textColor || '#303235'
            })
        } catch (error) {
            logger.error(`[CHAT CONTROLLER] Error rendering Chat Bot: ${error instanceof Error ? error.message : String(error)}`)
            if (error instanceof Error) {
                logger.error(`[CHAT CONTROLLER] Error stack: ${error.stack}`)
            }
            return res.status(500).set('Content-Type', 'application/json').json({
                error: 'Error rendering Chat Bot',
                botType: 'chat'
            })
        }
    }

    /**
     * Get bot configuration
     */
    getBotConfig = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
        try {
            const appServer = getRunningExpressApp()
            const id = req.params.id
            logger.info(`[CHAT CONTROLLER] Getting Chat Bot config with ID: ${id}`)

            if (!id) {
                logger.error(`[CHAT CONTROLLER] Missing bot ID in request`)
                return res.status(400).set('Content-Type', 'application/json').json({
                    error: 'Invalid Request: Bot ID is required',
                    botType: 'chat'
                })
            }

            // Universo Platformo | Get ChatFlow directly from DB
            const chatflow = await appServer.AppDataSource.getRepository(ChatFlow).findOneBy({ id })

            if (!chatflow) {
                logger.error(`[CHAT CONTROLLER] Config not found for ${id}`)
                return res.status(404).set('Content-Type', 'application/json').json({
                    error: 'Chat Bot config not found',
                    botType: 'chat'
                })
            }

            // Universo Platformo | Get config from chatbotConfig
            const config = safeParseJSON(chatflow.chatbotConfig)
            config.botType = 'chat' // Ensure type is set

            logger.debug(`[CHAT CONTROLLER] Successfully got config for ${id}, setting botType to 'chat'`)

            return res.status(StatusCodes.OK).set('Content-Type', 'application/json').json(config)
        } catch (error) {
            logger.error(`[CHAT CONTROLLER] Error getting Chat Bot config: ${error instanceof Error ? error.message : String(error)}`)
            if (error instanceof Error) {
                logger.error(`[CHAT CONTROLLER] Error stack: ${error.stack}`)
            }
            return res.status(500).set('Content-Type', 'application/json').json({
                error: 'Error getting Chat Bot config',
                botType: 'chat'
            })
        }
    }
}
