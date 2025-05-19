// Universo Platformo | Publish Frontend Module
// Main entry point for the publish frontend module

// Import types
// ExporterSelectorProps might be unused if ExporterSelector is removed, review if types.ts needs cleanup later
// import { ExporterSelectorProps } from './interfaces/types'
import { PublishRequest, PublishResponse } from './interfaces/publishTypes'

// Re-export types
export { PublishRequest, PublishResponse }

// Define interface for the module exports
interface PublishModuleExports {
    components: {}
    // api: {} // No APIs are re-exported from this index anymore
    // features: {} // No features are re-exported from this index anymore
}

// Default module export
const moduleExports: PublishModuleExports = {
    components: {}
    // api: {},
    // features: {}
}

export default moduleExports
