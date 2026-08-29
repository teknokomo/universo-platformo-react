import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { qSchemaTable } from '@universo-react/database'
import type { DbExecutor } from '@universo-react/utils'
import { generateUuidV7 } from '@universo-react/utils'
import {
    PLAYCANVAS_EDITOR_BRIDGE_SESSION_TTL_MS,
    playCanvasEditorBridgeSessionClaimsSchema,
    type PlayCanvasEditorBridgeCapability,
    type PlayCanvasEditorBridgeSessionClaims
} from '@universo-react/types'

type BridgeSessionPayload = PlayCanvasEditorBridgeSessionClaims

interface BridgeReplayValue {
    sessionId: string
    metahubId: string
    projectId: string | null
    requestId: string
    commandType: string
    fingerprint: string
    expiresAt: number
    userIdHash: string
    status: 'claimed' | 'completed'
    claimedAt?: number
    response?: unknown
}

// Successful mutations retain their replay claim for a bounded recovery
// window. This prevents a temporary response-write failure from making the
// already-committed mutation executable a second time.
const REPLAY_CLAIM_RETENTION_MS = 24 * 60 * 60 * 1000
const REPLAY_RECOVERY_LEASE_MS = 5 * 60 * 1000

// Replay rows are stored as JSONB because the table is shared with other
// application settings. Treat malformed or out-of-range legacy timestamps as
// expired instead of allowing PostgreSQL's bigint cast to abort the cleanup
// query with 22P02/22003 and turn an otherwise recoverable request into 500.
const replayExpiresAtSql = `(CASE
                    WHEN value->>'expiresAt' ~ '^[0-9]+$'
                         AND (
                             length(value->>'expiresAt') < 19
                             OR (
                                 length(value->>'expiresAt') = 19
                                 AND value->>'expiresAt' <= '9223372036854775807'
                             )
                         )
                    THEN (value->>'expiresAt')::bigint
                    ELSE 0
                END)`

const resolveHmacSecret = (specificEnvName: string, fallbackLabel: string, cachedDevelopmentSecret: string | null): string => {
    const specific = process.env[specificEnvName]
    const fallback = process.env.SESSION_SECRET ?? process.env.SUPABASE_JWT_SECRET
    const resolved = specific ?? fallback
    if (resolved) {
        return resolved
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error(`${specificEnvName}, SESSION_SECRET, or SUPABASE_JWT_SECRET must be configured in production`)
    }
    return cachedDevelopmentSecret ?? `dev-${fallbackLabel}-${randomUUID()}`
}

let bridgeDevelopmentSecret: string | null = null

const getBridgeSecret = (): string => {
    const secret = resolveHmacSecret('PLAYCANVAS_EDITOR_BRIDGE_SECRET', 'playcanvas-editor-bridge', bridgeDevelopmentSecret)
    if (!process.env.PLAYCANVAS_EDITOR_BRIDGE_SECRET && !process.env.SESSION_SECRET && !process.env.SUPABASE_JWT_SECRET) {
        bridgeDevelopmentSecret = secret
    }
    return secret
}

const sign = (encodedPayload: string): string => createHmac('sha256', getBridgeSecret()).update(encodedPayload).digest('base64url')

const encode = (value: unknown): string => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')

const decode = <T>(value: string): T | null => {
    try {
        return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T
    } catch {
        return null
    }
}

