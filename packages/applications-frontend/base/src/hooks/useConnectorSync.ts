/**
 * Universo Platformo | Connector Sync Hooks
 *
 * React Query hooks for application schema diff and sync operations.
 * Schema is stored per-Application (not per-Publication).
 */

import { useQuery } from '@tanstack/react-query'
import { applicationsQueryKeys } from '../api/queryKeys'
import * as connectorsApi from '../api/connectors'
import type { SchemaDiffResponse, PublicationSummary } from '../api/connectors'

interface UseApplicationDiffOptions {
    enabled?: boolean
}

/**
 * Hook to get the first publication for a metahub (kept for backward compatibility)
 * @deprecated Use useApplicationDiff instead
 */
export function useMetahubPublication(
    metahubId: string,
    options?: { enabled?: boolean }
) {
    return useQuery<PublicationSummary | null, Error>({
        queryKey: ['metahub', metahubId, 'publications', 'first'],
        queryFn: async () => {
            const result = await connectorsApi.getMetahubPublications(metahubId)
            return result.items.length > 0 ? result.items[0] : null
        },
        enabled: options?.enabled !== false && Boolean(metahubId),
        staleTime: 30 * 1000
    })
}

/**
 * Hook for fetching schema diff for an application
 * Uses the Application's linked Metahub via Connector
 *
 * @param applicationId - The application ID 
 * @param options - Query options
 */
export function useApplicationDiff(
    applicationId: string,
    options?: UseApplicationDiffOptions
) {
    const { enabled = true } = options ?? {}

    return useQuery<SchemaDiffResponse, Error>({
        queryKey: applicationsQueryKeys.applicationDiff(applicationId),
        queryFn: () => connectorsApi.getApplicationDiff(applicationId),
        enabled: enabled && Boolean(applicationId),
        // Don't cache - always fetch fresh diff
        staleTime: 0,
        gcTime: 0,
        refetchOnWindowFocus: false
    })
}

/**
 * @deprecated Use useApplicationDiff instead
 */
export function useConnectorDiff(
    _metahubId: string,
    _publicationId: string,
    _connectorId: string,
    options?: UseApplicationDiffOptions
) {
    // This is kept for backward compatibility but now requires applicationId
    // Real implementation should use useApplicationDiff
    console.warn('useConnectorDiff is deprecated. Use useApplicationDiff instead.')
    return useQuery<SchemaDiffResponse, Error>({
        queryKey: ['deprecated-connector-diff'],
        queryFn: async () => {
            throw new Error('useConnectorDiff is deprecated. Use useApplicationDiff instead.')
        },
        enabled: false,
        ...options
    })
}

export type { SchemaDiffResponse, PublicationSummary }
