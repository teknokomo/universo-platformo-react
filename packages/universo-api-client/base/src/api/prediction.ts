/**
 * PredictionApi
 *
 * API for sending predictions to AgentFlow canvases
 */

import type { AxiosInstance, AxiosResponse } from 'axios'

export interface PredictionInput {
    question?: string
    chatId?: string
    humanInput?: {
        type: 'proceed' | 'reject'
        startNodeId: string
        feedback?: string
    }
    [key: string]: unknown
}

export interface PredictionResponse {
    [key: string]: unknown
}

export class PredictionApi {
    constructor(private readonly client: AxiosInstance) {}

    /**
     * Send a message and get a prediction response
     */
    async sendMessageAndGetPrediction(canvasId: string, input: PredictionInput): Promise<AxiosResponse<PredictionResponse>> {
        return this.client.post<PredictionResponse>(`/internal-prediction/${canvasId}`, input)
    }

    /**
     * Send a message and get a streamed prediction response
     */
    async sendMessageAndStreamPrediction(canvasId: string, input: PredictionInput): Promise<AxiosResponse<PredictionResponse>> {
        return this.client.post<PredictionResponse>(`/internal-prediction/stream/${canvasId}`, input)
    }

    /**
     * Send a message to a public (shared) canvas
     */
    async sendMessageAndGetPredictionPublic(canvasId: string, input: PredictionInput): Promise<AxiosResponse<PredictionResponse>> {
        return this.client.post<PredictionResponse>(`/public-prediction/${canvasId}`, input)
    }
}

/**
 * Query keys factory for TanStack Query integration
 */
export const predictionQueryKeys = {
    all: ['predictions'] as const
} as const

