import { activeAppRowCondition, type DbExecutor, type SqlQueryable } from '@universo-react/utils'
import type { VersionedLocalizedContent } from '@universo-react/types'
import { APPLICATION_RETURNING } from './applicationPersistenceSql'
import { recordApplicationControlAudit } from './applicationControlAuditStore'
import { acquireApplicationCopyLock } from './applicationCopyLocking'
import type { ApplicationCopySourceRecord, ApplicationRecord } from './applicationsStore'

const activeRowPredicate = (alias?: string): string => activeAppRowCondition(alias)

export class ApplicationCopySourceUnavailableError extends Error {
    constructor() {
        super('Application copy source was not found or is no longer active')
        this.name = 'ApplicationCopySourceUnavailableError'
    }
}

export class ApplicationCopySourceChangedError extends Error {
    constructor() {
        super('Application copy source changed while the copy was being prepared')
        this.name = 'ApplicationCopySourceChangedError'
    }
}

export interface ApplicationCopyMemberRecord {
    userId: string
    role: string
    comment: VersionedLocalizedContent<string> | null
}

export interface ConnectorCopyRecord {
    id: string
    name: VersionedLocalizedContent<string>
    description: VersionedLocalizedContent<string> | null
    sortOrder: number
    isSingleMetahub: boolean
    isRequiredMetahub: boolean
}

export interface ConnectorPublicationCopyRecord {
    connectorId: string
    publicationId: string
    sortOrder: number
}

export async function listApplicationMembersForCopy(executor: SqlQueryable, applicationId: string): Promise<ApplicationCopyMemberRecord[]> {
    return executor.query<ApplicationCopyMemberRecord>(
        `
        SELECT
            user_id AS "userId",
            role,
            comment
        FROM applications.rel_application_users
        WHERE application_id = $1
                    AND ${activeRowPredicate()}
        ORDER BY _upl_created_at ASC, id ASC
        `,
        [applicationId]
    )
}

export async function listApplicationConnectorsForCopy(executor: SqlQueryable, applicationId: string): Promise<ConnectorCopyRecord[]> {
    return executor.query<ConnectorCopyRecord>(
        `
        SELECT
            id,
            name,
            description,
            sort_order AS "sortOrder",
            is_single_metahub AS "isSingleMetahub",
            is_required_metahub AS "isRequiredMetahub"
        FROM applications.obj_connectors
        WHERE application_id = $1
                    AND ${activeRowPredicate()}
        ORDER BY sort_order ASC, _upl_created_at ASC, id ASC
        `,
        [applicationId]
    )
}

export async function listConnectorPublicationsForCopy(
    executor: SqlQueryable,
    connectorIds: string[]
): Promise<ConnectorPublicationCopyRecord[]> {
    if (connectorIds.length === 0) {
        return []
    }

    return executor.query<ConnectorPublicationCopyRecord>(
        `
        SELECT
            connector_id AS "connectorId",
            publication_id AS "publicationId",
            sort_order AS "sortOrder"
        FROM applications.rel_connector_publications
        WHERE connector_id = ANY($1::uuid[])
                    AND ${activeRowPredicate()}
        ORDER BY sort_order ASC, _upl_created_at ASC, id ASC
        `,
        [connectorIds]
    )
}

