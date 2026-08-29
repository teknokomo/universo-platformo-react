/**
 * Durable source-file operations for the PlayCanvas compatibility API.
 *
 * Source files have a separate storage namespace and metadata lifecycle, so
 * their validation and rollback flow is kept separate from generic assets.
 */
import { createHash } from 'node:crypto'
import type {
    PlayCanvasEditorCompatibilitySourceFileDocument,
    PlayCanvasEditorCompatibilitySourceFileSummary,
    PlayCanvasSourceFile
} from '@universo-react/types'
import { PLAYCANVAS_EDITOR_BRIDGE_SESSION_TTL_MS, PLAYCANVAS_PROJECT_FILE_ROOT } from '@universo-react/types'

import { type DbExecutor } from '@universo-react/utils/database'
import { generateUuidV7 } from '@universo-react/utils'
import { MetahubConflictError, MetahubDomainError, MetahubValidationError } from '../../shared/domainErrors'

import { PlayCanvasEditorBridgeSessionService } from './PlayCanvasEditorBridgeSessionService'
import {
    findPlayCanvasSourceFileByStableId,
    findPlayCanvasSourceFileByStableIdIncludingDeleted,
    listPlayCanvasSourceFiles,
    upsertPlayCanvasSourceFile,
    softDeletePlayCanvasSourceFileByStableId
} from './playCanvasProjectsStore'

import { PlayCanvasProjectsServicePublication } from './playCanvasProjectsServicePublication'
import {
    COMPATIBILITY_SOURCEFILE_WRITE_COMMAND_TYPE,
    COMPATIBILITY_SOURCEFILE_DELETE_COMMAND_TYPE,
    normalizeEditorSourceFilePath,
    normalizeEditorSourceFileStableId,
    getEditorSourceFileName,
    hashEditorCompatibilityReplayFingerprint,
    compatibilitySourceFileSessionId,
    isEditorCompatibilitySourceFileDocument,
    isEditorCompatibilitySourceFileDeleteResult
} from './playCanvasProjectsServiceHelpers'

