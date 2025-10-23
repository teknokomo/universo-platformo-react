/**
 * Canvas (Chatflow/Workflow) types
 */

export interface Canvas {
    id: string
    name: string
    deployed: boolean
    isPublic: boolean
    apikeyid: string | null
    chatbotConfig: string | null
    analytic: string | null
    speechToText: string | null
    category: string | null
    type: string | null
    createdDate: string
    updatedDate: string
    flowData: string | null
    apiConfig: string | null
    followUpPrompts: string | null
    unikId?: string
    unik_id?: string
    spaceId?: string | null
    space_id?: string | null
}

export interface CreateCanvasPayload {
    name: string
    deployed?: boolean
    isPublic?: boolean
    type?: string
    category?: string
    flowData?: string | object
    chatbotConfig?: string | object
    apiConfig?: string | object
}

export interface UpdateCanvasPayload extends Partial<CreateCanvasPayload> {
    id?: string
    analytic?: string | null
    speechToText?: string | null
    followUpPrompts?: string | null
}

export interface CanvasListResponse {
    canvases?: Canvas[]
    data?: Canvas[]
    total?: number
}

export interface ReorderCanvasPayload {
    canvases: Array<{
        id: string
        order: number
    }>
}

export interface CanvasRequestOptions {
    spaceId?: string | null
    config?: Record<string, unknown>
}
