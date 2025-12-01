import {
    IAction,
    ICommonObject,
    IFileUpload,
    INode,
    INodeData as INodeDataFromComponent,
    INodeParams,
    IServerSideEventStreamer
} from 'flowise-components'
import { DataSource } from 'typeorm'
import { CachePool } from './CachePool'
import { Telemetry } from './utils/telemetry'
import type { CanvasFlowResult } from '@universo/spaces-srv'

// Re-export Assistant types from the extracted package
export type { IAssistant, AssistantType } from '@flowise/assistants-srv'

// Re-export ChatMessage interfaces from the extracted package
export type {
    IChatMessage,
    IChatMessageFeedback,
    GetChatMessageParams
} from '@flowise/chatmessage-srv'

// Message type - compatible with @flowise/chatmessage-srv
export type MessageType = 'apiMessage' | 'userMessage'

// Chat type enum - compatible with @flowise/chatmessage-srv
export enum ChatType {
    INTERNAL = 'INTERNAL',
    EXTERNAL = 'EXTERNAL'
}

// Chat message rating type - compatible with @flowise/chatmessage-srv
export enum ChatMessageRatingType {
    THUMBS_UP = 'THUMBS_UP',
    THUMBS_DOWN = 'THUMBS_DOWN'
}

export enum MODE {
    QUEUE = 'queue',
    MAIN = 'main'
}

/**
 * Databases
 */
export type CanvasId = string

export interface ITool {
    id: string
    name: string
    description: string
    color: string
    iconSrc?: string
    schema?: string
    func?: string
    updatedDate: Date
    createdDate: Date
}

// IAssistant moved to @flowise/assistants-srv (re-exported above)

export interface ICredential {
    id: string
    name: string
    credentialName: string
    encryptedData: string
    updatedDate: Date
    createdDate: Date
}

export interface IVariable {
    id: string
    name: string
    value: string
    type: string
    updatedDate: Date
    createdDate: Date
}

// ILead re-exported from @flowise/leads-srv for backward compatibility
export type { ILead, CreateLeadBody } from '@flowise/leads-srv'

export interface IUpsertHistory {
    id: string
    canvasId: string
    result: string
    flowData: string
    date: Date
}

export interface IComponentNodes {
    [key: string]: INode
}

export interface IComponentCredentials {
    [key: string]: INode
}

export interface IVariableDict {
    [key: string]: string
}

export interface INodeDependencies {
    [key: string]: number
}

export interface INodeDirectedGraph {
    [key: string]: string[]
}

export interface INodeData extends INodeDataFromComponent {
    inputAnchors: INodeParams[]
    inputParams: INodeParams[]
    outputAnchors: INodeParams[]
}

export interface IReactFlowNode {
    id: string
    position: {
        x: number
        y: number
    }
    type: string
    data: INodeData
    positionAbsolute: {
        x: number
        y: number
    }
    z: number
    handleBounds: {
        source: any
        target: any
    }
    width: number
    height: number
    selected: boolean
    dragging: boolean
}

export interface IReactFlowEdge {
    source: string
    sourceHandle: string
    target: string
    targetHandle: string
    type: string
    id: string
    data: {
        label: string
    }
}

export interface IReactFlowObject {
    nodes: IReactFlowNode[]
    edges: IReactFlowEdge[]
    viewport: {
        x: number
        y: number
        zoom: number
    }
}

export interface IExploredNode {
    [key: string]: {
        remainingLoop: number
        lastSeenDepth: number
    }
}

export interface INodeQueue {
    nodeId: string
    depth: number
}

export interface IDepthQueue {
    [key: string]: number
}

export interface IMessage {
    message: string
    type: MessageType
    role?: MessageType
    content?: string
}

export interface IncomingInput {
    question: string
    overrideConfig?: ICommonObject
    chatId?: string
    stopNodeId?: string
    uploads?: IFileUpload[]
    leadEmail?: string
    history?: IMessage[]
    action?: IAction
    streaming?: boolean
}

export interface IActiveChatflows {
    [key: string]: {
        startingNodes: IReactFlowNode[]
        endingNodeData?: INodeData
        inSync: boolean
        overrideConfig?: ICommonObject
        chatId?: string
    }
}

