// Universo Platformo | Flow Data Service
// Service for extracting raw flow data from Supabase without UPDL processing
// REFACTORED: Using centralized types from publication.types.ts

import { DataSource } from 'typeorm'
import logger from '../utils/logger'
import { RawFlowData, CanvasMinimal, ChatFlowMinimal } from '../types/publication.types'
import { serialization } from '@universo-platformo/utils'

/**
 * Service for handling flow data extraction from Supabase
 * This service ONLY retrieves raw data without any UPDL processing
 *
 * ARCHITECTURE: Uses entity metadata access to work with ChatFlow
 * without requiring direct entity imports that cause path conflicts
 */
export class FlowDataService {
    constructor(private dataSource: DataSource) { }

    /**
     * Get raw flow data from Supabase by canvas ID (or chatflow ID for backward compatibility)
     * @param canvasId The ID of the canvas to retrieve (or chatflowId for compatibility)
     * @returns Object containing raw flowData, libraryConfig, and canvas metadata
     */
    async getFlowData(canvasId: string): Promise<RawFlowData> {
        try {
            logger.info(`[FlowDataService] Getting flow data for canvas ID: ${canvasId}`)

            // Try Canvas entity first (new structure)
            let canvas: CanvasMinimal | null = null
            try {
                const canvasMetadata = this.dataSource.getMetadata('Canvas')
                const canvasRepository = this.dataSource.getRepository(canvasMetadata.target)
                canvas = (await canvasRepository.findOne({
                    where: { id: canvasId }
                })) as CanvasMinimal | null

                if (canvas) {
                    logger.info(`[FlowDataService] Found canvas: ${canvas.name} (ID: ${canvas.id})`)
                }
            } catch (canvasError) {
                logger.info(`[FlowDataService] Canvas entity not found or not available, falling back to ChatFlow`)
            }

            // Fallback to ChatFlow entity (legacy structure) if Canvas not found
            if (!canvas) {
                const chatFlowMetadata = this.dataSource.getMetadata('ChatFlow')
                const chatFlowRepository = this.dataSource.getRepository(chatFlowMetadata.target)
                const chatFlow = (await chatFlowRepository.findOne({
                    where: { id: canvasId }
                })) as ChatFlowMinimal | null

                if (!chatFlow) {
                    throw new Error(`Canvas/ChatFlow not found: ${canvasId}`)
                }

                // Convert ChatFlow to Canvas format for consistency
                canvas = {
                    id: chatFlow.id,
                    name: chatFlow.name,
                    flowData: chatFlow.flowData,
                    chatbotConfig: chatFlow.chatbotConfig
                }
                logger.info(`[FlowDataService] Found chatflow (legacy): ${canvas.name} (ID: ${canvas.id})`)
            }

            if (!canvas.flowData) {
                throw new Error(`Canvas has no flowData: ${canvasId}`)
            }

            // Extract libraryConfig from chatbotConfig if available
            let libraryConfig = null
            let renderConfig = null
            let playcanvasConfig = null
            if (canvas.chatbotConfig) {
                try {
                    const parsed = typeof canvas.chatbotConfig === 'string' ? serialization.safeParseJson<any>(canvas.chatbotConfig) : { ok: true as const, value: canvas.chatbotConfig }
                    if (!parsed.ok) {
                        const errMsg = parsed.error?.message || 'Unknown JSON parse error'
                        logger.warn(`[FlowDataService] Failed to parse chatbotConfig: ${errMsg}`)
                    } else {
                        const config = parsed.value
                        if (config?.arjs?.libraryConfig) {
                            libraryConfig = config.arjs.libraryConfig
                            logger.info(`[FlowDataService] Extracted libraryConfig: ${JSON.stringify(libraryConfig)}`)
                        }
                        if (config?.arjs) {
                            const { arDisplayType, wallpaperType, markerType, markerValue, cameraUsage, backgroundColor } = config.arjs
                            renderConfig = { arDisplayType, wallpaperType, markerType, markerValue, cameraUsage, backgroundColor }
                            logger.info(`[FlowDataService] Extracted renderConfig: ${JSON.stringify(renderConfig)}`)
                        }
                        if (config?.playcanvas) {
                            const { gameMode, colyseusSettings, libraryConfig: pcLibraryConfig } = config.playcanvas
                            playcanvasConfig = { gameMode, colyseusSettings }
                            // Use PlayCanvas library config if available, otherwise fall back to AR.js config
                            if (pcLibraryConfig) {
                                libraryConfig = pcLibraryConfig
                            }
                            logger.info(`[FlowDataService] Extracted PlayCanvas config: ${JSON.stringify(playcanvasConfig)}`)
                        }
                    }
                } catch (parseError) {
                    logger.warn(`[FlowDataService] Unexpected error during chatbotConfig parse: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
                }
            }

            return {
                flowData: canvas.flowData, // Raw JSON string
                libraryConfig: libraryConfig, // Extracted library configuration
                renderConfig: renderConfig || undefined,
                playcanvasConfig: playcanvasConfig || undefined, // Extracted PlayCanvas configuration
                canvas: {
                    // Primary metadata (new structure)
                    id: canvas.id,
                    name: canvas.name
                },
                chatflow: {
                    // Backward compatibility metadata
                    id: canvas.id,
                    name: canvas.name
                }
            }
        } catch (error) {
            logger.error(`[FlowDataService] Error getting flow data for ${canvasId}:`, error)
            throw error
        }
    }
}
