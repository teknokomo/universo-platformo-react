// Universo Platformo | Scene Builder Proxy
// Re-export UPDLSceneBuilder for backward compatibility

import { UPDLSceneBuilder } from './UPDLSceneBuilder'

// Export UPDLSceneBuilder as SceneBuilder for legacy code compatibility
export { UPDLSceneBuilder as SceneBuilder }

// Export other classes and interfaces
export * from './UPDLFlowBuilder'
