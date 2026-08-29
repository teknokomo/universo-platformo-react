import type { IncomingMessage } from 'node:http'
import type { RawData, WebSocket } from 'ws'
import type ShareDB from 'sharedb'
import type { PlayCanvasEditorCompatibilityTokenClaims } from '@universo-react/types'
import type { PlayCanvasEditorRealtimeRuntimeDeps, RealtimeSurface } from './index.js'
import type { PipelineReplayResult } from './pipelineReplay.js'

type RealtimeUpgradePath = { metahubId: string; projectId: string; surface: RealtimeSurface }
type BufferedRealtimeMessageData = string | Buffer | ArrayBuffer | Buffer[]
interface BufferedRealtimeMessage {
    data: BufferedRealtimeMessageData
    isBinary: boolean
}

export interface RealtimeSocketHandlerContext {
    // The factory deliberately accepts opaque runtime bindings so that the
    // protocol handlers stay independent from the persistence/registry module.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly [key: string]: any
}

export interface RealtimeSocketHandlers {
    handleRealtimeSocket: (
        socket: WebSocket,
        request: IncomingMessage,
        deps: PlayCanvasEditorRealtimeRuntimeDeps,
        path: RealtimeUpgradePath,
        getBackend: (claims: PlayCanvasEditorCompatibilityTokenClaims, revalidate?: () => Promise<boolean>, socket?: WebSocket) => ShareDB,
        reserveAuth: (socket: WebSocket, claims: PlayCanvasEditorCompatibilityTokenClaims, surface: RealtimeSurface) => boolean,
        trackAuthenticatedSocket?: (socket: WebSocket) => void,
        trackAssetReconciliationScope?: (claims: PlayCanvasEditorCompatibilityTokenClaims, socket: WebSocket) => void
    ) => void
    handleMessengerSocket: (
        socket: WebSocket,
        request: IncomingMessage,
        deps: PlayCanvasEditorRealtimeRuntimeDeps,
        path: RealtimeUpgradePath,
        reserveAuth: (socket: WebSocket, claims: PlayCanvasEditorCompatibilityTokenClaims, surface: RealtimeSurface) => boolean,
        trackAuthenticatedSocket?: (socket: WebSocket) => void,
        trackMessengerScope?: (scopeKey: string) => void,
        trackAssetReconciliationScope?: (claims: PlayCanvasEditorCompatibilityTokenClaims, socket: WebSocket) => void
    ) => void
    handleRelaySocket: (
        socket: WebSocket,
        request: IncomingMessage,
        deps: PlayCanvasEditorRealtimeRuntimeDeps,
        path: RealtimeUpgradePath,
        reserveAuth: (socket: WebSocket, claims: PlayCanvasEditorCompatibilityTokenClaims, surface: RealtimeSurface) => boolean,
        trackAuthenticatedSocket?: (socket: WebSocket) => void
    ) => void
}

