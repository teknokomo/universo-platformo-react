import { apiClient } from '../../shared'
import type { VersionedLocalizedContent } from '@universo/types'
import type { SimpleLocalizedInput } from '@universo/utils/vlc'

/**
 * Publication version entity
 */
export interface PublicationVersion {
    id: string
    versionNumber: number
    name: VersionedLocalizedContent<string>
    description: VersionedLocalizedContent<string> | null
    isActive: boolean
    createdAt: string
    createdBy: string
    branchId?: string | null
}

/**
 * Response for listing publication versions
 */
export interface PublicationVersionsListResponse {
    items: PublicationVersion[]
}

/**
 * Payload for creating a publication version
 */
export interface CreateVersionPayload {
    name: SimpleLocalizedInput
    namePrimaryLocale: string
    description?: SimpleLocalizedInput
    descriptionPrimaryLocale?: string
    branchId?: string
}

/**
 * Payload for updating a publication version
 */
export interface UpdateVersionPayload {
    name: SimpleLocalizedInput
    namePrimaryLocale: string
    description?: SimpleLocalizedInput
    descriptionPrimaryLocale?: string
}

/**
 * List versions for a specific publication
 */
export const listPublicationVersions = async (metahubId: string, publicationId: string): Promise<PublicationVersionsListResponse> => {
    const response = await apiClient.get<PublicationVersionsListResponse>(`/metahub/${metahubId}/publication/${publicationId}/versions`)
    return response.data
}

/**
 * Create a new version for a publication
 */
export const createPublicationVersion = async (
    metahubId: string,
    publicationId: string,
    payload: CreateVersionPayload
): Promise<PublicationVersion & { isDuplicate?: boolean }> => {
    const response = await apiClient.post<PublicationVersion & { isDuplicate?: boolean }>(
        `/metahub/${metahubId}/publication/${publicationId}/versions`,
        payload
    )
    return response.data
}

/**
 * Update a publication version
 */
export const updatePublicationVersion = async (
    metahubId: string,
    publicationId: string,
    versionId: string,
    payload: UpdateVersionPayload
): Promise<PublicationVersion> => {
    const response = await apiClient.patch<PublicationVersion>(
        `/metahub/${metahubId}/publication/${publicationId}/versions/${versionId}`,
        payload
    )
    return response.data
}

/**
 * Activate a publication version
 */
export const activatePublicationVersion = async (metahubId: string, publicationId: string, versionId: string): Promise<void> => {
    await apiClient.post(`/metahub/${metahubId}/publication/${publicationId}/versions/${versionId}/activate`)
}

/**
 * Delete a publication version (cannot delete active version)
 */
export const deletePublicationVersion = async (metahubId: string, publicationId: string, versionId: string): Promise<void> => {
    await apiClient.delete(`/metahub/${metahubId}/publication/${publicationId}/versions/${versionId}`)
}
