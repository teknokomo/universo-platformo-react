/**
 * Assistants API Client
 *
 * Manages OpenAI Assistants, Vector Stores, and related resources.
 * Provides integration with OpenAI's Assistant API.
 *
 * @example
 * ```typescript
 * import { createUniversoApiClient, assistantQueryKeys } from '@universo/api-client'
 * import { useQuery } from '@tanstack/react-query'
 *
 * const api = createUniversoApiClient({ baseURL: '/api/v1' })
 *
 * // Get all assistants
 * const { data: assistants } = useQuery({
 *   queryKey: assistantQueryKeys.list(unikId, 'OPENAI'),
 *   queryFn: () => api.assistants.getAll(unikId, 'OPENAI')
 * })
 * ```
 */

import type { AxiosInstance } from 'axios'
import type {
    Assistant,
    OpenAIAssistant,
    VectorStore,
    OpenAIFile,
    CreateAssistantPayload,
    UpdateAssistantPayload,
    CreateVectorStorePayload,
    UpdateVectorStorePayload,
    AssistantComponent
} from '../types/assistant'

export class AssistantsApi {
    constructor(private readonly client: AxiosInstance) {}

    // ============================================
    // OpenAI Assistant Objects (from OpenAI API)
    // ============================================

    /**
     * Get OpenAI assistant object by ID
     * Fetches directly from OpenAI API using provided credentials
     */
    async getOpenAIAssistant(unikId: string, assistantId: string, credentialId: string): Promise<OpenAIAssistant> {
        const response = await this.client.get<OpenAIAssistant>(`/unik/${unikId}/openai-assistants/${assistantId}`, {
            params: { credential: credentialId }
        })
        return response.data
    }

    /**
     * List all available OpenAI assistants
     * Fetches from OpenAI API using provided credentials
     */
    async listOpenAIAssistants(unikId: string, credentialId: string): Promise<OpenAIAssistant[]> {
        const response = await this.client.get<OpenAIAssistant[]>(`/unik/${unikId}/openai-assistants`, {
            params: { credential: credentialId }
        })
        return response.data
    }

    // ============================================
    // Assistant Management (Universo DB)
    // ============================================

    /**
     * Create new assistant
     */
    async create(unikId: string, payload: CreateAssistantPayload): Promise<Assistant> {
        const response = await this.client.post<Assistant>(`/unik/${unikId}/assistants`, payload)
        return response.data
    }

    /**
     * Get all assistants for user
     *
     * @param type - Filter by assistant type ('OPENAI' or 'CUSTOM')
     */
    async getAll(unikId: string, type?: string): Promise<Assistant[]> {
        const response = await this.client.get<Assistant[]>(`/unik/${unikId}/assistants`, type ? { params: { type } } : undefined)
        return response.data
    }

    /**
     * Get specific assistant by ID
     */
    async getById(unikId: string, id: string): Promise<Assistant> {
        const response = await this.client.get<Assistant>(`/unik/${unikId}/assistants/${id}`)
        return response.data
    }

    /**
     * Update assistant
     */
    async update(unikId: string, id: string, payload: UpdateAssistantPayload): Promise<Assistant> {
        const response = await this.client.put<Assistant>(`/unik/${unikId}/assistants/${id}`, payload)
        return response.data
    }

    /**
     * Delete assistant
     *
     * @param isDeleteBoth - If true, also deletes the OpenAI assistant
     */
    async delete(unikId: string, id: string, isDeleteBoth = false): Promise<void> {
        await this.client.delete(`/unik/${unikId}/assistants/${id}`, isDeleteBoth ? { params: { isDeleteBoth: 'true' } } : undefined)
    }

    // ============================================
    // Vector Stores
    // ============================================

    /**
     * Get vector store by ID
     */
    async getVectorStore(unikId: string, vectorStoreId: string, credentialId: string): Promise<VectorStore> {
        const response = await this.client.get<VectorStore>(`/unik/${unikId}/openai-assistants-vector-store/${vectorStoreId}`, {
            params: { credential: credentialId }
        })
        return response.data
    }

    /**
     * List all vector stores
     */
    async listVectorStores(unikId: string, credentialId: string): Promise<VectorStore[]> {
        const response = await this.client.get<VectorStore[]>(`/unik/${unikId}/openai-assistants-vector-store`, {
            params: { credential: credentialId }
        })
        return response.data
    }

    /**
     * Create new vector store
     */
    async createVectorStore(unikId: string, credentialId: string, payload: CreateVectorStorePayload): Promise<VectorStore> {
        const response = await this.client.post<VectorStore>(`/unik/${unikId}/openai-assistants-vector-store`, payload, {
            params: { credential: credentialId }
        })
        return response.data
    }

    /**
     * Update vector store
     */
    async updateVectorStore(
        unikId: string,
        vectorStoreId: string,
        credentialId: string,
        payload: UpdateVectorStorePayload
    ): Promise<VectorStore> {
        const response = await this.client.put<VectorStore>(`/unik/${unikId}/openai-assistants-vector-store/${vectorStoreId}`, payload, {
            params: { credential: credentialId }
        })
        return response.data
    }

