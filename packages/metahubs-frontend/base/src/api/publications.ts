import apiClient from './apiClient'
import type { VersionedLocalizedContent } from '@universo/types'
import type { SimpleLocalizedInput } from '@universo/utils/vlc'
import type { PublicationSchemaStatus } from '../types'

// Re-export for backwards compatibility
export type { PublicationSchemaStatus }

/**
 * Publication (Information Base) entity
 */
export interface Publication {
    id: string
    metahubId: string
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    schemaName: string
    schemaStatus: PublicationSchemaStatus
    schemaError?: string | null
    schemaSyncedAt?: string | null
    createdAt: string
    updatedAt: string
}

/**
 * Response when listing publications
 */
export interface PublicationsListResponse {
    items: Publication[]
    total: number
}

/**
 * Payload for creating a publication
 */
export interface CreatePublicationPayload {
    name?: SimpleLocalizedInput
    description?: SimpleLocalizedInput
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
}

/**
 * Schema diff response
 */
export interface SchemaDiffResponse {
    schemaExists: boolean
    diff: {
        hasChanges?: boolean
        summary: string
        additive: string[]
        destructive: string[]
    }
}

/**
 * Sync response
 */
export interface SchemaSyncResponse {
    status: 'created' | 'synced' | 'migrated' | 'pending_confirmation'
    schemaName?: string
    tablesCreated?: string[]
    changesApplied?: number
    message: string
    diff?: {
        summary: string
        additive: string[]
        destructive: string[]
    }
}

/**
 * List publications for a specific metahub
 */
export const listPublications = async (metahubId: string): Promise<PublicationsListResponse> => {
    const response = await apiClient.get<PublicationsListResponse>(
        `/metahubs/${metahubId}/publications`
    )
    return response.data
}


/**
 * Get a single publication
 */
export const getPublication = async (metahubId: string, publicationId: string): Promise<Publication> => {
    const response = await apiClient.get<Publication>(
        `/metahubs/${metahubId}/publications/${publicationId}`
    )
    return response.data
}

/**
 * Payload for updating a publication
 */
export interface UpdatePublicationPayload {
    name?: SimpleLocalizedInput
    description?: SimpleLocalizedInput
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
}

/**
 * Update a publication (information base)
 */
export const updatePublication = async (
    metahubId: string,
    publicationId: string,
    payload: UpdatePublicationPayload
): Promise<Publication> => {
    const response = await apiClient.patch<Publication>(
        `/metahubs/${metahubId}/publications/${publicationId}`,
        payload
    )
    return response.data
}

/**
 * Create a new publication (information base)
 */
export const createPublication = async (
    metahubId: string,
    payload: CreatePublicationPayload
): Promise<Publication> => {
    const response = await apiClient.post<Publication>(
        `/metahubs/${metahubId}/publications`,
        payload
    )
    return response.data
}

/**
 * Get schema diff without applying changes
 */
export const getPublicationDiff = async (
    metahubId: string,
    publicationId: string
): Promise<SchemaDiffResponse> => {
    const response = await apiClient.get<SchemaDiffResponse>(
        `/metahubs/${metahubId}/publications/${publicationId}/diff`
    )
    return response.data
}

/**
 * Sync publication schema with metahub configuration
 */
export const syncPublication = async (
    metahubId: string,
    publicationId: string,
    confirmDestructive = false
): Promise<SchemaSyncResponse> => {
    const response = await apiClient.post<SchemaSyncResponse>(
        `/metahubs/${metahubId}/publications/${publicationId}/sync`,
        { confirmDestructive }
    )
    return response.data
}


/**
 * Delete a publication and its schema
 */
export const deletePublication = async (
    metahubId: string,
    publicationId: string
): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
        `/metahubs/${metahubId}/publications/${publicationId}`,
        { params: { confirm: 'true' } }
    )
    return response.data
}

