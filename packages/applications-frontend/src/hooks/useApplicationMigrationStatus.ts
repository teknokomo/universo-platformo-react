/**
 * Universo Platformo | Application Migration Status Hook
 *
 * React Query hook for fetching application migration/update status.
 * Used by ApplicationMigrationGuard to determine if sync is required.
 */

import { useQuery } from '@tanstack/react-query'
import { applicationsQueryKeys } from '../api/queryKeys'
import { getApplicationMigrationStatus } from '../api/connectors'
import type { ApplicationMigrationStatusResponse } from '@universo/types'
import { MIGRATION_STATUS_QUERY_OPTIONS } from '@universo/migration-guard-shared'

interface UseApplicationMigrationStatusOptions {
    enabled?: boolean
}

export function useApplicationMigrationStatus(applicationId: string, options?: UseApplicationMigrationStatusOptions) {
    const { enabled = true } = options ?? {}

    return useQuery<ApplicationMigrationStatusResponse, Error>({
        queryKey: applicationsQueryKeys.migrationStatus(applicationId),
        queryFn: () => getApplicationMigrationStatus(applicationId),
        enabled: enabled && Boolean(applicationId),
        ...MIGRATION_STATUS_QUERY_OPTIONS
    })
}
