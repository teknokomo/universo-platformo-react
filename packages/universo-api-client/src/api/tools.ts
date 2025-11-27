/**
 * Tools API Client
 * 
 * Manages custom tool components that are scoped to a Unik.
 * Tools are reusable function wrappers that can be used in agents and chains.
 * 
 * @example
 * ```typescript
 * import { createUniversoApiClient, toolQueryKeys } from '@universo/api-client'
 * import { useQuery } from '@tanstack/react-query'
 * 
 * const api = createUniversoApiClient({ baseURL: '/api/v1' })
 * 
 * // Get all tools for a Unik
 * const { data: tools } = useQuery({
 *   queryKey: toolQueryKeys.list(unikId),
 *   queryFn: () => api.tools.getAllTools(unikId)
 * })
 * ```
 */

import type { AxiosInstance, AxiosResponse } from 'axios'

/** Custom Tool entity from the database */
export interface CustomTool {
    id: string
    name: string
    description: string
    color: string
    iconSrc?: string
    schema?: string
    func?: string
    createdDate: string
    updatedDate: string
}

/** Request body for creating a new tool */
export interface CreateToolBody {
    name: string
    description: string
    color: string
    iconSrc?: string
    schema?: string
    func?: string
}

/** Request body for updating an existing tool */
export interface UpdateToolBody {
    name?: string
    description?: string
    color?: string
    iconSrc?: string
    schema?: string
    func?: string
}

export class ToolsApi {
    constructor(private readonly client: AxiosInstance) {}

    /**
     * Get all custom tools for a specific Unik
     * @param unikId - The ID of the Unik
     */
    async getAllTools(unikId: string): Promise<AxiosResponse<CustomTool[]>> {
        return this.client.get<CustomTool[]>(`/unik/${unikId}/tools`)
    }

    /**
     * Get a specific tool by ID
     * @param unikId - The ID of the Unik
     * @param id - The ID of the tool
     */
    async getSpecificTool(unikId: string, id: string): Promise<AxiosResponse<CustomTool>> {
        return this.client.get<CustomTool>(`/unik/${unikId}/tools/${id}`)
    }

    /**
     * Create a new tool
     * @param unikId - The ID of the Unik
     * @param body - Tool creation data
     */
    async createNewTool(unikId: string, body: CreateToolBody): Promise<AxiosResponse<CustomTool>> {
        return this.client.post<CustomTool>(`/unik/${unikId}/tools`, body)
    }

    /**
     * Update an existing tool
     * @param unikId - The ID of the Unik
     * @param id - The ID of the tool
     * @param body - Tool update data
     */
    async updateTool(unikId: string, id: string, body: UpdateToolBody): Promise<AxiosResponse<CustomTool>> {
        return this.client.put<CustomTool>(`/unik/${unikId}/tools/${id}`, body)
    }

    /**
     * Delete a tool
     * @param unikId - The ID of the Unik
     * @param id - The ID of the tool
     */
    async deleteTool(unikId: string, id: string): Promise<AxiosResponse<void>> {
        return this.client.delete(`/unik/${unikId}/tools/${id}`)
    }
}

/**
 * Query keys factory for TanStack Query integration
 */
export const toolQueryKeys = {
    all: ['tools'] as const,
    list: (unikId: string) => [...toolQueryKeys.all, 'list', unikId] as const,
    detail: (unikId: string, id: string) => [...toolQueryKeys.all, 'detail', unikId, id] as const,
} as const
