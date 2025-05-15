// Universo Platformo | UPDL Types interfaces for AR.js and other exporters
export interface UPDLPosition {
    x: number
    y: number
    z: number
}

export interface UPDLScale {
    x: number
    y: number
    z: number
}

export interface UPDLRotation {
    x: number
    y: number
    z: number
}

export interface UPDLObject {
    id: string
    type: string
    name?: string
    position?: UPDLPosition
    rotation?: UPDLRotation
    scale?: UPDLScale
    color?: string
    material?: string
    width?: number
    height?: number
    depth?: number
    radius?: number
    [key: string]: any
}

export interface UPDLCamera {
    id: string
    type: string
    position?: UPDLPosition
    rotation?: UPDLRotation
    [key: string]: any
}

export interface UPDLLight {
    id: string
    type: string
    color?: string
    intensity?: number
    position?: UPDLPosition
    [key: string]: any
}

export interface UPDLSceneSettings {
    background?: string
    fog?: boolean
    fogColor?: string
    fogDensity?: number
    skybox?: boolean
    skyboxTexture?: string
    [key: string]: any
}

export interface UPDLSceneGraph {
    id?: string
    name?: string
    settings?: UPDLSceneSettings
    objects?: UPDLObject[]
    cameras?: UPDLCamera[]
    lights?: UPDLLight[]
    [key: string]: any
}

export interface ARJSPublicationRequest {
    chatflowId: string
    generationMode: 'streaming' | 'pregeneration'
    isPublic: boolean
    projectName: string
}

export interface ARJSPublicationResponse {
    publicationId: string
    publicUrl: string
    projectName: string
    createdAt: string
    chatflowId: string
    isPublic: boolean
    generationMode: 'streaming' | 'pregeneration'
}

export interface UPDLPublicationData {
    publicationId: string
    projectName: string
    updlScene: UPDLSceneGraph
    generationMode?: 'streaming' | 'pregeneration'
}
