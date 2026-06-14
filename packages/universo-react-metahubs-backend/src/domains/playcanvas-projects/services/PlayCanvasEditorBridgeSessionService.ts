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
    response?: unknown
}

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

export interface CreatedPlayCanvasEditorBridgeSession {
    payload: BridgeSessionPayload
    token: string
}

export class PlayCanvasEditorBridgeSessionService {
    create(input: {
        metahubId: string
        packageSlug: string
        projectId: string | null
        defaultSceneId?: string | null
        userId: string
        capabilities: PlayCanvasEditorBridgeCapability[]
    }): CreatedPlayCanvasEditorBridgeSession {
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
            capabilities: input.capabilities
        }
        const encoded = encode(payload)
        return {
            payload,
            token: `${encoded}.${sign(encoded)}`
        }
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
        const value = {
            sessionId: input.sessionId,
            metahubId: input.metahubId,
            projectId: input.projectId,
            requestId: input.requestId,
            commandType: input.commandType,
            fingerprint: input.fingerprint,
            expiresAt: input.expiresAt,
            userIdHash: hashAuditUserId(input.userId),
            status: 'claimed' as const
        }
        await exec.query(
            `DELETE FROM ${table}
              WHERE key LIKE 'pc.eb.replay.%'
                AND COALESCE((value->>'expiresAt')::bigint, 0) <= $1`,
            [Date.now()]
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
    ): Promise<{ status: 'claimed' | 'completed'; response?: unknown } | null> {
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
        return value.status === 'completed' ? { status: value.status, response: value.response } : { status: value.status }
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
                    expiresAt: Date.now() + PLAYCANVAS_EDITOR_BRIDGE_SESSION_TTL_MS,
                    userIdHash: hashAuditUserId(input.userId),
                    status: 'completed',
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
        await exec.query(
            `DELETE FROM ${table}
              WHERE key LIKE 'pc.eb.replay.%'
                AND COALESCE((value->>'expiresAt')::bigint, 0) <= $1`,
            [Date.now()]
        )
        const rows = await exec.query<{ exists: boolean }>(
            `SELECT EXISTS (
                SELECT 1
                  FROM ${table}
                 WHERE key LIKE 'pc.eb.replay.%'
                   AND value->>'status' = 'claimed'
                   AND COALESCE((value->>'expiresAt')::bigint, 0) > $1
                   AND (
                        (value->>'metahubId' = $2 AND value->>'projectId' = $3)
                        OR NOT jsonb_exists(value, 'metahubId')
                        OR NOT jsonb_exists(value, 'projectId')
                   )
                 LIMIT 1
             ) AS "exists"`,
            [Date.now(), input.metahubId, input.projectId]
        )
        return rows[0]?.exists === true
    }
}
