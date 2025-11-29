/**
 * Assistant types for Universo Platformo
 */

/**
 * Type of assistant - CUSTOM (local), OPENAI, or AZURE
 */
export type AssistantType = 'CUSTOM' | 'OPENAI' | 'AZURE'

/**
 * Assistant interface matching the database entity
 */
export interface IAssistant {
    id: string
    details: string
    credential: string
    iconSrc?: string
    type?: AssistantType
    unik_id?: string
    updatedDate: Date
    createdDate: Date
}
