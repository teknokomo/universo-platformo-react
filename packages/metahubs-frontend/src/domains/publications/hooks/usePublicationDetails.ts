import { useQuery } from '@tanstack/react-query'
import { metahubsQueryKeys } from '../../shared'
import { getPublication } from '../api'

/**
 * Hook to get publication details (for inner view header context)
 */
export function usePublicationDetails(metahubId: string, publicationId: string) {
    return useQuery({
        queryKey: metahubsQueryKeys.publicationDetail(metahubId, publicationId),
        queryFn: () => getPublication(metahubId, publicationId),
        staleTime: 60_000,
        enabled: Boolean(metahubId && publicationId)
    })
}
