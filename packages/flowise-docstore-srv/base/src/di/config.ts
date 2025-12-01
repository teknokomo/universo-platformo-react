/**
 * Dependency Injection Configuration for DocumentStore services
 *
 * This module provides all dependencies needed by DocumentStore services,
 * avoiding direct calls to getRunningExpressApp() and enabling better testing.
 */

import { DataSource, Repository } from 'typeorm'
import { DocumentStore } from '../database/entities/DocumentStore'
import { DocumentStoreFileChunk } from '../database/entities/DocumentStoreFileChunk'
import { UpsertHistory } from '../database/entities/UpsertHistory'

/**
 * Logger interface to abstract logging dependency
 */
export interface ILogger {
    debug(message: string, ...args: unknown[]): void
    info(message: string, ...args: unknown[]): void
    warn(message: string, ...args: unknown[]): void
    error(message: string, ...args: unknown[]): void
}

/**
 * SSE Streamer interface for real-time updates
 */
export interface ISSEStreamer {
    addClient(clientId: string, response: unknown): void
    removeClient(clientId: string): void
    streamSseEvent(clientId: string, event: string, data: unknown): void
}

/**
 * Telemetry interface
 */
export interface ITelemetry {
    sendTelemetry(eventName: string, properties: Record<string, unknown>): void
}

/**
 * Rate Limiter interface
 */
export interface IRateLimiter {
    getRateLimiter(): unknown
    addRateLimiter(req: unknown, res: unknown, next: () => void): void
}

// ============================================================================
// Node Provider Interfaces (абстракция над nodesPool.componentNodes)
// ============================================================================

/**
 * Input parameter definition for a node
 */
export interface INodeInputParam {
    type: string
    name: string
    label: string
    description?: string
    optional?: boolean
    default?: unknown
    options?: Array<{ label: string; name: string }>
    rows?: number
    placeholder?: string
    additionalParams?: boolean
    list?: boolean
    acceptVariable?: boolean
    credentialNames?: string[]
}

/**
 * Node metadata - represents a component node (Document Loader, Vector Store, etc.)
 */
export interface INodeMetadata {
    label: string
    name: string
    type: string
    icon: string
    version: number
    category: string
    baseClasses: string[]
    description?: string
    filePath?: string
    tags?: string[]
    badge?: string
    inputs?: INodeInputParam[]
}

/**
 * Credential metadata
 */
export interface ICredentialMetadata {
    label: string
    name: string
    description?: string
    inputs?: INodeInputParam[]
}

/**
 * Provider for accessing component nodes - abstracts nodesPool access
 * This allows services to work with nodes without runtime Express dependency
 */
export interface INodeProvider {
    /**
     * Get all component nodes metadata
     */
    getComponentNodes(): Record<string, INodeMetadata>

    /**
     * Get specific node metadata by name
     */
    getNode(nodeName: string): INodeMetadata | undefined

    /**
     * Get nodes by category (e.g., "Document Loaders", "Vector Stores", "Embeddings")
     */
    getNodesByCategory(category: string): INodeMetadata[]

    /**
     * Get component credentials registry
     */
    getComponentCredentials(): Record<string, ICredentialMetadata>

    /**
     * Create node instance dynamically
     * @param nodeName - The name of the node to instantiate
     * @returns Promise resolving to the node instance
     */
    createNodeInstance(nodeName: string): Promise<unknown>
}

// ============================================================================
// Encryption Service Interface
// ============================================================================

/**
 * Encryption service for credential data
 */
export interface IEncryptionService {
    /**
     * Encrypt credential data
     */
    encryptCredentialData(plainData: Record<string, unknown>): Promise<string>

    /**
     * Decrypt credential data with optional component context for password redaction
     */
    decryptCredentialData(encryptedData: string, componentCredentialName?: string): Promise<Record<string, unknown>>
}

// ============================================================================
// Storage Service Interface
// ============================================================================

/**
 * Storage service for file operations
 */
export interface IStorageService {
    /**
     * Add file to storage
     */
    addFileToStorage(storagePath: string, file: Buffer | string, fileType: string): Promise<string>

    /**
     * Get file from storage
     */
    getFileFromStorage(storagePath: string): Promise<Buffer>

    /**
     * Remove file from storage
     */
    removeFileFromStorage(storagePath: string): Promise<void>

    /**
     * Add array of files to storage
     */
    addFilesToStorage(storagePath: string, files: Array<{ data: Buffer; filename: string }>): Promise<string[]>
}

// ============================================================================
// Dependencies Configuration
// ============================================================================

/**
 * Dependencies configuration object for DocumentStore services
 */
export interface DocstoreServiceDependencies {
    /** TypeORM DataSource */
    dataSource: DataSource

    /** Logger instance */
    logger: ILogger

    /** Node provider for accessing component nodes (required for preview/process/vector ops) */
    nodeProvider?: INodeProvider

    /** Encryption service for credential data */
    encryptionService?: IEncryptionService

    /** Storage service for file operations */
    storageService?: IStorageService

    /** SSE Streamer for real-time events */
    sseStreamer?: ISSEStreamer

    /** Telemetry service */
    telemetry?: ITelemetry

    /** Rate limiter */
    rateLimiter?: IRateLimiter
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create repositories from DataSource
 */
export function createRepositories(dataSource: DataSource): {
    documentStoreRepository: Repository<DocumentStore>
    fileChunkRepository: Repository<DocumentStoreFileChunk>
    upsertHistoryRepository: Repository<UpsertHistory>
} {
    return {
        documentStoreRepository: dataSource.getRepository(DocumentStore),
        fileChunkRepository: dataSource.getRepository(DocumentStoreFileChunk),
        upsertHistoryRepository: dataSource.getRepository(UpsertHistory)
    }
}

/**
 * Default console logger implementation
 */
export const consoleLogger: ILogger = {
    debug: (message: string, ...args: unknown[]) => console.debug(`[DocStore] ${message}`, ...args),
    info: (message: string, ...args: unknown[]) => console.info(`[DocStore] ${message}`, ...args),
    warn: (message: string, ...args: unknown[]) => console.warn(`[DocStore] ${message}`, ...args),
    error: (message: string, ...args: unknown[]) => console.error(`[DocStore] ${message}`, ...args)
}
