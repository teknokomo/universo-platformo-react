// Universo Platformo | Type Exports
// Central export point for all publication types

// Publication types
export type {
    // Generation and display types
    GenerationMode,
    ARDisplayType,
    WallpaperType,
    CameraUsage,
    MarkerType,
    TimerPosition,
    DemoMode,
    PublicationTargetType,
    TechnologyType,
    // Configuration interfaces
    TimerConfig,
    LibraryVersion,
    ARJSLibraryConfig,
    PlayCanvasLibraryConfig,
    // Settings interfaces
    ARJSSettings,
    PlayCanvasSettings,
    // Component props
    PublisherProps,
    // Publication link types
    PublicationLink,
    PublicationLinkItem,
    // Demo mode types
    DemoModeConfig,
    // Global settings
    GlobalLibrarySettings,
    GlobalPublicationSettings
} from './publication.types'

export {
    // Constants
    DEFAULT_TIMER_CONFIG,
    DEFAULT_ARJS_SETTINGS,
    DEFAULT_PLAYCANVAS_SETTINGS,
    DEMO_MODES,
    DEFAULT_DEMO_MODE
} from './publication.types'

// Library types
export type { LibrarySource, LibraryConfig } from './library.types'

export { DEFAULT_LIBRARY_CONFIG, AVAILABLE_VERSIONS, LIBRARY_SOURCES } from './library.types'

// Game mode types
export type { GameMode, ColyseusSettings, GameModeSelectorProps, ColyseusSettingsProps, GameModeBuildOptions } from './gameMode.types'

export { DEFAULT_COLYSEUS_SETTINGS, DEFAULT_GAME_MODE } from './gameMode.types'
