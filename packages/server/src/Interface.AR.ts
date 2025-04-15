// Universo Platformo | AR.js Interfaces

/**
 * Universo Platformo | Interfaces for working with AR.js
 */

// Universo Platformo | Base types for working with coordinates and rotation
export interface IARPosition {
    x: number
    y: number
    z: number
}

export interface IARRotation {
    x: number
    y: number
    z: number
}

// Universo Platformo | Base AR object
export interface IARBaseObject {
    component: string
    position?: IARPosition
    rotation?: IARRotation
    scale?: IARPosition
    id?: string
    type: string
}

// Universo Platformo | Primitives and objects for AR
export interface IARCube extends IARBaseObject {
    component: 'cube'
    type: 'cube'
    width: number
    height: number
    depth: number
    color: string
    position: IARPosition
    rotation: IARRotation
    opacity?: number
}

export interface IARText extends IARBaseObject {
    component: 'text'
    type: 'text'
    value: string
    color: string
    width: number
    align: 'left' | 'center' | 'right'
}

export interface IARModel extends IARBaseObject {
    component: 'model'
    type: 'model'
    url: string
    scale: IARPosition
}

export type ARObject = IARCube | IARText | IARModel

// Universo Platformo | Marker for tracking in AR
export interface IARMarker {
    component: 'marker'
    type: 'pattern' | 'barcode' | 'hiro' | 'kanji'
    patternUrl?: string
    barcodeValue?: number
    preset?: string
    children: Array<ARObject>
}

// Universo Platformo | AR Scene
export interface IARScene {
    component: 'arscene'
    detectionMode: string
    matrixCodeType: string
    debugMode: boolean
    children: Array<ARObject | IARMarker>
}
