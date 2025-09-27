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

export function useSpaceBuilder() {
    async function callWithRefresh<T = any>(path: string, body: unknown): Promise<T> {
        const token = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || ''
        const call = async (bearer?: string) =>
            fetch(path, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(bearer ? { Authorization: `Bearer ${bearer}` } : {})
                },
                credentials: 'include',
                body: JSON.stringify(body)
            })

        let res = await call(token)
        if (res.status === 401) {
            try {
                await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
            } catch (_) {
                /* ignore refresh errors */
            }
            const newToken = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || token
            res = await call(newToken)
        }

        const ct = res.headers.get('content-type') || ''
        if (!res.ok) {
            const rawBody = await res.text().catch(() => '')
            let data: unknown
            if (rawBody && ct.includes('application/json')) {
                try {
                    data = JSON.parse(rawBody)
                } catch (_) {
                    // keep raw body as-is when JSON parsing fails
                }
            }
            const message =
                data && typeof data === 'object' && 'message' in data && typeof (data as any).message === 'string'
                    ? (data as any).message
                    : rawBody || `Request failed: ${res.status}`
            throw new SpaceBuilderHttpError(message, { status: res.status, data, rawBody: rawBody || undefined })
        }
        if (!ct.includes('application/json')) {
            const text = await res.text().catch(() => '')
            const snippet = text ? ` | ${text.slice(0, 200)}` : ''
            throw new SpaceBuilderHttpError(`Bad response type: ${ct || 'unknown'}${snippet}`, {
                status: res.status,
                rawBody: text || undefined
            })
        }
        return (await res.json()) as T
    }

    async function prepareQuiz(payload: PreparePayload): Promise<QuizPlan> {
        const data = await callWithRefresh<{ quizPlan: QuizPlan }>('/api/v1/space-builder/prepare', payload)
        return data.quizPlan
    }

    async function reviseQuiz(payload: {
        quizPlan: QuizPlan
        instructions: string
        selectedChatModel: SelectedChatModel
    }): Promise<QuizPlan> {
        const data = await callWithRefresh<{ quizPlan: QuizPlan }>('/api/v1/space-builder/revise', payload)
        return data.quizPlan
    }

    async function generateFlow(payload: GenerateFlowPayload): Promise<GeneratedFlowResponse> {
        return callWithRefresh<GeneratedFlowResponse>('/api/v1/space-builder/generate', payload)
    }

    async function normalizeManualQuiz(payload: NormalizeManualQuizPayload): Promise<QuizPlan> {
        const data = await callWithRefresh<{ quizPlan: QuizPlan }>('/api/v1/space-builder/manual', payload)
        return data.quizPlan
    }

    return { prepareQuiz, reviseQuiz, generateFlow, normalizeManualQuiz }
}
