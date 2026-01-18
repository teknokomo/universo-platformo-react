/**
 * Universo Platformo | Connector Sync Hooks
 *
 * React Query hooks for connector schema diff and sync operations.
 */

import { useQuery } from '@tanstack/react-query'
import { applicationsQueryKeys } from '../api/queryKeys'
import * as connectorsApi from '../api/connectors'
import type { SchemaDiffResponse } from '../api/connectors'

interface UseConnectorDiffOptions {
    enabled?: boolean
}

/**
 * Hook for fetching schema diff for a connector
 *
 * @param metahubId - The metahub ID that owns the schema definitions
 * @param applicationId - The application ID (same as publication ID)
 * @param connectorId - The connector ID for cache key scoping
 * @param options - Query options
 */
export function useConnectorDiff(
    metahubId: string,
    applicationId: string,
    connectorId: string,
    options?: UseConnectorDiffOptions
) {
    const { enabled = true } = options ?? {}

    return useQuery<SchemaDiffResponse, Error>({
        queryKey: applicationsQueryKeys.connectorDiff(applicationId, connectorId),
        queryFn: () => connectorsApi.getConnectorDiff(metahubId, applicationId),
        enabled: enabled && Boolean(metahubId) && Boolean(applicationId) && Boolean(connectorId),
        // Don't cache - always fetch fresh diff
        staleTime: 0,
        gcTime: 0,
        refetchOnWindowFocus: false
    })
}

export type { SchemaDiffResponse }
