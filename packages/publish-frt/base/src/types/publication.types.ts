// Universo Platformo | Publication Types
// Comprehensive type definitions for publication settings across all technologies

import type { LibrarySource } from './library.types'
import type { GameMode, ColyseusSettings } from './gameMode.types'

// ============================================================================
// Common Publication Types
// ============================================================================

/**
 * Generation mode for publications
 */
export type GenerationMode = 'streaming'

/**
 * AR display types for AR.js publications
 */
export type ARDisplayType = 'marker' | 'wallpaper'

/**
 * Wallpaper types for AR.js
 */
export type WallpaperType = 'standard'

/**
 * Camera usage modes
 */
export type CameraUsage = 'none' | 'standard'

/**
 * Marker types for AR.js
 */
export type MarkerType = 'preset' | 'custom'

/**
 * Timer position options
 */
export type TimerPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-right'

/**
 * Available demo modes for PlayCanvas publication
 */
export type DemoMode = 'off' | 'primitives'

/**
 * Publication target types
 */
export type PublicationTargetType = 'group' | 'version'

/**
 * Technology types for publications
 */
export type TechnologyType = 'arjs' | 'playcanvas'

// ============================================================================
// Timer Configuration
// ============================================================================

/**
 * Timer configuration for quiz templates
 */
export interface TimerConfig {
    /** Whether timer is enabled */
    enabled: boolean
    /** Time limit in seconds (10-3600) */
    limitSeconds: number
    /** Position of timer on screen */
    position: TimerPosition
}

/**
 * Default timer configuration
 */
export const DEFAULT_TIMER_CONFIG: TimerConfig = {
    enabled: false,
    limitSeconds: 60,
    position: 'top-center'
}

// ============================================================================
// Library Version Configuration
// ============================================================================

/**
 * Library version configuration
 */
export interface LibraryVersion {
    /** Version string (e.g., "3.4.7") */
    version: string
    /** Source of the library */
    source: LibrarySource
    /** Optional integrity hash for CDN resources */
    integrity?: string
}

/**
 * Library configuration for AR.js (includes both AR.js and A-Frame)
 */
export interface ARJSLibraryConfig {
    arjs: LibraryVersion
    aframe: LibraryVersion
}

/**
 * Library configuration for PlayCanvas
 */
export interface PlayCanvasLibraryConfig {
    playcanvas: LibraryVersion
}

// ============================================================================
// AR.js Settings
// ============================================================================

/**
 * Complete settings for AR.js publications
 */
export interface ARJSSettings {
    /** Project title */
    projectTitle: string
    /** Whether publication is public */
    isPublic: boolean
    /** Generation mode (always 'streaming' for AR.js) */
    generationMode: GenerationMode
    /** Template identifier */
    templateId: string
    /** AR display type */
    arDisplayType: ARDisplayType
    /** Wallpaper type (when arDisplayType is 'wallpaper') */
    wallpaperType?: WallpaperType
    /** Camera usage mode */
    cameraUsage: CameraUsage
    /** Background color (when camera is disabled) */
    backgroundColor?: string
    /** Marker type (when arDisplayType is 'marker') */
    markerType?: MarkerType
    /** Marker value/preset name */
    markerValue?: string
    /** Library configuration */
    libraryConfig: ARJSLibraryConfig
    /** Timer configuration */
    timerConfig?: TimerConfig
}

/**
 * Default AR.js settings
 */
export const DEFAULT_ARJS_SETTINGS: Partial<ARJSSettings> = {
    generationMode: 'streaming',
    templateId: 'quiz',
    arDisplayType: 'wallpaper',
    wallpaperType: 'standard',
    cameraUsage: 'none',
    backgroundColor: '#1976d2',
    markerType: 'preset',
    markerValue: 'hiro',
    isPublic: false,
    timerConfig: DEFAULT_TIMER_CONFIG
}

// ============================================================================
// PlayCanvas Settings
// ============================================================================

/**
 * Complete settings for PlayCanvas publications
 */