export async function copyApplicationWithOptions(
    executor: DbExecutor,
    input: {
        newApplicationId: string
        sourceApplicationId: string
        sourceApplication: ApplicationCopySourceRecord
        copiedName: VersionedLocalizedContent<string>
        copiedDescription: VersionedLocalizedContent<string> | null
        settings: Record<string, unknown> | null
        isPublic: boolean
        showInAppList?: boolean
        workspacesEnabled: boolean
        schemaName: string
        schemaStatus: string
        copyAccess: boolean
        copyConnector: boolean
        actorUserId: string
    }
): Promise<ApplicationRecord> {
    return executor.transaction(async (trx) => {
        await acquireApplicationCopyLock(trx, input.sourceApplicationId)

        const sourceRows = await trx.query<{ version: number }>(
            `
            SELECT COALESCE(_upl_version, 1) AS version
            FROM applications.obj_applications
            WHERE id = $1
              AND ${activeRowPredicate()}
            FOR UPDATE
            `,
            [input.sourceApplicationId]
        )
        const lockedSource = sourceRows[0]
        if (!lockedSource) throw new ApplicationCopySourceUnavailableError()
        if (lockedSource.version !== input.sourceApplication.version) throw new ApplicationCopySourceChangedError()

        const insertedRows = await trx.query<ApplicationRecord>(
            `
            INSERT INTO applications.obj_applications (
                id,
                name,
                description,
                settings,
                is_public,
                show_in_app_list,
                workspaces_enabled,
                schema_name,
                schema_status,
                schema_synced_at,
                schema_error,
                schema_snapshot,
                app_structure_version,
                last_synced_publication_version_id,
                _upl_created_by,
                _upl_updated_by
            )
            VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6, $7, $8, $9::applications.application_schema_status, NULL, NULL, NULL, NULL, NULL, $10, $11)
            RETURNING ${APPLICATION_RETURNING}
            `,
            [
                input.newApplicationId,
                JSON.stringify(input.copiedName),
                JSON.stringify(input.copiedDescription),
                JSON.stringify(input.settings ?? {}),
                input.isPublic,
                input.showInAppList ?? input.sourceApplication.showInAppList,
                input.workspacesEnabled,
                input.schemaName,
                input.schemaStatus,
                input.actorUserId,
                input.actorUserId
            ]
        )

        await trx.query(
            `
            INSERT INTO applications.rel_application_users (
                application_id,
                user_id,
                role,
                _upl_created_by,
                _upl_updated_by
            )
            VALUES ($1, $2, 'owner', $3, $4)
            `,
            [input.newApplicationId, input.actorUserId, input.actorUserId, input.actorUserId]
        )

        await recordApplicationControlAudit(trx, {
            applicationId: input.newApplicationId,
            eventType: 'catalog_visibility_initialized',
            newVersion: insertedRows[0]?.version ?? 1,
            newShowInAppList: input.showInAppList ?? input.sourceApplication.showInAppList
        })

        if (input.copyAccess) {
            await trx.query(
                `
                INSERT INTO applications.rel_application_users (
                    application_id,
                    user_id,
                    role,
                    comment,
                    _upl_created_by,
                    _upl_updated_by
                )
                SELECT
                    $1,
                    user_id,
                    CASE
                        WHEN role = 'owner' THEN 'admin'
                        ELSE role
                    END,
                    comment,
                    $2,
                    $3
                FROM applications.rel_application_users
                WHERE application_id = $4
                  AND user_id <> $5
                                    AND ${activeRowPredicate()}
                `,
                [input.newApplicationId, input.actorUserId, input.actorUserId, input.sourceApplicationId, input.actorUserId]
            )
        }

        if (input.copyConnector) {
            await trx.query(
                `
                WITH source_connectors AS (
                    SELECT
                        public.uuid_generate_v7() AS new_id,
                        id AS source_id,
                        name,
                        description,
                        sort_order,
                        is_single_metahub,
                        is_required_metahub
                    FROM applications.obj_connectors
                    WHERE application_id = $1
                                            AND ${activeRowPredicate()}
                    ORDER BY sort_order ASC, _upl_created_at ASC, id ASC
                ),
                inserted_connectors AS (
                    INSERT INTO applications.obj_connectors (
                        id,
                        application_id,
                        name,
                        description,
                        sort_order,
                        is_single_metahub,
                        is_required_metahub,
                        _upl_created_by,
                        _upl_updated_by
                    )
                    SELECT
                        new_id,
                        $2,
                        name,
                        description,
                        sort_order,
                        is_single_metahub,
                        is_required_metahub,
                        $3,
                        $4
                    FROM source_connectors
                )
                INSERT INTO applications.rel_connector_publications (
                    connector_id,
                    publication_id,
                    sort_order,
                    schema_options,
                    _upl_created_by,
                    _upl_updated_by
                )
                    SELECT
                        sc.new_id,
                        cp.publication_id,
                        cp.sort_order,
                        cp.schema_options,
                        $3,
                        $4
                FROM source_connectors sc
                JOIN applications.rel_connector_publications cp ON cp.connector_id = sc.source_id
                                WHERE ${activeRowPredicate('cp')}
                `,
                [input.sourceApplicationId, input.newApplicationId, input.actorUserId, input.actorUserId]
            )
        }

        return insertedRows[0]
    })
}
