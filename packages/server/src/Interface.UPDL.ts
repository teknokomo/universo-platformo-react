// Universo Platformo | UPDL Interfaces
// Interfaces for Universal Platform Definition Language

/**
 * Basic types for 3D coordinates and transformations
 */
export interface IUPDLPosition {
    x: number
    y: number
    z: number
}

export interface IUPDLRotation {
    x: number
    y: number
    z: number
}

export interface IUPDLColor {
    r: number
    g: number
    b: number
}

/**
 * Base object for all UPDL components
 */
export interface IUPDLBaseObject {
    id: string
    name: string
    position?: IUPDLPosition
    rotation?: IUPDLRotation
    scale?: IUPDLPosition
}

/**
 * 3D Object definition
 */
export interface IUPDLObject extends IUPDLBaseObject {
    type: string
    color: IUPDLColor
    width?: number
    height?: number
    depth?: number
    radius?: number
}

/**
 * Camera definition
 */
export interface IUPDLCamera extends IUPDLBaseObject {
    type: string
    fov?: number
    near?: number
    far?: number
    lookAt?: IUPDLPosition
}

/**
 * Light definition
 */
export interface IUPDLLight extends IUPDLBaseObject {
    type: string
    color: IUPDLColor
    intensity?: number
    distance?: number
    decay?: number
}

/**
 * Complete UPDL Scene
 */
export interface UPDLScene {
    id: string
    name: string
    objects: IUPDLObject[]
    cameras: IUPDLCamera[]
    lights: IUPDLLight[]
}

/**
 * Result of executing a UPDL flow
 */
export interface UPDLFlowResult {
    chatId: string
    sessionId?: string
    scene?: UPDLScene
    updlScene?: UPDLScene
    flowVariables?: Record<string, unknown>
    [key: string]: any
}
