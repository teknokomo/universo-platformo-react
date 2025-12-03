/**
 * Space types
 */

import type { UnikEntity } from './common'

/**
 * Space (workspace) entity
 */
export interface Space extends UnikEntity {
    readonly name: string
    readonly description?: string
    readonly icon?: string
    readonly isDefault?: boolean
    readonly order?: number
}

/**
 * Payload for creating new space
 */
export interface CreateSpacePayload {
    readonly name: string
    readonly description?: string
    readonly icon?: string
}

/**
 * Payload for updating space
 */
export interface UpdateSpacePayload {
    readonly name?: string
    readonly description?: string
    readonly icon?: string
    readonly order?: number
}
