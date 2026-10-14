import { qColumn, qSchemaTable } from '@universo-react/database'
import { isUuidV7, type SqlQueryable } from '@universo-react/utils'

const GUEST_SESSION_IDEMPOTENCY_TABLE = qSchemaTable('applications', 'obj_guest_session_idempotency')
const APPLICATION_TABLE = qSchemaTable('applications', 'obj_applications')

export interface GuestSessionIdempotencyRecord {
    idempotencyKeyHash: string
    payloadHash: string
    applicationId: string
    accessLinkId: string
    workspaceId: string | null
    participantId: string
    expiresAt: string
    secretNonce: Buffer | Uint8Array
    secretCiphertext: Buffer | Uint8Array
    secretAuthTag: Buffer | Uint8Array
}

export type NewGuestSessionIdempotencyRecord = Omit<GuestSessionIdempotencyRecord, 'idempotencyKeyHash'> & {
    idempotencyKeyHash: string
}

export async function findGuestSessionIdempotency(
    executor: SqlQueryable,
    idempotencyKeyHash: string
): Promise<GuestSessionIdempotencyRecord | null> {
    const rows = await executor.query<GuestSessionIdempotencyRecord>(
        `
        SELECT idempotency_key_hash AS "idempotencyKeyHash",
               payload_hash AS "payloadHash",
               application_id AS "applicationId",
               access_link_id AS "accessLinkId",
               workspace_id AS "workspaceId",
               participant_id AS "participantId",
               expires_at AS "expiresAt",
               secret_nonce AS "secretNonce",
               secret_ciphertext AS "secretCiphertext",
               secret_auth_tag AS "secretAuthTag"
        FROM ${GUEST_SESSION_IDEMPOTENCY_TABLE}
        WHERE idempotency_key_hash = $1
          AND expires_at > NOW()
        `,
        [idempotencyKeyHash]
    )

    return rows[0] ?? null
}

export async function deleteExpiredGuestSessionIdempotency(executor: SqlQueryable, idempotencyKeyHash: string): Promise<void> {
    await executor.query(
        `
        DELETE FROM ${GUEST_SESSION_IDEMPOTENCY_TABLE}
        WHERE idempotency_key_hash = $1
          AND expires_at <= NOW()
        `,
        [idempotencyKeyHash]
    )
}

export async function revokeGuestSessionIdempotencyForApplication(executor: SqlQueryable, applicationId: string): Promise<number> {
    const rows = await executor.query<{ id: string }>(
        `
        DELETE FROM ${GUEST_SESSION_IDEMPOTENCY_TABLE}
        WHERE application_id = $1
        RETURNING id
        `,
        [applicationId]
    )

    return rows.length
}

export async function revokeGuestSessionIdempotencyForWorkspace(
    executor: SqlQueryable,
    applicationId: string,
    workspaceId: string,
    schemaName: string
): Promise<number> {
    const rows = await executor.query<{ id: string }>(
        `
        DELETE FROM ${GUEST_SESSION_IDEMPOTENCY_TABLE} AS replay
        WHERE replay.${qColumn('application_id')} = $1
          AND replay.${qColumn('workspace_id')} = $2
          AND EXISTS (
            SELECT 1
            FROM ${APPLICATION_TABLE} AS application
            WHERE application.${qColumn('id')} = replay.${qColumn('application_id')}
              AND application.${qColumn('schema_name')} = $3
              AND application.${qColumn('_upl_deleted')} = false
              AND application.${qColumn('_app_deleted')} = false
          )
        RETURNING replay.${qColumn('id')} AS id
        `,
        [applicationId, workspaceId, schemaName]
    )

    return rows.length
}

export async function revokeGuestSessionIdempotencyForAccessLink(
    executor: SqlQueryable,
    applicationId: string,
    accessLinkId: string,
    workspaceId: string | null
): Promise<number> {
    if (!isUuidV7(applicationId)) throw new TypeError('applicationId must be a UUID v7')
    if (!isUuidV7(accessLinkId)) throw new TypeError('accessLinkId must be a UUID v7')
    if (workspaceId !== null && !isUuidV7(workspaceId)) throw new TypeError('workspaceId must be a UUID v7')

    const workspacePredicate = workspaceId === null ? 'AND workspace_id IS NULL' : 'AND workspace_id = $3'
    const parameters = workspaceId === null ? [applicationId, accessLinkId] : [applicationId, accessLinkId, workspaceId]
    const rows = await executor.query<{ id: string }>(
        `
        DELETE FROM ${GUEST_SESSION_IDEMPOTENCY_TABLE}
        WHERE application_id = $1
          AND access_link_id = $2
          ${workspacePredicate}
        RETURNING id
        `,
        parameters
    )

    return rows.length
}

export async function purgeExpiredGuestSessionIdempotency(executor: SqlQueryable, limit = 100): Promise<number> {
    const boundedLimit = Math.max(1, Math.min(Number.isFinite(limit) ? Math.trunc(limit) : 100, 500))
    const rows = await executor.query<{ id: string }>(
        `
        DELETE FROM ${GUEST_SESSION_IDEMPOTENCY_TABLE} AS expired
        WHERE expired.${qColumn('idempotency_key_hash')} IN (
            SELECT idempotency_key_hash
            FROM ${GUEST_SESSION_IDEMPOTENCY_TABLE}
            WHERE expires_at <= NOW()
            ORDER BY expires_at ASC
            LIMIT $1
            FOR UPDATE SKIP LOCKED
        )
        RETURNING expired.${qColumn('id')} AS id
        `,
        [boundedLimit]
    )
    return rows.length
}

export async function insertGuestSessionIdempotency(executor: SqlQueryable, record: NewGuestSessionIdempotencyRecord): Promise<void> {
    await executor.query(
        `
        INSERT INTO ${GUEST_SESSION_IDEMPOTENCY_TABLE} (
            idempotency_key_hash,
            payload_hash,
            application_id,
            access_link_id,
            workspace_id,
            participant_id,
            expires_at,
            secret_nonce,
            secret_ciphertext,
            secret_auth_tag
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
            record.idempotencyKeyHash,
            record.payloadHash,
            record.applicationId,
            record.accessLinkId,
            record.workspaceId,
            record.participantId,
            record.expiresAt,
            record.secretNonce,
            record.secretCiphertext,
            record.secretAuthTag
        ]
    )
}
