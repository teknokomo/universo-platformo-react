/**
 * @flowise/docstore-srv
 *
 * Interfaces and types for DocumentStore, VectorStore, and UpsertHistory functionality.
 */

import { DataSource } from 'typeorm'

// ============================================================================
// Enums
// ============================================================================

export enum DocumentStoreStatus {
    EMPTY_SYNC = 'EMPTY',
    SYNC = 'SYNC',
    SYNCING = 'SYNCING',
    STALE = 'STALE',
    NEW = 'NEW',
    UPSERTING = 'UPSERTING',
    UPSERTED = 'UPSERTED'
}

// ============================================================================
// Entity Interfaces
// ============================================================================

export interface IDocumentStore {
    id: string
    name: string
    description: string
    loaders: string // JSON string
    whereUsed: string // JSON string
    updatedDate: Date
    createdDate: Date
    status: DocumentStoreStatus
    vectorStoreConfig: string | null // JSON string
    embeddingConfig: string | null // JSON string
    recordManagerConfig: string | null // JSON string
}

export interface IDocumentStoreFileChunk {
    id: string
    chunkNo: number
    docId: string
    storeId: string
    pageContent: string
    metadata: string
}

export interface IUpsertHistory {
    id: string
    canvasId: string
    result: string
    flowData: string
    date: Date
}

// ============================================================================
// Loader Interfaces
// ============================================================================

export interface IDocumentStoreLoader {
    id?: string
    loaderId?: string
    loaderName?: string
    loaderConfig?: any // eslint-disable-line @typescript-eslint/no-explicit-any
    splitterId?: string
    splitterName?: string
    splitterConfig?: any // eslint-disable-line @typescript-eslint/no-explicit-any
    totalChunks?: number
    totalChars?: number
    status?: DocumentStoreStatus
    storeId?: string
    files?: IDocumentStoreLoaderFile[]
    source?: string
    credential?: string
}

export interface IDocumentStoreLoaderForPreview extends IDocumentStoreLoader {
    rehydrated?: boolean
    preview?: boolean
    previewChunkCount?: number
}

export interface IDocumentStoreLoaderFile {
    id: string
    name: string
    mimePrefix: string
    size: number
    status: DocumentStoreStatus
    uploaded: Date
}

// ============================================================================
// Response Interfaces
// ============================================================================

export interface IDocumentStoreFileChunkPagedResponse {
    chunks: IDocumentStoreFileChunk[]
    count: number
    characters: number
    file?: IDocumentStoreLoader
    currentPage: number
    storeName: string
    description: string
    docId: string
}

export interface IDocumentStoreWhereUsed {
    id: string
    name: string
}

// ============================================================================
// Upsert Data Interfaces
// ============================================================================

export interface IDocumentStoreUpsertData {
    docId: string
    metadata?: string | object
    replaceExisting?: boolean
    createNewDocStore?: boolean
    docStore?: IDocumentStore
    loader?: {
        name: string
        config: Record<string, unknown>
    }
    splitter?: {
        name: string
        config: Record<string, unknown>
    }
    vectorStore?: {
        name: string
        config: Record<string, unknown>
    }
    embedding?: {
        name: string
        config: Record<string, unknown>
    }
    recordManager?: {
        name: string
        config: Record<string, unknown>
    }
}

export interface IDocumentStoreRefreshData {
    items: IDocumentStoreUpsertData[]
}

// ============================================================================
// DI Config Interfaces
// ============================================================================

/**
 * Common logger interface for DI
 */
export interface ILogger {
    info: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
}

/**
 * Storage utilities interface for DI
 */
export interface IStorageUtils {
    addArrayFilesToStorage: (mime: string, bf: Buffer, prefix: string, ...paths: string[]) => Promise<void>
    addSingleFileToStorage: (mime: string, bf: Buffer, prefix: string, ...paths: string[]) => Promise<void>
    getFileFromStorage: (file: string, ...paths: string[]) => Promise<Buffer>
    removeFilesFromStorage: (...paths: string[]) => Promise<void>
    removeSpecificFileFromStorage: (...paths: string[]) => Promise<void>
    removeSpecificFileFromUpload: (filePath: string) => void
    getFileFromUpload: (filePath: string) => Promise<Buffer>
    mapExtToInputField: (ext: string) => string
    mapMimeTypeToInputField: (mime: string) => string
}

/**
 * Queue manager interface for DI
 */
export interface IQueueManager {
    getQueue: (name: string) => IQueue
}

export interface IQueue {
    addJob: (data: unknown) => Promise<IJob>
    getQueueEvents: () => IQueueEvents
}

export interface IJob {
    id: string
    waitUntilFinished: (events: IQueueEvents) => Promise<unknown>
}

export interface IQueueEvents {
    // Queue events interface
}

/**
 * Telemetry interface for DI
 */
export interface ITelemetry {
    sendTelemetry: (event: string, data: Record<string, unknown>) => void
}

/**
 * Cache pool interface for DI
 */
export interface ICachePool {
    get: (key: string) => unknown
    set: (key: string, value: unknown) => void
}

/**
 * Component nodes interface for DI
 */
export interface IComponentNodes {
    [key: string]: INodeComponent
}

