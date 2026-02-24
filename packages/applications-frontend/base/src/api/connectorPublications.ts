import apiClient from './apiClient'
import type { ConnectorPublication, ConnectorPublicationsResponse, PublicationSummary } from '../types'

/**
 * List all publications linked to a connector
 */
export const listConnectorPublications = async (applicationId: string, connectorId: string): Promise<ConnectorPublicationsResponse> => {
    const response = await apiClient.get<ConnectorPublicationsResponse>(
        `/applications/${applicationId}/connectors/${connectorId}/publications`
    )
    return response.data
}

/**
 * Link a publication to a connector
 */
export const linkPublication = async (
    applicationId: string,
    connectorId: string,
    publicationId: string,
    sortOrder = 0
): Promise<ConnectorPublication> => {
    const response = await apiClient.post<ConnectorPublication>(`/applications/${applicationId}/connectors/${connectorId}/publications`, {
        publicationId,
        sortOrder
    })
    return response.data
}

/**
 * Unlink a publication from a connector
 */
export const unlinkPublication = async (applicationId: string, connectorId: string, linkId: string): Promise<void> => {
    await apiClient.delete(`/applications/${applicationId}/connectors/${connectorId}/publications/${linkId}`)
}

/**
 * Fetch available publications for selection
 * Only returns publications that have a schema (i.e., are ready to be linked)
 */
export const listAvailablePublications = async (): Promise<PublicationSummary[]> => {
    try {
        const response = await apiClient.get<{ items: PublicationSummary[]; total: number }>('/publications/available', {
            params: { limit: 100 }
        })
        return response.data.items || []
    } catch (error) {
        console.warn('[connectorPublications] Failed to fetch available publications:', error)
        return []
    }
}