const timingSafeEqualString = (left: string, right: string): boolean => {
    const leftBuffer = Buffer.from(left)
    const rightBuffer = Buffer.from(right)
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

const buildReplayKey = (input: { sessionId: string; commandType: string; requestId: string }): string => {
    const replayIdentity = `${input.sessionId}:${input.commandType}:${input.requestId}`
    return `pc.eb.replay.${createHash('sha256').update(replayIdentity).digest('hex')}`
}

const hashAuditUserId = (userId: string): string => createHash('sha256').update(userId).digest('hex')

const normalizeBridgeOrigin = (value: unknown): string | null => {
    if (typeof value !== 'string') return null
    try {
        const parsed = new URL(value)
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return null
        return parsed.origin
    } catch {
        return null
    }
}

export interface CreatedPlayCanvasEditorBridgeSession {
    payload: BridgeSessionPayload
    token: string
}

/**
 * The bridge session registry is intentionally process-local for the signed
 * browser bridge itself, but it must retain the complete binding while the
 * session is alive.  A bare session id is not an authorization credential:
 * refreshes use this registry to prove that the id was issued for the same
 * metahub/project/user (and that it has not expired).
 */
const liveBridgeSessionsGlobalKey = '__universoPlayCanvasEditorBridgeSessions'
const liveBridgeSessions = (() => {
    const globalScope = globalThis as typeof globalThis & {
        [liveBridgeSessionsGlobalKey]?: Map<string, BridgeSessionPayload>
    }
    const existing = globalScope[liveBridgeSessionsGlobalKey]
    if (existing) return existing
    const registry = new Map<string, BridgeSessionPayload>()
    Object.defineProperty(globalScope, liveBridgeSessionsGlobalKey, {
        value: registry,
        enumerable: false,
        configurable: false,
        writable: false
    })
    return registry
})()
const MAX_LIVE_BRIDGE_SESSIONS = 10_000

const pruneLiveBridgeSessions = (now: number): void => {
    for (const [sessionId, payload] of liveBridgeSessions) {
        if (payload.expiresAt <= now) {
            liveBridgeSessions.delete(sessionId)
        }
    }
}

export class PlayCanvasEditorBridgeSessionService {
    create(input: {
        metahubId: string
        packageSlug: string
        projectId: string | null
        defaultSceneId?: string | null
        userId: string
        capabilities: PlayCanvasEditorBridgeCapability[]
        origin?: string
    }): CreatedPlayCanvasEditorBridgeSession {
        const origin = input.origin === undefined ? null : normalizeBridgeOrigin(input.origin)
        if (input.origin !== undefined && !origin) {
            throw new Error('PlayCanvas Editor bridge sessions require a canonical HTTP(S) origin')
        }
        const payload: BridgeSessionPayload = {
            sessionId: generateUuidV7(),
            metahubId: input.metahubId,
            packageSlug: input.packageSlug,
            projectId: input.projectId,
            defaultSceneId: input.defaultSceneId ?? null,
            userId: input.userId,
            nonce: generateUuidV7().replace(/-/g, '') + generateUuidV7().replace(/-/g, ''),
            expiresAt: Date.now() + PLAYCANVAS_EDITOR_BRIDGE_SESSION_TTL_MS,
            bridgeVersion: '1',
            capabilities: input.capabilities,
            ...(origin ? { origin } : {})
        }
        pruneLiveBridgeSessions(Date.now())
        if (liveBridgeSessions.size >= MAX_LIVE_BRIDGE_SESSIONS) {
            const oldest = [...liveBridgeSessions.entries()]
                .sort(([, left], [, right]) => left.expiresAt - right.expiresAt)
                .slice(0, liveBridgeSessions.size - MAX_LIVE_BRIDGE_SESSIONS + 1)
            for (const [sessionId] of oldest) liveBridgeSessions.delete(sessionId)
        }
        liveBridgeSessions.set(payload.sessionId, payload)
        const encoded = encode(payload)
        return {
            payload,
            token: `${encoded}.${sign(encoded)}`
        }
    }

    /**
     * Sliding liveness renew for in-flight editor bridge sessions. The signed
     * session token keeps its own fixed expiry; this registry only records that
     * the backend recently observed the session alive so the artifact-token
     * grace window can fail closed once the session dies.
     */
    touch(sessionId: string): boolean {
        const now = Date.now()
        const current = liveBridgeSessions.get(sessionId)
        if (!current || current.expiresAt <= now) {
            liveBridgeSessions.delete(sessionId)
            return false
        }
        liveBridgeSessions.set(sessionId, {
            ...current,
            expiresAt: now + PLAYCANVAS_EDITOR_BRIDGE_SESSION_TTL_MS
        })
        return true
    }

    isAlive(sessionId: string): boolean {
        const now = Date.now()
        const current = liveBridgeSessions.get(sessionId)
        if (!current) {
            return false
        }
        if (current.expiresAt <= now) {
            liveBridgeSessions.delete(sessionId)
            return false
        }
        return true
    }

    /**
     * Validates a refresh id against the original signed bridge binding.  The
     * caller still performs the artifact-origin check separately; this method
     * only answers whether the id belongs to the requested principal/scope.
     */
    validate(input: { sessionId: string; metahubId: string; projectId: string; sceneId: string; userId: string; origin: string }): boolean {
        const now = Date.now()
        pruneLiveBridgeSessions(now)
        const payload = liveBridgeSessions.get(input.sessionId)
        if (!payload || payload.expiresAt <= now) {
            return false
        }
        return (
            payload.metahubId === input.metahubId &&
            payload.projectId === input.projectId &&
            payload.defaultSceneId === input.sceneId &&
            payload.userId === input.userId &&
            payload.origin !== undefined &&
            payload.origin === normalizeBridgeOrigin(input.origin)
        )
    }

    read(token: string): BridgeSessionPayload | null {
        const [encodedPayload, signature, extra] = token.split('.')
        if (!encodedPayload || !signature || extra) {
            return null
        }
        if (!timingSafeEqualString(sign(encodedPayload), signature)) {
            return null
        }
        const payload = decode<unknown>(encodedPayload)
        const parsed = playCanvasEditorBridgeSessionClaimsSchema.safeParse(payload)
        if (!parsed.success || parsed.data.expiresAt <= Date.now()) {
            return null
        }
        return parsed.data
    }

    async claimReplay(
        exec: DbExecutor,
        _schemaName: string,
        input: {
            sessionId: string
            metahubId: string
            projectId: string | null
            requestId: string
            commandType: string
            fingerprint: string
            expiresAt: number
            userId: string
        }
    ): Promise<boolean> {
        const table = qSchemaTable('metahubs', '_app_settings')
        const key = buildReplayKey(input)
        const now = Date.now()
        const value = {
            sessionId: input.sessionId,
            metahubId: input.metahubId,
            projectId: input.projectId,
            requestId: input.requestId,
            commandType: input.commandType,
            fingerprint: input.fingerprint,
            expiresAt: Math.max(input.expiresAt, now + REPLAY_CLAIM_RETENTION_MS),
            userIdHash: hashAuditUserId(input.userId),
            status: 'claimed' as const,
            claimedAt: now
        }
        await exec.query(
            `DELETE FROM ${table}
              WHERE key LIKE 'pc.eb.replay.%'
                AND (
                    (value->>'status' = 'completed' AND ${replayExpiresAtSql} <= $1)
                    OR
                    (value->>'status' = 'claimed' AND ${replayExpiresAtSql} <= $2)
                    OR
                    (NOT jsonb_exists(value, 'status') AND ${replayExpiresAtSql} <= $1)
                )`,
            [now, now - REPLAY_CLAIM_RETENTION_MS]
        )
        const rows = await exec.query<{ id: string }>(
            `INSERT INTO ${table}
                (id, key, value, _upl_created_by, _upl_updated_by)
             VALUES ($1, $2, $3::jsonb, NULL, NULL)
             ON CONFLICT (key) DO NOTHING
             RETURNING id`,
            [generateUuidV7(), key, JSON.stringify(value)]
        )
        return rows.length > 0
    }

    async readReplayResponse(
        exec: DbExecutor,
        _schemaName: string,
        input: {
            sessionId: string
            metahubId: string
            projectId: string | null
            requestId: string
            commandType: string
            fingerprint: string
            userId: string
        }
    ): Promise<{ status: 'claimed' | 'completed'; claimedAt?: number; response?: unknown } | null> {
        const table = qSchemaTable('metahubs', '_app_settings')
        const rows = await exec.query<{ value: BridgeReplayValue }>(
            `SELECT value
               FROM ${table}
              WHERE key = $1
                AND value->>'sessionId' = $2
                AND value->>'requestId' = $3
                AND value->>'commandType' = $4
                AND value->>'fingerprint' = $5
                AND value->>'userIdHash' = $6
                AND value->>'metahubId' = $7
                AND jsonb_exists(value, 'projectId')
                AND value->>'projectId' IS NOT DISTINCT FROM $8
              LIMIT 1`,
            [
                buildReplayKey(input),
                input.sessionId,
                input.requestId,
                input.commandType,
                input.fingerprint,
                hashAuditUserId(input.userId),
                input.metahubId,
                input.projectId
            ]
        )
        const value = rows[0]?.value
        if (!value || (value.status !== 'claimed' && value.status !== 'completed')) {
            return null
        }
        return value.status === 'completed'
            ? { status: value.status, response: value.response }
            : { status: value.status, ...(typeof value.claimedAt === 'number' ? { claimedAt: value.claimedAt } : {}) }
    }

    /**
     * A claimed replay may outlive the worker that created it. Recovery is
     * deliberately lease-based: callers must first prove the mutation is
     * already durable (or re-run a read-only command) before completing it.
     * Rows without a timestamp are treated as legacy and remain fail-closed.
     */
    isReplayClaimRecoverable(replay: { status: 'claimed' | 'completed'; claimedAt?: number }): boolean {
        return (
            replay.status === 'claimed' && typeof replay.claimedAt === 'number' && Date.now() - replay.claimedAt >= REPLAY_RECOVERY_LEASE_MS
        )
    }

    async completeReplay(
        exec: DbExecutor,
        _schemaName: string,
        input: {
            sessionId: string
            metahubId: string
            projectId: string | null
            requestId: string
            commandType: string
            fingerprint: string
            response: unknown
            userId: string
        }
    ): Promise<boolean> {
        const table = qSchemaTable('metahubs', '_app_settings')
        const completeOnce = async (): Promise<boolean> => {
            const rows = await exec.query<{ id: string }>(
                `INSERT INTO ${table}
                (id, key, value, _upl_created_by, _upl_updated_by)
             VALUES (
                $1,
                $2,
                $3::jsonb,
                NULL,
                NULL
             )
             ON CONFLICT (key) DO UPDATE
                SET value = jsonb_set(jsonb_set(${table}.value, '{response}', $11::jsonb, true), '{status}', '"completed"'::jsonb, true),
                    _upl_updated_by = NULL,
                    _upl_updated_at = NOW(),
                    _upl_version = ${table}._upl_version + 1
              WHERE ${table}.value->>'sessionId' = $4
                AND ${table}.value->>'requestId' = $5
                AND ${table}.value->>'commandType' = $6
                AND ${table}.value->>'fingerprint' = $7
                AND ${table}.value->>'userIdHash' = $8
                AND ${table}.value->>'metahubId' = $9
                AND jsonb_exists(${table}.value, 'projectId')
                AND ${table}.value->>'projectId' IS NOT DISTINCT FROM $10
              RETURNING id`,
                [
                    generateUuidV7(),
                    buildReplayKey(input),
                    JSON.stringify({
                        sessionId: input.sessionId,
                        metahubId: input.metahubId,
                        projectId: input.projectId,
                        requestId: input.requestId,
                        commandType: input.commandType,
                        fingerprint: input.fingerprint,
                        expiresAt: Date.now() + REPLAY_CLAIM_RETENTION_MS,
                        userIdHash: hashAuditUserId(input.userId),
                        status: 'completed',
                        claimedAt: Date.now(),
                        response: input.response
                    } satisfies BridgeReplayValue),
                    input.sessionId,
                    input.requestId,
                    input.commandType,
                    input.fingerprint,
                    hashAuditUserId(input.userId),
                    input.metahubId,
                    input.projectId,
                    JSON.stringify(input.response)
                ]
            )
            return rows.length > 0
        }
        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                if (await completeOnce()) return true
            } catch (error) {
                if (attempt === 2) throw error
            }
            await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)))
        }
        return false
    }

    async releaseReplay(
        exec: DbExecutor,
        _schemaName: string,
        input: {
            sessionId: string
            metahubId: string
            projectId: string | null
            requestId: string
            commandType: string
            fingerprint: string
            userId: string
        }
    ): Promise<void> {
        const table = qSchemaTable('metahubs', '_app_settings')
        await exec.query(
            `DELETE FROM ${table}
              WHERE key = $1
                AND value->>'sessionId' = $2
                AND value->>'requestId' = $3
                AND value->>'commandType' = $4
                AND value->>'fingerprint' = $5
                AND value->>'userIdHash' = $6
                AND value->>'metahubId' = $7
                AND jsonb_exists(value, 'projectId')
                AND value->>'projectId' IS NOT DISTINCT FROM $8`,
            [
                buildReplayKey(input),
                input.sessionId,
                input.requestId,
                input.commandType,
                input.fingerprint,
                hashAuditUserId(input.userId),
                input.metahubId,
                input.projectId
            ]
        )
    }

    async hasActiveReplayClaims(exec: DbExecutor, _schemaName: string, input: { metahubId: string; projectId: string }): Promise<boolean> {
        const table = qSchemaTable('metahubs', '_app_settings')
        const now = Date.now()
        await exec.query(
            `DELETE FROM ${table}
              WHERE key LIKE 'pc.eb.replay.%'
                AND (
                    (value->>'status' = 'completed' AND ${replayExpiresAtSql} <= $1)
                    OR
                    (value->>'status' = 'claimed' AND ${replayExpiresAtSql} <= $2)
                    OR
                    (NOT jsonb_exists(value, 'status') AND ${replayExpiresAtSql} <= $1)
                )`,
            [now, now - REPLAY_CLAIM_RETENTION_MS]
        )
        const rows = await exec.query<{ exists: boolean }>(
            `SELECT EXISTS (
                SELECT 1
                  FROM ${table}
                WHERE key LIKE 'pc.eb.replay.%'
                   AND value->>'status' = 'claimed'
                   AND ${replayExpiresAtSql} > $1
                   AND (
                        (value->>'metahubId' = $2 AND value->>'projectId' = $3)
                        OR NOT jsonb_exists(value, 'metahubId')
                        OR NOT jsonb_exists(value, 'projectId')
                   )
                 LIMIT 1
             ) AS "exists"`,
            [now, input.metahubId, input.projectId]
        )
        return rows[0]?.exists === true
    }
}
