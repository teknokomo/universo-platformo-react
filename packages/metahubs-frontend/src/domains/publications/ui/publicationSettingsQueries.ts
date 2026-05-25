import type { QueryClient } from '@tanstack/react-query'

import { metahubsQueryKeys } from '../../shared'

export const invalidatePublicationSettingsQueries = async (
    queryClient: Pick<QueryClient, 'invalidateQueries'>,
    metahubId: string,
    publicationId: string
) => {
    await queryClient.invalidateQueries({
        queryKey: metahubsQueryKeys.publicationDetail(metahubId, publicationId)
    })
    await queryClient.invalidateQueries({
        queryKey: metahubsQueryKeys.publications(metahubId)
    })
    await queryClient.invalidateQueries({
        queryKey: ['breadcrumb', 'metahub-publication', metahubId, publicationId]
    })
}
