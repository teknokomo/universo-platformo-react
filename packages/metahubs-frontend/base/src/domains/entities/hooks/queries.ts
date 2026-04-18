import { useQuery } from '@tanstack/react-query'

import { fetchAllPaginatedItems, metahubsQueryKeys } from '../../shared'
import * as entitiesApi from '../api'

export const useEntityTypesQuery = (metahubId?: string, params?: entitiesApi.EntityTypeListParams) => {
    return useQuery({
        queryKey: metahubId ? metahubsQueryKeys.entityTypesList(metahubId, params) : ['metahubs', 'entityTypes', 'empty'],
        queryFn: () => entitiesApi.listEntityTypes(metahubId!, params),
        enabled: Boolean(metahubId),
        staleTime: 60 * 1000
    })
}

const allEntityTypesListParams = {
    limit: 1000,
    sortBy: 'codename' as const,
    sortOrder: 'asc' as const
}

export const useAllEntityTypesQuery = (metahubId?: string) => {
    return useQuery({
        queryKey: metahubId
            ? metahubsQueryKeys.entityTypesList(metahubId, {
                  ...allEntityTypesListParams,
                  offset: 0
              })
            : ['metahubs', 'entityTypes', 'all', 'empty'],
        queryFn: async () => {
            if (!metahubId) {
                return {
                    items: [],
                    pagination: { limit: allEntityTypesListParams.limit, offset: 0, count: 0, total: 0, hasMore: false }
                }
            }

            return fetchAllPaginatedItems((params) => entitiesApi.listEntityTypes(metahubId, params), allEntityTypesListParams)
        },
        enabled: Boolean(metahubId),
        staleTime: 60 * 1000
    })
}

export const useEntityTypeQuery = (metahubId?: string, entityTypeId?: string) => {
    return useQuery({
        queryKey:
            metahubId && entityTypeId ? metahubsQueryKeys.entityTypeDetail(metahubId, entityTypeId) : ['metahubs', 'entityType', 'empty'],
        queryFn: () => entitiesApi.getEntityType(metahubId!, entityTypeId!),
        enabled: Boolean(metahubId && entityTypeId),
        staleTime: 60 * 1000
    })
}

export const useEntityInstancesQuery = (metahubId?: string, params?: entitiesApi.EntityInstancesListParams) => {
    return useQuery({
        queryKey: metahubId && params?.kind ? metahubsQueryKeys.entitiesList(metahubId, params) : ['metahubs', 'entities', 'empty'],
        queryFn: () => entitiesApi.listEntityInstances(metahubId!, params!),
        enabled: Boolean(metahubId && params?.kind),
        staleTime: 30 * 1000
    })
}

export const useEntityInstanceQuery = (metahubId?: string, entityId?: string) => {
    return useQuery({
        queryKey: metahubId && entityId ? metahubsQueryKeys.entityDetail(metahubId, entityId) : ['metahubs', 'entity', 'empty'],
        queryFn: () => entitiesApi.getEntityInstance(metahubId!, entityId!),
        enabled: Boolean(metahubId && entityId),
        staleTime: 30 * 1000
    })
}
