// Universo Platformo | AR.js Publication API - extends base Publication API
// AR.js specific publication functionality

import { PublicationApi } from './PublicationApi'

// Local interface to avoid server dependencies
interface ILibraryConfig {
    arjs?: { version: string; source: string }
    aframe?: { version: string; source: string }
}

// Universo Platformo | AR.js specific publication settings interface
export interface ARJSPublicationSettings {
    isPublic: boolean
    projectTitle: string
    markerType: string
    markerValue: string
    generationMode: string
    libraryConfig?: ILibraryConfig
}

/**
 * AR.js Publication API client - extends base Publication API
 */
export class ARJSPublicationApi extends PublicationApi {
    /**
     * Save AR.js publication settings to Supabase
     * @param spaceId Space ID (formerly chatflowId)
     * @param settings AR.js publication settings to save
     */
    static async saveARJSSettings(spaceId: string, settings: ARJSPublicationSettings): Promise<void> {
        return this.savePublicationSettings(spaceId, 'arjs', settings)
    }

    /**
     * Load AR.js publication settings from Supabase
     * @param spaceId Space ID (formerly chatflowId)
     * @returns AR.js publication settings or null if not found
     */
    static async loadARJSSettings(spaceId: string): Promise<ARJSPublicationSettings | null> {
        return this.loadPublicationSettings(spaceId, 'arjs')
    }

    // Compatibility methods with old interface for gradual migration

    /**
     * @deprecated Use saveARJSSettings instead
     * Compatibility method for existing code
     */
    static async saveSettings(spaceId: string, settings: ARJSPublicationSettings): Promise<void> {
        console.warn('[ARJSPublicationApi] saveSettings is deprecated, use saveARJSSettings instead')
        return this.saveARJSSettings(spaceId, settings)
    }

    /**
     * @deprecated Use loadARJSSettings instead
     * Compatibility method for existing code
     */
    static async loadSettings(spaceId: string): Promise<ARJSPublicationSettings | null> {
        console.warn('[ARJSPublicationApi] loadSettings is deprecated, use loadARJSSettings instead')
        return this.loadARJSSettings(spaceId)
    }

    /**
     * @deprecated Use getSpaceById instead
     * Compatibility method for existing code
     */
    static async getChatflowById(unikId: string, chatflowId: string) {
        console.warn('[ARJSPublicationApi] getChatflowById is deprecated, use getSpaceById instead')
        return this.getSpaceById(unikId, chatflowId)
    }

    /**
     * @deprecated Use updateSpace instead
     * Compatibility method for existing code
     */
    static async updateChatflow(unikId: string, chatflowId: string, body: any) {
        console.warn('[ARJSPublicationApi] updateChatflow is deprecated, use updateSpace instead')
        return this.updateSpace(unikId, chatflowId, body)
    }
}
