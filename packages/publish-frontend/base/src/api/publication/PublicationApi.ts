// Universo Platformo | Base Publication API for all technologies
// Base publication functionality for Spaces (formerly Chatflows)

import { getCurrentUrlIds } from '../common'
import { getPublishApiClient } from '../client'
import { SUPPORTED_TECHNOLOGIES } from '../../builders/common/types'

type AxiosErrorLike = {
    isAxiosError?: boolean
    response?: { data?: { error?: string }; status?: number; statusText?: string }
    message?: string
}

const client = () => getPublishApiClient()

const toAxiosError = (error: unknown): AxiosErrorLike | null => {
    if (error && typeof error === 'object' && 'isAxiosError' in error) {
        return error as AxiosErrorLike
    }
    return null
}

/**
 * Base Publication API client for all technologies
 */
export class PublicationApi {
    /**
     * Get canvas by ID (new structure) or space by ID (legacy)
     * @param unikId - Unik identifier
     * @param canvasId - Canvas identifier (or spaceId for legacy compatibility)
     * @returns Promise with canvas/space data
     */
    static async getCanvasById(unikId: string, canvasId: string) {
        try {
            return await client().get(`/unik/${unikId}/canvases/${canvasId}`)
        } catch (error) {
            console.error('[PublicationApi] Error getting canvas:', error)
            throw error
        }
    }

    /**
     * Update canvas (new structure) or space (legacy)
     * @param unikId - Unik identifier
     * @param canvasId - Canvas identifier (or spaceId for legacy compatibility)
     * @param body - Update data
     * @returns Promise with updated canvas/space data
     */
    static async updateCanvas(unikId: string, canvasId: string, body: any) {
        try {
            return await client().put(`/unik/${unikId}/canvases/${canvasId}`, body)
        } catch (error) {
            console.error('[PublicationApi] Error updating canvas:', error)
            throw error
        }
    }

    /**
     * Save publication settings for any technology to Canvas/Space
     * @param canvasId Canvas ID (or spaceId for legacy compatibility)
     * @param technology Technology identifier (e.g., 'arjs', 'chatbot')
     * @param settings Technology-specific settings to save
     */
    static async savePublicationSettings(canvasId: string, technology: string, settings: any): Promise<void> {
        try {
            // Get unikId from URL since we need it for the request
            const { unikId } = getCurrentUrlIds()
            if (!unikId) {
                throw new Error('unikId not found in URL')
            }

            // First, get current canvas/space configuration
            const currentResponse = await this.getCanvasById(unikId, canvasId)
            const currentCanvas = currentResponse.data
            let existingConfig: Record<string, any> = {}

            // Parse existing chatbotConfig to preserve other technology settings
            if (currentCanvas.chatbotConfig) {
                try {
                    existingConfig =
                        typeof currentCanvas.chatbotConfig === 'string'
                            ? JSON.parse(currentCanvas.chatbotConfig)
                            : currentCanvas.chatbotConfig
                } catch (parseError) {
                    console.warn('Failed to parse existing chatbotConfig, using empty object:', parseError)
                    existingConfig = {}
                }
            }

            // Create new configuration with technology settings
            const newConfig = {
                ...existingConfig,
                [technology]: settings
            }

            // Implement exclusive publication logic
            if (settings.isPublic) {
                // If this technology is being set to public, disable all other supported technologies
                for (const tech of SUPPORTED_TECHNOLOGIES) {
                    if (tech !== technology && newConfig[tech]?.isPublic) {
                        newConfig[tech].isPublic = false
                    }
                }
            }

            // Check if any technology is public for global isPublic flag
            const hasPublicTech = this.hasAnyPublicTechnology(newConfig)

            // Update canvas/space with new configuration
            const updateData: any = {
                chatbotConfig: JSON.stringify(newConfig)
            }

            // Only update global isPublic if it differs from current state
            if (hasPublicTech !== currentCanvas.isPublic) {
                updateData.isPublic = hasPublicTech
            }

            await this.updateCanvas(unikId, canvasId, updateData)

            console.log(`✅ [PublicationApi] ${technology} settings saved successfully for canvas ${canvasId}`)
        } catch (error) {
            console.error(`❌ [PublicationApi] Failed to save ${technology} settings:`, error)
            const axiosError = toAxiosError(error)
            if (axiosError?.response) {
                const errorMessage = axiosError.response.data?.error || axiosError.response.statusText || axiosError.message
                throw new Error(`Failed to save ${technology} settings: ${errorMessage}`)
            }
            throw error
        }
    }

    /**
     * Load publication settings for any technology from Canvas/Space
     * @param canvasId Canvas ID (or spaceId for legacy compatibility)
     * @param technology Technology identifier (e.g., 'arjs', 'chatbot')
     * @returns Technology-specific settings or null if not found
     */
    static async loadPublicationSettings(canvasId: string, technology: string): Promise<any | null> {
        try {
            // Get unikId from URL since we need it for the request
            const { unikId } = getCurrentUrlIds()
            if (!unikId) {
                throw new Error('unikId not found in URL')
            }

            const response = await this.getCanvasById(unikId, canvasId)
            const canvas = response.data

            if (canvas.chatbotConfig) {
                try {
                    const config = typeof canvas.chatbotConfig === 'string' ? JSON.parse(canvas.chatbotConfig) : canvas.chatbotConfig

                    // Return technology settings from specific block
                    if (config[technology]) {
                        return config[technology]
                    }
                } catch (parseError) {
                    console.warn(`Failed to parse chatbotConfig when loading ${technology} settings:`, parseError)
                }
            }

            return null
        } catch (error) {
            console.error(`❌ [PublicationApi] Failed to load ${technology} settings:`, error)
            const axiosError = toAxiosError(error)
            if (axiosError?.response) {
                if (axiosError.response.status === 404) {
                    throw new Error('Canvas not found')
                }
                const errorMessage = axiosError.response.data?.error || axiosError.response.statusText || axiosError.message
                throw new Error(`Failed to load ${technology} settings: ${errorMessage}`)
            }
            throw error
        }
    }

    /**
     * Helper function to check if any technology in the configuration is public
     * @param config Configuration object
     * @returns true if any technology is public
     */
    protected static hasAnyPublicTechnology(config: any): boolean {
        try {
            // Check chatbot technology
            if (config.chatbot?.isPublic) return true

            // Check AR.js technology
            if (config.arjs?.isPublic) return true

            // Check PlayCanvas technology
            if (config.playcanvas?.isPublic) return true

            // Add other technology checks here as they are implemented
            // if (config.web?.isPublic) return true

            return false
        } catch (error) {
            console.warn('Error checking public technologies:', error)
            return false
        }
    }

    /**
     * Get global publish settings from server
     * @returns Promise with global settings data
     */
    static async getGlobalSettings() {
        try {
            return await client().get('/publish/settings/global')
        } catch (error) {
            console.error('[PublicationApi] Error getting global settings:', error)
            throw error
        }
    }
}
