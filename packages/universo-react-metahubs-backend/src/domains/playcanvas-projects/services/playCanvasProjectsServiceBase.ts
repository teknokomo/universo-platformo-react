/**
 * Shared execution context and safety helpers for PlayCanvas project services.
 *
 * The class intentionally contains only cross-cutting state, validation and rollback
 * primitives. Aggregate-specific operations live in subclasses and the public facade.
 */
import type { PlayCanvasAsset, PlayCanvasFileReference, PlayCanvasScene, PlayCanvasSourceFile } from '@universo-react/types'
import {
    PLAYCANVAS_PROJECT_FILE_ROOT,
    isPlayCanvasAssetFileReference,
    isPlayCanvasGeneratedArtifactFileReference,
    isPlayCanvasImageFileReference,
    isPlayCanvasJsonFileReference,
    isPlayCanvasScenePayloadFileReference,
    isPlayCanvasScriptFileReference,
    isPlayCanvasSourceFileReference
} from '@universo-react/types'

import { withAdvisoryLock, type DbExecutor } from '@universo-react/utils/database'
import { OptimisticLockError } from '@universo-react/utils'
import type { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubConflictError, MetahubValidationError } from '../../shared/domainErrors'
import {
    assertPlayCanvasProjectMimeForPath,
    assertSafeRelativePlayCanvasProjectPath,
    PlayCanvasProjectFileService
} from './PlayCanvasProjectFileService'
import type { PlayCanvasProjectFileReadResult, PlayCanvasProjectFileScope } from './PlayCanvasProjectFileService'
import { log } from './playCanvasProjectsServiceCommon'
import { buildPlayCanvasMetahubLifecycleLockKey, buildPlayCanvasProjectLifecycleLockKey } from './playCanvasLifecycleLocks'
import {
    findPlayCanvasAsset,
    findPlayCanvasProject,
    playCanvasProjectMetadataFileReferenceExists,
    softDeletePlayCanvasScene,
    persistPlayCanvasAssetEditorDocumentId,
    upsertPlayCanvasScene,
    upsertPlayCanvasSourceFile,
    softDeletePlayCanvasSourceFileByStableId
} from './playCanvasProjectsStore'

import {
    EDITOR_DOCUMENT_ID_METADATA_KEY,
    isStoragePlayCanvasAsset,
    readStoredPlayCanvasEditorAssetDocumentId
} from './playCanvasProjectsServiceHelpers'
import type {
    PlayCanvasWrittenFile,
    PlayCanvasDeletedFileBackup,
    PlayCanvasEditorCompatibilityAssetEntry
} from './playCanvasProjectsServiceHelpers'

export class PlayCanvasProjectsServiceBase {
    constructor(
        protected readonly exec: DbExecutor,
        protected readonly schemaService: MetahubSchemaService,
        protected readonly fileService = new PlayCanvasProjectFileService()
    ) {}

    /**
     * Freezes ids for assets created before the compatibility resolver started
     * persisting them. This is intentionally metadata-only and therefore needs
     * no schema/template version bump. Test doubles without transactions retain
     * the old read-only behaviour; production executors always expose this API.
     */
    protected async materializeEditorCompatibilityAssetDocumentIds(
        schemaName: string,
        projectId: string,
        entries: PlayCanvasEditorCompatibilityAssetEntry[],
        userId: string,
        executor: DbExecutor = this.exec
    ): Promise<void> {
        const missing = entries.filter(
            ({ asset }) => isStoragePlayCanvasAsset(asset) && readStoredPlayCanvasEditorAssetDocumentId(asset) === null
        )
        if (missing.length === 0 || typeof executor.transaction !== 'function') return
        await executor.transaction(async (tx) => {
            for (const entry of missing) {
                if (!isStoragePlayCanvasAsset(entry.asset)) continue
                const persisted = await persistPlayCanvasAssetEditorDocumentId(
                    tx,
                    schemaName,
                    projectId,
                    entry.asset.id,
                    entry.documentId,
                    entry.asset.version,
                    userId
                )
                if (!persisted) {
                    throw new MetahubConflictError('PlayCanvas Editor asset changed while assigning its document id', {
                        messageCode: 'playcanvas.editorCompatibility.assetDocumentIdConflict',
                        projectId,
                        assetId: entry.asset.id
                    })
                }
                entry.asset.metadata = {
                    ...entry.asset.metadata,
                    [EDITOR_DOCUMENT_ID_METADATA_KEY]: entry.documentId
                }
                entry.asset.version += 1
            }
        })
    }

