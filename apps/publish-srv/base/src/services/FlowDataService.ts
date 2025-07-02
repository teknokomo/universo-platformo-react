// Universo Platformo | Flow Data Service
// Service for extracting raw flow data from Supabase without UPDL processing
// REFACTORED: Using centralized types from publication.types.ts

import { DataSource } from 'typeorm'
import logger from '../utils/logger'
import { RawFlowData, ChatFlowMinimal } from '../types/publication.types'

/**
 * Service for handling flow data extraction from Supabase
 * This service ONLY retrieves raw data without any UPDL processing
 *
 * ARCHITECTURE: Uses entity metadata access to work with ChatFlow
 * without requiring direct entity imports that cause path conflicts
 */
export class FlowDataService {
    constructor(private dataSource: DataSource) {}

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
            if (chatFlow.chatbotConfig) {
                try {
                    const config = typeof chatFlow.chatbotConfig === 'string' ? JSON.parse(chatFlow.chatbotConfig) : chatFlow.chatbotConfig

                    if (config.arjs && config.arjs.libraryConfig) {
                        libraryConfig = config.arjs.libraryConfig
                        logger.info(`[FlowDataService] Extracted libraryConfig: ${JSON.stringify(libraryConfig)}`)
                    }
                } catch (parseError) {
                    logger.warn(`[FlowDataService] Failed to parse chatbotConfig for libraryConfig: ${parseError}`)
                }
            }

            return {
                flowData: chatFlow.flowData, // Raw JSON string
                libraryConfig: libraryConfig, // Extracted library configuration
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
