import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import type { Request } from 'express'

export const artifactTokenTtlMs = 5 * 60 * 1000
// Grace window for already-expired artifact tokens whose bound bridge session
// is still alive: covers in-flight subresource loads that race a renewal.
export const artifactTokenGraceWindowMs = 5 * 60 * 1000
// Absolute cap measured from the ORIGINAL issuedAt claim; renewals slide the
// short TTL but can never push total artifact-token lifetime past this cap.
export const artifactTokenAbsoluteTtlMs = 12 * 60 * 60 * 1000

let artifactDevelopmentTokenSecret: string | null = null
const resolveArtifactTokenSecret = (): string => {
    const resolved = process.env.PLAYCANVAS_EDITOR_ARTIFACT_TOKEN_SECRET ?? process.env.SESSION_SECRET ?? process.env.SUPABASE_JWT_SECRET
    if (resolved) {
        return resolved
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error('PLAYCANVAS_EDITOR_ARTIFACT_TOKEN_SECRET, SESSION_SECRET, or SUPABASE_JWT_SECRET must be configured in production')
    }
    artifactDevelopmentTokenSecret ??= `dev-playcanvas-editor-artifact-${randomUUID()}`
    return artifactDevelopmentTokenSecret
}

export const parseSafeHttpOrigin = (value: string | undefined): string | null => {
    if (!value) return null
    try {
        const parsed = new URL(value)
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
            return null
        }
        return parsed.origin
    } catch {
        return null
    }
}

export const resolveRequestOrigin = (req: Request): string | null => {
    const configuredParentOrigin = parseSafeHttpOrigin(process.env.PLAYCANVAS_EDITOR_PARENT_PUBLIC_ORIGIN)
    if (configuredParentOrigin) {
        return configuredParentOrigin
    }

    const trustProxyHeaders = process.env.PLAYCANVAS_EDITOR_TRUST_PROXY_HEADERS === 'true'
    const forwardedHost = trustProxyHeaders ? req.get('x-forwarded-host')?.split(',')[0]?.trim() : undefined
    const host = forwardedHost || req.get('host')
    if (!host) return null
    const forwardedProto = trustProxyHeaders ? req.get('x-forwarded-proto')?.split(',')[0]?.trim() : undefined
    const protocol = forwardedProto || req.protocol || 'http'
    return parseSafeHttpOrigin(`${protocol}://${host}`)
}

export const resolveLoopbackSiblingOrigin = (origin: string): string | null => {
    const parsed = new URL(origin)
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
    if (hostname === '127.0.0.1' || hostname === '::1') {
        parsed.hostname = 'localhost'
        return parsed.origin
    }
    if (hostname === 'localhost') {
        parsed.hostname = '127.0.0.1'
        return parsed.origin
    }
    return null
}

export const resolveArtifactPublicOrigin = (req: Request): { artifactOrigin: string; parentOrigin: string } | null => {
    const parentOrigin = resolveRequestOrigin(req)
    if (!parentOrigin) return null

    const configuredOrigin = parseSafeHttpOrigin(process.env.PLAYCANVAS_EDITOR_ARTIFACT_PUBLIC_ORIGIN)
    const artifactOrigin = configuredOrigin ?? resolveLoopbackSiblingOrigin(parentOrigin)
    if (!artifactOrigin || artifactOrigin === parentOrigin) {
        return null
    }

    return { artifactOrigin, parentOrigin }
}

export interface ArtifactTokenPayload {
    metahubId: string
    packageSlug: string
    userId: string
    parentOrigin: string
    apiOrigin: string
    bridgeSessionId: string | null
    issuedAt: number
    expiresAt: number
}

type ArtifactTokenClaimsInput = Omit<ArtifactTokenPayload, 'expiresAt'>

export interface CreatedEditorArtifactToken {
    token: string
    payload: ArtifactTokenPayload
}

const encodeArtifactTokenPart = (value: string): string => Buffer.from(value, 'utf8').toString('base64url')

