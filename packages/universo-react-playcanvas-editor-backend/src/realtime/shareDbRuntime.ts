import ShareDB from 'sharedb'
import type { PlayCanvasEditorCompatibilityTokenClaims } from '@universo-react/types'
import type {
    PlayCanvasEditorRealtimeDocument,
    PlayCanvasEditorRealtimeDocumentPort,
    RealtimeCollection,
    ShareDbDocumentMetadata
} from './index.js'

export interface ShareDbRuntimeContext {
    // The runtime facade supplies private registry operations through this seam.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly [key: string]: any
}

export const createShareDbRuntime = (context: ShareDbRuntimeContext) => {
    const {
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
    } = context
    const createDefaultRealtimeDocument = (
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

    const seedShareDbDocumentUnlocked = async (
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
        // Asset ids are authoritative durable rows. Never manufacture a default
        // ShareDB asset for a missing row: that would let a stale static claim
        // recreate deleted data. If a stale in-memory document still exists,
        // remove it so another worker's durable delete is visible in this worker.
        if (input.collection === 'assets' && !persisted) {
            const connection = backend.connect()
            const metadataKey = `${input.collection}:${input.documentId}`
            try {
                const doc = connection.get(input.collection, input.documentId)
                try {
                    await new Promise<void>((resolve, reject) => {
                        doc.fetch((error) => {
                            if (error) {
                                reject(error)
                                return
                            }
                            if (!doc.type) {
                                getShareDbPersistenceBlockedDocuments(backend).delete(metadataKey)
                                resolve()
                                return
                            }
                            getShareDbPersistedMetadata(backend).delete(metadataKey)
                            getShareDbSeedWriteKeys(backend).add(metadataKey)
                            doc.del((deleteError) => {
                                if (deleteError) {
                                    reject(deleteError)
                                    return
                                }
                                getShareDbPersistenceBlockedDocuments(backend).delete(metadataKey)
                                resolve()
                            })
                        })
                    })
                } finally {
                    getShareDbSeedWriteKeys(backend).delete(metadataKey)
                }
            } finally {
                connection.close()
            }
            return
        }
        const connection = backend.connect()
        const metadataKey = `${input.collection}:${input.documentId}`
        try {
            const doc = connection.get(input.collection, input.documentId)
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
            try {
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
                                reject(createError)
                                return
                            }
                            resolve()
                        })
                    })
                })
            } finally {
                // The guarded MemoryDB normally consumes this marker in afterWrite.
                // Clear it here as well so a callback ordering change or an early
                // ShareDB termination can never bypass durable persistence later.
                getShareDbSeedWriteKeys(backend).delete(metadataKey)
            }
            getShareDbPersistedMetadata(backend).set(metadataKey, metadata)
            getShareDbPersistenceBlockedDocuments(backend).delete(metadataKey)
        } finally {
            connection.close()
        }
    }

    /**
     * Serializes seed/fetch/create operations for one in-memory ShareDB document.
     *
     * Full-boot authentication and cross-worker reconciliation can discover the
     * same durable asset at the same time. ShareDB treats two concurrent creates
     * as a protocol error ("Document was created remotely"), which otherwise
     * tears down the authenticated Editor socket. A per-backend, per-document
     * queue makes the seed idempotent while still allowing unrelated documents to
     * seed in parallel.
     */
    const seedShareDbDocument = (
        backend: ShareDB,
        input: {
            port: PlayCanvasEditorRealtimeDocumentPort
            claims: PlayCanvasEditorCompatibilityTokenClaims
            collection: RealtimeCollection
            documentId: string
        }
    ): Promise<void> => {
        const queueKey = `${input.collection}:${input.documentId}`
        const queues = getShareDbSeedQueues(backend)
        const previous = queues.get(queueKey) ?? Promise.resolve()
        const next = previous
            .catch(() => undefined)
            .then(async () => {
                const recoveryWrite = getShareDbPersistenceRecoveryKeys(backend).has(queueKey)
                const release = recoveryWrite ? undefined : await acquireShareDbDocumentSubmitLock(backend, queueKey)
                try {
                    await seedShareDbDocumentUnlocked(backend, input)
                } finally {
                    release?.()
                }
            })
        queues.set(queueKey, next)
        void next.then(
            () => {
                if (queues.get(queueKey) === next) queues.delete(queueKey)
            },
            () => {
                if (queues.get(queueKey) === next) queues.delete(queueKey)
            }
        )
        return next
    }

    const persistShareDbSnapshot = async (
        backend: ShareDB,
        port: PlayCanvasEditorRealtimeDocumentPort,
        claims: PlayCanvasEditorCompatibilityTokenClaims,
        persistedMetadata: Map<string, ShareDbDocumentMetadata>,
        collection: RealtimeCollection,
        documentId: string,
        committedSnapshot?: { data?: unknown; v?: number }
    ): Promise<void> => {
        const persistSnapshot = async (data: unknown, version: number): Promise<void> => {
            const metadataKey = `${collection}:${documentId}`
            const metadata = persistedMetadata.get(metadataKey)
            persistedMetadata.set(metadataKey, { ...metadata, dirty: true })
            try {
                const updated = await port.persistDocument({
                    metahubId: claims.metahubId,
                    projectId: claims.projectId,
                    sceneId: claims.sceneId ?? claims.projectId,
                    userId: claims.userId,
                    collection,
                    documentId,
                    data: asRecordData(data),
                    version,
                    checksum: metadata?.checksum ?? null,
                    revision: metadata?.revision ?? null
                })
                persistedMetadata.set(metadataKey, {
                    checksum: updated?.checksum ?? metadata?.checksum ?? null,
                    revision: updated?.revision ?? metadata?.revision ?? null,
                    dirty: false
                })
            } catch (error) {
                persistedMetadata.set(metadataKey, { ...metadata, dirty: true })
                throw error
            }
        }

        if (committedSnapshot) {
            await persistSnapshot(committedSnapshot.data, committedSnapshot.v ?? 0)
            return
        }

        const connection = backend.connect()
        try {
            const doc = connection.get(collection, documentId)
            await new Promise<void>((resolve, reject) => {
                doc.fetch((error) => {
                    if (error) {
                        reject(error)
                        return
                    }
                    void persistSnapshot(doc.data, doc.version).then(resolve, reject)
                })
            })
        } finally {
            connection.close()
        }
    }

    const queueShareDbSnapshotPersistence = (
        backend: ShareDB,
        port: PlayCanvasEditorRealtimeDocumentPort,
        claims: PlayCanvasEditorCompatibilityTokenClaims,
        persistedMetadata: Map<string, ShareDbDocumentMetadata>,
        collection: RealtimeCollection,
        documentId: string,
        committedSnapshot?: { data?: unknown; v?: number }
    ): Promise<void> => {
        const queueKey = `${collection}:${documentId}`
        const queues = getShareDbPersistQueues(backend)
        const previous = queues.get(queueKey) ?? Promise.resolve()
        const next = previous
            .catch(() => undefined)
            .then(() => persistShareDbSnapshot(backend, port, claims, persistedMetadata, collection, documentId, committedSnapshot))
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

    const isRecoverableShareDbPersistenceConflict = (error: unknown): boolean => {
        const details =
            error && typeof error === 'object' && 'details' in error && (error as { details?: unknown }).details
                ? ((error as { details?: unknown }).details as Record<string, unknown>)
                : null
        const statusCode =
            error && typeof error === 'object' && 'statusCode' in error ? (error as { statusCode?: unknown }).statusCode : null
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
            /checksum.*match|current checksum|revisionMismatch|settingsRevisionMismatch|settings revision/i.test(
                `${messageCode} ${message}`
            )
        )
    }

    const createRealtimeScopeKey = (claims: PlayCanvasEditorCompatibilityTokenClaims): string =>
        [claims.metahubId, claims.projectId, claims.sceneId ?? '', claims.userId].join(':')

    interface ScopedShareDbBackendOptions {
        /** Re-checks the current user/session authorization before every operation. */
        revalidate: () => Promise<boolean>
        /** Called once when revalidation fails so callers can close the socket. */
        onAuthorizationFailure?: () => void
        /** Called when a durable write cannot be recovered safely. */
        onPersistenceFailure?: () => void
    }

    const createScopedShareDbBackend = (
        claims: PlayCanvasEditorCompatibilityTokenClaims,
        port: PlayCanvasEditorRealtimeDocumentPort,
        options: ScopedShareDbBackendOptions = { revalidate: async () => false }
    ): ShareDB => {
        const memoryDb = new ShareDB.MemoryDB()
        let backend!: ShareDB
        const originalCommit = memoryDb.commit.bind(memoryDb) as (
            collection: string,
            documentId: string,
            op: unknown,
            snapshot: { data?: unknown; v?: number },
            commitOptions: unknown,
            callback: (error?: Error | null, succeeded?: boolean) => void
        ) => void
        memoryDb.commit = ((
            collection: string,
            documentId: string,
            op: unknown,
            snapshot: { data?: unknown; v?: number },
            commitOptions: unknown,
            callback: (error?: Error | null, succeeded?: boolean) => void
        ) => {
            originalCommit(collection, documentId, op, snapshot, commitOptions, (error, succeeded) => {
                if (error || !succeeded) {
                    callback(error, succeeded)
                    return
                }
                const queueKey = `${collection}:${documentId}`
                if (getShareDbSeedWriteKeys(backend).has(queueKey)) {
                    callback(null, succeeded)
                    return
                }
                void persistShareDbSnapshot(
                    backend,
                    port,
                    claims,
                    getShareDbPersistedMetadata(backend),
                    collection as RealtimeCollection,
                    documentId,
                    snapshot
                )
                    .then(() => {
                        getShareDbDurableCommitVersions(backend).set(queueKey, snapshot.v ?? 0)
                        callback(null, succeeded)
                    })
                    .catch(async (persistError) => {
                        const recoveryKeys = getShareDbPersistenceRecoveryKeys(backend)
                        recoveryKeys.add(queueKey)
                        try {
                            // The current submit owns the document lock. Calling
                            // the queued public seed helper here could wait for a
                            // seed that is itself waiting on this lock, forming a
                            // recovery deadlock. The unlocked path is safe while
                            // this lock is held and the recovery key lets its
                            // compensating ShareDB operation bypass re-acquiring it.
                            await seedShareDbDocumentUnlocked(backend, {
                                port,
                                claims,
                                collection: collection as RealtimeCollection,
                                documentId
                            })
                        } catch (recoveryError) {
                            getShareDbPersistenceBlockedDocuments(backend).add(queueKey)
                            options.onPersistenceFailure?.()
                            callback(recoveryError)
                            return
                        } finally {
                            recoveryKeys.delete(queueKey)
                        }
                        callback(persistError)
                    })
            })
        }) as ShareDB.DB['commit']
        backend = new ShareDB({ db: memoryDb })
        addAllowedShareDbDocumentKeys(backend, claims)
        const numericIds = createPlayCanvasEditorNumericIds({
            metahubId: claims.metahubId,
            projectId: claims.projectId,
            sceneId: claims.sceneId ?? claims.projectId,
            userId: claims.userId
        })
        const loadDurableAssetDocument = (documentId: string): Promise<PlayCanvasEditorRealtimeDocument | null> =>
            port.loadDocument({
                metahubId: claims.metahubId,
                projectId: claims.projectId,
                sceneId: claims.sceneId ?? claims.projectId,
                userId: claims.userId,
                collection: 'assets',
                documentId,
                numericProjectId: numericIds.projectId,
                numericSceneId: numericIds.sceneId,
                numericUserId: numericIds.selfId
            })
        const isDocumentAllowed = (collection: unknown, documentId: unknown): boolean => {
            if (collection === 'assets' && isRealtimeAssetDocumentRevoked(claims.metahubId, claims.projectId, documentId)) {
                return false
            }
            return (
                isAllowedShareDbDocument(backend, collection, documentId) ||
                isDynamicallyGrantedAssetDocument(claims.metahubId, claims.projectId, collection, documentId)
            )
        }
        let authorizationFailureNotified = false
        const ensureCurrentAuthorization = async (): Promise<boolean> => {
            try {
                const authorized = await options.revalidate()
                if (authorized) return true
            } catch {
                // Fail closed when a policy adapter itself is unavailable.
            }
            if (!authorizationFailureNotified) {
                authorizationFailureNotified = true
                options.onAuthorizationFailure?.()
            }
            return false
        }
        const authorizationError = () => new Error('playcanvasEditor.fullBoot.accessDenied')
        const persistenceUnavailableError = () => new Error('playcanvasEditor.fullBoot.persistenceUnavailable')
        backend.on('submitRequestEnd', (_error, request) => {
            const custom = (request as unknown as { custom?: Record<string, unknown> }).custom
            const release = custom?.playcanvasEditorSubmitLockRelease
            if (typeof release === 'function') {
                custom.playcanvasEditorSubmitLockRelease = undefined
                release()
            }
        })
        backend.use('submit', (context, next) => {
            void ensureCurrentAuthorization()
                .then(async (authorized) => {
                    if (!authorized) {
                        next(authorizationError())
                        return
                    }
                    if (!isDocumentAllowed(context.collection, context.id)) {
                        next(new Error('playcanvasEditor.fullBoot.documentNotAllowed'))
                        return
                    }
                    const collection = context.collection as RealtimeCollection
                    const documentId = context.id as string
                    const queueKey = `${collection}:${documentId}`
                    const seedWrite = getShareDbSeedWriteKeys(backend).has(queueKey)
                    const recoveryWrite = getShareDbPersistenceRecoveryKeys(backend).has(queueKey)
                    if (!seedWrite && !recoveryWrite && getShareDbPersistenceBlockedDocuments(backend).has(queueKey)) {
                        next(persistenceUnavailableError())
                        return
                    }
                    const custom = (context as { custom?: Record<string, unknown> }).custom
                    let release: (() => void) | undefined
                    if (!seedWrite && !recoveryWrite) {
                        release = await acquireShareDbDocumentSubmitLock(backend, queueKey)
                        if (custom) custom.playcanvasEditorSubmitLockRelease = release
                    }
                    const releaseBeforeNext = () => {
                        if (!release) return
                        if (custom) custom.playcanvasEditorSubmitLockRelease = undefined
                        release()
                        release = undefined
                    }
                    if (collection !== 'assets' || seedWrite || recoveryWrite) {
                        next()
                        return
                    }
                    void loadDurableAssetDocument(documentId)
                        .then((document) => {
                            if (!document) {
                                releaseBeforeNext()
                                next(new Error('playcanvasEditor.fullBoot.assetNotFound'))
                                return
                            }
                            next()
                        })
                        .catch(() => {
                            releaseBeforeNext()
                            next(new Error('playcanvasEditor.fullBoot.assetAvailabilityCheckFailed'))
                        })
                })
                .catch(() => {
                    next(authorizationError())
                })
        })
        backend.use('readSnapshots', (context, next) => {
            void ensureCurrentAuthorization()
                .then((authorized) => {
                    if (!authorized) {
                        next(authorizationError())
                        return
                    }
                    if (!['scenes', 'assets', 'settings', 'user_data'].includes(context.collection)) {
                        next()
                        return
                    }
                    const collection = context.collection as RealtimeCollection
                    const readContext = context as typeof context & {
                        rejectSnapshotReadSilent: (snapshot: { id: string }, reason: string) => void
                    }
                    void Promise.all(
                        context.snapshots.map(async (snapshot) => {
                            if (!isDocumentAllowed(collection, snapshot.id)) {
                                readContext.rejectSnapshotReadSilent(snapshot, 'playcanvasEditor.fullBoot.documentNotAllowed')
                                return
                            }
                            try {
                                if (collection === 'assets' && !(await loadDurableAssetDocument(snapshot.id))) {
                                    readContext.rejectSnapshotReadSilent(snapshot, 'playcanvasEditor.fullBoot.assetNotFound')
                                }
                            } catch {
                                readContext.rejectSnapshotReadSilent(snapshot, 'playcanvasEditor.fullBoot.assetAvailabilityCheckFailed')
                            }
                        })
                    ).then(
                        () => next(),
                        () => next(new Error('playcanvasEditor.fullBoot.assetAvailabilityCheckFailed'))
                    )
                })
                .catch(() => {
                    next(authorizationError())
                })
        })
        backend.use('apply', (context, next) => {
            const collection = context.collection as RealtimeCollection
            const documentId = context.id as string
            if (!isDocumentAllowed(collection, documentId)) {
                next()
                return
            }
            const snapshotData = asRecordData((context as { snapshot?: { data?: unknown } }).snapshot?.data)
            repairSnapshotForJson0ListOperations(snapshotData, (context as { op?: { op?: unknown } }).op?.op)
            next()
        })
        // ShareDB applies an operation to its in-memory snapshot before invoking
        // `afterWrite`, so an authorization check there is inherently TOCTOU: a
        // role can be revoked after apply and before the durable adapter runs.
        // Revalidate immediately before ShareDB's atomic DB commit instead. The
        // guarded MemoryDB persists the candidate snapshot before ShareDB is
        // allowed to publish it; the request custom bag records the decision for
        // the lightweight `afterWrite` acknowledgement below.
        backend.use('commit', (context, next) => {
            void ensureCurrentAuthorization()
                .then(async (authorized) => {
                    if (!authorized) {
                        next(authorizationError())
                        return
                    }
                    const collection = context.collection as RealtimeCollection
                    const documentId = context.id as string
                    if (!isDocumentAllowed(collection, documentId)) {
                        next(new Error('playcanvasEditor.fullBoot.documentNotAllowed'))
                        return
                    }
                    const queueKey = `${collection}:${documentId}`
                    const seedWrite = getShareDbSeedWriteKeys(backend).has(queueKey)
                    const recoveryWrite = getShareDbPersistenceRecoveryKeys(backend).has(queueKey)
                    if (collection === 'assets' && !seedWrite && !recoveryWrite && !(await loadDurableAssetDocument(documentId))) {
                        next(new Error('playcanvasEditor.fullBoot.assetNotFound'))
                        return
                    }
                    const custom = (context as { custom?: Record<string, unknown> }).custom
                    if (custom) {
                        custom.playcanvasEditorAuthorizedAtCommit = true
                    }
                    next()
                })
                .catch(() => next(authorizationError()))
        })
        backend.use('afterWrite', (context, next) => {
            const collection = context.collection as RealtimeCollection
            const documentId = context.id as string
            const custom = (context as { custom?: Record<string, unknown> }).custom
            const committedSnapshot = (context as { snapshot?: { data?: unknown; v?: number } }).snapshot
            if (custom?.playcanvasEditorAuthorizedAtCommit !== true) {
                next(authorizationError())
                return
            }
            const persist = () => {
                const queueKey = `${collection}:${documentId}`
                if (getShareDbSeedWriteKeys(backend).delete(queueKey)) {
                    next()
                    return
                }
                const durableVersion = getShareDbDurableCommitVersions(backend).get(queueKey)
                if (durableVersion !== undefined && durableVersion === committedSnapshot?.v) {
                    getShareDbDurableCommitVersions(backend).delete(queueKey)
                    next()
                    return
                }
                // Every scoped backend uses the guarded MemoryDB above. Reaching
                // this branch means the commit was not durably acknowledged.
                next(new Error('playcanvasEditor.fullBoot.persistenceUnavailable'))
            }
            persist()
        })
        return backend
    }

    const seedShareDbAssetDocumentsInBatches = async (
        backend: ShareDB,
        port: PlayCanvasEditorRealtimeDocumentPort,
        claims: PlayCanvasEditorCompatibilityTokenClaims,
        assetDocumentIds: readonly number[],
        batchSize = 16
    ): Promise<void> => {
        for (let index = 0; index < assetDocumentIds.length; index += batchSize) {
            const batch = assetDocumentIds.slice(index, index + batchSize)
            await Promise.all(
                batch.map(async (documentId) => {
                    try {
                        await seedShareDbDocument(backend, {
                            port,
                            claims,
                            collection: 'assets',
                            documentId: String(documentId)
                        })
                    } catch (error) {
                        // A concurrent delete can revoke a static token claim
                        // while its initial ShareDB seed is still fetching. The
                        // durable delete is authoritative; keep the authenticated
                        // socket alive and let the next boot omit the document.
                        if (isRealtimeAssetDocumentRevoked(claims.metahubId, claims.projectId, documentId)) return
                        throw error
                    }
                })
            )
        }
    }
    return {
        createDefaultRealtimeDocument,
        seedShareDbDocument,
        persistShareDbSnapshot,
        queueShareDbSnapshotPersistence,
        isRecoverableShareDbPersistenceConflict,
        createRealtimeScopeKey,
        createScopedShareDbBackend,
        seedShareDbAssetDocumentsInBatches
    }
}
