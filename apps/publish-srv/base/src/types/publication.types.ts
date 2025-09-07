// Universo Platformo | Independent Publication Types
// REFACTORED: Moved from packages/server/src/Interface.UPDL.ts
// This module contains only types needed for publication functionality

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
 * UPDL Component attached to an entity
 */
export interface IUPDLComponent {
    id: string
    componentType: string
    primitive?: string
    color?: string
    scriptName?: string
    props?: Record<string, any>
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
 * Flow data interface for template system
 * Used to pass processed flow data to template builders
 */
export interface IFlowData {
    flowData?: string | IUPDLFlowResult
    updlSpace?: IUPDLSpace
    multiScene?: IUPDLMultiScene
    metadata?: {
        nodeCount?: number
        processingTime?: number
        flowId?: string
        templateId?: string
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
    chatflowid?: string
    sessionId?: string
    data?: any
    chatflow?: any
    message?: string | null
    success?: boolean
    error?: string
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

/**
 * AR.js publication request
 */
export interface IARJSPublishRequest {
    canvasId: string // Updated: use canvasId instead of chatflowId
    chatflowId?: string // Deprecated: for backward compatibility
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
    canvasId: string // Updated: use canvasId instead of chatflowId
    chatflowId?: string // Deprecated: for backward compatibility
    projectName: string
    generationMode: string
    isPublic: boolean
    createdAt: string
}

/**
 * Publication data result for public access
 * Contains processed UPDL data and metadata
 */
export interface IPublicationDataResult {
    success: boolean
    publicationId: string
    updlFlowResult: IUPDLFlowResult
    metadata?: {
        projectName?: string
        createdAt?: string
        [key: string]: any
    }
}

// ==============================================
// FLOW DATA TYPES
// ==============================================

/**
 * Render configuration for AR.js view
 */
export interface RenderConfig {
    arDisplayType?: 'wallpaper' | 'marker'
    wallpaperType?: 'standard'
    markerType?: string
    markerValue?: string
}

/**
 * Raw flow data extracted from database for processing
 * Used internally by FlowDataService
 */
export interface RawFlowData {
    flowData: string
    libraryConfig: any
    renderConfig?: RenderConfig
    playcanvasConfig?: {
        gameMode?: 'singleplayer' | 'multiplayer'
        colyseusSettings?: {
            serverHost?: string
            serverPort?: number
            roomName?: string
        }
    }
    canvas: { // Updated: use canvas instead of chatflow
        id: string
        name: string
    }
    chatflow?: { // Deprecated: for backward compatibility
        id: string
        name: string
    }
}

/**
 * Minimal Canvas interface for database operations
 * Contains only fields needed by publish-srv
 */
export interface CanvasMinimal {
    id: string
    name: string
    flowData: string
    chatbotConfig?: string
}

/**
 * @deprecated Use CanvasMinimal instead
 * Minimal ChatFlow interface for database operations - kept for backward compatibility
 */
export interface ChatFlowMinimal {
    id: string
    name: string
    flowData: string
    chatbotConfig?: string
}