const signArtifactTokenPayload = (encodedPayload: string): string =>
    createHmac('sha256', resolveArtifactTokenSecret()).update(encodedPayload).digest('base64url')

export const createArtifactToken = (payload: ArtifactTokenClaimsInput): CreatedEditorArtifactToken | null => {
    const now = Date.now()
    // Absolute cap is enforced at mint time against the ORIGINAL issuance
    // timestamp carried through every renewal, so sliding TTLs can never
    // extend an artifact session beyond this lifetime.
    if (now - payload.issuedAt >= artifactTokenAbsoluteTtlMs) {
        return null
    }
    const absoluteExpiry = payload.issuedAt + artifactTokenAbsoluteTtlMs
    const fullPayload: ArtifactTokenPayload = {
        ...payload,
        expiresAt: Math.min(now + artifactTokenTtlMs, absoluteExpiry)
    }
    const encodedPayload = encodeArtifactTokenPart(JSON.stringify(fullPayload))
    return {
        token: `${encodedPayload}.${signArtifactTokenPayload(encodedPayload)}`,
        payload: fullPayload
    }
}

export interface ReadEditorArtifactTokenOptions {
    isBridgeSessionAlive?: (bridgeSessionId: string) => boolean
}

export const readArtifactTokenPayload = (token: string, options: ReadEditorArtifactTokenOptions = {}): ArtifactTokenPayload | null => {
    const [encodedPayload, signature, extra] = token.split('.')
    if (!encodedPayload || !signature || extra) {
        return null
    }

    const expectedSignature = signArtifactTokenPayload(encodedPayload)
    const provided = Buffer.from(signature)
    const expected = Buffer.from(expectedSignature)
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
        return null
    }

    try {
        const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<ArtifactTokenPayload>
        const now = Date.now()
        if (
            typeof payload.metahubId !== 'string' ||
            typeof payload.packageSlug !== 'string' ||
            typeof payload.userId !== 'string' ||
            typeof payload.parentOrigin !== 'string' ||
            !parseSafeHttpOrigin(payload.parentOrigin) ||
            typeof payload.apiOrigin !== 'string' ||
            !parseSafeHttpOrigin(payload.apiOrigin) ||
            typeof payload.expiresAt !== 'number' ||
            !Number.isFinite(payload.expiresAt) ||
            typeof payload.issuedAt !== 'number' ||
            !Number.isFinite(payload.issuedAt) ||
            payload.issuedAt <= 0 ||
            payload.issuedAt > now ||
            (payload.bridgeSessionId !== null && typeof payload.bridgeSessionId !== 'string')
        ) {
            return null
        }
        const absoluteExpiry = payload.issuedAt + artifactTokenAbsoluteTtlMs
        // The absolute cap is checked on every read, including the grace path.
        // A signed token must never survive beyond the original issuance
        // deadline, even if its short TTL or bridge-session grace is extended.
        if (!Number.isSafeInteger(absoluteExpiry) || now >= absoluteExpiry || payload.expiresAt > absoluteExpiry) {
            return null
        }
        if (payload.expiresAt >= now) {
            return payload as ArtifactTokenPayload
        }
        // Server-side grace window (fail closed): an expired token is accepted
        // only when it expired within the grace window AND its bound bridge
        // session is still alive. Invariant: the tokenized artifact path only
        // exists cross-origin — same-origin and opaque origins never receive a
        // minted token (resolveArtifactPublicOrigin refuses equal origins), so
        // they can never reach this validation path at all.
        if (
            now - payload.expiresAt > artifactTokenGraceWindowMs ||
            typeof payload.bridgeSessionId !== 'string' ||
            payload.bridgeSessionId.length === 0
        ) {
            return null
        }
        return options.isBridgeSessionAlive?.(payload.bridgeSessionId) === true ? (payload as ArtifactTokenPayload) : null
    } catch {
        return null
    }
}

interface EditorArtifactIssuanceRecord {
    metahubId: string
    packageSlug: string
    userId: string
    parentOrigin: string
    apiOrigin: string
    issuedAt: number
}

