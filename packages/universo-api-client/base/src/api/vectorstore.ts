/**
 * VectorStore API Client
 *
 * Manages vector store operations for RAG workflows.
 * Handles upsert operations, history tracking, and formdata uploads.
 *
 * @example
 * ```typescript
 * import { api, vectorstoreQueryKeys } from '@universo/api-client'
 * import { useQuery } from '@tanstack/react-query'
 *
 * // Get upsert history
 * const { data } = useQuery({
 *   queryKey: vectorstoreQueryKeys.history(chatflowId),
 *   queryFn: () => api.vectorStore.getUpsertHistory(chatflowId)
 * })
 * ```
 */

import type { AxiosInstance, AxiosResponse } from 'axios'

// ============ Types ============

/** Upsert history entry */
export interface UpsertHistoryEntry {
    id: string
    chatflowid: string
    result: string
    flowData: string
    date: string
}

/** Upsert request body */
export interface UpsertVectorStoreBody {
    stopNodeId?: string
    overrideConfig?: Record<string, unknown>
    [key: string]: unknown
}

/** Get upsert history params */
export interface GetUpsertHistoryParams {
    order?: 'ASC' | 'DESC'
    startDate?: string
    endDate?: string
}

// ============ API Class ============

export class VectorStoreApi {
    constructor(private readonly client: AxiosInstance) {}

    /**
     * Upsert documents into vector store
     *
     * @param chatflowId - ID of the chatflow containing vector store node
     * @param body - Upsert configuration
     */
    async upsertVectorStore(chatflowId: string, body: UpsertVectorStoreBody): Promise<AxiosResponse<unknown>> {
        return this.client.post(`/vector/internal-upsert/${chatflowId}`, body)
    }

    /**
     * Upsert documents with FormData (for file uploads)
     *
     * @param chatflowId - ID of the chatflow containing vector store node
     * @param formData - FormData with files and configuration
     */
    async upsertVectorStoreWithFormData(chatflowId: string, formData: FormData): Promise<AxiosResponse<unknown>> {
        return this.client.post(`/vector/internal-upsert/${chatflowId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
    }

    /**
     * Get upsert history for a chatflow
     *
     * @param chatflowId - ID of the chatflow
     * @param params - Optional pagination/filtering params
     */
    async getUpsertHistory(chatflowId: string, params: GetUpsertHistoryParams = {}): Promise<AxiosResponse<UpsertHistoryEntry[]>> {
        return this.client.get(`/upsert-history/${chatflowId}`, {
            params: { order: 'DESC', ...params }
        })
    }

    /**
     * Delete upsert history entries
     *
     * @param ids - Array of history entry IDs to delete
     */
    async deleteUpsertHistory(ids: string[]): Promise<AxiosResponse<void>> {
        return this.client.patch('/upsert-history', { ids })
    }
}

/**
 * Query keys factory for TanStack Query integration
 */
export const vectorstoreQueryKeys = {
    all: ['vector-stores'] as const,
    history: (chatflowId: string) => [...vectorstoreQueryKeys.all, 'history', chatflowId] as const
} as const
