/**
 * CanvasMessagesApi
 *
 * Canvas/Chat messages API for fetching, deleting and aborting messages
 */

import type { AxiosInstance, AxiosResponse } from 'axios'

export interface CanvasMessageParams {
    order?: 'ASC' | 'DESC'
    feedback?: boolean
    sessionId?: string
    chatType?: string
    memoryType?: string
    chatId?: string
    startDate?: string
    endDate?: string
}

export class CanvasMessagesApi {
    constructor(private readonly client: AxiosInstance) {}

    /**
     * Get internal canvas messages (used for chat popup)
     */
    getInternalCanvasMessages = (canvasId: string, params: CanvasMessageParams = {}): Promise<AxiosResponse> =>
        this.client.get(`/internal-canvas-messages/${canvasId}`, { params: { feedback: true, ...params } })

    /**
     * Get canvas messages (descending order by default)
     */
    getCanvasMessages = (canvasId: string, params: CanvasMessageParams = {}): Promise<AxiosResponse> =>
        this.client.get(`/canvas-messages/${canvasId}`, { params: { order: 'DESC', feedback: true, ...params } })

    /**
     * Get canvas messages in ascending order
     */
    getCanvasMessagesAscending = (canvasId: string, params: CanvasMessageParams = {}): Promise<AxiosResponse> =>
        this.client.get(`/canvas-messages/${canvasId}`, { params: { order: 'ASC', feedback: true, ...params } })

    /**
     * Delete canvas messages
     */
    deleteCanvasMessages = (canvasId: string, params: Record<string, unknown> = {}): Promise<AxiosResponse> =>
        this.client.delete(`/canvas-messages/${canvasId}`, { params: { ...params } })

    /**
     * Get storage path for file uploads
     */
    getStoragePath = (): Promise<AxiosResponse> => this.client.get(`/get-upload-path`)

    /**
     * Abort ongoing canvas message generation
     */
    abortCanvasMessage = (canvasId: string, threadId: string): Promise<AxiosResponse> =>
        this.client.put(`/canvas-messages/abort/${canvasId}/${threadId}`)
}

/**
 * Query keys factory for TanStack Query integration
 */
export const canvasMessagesQueryKeys = {
    all: ['canvas-messages'] as const,
    byCanvas: (canvasId: string) => ['canvas-messages', canvasId] as const,
    internal: (canvasId: string) => ['canvas-messages', 'internal', canvasId] as const,
} as const
