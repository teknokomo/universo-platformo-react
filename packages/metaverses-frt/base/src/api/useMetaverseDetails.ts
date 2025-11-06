import { useQuery } from '@tanstack/react-query'
import { metaversesQueryKeys } from './queryKeys'
import { getMetaverse } from './metaverses'

interface UseMetaverseDetailsOptions {
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
 * Hook for fetching metaverse details with statistics
 *
 * Fetches complete metaverse data including:
 * - sectionsCount
 * - entitiesCount
 * - membersCount (added in Phase 1)
 *
 * @param metaverseId - UUID of the metaverse
 * @param options - Query configuration options
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useMetaverseDetails(metaverseId)
 *
 * if (isLoading) return <Loader />
 * if (error) return <ErrorMessage error={error} />
 *
 * return <MetaverseBoardGrid metaverse={data} />
 * ```
 */
export function useMetaverseDetails(metaverseId: string, options?: UseMetaverseDetailsOptions) {
    const { enabled = true, staleTime = 5 * 60 * 1000, retry = 3 } = options ?? {}

    return useQuery({
        queryKey: metaversesQueryKeys.detail(metaverseId),
        queryFn: async () => {
            const response = await getMetaverse(metaverseId)
            return response.data
        },
        enabled: enabled && Boolean(metaverseId),
        staleTime,
        retry,
        // Prevent refetching on window focus (stats don't change frequently)
        refetchOnWindowFocus: false,
        // Use cached data while revalidating in background
        refetchOnMount: 'always'
    })
}

export type { UseMetaverseDetailsOptions }
export type UseMetaverseDetailsResult = ReturnType<typeof useMetaverseDetails>
