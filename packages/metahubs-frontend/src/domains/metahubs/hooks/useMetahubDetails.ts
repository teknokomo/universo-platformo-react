import { useQuery } from '@tanstack/react-query'
import { metahubsQueryKeys } from '../../shared'
import { getMetahub } from '../api'

const isRetryableMetahubDetailsError = (error: unknown): boolean => {
    const status = (error as { response?: { status?: number } } | null)?.response?.status
    if (typeof status !== 'number') return true
    return ![400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504].includes(status)
}

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
     * @default 1
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
    const { enabled = true, staleTime = 5 * 60 * 1000, retry = 1 } = options ?? {}

    return useQuery({
        queryKey: metahubsQueryKeys.detail(metahubId),
        queryFn: async () => {
            const response = await getMetahub(metahubId)
            return response.data
        },
        enabled: enabled && Boolean(metahubId),
        staleTime,
        retry: (failureCount, error) => {
            if (retry === 0) return false
            if (!isRetryableMetahubDetailsError(error)) return false
            return failureCount < retry
        },
        // Prevent refetching on window focus (stats don't change frequently)
        refetchOnWindowFocus: false,
        // Avoid forced refetch loops on mount when backend is temporarily overloaded.
        refetchOnMount: false
    })
}

export type { UseMetahubDetailsOptions }
export type UseMetahubDetailsResult = ReturnType<typeof useMetahubDetails>
