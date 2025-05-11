// Universo Platformo | UPDL Interfaces for Express
// Defines interfaces for UPDL flow integration in Express

import { Vector3, Color } from '../../../api/updlApi'

/**
 * UPDL publication options interface
 */
export interface UPDLPublishOptions {
    markerType: 'pattern' | 'barcode' | 'custom'
    markerValue: string
    isPublic: boolean
    title: string
    description?: string
}

/**
 * UPDL Scene representation
 */
export interface UPDLScene {
    id: string
    name: string
    description?: string
    objects: UPDLObject[]
    cameras: UPDLCamera[]
    lights: UPDLLight[]
}

/**
 * Base UPDL entity with shared properties
 */
export interface UPDLEntity {
    id: string
    name: string
    position: Vector3
    rotation: Vector3
    scale: Vector3
}

/**
 * UPDL Object representation
 */
export interface UPDLObject extends UPDLEntity {
    type: string
    color?: Color
    width?: number
    height?: number
    depth?: number
    radius?: number
    geometry?: string
    material?: string
}

/**
 * UPDL Camera representation
 */
export interface UPDLCamera extends UPDLEntity {
    type: string
    fov?: number
    near?: number
    far?: number
    lookAt?: Vector3
}

/**
 * UPDL Light representation
 */
export interface UPDLLight extends UPDLEntity {
    type: string
    color?: Color
    intensity?: number
    distance?: number
    decay?: number
}

/**
 * Published UPDL AR.js project
 */
export interface UPDLARPublication {
    id: string
    title: string
    description?: string
    sceneId: string
    markerType: string
    markerValue: string
    isPublic: boolean
    createdAt: Date
    updatedAt?: Date
}

/**
 * Result of UPDL flow execution
 */
export interface UPDLFlowResult {
    scene?: UPDLScene
    updlScene?: UPDLScene
    chatId?: string
    sessionId?: string
    flowVariables?: Record<string, unknown>
}
