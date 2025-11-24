import { useQuery } from '@tanstack/react-query'
import { storagesQueryKeys } from './queryKeys'
import { getStorage } from './storages'

interface UseStorageDetailsOptions {
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
 * Hook for fetching storage details with statistics
 *
 * Fetches complete storage data including:
 * - containersCount
 * - slotsCount
 * - membersCount (added in Phase 1)
 *
 * @param storageId - UUID of the storage
 * @param options - Query configuration options
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useStorageDetails(storageId)
 *
 * if (isLoading) return <Loader />
 * if (error) return <ErrorMessage error={error} />
 *
 * return <StorageBoardGrid storage={data} />
 * ```
 */
export function useStorageDetails(storageId: string, options?: UseStorageDetailsOptions) {
    const { enabled = true, staleTime = 5 * 60 * 1000, retry = 3 } = options ?? {}

    return useQuery({
        queryKey: storagesQueryKeys.detail(storageId),
        queryFn: async () => {
            const response = await getStorage(storageId)
            return response.data
        },
        enabled: enabled && Boolean(storageId),
        staleTime,
        retry,
        // Prevent refetching on window focus (stats don't change frequently)
        refetchOnWindowFocus: false,
        // Use cached data while revalidating in background
        refetchOnMount: 'always'
    })
}

export type { UseStorageDetailsOptions }
export type UseStorageDetailsResult = ReturnType<typeof useStorageDetails>