export const createRealtimeSocketHandlers = (context: RealtimeSocketHandlerContext): RealtimeSocketHandlers => {
    const {
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
    } = context
    const handleRealtimeSocket = (
        socket: WebSocket,
        request: IncomingMessage,
        deps: PlayCanvasEditorRealtimeRuntimeDeps,
        path: RealtimeUpgradePath,
        getBackend: (claims: PlayCanvasEditorCompatibilityTokenClaims, revalidate?: () => Promise<boolean>, socket?: WebSocket) => ShareDB,
        reserveAuth: (socket: WebSocket, claims: PlayCanvasEditorCompatibilityTokenClaims, surface: RealtimeSurface) => boolean,
        trackAuthenticatedSocket?: (socket: WebSocket) => void,
        trackAssetReconciliationScope?: (claims: PlayCanvasEditorCompatibilityTokenClaims, socket: WebSocket) => void
    ) => {
        // The auth handler awaits durable hydration before attaching ShareDB. ws
        // still emits client frames during that interval, so retain a bounded
        // queue instead of silently dropping subscriptions or operations.
        const bufferedMessages: BufferedRealtimeMessage[] = []
        let bufferedMessageBytes = 0
        let authStarted = false
        let streamReady = false
        let handshakeClosed = false
        let onPendingMessage: ((data: RawData, isBinary: boolean) => void) | null = null

        const clearBufferedMessages = (): void => {
            bufferedMessages.length = 0
            bufferedMessageBytes = 0
        }

        const stopHandshakeBuffer = (): void => {
            if (handshakeClosed) return
            handshakeClosed = true
            if (onPendingMessage) {
                socket.off('message', onPendingMessage)
                onPendingMessage = null
            }
            clearBufferedMessages()
        }

        onPendingMessage = (data, isBinary) => {
            if (!authStarted || streamReady || handshakeClosed) return
            const clonedData = cloneRealtimeMessageData(data)
            if (clonedData === null) {
                stopHandshakeBuffer()
                closePolicyViolation(socket, 'playcanvasEditor.fullBoot.invalidRealtimeMessage')
                return
            }
            const bytes = getRealtimeMessageDataByteLength(clonedData)
            if (bytes > MAX_REALTIME_MESSAGE_BYTES) {
                stopHandshakeBuffer()
                closePolicyViolation(socket, 'playcanvasEditor.fullBoot.messageTooLarge')
                return
            }
            if (
                bufferedMessages.length >= MAX_REALTIME_HANDSHAKE_BUFFER_MESSAGES ||
                bufferedMessageBytes + bytes > MAX_REALTIME_HANDSHAKE_BUFFER_BYTES
            ) {
                stopHandshakeBuffer()
                closePolicyViolation(socket, 'playcanvasEditor.fullBoot.handshakeBufferExceeded')
                return
            }
            if (realtimeMessageDataToText(clonedData).startsWith('auth')) {
                stopHandshakeBuffer()
                closePolicyViolation(socket, 'playcanvasEditor.fullBoot.duplicateRealtimeAuth')
                return
            }
            bufferedMessages.push({ data: clonedData, isBinary })
            bufferedMessageBytes += bytes
        }

        socket.on('message', onPendingMessage)
        const authTimer = setTimeout(() => closeUnauthorized(socket, 'playcanvasEditor.fullBoot.authTimeout'), 10_000)
        socket.once('close', () => {
            clearTimeout(authTimer)
            stopHandshakeBuffer()
        })

        socket.once('message', async (data) => {
            authStarted = true
            try {
                const auth = parseRealtimeAuthMessage(realtimeMessageDataToText(data))
                if (!auth) {
                    stopHandshakeBuffer()
                    closeUnauthorized(socket, 'playcanvasEditor.fullBoot.invalidRealtimeAuth')
                    return
                }
                const claims = validateFullBootClaims(deps.tokenService, auth.accessToken, {
                    metahubId: path.metahubId,
                    projectId: path.projectId,
                    origin: parseSafeHttpOrigin(request.headers.origin) ?? null
                })
                if (!claims) {
                    stopHandshakeBuffer()
                    closeUnauthorized(socket)
                    return
                }
                if (!(await authorizeFullBootClaims(deps, socket, claims))) {
                    stopHandshakeBuffer()
                    return
                }
                if (!isSocketOpen(socket)) {
                    stopHandshakeBuffer()
                    return
                }
                if (!reserveAuth(socket, claims, path.surface)) {
                    stopHandshakeBuffer()
                    return
                }
                registerRealtimeSocket(claims, socket)
                trackAuthenticatedSocket?.(socket)
                trackAssetReconciliationScope?.(claims, socket)
                clearTimeout(authTimer)
                const backend = getBackend(claims, () => hasCurrentFullBootAuthorization(deps, claims), socket)
                const grantedAssetDocumentIds = getGrantedRealtimeAssetDocumentIds(claims.metahubId, claims.projectId)
                const claimedAssetDocumentIds = new Set(claims.assetDocumentIds ?? [])
                const dynamicallyGrantedAssetDocumentIds = grantedAssetDocumentIds.filter(
                    (documentId) => !claimedAssetDocumentIds.has(documentId)
                )
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
                if (!isSocketOpen(socket)) {
                    stopHandshakeBuffer()
                    return
                }
                // Advertise the authenticated realtime session as soon as the
                // deterministic, non-asset documents are ready. Static asset
                // hydration starts immediately after the stream is attached; the
                // per-document seed queue and the readSnapshots guard make an
                // early Editor subscription safe while preserving this protocol
                // ordering for slow durable asset stores.
                socket.send('auth{"ok":true}')
                if (dynamicallyGrantedAssetDocumentIds.length > 0) {
                    void seedShareDbAssetDocumentsInBatches(backend, deps.documentPort, claims, dynamicallyGrantedAssetDocumentIds).catch(
                        () => {
                            logRealtimeWarning('dynamicAssetSeedFailed', {
                                metahubId: claims.metahubId,
                                projectId: claims.projectId,
                                assetDocumentCount: dynamicallyGrantedAssetDocumentIds.length
                            })
                        }
                    )
                }
                const sendPipelineTerminalEvent = (jobId: string, result: PipelineReplayResult): void => {
                    if (!isSafePipelineJobId(jobId)) return
                    sendMessengerEvent(
                        claims.metahubId,
                        claims.projectId,
                        `scriptAttrsFinished:${jobId}`,
                        result.ok ? { ok: true } : { ok: false, code: result.code }
                    )
                }
                const handleControlFrame = (name: string, payload: unknown): void => {
                    void (async () => {
                        if (name === 'fs') {
                            const record = asRecordData(payload)
                            if (!deps.documentPort.deleteAssets) return
                            const parsedDeleteFrame = playCanvasEditorCompatibilityAssetDeleteFrameSchema.safeParse({
                                op: record.op,
                                ids: record.ids
                            })
                            if (!parsedDeleteFrame.success) return
                            const documentIds = parsedDeleteFrame.data.ids
                            if (!documentIds.every((documentId) => isClaimedOrGrantedAssetDocument(claims, documentId))) {
                                closePolicyViolation(socket, 'playcanvasEditor.fullBoot.documentNotAllowed')
                                return
                            }
                            const grantVersions = captureRealtimeAssetDocumentGrantVersions(claims.metahubId, claims.projectId)
                            const result = await deps.documentPort.deleteAssets({
                                metahubId: claims.metahubId,
                                projectId: claims.projectId,
                                sceneId: claims.sceneId ?? claims.projectId,
                                userId: claims.userId,
                                documentIds
                            })
                            revokeRealtimeAssetDocuments(claims.metahubId, claims.projectId, result.deletedDocumentIds, grantVersions)
                            for (const documentId of result.deletedDocumentIds) {
                                sendMessengerEvent(claims.metahubId, claims.projectId, 'asset.delete', { asset: { id: documentId } })
                            }
                            return
                        }
                        if (name === 'pipeline') {
                            const record = asRecordData(payload)
                            const data = asRecordData(record.data)
                            const rawJobId = typeof data.job_id === 'string' ? data.job_id : ''
                            const jobId = isSafePipelineJobId(rawJobId) ? rawJobId : ''
                            const parsedPipelineFrame = pipelineFrameSchema.safeParse({ name: record.name, data })
                            if (!parsedPipelineFrame.success) {
                                sendPipelineTerminalEvent(jobId, { ok: false, code: 'invalidPipelineFrame' })
                                return
                            }
                            if (parsedPipelineFrame.data.data.script_task_type !== 'handle_parsed_script') {
                                sendPipelineTerminalEvent(jobId, { ok: false, code: 'unsupportedPipelineTask' })
                                return
                            }
                            const assetId = parseCanonicalPlayCanvasEditorDocumentId(parsedPipelineFrame.data.data.asset_id)
                            if (assetId === null) {
                                sendPipelineTerminalEvent(jobId, { ok: false, code: 'invalidAssetId' })
                                return
                            }
                            if (!isClaimedOrGrantedAssetDocument(claims, assetId)) {
                                closePolicyViolation(socket, 'playcanvasEditor.fullBoot.documentNotAllowed')
                                return
                            }
                            const pipelineFingerprint = createPipelineReplayFingerprint(parsedPipelineFrame.data.data)
                            const replayDecision = claimPipelineReplay(backend, jobId, pipelineFingerprint)
                            if (replayDecision.kind === 'inFlight') return
                            if (replayDecision.kind === 'completed') {
                                sendPipelineTerminalEvent(jobId, replayDecision.result)
                                return
                            }
                            if (replayDecision.kind === 'conflict') {
                                sendPipelineTerminalEvent(jobId, { ok: false, code: 'pipelineJobReplayConflict' })
                                closePolicyViolation(socket, 'playcanvasEditor.fullBoot.pipelineJobReplayConflict')
                                return
                            }
                            if (replayDecision.kind === 'capacity') {
                                sendPipelineTerminalEvent(jobId, { ok: false, code: 'pipelineReplayRegistryFull' })
                                return
                            }
                            let result: PipelineReplayResult = { ok: false, code: 'pipelineFailed' }
                            let protocolViolation = false
                            try {
                                await seedShareDbDocument(backend, {
                                    port: deps.documentPort,
                                    claims,
                                    collection: 'assets',
                                    documentId: String(assetId)
                                })
                                const scripts = parsedPipelineFrame.data.data.parse_result.scripts
                                const ops: Array<{ p: unknown[]; oi: unknown }> = []
                                for (const [scriptName, parsed] of Object.entries(scripts)) {
                                    if (!isSafePlayCanvasEditorScriptAttributeName(scriptName)) {
                                        result = { ok: false, code: 'invalidScriptAttributeName' }
                                        protocolViolation = true
                                        break
                                    }
                                    ops.push({ p: ['data', 'scripts', scriptName], oi: parsed })
                                }
                                if (!protocolViolation) {
                                    ops.push({ p: ['data', 'loading'], oi: false })
                                    if (ops.length > 0) {
                                        await new Promise<void>((resolve, reject) => {
                                            backend.submit(
                                                // ShareDB's backend API requires an agent-shaped object
                                                // because SubmitRequest reads agent.custom.
                                                { custom: {} },
                                                'assets',
                                                String(assetId),
                                                { op: ops },
                                                null,
                                                (error) => (error ? reject(error) : resolve())
                                            )
                                        })
                                    }
                                    result = { ok: true }
                                }
                            } catch {
                                logRealtimeWarning('scriptAttributesPipelineFailed', {
                                    metahubId: claims.metahubId,
                                    projectId: claims.projectId,
                                    assetId,
                                    jobId
                                })
                            }
                            completePipelineReplay(backend, jobId, pipelineFingerprint, result)
                            sendPipelineTerminalEvent(jobId, result)
                            if (protocolViolation) closePolicyViolation(socket, 'playcanvasEditor.fullBoot.protocolViolation')
                        }
                    })().catch(() => {
                        logRealtimeWarning('controlFrameFailed', {
                            metahubId: claims.metahubId,
                            projectId: claims.projectId,
                            name
                        })
                    })
                }
                const stream = new WebSocketJSONStream(createShareDbWebSocket(socket, handleControlFrame))
                stream.on('error', () => closeInternalError(socket, 'playcanvasEditor.fullBoot.realtimeProtocolError'))
                backend.listen(stream, request)
                const pendingMessages = bufferedMessages.splice(0)
                bufferedMessageBytes = 0
                streamReady = true
                if (onPendingMessage) {
                    socket.off('message', onPendingMessage)
                    onPendingMessage = null
                }
                // backend.listen has installed the stream consumer. Replay the
                // queued frames synchronously before the socket can emit another
                // event, preserving their wire order without an unbounded stream
                // prebuffer.
                for (const pendingMessage of pendingMessages) {
                    if (!isSocketOpen(socket)) break
                    socket.emit('message', pendingMessage.data, pendingMessage.isBinary)
                }
                if (claims.assetDocumentIds && claims.assetDocumentIds.length > 0) {
                    void seedShareDbAssetDocumentsInBatches(backend, deps.documentPort, claims, claims.assetDocumentIds).catch(() => {
                        logRealtimeWarning('assetSeedFailed', {
                            metahubId: claims.metahubId,
                            projectId: claims.projectId,
                            assetDocumentCount: claims.assetDocumentIds?.length ?? 0
                        })
                        if (isSocketOpen(socket)) closeInternalError(socket, 'playcanvasEditor.fullBoot.assetSeedFailed')
                    })
                }
            } catch {
                stopHandshakeBuffer()
                logRealtimeWarning('realtimeSocketInitializationFailed', {
                    metahubId: path.metahubId,
                    projectId: path.projectId
                })
                clearTimeout(authTimer)
                closeInternalError(socket)
            }
        })
    }

    const handleMessengerSocket = (
        socket: WebSocket,
        request: IncomingMessage,
        deps: PlayCanvasEditorRealtimeRuntimeDeps,
        path: RealtimeUpgradePath,
        reserveAuth: (socket: WebSocket, claims: PlayCanvasEditorCompatibilityTokenClaims, surface: RealtimeSurface) => boolean,
        trackAuthenticatedSocket?: (socket: WebSocket) => void,
        trackMessengerScope?: (scopeKey: string) => void,
        trackAssetReconciliationScope?: (claims: PlayCanvasEditorCompatibilityTokenClaims, socket: WebSocket) => void
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
                if (!msg) {
                    closePolicyViolation(socket, 'playcanvasEditor.fullBoot.invalidMessengerMessage')
                    return
                }
                if (msg.name === 'authenticate') {
                    if (authenticatedClaims || authenticating) {
                        closePolicyViolation(socket, 'playcanvasEditor.fullBoot.duplicateAuthentication')
                        return
                    }
                    authenticating = true
                    try {
                        const parsedAuthentication = messengerAuthenticateMessageSchema.safeParse(msg)
                        if (!parsedAuthentication.success) {
                            closeUnauthorized(socket, 'playcanvasEditor.fullBoot.invalidMessengerAuth')
                            return
                        }
                        const token = parsedAuthentication.data.token
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
                        trackAuthenticatedSocket?.(socket)
                        trackAssetReconciliationScope?.(claims, socket)
                        trackMessengerScope?.(realtimeProjectScopeKey(claims.metahubId, claims.projectId))
                        registerMessengerSocket(claims, socket, () => revalidateFullBootClaims(deps, socket, claims))
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
                        sendPendingMessengerEvents(realtimeProjectScopeKey(claims.metahubId, claims.projectId))
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
                    if (!messengerProjectWatchMessageSchema.safeParse(msg).success) {
                        closePolicyViolation(socket, 'playcanvasEditor.fullBoot.invalidMessengerMessage')
                        return
                    }
                    if (!(await revalidateFullBootClaims(deps, socket, authenticatedClaims))) return
                    socket.send(JSON.stringify({ name: 'project.watch', ok: true }))
                }
            } catch {
                clearTimeout(authTimer)
                closeInternalError(socket)
            }
        })
    }

    const handleRelaySocket = (
        socket: WebSocket,
        request: IncomingMessage,
        deps: PlayCanvasEditorRealtimeRuntimeDeps,
        path: RealtimeUpgradePath,
        reserveAuth: (socket: WebSocket, claims: PlayCanvasEditorCompatibilityTokenClaims, surface: RealtimeSurface) => boolean,
        trackAuthenticatedSocket?: (socket: WebSocket) => void
    ): void => {
        let userId: number = hashToPositiveInt(`relay:${path.metahubId}:${path.projectId}`)
        let authenticationPending = false
        let authenticated = false
        let authenticatedClaims: PlayCanvasEditorCompatibilityTokenClaims | null = null
        const pendingMessages: string[] = []
        let pendingMessageBytes = 0
        const authTimer = setTimeout(() => closeUnauthorized(socket, 'playcanvasEditor.fullBoot.authTimeout'), 10_000)
        socket.once('close', () => {
            clearTimeout(authTimer)
            pendingMessages.length = 0
            pendingMessageBytes = 0
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
                authenticatedClaims = claims
                trackAuthenticatedSocket?.(socket)
                clearTimeout(authTimer)
                socket.send(JSON.stringify({ t: 'welcome', userId }))
                return true
            } finally {
                authenticationPending = false
            }
        }

        const handleAuthenticatedMessage = async (msg: Record<string, unknown>): Promise<void> => {
            const parsed = relayRoomMessageSchema.safeParse(msg)
            if (!parsed.success) {
                closePolicyViolation(socket, 'playcanvasEditor.fullBoot.invalidRelayMessage')
                return
            }
            if (!authenticatedClaims || !(await revalidateFullBootClaims(deps, socket, authenticatedClaims))) return
            if (parsed.data.t === 'room:join') {
                socket.send(JSON.stringify({ t: 'room:join', name: parsed.data.name, users: [userId] }))
                return
            }
            socket.send(JSON.stringify({ t: 'room:leave', name: parsed.data.name, userId }))
        }

        socket.on('message', async (data) => {
            try {
                const raw = data.toString()
                if (isPingMessage(raw)) {
                    socket.send('pong')
                    return
                }
                const msg = parseJsonMessage(raw)
                if (!msg) {
                    closePolicyViolation(socket, 'playcanvasEditor.fullBoot.invalidRelayMessage')
                    return
                }
                if (authenticationPending) {
                    const messageBytes = Buffer.byteLength(raw, 'utf8')
                    if (
                        pendingMessages.length >= MAX_REALTIME_RELAY_PENDING_MESSAGES ||
                        pendingMessageBytes + messageBytes > MAX_REALTIME_RELAY_PENDING_BYTES
                    ) {
                        closePolicyViolation(
                            socket,
                            pendingMessages.length >= MAX_REALTIME_RELAY_PENDING_MESSAGES
                                ? 'playcanvasEditor.fullBoot.relayPendingLimit'
                                : 'playcanvasEditor.fullBoot.relayPendingBytesLimit'
                        )
                        return
                    }
                    pendingMessages.push(raw)
                    pendingMessageBytes += messageBytes
                    return
                }
                if (msg.t === 'authenticate') {
                    if (authenticated) {
                        closePolicyViolation(socket, 'playcanvasEditor.fullBoot.duplicateAuthentication')
                        return
                    }
                    const token = typeof msg.token === 'string' && msg.token.length <= 16_384 ? msg.token : ''
                    const isAuthenticated = await authenticate(token)
                    if (isAuthenticated) {
                        while (pendingMessages.length > 0) {
                            const pendingRaw = pendingMessages.shift() ?? ''
                            pendingMessageBytes = Math.max(0, pendingMessageBytes - Buffer.byteLength(pendingRaw, 'utf8'))
                            const pending = parseJsonMessage(pendingRaw)
                            if (pending) await handleAuthenticatedMessage(pending)
                        }
                        pendingMessageBytes = 0
                    } else {
                        closeUnauthorized(socket)
                    }
                    return
                }
                if (!authenticated) {
                    return
                }
                await handleAuthenticatedMessage(msg)
            } catch {
                closeInternalError(socket)
            }
        })
    }
    return { handleRealtimeSocket, handleMessengerSocket, handleRelaySocket }
}
