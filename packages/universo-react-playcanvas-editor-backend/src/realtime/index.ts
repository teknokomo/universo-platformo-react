import type { IncomingMessage } from 'node:http'
import ShareDB from 'sharedb'
import WebSocketJSONStream from '@teamwork/websocket-json-stream'
import { type RawData, type WebSocket } from 'ws'
import type { PlayCanvasEditorCompatibilityTokenClaims } from '@universo-react/types'
import { parseCanonicalPlayCanvasEditorDocumentId, PlayCanvasEditorCompatibilityTokenService } from '../tokens/index.js'
import {
    isSafePlayCanvasEditorScriptAttributeName,
    playCanvasEditorCompatibilityAssetDeleteFrameSchema,
    playCanvasEditorCompatibilityParamsSchema
} from '@universo-react/types'
import {
    createPlayCanvasEditorNumericIds,
    createDefaultRealtimeSceneSettings,
    createDefaultProjectSettingsDocument,
    hashToPositiveInt
} from '../config/index.js'
import { parseSafeHttpOrigin } from '../middleware/index.js'
import { validateFullBootClaims } from '../tokens/index.js'
import {
    claimPipelineReplay,
    completePipelineReplay,
    createPipelineReplayFingerprint,
    clearPipelineReplayRegistry
} from './pipelineReplay.js'
import { createRealtimeSocketHandlers } from './socketHandlers.js'
import { createPlayCanvasEditorFullBootRuntime } from './runtimeAttachment.js'
import { createShareDbRuntime } from './shareDbRuntime.js'
import * as realtimeRegistry from './registry.js'

export interface PlayCanvasEditorRealtimeDocument {
    collection: RealtimeCollection
    id: string
    data: Record<string, unknown>
    version?: number
    checksum?: string | null
    revision?: string | null
}

/**
 * The bounded subset of an Editor asset descriptor needed by messenger
 * consumers when an asset appears after full-boot authentication. Keeping the
 * descriptor deliberately small prevents the reconciliation port from
 * becoming a second metadata transport or leaking arbitrary project fields.
 */
export interface PlayCanvasEditorRealtimeAssetDocument {
    id: number
    branchId: number
    source: boolean
    status: string
    type: string
    sourceAssetId: string
    createdAt: string | null
}

export interface PlayCanvasEditorRealtimeDocumentPort {
    loadDocument(input: {
        metahubId: string
        projectId: string
        sceneId: string
        userId: string
        collection: RealtimeCollection
        documentId: string
        numericProjectId: number
        numericSceneId: number
        numericUserId: number
    }): Promise<PlayCanvasEditorRealtimeDocument | null>
    persistDocument(input: {
        metahubId: string
        projectId: string
        sceneId: string
        userId: string
        collection: RealtimeCollection
        documentId: string
        data: Record<string, unknown>
        version: number
        checksum?: string | null
        revision?: string | null
    }): Promise<{ checksum?: string | null; revision?: string | null } | void>
    /**
     * Editor `fs{op:'delete'}` frames delete assets outside the ShareDB submit
     * path. Optional: when absent the frame is answered with a per-asset
     * `asset.delete` no-op and the deletion stays a REST-only capability.
     */
    deleteAssets?(input: {
        metahubId: string
        projectId: string
        sceneId: string
        userId: string
        documentIds: readonly number[]
    }): Promise<{ deletedDocumentIds: number[] }>
    /**
     * Lists the current editor asset descriptors for one authenticated scene
     * scope. The runtime uses this optional port for cross-worker
     * reconciliation; the host remains responsible for authorization and
     * storage access.
     */
    listAssetDocuments?(input: {
        metahubId: string
        projectId: string
        sceneId: string
        userId: string
    }): Promise<readonly PlayCanvasEditorRealtimeAssetDocument[]>
    /**
     * Id-only fallback for hosts that cannot cheaply provide messenger
     * descriptors. `listAssetDocuments` is preferred because the upstream
     * Editor filters asset.new by branch/type/status.
     */
    listAssetDocumentIds?(input: { metahubId: string; projectId: string; sceneId: string; userId: string }): Promise<readonly number[]>
}

export interface PlayCanvasEditorRealtimeRuntimeDeps {
    server: import('node:http').Server
    tokenService: PlayCanvasEditorCompatibilityTokenService
    documentPort: PlayCanvasEditorRealtimeDocumentPort
    /**
     * Current membership/permission check. Optional only for source-level API
     * compatibility; runtime authentication fails closed when it is absent.
     */
    authorize?: (claims: PlayCanvasEditorCompatibilityTokenClaims) => Promise<void>
    basePath?: string
    /** Optional bounded override used by deterministic integration tests. */
    assetReconciliationIntervalMs?: number
}

