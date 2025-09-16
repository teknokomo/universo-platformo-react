// Universo Platformo | Publication controller
// REFACTORED: Now uses dependency injection for FlowDataService

import { Request, Response } from 'express'
import logger from '../utils/logger'
import { FlowDataService } from '../services/FlowDataService'

// Universo Platformo | Removed loadARJSSettings function - libraryConfig now comes directly from utilBuildUPDLflow
// This simplifies the architecture by eliminating duplicate database queries and keeping all chatflow
// data access centralized in utilBuildUPDLflow

/**
 * Controller for AR.js publication via UPDL
 * ARCHITECTURE: Uses dependency injection for FlowDataService to break circular dependencies
 */
export class PublishController {
    constructor(private flowDataService: FlowDataService) { }

    /**
     * Publish AR.js project
     * @param req Request
     * @param res Response
     */
    public async publishARJS(req: Request, res: Response): Promise<void> {
        logger.info(`[PublishController] publishARJS called with params: ${JSON.stringify(req.body)}`)
        try {
            const { canvasId, chatflowId, generationMode = 'streaming', isPublic = true, projectName } = req.body

            // Support both canvasId (new) and chatflowId (legacy) for backward compatibility
            const targetId = canvasId || chatflowId
            if (!targetId) {
                // Explicitly set content type header
                res.setHeader('Content-Type', 'application/json')
                res.status(400).json({
                    success: false,
                    error: 'Missing required parameter: canvasId or chatflowId'
                })
                return
            }

            // In streaming generation mode, use canvasId itself for simplification
            const publicationId = targetId
            const createdAt = new Date().toISOString()

            logger.info(`[PublishController] Creating publication response with publicationId: ${publicationId}`)

            // Explicitly set content type header
            res.setHeader('Content-Type', 'application/json')

            const responseData = {
                success: true,
                publicationId,
                canvasId: targetId, // Primary ID (new structure)
                chatflowId: targetId, // Backward compatibility
                projectName: projectName || `AR.js for ${targetId}`,
                generationMode,
                isPublic,
                createdAt
            }

            logger.info(`[PublishController] Response data: ${JSON.stringify(responseData)}`)

            // Return publication metadata
            res.status(200).json(responseData)
        } catch (error) {
            logger.error(`[PublishController] Error publishing AR.js:`, error)

            // Explicitly set content type header
            res.setHeader('Content-Type', 'application/json')

            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error during publication'
            })
        }
    }

    /**
     * Get public publication data for AR.js by ID
     * @param req Request
     * @param res Response
     */
    public async getPublicARJSPublication(req: Request, res: Response): Promise<void> {
        const publicationId = req.params.publicationId
        logger.info(`[PublishController] getPublicARJSPublication called. PublicationId: ${publicationId}`)
        logger.info(`[PublishController] Request params: ${JSON.stringify(req.params)}`)
        logger.info(`[PublishController] PublicationId type: ${typeof publicationId}, value: "${publicationId}"`)

        try {
            if (!publicationId || publicationId === 'undefined') {
                logger.error(`[PublishController] Invalid publicationId: ${publicationId}`)
                // Explicitly set content type header
                res.setHeader('Content-Type', 'application/json')
                res.status(400).json({
                    success: false,
                    error: 'Missing or invalid publicationId parameter'
                })
                return
            }

            // For streaming generation mode, redirect request to streamUPDL
            // Since publicationId in streaming mode = canvasId (or chatflowId for legacy)
            req.params.canvasId = publicationId
            req.params.chatflowId = publicationId // Backward compatibility
            logger.info(`[PublishController] Using streamUPDL for AR.js public data retrieval with ID: ${publicationId}`)
            return await this.streamUPDL(req, res)
        } catch (error) {
            logger.error(`[PublishController] Error in getPublicARJSPublication:`, error)

            // Explicitly set content type header
            res.setHeader('Content-Type', 'application/json')

            res.status(500).json({
                success: false,
                error: 'Failed to fetch AR.js publication data',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }

    /**
     * Get raw flow data for AR.js streaming generation
     * UPDATED: Now uses injected FlowDataService instead of static method
     * @param req Request
     * @param res Response
     */
    public async streamUPDL(req: Request, res: Response): Promise<void> {
        const id = req.params.canvasId || req.params.chatflowId || req.params.publicationId
        logger.info(`[PublishController] streamUPDL called for ID: ${id}`)
        logger.info(`[PublishController] Request params: ${JSON.stringify(req.params)}`)
        logger.info(`[PublishController] Request URL: ${req.originalUrl}`)

        if (!id) {
            res.setHeader('Content-Type', 'application/json')
            logger.error(`[PublishController] Missing ID parameter! URL: ${req.originalUrl}, params: ${JSON.stringify(req.params)}`)
            res.status(400).json({
                success: false,
                error: 'Missing ID parameter'
            })
            return
        }

        try {
            // Use injected FlowDataService instance instead of static method
            logger.info(`[PublishController] Calling flowDataService.getFlowData for id: ${id}`)
            const flowData = await this.flowDataService.getFlowData(id)

            if (!flowData || !flowData.flowData) {
                logger.warn(`[PublishController] FlowDataService returned no flow data for ${id}`)
                throw new Error(`Failed to get flow data for ${id}`)
            }

            logger.info(`[PublishController] Successfully retrieved flow data for ${id}`)
            logger.info(`[PublishController] libraryConfig from FlowDataService:`, flowData.libraryConfig ? 'found' : 'not found')
            if (flowData.libraryConfig) {
                logger.info(`[PublishController] libraryConfig details:`, JSON.stringify(flowData.libraryConfig))
            }

            // Return RAW flow data (not processed UPDL structures)
            const responseData = {
                success: true,
                publicationId: id,
                projectName: flowData.canvas?.name || flowData.chatflow?.name || `UPDL Canvas ${id}`,
                generationMode: 'streaming',
                flowData: flowData.flowData, // Raw JSON string
                libraryConfig: flowData.libraryConfig, // Extracted configuration
                renderConfig: flowData.renderConfig, // AR display settings (wallpaper/marker)
                playcanvasConfig: flowData.playcanvasConfig, // PlayCanvas settings (gameMode, colyseusSettings)
                canvasId: id, // Primary ID (new structure)
                chatflowId: id, // Backward compatibility
                timestamp: new Date().toISOString()
            }

            logger.info(`[PublishController] Preparing raw data API response:`, {
                responseKeys: Object.keys(responseData),
                hasLibraryConfig: !!responseData.libraryConfig,
                libraryConfigDetails: responseData.libraryConfig,
                flowDataLength: responseData.flowData.length,
                projectName: responseData.projectName
            })

            res.setHeader('Content-Type', 'application/json')
            res.status(200).json(responseData)
        } catch (error) {
            logger.error(`[PublishController] Error in streamUPDL:`, error)
            logger.error(`[PublishController] Error details: ${error instanceof Error ? error.stack : String(error)}`)

            res.setHeader('Content-Type', 'application/json')
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve flow data',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }

    /**
     * Get publish global settings
     * @param req Request
     * @param res Response
     */
    public async getGlobalSettings(req: Request, res: Response): Promise<void> {
        logger.info(`[PublishController] getGlobalSettings called`)
        try {
            // Read environment variables
            const globalLibraryManagement = process.env.PUBLISH_ENABLE_GLOBAL_LIBRARY_MANAGEMENT === 'true'
            const enforceGlobalLibraryManagement = process.env.PUBLISH_ENFORCE_GLOBAL_LIBRARY_MANAGEMENT === 'true'
            const autoCorrectLegacySettings = process.env.PUBLISH_AUTO_CORRECT_LEGACY_SETTINGS === 'true'
            const defaultLibrarySource = process.env.PUBLISH_DEFAULT_LIBRARY_SOURCE || 'kiberplano'

            res.setHeader('Content-Type', 'application/json')
            res.status(200).json({
                success: true,
                data: {
                    enableGlobalLibraryManagement: globalLibraryManagement,
                    enforceGlobalLibraryManagement: enforceGlobalLibraryManagement,
                    autoCorrectLegacySettings: autoCorrectLegacySettings,
                    defaultLibrarySource: defaultLibrarySource
                }
            })
        } catch (error) {
            logger.error(`[PublishController] Error in getGlobalSettings:`, error)

            res.setHeader('Content-Type', 'application/json')
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve global settings',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }
}
