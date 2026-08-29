import ShareDB from 'sharedb'
import { describe, expect, it, vi } from 'vitest'
import { createPlayCanvasEditorCompatibilityTokenService } from '../tokens/index'
import { createPlayCanvasEditorNumericIds } from '../config/index'
import {
    createScopedShareDbBackend,
    getShareDbSeedWriteKeys,
    seedShareDbDocument,
    type PlayCanvasEditorRealtimeDocumentPort,
    type ScopedShareDbBackendOptions
} from './index'

const tokenService = createPlayCanvasEditorCompatibilityTokenService()
const claims = tokenService.create({
    metahubId: 'metahub-1',
    projectId: '019e9146-fd1b-7d1d-a858-d1e96485d901',
    sceneId: '019e9147-16c4-738c-ab0f-b98c443ee676',
    userId: 'user-1',
    packageSlug: 'playcanvas-editor',
    mode: 'universo-full-upstream-ui',
    origin: 'https://editor-assets.example.test',
    sessionId: 'session-1',
    nonce: 'nonce-1',
    now: Date.now()
}).claims
const sceneDocumentId = String(
    createPlayCanvasEditorNumericIds({
        metahubId: claims.metahubId,
        projectId: claims.projectId,
        sceneId: claims.sceneId,
        userId: claims.userId
    }).sceneId
)

const createPort = (persistDocument: PlayCanvasEditorRealtimeDocumentPort['persistDocument'] = vi.fn(async () => undefined)) => {
    const loadDocument = vi.fn(async ({ collection, documentId }: Parameters<PlayCanvasEditorRealtimeDocumentPort['loadDocument']>[0]) => ({
        collection,
        id: documentId,
        data: { name: 'durable scene' },
        version: 0,
        checksum: 'durable-checksum',
        revision: 'durable-revision'
    }))
    return { loadDocument, persistDocument }
}

const submitBackendOperation = (backend: ShareDB): Promise<Error | null> =>
    new Promise((resolve) => {
        backend.submit(
            { custom: {} },
            'scenes',
            sceneDocumentId,
            { op: [{ p: ['name'], od: 'durable scene', oi: 'rejected scene' }] },
            null,
            (error) => resolve(error ?? null)
        )
    })

