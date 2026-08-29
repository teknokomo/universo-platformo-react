/**
 * Write-side asset metadata operations for the PlayCanvas compatibility API.
 */
import { createHash } from 'node:crypto'
import path from 'node:path'
import type { PlayCanvasAsset } from '@universo-react/types'
import { PLAYCANVAS_PROJECT_FILE_ROOT, playCanvasEditorCompatibilityAssetCreateRequestSchema } from '@universo-react/types'

import { type DbExecutor } from '@universo-react/utils/database'
import { generateUuidV7 } from '@universo-react/utils'
import { MetahubConflictError, MetahubDomainError, MetahubValidationError } from '../../shared/domainErrors'
import { isUniqueViolation } from '../../shared/errorGuards'
import {
    assertSafeRelativePlayCanvasProjectPath,
    PlayCanvasProjectFileService,
    resolvePlayCanvasProjectExtensionMime
} from './PlayCanvasProjectFileService'
import {
    deletePlayCanvasAssetsByIds,
    listPlayCanvasEditorDocumentIds,
    updatePlayCanvasAssetMetadata,
    updatePlayCanvasAssetTreeMetadata
} from './playCanvasProjectsStore'

import { PlayCanvasProjectsServiceAssetQueries } from './playCanvasProjectsServiceAssetQueries'
import { log } from './playCanvasProjectsServiceCommon'
import {
    isCurrentChecksumMismatch,
    isStoragePlayCanvasAsset,
    isPlayCanvasAssetType,
    assertEditorAssetName,
    stripPlayCanvasAssetLifecycleMetadata,
    resolveNewEditorCompatibilityAssetDocumentId,
    normalizedEditorAssetPath,
    editorAssetPathKey,
    isEditorAssetPathPrefix
} from './playCanvasProjectsServiceHelpers'
import type {
    PlayCanvasWrittenFile,
    PlayCanvasDeletedFileBackup,
    PlayCanvasEditorCompatibilityAssetEntry
} from './playCanvasProjectsServiceHelpers'

export class PlayCanvasProjectsServiceAssetMutations extends PlayCanvasProjectsServiceAssetQueries {
    async createEditorCompatibilityAsset(
        metahubId: string,
        projectId: string,
        rawInput: Record<string, unknown>,
        file: { buffer: Buffer; filename: string } | null,
        userId: string
    ): Promise<{ id: number; name: string; type: string; createdAt: string }> {
        const writtenFiles: PlayCanvasWrittenFile[] = []
        try {
            if (typeof this.exec.transaction !== 'function') {
                return await this.createEditorCompatibilityAssetUnlocked(
                    metahubId,
                    projectId,
                    rawInput,
                    file,
                    userId,
                    this.exec,
                    writtenFiles
                )
            }
            return await this.runProjectLifecycleLocked(metahubId, projectId, (tx) =>
                this.createEditorCompatibilityAssetUnlocked(metahubId, projectId, rawInput, file, userId, tx, writtenFiles)
            )
        } catch (error) {
            await this.cleanupWrittenPlayCanvasFiles(writtenFiles, projectId, 'editor asset creation')
            throw error
        }
    }

    protected async createEditorCompatibilityAssetUnlocked(
        metahubId: string,
        projectId: string,
        rawInput: Record<string, unknown>,
        file: { buffer: Buffer; filename: string } | null,
        userId: string,
        executor: DbExecutor,
        writtenFiles: PlayCanvasWrittenFile[]
    ): Promise<{ id: number; name: string; type: string; createdAt: string }> {
        const parsed = playCanvasEditorCompatibilityAssetCreateRequestSchema.safeParse(rawInput)
        if (!parsed.success) {
            throw new MetahubValidationError('PlayCanvas Editor asset create request is invalid', {
                messageCode: 'playcanvas.editorCompatibility.assetCreateInvalid'
            })
        }
        const input = parsed.data
        if (!isPlayCanvasAssetType(input.type)) {
            throw new MetahubValidationError('PlayCanvas asset type is not supported', {
                messageCode: 'playcanvas.editorCompatibility.assetTypeUnsupported',
                type: input.type
            })
        }
        const assetType = input.type
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId, executor)

