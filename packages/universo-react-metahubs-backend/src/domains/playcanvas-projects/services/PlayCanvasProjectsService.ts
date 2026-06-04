import type {
    CreatePlayCanvasProjectRequest,
    PlayCanvasAsset,
    PlayCanvasGeneratedArtifact,
    PlayCanvasFileReference,
    PlayCanvasProjectSummary,
    PlayCanvasRuntimeManifest,
    PlayCanvasScene,
    PlayCanvasSceneScriptBinding,
    PlayCanvasScriptAsset,
    UpdatePlayCanvasProjectSettingsRequest
} from '@universo-react/types'
import {
    PLAYCANVAS_PROJECT_FILE_ROOT,
    isPlayCanvasAssetFileReference,
    isPlayCanvasGeneratedArtifactFileReference,
    isPlayCanvasJsonFileReference,
    isPlayCanvasScenePayloadFileReference,
    isPlayCanvasScriptFileReference
} from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import { createCodenameVLC, OptimisticLockError } from '@universo-react/utils'
import type { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubValidationError } from '../../shared/domainErrors'
import { createLogger } from '../../../utils/logger'
import {
    assertPlayCanvasProjectMimeForPath,
    assertSafeRelativePlayCanvasProjectPath,
    PlayCanvasProjectFileService
} from './PlayCanvasProjectFileService'
import type { PlayCanvasProjectFileReadResult, PlayCanvasProjectFileScope } from './PlayCanvasProjectFileService'
import { PlayCanvasProjectSnapshotService } from './PlayCanvasProjectSnapshotService'
import {
    clearPlayCanvasDefaultProjectPointers,
    createPlayCanvasProject,
    findPlayCanvasAsset,
    findPlayCanvasProject,
    findPlayCanvasScene,
    listPlayCanvasProjects,
    listPlayCanvasAssets,
    listPlayCanvasScenes,
    markPlayCanvasAssetFileReferenceMissing,
    markPlayCanvasAssetFileReferenceReady,
    markPlayCanvasProjectFileReferenceMissing,
    markPlayCanvasProjectFileReferenceReady,
    playCanvasProjectMetadataFileReferenceExists,
    playCanvasProjectCodenameExists,
    restoreSoftDeletedPlayCanvasProject,
    softDeletePlayCanvasProject,
    summarizePlayCanvasProject,
    updatePlayCanvasProject,
    upsertPlayCanvasAsset,
    upsertPlayCanvasGeneratedArtifact,
    upsertPlayCanvasScene,
    upsertPlayCanvasSceneScriptBinding,
    upsertPlayCanvasScriptAsset
} from './playCanvasProjectsStore'

const log = createLogger('PlayCanvasProjectsService')
const STRICT_BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

const slugifyProjectName = (value: string): string => {
    const normalized = value
        .normalize('NFKD')
        .toLowerCase()
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80)
    return normalized || 'playcanvas_project'
}

const getPrimaryText = (value: CreatePlayCanvasProjectRequest['displayName']): string => {
    const primary = value._primary
    const primaryValue = value.locales?.[primary]?.content
    if (typeof primaryValue === 'string' && primaryValue.trim()) return primaryValue.trim()
    const first = Object.values(value.locales ?? {}).find((entry) => typeof entry?.content === 'string' && entry.content.trim())
    return typeof first?.content === 'string' ? first.content.trim() : 'PlayCanvas Project'
}

const decodeStrictBase64 = (value: string): Buffer => {
    if (!STRICT_BASE64_PATTERN.test(value)) {
        throw new MetahubValidationError('PlayCanvas project file content must be canonical base64', {
            messageCode: 'playcanvas.files.base64.invalid'
        })
    }
    return Buffer.from(value, 'base64')
}

export class PlayCanvasProjectsService {
    constructor(
        private readonly exec: DbExecutor,
        private readonly schemaService: MetahubSchemaService,
        private readonly fileService = new PlayCanvasProjectFileService()
    ) {}

