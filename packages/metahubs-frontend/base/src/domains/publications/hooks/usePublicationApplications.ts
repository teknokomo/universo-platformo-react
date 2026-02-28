import { useQuery } from '@tanstack/react-query'
import { metahubsQueryKeys } from '../../shared'
import { listPublicationApplications } from '../api'

/**
 * Hook to list applications linked to a publication
 */
export function usePublicationApplications(metahubId: string, publicationId: string) {
    return useQuery({
        queryKey: metahubsQueryKeys.publicationApplicationsList(metahubId, publicationId),
        queryFn: () => listPublicationApplications(metahubId, publicationId),
        staleTime: 30_000,
        enabled: Boolean(metahubId && publicationId)
    })
}
