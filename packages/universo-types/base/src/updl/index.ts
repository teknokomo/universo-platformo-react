// Universo Platformo | UPDL Types
// Centralized UPDL type definitions for all packages

/**
 * 3D position coordinates
 */
export interface IUPDLPosition {
    x: number
    y: number
    z: number
}

/**
 * 3D rotation in Euler angles
 */
export interface IUPDLRotation {
    x: number
    y: number
    z: number
}

/**
 * RGBA color definition
 */
export interface IUPDLColor {
    r: number
    g: number
    b: number
    a?: number
}

/**
 * Base object properties common to all UPDL objects
 */
export interface IUPDLBaseObject {
    id: string
    name: string
    type: string
    position: IUPDLPosition
    rotation?: IUPDLRotation
    scale?: IUPDLPosition
}

/**
 * UPDL Object (3D models, primitives, etc.)
 */
export interface IUPDLObject extends IUPDLBaseObject {
    type: 'box' | 'sphere' | 'plane' | 'cylinder' | 'model' | string
    geometry?: {
        width?: number
        height?: number
        depth?: number
        radius?: number
        segments?: number
    }
    material?: {
        color?: IUPDLColor
        texture?: string
        opacity?: number
        metalness?: number
        roughness?: number
    }
    model?: {
        src: string
        format?: 'gltf' | 'obj' | 'fbx' | string
    }
    // Legacy support for template compatibility
    color?: string
    primitive?: string
    visible?: boolean
}

/**
 * UPDL Component attached to an entity
 */
export interface IUPDLComponent {
    id: string
    componentType: string

    // Common visual fields (Render)
    primitive?: string
    color?: string

    // Generic script/props
    scriptName?: string
    props?: Record<string, any>

    // Inventory
    maxCapacity?: number
    currentLoad?: number

    // Weapon
    fireRate?: number
    damage?: number

    // Trading
    pricePerTon?: number
    interactionRange?: number

    // Mineable
    resourceType?: string
    maxYield?: number

    // Portal
    targetWorld?: string
    cooldownTime?: number
}

/**
 * UPDL Entity representing a scene object with transform
 */
export interface IUPDLEntity {
    id: string
    name?: string
    entityType?: string
    transform?: {
        position?: IUPDLPosition
        rotation?: IUPDLRotation
        scale?: IUPDLPosition
    }
    tags?: string[]
    components?: IUPDLComponent[]
    events?: IUPDLEvent[]
}

/**
 * UPDL Event triggering actions
 */
export interface IUPDLEvent {
    id: string
    eventType: string
    source?: string
    actions?: IUPDLAction[]
}

/**
 * UPDL Action executed by events
 */
export interface IUPDLAction {
    id: string
    actionType: string
    target?: string
    params?: Record<string, any>
}

/**
 * UPDL Camera
 */
export interface IUPDLCamera extends IUPDLBaseObject {
    type: 'camera'
    fov?: number
    near?: number
    far?: number
}

/**
 * UPDL Light
 */
export interface IUPDLLight extends IUPDLBaseObject {
    type: 'ambient' | 'directional' | 'point' | 'spot'
    color?: IUPDLColor
    intensity?: number
    distance?: number
    decay?: number
}

/**
 * UPDL Data for quiz and interaction logic
 */
export interface IUPDLData {
    id: string
    name: string
    dataType: 'Question' | 'Answer' | 'Intro' | 'Transition' | string
    content: string
    isCorrect: boolean
    nextSpace?: string
    objects?: string[]
    // Universo Platformo | Points system properties
    enablePoints?: boolean
    pointsValue?: number
    metadata?: {
        difficulty?: number
        tags?: string[]
        [key: string]: any
    }
}

/**
 * UPDL Space containing all space objects
 */
export interface IUPDLSpace {
    id: string
    name: string
    // Universo Platformo | Classification of space
    spaceType?: string
    // Universo Platformo | Root node indicator
    isRootNode?: boolean
    description?: string
    objects: IUPDLObject[]
    cameras?: IUPDLCamera[]
    lights?: IUPDLLight[]
    datas?: IUPDLData[]
    entities?: IUPDLEntity[]
    components?: IUPDLComponent[]
    events?: IUPDLEvent[]
    actions?: IUPDLAction[]
    universo?: any[]
    // Universo Platformo | Points system display option
    showPoints?: boolean
    // Universo Platformo | Lead data collection settings
    leadCollection?: {
        collectName?: boolean
        collectEmail?: boolean
        collectPhone?: boolean
        // Universo Platformo | Captcha settings for lead forms
        captchaEnabled?: boolean
        captchaSiteKey?: string
    }
    settings?: {
        background?: IUPDLColor | string
        fog?: {
            color: IUPDLColor
            near: number
            far: number
        }
        physics?: {
            gravity: number
            enabled: boolean
        }
    }
}

/**
 * Universo Platformo | Scene representation in space chain
 */
export interface IUPDLScene {
    spaceId: string
    spaceData: any
    dataNodes: IUPDLData[]
    objectNodes: IUPDLObject[]
    nextSceneId?: string | undefined
    isLast: boolean
    order: number
    isResultsScene?: boolean
}

/**
 * Universo Platformo | Multiple scenes for quiz functionality
 */
export interface IUPDLMultiScene {
    scenes: IUPDLScene[]
    currentSceneIndex: number
    totalScenes: number
    isCompleted: boolean
}

/**
 * React Flow node interface for UPDL processing
 */
export interface IReactFlowNode {
    id: string
    data: any
    type?: string
    position?: { x: number; y: number }
}

/**
 * React Flow edge interface for UPDL processing
 */
export interface IReactFlowEdge {
    id: string
    source: string
    target: string
    type?: string
}

/**
 * Library source configuration for AR.js
 */
export interface ILibrarySource {
    version: string
    source: 'official' | 'kiberplano'
}

/**
 * Library configuration for AR.js publication
 */
export interface ILibraryConfig {
    arjs: ILibrarySource
    aframe: ILibrarySource
}

/**
 * Result of UPDL flow processing
 */
export interface IUPDLFlowResult {
    updlSpace?: IUPDLSpace
    multiScene?: IUPDLMultiScene
    metadata?: {
        nodeCount: number
        processingTime: number
        flowId: string
    }
    // Additional fields for flow execution
    chatId?: string
    status?: string
    canvasId?: string
    sessionId?: string
    data?: any
    canvas?: any
    message?: string | null
    success?: boolean
    error?: string
    // Universo Platformo | Library configuration for AR.js
    libraryConfig?: ILibraryConfig
}