    private async resolveSchemaName(metahubId: string): Promise<string> {
        return this.schemaService.ensureSchema(metahubId)
    }

    private metadataUpdateError(projectId: string, sourcePath: string): MetahubValidationError {
        return new MetahubValidationError('PlayCanvas project file metadata reference was not updated', {
            messageCode: 'playcanvas.files.metadataUpdateFailed',
            projectId,
            sourcePath
        })
    }

    async listProjects(metahubId: string, _userId: string): Promise<PlayCanvasProjectSummary[]> {
        const schemaName = await this.resolveSchemaName(metahubId)
        const rows = await listPlayCanvasProjects(this.exec, schemaName)
        return Promise.all(rows.map((row) => summarizePlayCanvasProject(this.exec, schemaName, row)))
    }

    async getProject(metahubId: string, projectId: string, _userId: string): Promise<PlayCanvasProjectSummary> {
        const schemaName = await this.resolveSchemaName(metahubId)
        const row = await findPlayCanvasProject(this.exec, schemaName, projectId)
        if (!row) {
            throw new MetahubValidationError('PlayCanvas project was not found', {
                messageCode: 'playcanvas.projects.notFound',
                projectId
            })
        }
        return summarizePlayCanvasProject(this.exec, schemaName, row)
    }

    async createProject(metahubId: string, input: CreatePlayCanvasProjectRequest, userId: string): Promise<PlayCanvasProjectSummary> {
        const schemaName = await this.resolveSchemaName(metahubId)
        const codename =
            input.codename ??
            (await this.createUniqueProjectCodename(
                schemaName,
                input.displayName._primary,
                slugifyProjectName(getPrimaryText(input.displayName))
            ))
        const row = await createPlayCanvasProject(
            this.exec,
            schemaName,
            {
                codename,
                displayName: input.displayName,
                description: input.description ?? null,
                packageVersion: input.packageVersion ?? null,
                settings: {}
            },
            userId
        )
        return summarizePlayCanvasProject(this.exec, schemaName, row)
    }

    private async createUniqueProjectCodename(
        schemaName: string,
        locale: string,
        baseCodename: string
    ): Promise<NonNullable<CreatePlayCanvasProjectRequest['codename']>> {
        for (let index = 0; index < 100; index += 1) {
            const candidate = index === 0 ? baseCodename : `${baseCodename}-${index + 1}`
            if (!(await playCanvasProjectCodenameExists(this.exec, schemaName, candidate))) {
                return createCodenameVLC(locale, candidate)
            }
        }
        throw new MetahubValidationError('PlayCanvas project codename is not unique', {
            messageCode: 'playcanvas.project.codenameNotUnique',
            codename: baseCodename
        })
    }