export interface PlayCanvasEditorRealtimeRuntimeHandle {
    close(): Promise<void>
    paths: {
        realtime: string
        messenger: string
        relay: string
    }
}

export type RealtimeCollection = 'scenes' | 'assets' | 'settings' | 'user_data'
export type RealtimeSurface = 'realtime' | 'messenger' | 'relay'

export const MAX_REALTIME_MESSAGE_BYTES = 512 * 1024
export const MAX_REALTIME_HANDSHAKE_BUFFER_MESSAGES = 128
export const MAX_REALTIME_HANDSHAKE_BUFFER_BYTES = MAX_REALTIME_MESSAGE_BYTES
export const MAX_REALTIME_RELAY_PENDING_MESSAGES = 16
export const MAX_REALTIME_RELAY_PENDING_BYTES = MAX_REALTIME_MESSAGE_BYTES

type BufferedRealtimeMessageData = string | Buffer | ArrayBuffer | Buffer[]

const cloneRealtimeMessageData = (data: RawData): BufferedRealtimeMessageData | null => {
    if (typeof data === 'string') return data
    if (Buffer.isBuffer(data)) return Buffer.from(data)
    if (data instanceof ArrayBuffer) return data.slice(0)
    if (Array.isArray(data) && data.every((part) => Buffer.isBuffer(part))) return data.map((part) => Buffer.from(part))
    return null
}

const getRealtimeMessageDataByteLength = (data: BufferedRealtimeMessageData): number => {
    if (typeof data === 'string') return Buffer.byteLength(data, 'utf8')
    if (Buffer.isBuffer(data)) return data.byteLength
    if (data instanceof ArrayBuffer) return data.byteLength
    return data.reduce((total, part) => total + part.byteLength, 0)
}

const realtimeMessageDataToText = (data: unknown): string => {
    if (typeof data === 'string') return data
    if (Buffer.isBuffer(data)) return data.toString('utf8')
    if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8')
    if (Array.isArray(data) && data.every((part) => Buffer.isBuffer(part))) return Buffer.concat(data).toString('utf8')
    return ''
}

const logRealtimeWarning = (code: string, metadata: Record<string, string | number | undefined>): void => {
    // Never pass protocol payloads or Error.message to the process logger:
    // storage adapters can include local paths, SQL fragments, or credentials
    // in those values. The fixed code plus bounded identifiers is sufficient
    // for operational diagnosis and safe for production logs.
    console.warn('[PlayCanvasEditorFullBootRuntime]', { code, ...metadata })
}

export const parseJsonMessage = (value: unknown): Record<string, unknown> | null => {
    if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > MAX_REALTIME_MESSAGE_BYTES) return null
    try {
        const parsed = JSON.parse(value)
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
    } catch {
        return null
    }
}

export const isPingMessage = (value: string): boolean => {
    if (Buffer.byteLength(value, 'utf8') > 64) return false
    if (value === 'ping') return true
    try {
        return JSON.parse(value) === 'ping'
    } catch {
        return false
    }
}

export const parseRealtimeAuthMessage = (value: unknown): { accessToken: string } | null => {
    if (typeof value !== 'string' || !value.startsWith('auth')) return null
    const parsed = parseJsonMessage(value.slice('auth'.length))
    const accessToken = parsed?.accessToken
    return typeof accessToken === 'string' && accessToken.length > 0 && accessToken.length <= 16_384 ? { accessToken } : null
}

export const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const normalizeUpgradeBasePath = (basePath = '/api/v1/metahub'): string => {
    const trimmed = basePath.trim().replace(/\/+$/, '')
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

export const parseUpgradePath = (
    request: IncomingMessage,
    basePath = '/api/v1/metahub'
): { metahubId: string; projectId: string; surface: RealtimeSurface } | null => {
    try {
        const url = new URL(request.url ?? '/', 'http://localhost')
        const normalizedBasePath = normalizeUpgradeBasePath(basePath)
        const match = new RegExp(
            `^${escapeRegExp(normalizedBasePath)}/([^/]+)/playcanvas/editor-compatible/projects/([^/]+)/(realtime|messenger|relay)$`
        ).exec(url.pathname)
        if (!match) return null
        const params = playCanvasEditorCompatibilityParamsSchema.safeParse({
            metahubId: decodeURIComponent(match[1]),
            projectId: decodeURIComponent(match[2])
        })
        if (!params.success) return null
        return {
            metahubId: params.data.metahubId,
            projectId: params.data.projectId,
            surface: match[3] as RealtimeSurface
        }
    } catch {
        return null
    }
}

export const safeSliceReason = (reason: string): string => {
    const buf = Buffer.from(reason)
    if (buf.length <= 123) return reason
    return buf
        .subarray(0, 123)
        .toString('utf8')
        .replace(/\uFFFD$/, '')
}

// A WebSocket close is asynchronous. Marking the socket before sending the
// close frame prevents a later ShareDB stream error from replacing a precise
// policy-violation code (1008) with the generic internal-error code (1011).
const closingSockets = new WeakSet<WebSocket>()

export const closeUnauthorized = (socket: WebSocket, reason = 'playcanvasEditor.fullBoot.invalidToken'): void => {
    if (closingSockets.has(socket)) return
    closingSockets.add(socket)
    socket.close(4401, safeSliceReason(reason))
}

export const closeInternalError = (socket: WebSocket, reason = 'playcanvasEditor.fullBoot.internalError'): void => {
    if (closingSockets.has(socket)) return
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        closingSockets.add(socket)
        socket.close(1011, safeSliceReason(reason))
    }
}

