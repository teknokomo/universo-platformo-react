import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import type { Request } from 'express'
import type { PlayCanvasEditorCompatibilityTokenClaims } from '@universo-react/types'
import {
    PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE,
    PLAYCANVAS_EDITOR_COMPATIBILITY_TOKEN_TTL_MS,
    PLAYCANVAS_EDITOR_FULL_BOOT_MODE,
    playCanvasEditorCompatibilityTokenClaimsSchema
} from '@universo-react/types'
import { normalizeOrigin, resolvePlatformApiOrigin, resolveRequestOrigin } from '../middleware/index.js'

export const PLAYCANVAS_EDITOR_MAX_DOCUMENT_ID = 2_147_483_647

/**
 * Parses the decimal representation used by PlayCanvas Editor document URLs.
 * Number() and parseInt() accept alternate representations (for example 1e3,
 * 0x3e8, or 001), which would make equivalent documents addressable through
 * multiple authorization/cache keys. Only canonical positive decimal ids are
 * accepted at the protocol boundary.
 */
export const parseCanonicalPlayCanvasEditorDocumentId = (value: unknown): number | null => {
    if (typeof value === 'string') {
        if (!/^[1-9][0-9]*$/.test(value) || value.length > 10) return null
        const parsed = Number(value)
        return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= PLAYCANVAS_EDITOR_MAX_DOCUMENT_ID ? parsed : null
    }
    if (typeof value !== 'number') return null
    return Number.isSafeInteger(value) && value > 0 && value <= PLAYCANVAS_EDITOR_MAX_DOCUMENT_ID ? value : null
}

export interface PlayCanvasEditorCompatibilityTokenService {
    create(input: {
        metahubId: string
        projectId: string
        sceneId?: string
        userId: string
        packageSlug: 'playcanvas-editor'
        mode?: typeof PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE | typeof PLAYCANVAS_EDITOR_FULL_BOOT_MODE
        /** Every compatibility token is bound to one canonical HTTP(S) origin. */
        origin: string
        sessionId?: string
        nonce?: string
        assetDocumentIds?: number[]
        now?: number
    }): { token: string; claims: PlayCanvasEditorCompatibilityTokenClaims }
    read(token: string): PlayCanvasEditorCompatibilityTokenClaims | null
}

export const PLAYCANVAS_EDITOR_COMPATIBILITY_TOKEN_HEADER = 'X-PlayCanvas-Editor-Token'

export const resolveCompatibilityToken = (req: Request): string | null =>
    req.get(PLAYCANVAS_EDITOR_COMPATIBILITY_TOKEN_HEADER)?.trim() || null

