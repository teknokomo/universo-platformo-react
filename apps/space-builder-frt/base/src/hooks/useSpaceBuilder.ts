export type SelectedChatModel = { provider: string; modelName: string; credentialId?: string }

export interface QuizPlan {
    items: Array<{ question: string; answers: Array<{ text: string; isCorrect: boolean }> }>
}

export interface PreparePayload {
    sourceText: string
    selectedChatModel: SelectedChatModel
    options: { questionsCount: number; answersPerQuestion: number }
    additionalConditions?: string
}

export interface GenerateFlowPayload {
    question?: string
    selectedChatModel: SelectedChatModel
    quizPlan?: QuizPlan
    options?: {
        includeStartCollectName: boolean
        includeEndScore: boolean
        generateAnswerGraphics: boolean
    }
}

export interface GeneratedFlowResponse {
    nodes: unknown[]
    edges: unknown[]
}

export class SpaceBuilderHttpError<T = unknown> extends Error {
    status: number
    data?: T
    rawBody?: string

    constructor(message: string, options: { status: number; data?: T; rawBody?: string }) {
        super(message)
        this.name = 'SpaceBuilderHttpError'
        this.status = options.status
        this.data = options.data
        this.rawBody = options.rawBody
    }
}

export interface NormalizeManualQuizPayload {
    rawText: string
    selectedChatModel: SelectedChatModel
    fallbackToLLM?: boolean
}

import apiClient from '../api/client'

export function useSpaceBuilder() {
    async function callApi<T = any>(relativePath: string, body: unknown): Promise<T> {
        try {
            const { data } = await apiClient.post<T>(relativePath, body)
            return data
        } catch (error: any) {
            const status = error?.response?.status ?? 0
            const responseData = error?.response?.data
            const rawBody =
                typeof responseData === 'string'
                    ? responseData
                    : responseData
                    ? JSON.stringify(responseData)
                    : undefined
            const message =
                responseData && typeof responseData === 'object' && typeof responseData.message === 'string'
                    ? responseData.message
                    : rawBody || `Request failed: ${status || 'unknown'}`
            if (status) {
                throw new SpaceBuilderHttpError(message, { status, data: responseData, rawBody })
            }
            throw error
        }
    }

    async function prepareQuiz(payload: PreparePayload): Promise<QuizPlan> {
        const data = await callApi<{ quizPlan: QuizPlan }>('space-builder/prepare', payload)
        return data.quizPlan
    }

    async function reviseQuiz(payload: {
        quizPlan: QuizPlan
        instructions: string
        selectedChatModel: SelectedChatModel
    }): Promise<QuizPlan> {
        const data = await callApi<{ quizPlan: QuizPlan }>('space-builder/revise', payload)
        return data.quizPlan
    }

    async function generateFlow(payload: GenerateFlowPayload): Promise<GeneratedFlowResponse> {
        return callApi<GeneratedFlowResponse>('space-builder/generate', payload)
    }

    async function normalizeManualQuiz(payload: NormalizeManualQuizPayload): Promise<QuizPlan> {
        const data = await callApi<{ quizPlan: QuizPlan }>('space-builder/manual', payload)
        return data.quizPlan
    }

    return { prepareQuiz, reviseQuiz, generateFlow, normalizeManualQuiz }
}
