import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { qSchemaTable } from '@universo-react/database'
import type { DbExecutor } from '@universo-react/utils'
import { generateUuidV7 } from '@universo-react/utils'
import { PLAYCANVAS_EDITOR_BRIDGE_SESSION_TTL_MS, type PlayCanvasEditorBridgeCapability } from '@universo-react/types'

interface BridgeSessionPayload {
    sessionId: string
    metahubId: string
    packageSlug: string
    projectId: string | null
    defaultSceneId?: string | null
    userId: string
    nonce: string
    expiresAt: number
    bridgeVersion: '1'
    capabilities: PlayCanvasEditorBridgeCapability[]
}

interface BridgeReplayValue {
    sessionId: string
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
        const payload = decode<Partial<BridgeSessionPayload>>(encodedPayload)
        if (
            !payload ||
            typeof payload.sessionId !== 'string' ||
            typeof payload.metahubId !== 'string' ||
            typeof payload.packageSlug !== 'string' ||
            (payload.projectId !== null && typeof payload.projectId !== 'string') ||
            (payload.defaultSceneId !== undefined && payload.defaultSceneId !== null && typeof payload.defaultSceneId !== 'string') ||
            typeof payload.userId !== 'string' ||
            typeof payload.nonce !== 'string' ||
            typeof payload.expiresAt !== 'number' ||
            payload.expiresAt <= Date.now() ||
            payload.bridgeVersion !== '1' ||
            !Array.isArray(payload.capabilities)
        ) {
            return null
        }
        return payload as BridgeSessionPayload
    }

    async claimReplay(
        exec: DbExecutor,
        _schemaName: string,
        input: { sessionId: string; requestId: string; commandType: string; fingerprint: string; expiresAt: number; userId: string }
    ): Promise<boolean> {
        const table = qSchemaTable('metahubs', '_app_settings')
        const key = buildReplayKey(input)
        const value = {
            sessionId: input.sessionId,
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
        input: { sessionId: string; requestId: string; commandType: string; fingerprint: string }
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
              LIMIT 1`,
            [buildReplayKey(input), input.sessionId, input.requestId, input.commandType, input.fingerprint]
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
        input: { sessionId: string; requestId: string; commandType: string; fingerprint: string; response: unknown; userId: string }
    ): Promise<boolean> {
        const table = qSchemaTable('metahubs', '_app_settings')
        const rows = await exec.query<{ id: string }>(
            `UPDATE ${table}
                SET value = jsonb_set(jsonb_set(value, '{response}', $6::jsonb, true), '{status}', '"completed"'::jsonb, true),
                    _upl_updated_by = NULL,
                    _upl_updated_at = NOW(),
                    _upl_version = _upl_version + 1
              WHERE key = $1
                AND value->>'sessionId' = $2
                AND value->>'requestId' = $3
                AND value->>'commandType' = $4
                AND value->>'fingerprint' = $5
              RETURNING id`,
            [buildReplayKey(input), input.sessionId, input.requestId, input.commandType, input.fingerprint, JSON.stringify(input.response)]
        )
        return rows.length > 0
    }

    async releaseReplay(
        exec: DbExecutor,
        _schemaName: string,
        input: { sessionId: string; requestId: string; commandType: string; fingerprint: string }
    ): Promise<void> {
        const table = qSchemaTable('metahubs', '_app_settings')
        await exec.query(
            `DELETE FROM ${table}
              WHERE key = $1
                AND value->>'sessionId' = $2
                AND value->>'requestId' = $3
                AND value->>'commandType' = $4
                AND value->>'fingerprint' = $5`,
            [buildReplayKey(input), input.sessionId, input.requestId, input.commandType, input.fingerprint]
        )
    }
}