    protected async resolveSchemaName(metahubId: string): Promise<string> {
        return this.schemaService.ensureSchema(metahubId)
    }

    protected metadataUpdateError(projectId: string, sourcePath: string): MetahubValidationError {
        return new MetahubValidationError('PlayCanvas project file metadata reference was not updated', {
            messageCode: 'playcanvas.files.metadataUpdateFailed',
            projectId,
            sourcePath
        })
    }

    protected async markSourceFileMetadataMissingAfterWriteFailure(
        schemaName: string,
        projectId: string,
        sourcePath: string,
        sourceFileId: string,
        userId: string,
        existing: PlayCanvasSourceFile | null,
        preparedVersion: number,
        executor: DbExecutor = this.exec
    ): Promise<void> {
        try {
            if (!existing) {
                const deleted = await softDeletePlayCanvasSourceFileByStableId(
                    executor,
                    schemaName,
                    projectId,
                    sourceFileId,
                    userId,
                    preparedVersion
                )
                if (!deleted) {
                    log.warn('Failed to soft-delete PlayCanvas sourcefile metadata after physical write failure', {
                        schemaName,
                        projectId,
                        sourceFileId,
                        sourcePath
                    })
                }
                return
            }

            const restored = await upsertPlayCanvasSourceFile(
                executor,
                schemaName,
                projectId,
                {
                    id: existing.id,
                    stableSourceFileId: existing.stableSourceFileId,
                    name: existing.name,
                    virtualPath: existing.virtualPath,
                    file: existing.file,
                    scriptKind: existing.scriptKind,
                    checksum: existing.checksum,
                    parsedAttributes: existing.parsedAttributes,
                    parseStatus: existing.parseStatus,
                    parseDiagnostics: existing.parseDiagnostics,
                    publish: existing.publish,
                    expectedVersion: preparedVersion
                },
                userId
            )
            if (!restored) {
                log.warn('Failed to restore PlayCanvas sourcefile metadata after physical write failure', {
                    schemaName,
                    projectId,
                    sourceFileId,
                    sourcePath
                })
            }
        } catch (rollbackError) {
            log.warn('PlayCanvas sourcefile metadata rollback failed after physical write failure', {
                schemaName,
                projectId,
                sourceFileId,
                sourcePath,
                error: rollbackError
            })
        }
    }

    protected async cleanupWrittenPlayCanvasFiles(
        writtenFiles: readonly PlayCanvasWrittenFile[],
        projectId: string,
        operation: string
    ): Promise<void> {
        for (const written of [...writtenFiles].reverse()) {
            await this.fileService
                .deleteIfCurrentChecksum(written.scope, written.sourcePath, written.checksum)
                .catch((cleanupError: unknown) => {
                    log.warn('Failed to clean up PlayCanvas file after database failure', {
                        projectId,
                        operation,
                        sourcePath: written.sourcePath,
                        label: written.label,
                        cleanupError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
                    })
                })
        }
    }

    protected async restoreDeletedPlayCanvasFiles(backups: readonly PlayCanvasDeletedFileBackup[], projectId: string): Promise<void> {
        for (const backup of [...backups].reverse()) {
            await this.fileService
                .write(backup.scope, backup.sourcePath, backup.content, {
                    expectedChecksum: backup.checksum,
                    expectedCurrentChecksum: null,
                    mime: backup.mime
                })
                .catch((rollbackError: unknown) => {
                    log.warn('Failed to restore PlayCanvas asset file after delete rollback', {
                        projectId,
                        sourcePath: backup.sourcePath,
                        rollbackError: rollbackError instanceof Error ? rollbackError.name : typeof rollbackError
                    })
                })
        }
    }

