// Universo Platformo | Flow Data Service
// Service for extracting raw flow data from Supabase without UPDL processing
// REFACTORED: Using centralized types from publication.types.ts

import { DataSource } from 'typeorm'
import logger from '../utils/logger'
import { RawFlowData, ChatFlowMinimal } from '../types/publication.types'
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
     * Get raw flow data from Supabase by chatflow ID
     * @param chatflowId The ID of the chatflow to retrieve
     * @returns Object containing raw flowData, libraryConfig, and chatflow metadata
     */
    async getFlowData(chatflowId: string): Promise<RawFlowData> {
        try {
            logger.info(`[FlowDataService] Getting flow data for chatflow ID: ${chatflowId}`)

            // Get ChatFlow entity metadata from DataSource
            const chatFlowMetadata = this.dataSource.getMetadata('ChatFlow')
            const chatFlowRepository = this.dataSource.getRepository(chatFlowMetadata.target)

            // Find the ChatFlow by ID and cast to our interface
            const chatFlow = (await chatFlowRepository.findOne({
                where: { id: chatflowId }
            })) as ChatFlowMinimal | null

            if (!chatFlow) {
                throw new Error(`ChatFlow not found: ${chatflowId}`)
            }

            if (!chatFlow.flowData) {
                throw new Error(`ChatFlow has no flowData: ${chatflowId}`)
            }

            logger.info(`[FlowDataService] Found chatflow: ${chatFlow.name} (ID: ${chatFlow.id})`)

            // Extract libraryConfig from chatbotConfig if available
            let libraryConfig = null
            let renderConfig = null
            let playcanvasConfig = null
            if (chatFlow.chatbotConfig) {
                try {
                    const parsed = typeof chatFlow.chatbotConfig === 'string' ? serialization.safeParseJson<any>(chatFlow.chatbotConfig) : { ok: true as const, value: chatFlow.chatbotConfig }
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
                            const { arDisplayType, wallpaperType, markerType, markerValue } = config.arjs
                            renderConfig = { arDisplayType, wallpaperType, markerType, markerValue }
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
                flowData: chatFlow.flowData, // Raw JSON string
                libraryConfig: libraryConfig, // Extracted library configuration
                renderConfig: renderConfig || undefined,
                playcanvasConfig: playcanvasConfig || undefined, // Extracted PlayCanvas configuration
                chatflow: {
                    // Metadata
                    id: chatFlow.id,
                    name: chatFlow.name
                }
            }
        } catch (error) {
            logger.error(`[FlowDataService] Error getting flow data for ${chatflowId}:`, error)
            throw error
        }
    }
}
