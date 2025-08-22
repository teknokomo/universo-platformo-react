// Universo Platformo | Game Mode Types
// TypeScript interfaces for game mode selector components

/**
 * Available game modes for PlayCanvas publication
 */
export type GameMode = 'singleplayer' | 'multiplayer'

/**
 * Colyseus server configuration settings
 */
export interface ColyseusSettings {
    serverHost: string
    serverPort: number
    roomName: string
}

/**
 * Props for GameModeSelector component
 */
export interface GameModeSelectorProps {
    value: GameMode
    onChange: (mode: GameMode) => void
    disabled?: boolean
}

/**
 * Props for ColyseusSettings component
 */
export interface ColyseusSettingsProps {
    settings: ColyseusSettings
    onChange: (settings: ColyseusSettings) => void
    visible: boolean
}

/**
 * Extended BuildOptions interface with game mode support
 */
export interface GameModeBuildOptions {
    gameMode?: GameMode
    multiplayer?: ColyseusSettings
    // Extend existing BuildOptions
    projectName?: string
    libraryConfig?: any
    markerType?: string
    markerValue?: string
    debug?: boolean
    templateId?: string
    [key: string]: any
}

/**
 * Default Colyseus settings
 */
export const DEFAULT_COLYSEUS_SETTINGS: ColyseusSettings = {
    serverHost: 'localhost',
    serverPort: 2567,
    roomName: 'mmoomm_room'
}

/**
 * Default game mode
 */
export const DEFAULT_GAME_MODE: GameMode = 'singleplayer'