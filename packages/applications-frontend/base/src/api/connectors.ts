import apiClient from './apiClient'
import { Connector, ConnectorLocalizedPayload, PaginationParams, PaginatedResponse } from '../types'

/**
 * List connectors for a specific application
 */
export const listConnectors = async (applicationId: string, params?: PaginationParams): Promise<PaginatedResponse<Connector>> => {
    const response = await apiClient.get<{ items: Connector[]; pagination: { total: number; limit: number; offset: number } }>(
        `/applications/${applicationId}/connectors`,
        {
            params: {
                limit: params?.limit,
                offset: params?.offset,
                sortBy: params?.sortBy,
                sortOrder: params?.sortOrder,
                search: params?.search
            }
        }
    )

    const backendPagination = response.data.pagination
    return {
        items: response.data.items || [],
        pagination: {
            limit: backendPagination?.limit ?? 100,
            offset: backendPagination?.offset ?? 0,
            count: response.data.items?.length ?? 0,
            total: backendPagination?.total ?? 0,
            hasMore: (backendPagination?.offset ?? 0) + (response.data.items?.length ?? 0) < (backendPagination?.total ?? 0)
        }
    }
}

/**
 * Get a single connector
 */
export const getConnector = (applicationId: string, connectorId: string) =>
    apiClient.get<Connector>(`/applications/${applicationId}/connectors/${connectorId}`)

/**
 * Create a new connector
 */
export const createConnector = (applicationId: string, data: ConnectorLocalizedPayload) =>
    apiClient.post<Connector>(`/applications/${applicationId}/connectors`, data)

/**
 * Update a connector
 */
export const updateConnector = (applicationId: string, connectorId: string, data: Partial<ConnectorLocalizedPayload>) =>
    apiClient.patch<Connector>(`/applications/${applicationId}/connectors/${connectorId}`, data)

/**
 * Delete a connector
 */
export const deleteConnector = (applicationId: string, connectorId: string) =>
    apiClient.delete<void>(`/applications/${applicationId}/connectors/${connectorId}`)
