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

/**
 * Export a publication version as a snapshot bundle (triggers file download)
 */
export const exportPublicationVersion = async (
    metahubId: string,
    publicationId: string,
    versionId: string,
): Promise<void> => {
    const response = await apiClient.get(
        `/metahub/${metahubId}/publication/${publicationId}/versions/${versionId}/export`,
        { responseType: 'blob' }
    )
    const blob = new Blob([response.data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const disposition = response.headers['content-disposition'] ?? ''
    const filenameMatch = disposition.match(/filename\*?="?(?:UTF-8'')?([^";]+)"?/)
    a.download = filenameMatch?.[1] ? decodeURIComponent(filenameMatch[1]) : 'metahub-snapshot.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

/**
 * Import a snapshot as a new publication version
 */
export const importSnapshotVersion = async (
    metahubId: string,
    publicationId: string,
    envelopeJson: unknown,
): Promise<{ version: PublicationVersion }> => {
    const response = await apiClient.post<{ version: PublicationVersion }>(
        `/metahub/${metahubId}/publication/${publicationId}/versions/import`,
        envelopeJson
    )
    return response.data
}
