import type { IncomingMessage } from 'node:http'
import ShareDB from 'sharedb'
import WebSocketJSONStream from '@teamwork/websocket-json-stream'
import { WebSocketServer, type WebSocket } from 'ws'
import type { PlayCanvasEditorCompatibilityTokenClaims } from '@universo-react/types'
import { PlayCanvasEditorCompatibilityTokenService } from '../tokens/index.js'
import { playCanvasEditorCompatibilityParamsSchema } from '@universo-react/types'
import {
    createPlayCanvasEditorNumericIds,
    createDefaultRealtimeSceneSettings,
    createDefaultProjectSettingsDocument,
    hashToPositiveInt
} from '../config/index.js'
import { parseSafeHttpOrigin } from '../middleware/index.js'
import { validateFullBootClaims } from '../tokens/index.js'

export interface PlayCanvasEditorRealtimeDocument {
    collection: RealtimeCollection
    id: string
    data: Record<string, unknown>
    version?: number
    checksum?: string | null
    revision?: string | null
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
}

export interface PlayCanvasEditorRealtimeRuntimeDeps {
    server: import('node:http').Server
    tokenService: PlayCanvasEditorCompatibilityTokenService
    documentPort: PlayCanvasEditorRealtimeDocumentPort
    authorize?: (claims: PlayCanvasEditorCompatibilityTokenClaims) => Promise<void>
    basePath?: string
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

export const parseJsonMessage = (value: unknown): Record<string, unknown> | null => {
    if (typeof value !== 'string') return null
    try {
        const parsed = JSON.parse(value)
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
    } catch {
        return null
    }
}

export const isPingMessage = (value: string): boolean => {
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
    return typeof accessToken === 'string' && accessToken.length > 0 ? { accessToken } : null
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

export const closeUnauthorized = (socket: WebSocket, reason = 'playcanvasEditor.fullBoot.invalidToken'): void => {
    socket.close(4401, safeSliceReason(reason))
}

export const closeInternalError = (socket: WebSocket, reason = 'playcanvasEditor.fullBoot.internalError'): void => {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1011, safeSliceReason(reason))
    }
}

