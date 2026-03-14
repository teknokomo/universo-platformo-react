import type { SqlQueryable } from '@universo/utils'
import { ApplicationSchemaStatus } from '@universo/types'

export interface PersistApplicationSchemaSyncStateInput {
    applicationId: string
    schemaStatus: ApplicationSchemaStatus
    schemaError: string | null
    schemaSyncedAt: Date | null
    schemaSnapshot: Record<string, unknown> | null
    lastSyncedPublicationVersionId: string | null
    appStructureVersion: number | null
    installedReleaseMetadata?: Record<string, unknown> | null
    userId?: string | null
}

export const persistApplicationSchemaSyncState = async (
    trx: SqlQueryable,
    input: PersistApplicationSchemaSyncStateInput
): Promise<void> => {
    const rows = await trx.query<{ id: string }>(
        `UPDATE applications.cat_applications
         SET schema_status = $1,
             schema_error = $2,
             schema_synced_at = $3,
             schema_snapshot = $4,
             last_synced_publication_version_id = $5,
             app_structure_version = $6,
             installed_release_metadata = $7,
             _upl_updated_at = NOW(),
             _upl_updated_by = $8,
             _upl_version = COALESCE(_upl_version, 1) + 1
         WHERE id = $9 AND _upl_deleted = false AND _app_deleted = false
         RETURNING id`,
        [
            input.schemaStatus,
            input.schemaError,
            input.schemaSyncedAt,
            input.schemaSnapshot ? JSON.stringify(input.schemaSnapshot) : null,
            input.lastSyncedPublicationVersionId,
            input.appStructureVersion,
            input.installedReleaseMetadata != null ? JSON.stringify(input.installedReleaseMetadata) : null,
            input.userId ?? null,
            input.applicationId
        ]
    )

    if (rows.length < 1) {
        throw new Error(`Application ${input.applicationId} not found while persisting schema sync state`)
    }
}
