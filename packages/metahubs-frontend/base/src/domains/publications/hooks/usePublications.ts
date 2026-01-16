import { useQuery } from '@tanstack/react-query'
import { metahubsQueryKeys } from '../../shared'
import * as publicationsApi from '../api'
import type { Publication, SchemaDiffResponse } from '../api'

interface UsePublicationsListOptions {
    enabled?: boolean
    staleTime?: number
}

/**
 * Hook for fetching list of publications for a metahub
 */
export function usePublicationsList(metahubId: string, options?: UsePublicationsListOptions) {
    const { enabled = true, staleTime = 30 * 1000 } = options ?? {}

    return useQuery({
        queryKey: metahubsQueryKeys.publicationsList(metahubId),
        queryFn: () => publicationsApi.listPublications(metahubId),
        enabled: enabled && Boolean(metahubId),
        staleTime,
        refetchOnWindowFocus: false
    })
}

interface UsePublicationDetailsOptions {
    enabled?: boolean
    staleTime?: number
}

/**
 * Hook for fetching a single publication details
 */
export function usePublicationDetails(
    metahubId: string,
    publicationId: string,
    options?: UsePublicationDetailsOptions
) {
    const { enabled = true, staleTime = 30 * 1000 } = options ?? {}

    return useQuery({
        queryKey: metahubsQueryKeys.publicationDetail(metahubId, publicationId),
        queryFn: () => publicationsApi.getPublication(metahubId, publicationId),
        enabled: enabled && Boolean(metahubId) && Boolean(publicationId),
        staleTime,
        refetchOnWindowFocus: false
    })
}

interface UsePublicationDiffOptions {
    enabled?: boolean
}

/**
 * Hook for fetching schema diff for a publication
 */
export function usePublicationDiff(
    metahubId: string,
    publicationId: string,
    options?: UsePublicationDiffOptions
) {
    const { enabled = true } = options ?? {}

    return useQuery({
        queryKey: metahubsQueryKeys.publicationDiff(metahubId, publicationId),
        queryFn: () => publicationsApi.getPublicationDiff(metahubId, publicationId),
        enabled: enabled && Boolean(metahubId) && Boolean(publicationId),
        // Don't cache - always fetch fresh diff
        staleTime: 0,
        gcTime: 0,
        refetchOnWindowFocus: false
    })
}

export type { Publication, SchemaDiffResponse }
