// Universo Platformo | Publish Frontend Module
// Main entry point for the publish frontend module

// Side-effect: Register 'publish' namespace with global i18n
import './i18n'

// Import types from @universo/publish-srv
import { IPublishRequest, IPublishResponse } from '@universo/publish-srv'

// Re-export types for backward compatibility
export type PublishRequest = IPublishRequest
export type PublishResponse = IPublishResponse

// Export all other components
export * from './components'

// Export features (migrated from packages/flowise-ui)
// Note: APICodeDialog is used from packages/flowise-ui/src/views/canvases/APICodeDialog.jsx
export { Configuration, EmbedChat } from './features/dialog'
export { ChatBotSettings, BaseBot, BaseBotSettings, BotRouter, ChatBotViewer } from './features/chatbot'
export { BaseBotEmbed, ChatBotEmbed } from './features/chatbot/embed'
export { APIShare, PythonCode, JavaScriptCode, LinksCode } from './features/api'
export { default as ARJSPublisher } from './features/arjs/ARJSPublisher'
export { default as ARJSExporter } from './features/arjs/ARJSExporter'
export { default as PlayCanvasPublisher } from './features/playcanvas/PlayCanvasPublisher'

// Export hooks
export { useAutoSave } from './hooks'

// Export types from centralized types module
// Note: Explicit exports to avoid conflicts with component names
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
    // Publication link types (note: PublicationLink is also a component name)
    PublicationLink as PublicationLinkData,
    PublicationLinkItem,
    // Demo mode types
    DemoModeConfig,
    // Global settings
    GlobalLibrarySettings,
    GlobalPublicationSettings,
    // Library types
    LibrarySource,
    LibraryConfig,
    // Game mode types (note: ColyseusSettings is also a component name)
    GameMode,
    ColyseusSettings as ColyseusSettingsData,
    GameModeSelectorProps,
    ColyseusSettingsProps,
    GameModeBuildOptions
} from './types'

// Export constants from types
export {
    DEFAULT_TIMER_CONFIG,
    DEFAULT_ARJS_SETTINGS,
    DEFAULT_PLAYCANVAS_SETTINGS,
    DEMO_MODES,
    DEFAULT_DEMO_MODE,
    DEFAULT_LIBRARY_CONFIG,
    AVAILABLE_VERSIONS,
    LIBRARY_SOURCES,
    DEFAULT_COLYSEUS_SETTINGS,
    DEFAULT_GAME_MODE
} from './types'

// Default module export for backward compatibility
const moduleExports = {
    // Empty for now - components are imported directly
}

export default moduleExports
