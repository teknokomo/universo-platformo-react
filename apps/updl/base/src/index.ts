// Universo Platformo | UPDL Module
// Main entry point for the UPDL module - Node definitions only

// Import node classes for default export
import { CameraNode } from './nodes/camera/CameraNode'
import { DataNode } from './nodes/data/DataNode'
import { LightNode } from './nodes/light/LightNode'
import { ObjectNode } from './nodes/object/ObjectNode'
import { SpaceNode } from './nodes/space/SpaceNode'
import { EntityNode } from './nodes/entity/EntityNode'
import { ComponentNode } from './nodes/component/ComponentNode'
import { EventNode } from './nodes/event/EventNode'
import { ActionNode } from './nodes/action/ActionNode'
import { UniversoNode } from './nodes/universo/UniversoNode'
import { BaseUPDLNode } from './nodes/base/BaseUPDLNode'

// Export node classes directly
export { CameraNode } from './nodes/camera/CameraNode'
export { DataNode } from './nodes/data/DataNode'
export { LightNode } from './nodes/light/LightNode'
export { ObjectNode } from './nodes/object/ObjectNode'
export { SpaceNode } from './nodes/space/SpaceNode'
export { EntityNode } from './nodes/entity/EntityNode'
export { ComponentNode } from './nodes/component/ComponentNode'
export { EventNode } from './nodes/event/EventNode'
export { ActionNode } from './nodes/action/ActionNode'
export { UniversoNode } from './nodes/universo/UniversoNode'
export { BaseUPDLNode } from './nodes/base/BaseUPDLNode'

// Re-export interfaces
export * from './interfaces/UPDLInterfaces'
export * from './nodes/interfaces'

// Default module export - only node definitions
export default {
    CameraNode,
    DataNode,
    LightNode,
    ObjectNode,
    SpaceNode,
    EntityNode,
    ComponentNode,
    EventNode,
    ActionNode,
    UniversoNode,
    BaseUPDLNode
}
