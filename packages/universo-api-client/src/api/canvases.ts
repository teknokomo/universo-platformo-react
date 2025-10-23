import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import type {
    Canvas,
    CreateCanvasPayload,
    UpdateCanvasPayload,
    CanvasListResponse,
    ReorderCanvasPayload,
    CanvasRequestOptions,
} from '../types/canvas'

/**
 * Helper functions for canvas API
 */
const normalizeIdentifier = (value: string | null | undefined): string | null => {
    if (value === null || value === undefined) return null
    const normalized = String(value).trim()
    return normalized.length ? normalized : null
}

const ensureIdentifier = (value: string | null | undefined, field: string, method: string): string => {
    const normalized = normalizeIdentifier(value)
    if (!normalized) {
        throw new Error(`CanvasesApi.${method} requires a valid ${field}`)
    }
    return normalized
}

const buildCanvasPath = (unikId: string, canvasId: string, spaceId: string | null, suffix = ''): string => {
    const base = spaceId
        ? `/unik/${unikId}/spaces/${spaceId}/canvases/${canvasId}`
        : `/unik/${unikId}/canvases/${canvasId}`
    return `${base}${suffix}`
}

const buildParamsConfig = (params?: Record<string, unknown>): { params: Record<string, unknown> } | undefined => {
    if (!params || Object.keys(params).length === 0) return undefined
    return { params }
}

const resolveRequestOptions = (options?: CanvasRequestOptions): {
    spaceId: string | null
    config?: AxiosRequestConfig
} => {
    if (!options) return { spaceId: null, config: undefined }
    const hasSpaceId = Object.prototype.hasOwnProperty.call(options, 'spaceId')
    const hasConfig = Object.prototype.hasOwnProperty.call(options, 'config')
    if (hasSpaceId || hasConfig) {
        return {
            spaceId: options.spaceId ?? null,
            config: options.config as AxiosRequestConfig,
        }
    }
    return { spaceId: null, config: options as AxiosRequestConfig }
}

/**
 * Canvas API client
 * Handles all canvas (chatflow/workflow) related endpoints
 */
export class CanvasesApi {
    constructor(private client: AxiosInstance) {}

    /**
     * Get all canvases for a space
     */
    async getCanvases(unikId: string, spaceId: string, params?: Record<string, unknown>): Promise<CanvasListResponse> {
        const resolvedUnikId = ensureIdentifier(unikId, 'unikId', 'getCanvases')
        const resolvedSpaceId = ensureIdentifier(spaceId, 'spaceId', 'getCanvases')
        const response = await this.client.get<CanvasListResponse>(
            `/unik/${resolvedUnikId}/spaces/${resolvedSpaceId}/canvases`,
            buildParamsConfig(params)
        )
        return response.data
    }

    /**
     * Get single canvas by ID
     */
    async getCanvas(unikId: string, canvasId: string, options?: CanvasRequestOptions): Promise<Canvas> {
        const resolvedUnikId = ensureIdentifier(unikId, 'unikId', 'getCanvas')
        const resolvedCanvasId = ensureIdentifier(canvasId, 'canvasId', 'getCanvas')
        const { spaceId, config } = resolveRequestOptions(options)
        const resolvedSpaceId = normalizeIdentifier(spaceId)
        const response = await this.client.get<Canvas>(
            buildCanvasPath(resolvedUnikId, resolvedCanvasId, resolvedSpaceId),
            config
        )
        return response.data
    }

    /**
     * Get canvas by ID (without unik context)
     */
    async getCanvasById(canvasId: string, config?: AxiosRequestConfig): Promise<Canvas> {
        const response = await this.client.get<Canvas>(`/canvases/${canvasId}`, config)
        return response.data
    }

    /**
     * Get public canvas
     */
    async getPublicCanvas(canvasId: string, config?: AxiosRequestConfig): Promise<Canvas> {
        const response = await this.client.get<Canvas>(`/public/canvases/${canvasId}`, config)
        return response.data
    }

    /**
     * Create new canvas
     */
    async createCanvas(unikId: string, spaceId: string, body: CreateCanvasPayload): Promise<Canvas> {
        const resolvedUnikId = ensureIdentifier(unikId, 'unikId', 'createCanvas')
        const resolvedSpaceId = ensureIdentifier(spaceId, 'spaceId', 'createCanvas')
        const response = await this.client.post<Canvas>(
            `/unik/${resolvedUnikId}/spaces/${resolvedSpaceId}/canvases`,
            body
        )
        return response.data
    }

