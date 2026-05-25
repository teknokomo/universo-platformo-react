import { useQuery } from '@tanstack/react-query'
import { applicationsQueryKeys } from './queryKeys'
import { getApplication } from './applications'

interface UseApplicationDetailsOptions {
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
 * Hook for fetching application details with statistics
 *
 * Fetches complete application data including:
 * - sectionsCount
 * - entitiesCount
 * - membersCount (added in Phase 1)
 *
 * @param applicationId - UUID of the application
 * @param options - Query configuration options
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useApplicationDetails(applicationId)
 *
 * if (isLoading) return <Loader />
 * if (error) return <ErrorMessage error={error} />
 *
 * return <ApplicationBoardGrid application={data} />
 * ```
 */
export function useApplicationDetails(applicationId: string, options?: UseApplicationDetailsOptions) {
    const { enabled = true, staleTime = 5 * 60 * 1000, retry = 3 } = options ?? {}

    return useQuery({
        queryKey: applicationsQueryKeys.detail(applicationId),
        queryFn: async () => {
            const response = await getApplication(applicationId)
            return response.data
        },
        enabled: enabled && Boolean(applicationId),
        staleTime,
        retry,
        // Prevent refetching on window focus (stats don't change frequently)
        refetchOnWindowFocus: false,
        // Use cached data while revalidating in background
        refetchOnMount: 'always'
    })
}

export type { UseApplicationDetailsOptions }
export type UseApplicationDetailsResult = ReturnType<typeof useApplicationDetails>
