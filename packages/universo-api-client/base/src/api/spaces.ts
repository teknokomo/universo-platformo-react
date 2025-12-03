/**
 * Spaces API Client
 *
 * Manages workspaces (spaces) for organizing canvases.
 * Each user can have multiple spaces for different projects.
 *
 * @example
 * ```typescript
 * import { createUniversoApiClient, spaceQueryKeys } from '@universo/api-client'
 * import { useQuery } from '@tanstack/react-query'
 *
 * const api = createUniversoApiClient({ baseURL: '/api/v1' })
 *
 * // Get all spaces
 * const { data: spaces } = useQuery({
 *   queryKey: spaceQueryKeys.list(unikId),
 *   queryFn: () => api.spaces.getAll(unikId)
 * })
 * ```
 */

import type { AxiosInstance } from 'axios'
import type { Space, CreateSpacePayload, UpdateSpacePayload } from '../types/space'

export class SpacesApi {
    constructor(private readonly client: AxiosInstance) {}

    /**
     * Get all spaces for user
     */
    async getAll(unikId: string): Promise<Space[]> {
        const response = await this.client.get<Space[]>(`/unik/${unikId}/spaces`)
        return response.data
    }

    /**
     * Get specific space by ID
     */
    async getById(unikId: string, spaceId: string): Promise<Space> {
        const response = await this.client.get<Space>(`/unik/${unikId}/spaces/${spaceId}`)
        return response.data
    }

    /**
     * Create new space
     */
    async create(unikId: string, payload: CreateSpacePayload): Promise<Space> {
        const response = await this.client.post<Space>(`/unik/${unikId}/spaces`, payload)
        return response.data
    }

    /**
     * Update space
     */
    async update(unikId: string, spaceId: string, payload: UpdateSpacePayload): Promise<Space> {
        const response = await this.client.put<Space>(`/unik/${unikId}/spaces/${spaceId}`, payload)
        return response.data
    }

    /**
     * Delete space
     */
    async delete(unikId: string, spaceId: string): Promise<void> {
        await this.client.delete(`/unik/${unikId}/spaces/${spaceId}`)
    }
}

/**
 * Query keys factory for TanStack Query integration
 */
export const spaceQueryKeys = {
    all: ['spaces'] as const,
    lists: () => [...spaceQueryKeys.all, 'list'] as const,
    list: (unikId: string) => [...spaceQueryKeys.lists(), { unikId }] as const,
    details: () => [...spaceQueryKeys.all, 'detail'] as const,
    detail: (unikId: string, spaceId: string) => [...spaceQueryKeys.details(), { unikId, spaceId }] as const
} as const