export interface PlayCanvasSettings {
    /** Project title */
    projectTitle: string
    /** Whether publication is public */
    isPublic: boolean
    /** Generation mode (always 'streaming' for PlayCanvas) */
    generationMode: GenerationMode
    /** Template identifier */
    templateId: string
    /** Demo mode */
    demoMode: DemoMode
    /** Game mode (single/multiplayer) */
    gameMode: GameMode
    /** Colyseus server settings (when gameMode is 'multiplayer') */
    colyseusSettings?: ColyseusSettings
    /** Library configuration */
    libraryConfig: PlayCanvasLibraryConfig
}

/**
 * Default PlayCanvas settings
 */
export const DEFAULT_PLAYCANVAS_SETTINGS: Partial<PlayCanvasSettings> = {
    generationMode: 'streaming',
    templateId: 'mmoomm-playcanvas',
    demoMode: 'off',
    gameMode: 'singleplayer',
    isPublic: false
}

// ============================================================================
// Publisher Component Props
// ============================================================================

/**
 * Common props for publisher components
 * @template TSettings - Type of settings (ARJSSettings or PlayCanvasSettings)
 */
export interface PublisherProps<TSettings = ARJSSettings | PlayCanvasSettings> {
    /** Flow/canvas data */
    flow: {
        id: string
        name?: string
        isActive?: boolean
        is_active?: boolean
        versionGroupId?: string
        version_group_id?: string
        [key: string]: any
    }
    /** Unik workspace ID */
    unikId?: string
    /** Callback when publication is created */
    onPublish?: (result: { publicationId: string; publishedUrl: string }) => void
    /** Callback when publisher is cancelled */
    onCancel?: () => void
    /** Initial configuration */
    initialConfig?: Partial<TSettings>
}

// ============================================================================
// Publication Link Types
// ============================================================================

/**
 * Publication link record from database
 */
export interface PublicationLink {
    /** Unique link ID */
    id: string
    /** Base slug (always present) */
    baseSlug: string
    /** Custom slug (optional) */
    customSlug?: string | null
    /** Target type (group or version) */
    targetType: PublicationTargetType
    /** Technology type */
    technology: TechnologyType
    /** Target canvas ID */
    targetCanvasId?: string | null
    /** Version group ID */
    versionGroupId?: string | null
    /** Creation timestamp */
    createdAt?: string
    /** Update timestamp */
    updatedAt?: string
}

/**
 * Publication link item for UI display
 */
export interface PublicationLinkItem {
    /** Unique item ID */
    id: string
    /** Translation key for label */
    labelKey: string
    /** Full URL */
    url: string
}

// ============================================================================
// Demo Mode Configuration
// ============================================================================

/**
 * Demo mode configuration with display information
 */
export interface DemoModeConfig {
    value: DemoMode
    labelKey: string
    hintKey: string
}

/**
 * Available demo modes with their configurations
 */
export const DEMO_MODES: DemoModeConfig[] = [
    {
        value: 'off',
        labelKey: 'publish.playcanvas.demoMode.off',
        hintKey: 'publish.playcanvas.demoMode.offHint'
    },
    {
        value: 'primitives',
        labelKey: 'publish.playcanvas.demoMode.primitives',
        hintKey: 'publish.playcanvas.demoMode.primitivesHint'
    }
]

/**
 * Default demo mode
 */
export const DEFAULT_DEMO_MODE: DemoMode = 'off'

// ============================================================================
// Global Settings Types
// ============================================================================

/**
 * Global library management settings from server
 */
export interface GlobalLibrarySettings {
    /** Enable global library management (Level 1: Priority) */
    enableGlobalLibraryManagement: boolean
    /** Enforce global library management (Level 2: Enforcement) */
    enforceGlobalLibraryManagement: boolean
    /** Auto-correct legacy settings */
    autoCorrectLegacySettings: boolean
    /** Default library source */
    defaultLibrarySource: LibrarySource
}

/**
 * Global publication settings
 */
export interface GlobalPublicationSettings {
    /** Library management settings */
    libraryManagement?: GlobalLibrarySettings
    /** Other global settings can be added here */
    [key: string]: any
}
