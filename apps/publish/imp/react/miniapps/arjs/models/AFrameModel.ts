// Universo Platformo | A-Frame Model for AR.js Exporter
// Defines classes and interfaces for representing A-Frame elements

/**
 * Defines the type of A-Frame entity
 */
export enum AFrameTagType {
    SCENE = 'a-scene',
    MARKER = 'a-marker',
    ENTITY = 'a-entity',
    BOX = 'a-box',
    SPHERE = 'a-sphere',
    CYLINDER = 'a-cylinder',
    PLANE = 'a-plane',
    SKY = 'a-sky',
    CAMERA = 'a-camera',
    ASSET_ITEM = 'a-asset-item',
    ASSETS = 'a-assets',
    LIGHT_AMBIENT = 'a-light',
    LIGHT_DIRECTIONAL = 'a-light',
    LIGHT_POINT = 'a-light',
    LIGHT_SPOT = 'a-light'
}

/**
 * Base interface for all A-Frame entities
 */
export interface AFrameEntity {
    /** The HTML tag type */
    tag: AFrameTagType | string

    /** Attributes for the entity */
    attributes: Record<string, string | number | boolean>

    /** Child entities */
    children: AFrameEntity[]
}

/**
 * A-Frame scene that contains all other entities
 */
export interface AFrameScene extends AFrameEntity {
    tag: AFrameTagType.SCENE
    attributes: {
        embedded?: boolean
        arjs?: string
        vr?: boolean
        'vr-mode-ui'?: string
        [key: string]: any
    }
}

/**
 * A-Frame marker for AR tracking
 */
export interface AFrameMarker extends AFrameEntity {
    tag: AFrameTagType.MARKER
    attributes: {
        preset?: string
        type?: string
        url?: string
        value?: string
        [key: string]: any
    }
}

/**
 * A-Frame camera entity
 */
export interface AFrameCamera extends AFrameEntity {
    tag: AFrameTagType.CAMERA
    attributes: {
        position?: string
        rotation?: string
        'look-controls'?: string
        'wasd-controls'?: string
        [key: string]: any
    }
}

/**
 * A-Frame light entity
 */
export interface AFrameLight extends AFrameEntity {
    tag: AFrameTagType.LIGHT_AMBIENT | AFrameTagType.LIGHT_DIRECTIONAL | AFrameTagType.LIGHT_POINT | AFrameTagType.LIGHT_SPOT
    attributes: {
        type: 'ambient' | 'directional' | 'point' | 'spot'
        color?: string
        intensity?: number
        position?: string
        rotation?: string
        target?: string
        [key: string]: any
    }
}

/**
 * A-Frame primitive objects (box, sphere, etc.)
 */
export interface AFramePrimitive extends AFrameEntity {
    tag: AFrameTagType.BOX | AFrameTagType.SPHERE | AFrameTagType.CYLINDER | AFrameTagType.PLANE
    attributes: {
        position?: string
        rotation?: string
        scale?: string
        color?: string
        material?: string
        animation?: string
        [key: string]: any
    }
}

/**
 * A-Frame assets container
 */
export interface AFrameAssets extends AFrameEntity {
    tag: AFrameTagType.ASSETS
}

/**
 * A-Frame asset item
 */
export interface AFrameAssetItem extends AFrameEntity {
    tag: AFrameTagType.ASSET_ITEM
    attributes: {
        id: string
        src: string
        [key: string]: any
    }
}

/**
 * Creates a default A-Frame scene with basic settings
 * @returns A new A-Frame scene
 */
export function createDefaultScene(): AFrameScene {
    return {
        tag: AFrameTagType.SCENE,
        attributes: {
            embedded: true,
            arjs: 'sourceType: webcam; debugUIEnabled: false;'
        },
        children: []
    }
}

/**
 * Creates a Hiro marker for AR tracking
 * @returns A new A-Frame marker
 */
export function createHiroMarker(): AFrameMarker {
    return {
        tag: AFrameTagType.MARKER,
        attributes: {
            preset: 'hiro'
        },
        children: []
    }
}

/**
 * Creates a default camera entity
 * @returns A new A-Frame camera
 */
export function createDefaultCamera(): AFrameCamera {
    return {
        tag: AFrameTagType.CAMERA,
        attributes: {},
        children: []
    }
}

/**
 * Creates an ambient light with default settings
 * @param color - Hex color code
 * @param intensity - Light intensity (0-1)
 * @returns A new A-Frame ambient light
 */
export function createAmbientLight(color: string = '#FFFFFF', intensity: number = 0.5): AFrameLight {
    return {
        tag: AFrameTagType.LIGHT_AMBIENT,
        attributes: {
            type: 'ambient',
            color,
            intensity
        },
        children: []
    }
}

/**
 * Creates a directional light with default settings
 * @param color - Hex color code
 * @param intensity - Light intensity (0-1)
 * @param position - Position string (x y z)
 * @returns A new A-Frame directional light
 */
export function createDirectionalLight(color: string = '#FFFFFF', intensity: number = 0.7, position: string = '1 1 1'): AFrameLight {
    return {
        tag: AFrameTagType.LIGHT_DIRECTIONAL,
        attributes: {
            type: 'directional',
            color,
            intensity,
            position
        },
        children: []
    }
}

/**
 * Creates a box primitive
 * @param position - Position string (x y z)
 * @param color - Hex color code
 * @returns A new A-Frame box
 */
export function createBox(position: string = '0 0.5 0', color: string = '#FF0000'): AFramePrimitive {
    return {
        tag: AFrameTagType.BOX,
        attributes: {
            position,
            material: `color: ${color}`
        },
        children: []
    }
}
