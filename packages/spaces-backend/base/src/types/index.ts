// Spaces System Types

export interface CreateSpaceDto {
    name: string
    description?: string
    visibility?: 'private' | 'public'
    defaultCanvasName?: string
    defaultCanvasFlowData?: string
}

export interface UpdateSpaceDto {
    name?: string
    description?: string
    visibility?: 'private' | 'public'
}

export interface CreateCanvasDto {
    name?: string
    flowData?: string
}

/**
 * Canvas type determines the mode of operation:
 * - CHATFLOW: Standard chat flow canvas
 * - MULTIAGENT: Multi-agent workflow canvas
 * - ASSISTANT: OpenAI Assistant-based canvas
 */
export type CanvasType = 'CHATFLOW' | 'MULTIAGENT' | 'ASSISTANT'

export interface UpdateCanvasDto {
    name?: string
    flowData?: string
    deployed?: boolean
    isPublic?: boolean
    apikeyid?: string
    chatbotConfig?: string
    apiConfig?: string
    analytic?: string
    speechToText?: string
    followUpPrompts?: string
    category?: string
    type?: CanvasType
}

export interface ReorderCanvasesDto {
    canvasOrders: Array<{
        canvasId: string
        sortOrder: number
    }>
}

export interface SpaceResponse {
    id: string
    name: string
    description?: string
    visibility: string
    canvasCount?: number
    createdDate: Date
    updatedDate: Date
    defaultCanvas?: CanvasResponse
    // Versioning fields
    versionGroupId: string
    versionUuid: string
    versionLabel: string
    versionDescription?: string
    versionIndex: number
    // System status fields
    isActive: boolean
    isPublished: boolean
    isDeleted: boolean
    deletedDate?: Date
    deletedBy?: string
}

export interface SpaceDetailsResponse extends SpaceResponse {
    canvases: CanvasResponse[]
}

export interface CanvasResponse {
    id: string
    name: string
    sortOrder: number
    flowData: string
    deployed?: boolean
    isPublic?: boolean
    apikeyid?: string
    chatbotConfig?: string
    apiConfig?: string
    analytic?: string
    speechToText?: string
    followUpPrompts?: string
    category?: string
    type?: CanvasType
    createdDate: Date
    updatedDate: Date
    // Versioning fields
    versionGroupId: string
    versionUuid: string
    versionLabel: string
    versionDescription?: string
    versionIndex: number
    // System status fields
    isActive: boolean
    isPublished: boolean
    isDeleted: boolean
    deletedDate?: Date
    deletedBy?: string
}

export interface ApiResponse<T = any> {
    success: boolean
    data?: T
    message?: string
    error?: string
}

export interface SpacesListResponse {
    spaces: SpaceResponse[]
}

export interface CanvasesListResponse {
    canvases: CanvasResponse[]
}

export interface CanvasVersionResponse {
    id: string
    versionGroupId: string
    versionUuid: string
    versionLabel: string
    versionDescription?: string
    versionIndex: number
    isActive: boolean
    createdDate: Date
    updatedDate: Date
}

export interface CreateCanvasVersionDto {
    label?: string
    description?: string
    activate?: boolean
}

export interface UpdateCanvasVersionDto {
    label?: string
    description?: string
}
