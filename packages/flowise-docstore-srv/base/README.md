# @flowise/docstore-srv

Backend service for Document Store management in Universo Platformo.

## Overview

This package provides backend services for:
- **Document Store Management** - CRUD operations for document stores
- **File Chunk Operations** - Managing document chunks with pagination
- **Loader Management** - Adding, removing, and processing document loaders
- **Vector Store Configuration** - Managing vector store, embedding, and record manager configs

## Architecture

The package uses a **Dependency Injection (DI) pattern** for all services:

```typescript
import { DataSource } from 'typeorm'
import {
    createDocumentStoreService,
    createChunkService,
    createLoaderService,
    createVectorStoreConfigService,
    DocstoreServiceDependencies,
    consoleLogger
} from '@flowise/docstore-srv'

// Create dependencies
const deps: DocstoreServiceDependencies = {
    dataSource: myDataSource, // TypeORM DataSource
    logger: consoleLogger     // or your custom logger
}

// Create services
const documentStoreService = createDocumentStoreService(deps)
const chunkService = createChunkService(deps)
const loaderService = createLoaderService(deps)
const vectorStoreConfigService = createVectorStoreConfigService(deps)
```

## Services

### DocumentStoreService

Core CRUD operations for document stores:

```typescript
// Create a new document store
const newStore = await documentStoreService.createDocumentStore(store)

// Get all document stores (optionally filtered by unikId)
const stores = await documentStoreService.getAllDocumentStores(unikId)

// Get a specific document store
const store = await documentStoreService.getDocumentStoreById(storeId, unikId)

// Update a document store
const updated = await documentStoreService.updateDocumentStore(store, updates)

// Delete a document store
const result = await documentStoreService.deleteDocumentStore(storeId, unikId)

// Update document store usage tracking
await documentStoreService.updateDocumentStoreUsage(canvasId, storeId, unikId)
```

### ChunkService

Operations for document chunks:

```typescript
// Get all file chunks
const allChunks = await chunkService.getAllDocumentFileChunks()

// Get chunks with pagination
const response = await chunkService.getDocumentStoreFileChunks(storeId, docId, pageNo)

// Delete a specific chunk
const result = await chunkService.deleteDocumentStoreFileChunk(storeId, docId, chunkId)

// Edit a chunk's content and metadata
const result = await chunkService.editDocumentStoreFileChunk(storeId, docId, chunkId, content, metadata)
```

### LoaderService

Operations for document loaders:

```typescript
// Delete a loader from document store
const store = await loaderService.deleteLoaderFromDocumentStore(storeId, docId)

// Save a processing loader (sets status to SYNCING)
const loader = await loaderService.saveProcessingLoader(data)
```

### VectorStoreConfigService

Operations for vector store configurations:

```typescript
// Save vector store, embedding, and record manager configs
const store = await vectorStoreConfigService.saveVectorStoreConfig(data, isStrictSave)

// Update only vector store config
const store = await vectorStoreConfigService.updateVectorStoreConfigOnly(data)
```

## Database Entities

The package exports three TypeORM entities:

- **DocumentStore** - Main document store entity
- **DocumentStoreFileChunk** - File chunk entity
- **UpsertHistory** - Upsert history tracking

### Entity Registration

Register entities and migrations in your main application:

```typescript
import { docstoreEntities, docstoreMigrations } from '@flowise/docstore-srv'

const dataSource = new DataSource({
    // ... your config
    entities: [...docstoreEntities, ...otherEntities],
    migrations: [...docstoreMigrations, ...otherMigrations]
})
```

## Error Handling

The package provides consistent error handling:

```typescript
import { InternalFlowiseError, getErrorMessage } from '@flowise/docstore-srv'

try {
    const store = await documentStoreService.getDocumentStoreById(storeId)
} catch (error) {
    if (error instanceof InternalFlowiseError) {
        console.log(error.statusCode, error.message)
    }
}
```

## Dependencies

This package requires:
- `typeorm` ^0.3.20
- `http-status-codes` ^2.3.0
- `uuid` ^9.0.1

## Universo Platformo Features

This package includes Universo Platformo-specific features:
- **Unik Filtering** - All queries support filtering by `unikId` for multi-tenant security
- **Unik Relation** - DocumentStore entity has a ManyToOne relation to Unik entity

