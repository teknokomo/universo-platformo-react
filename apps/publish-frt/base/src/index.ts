// Universo Platformo | Publish Frontend Module
// Main entry point for the publish frontend module

// Import types from @universo/publish-srv
import { IPublishRequest, IPublishResponse } from '@universo/publish-srv'

// Re-export types for backward compatibility
export type PublishRequest = IPublishRequest
export type PublishResponse = IPublishResponse

// Default module export for backward compatibility
const moduleExports = {
    // Empty for now - components are imported directly
}

export default moduleExports