        const entries = await this.loadEditorCompatibilityAssetEntries(metahubId, projectId, userId, {}, executor)
        await this.materializeEditorCompatibilityAssetDocumentIds(schemaName, projectId, entries, userId, executor)
        const historicalEditorDocumentIds = new Set(await listPlayCanvasEditorDocumentIds(executor, schemaName, projectId))
        let parentSegments: string[] = []
        if (input.parent != null) {
            const parentEntry = entries.find((entry) => entry.documentId === input.parent)
            if (!parentEntry || parentEntry.asset.type !== 'folder') {
                throw new MetahubValidationError('PlayCanvas asset parent folder was not found', {
                    messageCode: 'playcanvas.editorCompatibility.parentFolderMissing'
                })
            }
            parentSegments = normalizedEditorAssetPath(parentEntry.asset.virtualPath)
        }

        const assetName = assertEditorAssetName(input.name)
        const assertSafeSegment = (segment: string): string => assertEditorAssetName(segment)
        const assertUniqueStoragePath = (virtualPath: readonly string[]): void => {
            const key = editorAssetPathKey(virtualPath)
            const conflict = entries.find((entry) => {
                if (!isStoragePlayCanvasAsset(entry.asset)) return false
                const existingPath = normalizedEditorAssetPath(
                    entry.asset.virtualPath.length > 0 ? entry.asset.virtualPath : [entry.asset.name]
                )
                return editorAssetPathKey(existingPath) === key
            })
            if (conflict) {
                throw new MetahubConflictError('A PlayCanvas Editor asset with this path already exists', {
                    messageCode: 'playcanvas.editorCompatibility.assetNameConflict',
                    projectId,
                    path: virtualPath.join('/')
                })
            }
        }

        const defaultExtensionByType: Record<string, string> = {
            script: '.js',
            json: '.json',
            css: '.css',
            html: '.html',
            text: '.txt',
            shader: '.shader'
        }
        const fileBackedTypes = new Set(['script', 'json', 'css', 'html', 'text', 'shader'])
        const createdAt = new Date().toISOString()

        if (assetType === 'folder') {
            const folderName = assetName
            const virtualPath = [...parentSegments, folderName]
            assertUniqueStoragePath(virtualPath)
            const documentKey = `folder:${projectId}:${virtualPath.join('/')}`
            const stableAssetId = `editor-${createHash('sha256').update(documentKey).digest('hex').slice(0, 32)}`
            const rowId = generateUuidV7()
            const metadata = {
                editorDocumentKey: documentKey,
                editorDocument: { data: null, meta: null, tags: [], preload: true, source: false, createdAt }
            }
            const documentId = resolveNewEditorCompatibilityAssetDocumentId(
                entries.map((entry) => entry.asset),
                {
                    id: rowId,
                    projectId,
                    stableAssetId,
                    type: 'folder',
                    name: folderName,
                    virtualPath,
                    file: null,
                    metadata,
                    publish: true
                },
                historicalEditorDocumentIds
            )
            try {
                await this.writeAssetMetadata(
                    metahubId,
                    projectId,
                    {
                        id: rowId,
                        stableAssetId,
                        type: 'folder',
                        name: folderName,
                        virtualPath,
                        file: null,
                        metadata: stripPlayCanvasAssetLifecycleMetadata(metadata),
                        lifecycleMetadata: { editorDocumentId: documentId, editorDocumentKey: documentKey },
                        publish: true
                    },
                    userId,
                    executor
                )
            } catch (error) {
                if (isUniqueViolation(error)) {
                    throw new MetahubConflictError('A PlayCanvas Editor asset with this path already exists', {
                        messageCode: 'playcanvas.editorCompatibility.assetNameConflict',
                        projectId,
                        path: virtualPath.join('/')
                    })
                }
                throw error
            }
            return { id: documentId, name: folderName, type: 'folder', createdAt }
        }

