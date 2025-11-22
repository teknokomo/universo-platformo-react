import { useQuery } from '@tanstack/react-query'
import { organizationsQueryKeys } from './queryKeys'
import { getOrganization } from './organizations'

interface UseOrganizationDetailsOptions {
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
 * Hook for fetching organization details with statistics
 *
 * Fetches complete organization data including:
 * - departmentsCount
 * - positionsCount
 * - membersCount (added in Phase 1)
 *
 * @param organizationId - UUID of the organization
 * @param options - Query configuration options
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useOrganizationDetails(organizationId)
 *
 * if (isLoading) return <Loader />
 * if (error) return <ErrorMessage error={error} />
 *
 * return <OrganizationBoardGrid organization={data} />
 * ```
 */
export function useOrganizationDetails(organizationId: string, options?: UseOrganizationDetailsOptions) {
    const { enabled = true, staleTime = 5 * 60 * 1000, retry = 3 } = options ?? {}

    return useQuery({
        queryKey: organizationsQueryKeys.detail(organizationId),
        queryFn: async () => {
            const response = await getOrganization(organizationId)
            return response.data
        },
        enabled: enabled && Boolean(organizationId),
        staleTime,
        retry,
        // Prevent refetching on window focus (stats don't change frequently)
        refetchOnWindowFocus: false,
        // Use cached data while revalidating in background
        refetchOnMount: 'always'
    })
}

export type { UseOrganizationDetailsOptions }
export type UseOrganizationDetailsResult = ReturnType<typeof useOrganizationDetails>