const artifactIssuanceGlobalKey = '__universoPlayCanvasEditorArtifactIssuance'
const artifactIssuanceByBridgeSessionId = (() => {
    const globalScope = globalThis as typeof globalThis & {
        [artifactIssuanceGlobalKey]?: Map<string, EditorArtifactIssuanceRecord>
    }
    const existing = globalScope[artifactIssuanceGlobalKey]
    if (existing) return existing
    const registry = new Map<string, EditorArtifactIssuanceRecord>()
    Object.defineProperty(globalScope, artifactIssuanceGlobalKey, {
        value: registry,
        enumerable: false,
        configurable: false,
        writable: false
    })
    return registry
})()
const MAX_ARTIFACT_ISSUANCES = 10_000

const pruneExpiredIssuances = (): void => {
    const now = Date.now()
    for (const [bridgeSessionId, record] of artifactIssuanceByBridgeSessionId) {
        if (now - record.issuedAt >= artifactTokenAbsoluteTtlMs) {
            artifactIssuanceByBridgeSessionId.delete(bridgeSessionId)
        }
    }
}

export const registerEditorArtifactIssuance = (bridgeSessionId: string, record: EditorArtifactIssuanceRecord): void => {
    pruneExpiredIssuances()
    if (artifactIssuanceByBridgeSessionId.size >= MAX_ARTIFACT_ISSUANCES && !artifactIssuanceByBridgeSessionId.has(bridgeSessionId)) {
        const oldest = [...artifactIssuanceByBridgeSessionId.entries()]
            .sort(([, left], [, right]) => left.issuedAt - right.issuedAt)
            .slice(0, artifactIssuanceByBridgeSessionId.size - MAX_ARTIFACT_ISSUANCES + 1)
        for (const [oldestBridgeSessionId] of oldest) artifactIssuanceByBridgeSessionId.delete(oldestBridgeSessionId)
    }
    artifactIssuanceByBridgeSessionId.set(bridgeSessionId, record)
}

export const getEditorArtifactIssuance = (bridgeSessionId: string): EditorArtifactIssuanceRecord | undefined =>
    artifactIssuanceByBridgeSessionId.get(bridgeSessionId)

export interface RenewEditorArtifactTokenInput {
    requestOrigin: string | null
    artifactOrigin: string | null
    metahubId: string
    userId: string
    bridgeSessionId: string
    isBridgeSessionAlive: (bridgeSessionId: string) => boolean
}

export const renewEditorArtifactToken = (input: RenewEditorArtifactTokenInput): CreatedEditorArtifactToken | null => {
    // Fail-closed renewal contract:
    // 1. renewal requires the exact bridge session id bound at initial mint;
    // 2. requester identity and metahub must match the original issuance;
    // 3. the current parent origin must equal the originally bound origin and
    //    the artifact origin must remain a distinct cross-origin;
    // 4. the bound bridge session must still be alive;
    // 5. the absolute cap counts from the original issuedAt, so renewals are
    //    refused once the artifact session outlives its total lifetime.
    if (!input.bridgeSessionId) return null

    const record = getEditorArtifactIssuance(input.bridgeSessionId)
    if (!record || record.metahubId !== input.metahubId || record.userId !== input.userId) {
        return null
    }

    const requestOrigin = parseSafeHttpOrigin(input.requestOrigin ?? undefined)
    const artifactOrigin = parseSafeHttpOrigin(input.artifactOrigin ?? undefined)
    if (!requestOrigin || requestOrigin !== record.parentOrigin) {
        return null
    }
    if (!artifactOrigin || artifactOrigin === requestOrigin) {
        return null
    }

    if (!input.isBridgeSessionAlive(input.bridgeSessionId)) {
        return null
    }

    if (Date.now() - record.issuedAt >= artifactTokenAbsoluteTtlMs) {
        return null
    }

    return createArtifactToken({ ...record, bridgeSessionId: input.bridgeSessionId })
}
