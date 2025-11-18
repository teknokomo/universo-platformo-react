import { useQuery } from '@tanstack/react-query'
import { clustersQueryKeys } from './queryKeys'
import { getCluster } from './clusters'

interface UseClusterDetailsOptions {
    /**
     * Whether to enable automatic refetching
     * @default true
     */
    enabled?: boolean

    /**
     * Time in milliseconds before data is considered stale
     * @default 300000 (5 minutes)
     */
    staleTime?: number

    /**
     * Number of retry attempts on failure
     * @default 3
     */
    retry?: number
}

/**
 * Hook for fetching cluster details with statistics
 *
 * Fetches complete cluster data including:
 * - domainsCount
 * - resourcesCount
 * - membersCount (added in Phase 1)
 *
 * @param clusterId - UUID of the cluster
 * @param options - Query configuration options
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useClusterDetails(clusterId)
 *
 * if (isLoading) return <Loader />
 * if (error) return <ErrorMessage error={error} />
 *
 * return <ClusterBoardGrid cluster={data} />
 * ```
 */
export function useClusterDetails(clusterId: string, options?: UseClusterDetailsOptions) {
    const { enabled = true, staleTime = 5 * 60 * 1000, retry = 3 } = options ?? {}

    return useQuery({
        queryKey: clustersQueryKeys.detail(clusterId),
        queryFn: async () => {
            const response = await getCluster(clusterId)
            return response.data
        },
        enabled: enabled && Boolean(clusterId),
        staleTime,
        retry,
        // Prevent refetching on window focus (stats don't change frequently)
        refetchOnWindowFocus: false,
        // Use cached data while revalidating in background
        refetchOnMount: 'always'
    })
}

export type { UseClusterDetailsOptions }
export type UseClusterDetailsResult = ReturnType<typeof useClusterDetails>
