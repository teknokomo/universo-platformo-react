import { apiClient } from '../../shared'
import type { SimpleLocalizedInput } from '@universo/utils/vlc'
import type { LinkedApplicationsResponse } from './publications'

/**
 * Payload for creating an application via publication
 */
export interface CreatePublicationApplicationPayload {
    name?: SimpleLocalizedInput
    description?: SimpleLocalizedInput
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
    createApplicationSchema?: boolean
}

/**
 * List applications linked to a publication (reuses existing endpoint)
 */
export const listPublicationApplications = async (metahubId: string, publicationId: string): Promise<LinkedApplicationsResponse> => {
    const response = await apiClient.get<LinkedApplicationsResponse>(`/metahub/${metahubId}/publication/${publicationId}/applications`)
    return response.data
}

/**
 * Create a new application linked to a publication
 */
export const createPublicationApplication = async (
    metahubId: string,
    publicationId: string,
    payload: CreatePublicationApplicationPayload
): Promise<{ application: { id: string; name: unknown; slug: string; schemaName: string }; connector: { id: string } }> => {
    const response = await apiClient.post(`/metahub/${metahubId}/publication/${publicationId}/applications`, payload)
    return response.data
}
