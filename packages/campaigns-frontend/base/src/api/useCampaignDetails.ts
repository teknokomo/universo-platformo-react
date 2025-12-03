import { useQuery } from '@tanstack/react-query'
import { campaignsQueryKeys } from './queryKeys'
import { getCampaign } from './campaigns'

interface UseCampaignDetailsOptions {
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
 * Hook for fetching campaign details with statistics
 *
 * Fetches complete campaign data including:
 * - eventsCount
 * - activitiesCount
 * - membersCount (added in Phase 1)
 *
 * @param campaignId - UUID of the campaign
 * @param options - Query configuration options
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useCampaignDetails(campaignId)
 *
 * if (isLoading) return <Loader />
 * if (error) return <ErrorMessage error={error} />
 *
 * return <CampaignBoardGrid campaign={data} />
 * ```
 */
export function useCampaignDetails(campaignId: string, options?: UseCampaignDetailsOptions) {
    const { enabled = true, staleTime = 5 * 60 * 1000, retry = 3 } = options ?? {}

    return useQuery({
        queryKey: campaignsQueryKeys.detail(campaignId),
        queryFn: async () => {
            const response = await getCampaign(campaignId)
            return response.data
        },
        enabled: enabled && Boolean(campaignId),
        staleTime,
        retry,
        // Prevent refetching on window focus (stats don't change frequently)
        refetchOnWindowFocus: false,
        // Use cached data while revalidating in background
        refetchOnMount: 'always'
    })
}

export type { UseCampaignDetailsOptions }
export type UseCampaignDetailsResult = ReturnType<typeof useCampaignDetails>