    /**
     * Update existing canvas
     */
    async updateCanvas(
        unikId: string,
        canvasId: string,
        body: UpdateCanvasPayload,
        options?: CanvasRequestOptions
    ): Promise<Canvas> {
        const resolvedUnikId = ensureIdentifier(unikId, 'unikId', 'updateCanvas')
        const resolvedCanvasId = ensureIdentifier(canvasId, 'canvasId', 'updateCanvas')
        const resolvedSpaceId = normalizeIdentifier(options?.spaceId)
        const response = await this.client.put<Canvas>(
            buildCanvasPath(resolvedUnikId, resolvedCanvasId, resolvedSpaceId),
            body
        )
        return response.data
    }

    /**
     * Delete canvas
     */
    async deleteCanvas(unikId: string, canvasId: string, options?: CanvasRequestOptions): Promise<void> {
        const resolvedUnikId = ensureIdentifier(unikId, 'unikId', 'deleteCanvas')
        const resolvedCanvasId = ensureIdentifier(canvasId, 'canvasId', 'deleteCanvas')
        const resolvedSpaceId = normalizeIdentifier(options?.spaceId)
        await this.client.delete(buildCanvasPath(resolvedUnikId, resolvedCanvasId, resolvedSpaceId))
    }

    /**
     * Reorder canvases in a space
     */
    async reorderCanvases(unikId: string, spaceId: string, body: ReorderCanvasPayload): Promise<void> {
        const resolvedUnikId = ensureIdentifier(unikId, 'unikId', 'reorderCanvases')
        const resolvedSpaceId = ensureIdentifier(spaceId, 'spaceId', 'reorderCanvases')
        await this.client.put(`/unik/${resolvedUnikId}/spaces/${resolvedSpaceId}/canvases/reorder`, body)
    }

    /**
     * Duplicate canvas
     */
    async duplicateCanvas(unikId: string, canvasId: string, options?: CanvasRequestOptions): Promise<Canvas> {
        const resolvedUnikId = ensureIdentifier(unikId, 'unikId', 'duplicateCanvas')
        const resolvedCanvasId = ensureIdentifier(canvasId, 'canvasId', 'duplicateCanvas')
        const resolvedSpaceId = normalizeIdentifier(options?.spaceId)
        const response = await this.client.post<Canvas>(
            `${buildCanvasPath(resolvedUnikId, resolvedCanvasId, resolvedSpaceId)}/duplicate`
        )
        return response.data
    }

    /**
     * Export canvas
     */
    async exportCanvas(unikId: string, canvasId: string, options?: CanvasRequestOptions): Promise<unknown> {
        const resolvedUnikId = ensureIdentifier(unikId, 'unikId', 'exportCanvas')
        const resolvedCanvasId = ensureIdentifier(canvasId, 'canvasId', 'exportCanvas')
        const { spaceId, config } = resolveRequestOptions(options)
        const resolvedSpaceId = normalizeIdentifier(spaceId)
        const response = await this.client.get(
            `${buildCanvasPath(resolvedUnikId, resolvedCanvasId, resolvedSpaceId)}/export`,
            config
        )
        return response.data
    }

    /**
     * Import canvas
     */
    async importCanvas(unikId: string, spaceId: string, body: unknown): Promise<Canvas> {
        const resolvedUnikId = ensureIdentifier(unikId, 'unikId', 'importCanvas')
        const resolvedSpaceId = ensureIdentifier(spaceId, 'spaceId', 'importCanvas')
        const response = await this.client.post<Canvas>(
            `/unik/${resolvedUnikId}/spaces/${resolvedSpaceId}/canvases/import`,
            body
        )
        return response.data
    }

    /**
     * Get canvas version
     */
    async getCanvasVersion(canvasId: string, versionId: string): Promise<unknown> {
        const response = await this.client.get(`/canvases/${canvasId}/versions/${versionId}`)
        return response.data
    }
}

/**
 * Query keys factory for TanStack Query integration
 */
export const canvasQueryKeys = {
    all: ['canvases'] as const,
    lists: () => [...canvasQueryKeys.all, 'list'] as const,
    list: (unikId: string, spaceId: string) => [...canvasQueryKeys.lists(), { unikId, spaceId }] as const,
    details: () => [...canvasQueryKeys.all, 'detail'] as const,
    detail: (unikId: string, canvasId: string, spaceId?: string | null) =>
        [...canvasQueryKeys.details(), { unikId, canvasId, spaceId }] as const,
    byId: (canvasId: string) => [...canvasQueryKeys.details(), 'byId', canvasId] as const,
    public: (canvasId: string) => [...canvasQueryKeys.all, 'public', canvasId] as const,
    version: (canvasId: string, versionId: string) =>
        [...canvasQueryKeys.all, 'version', { canvasId, versionId }] as const,
}