export const timingSafeEqualString = (left: string, right: string): boolean => {
    const leftBuffer = Buffer.from(left)
    const rightBuffer = Buffer.from(right)
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export const resolveTokenSecret = (): string => {
    const secret =
        process.env.PLAYCANVAS_EDITOR_COMPATIBILITY_SECRET ??
        process.env.PLAYCANVAS_EDITOR_BRIDGE_SECRET ??
        process.env.SESSION_SECRET ??
        process.env.SUPABASE_JWT_SECRET
    if (secret) return secret
    if (process.env.NODE_ENV === 'production') {
        throw new Error(
            'PLAYCANVAS_EDITOR_COMPATIBILITY_SECRET, PLAYCANVAS_EDITOR_BRIDGE_SECRET, SESSION_SECRET, or SUPABASE_JWT_SECRET must be configured in production'
        )
    }
    const globalKey = '__universoPlayCanvasEditorCompatibilityDevelopmentSecret'
    const globalValue = globalThis as typeof globalThis & { [globalKey]?: string }
    globalValue[globalKey] ??= `dev-playcanvas-editor-compatibility-${randomUUID()}`
    return globalValue[globalKey]
}

export const encodeTokenPart = (value: unknown): string => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')

export const decodeTokenPart = (value: string): unknown | null => {
    try {
        return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown
    } catch {
        return null
    }
}

export const signTokenPart = (encodedPayload: string): string =>
    createHmac('sha256', resolveTokenSecret()).update(encodedPayload).digest('base64url')

const PLAYCANVAS_EDITOR_COMPATIBILITY_CSRF_TTL_MS = 10 * 60 * 1000

interface CompatibilityCsrfClaims {
    metahubId: string
    projectId: string
    userId: string
    origin: string
    accessTokenHash: string
    expiresAt: number
}

/**
 * Creates a short-lived, origin-bound CSRF proof for sandboxed Editor frames.
 *
 * A cross-origin sandbox cannot send the platform's host-only session cookie,
 * so the normal session-backed CSRF pair is unavailable there. This proof is
 * deliberately separate from the editor access token and is bound to its
 * hash, project, user, and exact artifact origin. The write guard still
 * requires the signed editor token and route-level permission checks.
 */
export const createCompatibilityCsrfToken = (input: {
    metahubId: string
    projectId: string
    userId: string
    accessToken: string
    origin: string
    now?: number
}): string | null => {
    const origin = normalizeOrigin(input.origin)
    if (!origin || !input.accessToken) return null
    const claims: CompatibilityCsrfClaims = {
        metahubId: input.metahubId,
        projectId: input.projectId,
        userId: input.userId,
        origin,
        accessTokenHash: createHash('sha256').update(input.accessToken).digest('hex'),
        expiresAt: (input.now ?? Date.now()) + PLAYCANVAS_EDITOR_COMPATIBILITY_CSRF_TTL_MS
    }
    const encodedPayload = encodeTokenPart(claims)
    return `${encodedPayload}.${signTokenPart(encodedPayload)}`
}

export const validateCompatibilityCsrfToken = (
    token: string | null | undefined,
    expected: {
        metahubId: string
        projectId: string
        userId: string
        accessToken: string
        origin: string | null | undefined
        now?: number
    }
): boolean => {
    if (!token) return false
    const [encodedPayload, signature, extra] = token.trim().split('.')
    if (!encodedPayload || !signature || extra || !expected.accessToken) return false
    if (!timingSafeEqualString(signTokenPart(encodedPayload), signature)) return false
    const parsed = decodeTokenPart(encodedPayload)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false
    const claims = parsed as Partial<CompatibilityCsrfClaims>
    const expectedOrigin = normalizeOrigin(expected.origin)
    if (
        typeof claims.metahubId !== 'string' ||
        typeof claims.projectId !== 'string' ||
        typeof claims.userId !== 'string' ||
        typeof claims.origin !== 'string' ||
        typeof claims.accessTokenHash !== 'string' ||
        typeof claims.expiresAt !== 'number' ||
        !Number.isFinite(claims.expiresAt) ||
        claims.expiresAt <= (expected.now ?? Date.now()) ||
        claims.metahubId !== expected.metahubId ||
        claims.projectId !== expected.projectId ||
        claims.userId !== expected.userId ||
        !expectedOrigin ||
        claims.origin !== expectedOrigin
    ) {
        return false
    }
    const expectedHash = createHash('sha256').update(expected.accessToken).digest('hex')
    return timingSafeEqualString(claims.accessTokenHash, expectedHash)
}

export const createPlayCanvasEditorCompatibilityTokenService = (): PlayCanvasEditorCompatibilityTokenService => ({
    create: (input) => {
        const now = input.now ?? Date.now()
        const mode = input.mode ?? PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE
        const origin = normalizeOrigin(input.origin)
        if (!origin) throw new Error('PlayCanvas Editor compatibility tokens require a canonical HTTP(S) origin')
        const claims = playCanvasEditorCompatibilityTokenClaimsSchema.parse({
            metahubId: input.metahubId,
            projectId: input.projectId,
            userId: input.userId,
            packageSlug: input.packageSlug,
            mode,
            expiresAt: now + PLAYCANVAS_EDITOR_COMPATIBILITY_TOKEN_TTL_MS,
            ...(input.sceneId ? { sceneId: input.sceneId } : {}),
            origin,
            ...(input.sessionId ? { sessionId: input.sessionId } : {}),
            ...(input.nonce ? { nonce: input.nonce } : {}),
            ...(input.assetDocumentIds ? { assetDocumentIds: input.assetDocumentIds } : {})
        })
        const encodedPayload = encodeTokenPart(claims)
        return {
            token: `${encodedPayload}.${signTokenPart(encodedPayload)}`,
            claims
        }
    },
    read: (token) => {
        const [encodedPayload, signature, extra] = token.split('.')
        if (!encodedPayload || !signature || extra) return null
        if (!timingSafeEqualString(signTokenPart(encodedPayload), signature)) return null
        const parsed = playCanvasEditorCompatibilityTokenClaimsSchema.safeParse(decodeTokenPart(encodedPayload))
        if (!parsed.success || parsed.data.expiresAt <= Date.now() || normalizeOrigin(parsed.data.origin) !== parsed.data.origin) {
            return null
        }
        return parsed.data
    }
})

export const validateCompatibilityToken = (
    req: Request,
    tokenService: PlayCanvasEditorCompatibilityTokenService,
    expected: { metahubId: string; projectId: string; userId: string }
): PlayCanvasEditorCompatibilityTokenClaims | null => {
    const token = resolveCompatibilityToken(req)
    if (!token) return null
    const claims = tokenService.read(token)
    if (!claims) return null
    if (
        claims.metahubId !== expected.metahubId ||
        claims.projectId !== expected.projectId ||
        claims.userId !== expected.userId ||
        claims.packageSlug !== 'playcanvas-editor' ||
        claims.mode !== PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE
    ) {
        return null
    }
    const expectedOrigin = resolveRequestOrigin(req) ?? resolvePlatformApiOrigin(req)
    if (!expectedOrigin || claims.origin !== expectedOrigin) return null
    return claims
}

export const validateFullBootClaims = (
    tokenService: PlayCanvasEditorCompatibilityTokenService,
    accessToken: string,
    expected: { metahubId: string; projectId: string; origin: string | null }
): PlayCanvasEditorCompatibilityTokenClaims | null => {
    const claims = tokenService.read(accessToken)
    if (!claims) return null
    if (
        claims.mode !== PLAYCANVAS_EDITOR_FULL_BOOT_MODE ||
        claims.packageSlug !== 'playcanvas-editor' ||
        claims.metahubId !== expected.metahubId ||
        claims.projectId !== expected.projectId ||
        !claims.sceneId
    ) {
        return null
    }
    if (!claims.sessionId || !claims.nonce) {
        return null
    }
    if (!claims.origin || !expected.origin || claims.origin !== expected.origin) return null
    return claims
}
