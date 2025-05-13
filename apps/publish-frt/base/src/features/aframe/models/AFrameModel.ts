// Universo Platformo | A-Frame Model Core Components
// Defines classes and interfaces for representing A-Frame elements
// Moved from arjs/models to aframe/models to follow proper structure

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

    /**
     * Checks if the scene has a camera
     */
    hasCamera(): boolean

    /**
     * Checks if the scene has any lights
     */
    hasLights(): boolean

    /**
     * Checks if the scene has any objects
     */
    hasObjects(): boolean

    /**
     * Adds a camera to the scene
     */
    addCamera(params: {
        position?: { x: number; y: number; z: number }
        rotation?: { x: number; y: number; z: number }
        fov?: number
    }): void

    /**
     * Adds a light to the scene
     */
    addLight(params: { type: string; color?: string; intensity?: number; position?: { x: number; y: number; z: number } }): void

    /**
     * Adds an object to the scene
     */
    addObject(params: {
        type: string
        position?: { x: number; y: number; z: number }
        rotation?: { x: number; y: number; z: number }
        scale?: { x: number; y: number; z: number }
        color?: string
    }): void
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
    const scene: AFrameScene = {
        tag: AFrameTagType.SCENE,
        attributes: {
            embedded: true,
            arjs: 'sourceType: webcam; debugUIEnabled: false;'
        },
        children: [],

        // Implementation of the interface methods
        hasCamera(): boolean {
            return this.children.some(
                (child) =>
                    child.tag === AFrameTagType.CAMERA ||
                    (child.tag === AFrameTagType.MARKER && child.children.some((c) => c.tag === AFrameTagType.CAMERA))
            )
        },

        hasLights(): boolean {
            const lightTags = [
                AFrameTagType.LIGHT_AMBIENT,
                AFrameTagType.LIGHT_DIRECTIONAL,
                AFrameTagType.LIGHT_POINT,
                AFrameTagType.LIGHT_SPOT
            ]

            // Check for lights directly in the scene
            const hasDirectLights = this.children.some((child) => lightTags.includes(child.tag as AFrameTagType))

            // Check for lights in markers
            const hasMarkerLights = this.children.some(
                (child) => child.tag === AFrameTagType.MARKER && child.children.some((c) => lightTags.includes(c.tag as AFrameTagType))
            )

            return hasDirectLights || hasMarkerLights
        },

        hasObjects(): boolean {
            const objectTags = [AFrameTagType.BOX, AFrameTagType.SPHERE, AFrameTagType.CYLINDER, AFrameTagType.PLANE, AFrameTagType.ENTITY]

            // Check for objects directly in the scene
            const hasDirectObjects = this.children.some((child) => objectTags.includes(child.tag as AFrameTagType))

            // Check for objects in markers
            const hasMarkerObjects = this.children.some(
                (child) => child.tag === AFrameTagType.MARKER && child.children.some((c) => objectTags.includes(c.tag as AFrameTagType))
            )

            return hasDirectObjects || hasMarkerObjects
        },

        addCamera(params): void {
            // Find marker if it exists
            const marker = this.children.find((child) => child.tag === AFrameTagType.MARKER)

            // Create position string
            const position = params.position ? `${params.position.x} ${params.position.y} ${params.position.z}` : '0 1.5 3'

            // Create rotation string
            const rotation = params.rotation ? `${params.rotation.x} ${params.rotation.y} ${params.rotation.z}` : '0 0 0'

            const camera: AFrameCamera = {
                tag: AFrameTagType.CAMERA,
                attributes: {
                    position,
                    rotation,
                    'look-controls': 'enabled: false',
                    'wasd-controls': 'enabled: false'
                },
                children: []
            }

            // Add to marker if it exists, otherwise to scene
            if (marker) {
                marker.children.push(camera)
            } else {
                this.children.push(camera)
            }
        },

        addLight(params): void {
            // Determine light tag based on type
            let lightTag: AFrameTagType
            switch (params.type) {
                case 'ambient':
                    lightTag = AFrameTagType.LIGHT_AMBIENT
                    break
                case 'directional':
                    lightTag = AFrameTagType.LIGHT_DIRECTIONAL
                    break
                case 'point':
                    lightTag = AFrameTagType.LIGHT_POINT
                    break
                case 'spot':
                    lightTag = AFrameTagType.LIGHT_SPOT
                    break
                default:
                    lightTag = AFrameTagType.LIGHT_AMBIENT
            }

            // Create position string if provided
            const position = params.position ? `${params.position.x} ${params.position.y} ${params.position.z}` : undefined

            const light: AFrameLight = {
                tag: lightTag as
                    | AFrameTagType.LIGHT_AMBIENT
                    | AFrameTagType.LIGHT_DIRECTIONAL
                    | AFrameTagType.LIGHT_POINT
                    | AFrameTagType.LIGHT_SPOT,
                attributes: {
                    type: params.type as any,
                    color: params.color || '#FFFFFF',
                    intensity: params.intensity || 0.5,
                    ...(position ? { position } : {})
                },
                children: []
            }

            // Add to scene
            this.children.push(light)
        },

        addObject(params): void {
            // Find marker if it exists
            const marker = this.children.find((child) => child.tag === AFrameTagType.MARKER)

            // Determine object tag
            let objectTag: AFrameTagType
            switch (params.type) {
                case 'box':
                    objectTag = AFrameTagType.BOX
                    break
                case 'sphere':
                    objectTag = AFrameTagType.SPHERE
                    break
                case 'cylinder':
                    objectTag = AFrameTagType.CYLINDER
                    break
                case 'plane':
                    objectTag = AFrameTagType.PLANE
                    break
                default:
                    objectTag = AFrameTagType.ENTITY
            }

            // Create position string
            const position = params.position ? `${params.position.x} ${params.position.y} ${params.position.z}` : '0 0.5 0'

            // Create rotation string if provided
            const rotation = params.rotation ? `${params.rotation.x} ${params.rotation.y} ${params.rotation.z}` : undefined

            // Create scale string if provided
            const scale = params.scale ? `${params.scale.x} ${params.scale.y} ${params.scale.z}` : undefined

            // Create object
            const object: AFramePrimitive = {
                tag: objectTag as AFrameTagType.BOX | AFrameTagType.SPHERE | AFrameTagType.CYLINDER | AFrameTagType.PLANE,
                attributes: {
                    position,
                    ...(rotation ? { rotation } : {}),
                    ...(scale ? { scale } : {}),
                    ...(params.color ? { color: params.color } : { color: '#FF0000' })
                },
                children: []
            }

            // Add to marker if it exists, otherwise to scene
            if (marker) {
                marker.children.push(object)
            } else {
                this.children.push(object)
            }
        }
    }

    return scene
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
