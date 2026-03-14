import { ApplicationSchemaStatus } from '@universo/types'
import type { SqlQueryable } from '@universo/utils/database'

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
    const setClauses = [
        'schema_status = $1',
        'schema_error = $2',
        'schema_synced_at = $3',
        'schema_snapshot = $4',
        'last_synced_publication_version_id = $5',
        'app_structure_version = $6',
        '_upl_updated_at = NOW()',
        '_upl_version = COALESCE(_upl_version, 1) + 1'
    ]
    const params: unknown[] = [
        input.schemaStatus,
        input.schemaError,
        input.schemaSyncedAt,
        input.schemaSnapshot ? JSON.stringify(input.schemaSnapshot) : null,
        input.lastSyncedPublicationVersionId,
        input.appStructureVersion
    ]

    let nextParam = 7
    if (input.installedReleaseMetadata !== undefined) {
        setClauses.push(`installed_release_metadata = $${nextParam}`)
        params.push(input.installedReleaseMetadata ? JSON.stringify(input.installedReleaseMetadata) : null)
        nextParam++
    }

    setClauses.push(`_upl_updated_by = $${nextParam}`)
    params.push(input.userId ?? null)
    nextParam++

    params.push(input.applicationId)

    const result = await trx.query<{ id: string }>(
        `UPDATE applications.cat_applications
         SET ${setClauses.join(',\n             ')}
         WHERE id = $${nextParam} AND _upl_deleted = false AND _app_deleted = false
         RETURNING id`,
        params
    )

    if (result.length < 1) {
        throw new Error(`Application ${input.applicationId} not found while persisting schema sync state`)
    }
}
