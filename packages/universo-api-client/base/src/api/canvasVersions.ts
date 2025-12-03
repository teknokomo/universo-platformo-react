import type { AxiosInstance } from 'axios'

/**
 * Canvas version types
 */
export interface CanvasVersion {
    id: string
    name: string
    versionGroupId: string
    versionUuid: string
    versionLabel: string
    versionDescription?: string | null
    versionIndex: number
    isActive: boolean
    createdDate: string
    updatedDate: string
    flowData?: string | null
}

export interface CreateCanvasVersionPayload {
    label?: string
    description?: string
    activate?: boolean
}

export interface UpdateCanvasVersionPayload {
    label?: string
    description?: string
}

export interface CanvasVersionsListResponse {
    success: boolean
    data: {
        versions: CanvasVersion[]
    }
}

export interface CanvasVersionResponse {
    success: boolean
    data: CanvasVersion
    message?: string
}

export interface CanvasVersionDeleteResponse {
    success: boolean
    message?: string
}

/**
 * Query keys factory for TanStack Query
 */
export const canvasVersionsQueryKeys = {
    all: ['canvasVersions'] as const,
    list: (unikId: string, spaceId: string, canvasId: string) =>
        [...canvasVersionsQueryKeys.all, 'list', unikId, spaceId, canvasId] as const,
    detail: (unikId: string, spaceId: string, canvasId: string, versionId: string) =>
        [...canvasVersionsQueryKeys.all, 'detail', unikId, spaceId, canvasId, versionId] as const
}

/**
 * Canvas Versions API client
 * Handles canvas version management endpoints
 */
export class CanvasVersionsApi {
    constructor(private client: AxiosInstance) {}

    /**
     * List all versions for a canvas
     */
    async list(unikId: string, spaceId: string, canvasId: string): Promise<CanvasVersionsListResponse> {
        const response = await this.client.get<CanvasVersionsListResponse>(
            `/unik/${unikId}/spaces/${spaceId}/canvases/${canvasId}/versions`
        )
        return response.data
    }

    /**
     * Create a new canvas version
     */
    async create(unikId: string, spaceId: string, canvasId: string, payload: CreateCanvasVersionPayload): Promise<CanvasVersionResponse> {
        const response = await this.client.post<CanvasVersionResponse>(
            `/unik/${unikId}/spaces/${spaceId}/canvases/${canvasId}/versions`,
            payload
        )
        return response.data
    }

    /**
     * Update canvas version metadata
     */
    async update(
        unikId: string,
        spaceId: string,
        canvasId: string,
        versionId: string,
        payload: UpdateCanvasVersionPayload
    ): Promise<CanvasVersionResponse> {
        const response = await this.client.put<CanvasVersionResponse>(
            `/unik/${unikId}/spaces/${spaceId}/canvases/${canvasId}/versions/${versionId}`,
            payload
        )
        return response.data
    }

    /**
     * Activate a canvas version
     */
    async activate(unikId: string, spaceId: string, canvasId: string, versionId: string): Promise<CanvasVersionResponse> {
        const response = await this.client.post<CanvasVersionResponse>(
            `/unik/${unikId}/spaces/${spaceId}/canvases/${canvasId}/versions/${versionId}/activate`
        )
        return response.data
    }

    /**
     * Delete a canvas version
     */
    async remove(unikId: string, spaceId: string, canvasId: string, versionId: string): Promise<CanvasVersionDeleteResponse> {
        const response = await this.client.delete<CanvasVersionDeleteResponse>(
            `/unik/${unikId}/spaces/${spaceId}/canvases/${canvasId}/versions/${versionId}`
        )
        return response.data
    }
}
