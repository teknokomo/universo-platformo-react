/**
 * Universo Platformo | Migrations Hooks
 *
 * React Query hooks for fetching and managing application migrations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    fetchMigrations,
    fetchMigration,
    analyzeMigrationRollback,
    rollbackMigration,
    type MigrationsListResponse,
    type MigrationDetail,
    type RollbackAnalysis,
    type RollbackResult
} from '../api/migrations'
import { applicationsQueryKeys, invalidateMigrationsQueries } from '../api/queryKeys'

/**
 * Hook to fetch list of migrations for an application
 */
export function useMigrations(
    applicationId: string,
    params?: { limit?: number; offset?: number },
    options?: { enabled?: boolean }
) {
    return useQuery<MigrationsListResponse, Error>({
        queryKey: applicationsQueryKeys.migrationsList(applicationId, params),
        queryFn: () => fetchMigrations(applicationId, params),
        enabled: options?.enabled !== false && Boolean(applicationId),
        staleTime: 30 * 1000 // 30 seconds
    })
}

/**
 * Hook to fetch a single migration with full details
 */
export function useMigrationDetail(
    applicationId: string,
    migrationId: string,
    options?: { enabled?: boolean }
) {
    return useQuery<MigrationDetail, Error>({
        queryKey: applicationsQueryKeys.migrationDetail(applicationId, migrationId),
        queryFn: () => fetchMigration(applicationId, migrationId),
        enabled: options?.enabled !== false && Boolean(applicationId) && Boolean(migrationId),
        staleTime: 60 * 1000 // 1 minute
    })
}

/**
 * Hook to analyze rollback possibility
 */
export function useMigrationRollbackAnalysis(
    applicationId: string,
    migrationId: string,
    options?: { enabled?: boolean }
) {
    return useQuery<RollbackAnalysis, Error>({
        queryKey: applicationsQueryKeys.migrationAnalysis(applicationId, migrationId),
        queryFn: () => analyzeMigrationRollback(applicationId, migrationId),
        enabled: options?.enabled !== false && Boolean(applicationId) && Boolean(migrationId),
        staleTime: 10 * 1000 // 10 seconds - short since state can change
    })
}

/**
 * Hook for rollback mutation
 */
export function useRollbackMigration(applicationId: string) {
    const queryClient = useQueryClient()

    return useMutation<RollbackResult, Error, { migrationId: string; confirmDestructive?: boolean }>({
        mutationFn: ({ migrationId, confirmDestructive }) =>
            rollbackMigration(applicationId, migrationId, confirmDestructive),
        onSuccess: () => {
            // Invalidate migrations list and application detail
            invalidateMigrationsQueries.all(queryClient, applicationId)
            queryClient.invalidateQueries({
                queryKey: applicationsQueryKeys.detail(applicationId)
            })
        }
    })
}
