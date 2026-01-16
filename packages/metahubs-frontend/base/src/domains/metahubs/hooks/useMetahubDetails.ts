import { useQuery } from '@tanstack/react-query'
import { metahubsQueryKeys } from '../../shared'
import { getMetahub } from '../api'

interface UseMetahubDetailsOptions {
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
 * Hook for fetching metahub details with statistics
 *
 * Fetches complete metahub data including:
 * - sectionsCount
 * - entitiesCount
 * - membersCount (added in Phase 1)
 *
 * @param metahubId - UUID of the metahub
 * @param options - Query configuration options
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useMetahubDetails(metahubId)
 *
 * if (isLoading) return <Loader />
 * if (error) return <ErrorMessage error={error} />
 *
 * return <MetahubBoardGrid metahub={data} />
 * ```
 */
export function useMetahubDetails(metahubId: string, options?: UseMetahubDetailsOptions) {
    const { enabled = true, staleTime = 5 * 60 * 1000, retry = 3 } = options ?? {}

    return useQuery({
        queryKey: metahubsQueryKeys.detail(metahubId),
        queryFn: async () => {
            const response = await getMetahub(metahubId)
            return response.data
        },
        enabled: enabled && Boolean(metahubId),
        staleTime,
        retry,
        // Prevent refetching on window focus (stats don't change frequently)
        refetchOnWindowFocus: false,
        // Use cached data while revalidating in background
        refetchOnMount: 'always'
    })
}

export type { UseMetahubDetailsOptions }
export type UseMetahubDetailsResult = ReturnType<typeof useMetahubDetails>
