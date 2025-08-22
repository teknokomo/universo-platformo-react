// Common types and interfaces for template system

export interface BuildOptions {
    gameMode?: 'singleplayer' | 'multiplayer'
    multiplayer?: {
        serverHost?: string
        serverPort?: number
        roomName?: string
    }
    // Additional build options can be added here
    [key: string]: any
}

export interface ITemplateBuilder {
    build(flowData: IFlowData, options: BuildOptions): Promise<string>
    canHandle(flowData: IFlowData): boolean
    getTemplateInfo(): TemplateConfig
}

// Import UPDL types from publish-srv
export interface IFlowData {
    flowData?: string | any
    updlSpace?: IUPDLSpace
    multiScene?: IUPDLMultiScene
    metadata?: {
        nodeCount?: number
        processingTime?: number
        flowId?: string
        templateId?: string
    }
}

export interface IUPDLSpace {
    id: string
    name: string
    spaceType?: string
    isRootNode?: boolean
    description?: string
    objects: any[]
    cameras?: any[]
    lights?: any[]
    datas?: any[]
    entities?: any[]
    components?: any[]
    events?: any[]
    actions?: any[]
    universo?: any[]
    showPoints?: boolean
    leadCollection?: {
        collectName?: boolean
        collectEmail?: boolean
        collectPhone?: boolean
    }
    settings?: any
}

export interface IUPDLMultiScene {
    scenes: IUPDLScene[]
    currentSceneIndex: number
    totalScenes: number
    isCompleted: boolean
}

export interface IUPDLScene {
    spaceId: string
    spaceData: any
    dataNodes: any[]
    objectNodes: any[]
    nextSceneId?: string | undefined
    isLast: boolean
    order: number
    isResultsScene?: boolean
}

export interface ProcessedGameData {
    entities: ComponentSnapshotMap[]
    spaces: SpaceData[]
    components: ComponentData[]
    actions: ActionData[]
    events: EventData[]
    // Optional lights processed for SP scene (feature-flagged usage)
    lights?: Array<{ id: string; script: string; data: any }>
}

export interface MultiplayerGameData extends ProcessedGameData {
    networkEntities: NetworkEntity[]
    playerSpawnPoint: Transform
    authScreenData: AuthScreenData
    serverConfig: ColyseusServerConfig
}

export interface NetworkEntity {
    id: string
    type: 'ship' | 'station' | 'asteroid' | 'gate'
    transform: Transform
    visual: Visual
    networked: boolean
    // Additional fields for server processing
    components?: any[]
    entityType?: string
    position?: { x: number; y: number; z: number }
    scale?: { x: number; y: number; z: number }
}

export interface Transform {
    position: [number, number, number]
    rotation: [number, number, number]
    scale: [number, number, number]
}

export interface Visual {
    model?: string
    texture?: string
    color?: string
}

export interface AuthScreenData {
    collectName: boolean
    title: string
    description: string
    placeholder: string
}

export interface ColyseusServerConfig {
    host: string
    port: number
    roomName: string
    protocol: 'ws' | 'wss'
}

export interface TemplateConfig {
    id: string
    name: string
    description: string
    version: string
    technology: string
    i18nNamespace?: string
    supportedTechnologies?: string[]
    supportedModes?: string[]
    defaultMode?: string
    supportedNodes: string[]
    features: string[]
    defaults: {
        [key: string]: any
    }
}

// Placeholder types - to be refined based on actual UPDL structure
export interface ComponentSnapshotMap {
    [key: string]: any
}

export interface SpaceData {
    [key: string]: any
}

export interface ComponentData {
    [key: string]: any
}

export interface ActionData {
    [key: string]: any
}

export interface EventData {
    [key: string]: any
}