export const closePolicyViolation = (socket: WebSocket, reason = 'playcanvasEditor.fullBoot.protocolViolation'): void => {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
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
        if (url.hostname === '127.0.0.1') {
            url.hostname = 'localhost'
            origins.add(url.origin)
        } else if (url.hostname === 'localhost') {
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
    return resolveAllowedFullBootUpgradeOrigins().has(requestOrigin) || isSameHostOrLoopbackSiblingUpgradeOrigin(request, requestOrigin)
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

export const createShareDbWebSocket = (socket: WebSocket): WebSocket => {
    const filteredSocket = Object.create(socket) as WebSocket
    const addEventListener: WebSocket['addEventListener'] = (type, listener, options) => {
        if (type !== 'message') {
            socket.addEventListener(type, listener, options)
            return
        }
        const wrapped = ((event: { data: unknown }) => {
            if (isPlayCanvasRealtimeControlFrame(event.data)) {
                return
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
    try {
        await deps.authorize?.(claims)
        return true
    } catch {
        closeUnauthorized(socket, 'playcanvasEditor.fullBoot.accessDenied')
        return false
    }
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
            existing = current[normalizedKey]
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

export const shareDbPersistedMetadata = new WeakMap<ShareDB, Map<string, ShareDbDocumentMetadata>>()
export const shareDbPersistQueues = new WeakMap<ShareDB, Map<string, Promise<void>>>()
export const shareDbSeedWriteKeys = new WeakMap<ShareDB, Set<string>>()
export const shareDbAllowedDocumentKeys = new WeakMap<ShareDB, Set<string>>()

export const getShareDbPersistedMetadata = (backend: ShareDB): Map<string, ShareDbDocumentMetadata> => {
    let metadata = shareDbPersistedMetadata.get(backend)
    if (!metadata) {
        metadata = new Map()
        shareDbPersistedMetadata.set(backend, metadata)
    }
    return metadata
}

export const getShareDbPersistQueues = (backend: ShareDB): Map<string, Promise<void>> => {
    let queues = shareDbPersistQueues.get(backend)
    if (!queues) {
        queues = new Map()
        shareDbPersistQueues.set(backend, queues)
    }
    return queues
}

export const getShareDbSeedWriteKeys = (backend: ShareDB): Set<string> => {
    let keys = shareDbSeedWriteKeys.get(backend)
    if (!keys) {
        keys = new Set()
        shareDbSeedWriteKeys.set(backend, keys)
    }
    return keys
}

export const getShareDbAllowedDocumentKeys = (backend: ShareDB): Set<string> => {
    let keys = shareDbAllowedDocumentKeys.get(backend)
    if (!keys) {
        keys = new Set()
        shareDbAllowedDocumentKeys.set(backend, keys)
    }
    return keys
}

export const createAllowedShareDbDocumentKeys = (claims: PlayCanvasEditorCompatibilityTokenClaims): Set<string> => {
    const numericIds = createPlayCanvasEditorNumericIds({
        metahubId: claims.metahubId,
        projectId: claims.projectId,
        sceneId: claims.sceneId ?? claims.projectId,
        userId: claims.userId
    })
    return new Set([
        `scenes:${numericIds.sceneId}`,
        `settings:${numericIds.settingsId}`,
        `settings:user_${numericIds.selfId}`,
        `settings:project_${numericIds.projectId}_${numericIds.selfId}`,
        `settings:project-private_${numericIds.projectId}`,
        `user_data:${numericIds.sceneId}_${numericIds.selfId}`,
        ...(claims.assetDocumentIds ?? []).map((id) => `assets:${id}`)
    ])
}

export const addAllowedShareDbDocumentKeys = (backend: ShareDB, claims: PlayCanvasEditorCompatibilityTokenClaims): void => {
    const keys = getShareDbAllowedDocumentKeys(backend)
    for (const key of createAllowedShareDbDocumentKeys(claims)) {
        keys.add(key)
    }
}

export const isAllowedShareDbDocument = (backend: ShareDB, collection: unknown, documentId: unknown): collection is RealtimeCollection =>
    typeof collection === 'string' &&
    typeof documentId === 'string' &&
    getShareDbAllowedDocumentKeys(backend).has(`${collection}:${documentId}`)

export const createDefaultRealtimeDocument = (
    collection: RealtimeCollection,
    documentId: string,
    claims: PlayCanvasEditorCompatibilityTokenClaims
): Record<string, unknown> => {
    const numericIds = createPlayCanvasEditorNumericIds({
        metahubId: claims.metahubId,
        projectId: claims.projectId,
        sceneId: claims.sceneId ?? claims.projectId,
        userId: claims.userId
    })
    if (collection === 'scenes') {
        return {
            item_id: numericIds.sceneId,
            name: 'Main Scene',
            settings: createDefaultRealtimeSceneSettings(),
            entities: {
                root: {
                    resource_id: 'root',
                    name: 'Root',
                    parent: null,
                    enabled: true,
                    components: {},
                    children: []
                }
            },
            scene: numericIds.sceneId
        }
    }
    if (collection === 'settings') {
        if (documentId === numericIds.settingsId || /^project_\d+$/.test(documentId)) {
            return createDefaultProjectSettingsDocument({ documentId, projectId: numericIds.projectId })
        }
        return {
            id: documentId,
            userId: numericIds.selfId,
            projectId: numericIds.projectId
        }
    }
    if (collection === 'user_data') {
        return {
            cameras: {
                perspective: {
                    position: [9.2, 6, 9],
                    rotation: [-25, 45, 0],
                    focus: [0, 0, 0]
                },
                top: { position: [0, 1000, 0], rotation: [-90, 0, 0], focus: [0, 0, 0], orthoHeight: 5 },
                bottom: { position: [0, -1000, 0], rotation: [90, 0, 0], focus: [0, 0, 0], orthoHeight: 5 },
                front: { position: [0, 0, 1000], rotation: [0, 0, 0], focus: [0, 0, 0], orthoHeight: 5 },
                back: { position: [0, 0, -1000], rotation: [0, 180, 0], focus: [0, 0, 0], orthoHeight: 5 },
                left: { position: [-1000, 0, 0], rotation: [0, -90, 0], focus: [0, 0, 0], orthoHeight: 5 },
                right: { position: [1000, 0, 0], rotation: [0, 90, 0], focus: [0, 0, 0], orthoHeight: 5 }
            }
        }
    }
    return {
        id: documentId,
        project: numericIds.projectId
    }
}

export const seedShareDbDocument = async (
    backend: ShareDB,
    input: {
        port: PlayCanvasEditorRealtimeDocumentPort
        claims: PlayCanvasEditorCompatibilityTokenClaims
        collection: RealtimeCollection
        documentId: string
    }
): Promise<void> => {
    const numericIds = createPlayCanvasEditorNumericIds({
        metahubId: input.claims.metahubId,
        projectId: input.claims.projectId,
        sceneId: input.claims.sceneId ?? input.claims.projectId,
        userId: input.claims.userId
    })
    const persisted = await input.port.loadDocument({
        metahubId: input.claims.metahubId,
        projectId: input.claims.projectId,
        sceneId: input.claims.sceneId ?? input.claims.projectId,
        userId: input.claims.userId,
        collection: input.collection,
        documentId: input.documentId,
        numericProjectId: numericIds.projectId,
        numericSceneId: numericIds.sceneId,
        numericUserId: numericIds.selfId
    })
    const connection = backend.connect()
    try {
        const doc = connection.get(input.collection, input.documentId)
        const metadataKey = `${input.collection}:${input.documentId}`
        const metadata: ShareDbDocumentMetadata = {
            checksum: persisted?.checksum ?? null,
            revision: persisted?.revision ?? null,
            dirty: false
        }
        const nextData = persisted
            ? asRecordData(persisted.data)
            : createDefaultRealtimeDocument(input.collection, input.documentId, input.claims)
        const metadataMatches = (current: ShareDbDocumentMetadata | undefined): boolean =>
            current?.dirty !== true &&
            (current?.checksum ?? null) === metadata.checksum &&
            (current?.revision ?? null) === metadata.revision
        await new Promise<void>((resolve, reject) => {
            doc.fetch((error) => {
                if (error) {
                    reject(error)
                    return
                }
                if (doc.type) {
                    const persistedMetadata = getShareDbPersistedMetadata(backend).get(metadataKey)
                    if (metadataMatches(persistedMetadata)) {
                        resolve()
                        return
                    }
                    getShareDbPersistedMetadata(backend).set(metadataKey, metadata)
                    getShareDbSeedWriteKeys(backend).add(metadataKey)
                    doc.submitOp([{ p: [], od: doc.data, oi: nextData }], (submitError) => {
                        if (submitError) {
                            getShareDbSeedWriteKeys(backend).delete(metadataKey)
                            reject(submitError)
                            return
                        }
                        resolve()
                    })
                    return
                }
                getShareDbPersistedMetadata(backend).set(metadataKey, metadata)
                getShareDbSeedWriteKeys(backend).add(metadataKey)
                doc.create(nextData, (createError) => {
                    if (createError) {
                        getShareDbSeedWriteKeys(backend).delete(metadataKey)
                        reject(createError)
                        return
                    }
                    resolve()
                })
            })
        })
        getShareDbPersistedMetadata(backend).set(metadataKey, metadata)
    } finally {
        connection.close()
    }
}

export const persistShareDbSnapshot = async (
    backend: ShareDB,
    port: PlayCanvasEditorRealtimeDocumentPort,
    claims: PlayCanvasEditorCompatibilityTokenClaims,
    persistedMetadata: Map<string, ShareDbDocumentMetadata>,
    collection: RealtimeCollection,
    documentId: string
): Promise<void> => {
    const connection = backend.connect()
    try {
        const doc = connection.get(collection, documentId)
        await new Promise<void>((resolve, reject) => {
            doc.fetch((error) => {
                if (error) {
                    reject(error)
                    return
                }
                const metadataKey = `${collection}:${documentId}`
                const metadata = persistedMetadata.get(metadataKey)
                persistedMetadata.set(metadataKey, { ...metadata, dirty: true })
                port.persistDocument({
                    metahubId: claims.metahubId,
                    projectId: claims.projectId,
                    sceneId: claims.sceneId ?? claims.projectId,
                    userId: claims.userId,
                    collection,
                    documentId,
                    data: asRecordData(doc.data),
                    version: doc.version,
                    checksum: metadata?.checksum ?? null,
                    revision: metadata?.revision ?? null
                })
                    .then((updated) => {
                        persistedMetadata.set(metadataKey, {
                            checksum: updated?.checksum ?? metadata?.checksum ?? null,
                            revision: updated?.revision ?? metadata?.revision ?? null,
                            dirty: false
                        })
                        resolve()
                    })
                    .catch(reject)
            })
        })
    } finally {
        connection.close()
    }
}

export const queueShareDbSnapshotPersistence = (
    backend: ShareDB,
    port: PlayCanvasEditorRealtimeDocumentPort,
    claims: PlayCanvasEditorCompatibilityTokenClaims,
    persistedMetadata: Map<string, ShareDbDocumentMetadata>,
    collection: RealtimeCollection,
    documentId: string
): Promise<void> => {
    const queueKey = `${collection}:${documentId}`
    const queues = getShareDbPersistQueues(backend)
    const previous = queues.get(queueKey) ?? Promise.resolve()
    const next = previous
        .catch(() => undefined)
        .then(() => persistShareDbSnapshot(backend, port, claims, persistedMetadata, collection, documentId))
    queues.set(queueKey, next)
    void next.then(
        () => {
            if (queues.get(queueKey) === next) {
                queues.delete(queueKey)
            }
        },
        () => {
            if (queues.get(queueKey) === next) {
                queues.delete(queueKey)
            }
        }
    )
    return next
}

export const isRecoverableShareDbPersistenceConflict = (error: unknown): boolean => {
    const details =
        error && typeof error === 'object' && 'details' in error && (error as { details?: unknown }).details
            ? ((error as { details?: unknown }).details as Record<string, unknown>)
            : null
    const statusCode = error && typeof error === 'object' && 'statusCode' in error ? (error as { statusCode?: unknown }).statusCode : null
    const messageCode =
        typeof details?.messageCode === 'string'
            ? details.messageCode
            : error &&
              typeof error === 'object' &&
              'messageCode' in error &&
              typeof (error as { messageCode?: unknown }).messageCode === 'string'
            ? String((error as { messageCode?: unknown }).messageCode)
            : ''
    const message = error instanceof Error ? error.message : String(error)
    return (
        statusCode === 409 ||
        /checksum.*match|current checksum|revisionMismatch|settingsRevisionMismatch|settings revision/i.test(`${messageCode} ${message}`)
    )
}

export const createRealtimeScopeKey = (claims: PlayCanvasEditorCompatibilityTokenClaims): string =>
    [claims.metahubId, claims.projectId, claims.sceneId ?? '', claims.userId].join(':')

export const createScopedShareDbBackend = (
    claims: PlayCanvasEditorCompatibilityTokenClaims,
    port: PlayCanvasEditorRealtimeDocumentPort
): ShareDB => {
    const backend = new ShareDB()
    const persistedMetadata = getShareDbPersistedMetadata(backend)
    addAllowedShareDbDocumentKeys(backend, claims)
    backend.use('submit', (context, next) => {
        if (!isAllowedShareDbDocument(backend, context.collection, context.id)) {
            next(new Error('playcanvasEditor.fullBoot.documentNotAllowed'))
            return
        }
        next()
    })
    backend.use('apply', (context, next) => {
        const collection = context.collection as RealtimeCollection
        const documentId = context.id as string
        if (!isAllowedShareDbDocument(backend, collection, documentId)) {
            next()
            return
        }
        const snapshotData = asRecordData((context as { snapshot?: { data?: unknown } }).snapshot?.data)
        repairSnapshotForJson0ListOperations(snapshotData, (context as { op?: { op?: unknown } }).op?.op)
        next()
    })
    backend.use('afterWrite', (context, next) => {
        const collection = context.collection as RealtimeCollection
        const documentId = context.id as string
        if (!isAllowedShareDbDocument(backend, collection, documentId)) {
            next()
            return
        }
        const queueKey = `${collection}:${documentId}`
        if (getShareDbSeedWriteKeys(backend).delete(queueKey)) {
            next()
            return
        }
        queueShareDbSnapshotPersistence(backend, port, claims, persistedMetadata, collection, documentId)
            .then(() => next())
            .catch((error) => {
                if (!isRecoverableShareDbPersistenceConflict(error)) {
                    next(error)
                    return
                }
                seedShareDbDocument(backend, { port, claims, collection, documentId })
                    .then(() => next())
                    .catch(next)
            })
    })
    return backend
}

export const seedShareDbAssetDocumentsInBatches = async (
    backend: ShareDB,
    port: PlayCanvasEditorRealtimeDocumentPort,
    claims: PlayCanvasEditorCompatibilityTokenClaims,
    assetDocumentIds: readonly number[],
    batchSize = 16
): Promise<void> => {
    for (let index = 0; index < assetDocumentIds.length; index += batchSize) {
        const batch = assetDocumentIds.slice(index, index + batchSize)
        await Promise.all(
            batch.map((documentId) =>
                seedShareDbDocument(backend, {
                    port,
                    claims,
                    collection: 'assets',
                    documentId: String(documentId)
                })
            )
        )
    }
}

export const handleRealtimeSocket = (
    socket: WebSocket,
    request: IncomingMessage,
    deps: PlayCanvasEditorRealtimeRuntimeDeps,
    path: NonNullable<ReturnType<typeof parseUpgradePath>>,
    getBackend: (claims: PlayCanvasEditorCompatibilityTokenClaims) => ShareDB,
    reserveAuth: (socket: WebSocket, claims: PlayCanvasEditorCompatibilityTokenClaims, surface: RealtimeSurface) => boolean
) => {
    const authTimer = setTimeout(() => closeUnauthorized(socket, 'playcanvasEditor.fullBoot.authTimeout'), 10_000)
    socket.once('close', () => clearTimeout(authTimer))

    socket.once('message', async (data) => {
        try {
            const auth = parseRealtimeAuthMessage(data.toString())
            if (!auth) {
                closeUnauthorized(socket, 'playcanvasEditor.fullBoot.invalidRealtimeAuth')
                return
            }
            const claims = validateFullBootClaims(deps.tokenService, auth.accessToken, {
                metahubId: path.metahubId,
                projectId: path.projectId,
                origin: parseSafeHttpOrigin(request.headers.origin) ?? null
            })
            if (!claims) {
                closeUnauthorized(socket)
                return
            }
            if (!(await authorizeFullBootClaims(deps, socket, claims))) return
            if (!isSocketOpen(socket)) return
            if (!reserveAuth(socket, claims, path.surface)) return
            clearTimeout(authTimer)
            const backend = getBackend(claims)
            const numericIds = createPlayCanvasEditorNumericIds({
                metahubId: claims.metahubId,
                projectId: claims.projectId,
                sceneId: claims.sceneId ?? claims.projectId,
                userId: claims.userId
            })
            await Promise.all([
                seedShareDbDocument(backend, {
                    port: deps.documentPort,
                    claims,
                    collection: 'scenes',
                    documentId: String(numericIds.sceneId)
                }),
                seedShareDbDocument(backend, {
                    port: deps.documentPort,
                    claims,
                    collection: 'settings',
                    documentId: numericIds.settingsId
                }),
                seedShareDbDocument(backend, {
                    port: deps.documentPort,
                    claims,
                    collection: 'settings',
                    documentId: `user_${numericIds.selfId}`
                }),
                seedShareDbDocument(backend, {
                    port: deps.documentPort,
                    claims,
                    collection: 'settings',
                    documentId: `project_${numericIds.projectId}_${numericIds.selfId}`
                }),
                seedShareDbDocument(backend, {
                    port: deps.documentPort,
                    claims,
                    collection: 'settings',
                    documentId: `project-private_${numericIds.projectId}`
                }),
                seedShareDbDocument(backend, {
                    port: deps.documentPort,
                    claims,
                    collection: 'user_data',
                    documentId: `${numericIds.sceneId}_${numericIds.selfId}`
                })
            ])
            if (!isSocketOpen(socket)) return
            socket.send('auth{"ok":true}')
            const stream = new WebSocketJSONStream(createShareDbWebSocket(socket))
            stream.on('error', () => closeInternalError(socket, 'playcanvasEditor.fullBoot.realtimeProtocolError'))
            backend.listen(stream, request)
            const assetDocumentIds = claims.assetDocumentIds ?? []
            if (assetDocumentIds.length > 0) {
                void seedShareDbAssetDocumentsInBatches(backend, deps.documentPort, claims, assetDocumentIds).catch((error) => {
                    console.warn('[PlayCanvasEditorFullBootRuntime] Failed to seed signed realtime asset documents', {
                        metahubId: claims.metahubId,
                        projectId: claims.projectId,
                        assetDocumentCount: assetDocumentIds.length,
                        error: error instanceof Error ? error.message : String(error)
                    })
                    if (isSocketOpen(socket)) {
                        closeInternalError(socket, 'playcanvasEditor.fullBoot.assetSeedFailed')
                    }
                })
            }
        } catch (error) {
            console.warn('[PlayCanvasEditorFullBootRuntime] Realtime socket initialization failed', {
                metahubId: path.metahubId,
                projectId: path.projectId,
                error: error instanceof Error ? error.message : String(error)
            })
            clearTimeout(authTimer)
            closeInternalError(socket)
        }
    })
}

export const handleMessengerSocket = (
    socket: WebSocket,
    request: IncomingMessage,
    deps: PlayCanvasEditorRealtimeRuntimeDeps,
    path: NonNullable<ReturnType<typeof parseUpgradePath>>,
    reserveAuth: (socket: WebSocket, claims: PlayCanvasEditorCompatibilityTokenClaims, surface: RealtimeSurface) => boolean
) => {
    let authenticatedClaims: PlayCanvasEditorCompatibilityTokenClaims | null = null
    let authenticating = false
    const authTimer = setTimeout(() => closeUnauthorized(socket, 'playcanvasEditor.fullBoot.authTimeout'), 10_000)
    socket.once('close', () => clearTimeout(authTimer))
    socket.on('message', async (data) => {
        try {
            const raw = data.toString()
            if (isPingMessage(raw)) {
                socket.send('pong')
                return
            }
            const msg = parseJsonMessage(raw)
            if (!msg) return
            if (msg.name === 'authenticate') {
                if (authenticating) return
                authenticating = true
                try {
                    const token = typeof msg.token === 'string' ? msg.token : ''
                    const claims = validateFullBootClaims(deps.tokenService, token, {
                        metahubId: path.metahubId,
                        projectId: path.projectId,
                        origin: parseSafeHttpOrigin(request.headers.origin) ?? null
                    })
                    if (!claims) {
                        closeUnauthorized(socket)
                        return
                    }
                    if (!(await authorizeFullBootClaims(deps, socket, claims))) return
                    if (!isSocketOpen(socket)) return
                    if (!reserveAuth(socket, claims, path.surface)) return
                    clearTimeout(authTimer)
                    authenticatedClaims = claims
                    socket.send(
                        JSON.stringify({
                            name: 'welcome',
                            userId: createPlayCanvasEditorNumericIds({
                                metahubId: claims.metahubId,
                                projectId: claims.projectId,
                                sceneId: claims.sceneId ?? claims.projectId,
                                userId: claims.userId
                            }).selfId
                        })
                    )
                    return
                } finally {
                    authenticating = false
                }
            }
            if (!authenticatedClaims) {
                closeUnauthorized(socket, 'playcanvasEditor.fullBoot.messengerAuthRequired')
                return
            }
            if (msg.name === 'project.watch') {
                socket.send(JSON.stringify({ name: 'project.watch', ok: true }))
            }
        } catch {
            clearTimeout(authTimer)
            closeInternalError(socket)
        }
    })
}

export const handleRelaySocket = (
    socket: WebSocket,
    request: IncomingMessage,
    deps: PlayCanvasEditorRealtimeRuntimeDeps,
    path: NonNullable<ReturnType<typeof parseUpgradePath>>,
    reserveAuth: (socket: WebSocket, claims: PlayCanvasEditorCompatibilityTokenClaims, surface: RealtimeSurface) => boolean
): void => {
    const maxPendingMessages = 16
    let userId: number = hashToPositiveInt(`relay:${path.metahubId}:${path.projectId}`)
    let authenticationPending = false
    let authenticated = false
    const pendingMessages: string[] = []
    const authTimer = setTimeout(() => closeUnauthorized(socket, 'playcanvasEditor.fullBoot.authTimeout'), 10_000)
    socket.once('close', () => {
        clearTimeout(authTimer)
        pendingMessages.length = 0
    })

    const authenticate = async (token: string): Promise<boolean> => {
        if (authenticationPending) return true
        authenticationPending = true
        try {
            const claims = validateFullBootClaims(deps.tokenService, token, {
                metahubId: path.metahubId,
                projectId: path.projectId,
                origin: parseSafeHttpOrigin(request.headers.origin) ?? null
            })
            if (!claims) {
                return false
            }
            if (!(await authorizeFullBootClaims(deps, socket, claims))) return false
            if (!isSocketOpen(socket)) return false
            if (!reserveAuth(socket, claims, path.surface)) return false
            userId = createPlayCanvasEditorNumericIds({
                metahubId: claims.metahubId,
                projectId: claims.projectId,
                sceneId: claims.sceneId ?? claims.projectId,
                userId: claims.userId
            }).selfId
            authenticated = true
            clearTimeout(authTimer)
            socket.send(JSON.stringify({ t: 'welcome', userId }))
            return true
        } finally {
            authenticationPending = false
        }
    }

    const handleAuthenticatedMessage = (msg: Record<string, unknown>): void => {
        if (msg.t === 'room:join' && typeof msg.name === 'string') {
            socket.send(JSON.stringify({ t: 'room:join', name: msg.name, users: [userId] }))
            return
        }
        if (msg.t === 'room:leave' && typeof msg.name === 'string') {
            socket.send(JSON.stringify({ t: 'room:leave', name: msg.name, userId }))
        }
    }

    socket.on('message', async (data) => {
        try {
            const raw = data.toString()
            if (isPingMessage(raw)) {
                socket.send('pong')
                return
            }
            const msg = parseJsonMessage(raw)
            if (!msg) return
            if (authenticationPending) {
                if (pendingMessages.length >= maxPendingMessages) {
                    closePolicyViolation(socket, 'playcanvasEditor.fullBoot.relayPendingLimit')
                    return
                }
                pendingMessages.push(raw)
                return
            }
            if (msg.t === 'authenticate') {
                const token = typeof msg.token === 'string' ? msg.token : ''
                const isAuthenticated = await authenticate(token)
                if (isAuthenticated) {
                    while (pendingMessages.length > 0) {
                        const pending = parseJsonMessage(pendingMessages.shift() ?? '')
                        if (pending) handleAuthenticatedMessage(pending)
                    }
                } else {
                    closeUnauthorized(socket)
                }
                return
            }
            if (!authenticated) {
                return
            }
            handleAuthenticatedMessage(msg)
        } catch {
            closeInternalError(socket)
        }
    })
}

export const isPlayCanvasEditorFullBootUpgradeRequest = (request: IncomingMessage, basePath?: string): boolean =>
    Boolean(parseUpgradePath(request, basePath))

export const attachPlayCanvasEditorFullBootRuntime = (deps: PlayCanvasEditorRealtimeRuntimeDeps): PlayCanvasEditorRealtimeRuntimeHandle => {
    const basePath = normalizeUpgradeBasePath(deps.basePath)
    const backends = new Map<string, ShareDB>()
    const activeSocketKeys = new Map<string, WebSocket>()
    const authTimers = new Map<WebSocket, NodeJS.Timeout>()
    const pendingUnauthSockets = new Map<string, number>()
    const pendingUnauthSocketLimit = 128
    const pendingUnauthSocketLimitPerAddress = 16
    let pendingUnauthSocketCount = 0
    const reservePendingAuthSocket = (request: IncomingMessage): (() => void) | null => {
        const remoteAddress = getUpgradeRemoteAddress(request)
        const addressCount = pendingUnauthSockets.get(remoteAddress) ?? 0
        if (pendingUnauthSocketCount >= pendingUnauthSocketLimit || addressCount >= pendingUnauthSocketLimitPerAddress) {
            return null
        }
        pendingUnauthSocketCount += 1
        pendingUnauthSockets.set(remoteAddress, addressCount + 1)
        let released = false
        return () => {
            if (released) return
            released = true
            pendingUnauthSocketCount = Math.max(0, pendingUnauthSocketCount - 1)
            const nextAddressCount = (pendingUnauthSockets.get(remoteAddress) ?? 1) - 1
            if (nextAddressCount > 0) {
                pendingUnauthSockets.set(remoteAddress, nextAddressCount)
            } else {
                pendingUnauthSockets.delete(remoteAddress)
            }
        }
    }
    const authKeyFor = (claims: PlayCanvasEditorCompatibilityTokenClaims, surface: RealtimeSurface): string =>
        [claims.metahubId, claims.projectId, claims.sceneId ?? '', claims.userId, claims.sessionId, claims.nonce, surface].join(':')
    const reserveAuth = (socket: WebSocket, claims: PlayCanvasEditorCompatibilityTokenClaims, surface: RealtimeSurface): boolean => {
        const key = authKeyFor(claims, surface)
        const activeSocket = activeSocketKeys.get(key)
        if (activeSocket && activeSocket !== socket && isSocketOpen(activeSocket)) {
            closeUnauthorized(socket, 'playcanvasEditor.fullBoot.sessionAlreadyActive')
            return false
        }
        activeSocketKeys.set(key, socket)
        const ttl = claims.expiresAt - Date.now()
        if (ttl <= 0) {
            activeSocketKeys.delete(key)
            closeUnauthorized(socket, 'playcanvasEditor.fullBoot.tokenExpired')
            return false
        }
        const expiryTimer = setTimeout(() => closeUnauthorized(socket, 'playcanvasEditor.fullBoot.tokenExpired'), ttl)
        authTimers.set(socket, expiryTimer)
        socket.once('close', () => {
            if (activeSocketKeys.get(key) === socket) {
                activeSocketKeys.delete(key)
            }
            const timer = authTimers.get(socket)
            if (timer) {
                clearTimeout(timer)
                authTimers.delete(socket)
            }
        })
        return true
    }
    const getBackend = (claims: PlayCanvasEditorCompatibilityTokenClaims): ShareDB => {
        const key = createRealtimeScopeKey(claims)
        let backend = backends.get(key)
        if (!backend) {
            backend = createScopedShareDbBackend(claims, deps.documentPort)
            backends.set(key, backend)
        } else {
            addAllowedShareDbDocumentKeys(backend, claims)
        }
        return backend
    }
    const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 })
    const paths = {
        realtime: `${basePath}/:metahubId/playcanvas/editor-compatible/projects/:projectId/realtime`,
        messenger: `${basePath}/:metahubId/playcanvas/editor-compatible/projects/:projectId/messenger`,
        relay: `${basePath}/:metahubId/playcanvas/editor-compatible/projects/:projectId/relay`
    }
    const onUpgrade = (request: IncomingMessage, socket: import('node:net').Socket, head: Buffer) => {
        const path = parseUpgradePath(request, basePath)
        if (!path) return
        if (!isFullBootUpgradeOriginAllowed(request)) {
            writeUpgradeForbidden(socket)
            return
        }
        const releasePendingAuth = reservePendingAuthSocket(request)
        if (!releasePendingAuth) {
            writeUpgradeTooManyRequests(socket)
            return
        }
        try {
            webSocketServer.handleUpgrade(request, socket, head, (ws) => {
                ws.once('close', releasePendingAuth)
                const reserveAuthenticatedSocket = (
                    authenticatedSocket: WebSocket,
                    claims: PlayCanvasEditorCompatibilityTokenClaims,
                    surface: RealtimeSurface
                ): boolean => {
                    releasePendingAuth()
                    return reserveAuth(authenticatedSocket, claims, surface)
                }
                if (path.surface === 'realtime') {
                    handleRealtimeSocket(ws, request, deps, path, getBackend, reserveAuthenticatedSocket)
                    return
                }
                if (path.surface === 'messenger') {
                    handleMessengerSocket(ws, request, deps, path, reserveAuthenticatedSocket)
                    return
                }
                handleRelaySocket(ws, request, deps, path, reserveAuthenticatedSocket)
            })
        } catch (error) {
            releasePendingAuth()
            throw error
        }
    }
    deps.server.on('upgrade', onUpgrade)
    return {
        paths,
        close: async () => {
            deps.server.off('upgrade', onUpgrade)
            for (const timer of authTimers.values()) {
                clearTimeout(timer)
            }
            authTimers.clear()
            activeSocketKeys.clear()
            pendingUnauthSockets.clear()
            pendingUnauthSocketCount = 0
            for (const backend of backends.values()) {
                await new Promise<void>((resolve) => {
                    const close = (backend as ShareDB & { close?: (callback: () => void) => void }).close
                    if (!close) {
                        resolve()
                        return
                    }
                    close.call(backend, resolve)
                })
            }
            await new Promise<void>((resolve, reject) => webSocketServer.close((error) => (error ? reject(error) : resolve())))
        }
    }
}

export const attachPlayCanvasEditorCompatibilityRuntime = (): { attached: false; reason: 'websocketRuntimeOutsideFirstSlice' } => ({
    attached: false,
    reason: 'websocketRuntimeOutsideFirstSlice'
})
