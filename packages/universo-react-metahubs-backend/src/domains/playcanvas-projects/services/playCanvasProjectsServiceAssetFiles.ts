/**
 * File access and lightweight lists for PlayCanvas assets.
 */
import type { PlayCanvasAsset, PlayCanvasEditorMinimalAssetMetadata, PlayCanvasScriptKind } from '@universo-react/types'

import { MetahubConflictError } from '../../shared/domainErrors'
import { resolvePlayCanvasProjectExtensionMime } from './PlayCanvasProjectFileService'
import { listPlayCanvasScriptAssetsWithSource } from './playCanvasProjectsStore'

import { PlayCanvasProjectsServiceAssetMutations } from './playCanvasProjectsServiceAssetMutations'

export class PlayCanvasProjectsServiceAssetFiles extends PlayCanvasProjectsServiceAssetMutations {
    async readEditorCompatibilityAssetFile(
        metahubId: string,
        projectId: string,
        documentId: number,
        userId: string
    ): Promise<{ content: Buffer; mime: string | null; hash: string | null; filename: string } | null> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const entries = await this.loadEditorCompatibilityAssetEntries(metahubId, projectId, userId)
        const entry = entries.find((candidate) => candidate.documentId === documentId)
        if (!entry || 'sceneId' in entry.asset || !entry.asset.file?.path) {
            return null
        }
        const read = await this.fileService.read({ metahubId, branchSlug: schemaName }, entry.asset.file.path)
        if (!entry.asset.file.hash || entry.asset.file.hash !== read.checksum) {
            throw new MetahubConflictError('PlayCanvas Editor asset file changed outside the metadata store', {
                messageCode: 'playcanvas.editorCompatibility.assetFileChecksumMismatch',
                projectId,
                assetId: entry.asset.id,
                expectedCurrentChecksum: entry.asset.file.hash,
                actualCurrentChecksum: read.checksum
            })
        }
        return {
            content: read.content,
            mime: entry.asset.file.mime ?? resolvePlayCanvasProjectExtensionMime(read.sourcePath),
            hash: read.checksum,
            filename: entry.asset.virtualPath.length > 0 ? entry.asset.virtualPath[entry.asset.virtualPath.length - 1] : entry.asset.name
        }
    }

    /** Lists parsed script assets (uuid ids) for binding authoring and tooling. */
    async listScriptAssets(
        metahubId: string,
        projectId: string,
        _userId: string
    ): Promise<
        Array<{ id: string; assetId: string; scriptName: string; scriptKind: PlayCanvasScriptKind; parseStatus: string; version: number }>
    > {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const rows = await listPlayCanvasScriptAssetsWithSource(this.exec, schemaName, projectId)
        return rows.map(({ assetFilePath: _assetFilePath, assetFileHash: _assetFileHash, ...rest }) => rest)
    }

    async listMinimalAssetsForEditorScene(
        metahubId: string,
        projectId: string,
        sceneId: string,
        userId: string
    ): Promise<PlayCanvasEditorMinimalAssetMetadata[]> {
        const [{ payload }, assets] = await Promise.all([
            this.readEditorScene(metahubId, projectId, sceneId, userId),
            this.listEditorCompatibilityAssets(metahubId, projectId, userId, { sceneId })
        ])
        const referenced = new Set<string>()
        for (const asset of payload?.assets ?? []) {
            referenced.add(asset.id)
            if (asset.stableAssetId) referenced.add(asset.stableAssetId)
            if (asset.fileId) referenced.add(asset.fileId)
        }
        return assets
            .filter(
                (asset) =>
                    (asset.type === 'json' || asset.type === 'material') &&
                    (referenced.size === 0 || referenced.has(asset.id) || referenced.has(asset.stableAssetId))
            )
            .map((asset) => ({
                id: asset.id,
                stableAssetId: asset.stableAssetId,
                type: asset.type as PlayCanvasAsset['type'],
                name: asset.name,
                virtualPath: asset.virtualPath,
                mime: asset.file?.mime ?? null,
                hash: asset.file?.hash ?? null,
                size: asset.file?.size ?? null
            }))
    }
}
