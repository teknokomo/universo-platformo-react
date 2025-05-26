// Universo Platformo | Publication API exports
// All publication-related API clients and interfaces

export { PublicationApi } from './PublicationApi'
export { ARJSPublicationApi, type ARJSPublicationSettings } from './ARJSPublicationApi'
export { StreamingPublicationApi } from './StreamingPublicationApi'

// Re-export for compatibility during migration
export { ARJSPublicationApi as ChatflowsApi } from './ARJSPublicationApi'
export { type ARJSPublicationSettings as ARJSSettings } from './ARJSPublicationApi'

// Compatibility alias for ARJSPublishApi -> StreamingPublicationApi
export { StreamingPublicationApi as ARJSPublishApi } from './StreamingPublicationApi'
