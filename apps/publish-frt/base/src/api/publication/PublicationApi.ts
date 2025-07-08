// Universo Platformo | Base Publication API for all technologies
// Base publication functionality for Spaces (formerly Chatflows)

import axios from 'axios'
import { getAuthHeaders, getCurrentUrlIds } from '../common'
import { SUPPORTED_TECHNOLOGIES } from '../../builders/common/types'

const API_BASE = '/api/v1'

/**
 * Base Publication API client for all technologies
 */
export class PublicationApi {
    /**
     * Get space by ID (formerly chatflow)
     * @param unikId - Unik identifier
     * @param spaceId - Space identifier (still uses chatflowId in API)
     * @returns Promise with space data
     */
    static async getSpaceById(unikId: string, spaceId: string) {
        try {
            const headers = {
                ...getAuthHeaders(),
                'x-request-from': 'internal'
            }

            const response = await axios.get(`${API_BASE}/uniks/${unikId}/chatflows/${spaceId}`, { headers })

            return response
        } catch (error) {
            console.error('[PublicationApi] Error getting space:', error)
            throw error
        }
    }

    /**
     * Update space (formerly chatflow)
     * @param unikId - Unik identifier
     * @param spaceId - Space identifier (still uses chatflowId in API)
     * @param body - Update data
     * @returns Promise with updated space data
     */
    static async updateSpace(unikId: string, spaceId: string, body: any) {
        try {
            const headers = {
                ...getAuthHeaders(),
                'x-request-from': 'internal',
                'Content-Type': 'application/json'
            }

            const response = await axios.put(`${API_BASE}/uniks/${unikId}/chatflows/${spaceId}`, body, { headers })

            return response
        } catch (error) {
            console.error('[PublicationApi] Error updating space:', error)
            throw error
        }
    }

    /**
     * Save publication settings for any technology to Supabase
     * @param spaceId Space ID
     * @param technology Technology identifier (e.g., 'arjs', 'chatbot')
     * @param settings Technology-specific settings to save
     */
    static async savePublicationSettings(spaceId: string, technology: string, settings: any): Promise<void> {
        try {
            // Get unikId from URL since we need it for the request
            const { unikId } = getCurrentUrlIds()
            if (!unikId) {
                throw new Error('unikId not found in URL')
            }

            // First, get current space configuration
            const currentResponse = await this.getSpaceById(unikId, spaceId)
            const currentSpace = currentResponse.data
            let existingConfig: Record<string, any> = {}

            // Parse existing chatbotConfig to preserve other technology settings
            if (currentSpace.chatbotConfig) {
                try {
                    existingConfig =
                        typeof currentSpace.chatbotConfig === 'string' ? JSON.parse(currentSpace.chatbotConfig) : currentSpace.chatbotConfig
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

            // Update space with new configuration
            const updateData: any = {
                chatbotConfig: JSON.stringify(newConfig)
            }

            // Only update global isPublic if it differs from current state
            if (hasPublicTech !== currentSpace.isPublic) {
                updateData.isPublic = hasPublicTech
            }

            await this.updateSpace(unikId, spaceId, updateData)

            console.log(`✅ [PublicationApi] ${technology} settings saved successfully`)
        } catch (error) {
            console.error(`❌ [PublicationApi] Failed to save ${technology} settings:`, error)
            if (axios.isAxiosError(error)) {
                const errorMessage = error.response?.data?.error || error.response?.statusText || error.message
                throw new Error(`Failed to save ${technology} settings: ${errorMessage}`)
            }
            throw error
        }
    }

    /**
     * Load publication settings for any technology from Supabase
     * @param spaceId Space ID
     * @param technology Technology identifier (e.g., 'arjs', 'chatbot')
     * @returns Technology-specific settings or null if not found
     */
    static async loadPublicationSettings(spaceId: string, technology: string): Promise<any | null> {
        try {
            // Get unikId from URL since we need it for the request
            const { unikId } = getCurrentUrlIds()
            if (!unikId) {
                throw new Error('unikId not found in URL')
            }

            const response = await this.getSpaceById(unikId, spaceId)
            const space = response.data

            if (space.chatbotConfig) {
                try {
                    const config = typeof space.chatbotConfig === 'string' ? JSON.parse(space.chatbotConfig) : space.chatbotConfig

                    // Return technology settings from specific block
                    if (config[technology]) {
                        console.log(`✅ [PublicationApi] ${technology} settings loaded successfully`)
                        return config[technology]
                    }
                } catch (parseError) {
                    console.warn(`Failed to parse chatbotConfig when loading ${technology} settings:`, parseError)
                }
            }

            return null
        } catch (error) {
            console.error(`❌ [PublicationApi] Failed to load ${technology} settings:`, error)
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 404) {
                    throw new Error('Space not found')
                }
                const errorMessage = error.response?.data?.error || error.response?.statusText || error.message
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
}