export class PlayCanvasProjectsServiceSourceFiles extends PlayCanvasProjectsServicePublication {
    async listEditorCompatibilitySourceFiles(
        metahubId: string,
        projectId: string,
        _userId: string
    ): Promise<PlayCanvasEditorCompatibilitySourceFileSummary[]> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const sourceFiles = await listPlayCanvasSourceFiles(this.exec, schemaName, projectId)
        return sourceFiles.map((sourceFile) => ({
            id: sourceFile.stableSourceFileId,
            path: sourceFile.file.path,
            filename: sourceFile.name,
            name: sourceFile.name,
            hash: sourceFile.file.hash ?? sourceFile.checksum ?? null,
            size: sourceFile.file.size ?? null,
            mime: sourceFile.file.mime ?? 'text/javascript',
            updatedAt: null
        }))
    }

    async readEditorCompatibilitySourceFile(
        metahubId: string,
        projectId: string,
        sourceFileId: string,
        _userId: string
    ): Promise<PlayCanvasEditorCompatibilitySourceFileDocument> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const stableSourceFileId = normalizeEditorSourceFileStableId(sourceFileId)
        const sourceFile = await findPlayCanvasSourceFileByStableId(this.exec, schemaName, projectId, stableSourceFileId)
        if (!sourceFile) {
            throw new MetahubValidationError('PlayCanvas sourcefile was not found', {
                messageCode: 'playcanvas.sourcefiles.notFound',
                sourceFileId
            })
        }
        const sourcePath = this.assertSourceFileReference(projectId, sourceFile.file)?.path
        if (!sourcePath) {
            throw new MetahubValidationError('PlayCanvas sourcefile metadata does not reference a source file', {
                messageCode: 'playcanvas.files.role.sourcefileMismatch',
                sourceFileId
            })
        }
        const read = await this.fileService.read({ metahubId, branchSlug: schemaName }, sourcePath)
        const content = read.content.toString('utf8')
        return {
            id: sourceFile.stableSourceFileId,
            path: sourcePath,
            name: sourceFile.name,
            content,
            hash: read.checksum,
            size: read.size,
            mime: sourceFile.file.mime ?? 'text/javascript',
            updatedAt: null
        }
    }

    async writeEditorCompatibilitySourceFile(
        metahubId: string,
        projectId: string,
        sourceFileId: string,
        input: {
            requestId: string
            path: string
            name?: string
            content: string
            expectedCurrentChecksum?: string | null
        },
        userId: string
    ): Promise<PlayCanvasEditorCompatibilitySourceFileDocument> {
        return this.runProjectLifecycleLocked(metahubId, projectId, (executor) =>
            this.writeEditorCompatibilitySourceFileUnlocked(metahubId, projectId, sourceFileId, input, userId, executor)
        )
    }

    protected async writeEditorCompatibilitySourceFileUnlocked(
        metahubId: string,
        projectId: string,
        sourceFileId: string,
        input: {
            requestId: string
            path: string
            name?: string
            content: string
            expectedCurrentChecksum?: string | null
        },
        userId: string,
        executor: DbExecutor
    ): Promise<PlayCanvasEditorCompatibilitySourceFileDocument> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId, executor)
        const stableSourceFileId = normalizeEditorSourceFileStableId(sourceFileId)
        const sourcePath = normalizeEditorSourceFilePath(projectId, stableSourceFileId, input.path, this.fileService)
        const sessionService = new PlayCanvasEditorBridgeSessionService()
        const replayInput = {
            sessionId: compatibilitySourceFileSessionId({ metahubId, projectId, sourceFileId: stableSourceFileId, userId }),
            metahubId,
            projectId,
            requestId: input.requestId,
            commandType: COMPATIBILITY_SOURCEFILE_WRITE_COMMAND_TYPE,
            fingerprint: hashEditorCompatibilityReplayFingerprint({
                path: sourcePath,
                name: input.name ?? null,
                content: input.content,
                expectedCurrentChecksum: input.expectedCurrentChecksum
            }),
            expiresAt: Date.now() + PLAYCANVAS_EDITOR_BRIDGE_SESSION_TTL_MS,
            userId
        }
        const claimed = await sessionService.claimReplay(executor, schemaName, replayInput)
        if (!claimed) {
            const storedResponse = await sessionService.readReplayResponse(executor, schemaName, replayInput)
            if (storedResponse?.status === 'completed' && isEditorCompatibilitySourceFileDocument(storedResponse.response)) {
                return storedResponse.response
            }
            if (storedResponse && sessionService.isReplayClaimRecoverable(storedResponse)) {
                const existing = await findPlayCanvasSourceFileByStableId(executor, schemaName, projectId, stableSourceFileId)
                const currentPath = existing?.file?.path
                if (existing && currentPath === sourcePath && existing.file.hash) {
                    const currentFile = await this.fileService.read({ metahubId, branchSlug: schemaName }, sourcePath).catch(() => null)
                    const expectedContent = Buffer.from(input.content, 'utf8')
                    const expectedChecksum = createHash('sha256').update(expectedContent).digest('hex')
                    if (
                        currentFile &&
                        currentFile.checksum === expectedChecksum &&
                        currentFile.content.equals(expectedContent) &&
                        existing.file.hash === expectedChecksum
                    ) {
                        const response = {
                            id: stableSourceFileId,
                            path: sourcePath,
                            name: existing.name,
                            content: input.content,
                            hash: expectedChecksum,
                            size: expectedContent.length,
                            mime: existing.file.mime ?? 'text/javascript',
                            updatedAt: null
                        } satisfies PlayCanvasEditorCompatibilitySourceFileDocument
                        const completed = await sessionService.completeReplay(executor, schemaName, {
                            ...replayInput,
                            response,
                            userId
                        })
                        if (!completed) {
                            throw new MetahubDomainError({
                                message: 'PlayCanvas Editor compatibility sourcefile write replay response could not be recorded',
                                statusCode: 503,
                                code: 'SCHEMA_SYNC_FAILED',
                                details: {
                                    messageCode: 'playcanvas.editorCompatibility.replayCompletionFailed',
                                    requestId: input.requestId
                                }
                            })
                        }
                        return response
                    }
                }
            }
            throw new MetahubConflictError('PlayCanvas Editor compatibility sourcefile write replay is already in progress', {
                messageCode: 'playcanvas.editorCompatibility.replayRejected',
                requestId: input.requestId
            })
        }

        let mutationCommitted = false
        let replayClaimReleased = false
        const releaseReplayClaim = async () => {
            if (replayClaimReleased) return
            replayClaimReleased = true
            await sessionService.releaseReplay(executor, schemaName, replayInput).catch(() => undefined)
        }
        try {
            const existing = await findPlayCanvasSourceFileByStableId(executor, schemaName, projectId, stableSourceFileId)
            const existingSourcePath = existing ? this.assertSourceFileReference(projectId, existing.file)?.path ?? null : null
            if (existing && existingSourcePath !== sourcePath) {
                throw new MetahubValidationError('PlayCanvas sourcefile path changes are not supported for existing sourcefile ids', {
                    messageCode: 'playcanvas.files.sourcefile.pathChangeUnsupported',
                    sourceFileId: stableSourceFileId,
                    existingSourcePath,
                    sourcePath
                })
            }
            const sourceFileIdForStorage = existing?.id ?? generateUuidV7()
            const name = existing?.name ?? getEditorSourceFileName(stableSourceFileId, input.path, input.name)
            const initialFile = {
                provider: 'local',
                root: PLAYCANVAS_PROJECT_FILE_ROOT,
                path: sourcePath,
                hash: existing?.file.hash ?? input.expectedCurrentChecksum ?? null,
                size: existing?.file.size ?? null,
                mime: existing?.file.mime ?? 'text/javascript',
                status: existing?.file.status ?? 'missing'
            } satisfies PlayCanvasSourceFile['file']
            this.assertSourceFileReference(projectId, initialFile)
            const metadata = await upsertPlayCanvasSourceFile(
                executor,
                schemaName,
                projectId,
                {
                    id: sourceFileIdForStorage,
                    stableSourceFileId,
                    name,
                    virtualPath: [name],
                    file: initialFile,
                    scriptKind: 'esm',
                    checksum: initialFile.hash ?? null,
                    parsedAttributes: existing?.parsedAttributes ?? {},
                    parseStatus: 'missing',
                    parseDiagnostics: existing?.parseDiagnostics ?? null,
                    publish: existing?.publish ?? true,
                    expectedVersion: existing?.version
                },
                userId
            )
            if (!metadata) {
                throw this.metadataUpdateError(projectId, sourcePath)
            }
            const scope = { metahubId, branchSlug: schemaName }
            const previous = await this.readFileForRollback(scope, sourcePath)
            let written: { sourcePath: string; checksum: string; size: number; mime: string | null }
            try {
                written = await this.fileService.write(scope, sourcePath, Buffer.from(input.content, 'utf8'), {
                    expectedChecksum: null,
                    expectedCurrentChecksum: input.expectedCurrentChecksum ?? null,
                    mime: 'text/javascript'
                })
            } catch (error) {
                await this.markSourceFileMetadataMissingAfterWriteFailure(
                    schemaName,
                    projectId,
                    sourcePath,
                    stableSourceFileId,
                    userId,
                    existing ?? null,
                    metadata.version,
                    executor
                )
                throw error
            }
            const finalMime = written.mime ?? 'text/javascript'
            const finalFile = {
                ...initialFile,
                hash: written.checksum,
                size: written.size,
                mime: finalMime,
                status: 'ready'
            } satisfies PlayCanvasSourceFile['file']
            try {
                const finalized = await upsertPlayCanvasSourceFile(
                    executor,
                    schemaName,
                    projectId,
                    {
                        id: metadata.id,
                        stableSourceFileId,
                        name,
                        virtualPath: [name],
                        file: finalFile,
                        scriptKind: metadata.scriptKind,
                        checksum: written.checksum,
                        parsedAttributes: metadata.parsedAttributes,
                        parseStatus: 'ready',
                        parseDiagnostics: metadata.parseDiagnostics,
                        publish: metadata.publish,
                        expectedVersion: metadata.version
                    },
                    userId
                )
                if (finalized) {
                    mutationCommitted = true
                }
            } finally {
                if (!mutationCommitted) {
                    await this.markSourceFileMetadataMissingAfterWriteFailure(
                        schemaName,
                        projectId,
                        sourcePath,
                        stableSourceFileId,
                        userId,
                        existing ?? null,
                        metadata.version,
                        executor
                    )
                }
            }
            if (!mutationCommitted) {
                await this.rollbackFileWrite(scope, sourcePath, written.checksum, previous, finalMime)
                throw this.metadataUpdateError(projectId, sourcePath)
            }
            const response = {
                id: stableSourceFileId,
                path: written.sourcePath,
                name,
                content: input.content,
                hash: written.checksum,
                size: written.size,
                mime: written.mime ?? 'text/javascript',
                updatedAt: null
            } satisfies PlayCanvasEditorCompatibilitySourceFileDocument
            let completed: boolean
            try {
                completed = await sessionService.completeReplay(executor, schemaName, {
                    ...replayInput,
                    response,
                    userId
                })
            } catch (error) {
                if (typeof this.exec.transaction === 'function') {
                    // The surrounding lifecycle transaction will roll back the
                    // metadata. Restore the physical bytes before it exits so
                    // a completion-write failure cannot strand an orphan file.
                    mutationCommitted = false
                    await this.rollbackFileWrite(scope, sourcePath, written.checksum, previous, finalMime).catch(() => undefined)
                }
                throw error
            }
            if (!completed) {
                if (typeof this.exec.transaction === 'function') {
                    mutationCommitted = false
                    await this.rollbackFileWrite(scope, sourcePath, written.checksum, previous, finalMime).catch(() => undefined)
                }
                throw new MetahubDomainError({
                    message: 'PlayCanvas Editor compatibility sourcefile write replay response could not be recorded',
                    statusCode: 503,
                    code: 'SCHEMA_SYNC_FAILED',
                    details: {
                        messageCode: 'playcanvas.editorCompatibility.replayCompletionFailed',
                        requestId: input.requestId
                    }
                })
            }
            return response
        } catch (error) {
            if (!mutationCommitted) {
                await releaseReplayClaim()
            }
            throw error
        }
    }

    async deleteEditorCompatibilitySourceFile(
        metahubId: string,
        projectId: string,
        sourceFileId: string,
        input: { requestId: string; expectedCurrentChecksum?: string | null },
        userId: string
    ): Promise<{ id: string; deleted: true }> {
        return this.runProjectLifecycleLocked(metahubId, projectId, (executor) =>
            this.deleteEditorCompatibilitySourceFileUnlocked(metahubId, projectId, sourceFileId, input, userId, executor)
        )
    }

    protected async deleteEditorCompatibilitySourceFileUnlocked(
        metahubId: string,
        projectId: string,
        sourceFileId: string,
        input: { requestId: string; expectedCurrentChecksum?: string | null },
        userId: string,
        executor: DbExecutor
    ): Promise<{ id: string; deleted: true }> {
        if (!input.expectedCurrentChecksum) {
            throw new MetahubValidationError('Current file checksum is required', {
                messageCode: 'playcanvas.files.path.currentChecksumRequired',
                sourceFileId
            })
        }
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId, executor)
        const stableSourceFileId = normalizeEditorSourceFileStableId(sourceFileId)
        const sessionService = new PlayCanvasEditorBridgeSessionService()
        const replayInput = {
            sessionId: compatibilitySourceFileSessionId({ metahubId, projectId, sourceFileId: stableSourceFileId, userId }),
            metahubId,
            projectId,
            requestId: input.requestId,
            commandType: COMPATIBILITY_SOURCEFILE_DELETE_COMMAND_TYPE,
            fingerprint: hashEditorCompatibilityReplayFingerprint({
                expectedCurrentChecksum: input.expectedCurrentChecksum
            }),
            expiresAt: Date.now() + PLAYCANVAS_EDITOR_BRIDGE_SESSION_TTL_MS,
            userId
        }
        const claimed = await sessionService.claimReplay(executor, schemaName, replayInput)
        if (!claimed) {
            const storedResponse = await sessionService.readReplayResponse(executor, schemaName, replayInput)
            if (storedResponse?.status === 'completed' && isEditorCompatibilitySourceFileDeleteResult(storedResponse.response)) {
                return storedResponse.response
            }
            if (storedResponse && sessionService.isReplayClaimRecoverable(storedResponse)) {
                const existing = await findPlayCanvasSourceFileByStableIdIncludingDeleted(
                    executor,
                    schemaName,
                    projectId,
                    stableSourceFileId
                )
                if (existing?.isDeleted && existing.isMetahubDeleted) {
                    const response = { id: stableSourceFileId, deleted: true } as const
                    const completed = await sessionService.completeReplay(executor, schemaName, {
                        ...replayInput,
                        response,
                        userId
                    })
                    if (!completed) {
                        throw new MetahubDomainError({
                            message: 'PlayCanvas Editor compatibility sourcefile delete replay response could not be recorded',
                            statusCode: 503,
                            code: 'SCHEMA_SYNC_FAILED',
                            details: {
                                messageCode: 'playcanvas.editorCompatibility.replayCompletionFailed',
                                requestId: input.requestId
                            }
                        })
                    }
                    return response
                }
            }
            throw new MetahubConflictError('PlayCanvas Editor compatibility sourcefile delete replay is already in progress', {
                messageCode: 'playcanvas.editorCompatibility.replayRejected',
                requestId: input.requestId
            })
        }

        let mutationCommitted = false
        let replayClaimReleased = false
        const releaseReplayClaim = async () => {
            if (replayClaimReleased) return
            replayClaimReleased = true
            await sessionService.releaseReplay(executor, schemaName, replayInput).catch(() => undefined)
        }
        try {
            const sourceFile = await findPlayCanvasSourceFileByStableId(executor, schemaName, projectId, stableSourceFileId)
            if (!sourceFile) {
                throw new MetahubValidationError('PlayCanvas sourcefile was not found', {
                    messageCode: 'playcanvas.sourcefiles.notFound',
                    sourceFileId
                })
            }
            const sourcePath = sourceFile.file.path
            const safePath = this.assertSourceFileReference(projectId, sourceFile.file)?.path ?? null
            if (!safePath) {
                throw new MetahubValidationError('PlayCanvas sourcefile metadata does not reference a source file', {
                    messageCode: 'playcanvas.files.role.sourcefileMismatch',
                    sourceFileId
                })
            }
            const scope = { metahubId, branchSlug: schemaName }
            const previous = await this.readFileForRollback(scope, safePath)
            const physicallyDeleted = await this.fileService.deleteIfCurrentChecksum(scope, safePath, input.expectedCurrentChecksum)
            if (!physicallyDeleted) {
                throw new MetahubValidationError('Current file checksum does not match', {
                    messageCode: 'playcanvas.files.path.currentChecksumMismatch',
                    expectedCurrentChecksum: input.expectedCurrentChecksum,
                    sourcePath: safePath
                })
            }
            const deleted = await softDeletePlayCanvasSourceFileByStableId(
                executor,
                schemaName,
                projectId,
                stableSourceFileId,
                userId,
                sourceFile.version
            )
            if (!deleted) {
                await this.rollbackPhysicalDelete(scope, safePath, previous, sourceFile.file.mime)
                throw this.metadataUpdateError(projectId, sourcePath)
            }
            mutationCommitted = true
            const response = { id: stableSourceFileId, deleted: true } as const
            let completed: boolean
            try {
                completed = await sessionService.completeReplay(executor, schemaName, {
                    ...replayInput,
                    response,
                    userId
                })
            } catch (error) {
                if (typeof this.exec.transaction === 'function') {
                    mutationCommitted = false
                    await this.rollbackPhysicalDelete(scope, safePath, previous, sourceFile.file.mime).catch(() => undefined)
                }
                throw error
            }
            if (!completed) {
                if (typeof this.exec.transaction === 'function') {
                    mutationCommitted = false
                    await this.rollbackPhysicalDelete(scope, safePath, previous, sourceFile.file.mime).catch(() => undefined)
                }
                throw new MetahubDomainError({
                    message: 'PlayCanvas Editor compatibility sourcefile delete replay response could not be recorded',
                    statusCode: 503,
                    code: 'SCHEMA_SYNC_FAILED',
                    details: {
                        messageCode: 'playcanvas.editorCompatibility.replayCompletionFailed',
                        requestId: input.requestId
                    }
                })
            }
            return response
        } catch (error) {
            if (!mutationCommitted) {
                await releaseReplayClaim()
            }
            throw error
        }
    }
}
