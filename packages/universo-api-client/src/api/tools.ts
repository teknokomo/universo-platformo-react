/**
 * Tools API Client
 * 
 * Manages tool components available in the system.
 * Tools are reusable function wrappers that can be used in agents and chains.
 * 
 * @example
 * ```typescript
 * import { createUniversoApiClient, toolQueryKeys } from '@universo/api-client'
 * import { useQuery } from '@tanstack/react-query'
 * 
 * const api = createUniversoApiClient({ baseURL: '/api/v1' })
 * 
 * // Get all available tools
 * const { data: tools } = useQuery({
 *   queryKey: toolQueryKeys.all,
 *   queryFn: () => api.tools.getAll()
 * })
 * ```
 */

import type { AxiosInstance } from 'axios'
import type { Tool } from '../types/component'

export class ToolsApi {
    constructor(private readonly client: AxiosInstance) {}

    /**
     * Get all available tool components
     * Returns metadata about tools that can be used in the system
     */
    async getAll(): Promise<Tool[]> {
        const response = await this.client.get<Tool[]>('/tools')
        return response.data
    }
}

/**
 * Query keys factory for TanStack Query integration
 */
export const toolQueryKeys = {
    all: ['tools'] as const,
    list: () => [...toolQueryKeys.all, 'list'] as const,
} as const
