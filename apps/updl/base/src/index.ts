// Universo Platformo | UPDL Module
// Main entry point for the UPDL module - Node definitions only

// Import node classes for default export
import { CameraNode } from './nodes/camera/CameraNode'
import { LightNode } from './nodes/light/LightNode'
import { ObjectNode } from './nodes/object/ObjectNode'
import { SpaceNode } from './nodes/space/SpaceNode'
import { BaseUPDLNode } from './nodes/base/BaseUPDLNode'

// Export node classes directly
export { CameraNode } from './nodes/camera/CameraNode'
export { LightNode } from './nodes/light/LightNode'
export { ObjectNode } from './nodes/object/ObjectNode'
export { SpaceNode } from './nodes/space/SpaceNode'
export { BaseUPDLNode } from './nodes/base/BaseUPDLNode'

// Re-export interfaces
export * from './interfaces/UPDLInterfaces'
export * from './nodes/interfaces'

// Default module export - only node definitions
export default {
    CameraNode,
    LightNode,
    ObjectNode,
    SpaceNode,
    BaseUPDLNode
}
