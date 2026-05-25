/**
 * Universo Platformo | Shared Migration Guard — React Query Options
 *
 * Common TanStack React Query options for migration-status queries.
 * Applied to both useApplicationMigrationStatus and useMetahubMigrationsStatus.
 */

/**
 * Shared React Query options for migration status queries.
 * Prevents unnecessary refetches since migration status rarely changes during a session.
 */
export const MIGRATION_STATUS_QUERY_OPTIONS = {
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retryOnMount: false,
    retry: false,
    staleTime: 30_000
} as const
