import { useQuery } from '@tanstack/react-query'
import { metahubsQueryKeys } from '../../shared'
import { listPublicationVersions } from '../api'

/**
 * Hook to list publication versions
 */
export function usePublicationVersions(metahubId: string, publicationId: string) {
    return useQuery({
        queryKey: metahubsQueryKeys.publicationVersionsList(metahubId, publicationId),
        queryFn: () => listPublicationVersions(metahubId, publicationId),
        staleTime: 30_000,
        enabled: Boolean(metahubId && publicationId)
    })
}
