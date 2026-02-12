import { useQuery } from '@tanstack/react-query'
import { metahubsQueryKeys } from '../../shared'
import * as migrationsApi from '../api'
import type { TemplateCleanupMode } from '../api'

interface UseMetahubMigrationsListOptions {
    enabled?: boolean
    limit?: number
    offset?: number
    branchId?: string
}

export function useMetahubMigrationsList(metahubId: string, options?: UseMetahubMigrationsListOptions) {
    const { enabled = true, limit = 50, offset = 0, branchId } = options ?? {}

    return useQuery({
        queryKey: metahubsQueryKeys.migrationsList(metahubId, { limit, offset, branchId }),
        queryFn: () => migrationsApi.listMetahubMigrations(metahubId, { limit, offset, branchId }),
        enabled: enabled && Boolean(metahubId),
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retryOnMount: false,
        retry: false
    })
}

interface UseMetahubMigrationsPlanOptions {
    enabled?: boolean
    branchId?: string
    cleanupMode?: TemplateCleanupMode
}

export function useMetahubMigrationsPlan(metahubId: string, options?: UseMetahubMigrationsPlanOptions) {
    const { enabled = true, branchId, cleanupMode = 'keep' } = options ?? {}

    return useQuery({
        queryKey: metahubsQueryKeys.migrationsPlan(metahubId, branchId, cleanupMode),
        queryFn: () => migrationsApi.planMetahubMigrations(metahubId, { branchId, cleanupMode }),
        enabled: enabled && Boolean(metahubId),
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retryOnMount: false,
        retry: false
    })
}

interface UseMetahubMigrationsStatusOptions {
    enabled?: boolean
    branchId?: string
    cleanupMode?: TemplateCleanupMode
}

export function useMetahubMigrationsStatus(metahubId: string, options?: UseMetahubMigrationsStatusOptions) {
    const { enabled = true, branchId, cleanupMode = 'keep' } = options ?? {}

    return useQuery({
        queryKey: metahubsQueryKeys.migrationsStatus(metahubId, branchId, cleanupMode),
        queryFn: () => migrationsApi.getMetahubMigrationsStatus(metahubId, { branchId, cleanupMode }),
        enabled: enabled && Boolean(metahubId),
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retryOnMount: false,
        retry: false
    })
}
