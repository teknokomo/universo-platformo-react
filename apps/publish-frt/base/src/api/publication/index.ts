// Universo Platformo | Publication API exports
// All publication-related API clients and interfaces

export { PublicationApi } from './PublicationApi'
export { ARJSPublicationApi, type ARJSPublicationSettings } from './ARJSPublicationApi'
export { StreamingPublicationApi } from './StreamingPublicationApi'
export { PlayCanvasPublicationApi, type PlayCanvasPublicationSettings } from './PlayCanvasPublicationApi'
export { PublishLinksApi, type PublishLinkRecord } from './PublishLinksApi'

// Export centralized types
export type { IARJSPublishRequest, IARJSPublishResponse, IUPDLFlowResult, IPublicationDataResult } from '@universo/publish-srv'

// Export new API clients
export { canvasVersionsApi, type CanvasVersion } from '../canvasVersions'

// Re-export for compatibility during migration
export { ARJSPublicationApi as ChatflowsApi } from './ARJSPublicationApi'
export { type ARJSPublicationSettings as ARJSSettings } from './ARJSPublicationApi'

// Compatibility alias for ARJSPublishApi -> StreamingPublicationApi
export { StreamingPublicationApi as ARJSPublishApi } from './StreamingPublicationApi'
