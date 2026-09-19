import type { QueryClient } from '@tanstack/react-query'
import type { ApplicationAliasListParams } from './applicationAliasesApi'
import { applicationsQueryKeys } from './queryKeys'

const normalizeListParams = (params?: ApplicationAliasListParams) => ({
    limit: params?.limit ?? 20,
    offset: params?.offset ?? 0,
    sortBy: params?.sortBy ?? 'alias',
    sortOrder: params?.sortOrder ?? 'asc',
    search: params?.search?.trim() || undefined,
    applicationId: params?.applicationId?.trim() || undefined,
    includeReleased: params?.includeReleased === true,
    locale: params?.locale ?? 'en'
})

export const applicationAliasesQueryKeys = {
    all: ['application-aliases'] as const,
    lists: () => [...applicationAliasesQueryKeys.all, 'list'] as const,
    list: (params?: ApplicationAliasListParams) => [...applicationAliasesQueryKeys.lists(), normalizeListParams(params)] as const,
    byApplication: (applicationId: string) => [...applicationAliasesQueryKeys.all, 'application', applicationId] as const,
    policy: (applicationId: string) => [...applicationAliasesQueryKeys.byApplication(applicationId), 'policy'] as const
}

export const invalidateApplicationAliasQueries = async (queryClient: QueryClient, applicationId?: string) => {
    const invalidations = [
        queryClient.invalidateQueries({ queryKey: applicationAliasesQueryKeys.lists() }),
        // Alias mutations change alias-to-application resolution, so cached
        // authenticated runtime references must not keep stale destinations.
        queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.runtimeReferences() })
    ]

    if (applicationId) {
        invalidations.push(queryClient.invalidateQueries({ queryKey: applicationAliasesQueryKeys.byApplication(applicationId) }))
        invalidations.push(queryClient.invalidateQueries({ queryKey: applicationAliasesQueryKeys.policy(applicationId) }))
    }

    await Promise.all(invalidations)
}
