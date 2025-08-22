// Universo Platformo | PlayCanvas Publication API - extends base Publication API
// PlayCanvas-specific publication functionality

import { PublicationApi } from './PublicationApi'
import type { DemoMode } from '../../types/publication.types'
import type { GameMode, ColyseusSettings } from '../../types/gameMode.types'

// Local interface to avoid server dependencies
interface ILibraryConfig {
    playcanvas?: { version: string; source: string }
}

// Universo Platformo | PlayCanvas specific publication settings interface
export interface PlayCanvasPublicationSettings {
    isPublic: boolean
    projectTitle: string
    generationMode: string
    templateId?: string
    libraryConfig?: ILibraryConfig
    demoMode?: DemoMode
    gameMode?: GameMode
    colyseusSettings?: ColyseusSettings
}

/**
 * PlayCanvas Publication API client - extends base Publication API
 */
export class PlayCanvasPublicationApi extends PublicationApi {
    /**
     * Save PlayCanvas publication settings to Supabase
     * @param spaceId Space ID (formerly chatflowId)
     * @param settings PlayCanvas publication settings to save
     */
    static async savePlayCanvasSettings(spaceId: string, settings: PlayCanvasPublicationSettings): Promise<void> {
        return this.savePublicationSettings(spaceId, 'playcanvas', settings)
    }

    /**
     * Load PlayCanvas publication settings from Supabase
     * @param spaceId Space ID (formerly chatflowId)
     * @returns PlayCanvas publication settings or null if not found
     */
    static async loadPlayCanvasSettings(spaceId: string): Promise<PlayCanvasPublicationSettings | null> {
        return this.loadPublicationSettings(spaceId, 'playcanvas')
    }
}
