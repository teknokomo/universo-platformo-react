/**
 * Script metadata, binding and generated-artifact operations for PlayCanvas.
 *
 * Compilation and artifact persistence are kept together so the asset layer
 * can consume the stable metadata writer without duplicating its logic.
 */
import type {
    PlayCanvasAsset,
    PlayCanvasGeneratedArtifact,
    PlayCanvasSceneScriptBinding,
    PlayCanvasScriptAsset
} from '@universo-react/types'
import { PLAYCANVAS_PROJECT_FILE_ROOT } from '@universo-react/types'

import { compileScriptAssetEsm } from '@universo-react/modules-engine'
import { MetahubModulesService } from '../../modules/services/MetahubModulesService'
import { type DbExecutor } from '@universo-react/utils/database'
import { generateUuidV7 } from '@universo-react/utils'
import { MetahubConflictError, MetahubDomainError, MetahubValidationError } from '../../shared/domainErrors'
import { isUniqueViolation } from '../../shared/errorGuards'

import {
    listPlayCanvasReadyArtifactScriptIds,
    listPlayCanvasScriptAssetsWithSource,
    markPlayCanvasGeneratedArtifactsStale,
    upsertPlayCanvasAsset,
    upsertPlayCanvasGeneratedArtifact,
    upsertPlayCanvasSceneScriptBinding,
    upsertPlayCanvasScriptAsset,
    type PlayCanvasAssetLifecycleMetadataInput
} from './playCanvasProjectsStore'

import { PlayCanvasProjectsServiceScenes } from './playCanvasProjectsServiceScenes'
import {
    assertEditorAssetName,
    assertPlayCanvasAssetMetadata,
    assertPlayCanvasParsedAttributes,
    normalizedEditorAssetPath
} from './playCanvasProjectsServiceHelpers'
import type { PlayCanvasWrittenFile } from './playCanvasProjectsServiceHelpers'

export class PlayCanvasProjectsServiceScripts extends PlayCanvasProjectsServiceScenes {
    async writeAssetMetadata(
        metahubId: string,
        projectId: string,
        input: Omit<PlayCanvasAsset, 'projectId'> & {
            expectedVersion?: number
            /** Internal lifecycle values; generic HTTP requests cannot populate this field. */
            lifecycleMetadata?: PlayCanvasAssetLifecycleMetadataInput
        },
        userId: string,
        executor: DbExecutor = this.exec
    ): Promise<PlayCanvasAsset & { version: number }> {
        if (executor === this.exec) {
            return this.runProjectLifecycleLocked(metahubId, projectId, (lockedExecutor) =>
                this.writeAssetMetadataUnlocked(metahubId, projectId, input, userId, lockedExecutor)
            )
        }
        return this.writeAssetMetadataUnlocked(metahubId, projectId, input, userId, executor)
    }