export const closePolicyViolation = (socket: WebSocket, reason = 'playcanvasEditor.fullBoot.protocolViolation'): void => {
    if (closingSockets.has(socket)) return
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        closingSockets.add(socket)
        socket.close(1008, safeSliceReason(reason))
    }
}

export const isSocketOpen = (socket: WebSocket): boolean => socket.readyState === WebSocket.OPEN

export const writeUpgradeTooManyRequests = (socket: import('node:net').Socket): void => {
    if (socket.destroyed) return
    socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
    socket.destroy()
}

export const writeUpgradeForbidden = (socket: import('node:net').Socket): void => {
    if (socket.destroyed) return
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
    socket.destroy()
}

const splitConfiguredOrigins = (value: string | undefined): string[] =>
    (value ?? '')
        .split(',')
        .map((item) => parseSafeHttpOrigin(item))
        .filter((origin): origin is string => Boolean(origin))

const addLoopbackSiblingOrigin = (origins: Set<string>, origin: string): void => {
    try {
        const url = new URL(origin)
        const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
        if (hostname === '127.0.0.1' || hostname === '::1') {
            url.hostname = 'localhost'
            origins.add(url.origin)
        } else if (hostname === 'localhost') {
            url.hostname = '127.0.0.1'
            origins.add(url.origin)
        }
    } catch {
        // Ignore malformed origins that were already filtered by parseSafeHttpOrigin.
    }
}

export const resolveAllowedFullBootUpgradeOrigins = (): Set<string> => {
    const origins = new Set<string>()
    for (const origin of [
        ...splitConfiguredOrigins(process.env.PLAYCANVAS_EDITOR_FULL_BOOT_WS_ORIGINS),
        ...splitConfiguredOrigins(process.env.PLAYCANVAS_EDITOR_ARTIFACT_ALLOWED_ORIGINS),
        ...splitConfiguredOrigins(process.env.PLAYCANVAS_EDITOR_ARTIFACT_PUBLIC_ORIGIN),
        ...splitConfiguredOrigins(process.env.PLAYCANVAS_EDITOR_PARENT_PUBLIC_ORIGIN)
    ]) {
        origins.add(origin)
        addLoopbackSiblingOrigin(origins, origin)
    }
    return origins
}

const splitHeaderValue = (value: string | string[] | undefined): string | undefined => {
    const selected = Array.isArray(value) ? value[0] : value
    return selected?.split(',')[0]?.trim() || undefined
}

const resolveUpgradeHost = (request: IncomingMessage): string | undefined => {
    const forwardedHost =
        process.env.PLAYCANVAS_EDITOR_TRUST_PROXY_HEADERS === 'true' ? splitHeaderValue(request.headers['x-forwarded-host']) : undefined
    return forwardedHost ?? splitHeaderValue(request.headers.host)
}

const parseHostAsOriginUrl = (host: string, protocol: string): URL | null => {
    try {
        const parsed = new URL(`${protocol}//${host}`)
        if (!parsed.hostname) return null
        return parsed
    } catch {
        return null
    }
}

const isLoopbackHost = (hostname: string): boolean => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)

export const isSameHostOrLoopbackSiblingUpgradeOrigin = (request: IncomingMessage, requestOrigin: string): boolean => {
    const host = resolveUpgradeHost(request)
    if (!host) return false
    try {
        const originUrl = new URL(requestOrigin)
        const hostUrl = parseHostAsOriginUrl(host, originUrl.protocol)
        if (!hostUrl) return false
        if (originUrl.host === hostUrl.host) return true
        return isLoopbackHost(originUrl.hostname) && isLoopbackHost(hostUrl.hostname) && originUrl.port === hostUrl.port
    } catch {
        return false
    }
}

