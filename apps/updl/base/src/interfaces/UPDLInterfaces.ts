// Universo Platformo | UPDL core interfaces
// Defines the structure of UPDL flows and exporters

/**
 * Base interface for UPDL Flow
 */
export interface UPDLFlow {
    /** Unique identifier for the flow */
    id: string

    /** Name of the flow */
    name: string

    /** Optional description */
    description?: string

    /** Version number */
    version: string

    /** Graph data structure containing nodes and edges */
    graph: UPDLGraph

    /** Backward compatibility: direct access to nodes */
    nodes?: UPDLNode[]

    /** Backward compatibility: direct access to connections */
    connections?: UPDLConnection[]

    /** Metadata for the flow */
    metadata: Record<string, any>

    /** Creation timestamp */
    createdAt: string

    /** Last modified timestamp */
    updatedAt: string

    /** Author information */
    author?: string
}

/**
 * UPDL Graph structure
 */
export interface UPDLGraph {
    /** Nodes in the graph */
    nodes: UPDLNode[]

    /** Edges connecting nodes */
    edges: UPDLEdge[]
}

/**
 * UPDL Edge interface for connections between nodes
 */
export interface UPDLEdge {
    id: string
    source: string // Source node ID
    sourceHandle?: string // Optional source port ID
    target: string // Target node ID
    targetHandle?: string // Optional target port ID
    data?: Record<string, any> // Optional edge data
}

/**
 * UPDL Interfaces
 * Type definitions for UPDL nodes and components
 */

/**
 * Vector3 interface for 3D positions, rotations, scales
 */
export interface Vector3 {
    x: number
    y: number
    z: number
}

/**
 * Color interface for RGB values
 */
export interface Color {
    r: number
    g: number
    b: number
    a?: number // Optional alpha
}

/**
 * Base interface for all UPDL nodes
 */
export interface UPDLNode {
    id: string
    type: string
    name?: string
    description?: string
    metadata?: Record<string, any>
}

/**
 * Scene node interface
 */
export interface UPDLScene extends UPDLNode {
    type: 'scene'
    background?: Color
    fog?: {
        enabled: boolean
        color: Color
        near: number
        far: number
    }
    environment?: string // Environment map URL
    physics?: {
        enabled: boolean
        gravity: Vector3
        debug?: boolean
    }
    renderer?: {
        shadowsEnabled: boolean
        toneMapping?: string
        exposure?: number
    }
}

/**
 * Object node base interface
 */
export interface UPDLObject extends UPDLNode {
    type: 'box' | 'sphere' | 'cylinder' | 'plane' | 'model'
    position: Vector3
    rotation: Vector3
    scale: Vector3
    color?: Color
    material?: {
        type: 'basic' | 'standard' | 'physical' | 'toon'
        color?: Color
        emissive?: Color
        roughness?: number
        metalness?: number
        wireframe?: boolean
        transparent?: boolean
        opacity?: number
        side?: 'front' | 'back' | 'double'
        map?: string // Texture URL
        normalMap?: string // Normal map URL
    }
    castShadow?: boolean
    receiveShadow?: boolean
    visible?: boolean
    physics?: {
        enabled: boolean
        mass: number
        static: boolean
        collider: 'box' | 'sphere' | 'cylinder' | 'mesh'
    }
}

/**
 * Box object node interface
 */
export interface UPDLBoxObject extends UPDLObject {
    type: 'box'
    width?: number
    height?: number
    depth?: number
}

/**
 * Sphere object node interface
 */
export interface UPDLSphereObject extends UPDLObject {
    type: 'sphere'
    radius: number
    segments?: number
}

/**
 * Cylinder object node interface
 */
export interface UPDLCylinderObject extends UPDLObject {
    type: 'cylinder'
    radius: number
    height: number
    segments?: number
}

/**
 * Plane object node interface
 */
export interface UPDLPlaneObject extends UPDLObject {
    type: 'plane'
    width: number
    height: number
}

/**
 * 3D Model object node interface
 */
export interface UPDLModelObject extends UPDLObject {
    type: 'model'
    src: string // URL or path to model file
    format?: 'gltf' | 'glb' | 'obj' | 'fbx'
    animations?: {
        enabled: boolean
        autoplay?: string
        loop?: boolean
    }
}

/**
 * Camera node base interface
 */
export interface UPDLCamera extends UPDLNode {
    type: 'perspective' | 'orthographic' | 'ar'
    position: Vector3
    rotation: Vector3
    target?: Vector3
    fov?: number // Field of view (for perspective camera)
    near?: number
    far?: number
    zoom?: number
    active?: boolean
}

/**
 * Perspective camera node interface
 */
export interface UPDLPerspectiveCamera extends UPDLCamera {
    type: 'perspective'
    fov: number
}

/**
 * Orthographic camera node interface
 */
export interface UPDLOrthographicCamera extends UPDLCamera {
    type: 'orthographic'
    left?: number
    right?: number
    top?: number
    bottom?: number
}