        if (fileBackedTypes.has(assetType)) {
            if (!file) {
                throw new MetahubValidationError('PlayCanvas asset file content is required for file-backed types', {
                    messageCode: 'playcanvas.editorCompatibility.assetFileRequired',
                    assetType
                })
            }
            const rawName = assertSafeSegment(file.filename || assetName)
            const defaultExtension = defaultExtensionByType[assetType]
            const filename = path.extname(rawName) === '' ? `${rawName}${defaultExtension}` : rawName
            assertSafeSegment(filename)
            const virtualPath = [...parentSegments, filename]
            assertUniqueStoragePath(virtualPath)
            const sourcePath = assertSafeRelativePlayCanvasProjectPath(`playcanvas-projects/${projectId}/assets/${virtualPath.join('/')}`)
            const mime = resolvePlayCanvasProjectExtensionMime(sourcePath)
            const scope = { metahubId, branchSlug: schemaName }
            const rowId = generateUuidV7()
            const documentKey = `asset:${rowId}`
            let written: Awaited<ReturnType<PlayCanvasProjectFileService['write']>>
            try {
                written = await this.fileService.write(scope, sourcePath, file.buffer, {
                    expectedChecksum: null,
                    expectedCurrentChecksum: null,
                    mime
                })
            } catch (error) {
                if (isCurrentChecksumMismatch(error)) {
                    throw new MetahubConflictError('A PlayCanvas Editor asset with this path already exists', {
                        messageCode: 'playcanvas.editorCompatibility.assetNameConflict',
                        projectId,
                        path: virtualPath.join('/')
                    })
                }
                throw error
            }
            writtenFiles.push({ scope, sourcePath, checksum: written.checksum, label: virtualPath.join('/') })
            const finalMime = written.mime ?? mime
            const stableAssetId = `editor-${createHash('sha256').update(`${projectId}:${sourcePath}`).digest('hex').slice(0, 32)}`
            const metadata = {
                editorDocumentKey: documentKey,
                editorDocument: {
                    data: input.data ?? null,
                    meta: input.meta ?? null,
                    tags: input.tags ? input.tags.split('\n').filter(Boolean) : [],
                    preload: input.preload !== 'false',
                    source: false,
                    createdAt
                }
            }
            let documentId: number
            let asset: PlayCanvasAsset & { version: number }
            try {
                documentId = resolveNewEditorCompatibilityAssetDocumentId(
                    entries.map((entry) => entry.asset),
                    {
                        id: rowId,
                        projectId,
                        stableAssetId,
                        type: assetType,
                        name: assetName,
                        virtualPath,
                        file: {
                            provider: 'local',
                            root: PLAYCANVAS_PROJECT_FILE_ROOT,
                            path: sourcePath,
                            hash: written.checksum,
                            size: written.size,
                            mime: finalMime,
                            status: 'ready'
                        },
                        metadata: stripPlayCanvasAssetLifecycleMetadata(metadata),
                        publish: true
                    },
                    historicalEditorDocumentIds
                )
                asset = await this.writeAssetMetadata(
                    metahubId,
                    projectId,
                    {
                        id: rowId,
                        stableAssetId,
                        type: assetType,
                        name: assetName,
                        virtualPath,
                        file: {
                            provider: 'local',
                            root: PLAYCANVAS_PROJECT_FILE_ROOT,
                            path: sourcePath,
                            hash: written.checksum,
                            size: written.size,
                            mime: finalMime,
                            status: 'ready'
                        },
                        metadata: stripPlayCanvasAssetLifecycleMetadata(metadata),
                        lifecycleMetadata: { editorDocumentId: documentId, editorDocumentKey: documentKey },
                        publish: true
                    },
                    userId,
                    executor
                )
            } catch (error) {
                if (isUniqueViolation(error)) {
                    throw new MetahubConflictError('A PlayCanvas Editor asset with this path already exists', {
                        messageCode: 'playcanvas.editorCompatibility.assetNameConflict',
                        projectId,
                        path: virtualPath.join('/')
                    })
                }
                throw error
            }
            return {
                id: documentId,
                name: asset.name,
                type: asset.type,
                createdAt
            }
        }

