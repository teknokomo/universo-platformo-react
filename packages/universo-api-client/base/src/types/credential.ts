/**
 * Credential types for external service authentication
 * (OpenAI, Google, Anthropic, etc.)
 */

import type { UnikEntity } from './common'

/**
 * User credential for external service
 */
export interface Credential extends UnikEntity {
    readonly name: string
    readonly credentialName: string
    readonly encryptedData: string
}

/**
 * Credential component schema definition
 * Describes available inputs for a credential type
 */
export interface CredentialComponent {
    readonly label: string
    readonly name: string
    readonly version: number
    readonly description: string
    readonly inputs: readonly CredentialInput[]
    readonly icon?: string
}

/**
 * Input field definition in credential component
 */
export interface CredentialInput {
    readonly label: string
    readonly name: string
    readonly type: 'string' | 'password' | 'number' | 'boolean' | 'file' | 'folder' | 'options'
    readonly placeholder?: string
    readonly description?: string
    readonly default?: unknown
    readonly optional?: boolean
    readonly rows?: number
    readonly options?: readonly { label: string; name: string }[]
}

/**
 * Payload for creating new credential
 */
export interface CreateCredentialPayload {
    readonly name: string
    readonly credentialName: string
    readonly plainDataObj: Record<string, unknown>
}

/**
 * Payload for updating existing credential
 */
export interface UpdateCredentialPayload {
    readonly name?: string
    readonly plainDataObj?: Record<string, unknown>
}
