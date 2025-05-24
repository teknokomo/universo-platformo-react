// Universo Platformo | Publish Frontend Module
// Main entry point for the publish frontend module

// Import types from central Interface.UPDL.ts
import { IPublishRequest, IPublishResponse } from '@server/interface'

// Re-export types for backward compatibility
export type PublishRequest = IPublishRequest
export type PublishResponse = IPublishResponse

// Default module export for backward compatibility
const moduleExports = {
    // Empty for now - components are imported directly
}

export default moduleExports