    protected async writeAssetMetadataUnlocked(
        metahubId: string,
        projectId: string,
        input: Omit<PlayCanvasAsset, 'projectId'> & {
            expectedVersion?: number
            lifecycleMetadata?: PlayCanvasAssetLifecycleMetadataInput
        },
        userId: string,
        executor: DbExecutor
    ): Promise<PlayCanvasAsset & { version: number }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId, executor)
        const name = assertEditorAssetName(input.name)
        const virtualPath = normalizedEditorAssetPath(input.virtualPath)
        const file = this.assertAssetFileReference(projectId, input.type, input.file)
        const metadata = assertPlayCanvasAssetMetadata(input.metadata)
        let asset: (PlayCanvasAsset & { version: number }) | undefined
        try {
            asset = await upsertPlayCanvasAsset(
                executor,
                schemaName,
                projectId,
                { ...input, name, virtualPath, file, metadata, lifecycleMetadata: input.lifecycleMetadata },
                userId
            )
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new MetahubConflictError('A PlayCanvas asset with this path already exists', {
                    messageCode: 'playcanvas.editorCompatibility.assetNameConflict',
                    projectId,
                    path: virtualPath.join('/')
                })
            }
            throw error
        }
        if (!asset) {
            throw this.optimisticError(input.id, input.expectedVersion)
        }
        return asset
    }

    async resolveScriptAsset(
        metahubId: string,
        projectId: string,
        input: PlayCanvasScriptAsset & { expectedVersion?: number },
        userId: string
    ): Promise<PlayCanvasScriptAsset & { version: number }> {
        return this.runProjectLifecycleLocked(metahubId, projectId, (executor) =>
            this.resolveScriptAssetUnlocked(metahubId, projectId, input, userId, executor)
        )
    }

    protected async resolveScriptAssetUnlocked(
        metahubId: string,
        projectId: string,
        input: PlayCanvasScriptAsset & { expectedVersion?: number },
        userId: string,
        executor: DbExecutor
    ): Promise<PlayCanvasScriptAsset & { version: number }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId, executor)
        const parsedAttributes = assertPlayCanvasParsedAttributes(input.parsedAttributes)
        const parseDiagnostics = input.parseDiagnostics == null ? null : assertPlayCanvasAssetMetadata(input.parseDiagnostics)
        const script = await upsertPlayCanvasScriptAsset(
            executor,
            schemaName,
            projectId,
            { ...input, parsedAttributes, parseDiagnostics },
            userId
        )
        if (!script) {
            throw this.optimisticError(input.id, input.expectedVersion)
        }
        return script
    }

    async writeSceneScriptBinding(
        metahubId: string,
        projectId: string,
        input: PlayCanvasSceneScriptBinding & { expectedVersion?: number },
        userId: string
    ): Promise<PlayCanvasSceneScriptBinding & { version: number }> {
        return this.runProjectLifecycleLocked(metahubId, projectId, (executor) =>
            this.writeSceneScriptBindingUnlocked(metahubId, projectId, input, userId, executor)
        )
    }

    protected async writeSceneScriptBindingUnlocked(
        metahubId: string,
        projectId: string,
        input: PlayCanvasSceneScriptBinding & { expectedVersion?: number },
        userId: string,
        executor: DbExecutor
    ): Promise<PlayCanvasSceneScriptBinding & { version: number }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId, executor)
        const binding = await upsertPlayCanvasSceneScriptBinding(executor, schemaName, projectId, input, userId)
        if (!binding) {
            throw this.optimisticError(input.id, input.expectedVersion)
        }
        return binding
    }

    async upsertGeneratedArtifact(
        metahubId: string,
        projectId: string,
        input: PlayCanvasGeneratedArtifact & { expectedVersion?: number },
        userId: string
    ): Promise<PlayCanvasGeneratedArtifact & { version: number }> {
        return this.runProjectLifecycleLocked(metahubId, projectId, (executor) =>
            this.upsertGeneratedArtifactUnlocked(metahubId, projectId, input, userId, executor)
        )
    }

    protected async upsertGeneratedArtifactUnlocked(
        metahubId: string,
        projectId: string,
        input: PlayCanvasGeneratedArtifact & { expectedVersion?: number },
        userId: string,
        executor: DbExecutor
    ): Promise<PlayCanvasGeneratedArtifact & { version: number }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId, executor)
        const outputFile = this.assertGeneratedArtifactFileReference(projectId, input.outputFile)
        const artifact = await upsertPlayCanvasGeneratedArtifact(executor, schemaName, projectId, { ...input, outputFile }, userId)
        if (!artifact) {
            throw this.optimisticError(input.id, input.expectedVersion)
        }
        return artifact
    }

    /**
     * Compiles publication-ready ESM artifacts for every parsed script asset that
     * does not own one yet (editor-authored scripts land here through the realtime
     * parse mirror). Called on the publish path before manifest assembly so the
     * fail-closed manifest builder always finds ready artifacts.
     */
    async ensureGeneratedScriptArtifacts(metahubId: string, projectId: string, userId: string): Promise<{ generated: number }> {
        const writtenArtifacts: PlayCanvasWrittenFile[] = []
        try {
            if (typeof this.exec.transaction !== 'function') {
                return await this.ensureGeneratedScriptArtifactsUnlocked(metahubId, projectId, userId, this.exec, writtenArtifacts)
            }
            return await this.runProjectLifecycleLocked(metahubId, projectId, (tx) =>
                this.ensureGeneratedScriptArtifactsUnlocked(metahubId, projectId, userId, tx, writtenArtifacts)
            )
        } catch (error) {
            await this.cleanupWrittenPlayCanvasFiles(writtenArtifacts, projectId, 'generated script artifact creation')
            throw error
        }
    }

    protected async ensureGeneratedScriptArtifactsUnlocked(
        metahubId: string,
        projectId: string,
        userId: string,
        executor: DbExecutor,
        writtenArtifacts: PlayCanvasWrittenFile[]
    ): Promise<{ generated: number }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId, executor)
        const scriptAssets = await listPlayCanvasScriptAssetsWithSource(executor, schemaName, projectId)
        if (scriptAssets.length === 0) {
            return { generated: 0 }
        }
        const readyArtifactScriptIds = await listPlayCanvasReadyArtifactScriptIds(executor, schemaName, projectId)
        const sharedLibraries = await new MetahubModulesService(executor, this.schemaService).listSharedLibraryCompilationInputs(metahubId)
        const scope = { metahubId, branchSlug: schemaName }
        let generated = 0
        for (const scriptAsset of scriptAssets) {
            if (readyArtifactScriptIds.has(scriptAsset.id)) continue
            if (!scriptAsset.assetFilePath || !scriptAsset.assetFileHash) {
                throw new MetahubValidationError('PlayCanvas script asset source file is missing', {
                    messageCode: 'playcanvas.publish.scriptSourceMissing',
                    projectId,
                    scriptAssetId: scriptAsset.id
                })
            }
            const read = await this.fileService.read(scope, scriptAsset.assetFilePath)
            if (read.checksum !== scriptAsset.assetFileHash) {
                throw new MetahubValidationError('PlayCanvas script asset source checksum mismatch', {
                    messageCode: 'playcanvas.publish.scriptSourceChecksumMismatch',
                    projectId,
                    scriptAssetId: scriptAsset.id
                })
            }
            await markPlayCanvasGeneratedArtifactsStale(executor, schemaName, projectId, scriptAsset.id, read.checksum, userId)
            const compiled = await compileScriptAssetEsm({
                sourceCode: read.content.toString('utf8'),
                diagnosticFileName: `${scriptAsset.scriptName}.mjs`,
                sharedLibraries
            })
            // Generated-artifact ids are persisted in a UUID column. Keep the
            // id opaque and time-ordered like every other platform document;
            // the source/output checksums below provide the deterministic
            // identity needed for freshness checks without inventing a
            // non-UUID pseudo-id.
            const artifactId = generateUuidV7()
            const artifactPath = this.fileService.buildDefaultArtifactPath(
                projectId,
                artifactId,
                scriptAsset.scriptKind === 'esm' ? '.mjs' : '.js'
            )
            const written = await this.fileService.write(scope, artifactPath, compiled.code, {
                expectedChecksum: null,
                expectedCurrentChecksum: null,
                mime: scriptAsset.scriptKind === 'esm' ? 'text/javascript' : 'application/javascript'
            })
            writtenArtifacts.push({ scope, sourcePath: written.sourcePath, checksum: written.checksum, label: scriptAsset.id })
            const outputFile = this.assertGeneratedArtifactFileReference(projectId, {
                provider: 'local',
                root: PLAYCANVAS_PROJECT_FILE_ROOT,
                path: written.sourcePath,
                hash: written.checksum,
                size: written.size,
                mime: written.mime,
                status: 'ready'
            })
            const persisted = await upsertPlayCanvasGeneratedArtifact(
                executor,
                schemaName,
                projectId,
                {
                    id: artifactId,
                    scriptAssetId: scriptAsset.id,
                    sourceModuleId: scriptAsset.moduleId ?? null,
                    sourceModuleCodename: scriptAsset.moduleCodename ?? null,
                    sourceModulePath: scriptAsset.moduleSourcePath ?? null,
                    sourceChecksum: read.checksum,
                    outputFile,
                    scriptName: scriptAsset.scriptName,
                    scriptKind: scriptAsset.scriptKind,
                    parseStatus: 'ready'
                },
                userId
            )
            if (!persisted) {
                throw new MetahubDomainError({
                    message: 'PlayCanvas generated script artifact could not be persisted',
                    statusCode: 503,
                    code: 'SCHEMA_SYNC_FAILED',
                    details: {
                        messageCode: 'playcanvas.publish.scriptArtifactPersistFailed',
                        projectId,
                        scriptAssetId: scriptAsset.id
                    }
                })
            }
            generated += 1
        }
        return { generated }
    }
}
