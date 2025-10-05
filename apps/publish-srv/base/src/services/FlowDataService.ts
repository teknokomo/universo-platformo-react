// Universo Platformo | Flow Data Service
// Service for extracting raw flow data from Supabase without UPDL processing
// REFACTORED: Using centralized types from publication.types.ts

import { DataSource } from 'typeorm'
import logger from '../utils/logger'
import { RawFlowData, CanvasMinimal } from '../types/publication.types'
import { serialization } from '@universo-platformo/utils'
import { PublishCanvas } from '../database/entities'

/**
 * Service for handling flow data extraction from Supabase
 * This service ONLY retrieves raw data without any UPDL processing
 * ARCHITECTURE: Uses entity metadata access to work with Canvas without
 * requiring direct entity imports that cause path conflicts
 */
export class FlowDataService {
    constructor(private dataSource: DataSource) { }

    private get publishRepository() {
        return this.dataSource.getRepository(PublishCanvas)
    }

    private async resolveCanvasIdByLink(link: PublishCanvas): Promise<string> {
        const canvasMetadata = this.dataSource.getMetadata('Canvas')
        const canvasRepository = this.dataSource.getRepository(canvasMetadata.target)

        if (link.targetType === 'version') {
            if (link.targetCanvasId) {
                return link.targetCanvasId
            }

            if (link.targetVersionUuid) {
                const canvas = await canvasRepository.findOne({
                    where: { versionUuid: link.targetVersionUuid }
                }) as CanvasMinimal | null
                if (canvas?.id) {
                    return canvas.id
                }
            }
            throw new Error('Published version is missing canvas reference')
        }

        if (link.versionGroupId) {
            const activeCanvas = await canvasRepository.findOne({
                where: {
                    versionGroupId: link.versionGroupId,
                    isActive: true
                }
            }) as CanvasMinimal | null

            if (activeCanvas?.id) {
                return activeCanvas.id
            }
        }

        if (link.targetCanvasId) {
            return link.targetCanvasId
        }

        throw new Error('Active canvas for publication could not be resolved')
    }

    /**
     * Get raw flow data from Supabase by canvas ID
     * @param canvasId The ID of the canvas to retrieve
     * @returns Object containing raw flowData, libraryConfig, and canvas metadata
     */
    async getFlowData(canvasId: string): Promise<RawFlowData> {
        try {
            logger.info(`[FlowDataService] Getting flow data for canvas ID: ${canvasId}`)

            const canvasMetadata = this.dataSource.getMetadata('Canvas')
            const canvasRepository = this.dataSource.getRepository(canvasMetadata.target)
            const canvas = (await canvasRepository.findOne({
                where: { id: canvasId }
            })) as CanvasMinimal | null

            if (!canvas) {
                throw new Error(`Canvas not found: ${canvasId}`)
            }

            logger.info(`[FlowDataService] Found canvas: ${canvas.name} (ID: ${canvas.id})`)

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
                technology: undefined,
                canvas: {
                    id: canvas.id,
                    name: canvas.name
                }
            }
        } catch (error) {
            logger.error(`[FlowDataService] Error getting flow data for ${canvasId}:`, error)
            throw error
        }
    }

    async getFlowDataBySlug(slug: string): Promise<RawFlowData> {
        try {
            logger.info(`[FlowDataService] Resolving slug: ${slug}`)

            const link = await this.publishRepository
                .createQueryBuilder('publish')
                .where('publish.baseSlug = :slug OR publish.customSlug = :slug', { slug })
                .getOne()

            if (!link) {
                throw new Error(`Publication link not found for slug: ${slug}`)
            }

            if (!link.isPublic) {
                throw new Error(`Publication is not public: ${slug}`)
            }

            const canvasId = await this.resolveCanvasIdByLink(link)
            const data = await this.getFlowData(canvasId)
            return {
                ...data,
                technology: link.technology
            }
        } catch (error) {
            logger.error(`[FlowDataService] Error getting flow data by slug ${slug}:`, error)
            throw error
        }
    }
}
