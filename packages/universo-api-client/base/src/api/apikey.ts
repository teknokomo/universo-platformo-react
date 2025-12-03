/**
 * ApiKey API Client
 *
 * Manages API keys for accessing Flowise endpoints.
 * Supports CRUD operations and batch import functionality.
 *
 * @example
 * ```typescript
 * import { createUniversoApiClient, apikeyQueryKeys } from '@universo/api-client'
 * import { useQuery, useMutation } from '@tanstack/react-query'
 *
 * const api = createUniversoApiClient({ baseURL: '/api/v1' })
 *
 * // Get all API keys
 * const { data: apiKeys } = useQuery({
 *   queryKey: apikeyQueryKeys.list(unikId),
 *   queryFn: () => api.apiKeys.getAllAPIKeys(unikId)
 * })
 *
 * // Create new API key
 * const createMutation = useMutation({
 *   mutationFn: (keyName) => api.apiKeys.createNewAPI(unikId, { keyName }),
 *   onSuccess: () => {
 *     queryClient.invalidateQueries({ queryKey: apikeyQueryKeys.list(unikId) })
 *   }
 * })
 * ```
 */

import type { AxiosInstance } from 'axios'

/**
 * API Key entity returned from backend
 */
export interface ApiKey {
    id: string
    keyName: string
    apiKey: string
    apiSecret: string
    updatedDate: string
    chatFlows?: {
        flowName: string
        updatedDate: string
        category?: string
    }[]
}

/**
 * Payload for creating a new API key
 */
export interface CreateApiKeyPayload {
    keyName: string
}

/**
 * Payload for updating an API key
 */
export interface UpdateApiKeyPayload {
    keyName: string
}

/**
 * Payload for importing API keys
 */
export interface ImportApiKeysPayload {
    jsonFile: string
    importMode: 'overwriteIfExist' | 'ignoreIfExist' | 'errorIfExist' | 'replaceAll'
}

export class ApiKeyApi {
    constructor(private readonly client: AxiosInstance) {}

    /**
     * Get all API keys for a Unik
     */
    async getAllAPIKeys(unikId: string): Promise<ApiKey[]> {
        const response = await this.client.get<ApiKey[]>(`/unik/${unikId}/apikey`)
        return response.data
    }

    /**
     * Create a new API key
     */
    async createNewAPI(unikId: string, payload: CreateApiKeyPayload): Promise<ApiKey[]> {
        const response = await this.client.post<ApiKey[]>(`/unik/${unikId}/apikey`, payload)
        return response.data
    }

    /**
     * Update an existing API key
     */
    async updateAPI(unikId: string, id: string, payload: UpdateApiKeyPayload): Promise<ApiKey[]> {
        const response = await this.client.put<ApiKey[]>(`/unik/${unikId}/apikey/${id}`, payload)
        return response.data
    }

    /**
     * Delete an API key
     */
    async deleteAPI(unikId: string, id: string): Promise<ApiKey[]> {
        const response = await this.client.delete<ApiKey[]>(`/unik/${unikId}/apikey/${id}`)
        return response.data
    }

    /**
     * Import API keys from JSON file
     */
    async importAPI(unikId: string, payload: ImportApiKeysPayload): Promise<ApiKey[]> {
        const response = await this.client.post<ApiKey[]>(`/unik/${unikId}/apikey/import`, payload)
        return response.data
    }
}

/**
 * Query keys factory for TanStack Query integration
 *
 * Provides type-safe, normalized cache keys for API key queries.
 *
 * @example
 * ```typescript
 * // List all API keys
 * useQuery({
 *   queryKey: apikeyQueryKeys.list(unikId),
 *   queryFn: () => api.apiKeys.getAllAPIKeys(unikId)
 * })
 *
 * // Invalidate after mutation
 * queryClient.invalidateQueries({
 *   queryKey: apikeyQueryKeys.list(unikId)
 * })
 * ```
 */
export const apikeyQueryKeys = {
    /** Base key for all API key queries */
    all: ['apikeys'] as const,

    /** All list queries */
    lists: () => [...apikeyQueryKeys.all, 'list'] as const,

    /** API key list for specific Unik */
    list: (unikId: string) => [...apikeyQueryKeys.lists(), { unikId }] as const
} as const
