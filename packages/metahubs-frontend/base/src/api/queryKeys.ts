import type { PaginationParams } from '../types'

export const metahubsQueryKeys = {
    all: ['metahubs'] as const,
    lists: () => [...metahubsQueryKeys.all, 'list'] as const,
    list: (params?: PaginationParams & { showAll?: boolean }) => [...metahubsQueryKeys.lists(), params] as const,
    details: () => [...metahubsQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...metahubsQueryKeys.details(), id] as const,
    entities: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'entities'] as const,
    entity: (metahubId: string, entityId: string) => [...metahubsQueryKeys.entities(metahubId), entityId] as const,
    records: (metahubId: string, entityId: string) => [...metahubsQueryKeys.entity(metahubId, entityId), 'records'] as const
}
