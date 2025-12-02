/**
 * Nodes API Client
 *
 * Manages node components (building blocks for chatflows).
 * Nodes represent various types of AI components like chat models, tools, memory, etc.
 *
 * @example
 * ```typescript
 * import { createUniversoApiClient, nodeQueryKeys } from '@universo/api-client'
 * import { useQuery } from '@tanstack/react-query'
 *
 * const api = createUniversoApiClient({ baseURL: '/api/v1' })
 *
 * // Get all available nodes
 * const { data: nodes } = useQuery({
 *   queryKey: nodeQueryKeys.all,
 *   queryFn: () => api.nodes.getAll()
 * })
 *
 * // Get nodes icon
 * const { data: icon } = useQuery({
 *   queryKey: nodeQueryKeys.icon('chatOpenAI'),
 *   queryFn: () => api.nodes.getIcon('chatOpenAI')
 * })
 * ```
 */

import type { AxiosInstance } from 'axios'
import type { Node } from '../types/component'

export class NodesApi {
    constructor(private readonly client: AxiosInstance) {}

    /**
     * Get all available node components
     * Returns metadata about all nodes that can be used in chatflows
     */
    async getAll(): Promise<Node[]> {
        const response = await this.client.get<Node[]>('/nodes')
        return response.data
    }

    /**
     * Get icon data for a specific node
     *
     * @param nodeName - Name of the node component
     * @returns Icon src and type
     */
    async getIcon(nodeName: string): Promise<string> {
        const response = await this.client.get<string>(`/node-icon/${nodeName}`)
        return response.data
    }

    /**
     * Get a specific node by name
     *
     * @param nodeName - Name of the node component
     * @returns Node component metadata
     */
    async getSpecificNode(nodeName: string): Promise<Node> {
        const response = await this.client.get<Node>(`/nodes/${nodeName}`)
        return response.data
    }

    /**
     * Get nodes filtered by category
     *
     * @param category - Category to filter by (e.g., 'Document Loaders', 'Text Splitters')
     * @returns Array of nodes in the specified category
     */
    async getNodesByCategory(category: string): Promise<Node[]> {
        const response = await this.client.get<Node[]>('/nodes', {
            params: { category }
        })
        return response.data
    }
}

/**
 * Query keys factory for TanStack Query integration
 */
export const nodeQueryKeys = {
    all: ['nodes'] as const,
    list: () => [...nodeQueryKeys.all, 'list'] as const,
    icons: () => [...nodeQueryKeys.all, 'icons'] as const,
    icon: (nodeName: string) => [...nodeQueryKeys.icons(), { nodeName }] as const,
    detail: (nodeName: string) => [...nodeQueryKeys.all, 'detail', nodeName] as const,
    byCategory: (category: string) => [...nodeQueryKeys.all, 'category', category] as const
} as const
