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

// ═══════════════════════════════════════════════════════════════════════════
// Schema Sync API (via metahubs endpoints)
// ═══════════════════════════════════════════════════════════════════════════

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
 * Get schema diff for a connector (via metahubs endpoint)
 * The connector is linked to a metahub via connector_metahubs junction table
 */
export const getConnectorDiff = async (
    metahubId: string,
    applicationId: string
): Promise<SchemaDiffResponse> => {
    // The publication ID is the same as application ID (Publication = Application alias)
    const response = await apiClient.get<SchemaDiffResponse>(
        `/metahub/${metahubId}/publication/${applicationId}/diff`
    )
    return response.data
}

/**
 * Sync connector schema with metahub configuration
 */
export const syncConnector = async (
    metahubId: string,
    applicationId: string,
    confirmDestructive = false
): Promise<SchemaSyncResponse> => {
    const response = await apiClient.post<SchemaSyncResponse>(
        `/metahub/${metahubId}/publication/${applicationId}/sync`,
        { confirmDestructive }
    )
    return response.data
}
