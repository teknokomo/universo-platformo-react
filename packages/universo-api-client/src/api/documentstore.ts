/**
 * DocumentStore API Client
 *
 * Manages document stores for RAG (Retrieval-Augmented Generation) workflows.
 * Handles document loaders, text splitters, embeddings, and vector store integration.
 *
 * @example
 * ```typescript
 * import { api, documentstoreQueryKeys } from '@universo/api-client'
 * import { useQuery } from '@tanstack/react-query'
 *
 * // Get all document stores
 * const { data } = useQuery({
 *   queryKey: documentstoreQueryKeys.list(unikId),
 *   queryFn: () => api.documentStore.getAllDocumentStores(unikId)
 * })
 * ```
 */

import type { AxiosInstance, AxiosResponse } from 'axios'

// ============ Types ============

/** Document Store entity */
export interface DocumentStore {
    id: string
    name: string
    description?: string
    status: 'EMPTY' | 'SYNC' | 'SYNCING' | 'STALE' | 'NEW' | 'UPSERTING' | 'UPSERTED'
    loaders: DocumentLoader[]
    whereUsed?: string[]
    vectorStoreConfig?: Record<string, unknown>
    embeddingConfig?: Record<string, unknown>
    recordManagerConfig?: Record<string, unknown>
    createdDate: string
    updatedDate: string
}

/** Document Loader within a store */
export interface DocumentLoader {
    id: string
    loaderId: string
    loaderName: string
    loaderConfig?: Record<string, unknown>
    splitterConfig?: Record<string, unknown>
    totalChunks: number
    totalChars: number
    status: string
}

/** Request body for creating a document store */
export interface CreateDocumentStoreBody {
    name: string
    description?: string
}

/** Preview chunks request body */
export interface PreviewChunksBody {
    storeId: string
    loaderId: string
    loaderConfig: Record<string, unknown>
    splitterConfig?: Record<string, unknown>
    previewChunkCount?: number
}

/** Preview chunks response */
export interface PreviewChunksResponse {
    totalChunks: number
    chunks: unknown[]
    previewChunkCount: number
}

// ============ API Class ============

export class DocumentStoreApi {
    constructor(private readonly client: AxiosInstance) {}

    // -------- Store CRUD --------

    /** Get all document stores for a Unik */
    async getAllDocumentStores(unikId: string): Promise<AxiosResponse<DocumentStore[]>> {
        return this.client.get(`/unik/${unikId}/document-stores/store`)
    }

    /** Get a specific document store by ID */
    async getSpecificDocumentStore(unikId: string, id: string): Promise<AxiosResponse<DocumentStore>> {
        return this.client.get(`/unik/${unikId}/document-stores/store/${id}`)
    }

    /** Create a new document store */
    async createDocumentStore(
        unikId: string,
        body: CreateDocumentStoreBody
    ): Promise<AxiosResponse<DocumentStore>> {
        return this.client.post(`/unik/${unikId}/document-stores/store`, body)
    }

    /** Update a document store */
    async updateDocumentStore(
        unikId: string,
        id: string,
        body: Partial<CreateDocumentStoreBody>
    ): Promise<AxiosResponse<DocumentStore>> {
        return this.client.put(`/unik/${unikId}/document-stores/store/${id}`, body)
    }

    /** Delete a document store */
    async deleteDocumentStore(unikId: string, id: string): Promise<AxiosResponse<void>> {
        return this.client.delete(`/unik/${unikId}/document-stores/store/${id}`)
    }

    // -------- Document Loaders --------

    /** Get available document loader components */
    async getDocumentLoaders(unikId: string): Promise<AxiosResponse<unknown[]>> {
        return this.client.get(`/unik/${unikId}/document-stores/components/loaders`)
    }

    /** Get configuration for a specific loader in a store */
    async getDocumentStoreConfig(
        unikId: string,
        storeId: string,
        loaderId: string
    ): Promise<AxiosResponse<unknown>> {
        return this.client.get(`/unik/${unikId}/document-stores/store-configs/${storeId}/${loaderId}`)
    }

    /** Preview chunks before processing */
    async previewChunks(
        unikId: string,
        body: PreviewChunksBody
    ): Promise<AxiosResponse<PreviewChunksResponse>> {
        return this.client.post(`/unik/${unikId}/document-stores/loader/preview`, body)
    }

    /** Save a loader configuration for later processing */
    async saveProcessingLoader(unikId: string, body: unknown): Promise<AxiosResponse<DocumentLoader>> {
        return this.client.post(`/unik/${unikId}/document-stores/loader/save`, body)
    }

