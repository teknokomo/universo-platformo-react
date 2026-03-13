import type { Knex } from 'knex'
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
    trx: Knex.Transaction,
    input: PersistApplicationSchemaSyncStateInput
): Promise<void> => {
    const result = await trx
        .withSchema('applications')
        .table('cat_applications')
        .where({ id: input.applicationId, _upl_deleted: false, _app_deleted: false })
        .update({
            schema_status: input.schemaStatus,
            schema_error: input.schemaError,
            schema_synced_at: input.schemaSyncedAt,
            schema_snapshot: input.schemaSnapshot,
            last_synced_publication_version_id: input.lastSyncedPublicationVersionId,
            app_structure_version: input.appStructureVersion,
            installed_release_metadata: input.installedReleaseMetadata,
            _upl_updated_at: trx.fn.now(),
            _upl_updated_by: input.userId ?? null,
            _upl_version: trx.raw('COALESCE(_upl_version, 1) + 1')
        })

    if (Number(result) < 1) {
        throw new Error(`Application ${input.applicationId} not found while persisting schema sync state`)
    }
}
