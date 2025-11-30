/**
 * @universo/flowise-chatmessage-srv
 *
 * Interface definitions for ChatMessage domain
 */

/**
 * Message type - using string literal union for compatibility with flowise-server
 */
export type MessageType = 'apiMessage' | 'userMessage'

/**
 * Chat type enum
 */
export enum ChatType {
    INTERNAL = 'INTERNAL',
    EXTERNAL = 'EXTERNAL'
}

/**
 * Chat message rating type
 */
export enum ChatMessageRatingType {
    THUMBS_UP = 'THUMBS_UP',
    THUMBS_DOWN = 'THUMBS_DOWN'
}

/**
 * Chat message interface
 */
export interface IChatMessage {
    id: string
    role: MessageType
    content: string
    canvasId: string
    sourceDocuments?: string
    usedTools?: string
    fileAnnotations?: string
    agentReasoning?: string
    fileUploads?: string
    artifacts?: string
    chatType: string
    chatId: string
    memoryType?: string
    sessionId?: string
    createdDate: Date
    leadEmail?: string
    action?: string | null
    followUpPrompts?: string
}

/**
 * Chat message feedback interface
 */
export interface IChatMessageFeedback {
    id: string
    content?: string
    canvasId: string
    chatId: string
    messageId: string
    rating: ChatMessageRatingType
    createdDate: Date
}

/**
 * Parameters for getting chat messages
 */
export interface GetChatMessageParams {
    canvasId: string
    chatTypes?: ChatType[]
    sortOrder?: string
    chatId?: string
    memoryType?: string
    sessionId?: string
    startDate?: string
    endDate?: string
    messageId?: string
    feedback?: boolean
    feedbackTypes?: ChatMessageRatingType[]
}

/**
 * React Flow Node interface (minimal for controller usage)
 */
export interface IReactFlowNode {
    id: string
    data: {
        name: string
        category: string
        type: string
        label: string
        inputs?: Record<string, unknown>
    }
}

/**
 * React Flow Object interface (minimal for controller usage)
 */
export interface IReactFlowObject {
    nodes: IReactFlowNode[]
    edges: unknown[]
}
