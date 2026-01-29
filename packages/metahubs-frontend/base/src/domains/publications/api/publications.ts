import { apiClient } from '../../shared'
import type { VersionedLocalizedContent } from '@universo/types'
import type { SimpleLocalizedInput } from '@universo/utils/vlc'
import type { PublicationSchemaStatus } from '../../../types'

// Re-export for backwards compatibility
export type { PublicationSchemaStatus }

/**
 * Access mode for publication
 */
export type PublicationAccessMode = 'full' | 'restricted'

/**
 * Publication (Information Base) entity
 */
export interface Publication {
    id: string
    metahubId: string
    connectorId?: string // Legacy field, kept for backwards compatibility
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    accessMode?: PublicationAccessMode
    accessConfig?: Record<string, unknown> | null
    schemaName: string
    schemaStatus: PublicationSchemaStatus
    schemaError?: string | null
    schemaSyncedAt?: string | null
    autoCreateApplication?: boolean
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
    autoCreateApplication?: boolean
    versionName?: SimpleLocalizedInput
    versionDescription?: SimpleLocalizedInput
    versionNamePrimaryLocale?: string
    versionDescriptionPrimaryLocale?: string
    versionBranchId?: string
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
        `/metahub/${metahubId}/publications`
    )
    return response.data
}


/**
 * Get a single publication
 */
export const getPublication = async (metahubId: string, publicationId: string): Promise<Publication> => {
    const response = await apiClient.get<Publication>(
        `/metahub/${metahubId}/publication/${publicationId}`
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
    expectedVersion?: number
}

/**
 * Update a publication (information base)
 * @param payload.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updatePublication = async (
    metahubId: string,
    publicationId: string,
    payload: UpdatePublicationPayload
): Promise<Publication> => {
    const response = await apiClient.patch<Publication>(
        `/metahub/${metahubId}/publication/${publicationId}`,
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
        `/metahub/${metahubId}/publications`,
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
        `/metahub/${metahubId}/publication/${publicationId}/diff`
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
        `/metahub/${metahubId}/publication/${publicationId}/sync`,
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
        `/metahub/${metahubId}/publication/${publicationId}`,
        { params: { confirm: 'true' } }
    )
    return response.data
}

/**
 * Linked application (via connectors_metahubs junction)
 */
export interface LinkedApplication {
    id: string
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    slug: string
    createdAt: string
}

/**
 * Response for linked applications
 */
export interface LinkedApplicationsResponse {
    items: LinkedApplication[]
    total: number
}

/**
 * Get applications linked to this publication via connectors
 */
export const getPublicationApplications = async (
    metahubId: string,
    publicationId: string
): Promise<LinkedApplicationsResponse> => {
    const response = await apiClient.get<LinkedApplicationsResponse>(
        `/metahub/${metahubId}/publication/${publicationId}/applications`
    )
    return response.data
}
