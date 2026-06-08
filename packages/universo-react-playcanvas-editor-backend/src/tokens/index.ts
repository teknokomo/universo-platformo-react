import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import type { Request } from 'express'
import type { PlayCanvasEditorCompatibilityTokenClaims } from '@universo-react/types'
import {
    PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE,
    PLAYCANVAS_EDITOR_COMPATIBILITY_TOKEN_TTL_MS,
    PLAYCANVAS_EDITOR_FULL_BOOT_MODE,
    playCanvasEditorCompatibilityTokenClaimsSchema
} from '@universo-react/types'
import { resolveRequestOrigin } from '../middleware/index.js'

export interface PlayCanvasEditorCompatibilityTokenService {
    create(input: {
        metahubId: string
        projectId: string
        sceneId?: string
        userId: string
        packageSlug: 'playcanvas-editor'
        mode?: typeof PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE | typeof PLAYCANVAS_EDITOR_FULL_BOOT_MODE
        origin?: string
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

export const createPlayCanvasEditorCompatibilityTokenService = (): PlayCanvasEditorCompatibilityTokenService => ({
    create: (input) => {
        const now = input.now ?? Date.now()
        const claims = playCanvasEditorCompatibilityTokenClaimsSchema.parse({
            metahubId: input.metahubId,
            projectId: input.projectId,
            userId: input.userId,
            packageSlug: input.packageSlug,
            mode: input.mode ?? PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE,
            expiresAt: now + PLAYCANVAS_EDITOR_COMPATIBILITY_TOKEN_TTL_MS,
            ...(input.sceneId ? { sceneId: input.sceneId } : {}),
            ...(input.origin ? { origin: input.origin } : {}),
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
        if (!parsed.success || parsed.data.expiresAt <= Date.now()) return null
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
    const requestOrigin = resolveRequestOrigin(req)
    if (claims.origin && (!requestOrigin || claims.origin !== requestOrigin)) {
        return null
    }
    return claims
}

export const validateFullBootClaims = (
    tokenService: PlayCanvasEditorCompatibilityTokenService,
    accessToken: string,
    expected: { metahubId: string; projectId: string; origin?: string | null }
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
    if (claims.origin && (!expected.origin || claims.origin !== expected.origin)) {
        return null
    }
    return claims
}