    protected runProjectLifecycleLocked<T>(metahubId: string, projectId: string, work: (executor: DbExecutor) => Promise<T>): Promise<T> {
        if (typeof this.exec.transaction !== 'function') {
            return work(this.exec)
        }
        return withAdvisoryLock(this.exec, buildPlayCanvasMetahubLifecycleLockKey(metahubId), async (metahubExecutor) => {
            await metahubExecutor.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
                buildPlayCanvasProjectLifecycleLockKey(metahubId, projectId)
            ])
            return work(metahubExecutor)
        })
    }

    protected async requireProject(schemaName: string, projectId: string, executor: DbExecutor = this.exec) {
        const existing = await findPlayCanvasProject(executor, schemaName, projectId)
        if (!existing) {
            throw new MetahubValidationError('PlayCanvas project was not found', {
                messageCode: 'playcanvas.projects.notFound',
                projectId
            })
        }
        return existing
    }

    protected assertProjectPath(projectId: string, sourcePath: string): string {
        const safePath = assertSafeRelativePlayCanvasProjectPath(sourcePath)
        if (!safePath.startsWith(`playcanvas-projects/${projectId}/`)) {
            throw new MetahubValidationError('PlayCanvas project file path must belong to the requested project', {
                messageCode: 'playcanvas.files.path.projectMismatch'
            })
        }
        return safePath
    }

    protected assertProjectSubdirectoryPath(
        projectId: string,
        sourcePath: string,
        subdirectory: 'assets' | 'generated' | 'scenes' | 'sourcefiles'
    ): void {
        if (!sourcePath.startsWith(`playcanvas-projects/${projectId}/${subdirectory}/`)) {
            throw new MetahubValidationError('PlayCanvas project file path does not match the required storage role', {
                messageCode: `playcanvas.files.role.${subdirectory}PathMismatch`
            })
        }
    }

    protected async requireProjectMetadataFilePath(
        schemaName: string,
        projectId: string,
        sourcePath: string,
        executor: DbExecutor = this.exec
    ): Promise<string> {
        const safePath = this.assertProjectPath(projectId, sourcePath)
        const exists = await playCanvasProjectMetadataFileReferenceExists(executor, schemaName, projectId, safePath)
        if (!exists) {
            throw new MetahubValidationError('PlayCanvas project file path must be referenced by scene or generated artifact metadata', {
                messageCode: 'playcanvas.files.path.untracked'
            })
        }
        return safePath
    }

    protected assertFileReference<T extends { provider?: string; root?: string; path?: string; mime?: string | null }>(
        projectId: string,
        file: T | null | undefined
    ): (T & { path: string }) | null {
        if (!file) return null
        if (file.provider !== 'local') {
            throw new MetahubValidationError('PlayCanvas project metadata file references must use local project storage', {
                messageCode: 'playcanvas.files.provider.unsupported',
                provider: file.provider
            })
        }
        if (file.root !== PLAYCANVAS_PROJECT_FILE_ROOT) {
            throw new MetahubValidationError('PlayCanvas project file path must start with playcanvas-projects/', {
                messageCode: 'playcanvas.files.path.namespaceRequired'
            })
        }
        const safePath = this.assertProjectPath(projectId, file.path ?? '')
        assertPlayCanvasProjectMimeForPath(safePath, file.mime)
        return { ...file, path: safePath }
    }

    protected assertScenePayloadFileReference(
        projectId: string,
        file: PlayCanvasFileReference | null | undefined
    ): PlayCanvasFileReference | null {
        const checked = this.assertFileReference(projectId, file)
        if (!checked) return null
        this.assertProjectSubdirectoryPath(projectId, checked.path ?? '', 'scenes')
        if (!isPlayCanvasScenePayloadFileReference({ path: checked.path ?? '', mime: checked.mime })) {
            throw new MetahubValidationError('PlayCanvas scene payload files must be JSON files', {
                messageCode: 'playcanvas.files.role.scenePayloadMismatch'
            })
        }
        return checked
    }

    protected assertEditorScenePayloadPath(projectId: string, sceneId: string, sourcePath: string): string {
        const safePath = assertSafeRelativePlayCanvasProjectPath(sourcePath)
        const expectedPath = this.fileService.buildDefaultScenePath(projectId, sceneId)
        if (safePath !== expectedPath) {
            throw new MetahubValidationError('PlayCanvas editor scene payload file path must belong to the requested scene', {
                messageCode: 'playcanvas.editor.scenePayloadPathMismatch',
                projectId,
                sceneId,
                sourcePath: safePath
            })
        }
        return safePath
    }

    protected assertAssetFileReference(
        projectId: string,
        assetType: PlayCanvasAsset['type'],
        file: PlayCanvasFileReference | null | undefined
    ): PlayCanvasFileReference | null {
        const checked = this.assertFileReference(projectId, file)
        if (!checked) return null
        this.assertProjectSubdirectoryPath(projectId, checked.path ?? '', 'assets')
        if (!isPlayCanvasAssetFileReference({ path: checked.path ?? '', mime: checked.mime })) {
            throw new MetahubValidationError('PlayCanvas asset files must be stored in the project assets directory', {
                messageCode: 'playcanvas.files.role.assetPathMismatch',
                assetType
            })
        }
        if (
            (assetType === 'scene' || assetType === 'json') &&
            !isPlayCanvasJsonFileReference({ path: checked.path ?? '', mime: checked.mime })
        ) {
            throw new MetahubValidationError('PlayCanvas scene and JSON assets must reference JSON files', {
                messageCode: 'playcanvas.files.role.assetJsonMismatch',
                assetType
            })
        }
        if (
            (assetType === 'script' || assetType === 'generatedScript') &&
            !isPlayCanvasScriptFileReference({ path: checked.path ?? '', mime: checked.mime })
        ) {
            throw new MetahubValidationError('PlayCanvas script assets must reference JavaScript files', {
                messageCode: 'playcanvas.files.role.assetScriptMismatch',
                assetType
            })
        }
        const textLikeMimeByType: Record<string, readonly string[]> = {
            css: ['text/css'],
            html: ['text/html'],
            text: ['text/plain'],
            shader: ['text/plain']
        }
        const requiredTextMime = textLikeMimeByType[assetType]
        if (requiredTextMime && !requiredTextMime.includes(checked.mime ?? '')) {
            throw new MetahubValidationError('PlayCanvas text-like assets must reference a matching text file', {
                messageCode: 'playcanvas.files.role.assetTextMismatch',
                assetType
            })
        }
        if (
            !['scene', 'json', 'script', 'generatedScript', 'css', 'html', 'text', 'shader'].includes(assetType) &&
            !isPlayCanvasJsonFileReference({ path: checked.path ?? '', mime: checked.mime }) &&
            !(assetType === 'texture' && isPlayCanvasImageFileReference({ path: checked.path ?? '', mime: checked.mime }))
        ) {
            throw new MetahubValidationError('PlayCanvas non-script sidecar assets must reference JSON files or supported texture images', {
                messageCode: 'playcanvas.files.role.assetSidecarMismatch',
                assetType
            })
        }
        return checked
    }

    protected assertSourceFileReference(
        projectId: string,
        file: PlayCanvasFileReference | null | undefined
    ): PlayCanvasFileReference | null {
        const checked = this.assertFileReference(projectId, file)
        if (!checked) return null
        this.assertProjectSubdirectoryPath(projectId, checked.path ?? '', 'sourcefiles')
        if (!isPlayCanvasSourceFileReference({ path: checked.path ?? '', mime: checked.mime })) {
            throw new MetahubValidationError('PlayCanvas sourcefiles must be JavaScript files in the sourcefiles directory', {
                messageCode: 'playcanvas.files.role.sourcefileMismatch'
            })
        }
        return checked
    }

    protected assertGeneratedArtifactFileReference(
        projectId: string,
        file: PlayCanvasFileReference | null | undefined
    ): PlayCanvasFileReference {
        const checked = this.assertFileReference(projectId, file)
        if (!checked) {
            throw new MetahubValidationError('PlayCanvas generated artifacts must reference JavaScript files', {
                messageCode: 'playcanvas.files.role.generatedArtifactMismatch'
            })
        }
        this.assertProjectSubdirectoryPath(projectId, checked.path ?? '', 'generated')
        if (!isPlayCanvasGeneratedArtifactFileReference({ path: checked.path ?? '', mime: checked.mime })) {
            throw new MetahubValidationError('PlayCanvas generated artifacts must reference JavaScript files', {
                messageCode: 'playcanvas.files.role.generatedArtifactMismatch'
            })
        }
        return checked
    }

    protected async requireAssetFilePath(
        schemaName: string,
        projectId: string,
        assetId: string,
        sourcePath: string,
        executor: DbExecutor = this.exec
    ): Promise<PlayCanvasAsset & { version: number }> {
        await this.requireProject(schemaName, projectId, executor)
        this.assertProjectPath(projectId, sourcePath)
        const asset = await findPlayCanvasAsset(executor, schemaName, projectId, assetId)
        if (!asset) {
            throw new MetahubValidationError('PlayCanvas asset was not found', {
                messageCode: 'playcanvas.assets.notFound',
                assetId
            })
        }
        if (!asset.file?.path) {
            throw new MetahubValidationError('PlayCanvas asset does not have a file reference', {
                messageCode: 'playcanvas.assets.fileReferenceRequired',
                assetId
            })
        }
        if (asset.file.path !== sourcePath) {
            throw new MetahubValidationError('PlayCanvas asset file path does not match the requested source path', {
                messageCode: 'playcanvas.assets.filePathMismatch',
                assetId
            })
        }
        return asset
    }

    protected optimisticError(entityId: string, expectedVersion?: number): OptimisticLockError {
        return new OptimisticLockError({
            entityId,
            entityType: 'playcanvasProject',
            expectedVersion: expectedVersion ?? 0,
            actualVersion: 0,
            updatedAt: new Date(0),
            updatedBy: null
        })
    }

    protected async readFileForRollback(
        scope: PlayCanvasProjectFileScope,
        sourcePath: string
    ): Promise<{ exists: true; file: PlayCanvasProjectFileReadResult } | { exists: false }> {
        const stat = await this.fileService.stat(scope, sourcePath)
        if (!stat.exists) {
            return { exists: false }
        }
        return { exists: true, file: await this.fileService.read(scope, sourcePath) }
    }

    protected async rollbackFileWrite(
        scope: PlayCanvasProjectFileScope,
        sourcePath: string,
        writtenChecksum: string,
        previous: { exists: true; file: PlayCanvasProjectFileReadResult } | { exists: false },
        mime?: string | null
    ): Promise<void> {
        if (previous.exists) {
            await this.fileService.write(scope, sourcePath, previous.file.content, {
                expectedChecksum: previous.file.checksum,
                expectedCurrentChecksum: writtenChecksum,
                mime
            })
            return
        }
        await this.fileService.deleteIfCurrentChecksum(scope, sourcePath, writtenChecksum)
    }

    protected async rollbackPhysicalDelete(
        scope: PlayCanvasProjectFileScope,
        sourcePath: string,
        previous: { exists: true; file: PlayCanvasProjectFileReadResult } | { exists: false },
        mime?: string | null
    ): Promise<void> {
        if (!previous.exists) return
        await this.fileService.write(scope, sourcePath, previous.file.content, {
            expectedChecksum: previous.file.checksum,
            expectedCurrentChecksum: null,
            mime
        })
    }

    protected async rollbackEditorSceneMetadata(
        schemaName: string,
        projectId: string,
        sceneId: string,
        previous: (PlayCanvasScene & { version: number }) | null,
        preparedVersion: number,
        userId: string,
        executor: DbExecutor = this.exec
    ): Promise<void> {
        if (previous) {
            const restored = await upsertPlayCanvasScene(
                executor,
                schemaName,
                projectId,
                {
                    id: previous.id,
                    codename: previous.codename,
                    displayName: previous.displayName,
                    payloadSchemaVersion: previous.payloadSchemaVersion,
                    payload: previous.payload ?? null,
                    payloadFile: previous.payloadFile ?? null,
                    checksum: previous.checksum ?? null,
                    sortOrder: previous.sortOrder,
                    publish: previous.publish,
                    expectedVersion: preparedVersion
                },
                userId
            )
            if (!restored) {
                log.warn('Failed to restore PlayCanvas editor scene metadata after save rollback', {
                    schemaName,
                    projectId,
                    sceneId
                })
            }
            return
        }

        const deleted = await softDeletePlayCanvasScene(executor, schemaName, projectId, sceneId, preparedVersion, userId)
        if (!deleted) {
            log.warn('Failed to remove prepared PlayCanvas editor scene metadata after save rollback', {
                schemaName,
                projectId,
                sceneId
            })
        }
    }
}
