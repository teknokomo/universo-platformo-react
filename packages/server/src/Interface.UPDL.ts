// Universo Platformo | UPDL Space and Object definitions
// Simplified UPDL interfaces for backend/frontend integration
// For complete UPDL ecosystem definitions, see apps/updl/base/src/interfaces/UPDLInterfaces.ts

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
    dataType: 'Question' | 'Answer' | 'Intro' | 'Transition'
    content: string
    isCorrect?: boolean
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
    description?: string
    objects: IUPDLObject[]
    cameras?: IUPDLCamera[]
    lights?: IUPDLLight[]
    datas?: IUPDLData[]
    // Universo Platformo | Points system display option
    showPoints?: boolean
    // Universo Platformo | Lead data collection settings
    leadCollection?: {
        collectName?: boolean
        collectEmail?: boolean
        collectPhone?: boolean
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
 * Result of UPDL flow processing
 */
export interface IUPDLFlowResult {
    updlSpace?: IUPDLSpace
    multiScene?: IUPDLMultiScene // Universo Platformo | Multi-scene support
    metadata?: {
        nodeCount: number
        processingTime: number
        flowId: string
    }
    // Additional fields for flow execution
    chatId?: string
    status?: string
    chatflowid?: string
    sessionId?: string
    data?: any
    chatflow?: any
    message?: string | null
    success?: boolean // For API responses
    error?: string // For error responses
    // Universo Platformo | Library configuration for AR.js
    libraryConfig?: ILibraryConfig
}

// ==============================================
// PUBLICATION TYPES
// ==============================================

/**
 * Publication request
 */
export interface IPublishRequest {
    projectId: string
    platform: string
    options?: {
        isPublic: boolean
        customUrl?: string
        [key: string]: any
    }
}

/**
 * Publication response
 */
export interface IPublishResponse {
    id: string
    projectId: string
    platform: string
    url: string
    createdAt: string
    updatedAt: string
    status: 'published' | 'failed' | 'in_progress'
    error?: string
}

// ==============================================
// AR.JS SPECIFIC TYPES
// ==============================================

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
 * Default library configuration
 */
export const DEFAULT_LIBRARY_CONFIG: ILibraryConfig = {
    arjs: { version: '3.4.7', source: 'official' },
    aframe: { version: '1.7.1', source: 'official' }
}

/**
 * Available library versions
 */
export const AVAILABLE_VERSIONS = {
    arjs: ['3.4.7'],
    aframe: ['1.7.1']
}

/**
 * Available library sources with their display names
 */
export const LIBRARY_SOURCES = {
    official: 'Официальный сервер',
    kiberplano: 'Сервер Kiberplano'
}

/**
 * AR.js publication request
 */
export interface IARJSPublishRequest {
    chatflowId: string
    generationMode?: string
    isPublic?: boolean
    projectName?: string
    flowData?: {
        flowId: string
        projectTitle: string
        markerType: string
        markerValue: string
        libraryConfig?: ILibraryConfig
        [key: string]: any
    }
}

/**
 * AR.js publication response
 */
export interface IARJSPublishResponse {
    success: boolean
    publicationId: string
    chatflowId: string
    projectName: string
    generationMode: string
    isPublic: boolean
    createdAt: string
}
