// Universo Platformo | Publication controller
import { Request, Response } from 'express'
import path from 'path'
import logger from '../utils/logger'
import axios from 'axios'

// Universo Platformo | Import buildUPDLflow функцию для потоковой генерации из UPDL-узлов
let utilBuildUPDLflow: any
{
    const baseDir = __dirname
    // Try to load from built dist
    try {
        const prodPath = path.resolve(baseDir, '../../../../../packages/server/dist/utils/buildUPDLflow')
        utilBuildUPDLflow = require(prodPath).utilBuildUPDLflow
        logger.info(`[PublishController] Imported utilBuildUPDLflow from ${prodPath}`)
    } catch (e1) {
        // Try tooloadofromcsource
        try {
            const devPath = path.resolve(baseDir, '../../../../../packages/server/src/utils/buildUPDLflow')
            utilBuildUPDLflow = require(devPath).utilBuildUPDLflow
            logger.info(`[PublishController] Imported utilBuildUPDLflow from ${devPath}`)
        } catch (e2) {
            logger.error('[PublishController] Failed to import utilBuildUPDLflow:', e2)
            logger.warn('[PublishController] utilBuildUPDLflow not available, streamUPDL fallback will be used')
        }
    }
}

// Universo Platformo | Removed loadARJSSettings function - libraryConfig now comes directly from utilBuildUPDLflow
// This simplifies the architecture by eliminating duplicate database queries and keeping all chatflow
// data access centralized in utilBuildUPDLflow

/**
 * Controller for AR.js publication via UPDL
 */