export interface IActiveCache {
    [key: string]: Map<any, any>
}

export interface IOverrideConfig {
    node: string
    nodeId: string
    label: string
    name: string
    type: string
}

export type ICredentialDataDecrypted = ICommonObject

// Plain credential object sent to server
export interface ICredentialReqBody {
    name: string
    credentialName: string
    plainDataObj: ICredentialDataDecrypted
}

// Decrypted credential object sent back to client
export interface ICredentialReturnResponse extends ICredential {
    plainDataObj: ICredentialDataDecrypted
}

export interface IUploadFileSizeAndTypes {
    fileTypes: string[]
    maxUploadSize: number
}

export interface IApiKey {
    id: string
    keyName: string
    apiKey: string
    apiSecret: string
    updatedDate: Date
}

export interface ICustomTemplate {
    id: string
    name: string
    flowData: string
    updatedDate: Date
    createdDate: Date
    description?: string
    type?: string
    badge?: string
    framework?: string
    usecases?: string
    unik?: any
}

export interface IFlowConfig {
    canvasId: string
    chatId: string
    sessionId: string
    chatHistory: IMessage[]
    apiMessageId: string
    overrideConfig?: ICommonObject
}

export interface IPredictionQueueAppServer {
    appDataSource: DataSource
    componentNodes: IComponentNodes
    sseStreamer: IServerSideEventStreamer
    telemetry: Telemetry
    cachePool: CachePool
}

export interface IExecuteFlowParams extends IPredictionQueueAppServer {
    incomingInput: IncomingInput
    canvas: CanvasFlowResult
    chatId: string
    baseURL: string
    isInternal: boolean
    signal?: AbortController
    files?: Express.Multer.File[]
    isUpsert?: boolean
}

export interface INodeOverrides {
    [key: string]: {
        label: string
        name: string
        type: string
        enabled: boolean
    }[]
}

export interface IVariableOverride {
    id: string
    name: string
    type: 'static' | 'runtime'
    enabled: boolean
}

// DocumentStore related - re-export from @flowise/docstore-srv
import type {
    IDocumentStoreUpsertData as IDocStoreUpsertData,
    IDocumentStoreLoaderForPreview as IDocStoreLoaderForPreview
} from '@flowise/docstore-srv'

export {
    DocumentStoreStatus,
    IDocumentStore,
    IDocumentStoreFileChunk,
    IDocumentStoreLoader,
    IDocumentStoreLoaderFile,
    IDocumentStoreLoaderForPreview,
    IDocumentStoreFileChunkPagedResponse,
    IDocumentStoreWhereUsed,
    IDocumentStoreUpsertData,
    IDocumentStoreRefreshData,
    addLoaderSource,
    DocumentStoreDTO
} from '@flowise/docstore-srv'

// Execute interfaces for queue processing - kept locally due to IComponentNodes dependency
export interface IExecuteDocStoreUpsert {
    appDataSource: DataSource
    componentNodes: IComponentNodes
    telemetry: Telemetry
    cachePool?: CachePool
    storeId: string
    totalItems: IDocStoreUpsertData[]
    files: Express.Multer.File[]
    isRefreshAPI: boolean
}

export interface IExecutePreviewLoader {
    appDataSource: DataSource
    componentNodes: IComponentNodes
    cachePool?: CachePool
    data: IDocStoreLoaderForPreview
    isPreviewOnly: boolean
    telemetry?: Telemetry
}

export interface IExecuteProcessLoader {
    appDataSource: DataSource
    componentNodes: IComponentNodes
    telemetry: Telemetry
    cachePool?: CachePool
    data: IDocStoreLoaderForPreview
    docLoaderId: string
    isProcessWithoutUpsert: boolean
}

export interface IExecuteVectorStoreInsert {
    appDataSource: DataSource
    componentNodes: IComponentNodes
    telemetry: Telemetry
    cachePool?: CachePool
    data: ICommonObject
    isStrictSave: boolean
    isVectorStoreInsert: boolean
}
