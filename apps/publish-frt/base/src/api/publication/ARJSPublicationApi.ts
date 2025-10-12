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
    templateId?: string
    libraryConfig?: ILibraryConfig
    arDisplayType?: 'wallpaper' | 'marker'
    wallpaperType?: 'standard'
    cameraUsage?: 'none' | 'standard'
    backgroundColor?: string // Add background color to interface
}

/**
 * AR.js Publication API client - extends base Publication API
 */
export class ARJSPublicationApi extends PublicationApi {
    /**
     * Save AR.js publication settings to Canvas
     * @param canvasId Canvas ID
     * @param settings AR.js publication settings to save
     */
    static async saveARJSSettings(canvasId: string, settings: ARJSPublicationSettings): Promise<void> {
        return this.savePublicationSettings(canvasId, 'arjs', settings)
    }

    /**
     * Load AR.js publication settings from Canvas
     * @param canvasId Canvas ID
     * @returns AR.js publication settings or null if not found
     */
    static async loadARJSSettings(canvasId: string): Promise<ARJSPublicationSettings | null> {
        return this.loadPublicationSettings(canvasId, 'arjs')
    }

    // Compatibility methods with old interface for gradual migration

    /**
     * @deprecated Use saveARJSSettings instead
     * Compatibility method for existing code
     */
    static async saveSettings(canvasId: string, settings: ARJSPublicationSettings): Promise<void> {
        console.warn('[ARJSPublicationApi] saveSettings is deprecated, use saveARJSSettings instead')
        return this.saveARJSSettings(canvasId, settings)
    }

    /**
     * @deprecated Use loadARJSSettings instead
     * Compatibility method for existing code
     */
    static async loadSettings(canvasId: string): Promise<ARJSPublicationSettings | null> {
        console.warn('[ARJSPublicationApi] loadSettings is deprecated, use loadARJSSettings instead')
        return this.loadARJSSettings(canvasId)
    }
}
