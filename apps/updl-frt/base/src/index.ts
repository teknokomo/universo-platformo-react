// Universo Platformo | UPDL Frontend Module
// Main entry point for the UPDL frontend module

import { UPDLSceneBuilder } from './UPDLSceneBuilder'
import { initializeUPDL as initialize } from './initialize'

// Re-export main classes
export { UPDLSceneBuilder, initialize }

// Export node classes directly
export { CameraNode } from './nodes/camera/CameraNode'
export { LightNode } from './nodes/light/LightNode'
export { ObjectNode } from './nodes/object/ObjectNode'
export { SceneNode } from './nodes/scene/SceneNode'
export { BaseUPDLNode } from './nodes/base/BaseUPDLNode'

// Re-export interfaces
export * from './interfaces/UPDLInterfaces'
export * from './nodes/interfaces'

// Re-export builders
export * from './builders/SceneBuilder'

// Default module export
export default {
    initialize,
    UPDLSceneBuilder
}