export const isFullBootUpgradeOriginAllowed = (request: IncomingMessage): boolean => {
    const requestOrigin = parseSafeHttpOrigin(request.headers.origin)
    if (!requestOrigin) return false
    const configuredOrigins = resolveAllowedFullBootUpgradeOrigins()
    if (configuredOrigins.has(requestOrigin)) return true
    // Same-host fallback is deliberately opt-in. A non-production NODE_ENV is
    // not a security boundary (staging and misconfigured deployments commonly
    // run with NODE_ENV unset), so accepting Host-derived origins implicitly
    // would turn a missing allow-list into a WebSocket CSRF bypass.
    if (process.env.NODE_ENV !== 'development' || process.env.PLAYCANVAS_EDITOR_ALLOW_SAME_HOST_ORIGIN !== 'true') return false
    return isSameHostOrLoopbackSiblingUpgradeOrigin(request, requestOrigin)
}

export const getUpgradeRemoteAddress = (request: IncomingMessage): string => {
    if (process.env.PLAYCANVAS_EDITOR_TRUST_PROXY_HEADERS === 'true') {
        const forwardedFor = request.headers['x-forwarded-for']
        if (typeof forwardedFor === 'string') {
            return forwardedFor.split(',')[0].trim()
        }
    }
    return request.socket.remoteAddress || 'unknown'
}

