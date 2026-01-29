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
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateConnector = (applicationId: string, connectorId: string, data: Partial<ConnectorLocalizedPayload> & { expectedVersion?: number }) =>
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
    status: 'created' | 'synced' | 'migrated' | 'pending_confirmation' | 'no_changes'
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
 * Publication summary for schema sync operations
 */
export interface PublicationSummary {
    id: string
    metahubId: string
    name: Record<string, string>
    schemaName: string
    schemaStatus: string
}

/**
 * Get publications for a metahub (to find publication ID for sync operations)
 */
export const getMetahubPublications = async (
    metahubId: string
): Promise<{ items: PublicationSummary[]; total: number }> => {
    const response = await apiClient.get<{ items: PublicationSummary[]; total: number }>(
        `/metahub/${metahubId}/publications`
    )
    return response.data
}

/**
 * Get schema diff for an application
 * Uses the Application's linked Metahub via Connector
 */
export const getApplicationDiff = async (
    applicationId: string
): Promise<SchemaDiffResponse> => {
    const response = await apiClient.get<SchemaDiffResponse>(
        `/application/${applicationId}/diff`
    )
    return response.data
}

/**
 * Sync application schema with linked Metahub configuration
 */
export const syncApplication = async (
    applicationId: string,
    confirmDestructive = false
): Promise<SchemaSyncResponse> => {
    const response = await apiClient.post<SchemaSyncResponse>(
        `/application/${applicationId}/sync`,
        { confirmDestructive }
    )
    return response.data
}

// Legacy exports for backward compatibility (deprecated)
export const getConnectorDiff = getApplicationDiff
/**
 * @deprecated Use syncApplication instead
 */
export const syncConnector = (
    _metahubId: string,
    _publicationId: string,
    confirmDestructive: boolean,
    applicationId: string
): Promise<SchemaSyncResponse> => {
    console.warn('syncConnector is deprecated. Use syncApplication instead.')
    return syncApplication(applicationId, confirmDestructive)
}
