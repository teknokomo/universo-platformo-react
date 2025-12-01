/**
 * @flowise/docstore-srv - Document Store Backend Service
 *
 * This package provides backend services for document store management,
 * including CRUD operations for document stores, file chunks, loaders,
 * and vector store configurations.
 *
 * Uses DI pattern for all dependencies to ensure testability and flexibility.
 */

// Database entities
export { DocumentStore, DocumentStoreFileChunk, UpsertHistory, docstoreEntities } from './database/entities'

// Database migrations
export { docstoreMigrations } from './database/migrations/postgres'

// Interfaces and types
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
    IUpsertHistory,
    addLoaderSource
} from './Interface'

// DTOs
export { DocumentStoreDTO } from './dto'

// DI configuration and interfaces
export {
    // Core dependencies
    DocstoreServiceDependencies,
    ILogger,
    ISSEStreamer,
    ITelemetry,
    IRateLimiter,
    // Node provider interfaces (for flowise-server to implement)
    INodeInputParam,
    INodeMetadata,
    ICredentialMetadata,
    INodeProvider,
    // Service interfaces
    IEncryptionService,
    IStorageService,
    // Helper functions
    createRepositories,
    consoleLogger
} from './di'

// Services
export {
    IDocumentStoreService,
    createDocumentStoreService,
    IChunkService,
    createChunkService,
    ILoaderService,
    createLoaderService,
    IVectorStoreConfigService,
    createVectorStoreConfigService,
    DOCUMENT_STORE_BASE_FOLDER
} from './services'

// Controllers
export { IDocumentStoreController, IDocumentStoreControllerDeps, AccessControlFn, createDocumentStoreController } from './controllers'

// Routes
export { createDocumentStoreRouter } from './routes'

// Errors
export { InternalFlowiseError, getErrorMessage } from './errors'