## ⚠️ Partial Extraction - flowise-server Dependencies

This package contains **only the CRUD operations** that can be cleanly isolated. Complex operations that require runtime dependencies remain in `packages/flowise-server/src/services/documentstore/`.

### What's in this package (@flowise/docstore-srv)

| Operation | Status | Notes |
|-----------|--------|-------|
| `createDocumentStore` | ✅ Complete | |
| `getAllDocumentStores` | ✅ Complete | |
| `getDocumentStoreById` | ✅ Complete | |
| `updateDocumentStore` | ✅ Complete | |
| `deleteDocumentStore` | ✅ Complete | |
| `updateDocumentStoreUsage` | ✅ Complete | |
| Chunk CRUD operations | ✅ Complete | |
| Loader management | ✅ Complete | Basic operations |
| Vector store config | ✅ Complete | Config management only |

### What remains in flowise-server

| Operation | Reason | Required Dependencies |
|-----------|--------|----------------------|
| `previewChunks` | Dynamic node loading | `nodesPool.componentNodes` |
| `processLoader` | Document processing | `nodesPool`, `flowise-components` |
| `insertIntoVectorStore` | Vector operations | `nodesPool`, `telemetry` |
| `queryVectorStore` | Vector search | `nodesPool`, embeddings runtime |
| `upsertDocStoreMiddleware` | Full pipeline | Queue manager, all above |
| `refreshDocStoreMiddleware` | Refresh pipeline | Queue manager, all above |
| File storage operations | S3/local storage | `flowise-components` storage utils |
| Node providers list | Dynamic node discovery | `nodesPool`, `nodesService` |

### Blocking Dependencies Analysis

1. **`getRunningExpressApp()`** - Singleton pattern providing access to:
   - `appServer.AppDataSource` - TypeORM DataSource
   - `appServer.nodesPool.componentNodes` - Loaded Flowise nodes
   - `appServer.queueManager` - BullMQ queue manager
   - `appServer.telemetry` - Telemetry service

2. **`flowise-components`** - Large package with:
   - File storage utilities (`addSingleFileToStorage`, `removeFilesFromStorage`)
   - Node base classes and interfaces
   - LangChain integrations

3. **`nodesPool.componentNodes`** - Dynamic node loading:
   - Text splitters, Document loaders, Embeddings, Vector stores
   - Loaded at server startup from `flowise-components`

### Future Isolation Plan

To fully extract all operations into this package, the following DI interfaces must be implemented:

```typescript
// Future DI interfaces (to be implemented)
export interface IStorageProvider {
    addSingleFileToStorage(mime: string, buffer: Buffer, filename: string, folder: string, entityId: string): Promise<void>
    removeFilesFromStorage(folder: string, entityId: string): Promise<void>
    getFileFromStorage(folder: string, entityId: string, filename: string): Promise<Buffer>
}

export interface INodeRunner {
    initNode(nodeId: string, nodeData: INodeData): Promise<any>
    getComponentNodes(): IComponentNodes
    getAllNodesForCategory(category: string): Promise<INodeMetadata[]>
}

export interface IQueueProvider {
    addJob(queueName: string, data: any): Promise<{ id: string }>
    waitForResult(jobId: string): Promise<any>
}

// Extended dependencies
export interface DocstoreServiceDependencies {
    dataSource: DataSource
    logger: ILogger
    storage?: IStorageProvider      // Optional for full isolation
    nodeRunner?: INodeRunner        // Optional for full isolation
    queueProvider?: IQueueProvider  // Optional for full isolation
}
```

**Estimated effort for full isolation**: 15-20 hours

### Integration with flowise-server

The `flowise-server` uses this package through an integration layer:

```typescript
// packages/flowise-server/src/services/docstore-integration/index.ts
import { createDocumentStoreService } from '@flowise/docstore-srv'

export function getDocumentStoreService(): IDocumentStoreService {
    return createDocumentStoreService({
        dataSource: getDataSource(),
        logger: createLoggerAdapter()
    })
}
```

CRUD operations in flowise-server delegate to this package:

```typescript
// packages/flowise-server/src/services/documentstore/index.ts
const createDocumentStore = async (newDocumentStore: DocumentStore) => {
    return getDocumentStoreService().createDocumentStore(newDocumentStore)
}
```

## License

MIT