describe('scoped ShareDB backend authorization', () => {
    it('rejects a session revoked before ShareDB commit without publishing or persisting the operation', async () => {
        let phase: 'seed' | 'submit' | 'commit' | 'revoked' = 'seed'
        const revalidate = vi.fn(async () => {
            if (phase === 'seed') return true
            if (phase === 'submit') {
                phase = 'commit'
                return true
            }
            if (phase === 'commit') {
                phase = 'revoked'
                return false
            }
            return false
        })
        const persistDocument = vi.fn(async () => undefined)
        const port = createPort(persistDocument)
        const authorizationFailure = vi.fn()
        const options: ScopedShareDbBackendOptions = {
            revalidate,
            onAuthorizationFailure: authorizationFailure
        }
        const backend = createScopedShareDbBackend(claims, port, options)

        await seedShareDbDocument(backend, {
            port,
            claims,
            collection: 'scenes',
            documentId: sceneDocumentId
        })

        expect(getShareDbSeedWriteKeys(backend).has(`scenes:${sceneDocumentId}`)).toBe(false)
        phase = 'submit'
        // The first operation check succeeds and transitions to the commit
        // phase; revoke the role at that boundary, after OT has produced the
        // candidate snapshot but before ShareDB can call its durable DB adapter.
        const error = await submitBackendOperation(backend)

        expect(error).toEqual(expect.any(Error))
        expect(error?.message).toBe('playcanvasEditor.fullBoot.accessDenied')
        expect(persistDocument).not.toHaveBeenCalled()
        expect(authorizationFailure).toHaveBeenCalledTimes(1)
        expect(revalidate.mock.calls.length).toBeGreaterThanOrEqual(2)
        backend.close()
    })

    it('does not roll back an operation authorized at commit when the session is revoked afterwards', async () => {
        let phase: 'seed' | 'submit' | 'commit' | 'afterWrite' = 'seed'
        const revalidate = vi.fn(async () => {
            if (phase === 'seed') return true
            if (phase === 'submit') {
                phase = 'commit'
                return true
            }
            if (phase === 'commit') {
                phase = 'afterWrite'
                return true
            }
            return false
        })
        const persistDocument = vi.fn(async () => undefined)
        const port = createPort(persistDocument)
        const backend = createScopedShareDbBackend(claims, port, { revalidate })

        await seedShareDbDocument(backend, {
            port,
            claims,
            collection: 'scenes',
            documentId: sceneDocumentId
        })

        phase = 'submit'
        const error = await submitBackendOperation(backend)

        expect(error).toBeNull()
        expect(persistDocument).toHaveBeenCalledTimes(1)
        backend.close()
    })

    it('publishes an operation only after durable persistence succeeds', async () => {
        let releasePersistence!: () => void
        let persistenceStarted!: () => void
        const persistenceReady = new Promise<void>((resolve) => {
            persistenceStarted = resolve
        })
        const persistenceReleased = new Promise<void>((resolve) => {
            releasePersistence = resolve
        })
        const persistDocument = vi.fn(async () => {
            persistenceStarted()
            await persistenceReleased
        })
        const port = createPort(persistDocument)
        const backend = createScopedShareDbBackend(claims, port, { revalidate: async () => true })

        await seedShareDbDocument(backend, {
            port,
            claims,
            collection: 'scenes',
            documentId: sceneDocumentId
        })

        const publish = vi.spyOn(backend.pubsub, 'publish')
        const submitted = submitBackendOperation(backend)
        await persistenceReady
        expect(publish).not.toHaveBeenCalled()

        releasePersistence()
        await expect(submitted).resolves.toBeNull()
        expect(publish).toHaveBeenCalledTimes(1)
        backend.close()
    })

    it('returns the durable write error without publishing the rejected operation', async () => {
        const persistError = new Error('durable storage rejected')
        const port = createPort(
            vi.fn(async () => {
                throw persistError
            })
        )
        const backend = createScopedShareDbBackend(claims, port, { revalidate: async () => true })

        await seedShareDbDocument(backend, {
            port,
            claims,
            collection: 'scenes',
            documentId: sceneDocumentId
        })

        const publish = vi.spyOn(backend.pubsub, 'publish')
        const error = await submitBackendOperation(backend)

        expect(error).toBe(persistError)
        const rejectedOperationPublished = publish.mock.calls.some(
            ([, operation]) =>
                Array.isArray(operation?.op) &&
                operation.op.some(
                    (component: unknown) =>
                        component !== null &&
                        typeof component === 'object' &&
                        'oi' in component &&
                        (component as { oi?: unknown }).oi === 'rejected scene'
                )
        )
        expect(rejectedOperationPublished).toBe(false)
        backend.close()
    })

    it('recovers directly when a seed is queued behind the current document lock', async () => {
        let blockLoads = false
        let releaseLoads!: () => void
        const loadsReleased = new Promise<void>((resolve) => {
            releaseLoads = resolve
        })
        let persistenceStarted!: () => void
        const persistenceReady = new Promise<void>((resolve) => {
            persistenceStarted = resolve
        })
        const persistError = new Error('durable storage rejected')
        const loadDocument = vi.fn(
            async ({ collection, documentId }: Parameters<PlayCanvasEditorRealtimeDocumentPort['loadDocument']>[0]) => {
                if (blockLoads) await loadsReleased
                return {
                    collection,
                    id: documentId,
                    data: { name: 'durable scene' },
                    version: 0,
                    checksum: 'durable-checksum',
                    revision: 'durable-revision'
                }
            }
        )
        const persistDocument = vi.fn(async () => {
            persistenceStarted()
            throw persistError
        })
        const port = { loadDocument, persistDocument }
        const backend = createScopedShareDbBackend(claims, port, { revalidate: async () => true })

        await seedShareDbDocument(backend, {
            port,
            claims,
            collection: 'scenes',
            documentId: sceneDocumentId
        })

        blockLoads = true
        const submitted = submitBackendOperation(backend)
        await persistenceReady
        const pendingSeed = seedShareDbDocument(backend, {
            port,
            claims,
            collection: 'scenes',
            documentId: sceneDocumentId
        })
        await Promise.resolve()
        releaseLoads()

        await expect(submitted).resolves.toBe(persistError)
        await expect(pendingSeed).resolves.toBeUndefined()
        backend.close()
    })

    it('clears a blocked document after a later durable seed succeeds', async () => {
        let durableLoadAvailable = true
        let failPersistence = true
        const persistError = new Error('durable storage rejected')
        const loadDocument = vi.fn(
            async ({ collection, documentId }: Parameters<PlayCanvasEditorRealtimeDocumentPort['loadDocument']>[0]) => {
                if (!durableLoadAvailable) throw new Error('durable source unavailable')
                return {
                    collection,
                    id: documentId,
                    data: { name: 'durable scene' },
                    version: 0,
                    checksum: 'durable-checksum',
                    revision: 'durable-revision'
                }
            }
        )
        const persistDocument = vi.fn(async () => {
            if (failPersistence) throw persistError
            return { checksum: 'durable-checksum', revision: 'durable-revision' }
        })
        const port = { loadDocument, persistDocument }
        const backend = createScopedShareDbBackend(claims, port, { revalidate: async () => true })

        await seedShareDbDocument(backend, {
            port,
            claims,
            collection: 'scenes',
            documentId: sceneDocumentId
        })

        durableLoadAvailable = false
        await expect(submitBackendOperation(backend)).resolves.toEqual(expect.any(Error))

        durableLoadAvailable = true
        failPersistence = false
        await seedShareDbDocument(backend, {
            port,
            claims,
            collection: 'scenes',
            documentId: sceneDocumentId
        })
        await expect(submitBackendOperation(backend)).resolves.toBeNull()
        backend.close()
    })

    it('deletes a stale in-memory asset when its durable row is gone', async () => {
        let durableAssetAvailable = true
        const assetDocumentId = '700111'
        const assetClaims = tokenService.create({
            metahubId: claims.metahubId,
            projectId: claims.projectId,
            sceneId: claims.sceneId,
            userId: claims.userId,
            packageSlug: claims.packageSlug,
            mode: claims.mode,
            origin: claims.origin,
            sessionId: claims.sessionId,
            nonce: claims.nonce,
            assetDocumentIds: [Number(assetDocumentId)],
            now: Date.now()
        }).claims
        const loadDocument = vi.fn(
            async ({ collection, documentId }: Parameters<PlayCanvasEditorRealtimeDocumentPort['loadDocument']>[0]) => {
                if (collection === 'assets' && !durableAssetAvailable) return null
                return {
                    collection,
                    id: documentId,
                    data: { item_id: Number(documentId), name: 'Material', type: 'material', data: {} },
                    version: 0,
                    checksum: 'asset-checksum',
                    revision: 'asset-revision'
                }
            }
        )
        const port = { loadDocument, persistDocument: vi.fn(async () => undefined) }
        const backend = createScopedShareDbBackend(assetClaims, port, { revalidate: async () => true })

        await seedShareDbDocument(backend, {
            port,
            claims: assetClaims,
            collection: 'assets',
            documentId: assetDocumentId
        })
        durableAssetAvailable = false
        await seedShareDbDocument(backend, {
            port,
            claims: assetClaims,
            collection: 'assets',
            documentId: assetDocumentId
        })

        const connection = backend.connect()
        try {
            const document = connection.get('assets', assetDocumentId)
            await new Promise<void>((resolve, reject) => {
                document.fetch((error) => (error ? reject(error) : resolve()))
            })
            expect(document.type).toBeNull()
            expect(document.data).toBeUndefined()
        } finally {
            connection.close()
            backend.close()
        }
    })

    it('fails closed when a runtime bypasses the required authorization option', async () => {
        const port = createPort()
        const backend = createScopedShareDbBackend(claims, port, undefined as unknown as ScopedShareDbBackendOptions)
        const connection = backend.connect()
        try {
            const doc = connection.get('scenes', sceneDocumentId) as ShareDB.Doc
            const error = await new Promise<Error | null>((resolve) => {
                doc.create({ name: 'should be rejected' }, (createError) => resolve(createError ?? null))
            })

            expect(error).toEqual(expect.any(Error))
            expect(error?.message).toBe('playcanvasEditor.fullBoot.accessDenied')
            expect(port.persistDocument).not.toHaveBeenCalled()
        } finally {
            connection.close()
            backend.close()
        }
    })
})
