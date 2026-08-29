import type { IncomingMessage } from 'node:http'
import { WebSocketServer, type WebSocket } from 'ws'
import type ShareDB from 'sharedb'
import type { PlayCanvasEditorCompatibilityTokenClaims } from '@universo-react/types'
import type {
    PlayCanvasEditorRealtimeAssetDocument,
    PlayCanvasEditorRealtimeRuntimeDeps,
    PlayCanvasEditorRealtimeRuntimeHandle,
    RealtimeSurface
} from './index.js'

export interface RealtimeRuntimeAttachmentContext {
    // Runtime bindings are deliberately opaque at this seam; the facade owns
    // their concrete implementations and keeps one shared state graph.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly [key: string]: any
}

export const createPlayCanvasEditorFullBootRuntime = (context: RealtimeRuntimeAttachmentContext) => {
    const {
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
        hasCurrentFullBootAuthorization
    } = context
    const attachPlayCanvasEditorFullBootRuntime = (deps: PlayCanvasEditorRealtimeRuntimeDeps): PlayCanvasEditorRealtimeRuntimeHandle => {
        assertPlayCanvasEditorRealtimeWorkerTopology()
        const basePath = normalizeUpgradeBasePath(deps.basePath)
        const backends = new Map<string, ShareDB>()
        const unregisterAssetDocumentSeeders = new Map<ShareDB, () => void>()
        const backendAuthorizationChecks = new WeakMap<ShareDB, Set<() => Promise<boolean>>>()
        const backendSocketCounts = new Map<string, number>()
        const backendEvictionTimers = new Map<string, NodeJS.Timeout>()
        const backendEvictionDelayMs = 30_000
        type AssetReconciliationScope = {
            key: string
            projectScopeKey: string
            claims: PlayCanvasEditorCompatibilityTokenClaims
            sockets: Set<WebSocket>
            documents: Map<number, PlayCanvasEditorRealtimeAssetDocument> | null
            timer: NodeJS.Timeout | null
            inFlight: Promise<void> | null
            active: boolean
        }
        const assetReconciliationScopes = new Map<string, AssetReconciliationScope>()
        const assetReconciliationScopesByProject = new Map<string, Set<AssetReconciliationScope>>()
        const assetReconciliationIntervalMs =
            typeof deps.assetReconciliationIntervalMs === 'number' && Number.isFinite(deps.assetReconciliationIntervalMs)
                ? Math.min(Math.max(Math.floor(deps.assetReconciliationIntervalMs), 25), 60_000)
                : PLAYCANVAS_EDITOR_REALTIME_ASSET_RECONCILIATION_INTERVAL_MS
        const hasAssetReconciliationPort = Boolean(deps.documentPort.listAssetDocuments || deps.documentPort.listAssetDocumentIds)
        const activeSocketKeys = new Map<string, WebSocket>()
        const authTimers = new Map<WebSocket, NodeJS.Timeout>()
        const pendingUpgradeSockets = new Set<WebSocket>()
        const authenticatedSockets = new Set<WebSocket>()
        const ownedMessengerScopeKeys = new Set<string>()
        const trackAuthenticatedSocket = (socket: WebSocket): void => {
            pendingUpgradeSockets.delete(socket)
            authenticatedSockets.add(socket)
            socket.once('close', () => authenticatedSockets.delete(socket))
        }
        const releaseBackendSocket = (key: string): void => {
            const nextCount = Math.max(0, (backendSocketCounts.get(key) ?? 1) - 1)
            if (nextCount > 0) {
                backendSocketCounts.set(key, nextCount)
                return
            }
            backendSocketCounts.delete(key)
            if (backendEvictionTimers.has(key)) return
            const timer = setTimeout(() => {
                backendEvictionTimers.delete(key)
                if ((backendSocketCounts.get(key) ?? 0) > 0) return
                const backend = backends.get(key)
                if (!backend) return
                backends.delete(key)
                const unregister = unregisterAssetDocumentSeeders.get(backend)
                unregister?.()
                unregisterAssetDocumentSeeders.delete(backend)
                const close = (backend as ShareDB & { close?: (callback: (error?: Error) => void) => void }).close
                if (typeof close === 'function') {
                    close.call(backend, () => undefined)
                }
            }, backendEvictionDelayMs)
            timer.unref?.()
            backendEvictionTimers.set(key, timer)
        }
        const trackBackendSocket = (key: string, socket: WebSocket): void => {
            const evictionTimer = backendEvictionTimers.get(key)
            if (evictionTimer) {
                clearTimeout(evictionTimer)
                backendEvictionTimers.delete(key)
            }
            backendSocketCounts.set(key, (backendSocketCounts.get(key) ?? 0) + 1)
            socket.once('close', () => releaseBackendSocket(key))
        }
        const stopAssetReconciliationScope = (scope: AssetReconciliationScope): void => {
            if (!scope.active) return
            scope.active = false
            if (scope.timer) {
                clearInterval(scope.timer)
                scope.timer = null
            }
            scope.sockets.clear()
            if (assetReconciliationScopes.get(scope.key) === scope) {
                assetReconciliationScopes.delete(scope.key)
            }
            const projectScopes = assetReconciliationScopesByProject.get(scope.projectScopeKey)
            projectScopes?.delete(scope)
            if (projectScopes?.size === 0) {
                assetReconciliationScopesByProject.delete(scope.projectScopeKey)
            }
        }
        const sendReconciledAssetNew = (
            claims: PlayCanvasEditorCompatibilityTokenClaims,
            document: PlayCanvasEditorRealtimeAssetDocument
        ): void => {
            sendMessengerEvent(claims.metahubId, claims.projectId, 'asset.new', {
                asset: {
                    branchId: document.branchId,
                    id: String(document.id),
                    source: document.source,
                    status: document.status,
                    type: document.type,
                    source_asset_id: document.sourceAssetId,
                    createdAt: document.createdAt
                }
            })
        }
        const reconcileAssetScope = async (scope: AssetReconciliationScope): Promise<void> => {
            if (!scope.active || scope.sockets.size === 0) return
            const previousDocuments = scope.documents
            const expectedVersions = captureRealtimeAssetDocumentGrantVersions(
                scope.claims.metahubId,
                scope.claims.projectId,
                previousDocuments
                    ? [...previousDocuments.keys()]
                    : getGrantedRealtimeAssetDocumentIds(scope.claims.metahubId, scope.claims.projectId)
            )
            const nextDocuments = await readRealtimeAssetDocuments(deps, scope.claims)
            if (!scope.active || scope.sockets.size === 0) return
            scope.documents = nextDocuments
            if (!previousDocuments) {
                const projectScopes = assetReconciliationScopesByProject.get(scope.projectScopeKey)
                const observedByAnotherActiveScope = new Set<number>()
                for (const candidate of projectScopes ?? []) {
                    if (candidate === scope || !candidate.active || !candidate.documents) continue
                    for (const documentId of candidate.documents.keys()) observedByAnotherActiveScope.add(documentId)
                }
                const staleGrantedDocumentIds = getGrantedRealtimeAssetDocumentIds(scope.claims.metahubId, scope.claims.projectId).filter(
                    (documentId) => !nextDocuments.has(documentId) && !observedByAnotherActiveScope.has(documentId)
                )
                const revoked = revokeRealtimeAssetDocuments(
                    scope.claims.metahubId,
                    scope.claims.projectId,
                    staleGrantedDocumentIds,
                    expectedVersions
                )
                for (const documentId of revoked) {
                    sendMessengerEvent(scope.claims.metahubId, scope.claims.projectId, 'asset.delete', { asset: { id: documentId } })
                }
                await grantRealtimeAssetDocuments(scope.claims.metahubId, scope.claims.projectId, [...nextDocuments.keys()])
                return
            }

            const diff = diffRealtimeAssetDocumentIds([...previousDocuments.keys()], [...nextDocuments.keys()])
            if (diff.added.length > 0) {
                const newlyGranted = await grantRealtimeAssetDocuments(scope.claims.metahubId, scope.claims.projectId, diff.added)
                for (const documentId of newlyGranted) {
                    const document = nextDocuments.get(documentId)
                    if (document) sendReconciledAssetNew(scope.claims, document)
                }
            }

            const projectScopes = assetReconciliationScopesByProject.get(scope.projectScopeKey)
            const removedFromEveryActiveScope = diff.removed.filter(
                (documentId) =>
                    !Array.from(projectScopes ?? []).some(
                        (candidate) => candidate !== scope && candidate.active && candidate.documents?.has(documentId)
                    )
            )
            if (removedFromEveryActiveScope.length === 0) return
            const revoked = revokeRealtimeAssetDocuments(
                scope.claims.metahubId,
                scope.claims.projectId,
                removedFromEveryActiveScope,
                expectedVersions
            )
            for (const documentId of revoked) {
                sendMessengerEvent(scope.claims.metahubId, scope.claims.projectId, 'asset.delete', { asset: { id: documentId } })
            }
        }
        const pollAssetScope = (scope: AssetReconciliationScope): void => {
            if (!scope.active || scope.sockets.size === 0 || scope.inFlight) return
            const current = reconcileAssetScope(scope)
            scope.inFlight = current
            void current
                .catch(() => {
                    // A transient DB/adapter failure leaves the last known set in
                    // place. The next interval retries without revoking anything
                    // based on an incomplete response.
                })
                .finally(() => {
                    if (scope.inFlight === current) scope.inFlight = null
                })
        }
        const trackAssetReconciliationScope = (claims: PlayCanvasEditorCompatibilityTokenClaims, socket: WebSocket): void => {
            if (!hasAssetReconciliationPort) return
            const key = createRealtimeScopeKey(claims)
            let scope = assetReconciliationScopes.get(key)
            if (!scope) {
                const projectScopeKey = realtimeProjectScopeKey(claims.metahubId, claims.projectId)
                scope = {
                    key,
                    projectScopeKey,
                    claims,
                    sockets: new Set<WebSocket>(),
                    documents: null,
                    timer: null,
                    inFlight: null,
                    active: true
                }
                assetReconciliationScopes.set(key, scope)
                let projectScopes = assetReconciliationScopesByProject.get(projectScopeKey)
                if (!projectScopes) {
                    projectScopes = new Set<AssetReconciliationScope>()
                    assetReconciliationScopesByProject.set(projectScopeKey, projectScopes)
                }
                projectScopes.add(scope)
            }
            scope.sockets.add(socket)
            socket.once('close', () => {
                scope?.sockets.delete(socket)
                if (scope?.sockets.size === 0) stopAssetReconciliationScope(scope)
            })
            if (!scope.timer) {
                scope.timer = setInterval(() => pollAssetScope(scope as AssetReconciliationScope), assetReconciliationIntervalMs)
                scope.timer.unref?.()
                pollAssetScope(scope)
            }
        }
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
        const getBackend = (
            claims: PlayCanvasEditorCompatibilityTokenClaims,
            revalidate: () => Promise<boolean> = () => hasCurrentFullBootAuthorization(deps, claims),
            socket?: WebSocket
        ): ShareDB => {
            const key = createRealtimeScopeKey(claims)
            let backend = backends.get(key)
            if (!backend) {
                const authorizationChecks = new Set<() => Promise<boolean>>()
                backend = createScopedShareDbBackend(claims, deps.documentPort, {
                    revalidate: async () => {
                        for (const check of authorizationChecks) {
                            if (!(await check())) return false
                        }
                        return true
                    },
                    onAuthorizationFailure: () => closeRealtimeSocketsForClaims(claims),
                    onPersistenceFailure: () => closeRealtimeSocketsForClaims(claims)
                })
                backendAuthorizationChecks.set(backend, authorizationChecks)
                backends.set(key, backend)
                unregisterAssetDocumentSeeders.set(
                    backend,
                    registerRealtimeAssetDocumentSeeder(claims.metahubId, claims.projectId, (documentIds) =>
                        seedShareDbAssetDocumentsInBatches(backend, deps.documentPort, claims, documentIds)
                    )
                )
            } else {
                addAllowedShareDbDocumentKeys(backend, claims)
            }
            const authorizationChecks = backendAuthorizationChecks.get(backend)
            if (authorizationChecks) {
                authorizationChecks.add(revalidate)
                socket?.once('close', () => authorizationChecks.delete(revalidate))
            }
            if (socket) trackBackendSocket(key, socket)
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
                    pendingUpgradeSockets.add(ws)
                    ws.once('close', () => {
                        pendingUpgradeSockets.delete(ws)
                        releasePendingAuth()
                    })
                    const reserveAuthenticatedSocket = (
                        authenticatedSocket: WebSocket,
                        claims: PlayCanvasEditorCompatibilityTokenClaims,
                        surface: RealtimeSurface
                    ): boolean => {
                        releasePendingAuth()
                        return reserveAuth(authenticatedSocket, claims, surface)
                    }
                    if (path.surface === 'realtime') {
                        handleRealtimeSocket(
                            ws,
                            request,
                            deps,
                            path,
                            getBackend,
                            reserveAuthenticatedSocket,
                            trackAuthenticatedSocket,
                            trackAssetReconciliationScope
                        )
                        return
                    }
                    if (path.surface === 'messenger') {
                        handleMessengerSocket(
                            ws,
                            request,
                            deps,
                            path,
                            reserveAuthenticatedSocket,
                            trackAuthenticatedSocket,
                            (scopeKey) => ownedMessengerScopeKeys.add(scopeKey),
                            trackAssetReconciliationScope
                        )
                        return
                    }
                    handleRelaySocket(ws, request, deps, path, reserveAuthenticatedSocket, trackAuthenticatedSocket)
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
                for (const socket of pendingUpgradeSockets) {
                    closeUnauthorized(socket, 'playcanvasEditor.fullBoot.runtimeClosed')
                }
                pendingUpgradeSockets.clear()
                for (const socket of authenticatedSockets) {
                    unregisterRealtimeSocket(socket)
                    unregisterMessengerSocket(socket)
                    closeUnauthorized(socket, 'playcanvasEditor.fullBoot.runtimeClosed')
                }
                authenticatedSockets.clear()
                for (const scope of assetReconciliationScopes.values()) {
                    stopAssetReconciliationScope(scope)
                }
                assetReconciliationScopes.clear()
                assetReconciliationScopesByProject.clear()
                pendingUnauthSockets.clear()
                pendingUnauthSocketCount = 0
                for (const scopeKey of ownedMessengerScopeKeys) {
                    if (!(messengerSocketsByScope.get(scopeKey)?.size ?? 0)) {
                        pendingMessengerEventsByScope.delete(scopeKey)
                    }
                }
                ownedMessengerScopeKeys.clear()
                for (const timer of backendEvictionTimers.values()) {
                    clearTimeout(timer)
                }
                backendEvictionTimers.clear()
                backendSocketCounts.clear()
                for (const unregister of unregisterAssetDocumentSeeders.values()) {
                    unregister()
                }
                unregisterAssetDocumentSeeders.clear()
                for (const backend of backends.values()) {
                    clearPipelineReplayRegistry(backend)
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
    return attachPlayCanvasEditorFullBootRuntime
}