/**
 * AR camera node interface
 */
export interface UPDLARCamera extends UPDLCamera {
    type: 'ar'
    markerType?: 'hiro' | 'kanji' | 'pattern' | 'barcode'
    markerUrl?: string // For pattern marker
    markerValue?: number // For barcode marker
}

/**
 * Light node base interface
 */
export interface UPDLLight extends UPDLNode {
    type: 'ambient' | 'directional' | 'point' | 'spot' | 'hemisphere'
    color: Color
    intensity?: number
    castShadow?: boolean
}

/**
 * Ambient light node interface
 */
export interface UPDLAmbientLight extends UPDLLight {
    type: 'ambient'
}

/**
 * Directional light node interface
 */
export interface UPDLDirectionalLight extends UPDLLight {
    type: 'directional'
    position: Vector3
    target?: Vector3
    shadowMapSize?: {
        width: number
        height: number
    }
}

/**
 * Point light node interface
 */
export interface UPDLPointLight extends UPDLLight {
    type: 'point'
    position: Vector3
    distance?: number
    decay?: number
}

/**
 * Spot light node interface
 */
export interface UPDLSpotLight extends UPDLLight {
    type: 'spot'
    position: Vector3
    target?: Vector3
    angle?: number
    penumbra?: number
    distance?: number
    decay?: number
}

/**
 * Hemisphere light node interface
 */
export interface UPDLHemisphereLight extends UPDLLight {
    type: 'hemisphere'
    skyColor: Color
    groundColor: Color
}

/**
 * Interaction node interface for handling user interaction
 */
export interface UPDLInteraction extends UPDLNode {
    type: 'click' | 'hover' | 'drag'
    target: string // ID of target object
    action: {
        type: 'animate' | 'sound' | 'url' | 'custom'
        params: Record<string, any>
    }
}

/**
 * Complete UPDL Scene describing a full 3D scene
 */
export interface UPDLSceneGraph {
    scene: UPDLScene
    objects: UPDLObject[]
    cameras: UPDLCamera[]
    lights: UPDLLight[]
    interactions?: UPDLInteraction[]
}

/**
 * UPDLNodeTypes - Enum of all possible UPDL node types
 */
export enum UPDLNodeTypes {
    // Scene nodes
    SCENE = 'SCENE',

    // Object nodes
    BOX = 'BOX',
    SPHERE = 'SPHERE',
    CYLINDER = 'CYLINDER',
    PLANE = 'PLANE',
    MODEL = 'MODEL',

    // Camera nodes
    PERSPECTIVE_CAMERA = 'PERSPECTIVE_CAMERA',
    ORTHOGRAPHIC_CAMERA = 'ORTHOGRAPHIC_CAMERA',
    AR_CAMERA = 'AR_CAMERA',

    // Light nodes
    AMBIENT_LIGHT = 'AMBIENT_LIGHT',
    DIRECTIONAL_LIGHT = 'DIRECTIONAL_LIGHT',
    POINT_LIGHT = 'POINT_LIGHT',
    SPOT_LIGHT = 'SPOT_LIGHT',
    HEMISPHERE_LIGHT = 'HEMISPHERE_LIGHT',

    // Interaction nodes
    CLICK_INTERACTION = 'CLICK_INTERACTION',
    HOVER_INTERACTION = 'HOVER_INTERACTION',
    DRAG_INTERACTION = 'DRAG_INTERACTION'
}

/**
 * Port definition for node connections (backwards compatibility)
 */
export interface UPDLNodePort {
    id: string
    name: string
    type: string
    label?: string
}

/**
 * Allowed port types for UPDL
 */
export enum UPDLPortType {
    SCENE = 'scene',
    OBJECT = 'object',
    CAMERA = 'camera',
    LIGHT = 'light',
    MATERIAL = 'material',
    TRIGGER = 'trigger',
    ACTION = 'action',
    ANIMATION = 'animation',
    CONTROLLER = 'controller'
}

/**
 * Connection between nodes (backwards compatibility)
 */
export interface UPDLConnection {
    id: string
    sourceNodeId: string
    sourcePortId: string
    targetNodeId: string
    targetPortId: string
}

/**
 * Options for exporters
 */
export interface ExporterOptions {
    outputFormat?: string
    optimizationLevel?: 'none' | 'basic' | 'aggressive'
    embedAssets?: boolean
    includeDefaultScene?: boolean
    markerType?: string // For AR.js
    targetPlatform?: string // For platform-specific optimizations
    customOptions?: Record<string, any> // For exporter-specific options
}

/**
 * Asset information for exported content
 */
export interface Asset {
    id: string
    type: 'model' | 'texture' | 'audio' | 'video' | 'script' | 'other'
    filename: string
    content: string | Buffer // Content or Buffer for binary data
    mimeType: string
    url?: string // Optional URL if the asset is hosted externally
}
