/**
 * Read-side asset operations for the PlayCanvas compatibility surface.
 */
import type { PlayCanvasAsset } from '@universo-react/types'

import { createPlayCanvasEditorNumericIds } from '@universo-react/playcanvas-editor-backend'
import type { PlayCanvasEditorRealtimeAssetDocument } from '@universo-react/playcanvas-editor-backend'
import { type DbExecutor } from '@universo-react/utils/database'

import { listPlayCanvasAssets } from './playCanvasProjectsStore'

import { PlayCanvasProjectsServiceScripts } from './playCanvasProjectsServiceScripts'
import {
    readPlayCanvasEditorAssetDocumentData,
    buildEditorCompatibilityAssetPathContext,
    readPlayCanvasEditorAssetSummaryMetadata,
    createPlayCanvasEditorNumericAssetIdResolver,
    normalizePlayCanvasEditorSceneLocalAsset,
    addEditorCompatibilityAssetEntryByDocumentId,
    asRecord
} from './playCanvasProjectsServiceHelpers'
import type { PlayCanvasEditorSceneLocalAsset, PlayCanvasEditorCompatibilityAssetEntry } from './playCanvasProjectsServiceHelpers'

export class PlayCanvasProjectsServiceAssetQueries extends PlayCanvasProjectsServiceScripts {
    async listAssets(
        metahubId: string,
        projectId: string,
        _userId: string,
        executor: DbExecutor = this.exec
    ): Promise<(PlayCanvasAsset & { version: number })[]> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId, executor)
        return listPlayCanvasAssets(executor, schemaName, projectId)
    }

    /**
     * Enumerates the combined project asset universe (storage assets plus scene-local
     * assets) and resolves every editor document id through one batched collision-safe
     * assignment, so the per-project id set is unique by construction. Residual
     * collisions between fixed upstream ids still fail closed.
     */
    protected async loadEditorCompatibilityAssetEntries(
        metahubId: string,
        projectId: string,
        userId: string,
        options: { sceneId?: string | null } = {},
        executor: DbExecutor = this.exec
    ): Promise<PlayCanvasEditorCompatibilityAssetEntry[]> {
        const [assets, sceneReads] = await Promise.all([
            this.listAssets(metahubId, projectId, userId, executor),
            options.sceneId
                ? this.readEditorScene(metahubId, projectId, options.sceneId, userId, executor).then((read) => [read])
                : this.listScenes(metahubId, projectId, userId, executor).then((scenes) =>
                      Promise.all(scenes.map((scene) => this.readEditorScene(metahubId, projectId, scene.id, userId, executor)))
                  )
        ])
        const candidates: Array<(PlayCanvasAsset & { version: number }) | PlayCanvasEditorSceneLocalAsset> = [...assets]
        for (const read of sceneReads) {
            for (const asset of read.payload?.assets ?? []) {
                const normalized = normalizePlayCanvasEditorSceneLocalAsset(asset, projectId, read.scene.id, read.scene.version)
                if (!normalized) continue
                candidates.push(normalized)
            }
        }
        const resolveDocumentId = createPlayCanvasEditorNumericAssetIdResolver(candidates)
        const byDocumentId = new Map<string, PlayCanvasEditorCompatibilityAssetEntry>()
        for (const asset of candidates) {
            addEditorCompatibilityAssetEntryByDocumentId(byDocumentId, { asset, documentId: resolveDocumentId(asset) })
        }
        return [...byDocumentId.values()]
    }

    async listEditorCompatibilityAssets(
        metahubId: string,
        projectId: string,
        userId: string,
        options: { sceneId?: string | null } = {}
    ): Promise<Array<(PlayCanvasAsset & { version: number }) | PlayCanvasEditorSceneLocalAsset>> {
        const entries = await this.loadEditorCompatibilityAssetEntries(metahubId, projectId, userId, options)
        return entries.map((entry) => entry.asset)
    }

    async listEditorCompatibilityAssetSummaries(
        metahubId: string,
        projectId: string,
        userId: string,
        options: { sceneId?: string | null } = {}
    ): Promise<Record<string, unknown>[]> {
        const entries = await this.loadEditorCompatibilityAssetEntries(metahubId, projectId, userId, options)
        const pathContextByAssetId = buildEditorCompatibilityAssetPathContext(entries)
        return entries.map(({ asset, documentId }) => {
            const pathContext = pathContextByAssetId.get(asset.id)
            return {
                id: asset.id,
                stableAssetId: asset.stableAssetId,
                type: asset.type,
                name: asset.name,
                virtualPath: asset.virtualPath.length > 0 ? asset.virtualPath.join('/') : '/',
                mime: asset.file?.mime ?? null,
                hash: asset.file?.hash ?? null,
                size: asset.file?.size ?? null,
                metadata: readPlayCanvasEditorAssetSummaryMetadata(asset),
                editorDocumentId: documentId,
                editorParentDocumentId: pathContext?.parentDocumentId ?? null,
                editorPathDocumentIds: pathContext?.pathDocumentIds ?? [],
                createdAt: pathContext?.createdAt ?? null
            }
        })
    }

    /**
     * Lists the bounded asset descriptors needed by realtime reconciliation.
     * This method deliberately reuses the compatibility asset resolver so the
     * numeric document ids match REST and ShareDB without exposing raw storage
     * metadata through the realtime port.
     */
    async listEditorCompatibilityAssetDocuments(
        metahubId: string,
        projectId: string,
        userId: string,
        options: { sceneId?: string | null } = {}
    ): Promise<PlayCanvasEditorRealtimeAssetDocument[]> {
        const entries = await this.loadEditorCompatibilityAssetEntries(metahubId, projectId, userId, options)
        const branchId = createPlayCanvasEditorNumericIds({
            metahubId,
            projectId,
            sceneId: options.sceneId ?? projectId,
            userId
        }).sceneId
        return entries.map(({ asset, documentId }) => {
            const editorDocument = asRecord(asRecord(asset.metadata).editorDocument)
            return {
                id: documentId,
                branchId,
                source: typeof editorDocument.source === 'boolean' ? editorDocument.source : false,
                status: 'complete',
                type: String(asset.type),
                sourceAssetId: '0',
                createdAt: typeof editorDocument.createdAt === 'string' ? editorDocument.createdAt : null
            }
        })
    }

    /** Reads one editor asset document by its deterministic numeric document id. */
    async readEditorCompatibilityAsset(
        metahubId: string,
        projectId: string,
        documentId: number,
        userId: string,
        options: { sceneId?: string | null } = {}
    ): Promise<Record<string, unknown> | null> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const entries = await this.loadEditorCompatibilityAssetEntries(metahubId, projectId, userId, options)
        const entry = entries.find((candidate) => candidate.documentId === documentId)
        if (!entry) return null
        const pathContext = buildEditorCompatibilityAssetPathContext(entries).get(entry.asset.id)
        return readPlayCanvasEditorAssetDocumentData(entry.asset, entry.documentId, pathContext)
    }

    /**
     * Creates an editor-facing asset ("+" menu in the integrated PlayCanvas Editor).
     * Folder assets are metadata-only rows whose ShareDB document id derives from a
     * stable path key; text-like assets write their file through the project file
     * service before the metadata row is finalized; data-only types (material,
     * cubemap-like) persist their payload as metadata without a file. Binary
     * uploads are rejected upstream (route-level) and never reach this method.
     */
}
