import { useQuery } from '@tanstack/react-query'
import { uniksQueryKeys } from './queryKeys'
import { getUnik } from './uniks'

interface UseUnikDetailsOptions {
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
 * Hook for fetching unik details with statistics
 *
 * Fetches complete unik data including:
 * - sectionsCount
 * - entitiesCount
 * - membersCount (added in Phase 1)
 *
 * @param unikId - UUID of the unik
 * @param options - Query configuration options
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useUnikDetails(unikId)
 *
 * if (isLoading) return <Loader />
 * if (error) return <ErrorMessage error={error} />
 *
 * return <UnikBoardGrid unik={data} />
 * ```
 */
export function useUnikDetails(unikId: string, options?: UseUnikDetailsOptions) {
    const { enabled = true, staleTime = 5 * 60 * 1000, retry = 3 } = options ?? {}

    return useQuery({
        queryKey: uniksQueryKeys.detail(unikId),
        queryFn: async () => {
            const response = await getUnik(unikId)
            return response.data
        },
        enabled: enabled && Boolean(unikId),
        staleTime,
        retry,
        // Prevent refetching on window focus (stats don't change frequently)
        refetchOnWindowFocus: false,
        // Use cached data while revalidating in background
        refetchOnMount: 'always'
    })
}

export type { UseUnikDetailsOptions }
export type UseUnikDetailsResult = ReturnType<typeof useUnikDetails>
