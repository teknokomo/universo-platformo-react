import apiClient from './apiClient'
import type { ConnectorMetahub, ConnectorMetahubsResponse, MetahubSummary } from '../types'

/**
 * List all metahubs linked to a connector
 */
export const listConnectorMetahubs = async (
    applicationId: string,
    connectorId: string
): Promise<ConnectorMetahubsResponse> => {
    const response = await apiClient.get<ConnectorMetahubsResponse>(
        `/applications/${applicationId}/connectors/${connectorId}/metahubs`
    )
    return response.data
}

/**
 * Link a metahub to a connector
 */
export const linkMetahub = async (
    applicationId: string,
    connectorId: string,
    metahubId: string,
    sortOrder = 0
): Promise<ConnectorMetahub> => {
    const response = await apiClient.post<ConnectorMetahub>(
        `/applications/${applicationId}/connectors/${connectorId}/metahubs`,
        { metahubId, sortOrder }
    )
    return response.data
}

/**
 * Unlink a metahub from a connector
 */
export const unlinkMetahub = async (
    applicationId: string,
    connectorId: string,
    linkId: string
): Promise<void> => {
    await apiClient.delete(`/applications/${applicationId}/connectors/${connectorId}/metahubs/${linkId}`)
}

/**
 * Fetch available metahubs for selection
 * This calls the metahubs API to get all accessible metahubs
 */
export const listAvailableMetahubs = async (): Promise<MetahubSummary[]> => {
    try {
        const response = await apiClient.get<{ items: MetahubSummary[]; total: number }>('/metahubs', {
            params: { limit: 100 }
        })
        return response.data.items || []
    } catch (error) {
        console.warn('[connectorMetahubs] Failed to fetch available metahubs:', error)
        return []
    }
}