export class PublishController {
    /**
     * Publish AR.js project
     * @param req Request
     * @param res Response
     */
    public async publishARJS(req: Request, res: Response): Promise<void> {
        logger.info(`[PublishController] publishARJS called with params: ${JSON.stringify(req.body)}`)
        try {
            const { chatflowId, generationMode = 'streaming', isPublic = true, projectName } = req.body

            if (!chatflowId) {
                // Explicitly set content type header
                res.setHeader('Content-Type', 'application/json')
                res.status(400).json({
                    success: false,
                    error: 'Missing required parameter: chatflowId'
                })
                return
            }

            // In streaming generation mode, use chatflowId itself for simplification
            const publicationId = chatflowId
            const createdAt = new Date().toISOString()

            // Explicitly set content type header
            res.setHeader('Content-Type', 'application/json')

            // Return publication metadata
            res.status(200).json({
                success: true,
                publicationId,
                chatflowId,
                projectName: projectName || `AR.js for ${chatflowId}`,
                generationMode,
                isPublic,
                createdAt
            })
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
        logger.info(`[PublishController] getPublicARJSPublication called. PublicationId: ${req.params.publicationId}`)
        try {
            const { publicationId } = req.params

            if (!publicationId) {
                // Explicitly set content type header
                res.setHeader('Content-Type', 'application/json')
                res.status(400).json({
                    success: false,
                    error: 'Missing required parameter: publicationId'
                })
                return
            }

            // For streaming generation mode, redirect request to streamUPDL
            // Since publicationId in streaming mode = chatflowId
            req.params.chatflowId = publicationId
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
     * Get UPDL space data for AR.js streaming generation
     * @param req Request
     * @param res Response
     */
    public async streamUPDL(req: Request, res: Response): Promise<void> {
        const id = req.params.chatflowId || req.params.publicationId
        logger.info(`[PublishController] streamUPDL called for ID: ${id}`)
        logger.info(`[PublishController] Request params: ${JSON.stringify(req.params)}`)
        logger.info(`[PublishController] Request URL: ${req.originalUrl}`)

        if (!id) {
            // Explicitly set content type header
            res.setHeader('Content-Type', 'application/json')
            logger.error(`[PublishController] Missing ID parameter! URL: ${req.originalUrl}, params: ${JSON.stringify(req.params)}`)
            res.status(400).json({
                success: false,
                error: 'Missing ID parameter'
            })
            return
        }

        try {
            if (!utilBuildUPDLflow) {
                throw new Error('utilBuildUPDLflow is not available')
            }

            // Call function to get UPDL data from nodes
            logger.info(`[PublishController] Calling utilBuildUPDLflow for id: ${id}`)
            const result = await utilBuildUPDLflow(id)

            if (!result) {
                logger.warn(`[PublishController] utilBuildUPDLflow returned no result for ${id}`)
                throw new Error(`Failed to build UPDL flow for ${id}`)
            }

            // Universo Platformo | Handle both single space and multi-scene results
            let spaceToUse = null
            let isMultiScene = false

            if (result.multiScene) {
                // Multi-scene result
                isMultiScene = true
                logger.info(`[PublishController] Multi-scene result with ${result.multiScene.totalScenes} scenes`)

                // Validate multi-scene structure
                if (!result.multiScene.scenes || result.multiScene.scenes.length === 0) {
                    logger.warn(`[PublishController] utilBuildUPDLflow returned empty multi-scene for ${id}`)
                    res.setHeader('Content-Type', 'application/json')
                    res.status(404).json({
                        success: false,
                        error: 'Multi-scene structure not found or empty'
                    })
                    return
                }
            } else {
                // Single space result (legacy)
                spaceToUse = result.updlSpace

                if (!spaceToUse || !spaceToUse.objects || spaceToUse.objects.length === 0) {
                    logger.warn(`[PublishController] utilBuildUPDLflow returned empty space for ${id}`)
                    res.setHeader('Content-Type', 'application/json')
                    res.status(404).json({
                        success: false,
                        error: 'UPDL space not found or empty'
                    })
                    return
                }
            }

            if (isMultiScene) {
                logger.info(`[PublishController] Successfully built multi-scene with ${result.multiScene.scenes.length} scenes`)
            } else {
                logger.info(`[PublishController] Successfully built UPDL space with ${spaceToUse.objects?.length || 0} objects`)
            }

            // Universo Platformo | libraryConfig now comes directly from utilBuildUPDLflow result
            logger.info(`[PublishController] libraryConfig from utilBuildUPDLflow:`, result.libraryConfig ? 'found' : 'not found')
            if (result.libraryConfig) {
                logger.info(`[PublishController] libraryConfig details:`, JSON.stringify(result.libraryConfig))
            }

            // Universo Platformo | Enhanced debugging for API response
            const responseData: any = {
                success: true,
                publicationId: id,
                projectName: isMultiScene ? `Multi-Scene AR.js for ${id}` : spaceToUse?.name || `AR.js for ${id}`,
                generationMode: 'streaming',
                // Universo Platformo | Include libraryConfig from AR.js settings
                libraryConfig: result.libraryConfig || null,
                timestamp: new Date().toISOString()
            }

            // Add the appropriate data structure based on mode
            if (isMultiScene) {
                responseData.multiScene = result.multiScene
            } else {
                responseData.updlSpace = spaceToUse
            }

            logger.info(`[PublishController] Preparing API response:`, {
                responseKeys: Object.keys(responseData),
                hasLibraryConfig: !!responseData.libraryConfig,
                libraryConfigDetails: responseData.libraryConfig,
                isMultiScene: isMultiScene,
                spaceObjectCount: isMultiScene
                    ? responseData.multiScene?.scenes?.reduce((total: number, scene: any) => total + (scene.objectNodes?.length || 0), 0) ||
                      0
                    : responseData.updlSpace?.objects?.length || 0,
                sceneCount: isMultiScene ? responseData.multiScene?.totalScenes : 1
            })

            // Return space data for UPDL nodes with libraryConfig
            // Explicitly set content type header
            res.setHeader('Content-Type', 'application/json')
            res.status(200).json(responseData)
        } catch (error) {
            logger.error(`[PublishController] Error in streamUPDL:`, error)
            logger.error(`[PublishController] Error details: ${error instanceof Error ? error.stack : String(error)}`)

            // In case of error, return error
            // Explicitly set content type header
            res.setHeader('Content-Type', 'application/json')
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve UPDL space',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }
}

// Create controller instance for use in routes
export const publishController = new PublishController()