export interface INodeComponent {
    name: string
    label: string
    category: string
    filePath: string
    inputs?: INodeInput[]
}

export interface INodeInput {
    name: string
    label: string
    type: string
    options?: Array<{ name: string }>
    credentialNames?: string[]
    fileType?: string
}

/**
 * Node factory interface for DI - abstracts dynamic node loading
 */
export interface INodeFactory {
    createLoaderInstance: (loaderId: string, nodeData: unknown, options: unknown) => Promise<unknown>
    createSplitterInstance: (splitterId: string, nodeData: unknown) => Promise<unknown>
    createEmbeddingInstance: (embeddingName: string, nodeData: unknown, options: unknown) => Promise<unknown>
    createVectorStoreInstance: (vectorStoreName: string, nodeData: unknown, options: unknown) => Promise<IVectorStoreInstance>
    createRecordManagerInstance: (recordManagerName: string, nodeData: unknown, options: unknown) => Promise<unknown>
    getNodeComponent: (name: string) => INodeComponent | undefined
}

export interface IVectorStoreInstance {
    init: (nodeData: unknown, input: string, options: unknown) => Promise<unknown>
    vectorStoreMethods?: {
        delete?: (nodeData: unknown, ids: string[], options: unknown) => Promise<void>
        upsert?: (nodeData: unknown, options: unknown) => Promise<unknown>
    }
}

/**
 * Nodes service interface for DI
 */
export interface INodesService {
    getAllNodesForCategory: (category: string) => Promise<INodeComponent[]>
}

/**
 * Canvas service interface for DI
 */
export interface ICanvasService {
    getCanvasById: (id: string) => Promise<{ id: string; name: string } | null>
}

// ============================================================================
// Execute Interfaces (for Queue processing)
// ============================================================================

export interface IExecuteContext {
    appDataSource: DataSource
    componentNodes: IComponentNodes
    telemetry?: ITelemetry
    cachePool?: ICachePool
}

export interface IExecuteDocStoreUpsert extends IExecuteContext {
    storeId: string
    totalItems: IDocumentStoreUpsertData[]
    files: Express.Multer.File[]
    isRefreshAPI: boolean
}

export interface IExecutePreviewLoader extends Omit<IExecuteContext, 'telemetry'> {
    data: IDocumentStoreLoaderForPreview
    isPreviewOnly: boolean
    telemetry?: ITelemetry
}

export interface IExecuteProcessLoader extends IExecuteContext {
    data: IDocumentStoreLoaderForPreview
    docLoaderId: string
    isProcessWithoutUpsert: boolean
}

export interface IExecuteVectorStoreInsert extends IExecuteContext {
    data: Record<string, unknown>
    isStrictSave: boolean
    isVectorStoreInsert: boolean
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract filename from base64 file string
 */
const getFileName = (fileBase64: string): string => {
    const fileNames: string[] = []
    if (fileBase64.startsWith('FILE-STORAGE::')) {
        const names = fileBase64.substring(14)
        if (names.includes('[') && names.includes(']')) {
            const files = JSON.parse(names) as string[]
            return files.join(', ')
        } else {
            return fileBase64.substring(14)
        }
    }
    if (fileBase64.startsWith('[') && fileBase64.endsWith(']')) {
        const files = JSON.parse(fileBase64) as string[]
        for (const file of files) {
            const splitDataURI = file.split(',')
            const filename = splitDataURI[splitDataURI.length - 1].split(':')[1]
            fileNames.push(filename)
        }
        return fileNames.join(', ')
    } else {
        const splitDataURI = fileBase64.split(',')
        const filename = splitDataURI[splitDataURI.length - 1].split(':')[1]
        return filename
    }
}

/**
 * Add loader source based on loader type
 */
export const addLoaderSource = (loader: IDocumentStoreLoader, isGetFileNameOnly = false): string => {
    let source = 'None'

    const handleUnstructuredFileLoader = (config: Record<string, unknown>, getFileNameOnly: boolean): string => {
        if (config.fileObject) {
            return getFileNameOnly ? getFileName(config.fileObject as string) : (config.fileObject as string).replace('FILE-STORAGE::', '')
        }
        return (config.filePath as string) || 'None'
    }

    const loaderConfig = loader.loaderConfig || {}

    switch (loader.loaderId) {
        case 'pdfFile':
        case 'jsonFile':
        case 'csvFile':
        case 'file':
        case 'jsonlinesFile':
        case 'txtFile':
            source = isGetFileNameOnly
                ? getFileName(loaderConfig[loader.loaderId] as string)
                : (loaderConfig[loader.loaderId] as string)?.replace('FILE-STORAGE::', '') || 'None'
            break
        case 'apiLoader':
            source = `${loaderConfig.url} (${loaderConfig.method})`
            break
        case 'cheerioWebScraper':
        case 'playwrightWebScraper':
        case 'puppeteerWebScraper':
            source = (loaderConfig.url as string) || 'None'
            break
        case 'unstructuredFileLoader':
            source = handleUnstructuredFileLoader(loaderConfig, isGetFileNameOnly)
            break
        default:
            source = 'None'
            break
    }

    return source
}
