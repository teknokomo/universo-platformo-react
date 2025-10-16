// Universo Platformo | Publish Frontend Module
// Main entry point for the publish frontend module

// Import types from @universo/publish-srv
import { IPublishRequest, IPublishResponse } from '@universo/publish-srv'

// Re-export types for backward compatibility
export type PublishRequest = IPublishRequest
export type PublishResponse = IPublishResponse

// Export all other components
export * from './components'

// Export features (migrated from packages/ui)
// Note: APICodeDialog is used from packages/ui/src/views/canvases/APICodeDialog.jsx
export { Configuration, EmbedChat } from './features/dialog'
export { ChatBotSettings, BaseBot, BaseBotSettings, BotRouter, ChatBotViewer } from './features/chatbot'
export { BaseBotEmbed, ChatBotEmbed } from './features/chatbot/embed'
export { APIShare, PythonCode, JavaScriptCode, LinksCode } from './features/api'
export { ARJSPublisher } from './features/arjs/ARJSPublisher'
export { default as ARJSExporter } from './features/arjs/ARJSExporter'
export { default as PlayCanvasPublisher } from './features/playcanvas/PlayCanvasPublisher'

// Export hooks
export { useAutoSave } from './hooks'

// Export types (avoid conflicts by importing and re-exporting specific types)
export type { GameMode, GameModeBuildOptions, DEFAULT_COLYSEUS_SETTINGS, DEFAULT_GAME_MODE } from './types/gameMode.types'
export * from './types/publication.types'

// Default module export for backward compatibility
const moduleExports = {
    // Empty for now - components are imported directly
}

export default moduleExports
