/**
 * OpenAI Assistant types
 */

import type { UnikEntity } from './common'

/**
 * OpenAI Assistant entity
 */
export interface Assistant extends UnikEntity {
    readonly name: string
    readonly description?: string
    readonly type: 'OPENAI' | 'CUSTOM'
    readonly details: AssistantDetails
}

/**
 * Assistant configuration details
 */
export interface AssistantDetails {
    readonly assistantId?: string
    readonly model?: string
    readonly instructions?: string
    readonly tools?: readonly AssistantTool[]
    readonly fileIds?: readonly string[]
    readonly metadata?: Record<string, unknown>
}

/**
 * Assistant tool configuration
 */
export interface AssistantTool {
    readonly type: 'code_interpreter' | 'retrieval' | 'function'
    readonly function?: {
        readonly name: string
        readonly description?: string
        readonly parameters?: Record<string, unknown>
    }
}

/**
 * OpenAI Assistant object (from OpenAI API)
 */
export interface OpenAIAssistant {
    readonly id: string
    readonly object: 'assistant'
    readonly created_at: number
    readonly name: string | null
    readonly description: string | null
    readonly model: string
    readonly instructions: string | null
    readonly tools: readonly AssistantTool[]
    readonly file_ids: readonly string[]
    readonly metadata: Record<string, unknown>
}

/**
 * OpenAI Vector Store
 */
export interface VectorStore {
    readonly id: string
    readonly object: 'vector_store'
    readonly created_at: number
    readonly name: string
    readonly usage_bytes: number
    readonly file_counts: {
        readonly in_progress: number
        readonly completed: number
        readonly failed: number
        readonly cancelled: number
        readonly total: number
    }
    readonly status: 'expired' | 'in_progress' | 'completed'
    readonly expires_at?: number
    readonly expires_after?: {
        readonly anchor: 'last_active_at'
        readonly days: number
    }
    readonly metadata: Record<string, unknown>
}

/**
 * OpenAI File object
 */
export interface OpenAIFile {
    readonly id: string
    readonly object: 'file'
    readonly bytes: number
    readonly created_at: number
    readonly filename: string
    readonly purpose: string
    readonly status?: 'uploaded' | 'processed' | 'error'
    readonly status_details?: string
}

/**
 * Payload for creating new assistant
 */
export interface CreateAssistantPayload {
    readonly name: string
    readonly description?: string
    readonly type: 'OPENAI' | 'CUSTOM'
    readonly details: Partial<AssistantDetails>
}

/**
 * Payload for updating assistant
 */
export interface UpdateAssistantPayload {
    readonly name?: string
    readonly description?: string
    readonly details?: Partial<AssistantDetails>
}

/**
 * Payload for creating vector store
 */
export interface CreateVectorStorePayload {
    readonly name: string
    readonly file_ids?: readonly string[]
    readonly expires_after?: {
        readonly anchor: 'last_active_at'
        readonly days: number
    }
    readonly metadata?: Record<string, unknown>
}

/**
 * Payload for updating vector store
 */
export interface UpdateVectorStorePayload {
    readonly name?: string
    readonly expires_after?: {
        readonly anchor: 'last_active_at'
        readonly days: number
    }
    readonly metadata?: Record<string, unknown>
}

/**
 * Component option for assistant configuration
 */
export interface AssistantComponent {
    readonly name: string
    readonly label: string
    readonly description?: string
    readonly category: 'chat_models' | 'document_stores' | 'tools'
}