export const isPlayCanvasRealtimeControlFrame = (value: unknown): boolean => {
    const text = Buffer.isBuffer(value) ? value.toString('utf8') : typeof value === 'string' ? value : null
    if (typeof text !== 'string') return false
    if (/^close:(?:scene|document):[A-Za-z0-9_-]{1,128}$/.test(text)) return true
    if (/^(?:selection|pipeline|fs)\{/.test(text)) return true
    if (/^(?:doc:save:|cubemap:clear:)[A-Za-z0-9_-]{1,128}$/.test(text)) return true
    return false
}

export const createShareDbWebSocket = (socket: WebSocket, onControlFrame?: (name: string, payload: unknown) => void): WebSocket => {
    const filteredSocket = Object.create(socket) as WebSocket
    const addEventListener: WebSocket['addEventListener'] = (type, listener, options) => {
        if (type !== 'message') {
            socket.addEventListener(type, listener, options)
            return
        }
        const wrapped = ((event: { data: unknown }) => {
            const raw = typeof event.data === 'string' ? event.data : Buffer.isBuffer(event.data) ? event.data.toString('utf8') : null
            if (raw !== null) {
                if (Buffer.byteLength(raw, 'utf8') > MAX_REALTIME_MESSAGE_BYTES) {
                    closePolicyViolation(socket, 'playcanvasEditor.fullBoot.messageTooLarge')
                    return
                }
                const controlMatch = /^(fs|pipeline)\{/.exec(raw)
                if (controlMatch) {
                    try {
                        const payload = JSON.parse(raw.slice(controlMatch[1].length))
                        onControlFrame?.(controlMatch[1], payload)
                    } catch {
                        // A malformed pipeline frame cannot be processed by the
                        // ShareDB stream. Forward a bounded diagnostic frame so
                        // the handler can emit a terminal failure for a valid
                        // job id (or close the protocol on an unidentifiable
                        // payload) instead of leaving the editor in "Parsing".
                        if (controlMatch[1] === 'pipeline') {
                            const jobId = /["']job_id["']\s*:\s*["']([A-Za-z0-9_-]{1,128})["']/.exec(raw)?.[1] ?? ''
                            onControlFrame?.('pipeline', {
                                data: {
                                    job_id: jobId,
                                    __invalidFrame: true
                                }
                            })
                        } else {
                            closePolicyViolation(socket, 'playcanvasEditor.fullBoot.invalidControlFrame')
                        }
                    }
                    return
                }
                if (isPlayCanvasRealtimeControlFrame(event.data)) {
                    return
                }
            }
            if (typeof listener === 'function') {
                listener.call(filteredSocket, event)
                return
            }
            ;(listener as { handleEvent: (event: { data: unknown }) => void }).handleEvent(event)
        }) as Parameters<WebSocket['addEventListener']>[1]
        socket.addEventListener(type, wrapped, options)
    }
    filteredSocket.addEventListener = addEventListener
    return filteredSocket
}

export const authorizeFullBootClaims = async (
    deps: PlayCanvasEditorRealtimeRuntimeDeps,
    socket: WebSocket,
    claims: PlayCanvasEditorCompatibilityTokenClaims
): Promise<boolean> => {
    // A token signature only proves that this server minted the token. The
    // long-lived realtime session still needs a live, request-scoped policy
    // check. Treat a missing adapter as a configuration/authentication failure
    // instead of silently turning the signed token into bearer access.
    if (typeof deps.authorize !== 'function') {
        closeUnauthorized(socket, 'playcanvasEditor.fullBoot.authorizationUnavailable')
        return false
    }
    try {
        await deps.authorize(claims)
        return true
    } catch {
        closeUnauthorized(socket, 'playcanvasEditor.fullBoot.accessDenied')
        return false
    }
}

const hasCurrentFullBootAuthorization = async (
    deps: PlayCanvasEditorRealtimeRuntimeDeps,
    claims: PlayCanvasEditorCompatibilityTokenClaims
): Promise<boolean> => {
    if (claims.expiresAt <= Date.now()) return false
    if (typeof deps.authorize !== 'function') return false
    try {
        await deps.authorize(claims)
        return true
    } catch {
        return false
    }
}

/**
 * Re-checks current authorization before a long-lived socket consumes a
 * user-originated event. Token expiry is checked here as well as at the
 * upgrade/auth boundary because role revocation and expiry can happen while a
 * WebSocket remains connected.
 */
export const revalidateFullBootClaims = async (
    deps: PlayCanvasEditorRealtimeRuntimeDeps,
    socket: WebSocket,
    claims: PlayCanvasEditorCompatibilityTokenClaims
): Promise<boolean> => {
    if (claims.expiresAt <= Date.now()) {
        closeUnauthorized(socket, 'playcanvasEditor.fullBoot.tokenExpired')
        return false
    }
    if (await hasCurrentFullBootAuthorization(deps, claims)) return true
    closeUnauthorized(socket, 'playcanvasEditor.fullBoot.accessDenied')
    return false
}

export const asRecordData = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

export const isJson0ListOperation = (op: unknown): op is { p: unknown[]; li?: unknown; ld?: unknown; lm?: unknown } =>
    Boolean(
        op &&
            typeof op === 'object' &&
            Array.isArray((op as { p?: unknown }).p) &&
            (op as { p: unknown[] }).p.length >= 2 &&
            Number.isInteger((op as { p: unknown[] }).p[(op as { p: unknown[] }).p.length - 1]) &&
            (Object.prototype.hasOwnProperty.call(op, 'li') ||
                Object.prototype.hasOwnProperty.call(op, 'ld') ||
                Object.prototype.hasOwnProperty.call(op, 'lm'))
    )

export const ensureArrayPathForJson0ListOperation = (data: Record<string, unknown>, op: { p: unknown[] }): boolean => {
    const path = op.p.slice(0, -1)
    if (path.length === 0) return false
    // JSON0 paths originate at the ShareDB protocol boundary. Do not allow
    // JavaScript prototype keys through this repair path: assigning to
    // `__proto__`, or traversing `constructor.prototype`, can mutate a shared
    // prototype instead of the snapshot document.
    if (
        path.some(
            (key) =>
                (typeof key === 'string' && (key === '__proto__' || key === 'constructor' || key === 'prototype')) ||
                (typeof key === 'number' && !Number.isSafeInteger(key)) ||
                (typeof key !== 'string' && typeof key !== 'number')
        )
    ) {
        return false
    }
    const pendingWrites: Array<{
        container: Record<string, unknown> | unknown[]
        key: string | number
        value: Record<string, unknown> | []
    }> = []
    let current: Record<string, unknown> | unknown[] = data

    for (let index = 0; index < path.length; index += 1) {
        const key = path[index]
        const isLeaf = index === path.length - 1
        let existing: unknown
        let normalizedKey: string | number

        if (Array.isArray(current)) {
            if (!Number.isInteger(key) || Number(key) < 0 || Number(key) >= current.length) return false
            normalizedKey = Number(key)
            existing = current[normalizedKey]
        } else {
            if (typeof key !== 'string' && typeof key !== 'number') return false
            normalizedKey = String(key)
            existing = Object.prototype.hasOwnProperty.call(current, normalizedKey) ? current[normalizedKey] : undefined
        }

        if (isLeaf) {
            if (existing !== undefined) return false
            pendingWrites.push({ container: current, key: normalizedKey, value: [] })
            break
        }

        if (existing === undefined) {
            if (Array.isArray(current)) return false
            const next = Number.isInteger(path[index + 1]) ? [] : {}
            pendingWrites.push({ container: current, key: normalizedKey, value: next })
            current = next
            continue
        }
        if (!existing || typeof existing !== 'object') return false
        current = existing as Record<string, unknown> | unknown[]
    }

    for (const write of pendingWrites) {
        if (Array.isArray(write.container)) {
            write.container[write.key as number] = write.value
        } else {
            write.container[String(write.key)] = write.value
        }
    }
    return pendingWrites.length > 0
}

export const repairSnapshotForJson0ListOperations = (data: Record<string, unknown>, ops: unknown): number => {
    const list = Array.isArray(ops) ? ops : [ops]
    let repaired = 0
    for (const op of list) {
        if (isJson0ListOperation(op) && ensureArrayPathForJson0ListOperation(data, op)) {
            repaired += 1
        }
    }
    return repaired
}

export type ShareDbDocumentMetadata = { checksum?: string | null; revision?: string | null; dirty?: boolean }

export interface ScopedShareDbBackendOptions {
    /** Re-checks the current user/session authorization before every operation. */
    revalidate: () => Promise<boolean>
    /** Called once when revalidation fails so callers can close the socket. */
    onAuthorizationFailure?: () => void
    /** Called when a durable write cannot be recovered safely. */
    onPersistenceFailure?: () => void
}

export const shareDbPersistedMetadata = realtimeRegistry.shareDbPersistedMetadata
export const shareDbPersistQueues = realtimeRegistry.shareDbPersistQueues
export const shareDbSeedQueues = realtimeRegistry.shareDbSeedQueues
export const shareDbSeedWriteKeys = realtimeRegistry.shareDbSeedWriteKeys
export const shareDbAllowedDocumentKeys = realtimeRegistry.shareDbAllowedDocumentKeys
export const getShareDbPersistedMetadata = realtimeRegistry.getShareDbPersistedMetadata
export const getShareDbPersistQueues = realtimeRegistry.getShareDbPersistQueues
const getShareDbSeedQueues = realtimeRegistry.getShareDbSeedQueues
export const getShareDbSeedWriteKeys = realtimeRegistry.getShareDbSeedWriteKeys
export const getShareDbAllowedDocumentKeys = realtimeRegistry.getShareDbAllowedDocumentKeys
const getShareDbPersistenceBlockedDocuments = realtimeRegistry.getShareDbPersistenceBlockedDocuments
const getShareDbPersistenceRecoveryKeys = realtimeRegistry.getShareDbPersistenceRecoveryKeys
const getShareDbDurableCommitVersions = realtimeRegistry.getShareDbDurableCommitVersions
const acquireShareDbDocumentSubmitLock = realtimeRegistry.acquireShareDbDocumentSubmitLock
export const createAllowedShareDbDocumentKeys = realtimeRegistry.createAllowedShareDbDocumentKeys
export const addAllowedShareDbDocumentKeys = realtimeRegistry.addAllowedShareDbDocumentKeys
export const isAllowedShareDbDocument = realtimeRegistry.isAllowedShareDbDocument
export const registerRealtimeAssetDocumentSeeder = realtimeRegistry.registerRealtimeAssetDocumentSeeder
export const getGrantedRealtimeAssetDocumentIds = realtimeRegistry.getGrantedRealtimeAssetDocumentIds
export const captureRealtimeAssetDocumentGrantVersions = realtimeRegistry.captureRealtimeAssetDocumentGrantVersions
export const grantRealtimeAssetDocuments = realtimeRegistry.grantRealtimeAssetDocuments
export const revokeRealtimeAssetDocuments = realtimeRegistry.revokeRealtimeAssetDocuments
export const extendRealtimeAssetAllowList = realtimeRegistry.extendRealtimeAssetAllowList
export const isRealtimeAssetDocumentGranted = realtimeRegistry.isRealtimeAssetDocumentGranted
export const isRealtimeAssetDocumentRevoked = realtimeRegistry.isRealtimeAssetDocumentRevoked
export const diffRealtimeAssetDocumentIds = realtimeRegistry.diffRealtimeAssetDocumentIds
const readRealtimeAssetDocuments = realtimeRegistry.readRealtimeAssetDocuments
const isDynamicallyGrantedAssetDocument = realtimeRegistry.isDynamicallyGrantedAssetDocument
const isClaimedOrGrantedAssetDocument = realtimeRegistry.isClaimedOrGrantedAssetDocument
export const realtimeProjectScopeKey = realtimeRegistry.realtimeProjectScopeKey
const unregisterRealtimeSocket = realtimeRegistry.unregisterRealtimeSocket
const registerRealtimeSocket = realtimeRegistry.registerRealtimeSocket
const closeRealtimeSocketsForClaims = realtimeRegistry.closeRealtimeSocketsForClaims
const unregisterMessengerSocket = realtimeRegistry.unregisterMessengerSocket
const registerMessengerSocket = realtimeRegistry.registerMessengerSocket
const messengerSocketsByScope = realtimeRegistry.messengerSocketsByScope
const pendingMessengerEventsByScope = realtimeRegistry.pendingMessengerEventsByScope
export const sendMessengerEvent = realtimeRegistry.sendMessengerEvent
const sendPendingMessengerEvents = realtimeRegistry.sendPendingMessengerEvents
export const REALTIME_ASSET_DOCUMENT_TOMBSTONE_TTL_MS = realtimeRegistry.REALTIME_ASSET_DOCUMENT_TOMBSTONE_TTL_MS
export const MAX_REALTIME_ASSET_DOCUMENT_TOMBSTONES_PER_SCOPE = realtimeRegistry.MAX_REALTIME_ASSET_DOCUMENT_TOMBSTONES_PER_SCOPE
export const MAX_REALTIME_ASSET_RECONCILIATION_DOCUMENTS = realtimeRegistry.MAX_REALTIME_ASSET_RECONCILIATION_DOCUMENTS
export const PLAYCANVAS_EDITOR_REALTIME_ASSET_RECONCILIATION_INTERVAL_MS =
    realtimeRegistry.PLAYCANVAS_EDITOR_REALTIME_ASSET_RECONCILIATION_INTERVAL_MS
const pipelineFrameSchema = realtimeRegistry.pipelineFrameSchema
const messengerAuthenticateMessageSchema = realtimeRegistry.messengerAuthenticateMessageSchema
const messengerProjectWatchMessageSchema = realtimeRegistry.messengerProjectWatchMessageSchema
const relayRoomMessageSchema = realtimeRegistry.relayRoomMessageSchema
export type { RealtimeAssetDocumentGrantVersions, RealtimeAssetDocumentGrantOptions, RealtimeAssetDocumentDiff } from './registry.js'

const isSafePipelineJobId = (value: string): boolean => value.length > 0 && value.length <= 128 && /^[A-Za-z0-9_-]+$/.test(value)

const shareDbRuntime = createShareDbRuntime({
    createPlayCanvasEditorNumericIds,
    createDefaultRealtimeSceneSettings,
    createDefaultProjectSettingsDocument,
    asRecordData,
    getShareDbPersistenceBlockedDocuments,
    getShareDbPersistedMetadata,
    getShareDbSeedWriteKeys,
    getShareDbSeedQueues,
    getShareDbPersistenceRecoveryKeys,
    acquireShareDbDocumentSubmitLock,
    getShareDbPersistQueues,
    getShareDbDurableCommitVersions,
    isRealtimeAssetDocumentRevoked,
    isAllowedShareDbDocument,
    isDynamicallyGrantedAssetDocument,
    addAllowedShareDbDocumentKeys,
    repairSnapshotForJson0ListOperations
})
export const createDefaultRealtimeDocument = shareDbRuntime.createDefaultRealtimeDocument
export const seedShareDbDocument = shareDbRuntime.seedShareDbDocument
export const persistShareDbSnapshot = shareDbRuntime.persistShareDbSnapshot
export const queueShareDbSnapshotPersistence = shareDbRuntime.queueShareDbSnapshotPersistence
export const isRecoverableShareDbPersistenceConflict = shareDbRuntime.isRecoverableShareDbPersistenceConflict
export const createRealtimeScopeKey = shareDbRuntime.createRealtimeScopeKey
export const createScopedShareDbBackend: (
    claims: PlayCanvasEditorCompatibilityTokenClaims,
    port: PlayCanvasEditorRealtimeDocumentPort,
    options?: ScopedShareDbBackendOptions
) => ShareDB = shareDbRuntime.createScopedShareDbBackend
export const seedShareDbAssetDocumentsInBatches = shareDbRuntime.seedShareDbAssetDocumentsInBatches

const realtimeSocketHandlers = createRealtimeSocketHandlers({
    cloneRealtimeMessageData,
    getRealtimeMessageDataByteLength,
    realtimeMessageDataToText,
    MAX_REALTIME_MESSAGE_BYTES,
    MAX_REALTIME_HANDSHAKE_BUFFER_MESSAGES,
    MAX_REALTIME_HANDSHAKE_BUFFER_BYTES,
    closePolicyViolation,
    closeUnauthorized,
    isSocketOpen,
    parseRealtimeAuthMessage,
    validateFullBootClaims,
    authorizeFullBootClaims,
    registerRealtimeSocket,
    seedShareDbDocument,
    createPlayCanvasEditorNumericIds,
    getGrantedRealtimeAssetDocumentIds,
    hasCurrentFullBootAuthorization,
    seedShareDbAssetDocumentsInBatches,
    logRealtimeWarning,
    isSafePipelineJobId,
    sendMessengerEvent,
    asRecordData,
    playCanvasEditorCompatibilityAssetDeleteFrameSchema,
    isClaimedOrGrantedAssetDocument,
    captureRealtimeAssetDocumentGrantVersions,
    revokeRealtimeAssetDocuments,
    pipelineFrameSchema,
    parseCanonicalPlayCanvasEditorDocumentId,
    createPipelineReplayFingerprint,
    claimPipelineReplay,
    completePipelineReplay,
    isSafePlayCanvasEditorScriptAttributeName,
    createShareDbWebSocket,
    closeInternalError,
    isPingMessage,
    parseJsonMessage,
    messengerAuthenticateMessageSchema,
    realtimeProjectScopeKey,
    revalidateFullBootClaims,
    registerMessengerSocket,
    sendPendingMessengerEvents,
    messengerProjectWatchMessageSchema,
    hashToPositiveInt,
    relayRoomMessageSchema,
    MAX_REALTIME_RELAY_PENDING_MESSAGES,
    MAX_REALTIME_RELAY_PENDING_BYTES,
    parseSafeHttpOrigin,
    WebSocketJSONStream
})
export const handleRealtimeSocket = realtimeSocketHandlers.handleRealtimeSocket
export const handleMessengerSocket = realtimeSocketHandlers.handleMessengerSocket
export const handleRelaySocket = realtimeSocketHandlers.handleRelaySocket

export const isPlayCanvasEditorFullBootUpgradeRequest = (request: IncomingMessage, basePath?: string): boolean =>
    Boolean(parseUpgradePath(request, basePath))

export const assertPlayCanvasEditorRealtimeWorkerTopology = (): void => {
    const configuredWorkerCount = Number(process.env.PLAYCANVAS_EDITOR_REALTIME_WORKER_COUNT ?? 1)
    if (Number.isInteger(configuredWorkerCount) && configuredWorkerCount > 1) {
        throw new Error(
            'PlayCanvas Editor realtime requires one process; configure a shared durable ShareDB backend before enabling multiple workers'
        )
    }
    // Node cluster workers expose NODE_UNIQUE_ID. Starting this snapshot-port
    // runtime inside a cluster would give each worker an independent OT store
    // and can silently fork document history, so fail closed at startup.
    if (process.env.NODE_UNIQUE_ID) {
        throw new Error('PlayCanvas Editor realtime cannot run in a Node cluster worker without a shared durable ShareDB backend')
    }
}

const runtimeAttachment = createPlayCanvasEditorFullBootRuntime({
    assertPlayCanvasEditorRealtimeWorkerTopology,
    PLAYCANVAS_EDITOR_REALTIME_ASSET_RECONCILIATION_INTERVAL_MS,
    createRealtimeScopeKey,
    realtimeProjectScopeKey,
    sendMessengerEvent,
    captureRealtimeAssetDocumentGrantVersions,
    getGrantedRealtimeAssetDocumentIds,
    readRealtimeAssetDocuments,
    diffRealtimeAssetDocumentIds,
    revokeRealtimeAssetDocuments,
    grantRealtimeAssetDocuments,
    isSocketOpen,
    normalizeUpgradeBasePath,
    parseUpgradePath,
    isFullBootUpgradeOriginAllowed,
    writeUpgradeForbidden,
    writeUpgradeTooManyRequests,
    getUpgradeRemoteAddress,
    handleRealtimeSocket,
    handleMessengerSocket,
    handleRelaySocket,
    closeUnauthorized,
    closeRealtimeSocketsForClaims,
    unregisterRealtimeSocket,
    unregisterMessengerSocket,
    messengerSocketsByScope,
    pendingMessengerEventsByScope,
    clearPipelineReplayRegistry,
    createScopedShareDbBackend,
    registerRealtimeAssetDocumentSeeder,
    seedShareDbAssetDocumentsInBatches,
    addAllowedShareDbDocumentKeys,
    hasCurrentFullBootAuthorization,
    registerRealtimeSocket,
    registerMessengerSocket,
    revalidateFullBootClaims
})
export const attachPlayCanvasEditorFullBootRuntime = runtimeAttachment

export const attachPlayCanvasEditorCompatibilityRuntime = (): { attached: false; reason: 'websocketRuntimeOutsideFirstSlice' } => ({
    attached: false,
    reason: 'websocketRuntimeOutsideFirstSlice'
})