    /** Process a saved loader (async operation) */
    async processLoader(unikId: string, body: unknown, loaderId: string): Promise<AxiosResponse<void>> {
        return this.client.post(`/unik/${unikId}/document-stores/loader/process/${loaderId}`, body)
    }

    /** Refresh/reprocess all loaders in a store */
    async refreshLoader(unikId: string, storeId: string): Promise<AxiosResponse<void>> {
        return this.client.post(`/unik/${unikId}/document-stores/refresh/${storeId}`)
    }

    /** Delete a loader from a store */
    async deleteLoaderFromStore(unikId: string, id: string, fileId: string): Promise<AxiosResponse<void>> {
        return this.client.delete(`/unik/${unikId}/document-stores/loader/${id}/${fileId}`)
    }

    // -------- Chunks --------

    /** Get file chunks with pagination */
    async getFileChunks(
        unikId: string,
        storeId: string,
        fileId: string,
        pageNo: number
    ): Promise<AxiosResponse<unknown>> {
        return this.client.get(`/unik/${unikId}/document-stores/chunks/${storeId}/${fileId}/${pageNo}`)
    }

    /** Delete a specific chunk */
    async deleteChunkFromStore(
        unikId: string,
        storeId: string,
        loaderId: string,
        chunkId: string
    ): Promise<AxiosResponse<void>> {
        return this.client.delete(
            `/unik/${unikId}/document-stores/chunks/${storeId}/${loaderId}/${chunkId}`
        )
    }

    /** Edit a chunk's content */
    async editChunkFromStore(
        unikId: string,
        storeId: string,
        loaderId: string,
        chunkId: string,
        body: unknown
    ): Promise<AxiosResponse<unknown>> {
        return this.client.put(
            `/unik/${unikId}/document-stores/chunks/${storeId}/${loaderId}/${chunkId}`,
            body
        )
    }

    // -------- Vector Store Components --------

    /** Get available vector store providers */
    async getVectorStoreProviders(unikId: string): Promise<AxiosResponse<unknown[]>> {
        return this.client.get(`/unik/${unikId}/document-stores/components/vectorstore`)
    }

    /** Get available embedding providers */
    async getEmbeddingProviders(unikId: string): Promise<AxiosResponse<unknown[]>> {
        return this.client.get(`/unik/${unikId}/document-stores/components/embeddings`)
    }

    /** Get available record manager providers */
    async getRecordManagerProviders(unikId: string): Promise<AxiosResponse<unknown[]>> {
        return this.client.get(`/unik/${unikId}/document-stores/components/recordmanager`)
    }

    // -------- Vector Store Operations --------

    /** Insert documents into vector store */
    async insertIntoVectorStore(unikId: string, body: unknown): Promise<AxiosResponse<unknown>> {
        return this.client.post(`/unik/${unikId}/document-stores/vectorstore/insert`, body)
    }

    /** Save vector store configuration */
    async saveVectorStoreConfig(unikId: string, body: unknown): Promise<AxiosResponse<unknown>> {
        return this.client.post(`/unik/${unikId}/document-stores/vectorstore/save`, body)
    }

    /** Update vector store configuration */
    async updateVectorStoreConfig(unikId: string, body: unknown): Promise<AxiosResponse<unknown>> {
        return this.client.post(`/unik/${unikId}/document-stores/vectorstore/update`, body)
    }

    /** Query the vector store */
    async queryVectorStore(unikId: string, body: unknown): Promise<AxiosResponse<unknown>> {
        return this.client.post(`/unik/${unikId}/document-stores/vectorstore/query`, body)
    }

    /** Delete all vector store data from a store */
    async deleteVectorStoreDataFromStore(unikId: string, storeId: string): Promise<AxiosResponse<void>> {
        return this.client.delete(`/unik/${unikId}/document-stores/vectorstore/${storeId}`)
    }
}

/**
 * Query keys factory for TanStack Query integration
 */
export const documentstoreQueryKeys = {
    all: ['document-stores'] as const,
    list: (unikId: string) => [...documentstoreQueryKeys.all, 'list', unikId] as const,
    detail: (unikId: string, id: string) =>
        [...documentstoreQueryKeys.all, 'detail', unikId, id] as const,
    loaders: (unikId: string) => [...documentstoreQueryKeys.all, 'loaders', unikId] as const,
    chunks: (unikId: string, storeId: string, fileId: string) =>
        [...documentstoreQueryKeys.all, 'chunks', unikId, storeId, fileId] as const,
    vectorProviders: (unikId: string) =>
        [...documentstoreQueryKeys.all, 'vectorProviders', unikId] as const,
    embeddingProviders: (unikId: string) =>
        [...documentstoreQueryKeys.all, 'embeddingProviders', unikId] as const,
} as const