    async listScenes(metahubId: string, projectId: string, _userId: string): Promise<(PlayCanvasScene & { version: number })[]> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        return listPlayCanvasScenes(this.exec, schemaName, projectId)
    }

    async getScene(metahubId: string, projectId: string, sceneId: string, _userId: string): Promise<PlayCanvasScene & { version: number }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        const scene = await findPlayCanvasScene(this.exec, schemaName, projectId, sceneId)
        if (!scene) {
            throw new MetahubValidationError('PlayCanvas scene was not found', {
                messageCode: 'playcanvas.scenes.notFound',
                sceneId
            })
        }
        return scene
    }

    async writeScene(
        metahubId: string,
        projectId: string,
        input: Omit<PlayCanvasScene, 'projectId'> & { expectedVersion?: number },
        userId: string
    ): Promise<PlayCanvasScene & { version: number }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const payloadFile = this.assertScenePayloadFileReference(projectId, input.payloadFile)
        const scene = await upsertPlayCanvasScene(this.exec, schemaName, projectId, { ...input, payloadFile }, userId)
        if (!scene) {
            throw this.optimisticError(input.id, input.expectedVersion)
        }
        return scene
    }

    async listAssets(metahubId: string, projectId: string, _userId: string): Promise<(PlayCanvasAsset & { version: number })[]> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        return listPlayCanvasAssets(this.exec, schemaName, projectId)
    }

    async writeAssetMetadata(
        metahubId: string,
        projectId: string,
        input: Omit<PlayCanvasAsset, 'projectId'> & { expectedVersion?: number },
        userId: string
    ): Promise<PlayCanvasAsset & { version: number }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const file = this.assertAssetFileReference(projectId, input.type, input.file)
        const asset = await upsertPlayCanvasAsset(this.exec, schemaName, projectId, { ...input, file }, userId)
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
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const script = await upsertPlayCanvasScriptAsset(this.exec, schemaName, projectId, input, userId)
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
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const binding = await upsertPlayCanvasSceneScriptBinding(this.exec, schemaName, projectId, input, userId)
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
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const outputFile = this.assertGeneratedArtifactFileReference(projectId, input.outputFile)
        const artifact = await upsertPlayCanvasGeneratedArtifact(this.exec, schemaName, projectId, { ...input, outputFile }, userId)
        if (!artifact) {
            throw this.optimisticError(input.id, input.expectedVersion)
        }
        return artifact
    }

    async publishProjectState(metahubId: string, projectId: string, _userId: string): Promise<PlayCanvasRuntimeManifest[]> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const snapshot = await new PlayCanvasProjectSnapshotService(this.exec, this.schemaService, this.fileService).exportProjectSnapshot(
            metahubId,
            projectId
        )
        return snapshot?.runtimeManifests ?? []
    }

    async exportProjectState(metahubId: string, projectId: string, _userId: string) {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const snapshot = await new PlayCanvasProjectSnapshotService(this.exec, this.schemaService, this.fileService).exportSnapshot(
            metahubId,
            { projectIds: [projectId] }
        )
        if (!snapshot) return null
        return snapshot
    }

    async updateProjectSettings(
        metahubId: string,
        projectId: string,
        input: UpdatePlayCanvasProjectSettingsRequest & { expectedVersion?: number },
        userId: string
    ): Promise<PlayCanvasProjectSummary> {
        const schemaName = await this.resolveSchemaName(metahubId)
        if (input.defaultSceneId) {
            const scene = await findPlayCanvasScene(this.exec, schemaName, projectId, input.defaultSceneId)
            if (!scene) {
                throw new MetahubValidationError('PlayCanvas default scene was not found', {
                    messageCode: 'playcanvas.project.defaultSceneNotFound',
                    projectId,
                    sceneId: input.defaultSceneId
                })
            }
        }
        const updated = await updatePlayCanvasProject(this.exec, schemaName, projectId, input, userId)
        if (!updated) {
            throw new OptimisticLockError({
                entityId: projectId,
                entityType: 'playcanvasProject',
                expectedVersion: input.expectedVersion ?? 0,
                actualVersion: 0,
                updatedAt: new Date(0),
                updatedBy: null
            })
        }
        return summarizePlayCanvasProject(this.exec, schemaName, updated)
    }

    async deleteProject(
        metahubId: string,
        projectId: string,
        input: { expectedVersion: number },
        userId: string
    ): Promise<PlayCanvasProjectSummary> {
        const schemaName = await this.resolveSchemaName(metahubId)
        const deleted = await softDeletePlayCanvasProject(this.exec, schemaName, projectId, userId, input.expectedVersion)
        if (!deleted) {
            throw new OptimisticLockError({
                entityId: projectId,
                entityType: 'playcanvasProject',
                expectedVersion: input.expectedVersion ?? 0,
                actualVersion: 0,
                updatedAt: new Date(0),
                updatedBy: null
            })
        }
        let clearedPackagePointers: Array<{ id: string; config: Record<string, unknown> }> = []
        let fileCleanupStarted = false
        try {
            clearedPackagePointers = await clearPlayCanvasDefaultProjectPointers(this.exec, metahubId, projectId, userId)
            fileCleanupStarted = true
            await this.fileService.deleteProjectTree({ metahubId, branchSlug: schemaName }, projectId)
        } catch (error) {
            if (!fileCleanupStarted) {
                await restoreSoftDeletedPlayCanvasProject(this.exec, schemaName, projectId, userId, deleted.deletionToken).catch(
                    (rollbackError) => {
                        log.warn('Failed to roll back PlayCanvas project metadata after package default pointer cleanup failure', {
                            metahubId,
                            schemaName,
                            projectId,
                            error: rollbackError
                        })
                    }
                )
                throw error
            }
            if (clearedPackagePointers.length > 0) {
                log.warn(
                    'PlayCanvas package default project pointers were cleared and will remain cleared because project file cleanup may be partial',
                    {
                        metahubId,
                        projectId,
                        clearedPackagePointerCount: clearedPackagePointers.length
                    }
                )
            }
            log.warn(
                'PlayCanvas project file cleanup failed after metadata was soft-deleted; leaving project deleted to avoid live metadata pointing at partially removed files',
                {
                    metahubId,
                    schemaName,
                    projectId,
                    error
                }
            )
            throw error
        }
        return summarizePlayCanvasProject(this.exec, schemaName, deleted)
    }

    async readProjectFile(
        metahubId: string,
        projectId: string,
        sourcePath: string,
        _userId: string
    ): Promise<{ sourcePath: string; checksum: string; size: number; contentBase64: string }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const safePath = await this.requireProjectMetadataFilePath(schemaName, projectId, sourcePath)
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
        await this.requireAssetFilePath(schemaName, projectId, assetId, sourcePath)
        const read = await this.fileService.read({ metahubId, branchSlug: schemaName }, sourcePath)
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
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const safePath = await this.requireProjectMetadataFilePath(schemaName, projectId, input.sourcePath)
        const content = decodeStrictBase64(input.contentBase64)
        const scope = { metahubId, branchSlug: schemaName }
        const previous = await this.readFileForRollback(scope, safePath)
        const written = await this.fileService.write(scope, safePath, content, {
            expectedChecksum: input.expectedChecksum,
            expectedCurrentChecksum: input.expectedCurrentChecksum,
            mime: input.mime
        })
        try {
            const marked = await markPlayCanvasProjectFileReferenceReady(this.exec, schemaName, projectId, safePath, written, userId)
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
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireAssetFilePath(schemaName, projectId, assetId, input.sourcePath)
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
                this.exec,
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

    async deleteProjectFile(metahubId: string, projectId: string, sourcePath: string, userId: string): Promise<void> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const safePath = await this.requireProjectMetadataFilePath(schemaName, projectId, sourcePath)
        const scope = { metahubId, branchSlug: schemaName }
        const previous = await this.readFileForRollback(scope, safePath)
        const markedMissing = await markPlayCanvasProjectFileReferenceMissing(this.exec, schemaName, projectId, safePath, userId)
        if (!markedMissing) {
            throw this.metadataUpdateError(projectId, safePath)
        }
        try {
            await this.fileService.delete(scope, safePath)
        } catch (error) {
            if (previous.exists) {
                const restored = await markPlayCanvasProjectFileReferenceReady(
                    this.exec,
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

    async deleteAssetFile(metahubId: string, projectId: string, assetId: string, sourcePath: string, userId: string): Promise<void> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireAssetFilePath(schemaName, projectId, assetId, sourcePath)
        const scope = { metahubId, branchSlug: schemaName }
        const previous = await this.readFileForRollback(scope, sourcePath)
        const markedMissing = await markPlayCanvasAssetFileReferenceMissing(this.exec, schemaName, projectId, assetId, sourcePath, userId)
        if (!markedMissing) {
            throw this.metadataUpdateError(projectId, sourcePath)
        }
        try {
            await this.fileService.delete(scope, sourcePath)
        } catch (error) {
            if (previous.exists) {
                const restored = await markPlayCanvasAssetFileReferenceReady(
                    this.exec,
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

    private async requireProject(schemaName: string, projectId: string): Promise<void> {
        const existing = await findPlayCanvasProject(this.exec, schemaName, projectId)
        if (!existing) {
            throw new MetahubValidationError('PlayCanvas project was not found', {
                messageCode: 'playcanvas.projects.notFound',
                projectId
            })
        }
    }

    private assertProjectPath(projectId: string, sourcePath: string): string {
        const safePath = assertSafeRelativePlayCanvasProjectPath(sourcePath)
        if (!safePath.startsWith(`playcanvas-projects/${projectId}/`)) {
            throw new MetahubValidationError('PlayCanvas project file path must belong to the requested project', {
                messageCode: 'playcanvas.files.path.projectMismatch'
            })
        }
        return safePath
    }

    private assertProjectSubdirectoryPath(projectId: string, sourcePath: string, subdirectory: 'assets' | 'generated' | 'scenes'): void {
        if (!sourcePath.startsWith(`playcanvas-projects/${projectId}/${subdirectory}/`)) {
            throw new MetahubValidationError('PlayCanvas project file path does not match the required storage role', {
                messageCode: `playcanvas.files.role.${subdirectory}PathMismatch`
            })
        }
    }

    private async requireProjectMetadataFilePath(schemaName: string, projectId: string, sourcePath: string): Promise<string> {
        const safePath = this.assertProjectPath(projectId, sourcePath)
        const exists = await playCanvasProjectMetadataFileReferenceExists(this.exec, schemaName, projectId, safePath)
        if (!exists) {
            throw new MetahubValidationError('PlayCanvas project file path must be referenced by scene or generated artifact metadata', {
                messageCode: 'playcanvas.files.path.untracked'
            })
        }
        return safePath
    }

    private assertFileReference<T extends { provider?: string; root?: string; path?: string; mime?: string | null }>(
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

    private assertScenePayloadFileReference(
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

    private assertAssetFileReference(
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
        if (
            !['scene', 'json', 'script', 'generatedScript'].includes(assetType) &&
            !isPlayCanvasJsonFileReference({ path: checked.path ?? '', mime: checked.mime })
        ) {
            throw new MetahubValidationError('PlayCanvas non-script sidecar assets must reference JSON files in this storage slice', {
                messageCode: 'playcanvas.files.role.assetSidecarMismatch',
                assetType
            })
        }
        return checked
    }

    private assertGeneratedArtifactFileReference(
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

    private async requireAssetFilePath(schemaName: string, projectId: string, assetId: string, sourcePath: string): Promise<void> {
        await this.requireProject(schemaName, projectId)
        this.assertProjectPath(projectId, sourcePath)
        const asset = await findPlayCanvasAsset(this.exec, schemaName, projectId, assetId)
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
    }

    private optimisticError(entityId: string, expectedVersion?: number): OptimisticLockError {
        return new OptimisticLockError({
            entityId,
            entityType: 'playcanvasProject',
            expectedVersion: expectedVersion ?? 0,
            actualVersion: 0,
            updatedAt: new Date(0),
            updatedBy: null
        })
    }

    private async readFileForRollback(
        scope: PlayCanvasProjectFileScope,
        sourcePath: string
    ): Promise<{ exists: true; file: PlayCanvasProjectFileReadResult } | { exists: false }> {
        const stat = await this.fileService.stat(scope, sourcePath)
        if (!stat.exists) {
            return { exists: false }
        }
        return { exists: true, file: await this.fileService.read(scope, sourcePath) }
    }

    private async rollbackFileWrite(
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
        await this.fileService.delete(scope, sourcePath)
    }
}
