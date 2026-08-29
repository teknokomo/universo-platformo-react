/**
 * Project-file operations for the PlayCanvas compatibility API.
 *
 * Database metadata is updated together with physical file writes and all
 * rollback primitives are inherited from the shared service context.
 */

import { type DbExecutor } from '@universo-react/utils/database'
import { MetahubConflictError, MetahubValidationError } from '../../shared/domainErrors'

import {
    markPlayCanvasAssetFileReferenceMissing,
    markPlayCanvasAssetFileReferenceReady,
    markPlayCanvasProjectFileReferenceMissing,
    markPlayCanvasProjectFileReferenceReady
} from './playCanvasProjectsStore'

import { PlayCanvasProjectsServiceBase } from './playCanvasProjectsServiceBase'
import { decodeStrictBase64 } from './playCanvasProjectsServiceHelpers'
import { log } from './playCanvasProjectsServiceCommon'

export class PlayCanvasProjectsServiceFileOperations extends PlayCanvasProjectsServiceBase {
    async readProjectFile(
        metahubId: string,
        projectId: string,
        sourcePath: string,
        _userId: string,
        executor: DbExecutor = this.exec
    ): Promise<{ sourcePath: string; checksum: string; size: number; contentBase64: string }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId, executor)
        const safePath = await this.requireProjectMetadataFilePath(schemaName, projectId, sourcePath, executor)
        const read = await this.fileService.read({ metahubId, branchSlug: schemaName }, safePath)
        return {
            sourcePath: read.sourcePath,
            checksum: read.checksum,
            size: read.size,
            contentBase64: read.content.toString('base64')
        }
    }

    async readAssetFile(
        metahubId: string,
        projectId: string,
        assetId: string,
        sourcePath: string,
        _userId: string
    ): Promise<{ sourcePath: string; checksum: string; size: number; contentBase64: string }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        const asset = await this.requireAssetFilePath(schemaName, projectId, assetId, sourcePath)
        const read = await this.fileService.read({ metahubId, branchSlug: schemaName }, sourcePath)
        if (asset.file?.hash && asset.file.hash !== read.checksum) {
            throw new MetahubConflictError('PlayCanvas asset file changed outside the metadata store', {
                messageCode: 'playcanvas.editorCompatibility.assetFileChecksumMismatch',
                projectId,
                assetId,
                expectedCurrentChecksum: asset.file.hash,
                actualCurrentChecksum: read.checksum
            })
        }
        return {
            sourcePath: read.sourcePath,
            checksum: read.checksum,
            size: read.size,
            contentBase64: read.content.toString('base64')
        }
    }

    async writeProjectFile(
        metahubId: string,
        projectId: string,
        input: {
            sourcePath: string
            contentBase64: string
            expectedChecksum?: string | null
            expectedCurrentChecksum: string | null
            mime?: string | null
        },
        userId: string
    ): Promise<{ sourcePath: string; checksum: string; size: number; mime: string | null }> {
        return this.runProjectLifecycleLocked(metahubId, projectId, (executor) =>
            this.writeProjectFileUnlocked(metahubId, projectId, input, userId, executor)
        )
    }

    protected async writeProjectFileUnlocked(
        metahubId: string,
        projectId: string,
        input: {
            sourcePath: string
            contentBase64: string
            expectedChecksum?: string | null
            expectedCurrentChecksum: string | null
            mime?: string | null
        },
        userId: string,
        executor: DbExecutor
    ): Promise<{ sourcePath: string; checksum: string; size: number; mime: string | null }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId, executor)
        const safePath = await this.requireProjectMetadataFilePath(schemaName, projectId, input.sourcePath, executor)
        const content = decodeStrictBase64(input.contentBase64)
        const scope = { metahubId, branchSlug: schemaName }
        const previous = await this.readFileForRollback(scope, safePath)
        const written = await this.fileService.write(scope, safePath, content, {
            expectedChecksum: input.expectedChecksum,
            expectedCurrentChecksum: input.expectedCurrentChecksum,
            mime: input.mime
        })
        try {
            const marked = await markPlayCanvasProjectFileReferenceReady(executor, schemaName, projectId, safePath, written, userId)
            if (!marked) {
                throw this.metadataUpdateError(projectId, safePath)
            }
        } catch (error) {
            await this.rollbackFileWrite(scope, safePath, written.checksum, previous, input.mime)
            throw error
        }
        return {
            sourcePath: written.sourcePath,
            checksum: written.checksum,
            size: written.size,
            mime: written.mime
        }
    }

    async writeAssetFile(
        metahubId: string,
        projectId: string,
        assetId: string,
        input: {
            sourcePath: string
            contentBase64: string
            expectedChecksum?: string | null
            expectedCurrentChecksum: string | null
            mime?: string | null
        },
        userId: string
    ): Promise<{ sourcePath: string; checksum: string; size: number; mime: string | null }> {
        return this.runProjectLifecycleLocked(metahubId, projectId, (executor) =>
            this.writeAssetFileUnlocked(metahubId, projectId, assetId, input, userId, executor)
        )
    }

    protected async writeAssetFileUnlocked(
        metahubId: string,
        projectId: string,
        assetId: string,
        input: {
            sourcePath: string
            contentBase64: string
            expectedChecksum?: string | null
            expectedCurrentChecksum: string | null
            mime?: string | null
        },
        userId: string,
        executor: DbExecutor
    ): Promise<{ sourcePath: string; checksum: string; size: number; mime: string | null }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireAssetFilePath(schemaName, projectId, assetId, input.sourcePath, executor)
        const content = decodeStrictBase64(input.contentBase64)
        const scope = { metahubId, branchSlug: schemaName }
        const previous = await this.readFileForRollback(scope, input.sourcePath)
        const written = await this.fileService.write(scope, input.sourcePath, content, {
            expectedChecksum: input.expectedChecksum,
            expectedCurrentChecksum: input.expectedCurrentChecksum,
            mime: input.mime
        })
        try {
            const marked = await markPlayCanvasAssetFileReferenceReady(
                executor,
                schemaName,
                projectId,
                assetId,
                input.sourcePath,
                written,
                userId
            )
            if (!marked) {
                throw this.metadataUpdateError(projectId, input.sourcePath)
            }
        } catch (error) {
            await this.rollbackFileWrite(scope, input.sourcePath, written.checksum, previous, input.mime)
            throw error
        }
        return {
            sourcePath: written.sourcePath,
            checksum: written.checksum,
            size: written.size,
            mime: written.mime
        }
    }

    async deleteProjectFile(
        metahubId: string,
        projectId: string,
        sourcePath: string,
        expectedCurrentChecksum: string,
        userId: string
    ): Promise<void> {
        return this.runProjectLifecycleLocked(metahubId, projectId, (executor) =>
            this.deleteProjectFileUnlocked(metahubId, projectId, sourcePath, expectedCurrentChecksum, userId, executor)
        )
    }

    protected async deleteProjectFileUnlocked(
        metahubId: string,
        projectId: string,
        sourcePath: string,
        expectedCurrentChecksum: string,
        userId: string,
        executor: DbExecutor
    ): Promise<void> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId, executor)
        const safePath = await this.requireProjectMetadataFilePath(schemaName, projectId, sourcePath, executor)
        const scope = { metahubId, branchSlug: schemaName }
        const previous = await this.readFileForRollback(scope, safePath)
        const markedMissing = await markPlayCanvasProjectFileReferenceMissing(executor, schemaName, projectId, safePath, userId)
        if (!markedMissing) {
            throw this.metadataUpdateError(projectId, safePath)
        }
        try {
            const deleted = await this.fileService.deleteIfCurrentChecksum(scope, safePath, expectedCurrentChecksum)
            if (!deleted) {
                throw new MetahubValidationError('Current file checksum does not match', {
                    messageCode: 'playcanvas.files.path.currentChecksumMismatch',
                    expectedCurrentChecksum,
                    sourcePath: safePath
                })
            }
        } catch (error) {
            if (previous.exists) {
                const restored = await markPlayCanvasProjectFileReferenceReady(
                    executor,
                    schemaName,
                    projectId,
                    safePath,
                    { ...previous.file, mime: null },
                    userId
                )
                if (!restored) {
                    log.warn('Failed to restore PlayCanvas project file metadata after physical delete failure', {
                        metahubId,
                        schemaName,
                        projectId,
                        sourcePath: safePath
                    })
                }
            }
            throw error
        }
    }

    async deleteAssetFile(
        metahubId: string,
        projectId: string,
        assetId: string,
        sourcePath: string,
        expectedCurrentChecksum: string,
        userId: string
    ): Promise<void> {
        return this.runProjectLifecycleLocked(metahubId, projectId, (executor) =>
            this.deleteAssetFileUnlocked(metahubId, projectId, assetId, sourcePath, expectedCurrentChecksum, userId, executor)
        )
    }

    protected async deleteAssetFileUnlocked(
        metahubId: string,
        projectId: string,
        assetId: string,
        sourcePath: string,
        expectedCurrentChecksum: string,
        userId: string,
        executor: DbExecutor
    ): Promise<void> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireAssetFilePath(schemaName, projectId, assetId, sourcePath, executor)
        const scope = { metahubId, branchSlug: schemaName }
        const previous = await this.readFileForRollback(scope, sourcePath)
        const markedMissing = await markPlayCanvasAssetFileReferenceMissing(executor, schemaName, projectId, assetId, sourcePath, userId)
        if (!markedMissing) {
            throw this.metadataUpdateError(projectId, sourcePath)
        }
        try {
            const deleted = await this.fileService.deleteIfCurrentChecksum(scope, sourcePath, expectedCurrentChecksum)
            if (!deleted) {
                throw new MetahubValidationError('Current file checksum does not match', {
                    messageCode: 'playcanvas.files.path.currentChecksumMismatch',
                    expectedCurrentChecksum,
                    sourcePath
                })
            }
        } catch (error) {
            if (previous.exists) {
                const restored = await markPlayCanvasAssetFileReferenceReady(
                    executor,
                    schemaName,
                    projectId,
                    assetId,
                    sourcePath,
                    { ...previous.file, mime: null },
                    userId
                )
                if (!restored) {
                    log.warn('Failed to restore PlayCanvas asset file metadata after physical delete failure', {
                        metahubId,
                        schemaName,
                        projectId,
                        assetId,
                        sourcePath
                    })
                }
            }
            throw error
        }
    }
}