        // Data-only types (material, texture metadata rows, model/audio placeholders):
        // persist the payload as metadata without touching the file slice.
        const rowId = generateUuidV7()
        const documentKey = `asset:${rowId}`
        const virtualPath = [...parentSegments, assetName]
        assertUniqueStoragePath(virtualPath)
        const stableAssetId = `editor-${createHash('sha256')
            .update(`${projectId}:${assetType}:${assetName}:${createdAt}`)
            .digest('hex')
            .slice(0, 32)}`
        const metadata = {
            editorDocumentKey: documentKey,
            editorDocument: {
                data: input.data ?? null,
                meta: input.meta ?? null,
                tags: input.tags ? input.tags.split('\n').filter(Boolean) : [],
                preload: input.preload !== 'false',
                source: false,
                createdAt
            }
        }
        const documentId = resolveNewEditorCompatibilityAssetDocumentId(
            entries.map((entry) => entry.asset),
            {
                id: rowId,
                projectId,
                stableAssetId,
                type: assetType,
                name: assetName,
                virtualPath,
                file: null,
                metadata,
                publish: true
            },
            historicalEditorDocumentIds
        )
        let asset: PlayCanvasAsset & { version: number }
        try {
            asset = await this.writeAssetMetadata(
                metahubId,
                projectId,
                {
                    id: rowId,
                    stableAssetId,
                    type: assetType,
                    name: assetName,
                    virtualPath,
                    file: null,
                    metadata: stripPlayCanvasAssetLifecycleMetadata(metadata),
                    lifecycleMetadata: { editorDocumentId: documentId, editorDocumentKey: documentKey },
                    publish: true
                },
                userId,
                executor
            )
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new MetahubConflictError('A PlayCanvas Editor asset with this path already exists', {
                    messageCode: 'playcanvas.editorCompatibility.assetNameConflict',
                    projectId,
                    path: virtualPath.join('/')
                })
            }
            throw error
        }
        return {
            id: documentId,
            name: asset.name,
            type: asset.type,
            createdAt
        }
    }

    async updateEditorCompatibilityAsset(
        metahubId: string,
        projectId: string,
        documentId: number,
        input: { name?: string; parent?: number },
        userId: string
    ): Promise<{ id: number; name: string; type: string; filename?: string }> {
        if (typeof this.exec.transaction !== 'function') {
            return this.updateEditorCompatibilityAssetUnlocked(metahubId, projectId, documentId, input, userId, this.exec)
        }
        return this.runProjectLifecycleLocked(metahubId, projectId, (tx) =>
            this.updateEditorCompatibilityAssetUnlocked(metahubId, projectId, documentId, input, userId, tx)
        )
    }

    protected async updateEditorCompatibilityAssetUnlocked(
        metahubId: string,
        projectId: string,
        documentId: number,
        input: { name?: string; parent?: number },
        userId: string,
        executor: DbExecutor
    ): Promise<{ id: number; name: string; type: string; filename?: string }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId, executor)
        const entries = await this.loadEditorCompatibilityAssetEntries(metahubId, projectId, userId, {}, executor)
        await this.materializeEditorCompatibilityAssetDocumentIds(schemaName, projectId, entries, userId, executor)
        const entry = entries.find((candidate) => candidate.documentId === documentId)
        if (!entry || !isStoragePlayCanvasAsset(entry.asset)) {
            throw new MetahubValidationError('PlayCanvas Editor asset was not found', {
                messageCode: 'playcanvas.editorCompatibility.assetNotFound',
                documentId
            })
        }

        const asset = entry.asset
        const currentPath = normalizedEditorAssetPath(asset.virtualPath.length > 0 ? asset.virtualPath : [asset.name])
        const currentLeaf = currentPath[currentPath.length - 1] ?? asset.name
        const requestedName = input.name === undefined ? asset.name : assertEditorAssetName(input.name)
        const nextLeaf =
            asset.file && path.extname(requestedName) === '' && path.extname(currentLeaf) !== ''
                ? `${requestedName}${path.extname(currentLeaf)}`
                : requestedName
        assertEditorAssetName(nextLeaf)

        let parentSegments = currentPath.slice(0, -1)
        if (input.parent !== undefined) {
            const parent = entries.find((candidate) => candidate.documentId === input.parent)
            if (!parent || parent.asset.type !== 'folder' || !isStoragePlayCanvasAsset(parent.asset)) {
                throw new MetahubValidationError('PlayCanvas asset parent folder was not found', {
                    messageCode: 'playcanvas.editorCompatibility.parentFolderMissing',
                    documentId: input.parent
                })
            }
            parentSegments = normalizedEditorAssetPath(parent.asset.virtualPath)
            if (asset.type === 'folder' && isEditorAssetPathPrefix(currentPath, parentSegments)) {
                throw new MetahubValidationError('A PlayCanvas folder cannot be moved into itself or one of its descendants', {
                    messageCode: 'playcanvas.editorCompatibility.folderMoveCycle',
                    documentId,
                    parent: input.parent
                })
            }
        }

        const nextVirtualPath = [...parentSegments, nextLeaf]
        const affectedEntries =
            asset.type === 'folder'
                ? entries.filter(
                      (candidate) =>
                          isStoragePlayCanvasAsset(candidate.asset) &&
                          isEditorAssetPathPrefix(
                              currentPath,
                              normalizedEditorAssetPath(
                                  candidate.asset.virtualPath.length > 0 ? candidate.asset.virtualPath : [candidate.asset.name]
                              )
                          )
                  )
                : [entry]
        const nextPathByAssetId = new Map<string, string[]>()
        for (const affected of affectedEntries) {
            const candidatePath = normalizedEditorAssetPath(
                affected.asset.virtualPath.length > 0 ? affected.asset.virtualPath : [affected.asset.name]
            )
            nextPathByAssetId.set(
                affected.asset.id,
                affected.asset.id === asset.id ? nextVirtualPath : [...nextVirtualPath, ...candidatePath.slice(currentPath.length)]
            )
        }
        const affectedIds = new Set(affectedEntries.map((candidate) => candidate.asset.id))
        const occupiedPaths = new Set<string>()
        for (const affected of affectedEntries) {
            const nextPath = nextPathByAssetId.get(affected.asset.id)
            if (!nextPath) continue
            const key = editorAssetPathKey(nextPath)
            if (occupiedPaths.has(key)) {
                throw new MetahubValidationError('A PlayCanvas asset with this path already exists', {
                    messageCode: 'playcanvas.editorCompatibility.assetNameConflict',
                    name: nextPath.at(-1),
                    parent: nextPath.slice(0, -1).join('/')
                })
            }
            occupiedPaths.add(key)
        }
        const collision = entries.some((candidate) => {
            if (!isStoragePlayCanvasAsset(candidate.asset) || affectedIds.has(candidate.asset.id)) return false
            const candidatePath = normalizedEditorAssetPath(
                candidate.asset.virtualPath.length > 0 ? candidate.asset.virtualPath : [candidate.asset.name]
            )
            return occupiedPaths.has(editorAssetPathKey(candidatePath))
        })
        if (collision) {
            throw new MetahubValidationError('An asset with this name already exists in the target folder', {
                messageCode: 'playcanvas.editorCompatibility.assetNameConflict',
                name: requestedName,
                parent: parentSegments.join('/')
            })
        }

        const scope = { metahubId, branchSlug: schemaName }
        const movedFiles: Array<{ oldPath: string; newPath: string; checksum: string; mime: string | null }> = []
        const updateInputs: Array<{
            id: string
            name: string
            virtualPath: string[]
            file: PlayCanvasAsset['file']
            expectedVersion: number
        }> = []
        try {
            for (const affected of affectedEntries) {
                if (!isStoragePlayCanvasAsset(affected.asset)) continue
                const candidatePath = nextPathByAssetId.get(affected.asset.id)
                if (!candidatePath) continue
                const oldSourcePath = affected.asset.file?.path ?? null
                const nextSourcePath = affected.asset.file
                    ? assertSafeRelativePlayCanvasProjectPath(`playcanvas-projects/${projectId}/assets/${candidatePath.join('/')}`)
                    : null
                let nextFile = affected.asset.file
                if (oldSourcePath && nextSourcePath && oldSourcePath !== nextSourcePath && affected.asset.file) {
                    const moved = await this.fileService.rename(scope, oldSourcePath, nextSourcePath, {
                        expectedChecksum: affected.asset.file.hash ?? null,
                        mime: affected.asset.file.mime ?? resolvePlayCanvasProjectExtensionMime(nextSourcePath)
                    })
                    movedFiles.push({
                        oldPath: oldSourcePath,
                        newPath: nextSourcePath,
                        checksum: moved.checksum,
                        mime: affected.asset.file.mime ?? resolvePlayCanvasProjectExtensionMime(oldSourcePath)
                    })
                    nextFile = {
                        ...affected.asset.file,
                        path: nextSourcePath,
                        hash: moved.checksum,
                        size: moved.size,
                        mime: moved.mime ?? affected.asset.file.mime
                    }
                }
                updateInputs.push({
                    id: affected.asset.id,
                    name: affected.asset.id === asset.id ? requestedName : affected.asset.name,
                    virtualPath: candidatePath,
                    file: nextFile,
                    expectedVersion: affected.asset.version
                })
            }

            const updatedRows =
                updateInputs.length > 1
                    ? await updatePlayCanvasAssetTreeMetadata(executor, schemaName, projectId, updateInputs, userId)
                    : [
                          await updatePlayCanvasAssetMetadata(
                              executor,
                              schemaName,
                              projectId,
                              asset.id,
                              updateInputs[0] ?? {
                                  id: asset.id,
                                  name: requestedName,
                                  virtualPath: nextVirtualPath,
                                  file: asset.file,
                                  expectedVersion: asset.version
                              },
                              userId
                          )
                      ].filter((row): row is PlayCanvasAsset & { version: number } => Boolean(row))
            const updated = updatedRows.find((row) => row.id === asset.id)
            if (!updated || updatedRows.length !== updateInputs.length) {
                throw this.optimisticError(asset.id, asset.version)
            }
            return { id: documentId, name: updated.name, type: updated.type, filename: nextLeaf }
        } catch (error) {
            for (const moved of movedFiles.reverse()) {
                await this.fileService
                    .rename(scope, moved.newPath, moved.oldPath, { expectedChecksum: moved.checksum, mime: moved.mime })
                    .catch((rollbackError: unknown) => {
                        log.warn('Failed to roll back PlayCanvas folder move after metadata failure', {
                            projectId,
                            oldPath: moved.oldPath,
                            newPath: moved.newPath,
                            rollbackError: rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
                        })
                    })
            }
            if (isUniqueViolation(error)) {
                throw new MetahubConflictError('A PlayCanvas Editor asset with this path already exists', {
                    messageCode: 'playcanvas.editorCompatibility.assetNameConflict',
                    projectId,
                    path: nextVirtualPath.join('/')
                })
            }
            throw error
        }
    }

    /**
     * Deletes editor-facing assets by their numeric ShareDB document ids. Folder
     * targets expand to every asset nested under the folder path. Only durable
     * storage assets are removable here; scene-local payload assets belong to the
     * scene save flow and are ignored (logged) when targeted.
     */
    async deleteEditorCompatibilityAssets(
        metahubId: string,
        projectId: string,
        documentIds: readonly number[],
        userId: string
    ): Promise<{ deletedDocumentIds: number[] }> {
        // Physical bytes are removed before the metadata transaction commits.
        // Keep the compensating backups outside the lock callback as well: a
        // database driver can reject the outer COMMIT after the callback has
        // returned, which is otherwise too late for the inner rollback handler
        // to restore the files.
        const deletedFileBackups: PlayCanvasDeletedFileBackup[] = []
        try {
            if (typeof this.exec.transaction !== 'function') {
                return await this.deleteEditorCompatibilityAssetsUnlocked(
                    metahubId,
                    projectId,
                    documentIds,
                    userId,
                    this.exec,
                    deletedFileBackups
                )
            }
            return await this.runProjectLifecycleLocked(metahubId, projectId, (tx) =>
                this.deleteEditorCompatibilityAssetsUnlocked(metahubId, projectId, documentIds, userId, tx, deletedFileBackups)
            )
        } catch (error) {
            await this.restoreDeletedPlayCanvasFiles(deletedFileBackups, projectId)
            throw error
        }
    }

    protected async deleteEditorCompatibilityAssetsUnlocked(
        metahubId: string,
        projectId: string,
        documentIds: readonly number[],
        userId: string,
        executor: DbExecutor,
        deletedFileBackups: PlayCanvasDeletedFileBackup[]
    ): Promise<{ deletedDocumentIds: number[] }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId, executor)
        const entries = await this.loadEditorCompatibilityAssetEntries(metahubId, projectId, userId, {}, executor)
        await this.materializeEditorCompatibilityAssetDocumentIds(schemaName, projectId, entries, userId, executor)
        const entryByDocumentId = new Map(entries.map((entry) => [entry.documentId, entry]))

        const targetEntries: PlayCanvasEditorCompatibilityAssetEntry[] = []
        const missingDocumentIds: number[] = []
        const seen = new Set<string>()
        for (const documentId of documentIds) {
            const entry = entryByDocumentId.get(documentId)
            if (!entry) {
                missingDocumentIds.push(documentId)
                continue
            }
            if ('sceneId' in entry.asset) {
                log.warn('Skipping scene-local asset deletion via editor compatibility route', {
                    projectId,
                    documentId
                })
                continue
            }
            if (entry.asset.type === 'folder') {
                for (const candidate of entries) {
                    if ('sceneId' in candidate.asset) continue
                    if (isEditorAssetPathPrefix(entry.asset.virtualPath, candidate.asset.virtualPath)) {
                        if (!seen.has(candidate.asset.id)) {
                            seen.add(candidate.asset.id)
                            targetEntries.push(candidate)
                        }
                    }
                }
                continue
            }
            if (!seen.has(entry.asset.id)) {
                seen.add(entry.asset.id)
                targetEntries.push(entry)
            }
        }

        if (missingDocumentIds.length > 0) {
            throw new MetahubValidationError('PlayCanvas Editor asset was not found', {
                messageCode: 'playcanvas.editorCompatibility.assetNotFound',
                projectId,
                documentIds: missingDocumentIds
            })
        }
        if (targetEntries.length === 0) {
            throw new MetahubValidationError('PlayCanvas Editor asset cannot be deleted through the compatibility route', {
                messageCode: 'playcanvas.editorCompatibility.sceneAssetDeleteUnsupported',
                projectId,
                documentIds
            })
        }

        if (typeof executor.transaction !== 'function') {
            throw new MetahubDomainError({
                message: 'PlayCanvas Editor asset deletion requires a transactional database executor',
                statusCode: 503,
                code: 'SCHEMA_SYNC_FAILED',
                details: { messageCode: 'playcanvas.editorCompatibility.assetDeleteTransactionRequired', projectId }
            })
        }

        const scope = { metahubId, branchSlug: schemaName }
        const targetAssetIds = targetEntries.map((entry) => entry.asset.id)
        // Remove files first, but keep their bytes so a failed DB transaction
        // can restore every path. The row update below is all-or-nothing.
        for (const entry of targetEntries) {
            const file = entry.asset.file
            if (!file?.path) continue
            const previous = await this.fileService.read(scope, file.path)
            const expectedChecksum = file.hash ?? previous.checksum
            if (previous.checksum !== expectedChecksum) {
                throw new MetahubValidationError('PlayCanvas project file current checksum does not match', {
                    messageCode: 'playcanvas.files.path.currentChecksumMismatch',
                    sourcePath: file.path,
                    expectedCurrentChecksum: expectedChecksum,
                    actualCurrentChecksum: previous.checksum
                })
            }
            const deleted = await this.fileService.deleteIfCurrentChecksum(scope, file.path, expectedChecksum)
            if (!deleted) {
                throw new MetahubConflictError('PlayCanvas Editor asset file changed during deletion', {
                    messageCode: 'playcanvas.editorCompatibility.assetDeleteConflict',
                    projectId,
                    assetId: entry.asset.id
                })
            }
            deletedFileBackups.push({
                scope,
                sourcePath: file.path,
                content: previous.content,
                checksum: previous.checksum,
                mime: file.mime ?? null
            })
        }

        const deletedRows = await executor.transaction(async (tx) => {
            const rows = await deletePlayCanvasAssetsByIds(
                tx,
                schemaName,
                projectId,
                targetAssetIds,
                userId,
                targetEntries.map((entry) => ({ id: entry.asset.id, version: entry.asset.version }))
            )
            if (rows.length !== targetAssetIds.length) {
                throw new MetahubConflictError('PlayCanvas Editor asset delete did not remove every expected row', {
                    messageCode: 'playcanvas.editorCompatibility.assetDeleteConflict',
                    projectId,
                    requestedAssetCount: targetAssetIds.length,
                    deletedAssetCount: rows.length
                })
            }
            return rows
        })

        const deletedAssetIds = deletedRows.map((row) => row.id)
        return {
            deletedDocumentIds: deletedAssetIds
                .map((assetId) => entries.find((entry) => entry.asset.id === assetId)?.documentId ?? 0)
                .filter(Boolean)
        }
    }

    /** Reads the raw file content of an editor asset by its numeric document id. */
}