    /**
     * Delete vector store
     */
    async deleteVectorStore(unikId: string, vectorStoreId: string, credentialId: string): Promise<void> {
        await this.client.delete(`/unik/${unikId}/openai-assistants-vector-store/${vectorStoreId}`, {
            params: { credential: credentialId }
        })
    }

    // ============================================
    // File Operations
    // ============================================

    /**
     * Upload files to vector store
     */
    async uploadFilesToVectorStore(unikId: string, vectorStoreId: string, credentialId: string, formData: FormData): Promise<OpenAIFile[]> {
        const response = await this.client.post<OpenAIFile[]>(`/unik/${unikId}/openai-assistants-vector-store/${vectorStoreId}`, formData, {
            params: { credential: credentialId },
            headers: { 'Content-Type': 'multipart/form-data' }
        })
        return response.data
    }

    /**
     * Delete files from vector store
     */
    async deleteFilesFromVectorStore(
        unikId: string,
        vectorStoreId: string,
        credentialId: string,
        fileIds: readonly string[]
    ): Promise<void> {
        await this.client.patch(
            `/unik/${unikId}/openai-assistants-vector-store/${vectorStoreId}`,
            { fileIds },
            { params: { credential: credentialId } }
        )
    }

    /**
     * Upload files to assistant
     */
    async uploadFilesToAssistant(unikId: string, credentialId: string, formData: FormData): Promise<OpenAIFile[]> {
        const response = await this.client.post<OpenAIFile[]>(`/unik/${unikId}/openai-assistants-file/upload`, formData, {
            params: { credential: credentialId },
            headers: { 'Content-Type': 'multipart/form-data' }
        })
        return response.data
    }

    // ============================================
    // Component Discovery
    // ============================================

    /**
     * Get available chat models for assistants
     */
    async getChatModels(unikId: string): Promise<AssistantComponent[]> {
        const response = await this.client.get<AssistantComponent[]>(`/unik/${unikId}/assistants/components/chatmodels`)
        return response.data
    }

    /**
     * Get available document stores for assistants
     */
    async getDocStores(unikId: string): Promise<AssistantComponent[]> {
        const response = await this.client.get<AssistantComponent[]>(`/unik/${unikId}/assistants/components/docstores`)
        return response.data
    }

    /**
     * Get available tools for assistants
     */
    async getTools(unikId: string): Promise<AssistantComponent[]> {
        const response = await this.client.get<AssistantComponent[]>(`/unik/${unikId}/assistants/components/tools`)
        return response.data
    }

    // ============================================
    // AI Generation
    // ============================================

    /**
     * Generate assistant instructions using AI
     *
     * @param unikId - User/organization ID
     * @param payload - Generation parameters with task and selected chat model
     * @returns Generated instructions content
     */
    async generateInstructions(
        unikId: string,
        payload: { task: string; selectedChatModel: { name: string; inputs: Record<string, unknown> } }
    ): Promise<{ content: string }> {
        const response = await this.client.post<{ content: string }>(`/unik/${unikId}/assistants/generate/instruction`, payload)
        return response.data
    }
}

/**
 * Query keys factory for TanStack Query integration
 */
export const assistantQueryKeys = {
    all: ['assistants'] as const,

    lists: () => [...assistantQueryKeys.all, 'list'] as const,
    list: (unikId: string, type?: string) => [...assistantQueryKeys.lists(), { unikId, type }] as const,

    details: () => [...assistantQueryKeys.all, 'detail'] as const,
    detail: (unikId: string, id: string) => [...assistantQueryKeys.details(), { unikId, id }] as const,

    // OpenAI API queries
    openai: () => [...assistantQueryKeys.all, 'openai'] as const,
    openaiList: (unikId: string, credentialId: string) => [...assistantQueryKeys.openai(), 'list', { unikId, credentialId }] as const,
    openaiDetail: (unikId: string, assistantId: string, credentialId: string) =>
        [...assistantQueryKeys.openai(), 'detail', { unikId, assistantId, credentialId }] as const,

    // Vector store queries
    vectorStores: () => [...assistantQueryKeys.all, 'vectorStores'] as const,
    vectorStoreList: (unikId: string, credentialId: string) =>
        [...assistantQueryKeys.vectorStores(), 'list', { unikId, credentialId }] as const,
    vectorStoreDetail: (unikId: string, vectorStoreId: string, credentialId: string) =>
        [...assistantQueryKeys.vectorStores(), 'detail', { unikId, vectorStoreId, credentialId }] as const,

    // Component queries
    components: () => [...assistantQueryKeys.all, 'components'] as const,
    chatModels: (unikId: string) => [...assistantQueryKeys.components(), 'chatModels', { unikId }] as const,
    docStores: (unikId: string) => [...assistantQueryKeys.components(), 'docStores', { unikId }] as const,
    tools: (unikId: string) => [...assistantQueryKeys.components(), 'tools', { unikId }] as const
} as const
