import { qColumn, qSchemaTable } from '@universo-react/database'
import { type SqlQueryable } from '@universo-react/utils'

/**
 * Platform-schema store for runtime economy trade idempotency (plan D7/B7).
 * Mirrors the guest persistence access pattern: a fixed `applications.obj_*`
 * table reached through any executor (`DbExecutor`/transaction) with raw
 * parameterized SQL — never an application schema.
 *
 * The table is created by the `CreateEconomyIdempotency` platform migration;
 * the UNIQUE (application_id, user_id, key_hash) constraint scopes a leaked
 * key to one user of one application and is the replay-race safety net.
 */
const ECONOMY_IDEMPOTENCY_TABLE = qSchemaTable('applications', 'obj_economy_idempotency')

const KEY_HASH_PATTERN = /^[a-f0-9]{64}$/u

export interface EconomyIdempotencyRecord {
    applicationId: string
    userId: string
    workspaceId: string | null
    keyHash: string
    bodyFingerprint: string
    response: unknown
    statusCode: number
    expiresAt: string
}

export type NewEconomyIdempotencyRecord = Omit<EconomyIdempotencyRecord, 'expiresAt'> & {
    /** ISO timestamp after which the record stops serving replays. */
    expiresAt: string
}

export interface EconomyIdempotencyScope {
    applicationId: string
    userId: string
    keyHash: string
}

export interface StoredEconomyIdempotency {
    bodyFingerprint: string
    response: unknown
    statusCode: number
    expiresAt: string
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const assertScope = (scope: EconomyIdempotencyScope): void => {
    // applicationId/user_id are externally issued identifiers (application rows and
    // Supabase auth subjects — not necessarily UUID v7); only key_hash is ours.
    if (!UUID_PATTERN.test(scope.applicationId)) throw new TypeError('applicationId must be a UUID')
    if (!UUID_PATTERN.test(scope.userId)) throw new TypeError('userId must be a UUID')
    if (!KEY_HASH_PATTERN.test(scope.keyHash)) throw new TypeError('keyHash must be a sha256 hex digest')
}

export async function findEconomyIdempotency(
    executor: SqlQueryable,
    scope: EconomyIdempotencyScope
): Promise<StoredEconomyIdempotency | null> {
    assertScope(scope)
    const rows = await executor.query<StoredEconomyIdempotency>(
        `
        SELECT body_fingerprint AS "bodyFingerprint",
               response,
               status_code AS "statusCode",
               expires_at AS "expiresAt"
        FROM ${ECONOMY_IDEMPOTENCY_TABLE}
        WHERE application_id = $1
          AND user_id = $2
          AND key_hash = $3
          AND expires_at > NOW()
        LIMIT 1
        `,
        [scope.applicationId, scope.userId, scope.keyHash]
    )

    return rows[0] ?? null
}

/**
 * Persist a response for replay. A LIVE (unexpired) row under the scoped unique
 * index wins: the insert becomes a no-op and callers re-select to replay the
 * winner's response instead of double-executing the trade. An EXPIRED row is
 * replaced atomically — otherwise the hidden-by-`findEconomyIdempotency` row
 * would permanently block re-recording (fail-open double execution on retries
 * after the best-effort purge missed it).
 */
export async function saveEconomyIdempotency(executor: SqlQueryable, record: NewEconomyIdempotencyRecord): Promise<boolean> {
    assertScope(record)
    if (!KEY_HASH_PATTERN.test(record.bodyFingerprint)) throw new TypeError('bodyFingerprint must be a sha256 hex digest')
    if (!Number.isInteger(record.statusCode) || record.statusCode < 200 || record.statusCode > 599) {
        throw new TypeError('statusCode must be an HTTP status code')
    }
    if (record.workspaceId !== null && !UUID_PATTERN.test(record.workspaceId)) throw new TypeError('workspaceId must be a UUID or null')

    const rows = await executor.query<{ id: string }>(
        `
        INSERT INTO ${ECONOMY_IDEMPOTENCY_TABLE} (
            application_id,
            user_id,
            workspace_id,
            key_hash,
            body_fingerprint,
            response,
            status_code,
            expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::timestamptz)
        ON CONFLICT (application_id, user_id, key_hash) DO UPDATE
        SET workspace_id = EXCLUDED.workspace_id,
            body_fingerprint = EXCLUDED.body_fingerprint,
            response = EXCLUDED.response,
            status_code = EXCLUDED.status_code,
            expires_at = EXCLUDED.expires_at,
            created_at = NOW()
        WHERE ${ECONOMY_IDEMPOTENCY_TABLE}.expires_at <= NOW()
        RETURNING ${qColumn('id')}
        `,
        [
            record.applicationId,
            record.userId,
            record.workspaceId,
            record.keyHash,
            record.bodyFingerprint,
            JSON.stringify(record.response),
            record.statusCode,
            record.expiresAt
        ]
    )

    return rows.length > 0
}

/**
 * Batched expiry purge. Uses `FOR UPDATE SKIP LOCKED` like the guest store so
 * concurrent maintenance workers never block each other. Returns the number of
 * deleted rows (fail-closed: callers treat an SQL error as a purge failure).
 */
export async function purgeExpiredEconomyIdempotency(executor: SqlQueryable, limit = 100): Promise<number> {
    const boundedLimit = Math.max(1, Math.min(Number.isFinite(limit) ? Math.trunc(limit) : 100, 500))
    const rows = await executor.query<{ id: string }>(
        `
        DELETE FROM ${ECONOMY_IDEMPOTENCY_TABLE} AS expired
        WHERE expired.${qColumn('id')} IN (
            SELECT id
            FROM ${ECONOMY_IDEMPOTENCY_TABLE}
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
