// Universo Platformo | AR bot controller
import { Request, Response } from 'express'
import logger from '../../utils/logger'
import { utilBuildARflow } from '../../utils/buildARflow'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'

/**
 * Controller for AR bots
 */
export class ARBotController {
    /**
     * Get AR bot configuration using the new AR node logic
     */
    getBotConfig = async (req: Request, res: Response): Promise<any> => {
        try {
            const id = req.params.id
            logger.info(`Getting AR Bot config using AR flow logic for ID: ${id}`)

            // Check request type (GET or POST)
            const isInteractiveRequest = req.method === 'POST'

            // Use the new function to build the AR flow
            const result = await utilBuildARflow(req, false)

            // Log the result for debugging
            if (result) {
                logger.debug(`[AR API] Result contains scene: ${!!result.scene}`)

                // Check if the scene exists in the result
                if (!result.scene) {
                    logger.warn(`[AR API] Warning: Result does not contain scene data for flow ${id}`)

                    // If buildARflow doesn't produce a scene, return an error
                    logger.error(`[AR API] Error: No scene data generated by buildARflow for flow ${id}`)
                    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                        error: true,
                        message: 'No AR scene data generated for this flow'
                    })
                }

                if (result.scene.children && Array.isArray(result.scene.children)) {
                    logger.debug(`[AR API] Scene contains ${result.scene.children.length} children`)
                }
            } else {
                logger.error(`[AR API] Error: Empty result returned from buildARflow for flow ${id}`)
                return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                    error: true,
                    message: 'Empty result from AR flow processing'
                })
            }

            // Determine response format from request headers or parameters
            const wantsJson = req.headers.accept?.includes('application/json') || req.query.format === 'json' || isInteractiveRequest

            // Log request info before sending response
            logger.info(`[AR API] Sending ${wantsJson ? 'JSON' : 'HTML'} response for flow ${id}`)

            // Always return JSON as this is an API
            return res.json(result)
        } catch (error: any) {
            logger.error(`Error in AR bot processing: ${error.message}`)

            // Add additional information for debugging
            if (error.stack) {
                logger.error(`[AR API] Error stack: ${error.stack}`)
            }

            // Check for specific AR errors
            if (error instanceof InternalFlowiseError && error.message.includes('AR nodes not found')) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    error: true,
                    message: 'AR nodes not found in flow',
                    details: error.message
                })
            }

            // If authorization error, return 401
            if (error instanceof InternalFlowiseError && error.statusCode === StatusCodes.UNAUTHORIZED) {
                return res.status(StatusCodes.UNAUTHORIZED).json({
                    error: true,
                    message: 'Unauthorized access to AR flow',
                    details: error.message
                })
            }

            // General processing error
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                error: true,
                message: 'Error processing AR flow',
                details: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined // Only show stack in dev
            })
        }
    }

    // Universo Platformo | Removed renderBot method as it was redundant
}
