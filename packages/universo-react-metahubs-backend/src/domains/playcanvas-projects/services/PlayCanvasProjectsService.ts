import { createHash } from 'node:crypto'
import type {
    CreatePlayCanvasProjectRequest,
    PlayCanvasAsset,
    PlayCanvasGeneratedArtifact,
    PlayCanvasFileReference,
    PlayCanvasEditorCompatibilityProtocolDescriptor,
    PlayCanvasEditorCompatibilitySettingsDocument,
    PlayCanvasEditorMinimalAssetMetadata,
    PlayCanvasEditorScenePayload,
    PlayCanvasProjectSummary,
    PlayCanvasRuntimeManifest,
    PlayCanvasScene,
    PlayCanvasSceneScriptBinding,
    PlayCanvasScriptAsset,
    UpdatePlayCanvasProjectSettingsRequest
} from '@universo-react/types'
import {
    PLAYCANVAS_EDITOR_BRIDGE_SESSION_TTL_MS,
    PLAYCANVAS_EDITOR_COMPATIBILITY_MODE,
    PLAYCANVAS_EDITOR_COMPATIBILITY_VERSION,
    PLAYCANVAS_PROJECT_FILE_ROOT,
    PLAYCANVAS_PROJECT_SCHEMA_VERSION,
    isPlayCanvasAssetFileReference,
    isPlayCanvasGeneratedArtifactFileReference,
    isPlayCanvasJsonFileReference,
    isPlayCanvasScenePayloadFileReference,
    isPlayCanvasScriptFileReference,
    playCanvasEditorCompatibilityProtocolDescriptorSchema,
    playCanvasEditorCompatibilitySettingsDocumentSchema
} from '@universo-react/types'
import { playCanvasEditorScenePayloadSchema } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import { createCodenameVLC, createLocalizedContent, generateUuidV7, OptimisticLockError } from '@universo-react/utils'
import stableStringify from 'json-stable-stringify'
import type { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubConflictError, MetahubDomainError, MetahubValidationError } from '../../shared/domainErrors'
import { createLogger } from '../../../utils/logger'
import {
    assertPlayCanvasProjectMimeForPath,
    assertSafeRelativePlayCanvasProjectPath,
    PlayCanvasProjectFileService
} from './PlayCanvasProjectFileService'
import type { PlayCanvasProjectFileReadResult, PlayCanvasProjectFileScope } from './PlayCanvasProjectFileService'
import { PlayCanvasEditorBridgeSessionService } from './PlayCanvasEditorBridgeSessionService'
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
    listPlayCanvasProjectCodenamesByPrefix,
    restoreSoftDeletedPlayCanvasProject,
    softDeletePlayCanvasProject,
    softDeletePlayCanvasScene,
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
const COMPATIBILITY_SETTINGS_KEY = 'playCanvasEditorCompatibility'
const COMPATIBILITY_SCENE_SAVE_COMMAND_TYPE = 'compatibility.scene.save'
const COMPATIBILITY_SETTINGS_WRITE_COMMAND_TYPE = 'compatibility.settings.write'

type CompatibilitySettingsKind = PlayCanvasEditorCompatibilitySettingsDocument['kind']

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const settingsDocumentId = (kind: CompatibilitySettingsKind, projectId: string, userId: string): string => {
    switch (kind) {
        case 'user':
            return `user_${userId}`
        case 'projectUser':
            return `project_${projectId}_${userId}`
        case 'projectPrivate':
            return `project-private_${projectId}`
    }
}

const hashEditorCompatibilityReplayFingerprint = (value: unknown): string =>
    createHash('sha256')
        .update(stableStringify(value) ?? JSON.stringify(value))
        .digest('hex')

const compatibilitySceneSaveSessionId = (input: { metahubId: string; projectId: string; sceneId: string; userId: string }): string =>
    `compatibility:${input.metahubId}:${input.projectId}:${input.sceneId}:${input.userId}`

const compatibilitySettingsWriteSessionId = (input: {
    metahubId: string
    projectId: string
    kind: CompatibilitySettingsKind
    userId: string
}): string => `compatibility:${input.metahubId}:${input.projectId}:settings:${input.kind}:${input.userId}`

const isEditorCompatibilitySceneSaveResult = (
    value: unknown
): value is { scene: PlayCanvasScene & { version: number }; payload: PlayCanvasEditorScenePayload | null; checksum: string | null } => {
    if (!value || typeof value !== 'object') return false
    const record = value as Record<string, unknown>
    const scene = record.scene as Record<string, unknown> | undefined
    return (
        !!scene &&
        typeof scene === 'object' &&
        typeof scene.id === 'string' &&
        (record.payload === null || typeof record.payload === 'object') &&
        (record.checksum === null || typeof record.checksum === 'string')
    )
}

const isEditorCompatibilitySettingsWriteResult = (value: unknown): value is PlayCanvasEditorCompatibilitySettingsDocument =>
    playCanvasEditorCompatibilitySettingsDocumentSchema.safeParse(value).success

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

    async loadSelectedProjectForEditor(metahubId: string, projectId: string, userId: string): Promise<PlayCanvasProjectSummary> {
        const schemaName = await this.resolveSchemaName(metahubId)
        let row = await findPlayCanvasProject(this.exec, schemaName, projectId)
        if (!row) {
            throw new MetahubValidationError('PlayCanvas project was not found', {
                messageCode: 'playcanvas.projects.notFound',
                projectId
            })
        }
        if (row.defaultSceneId) {
            return summarizePlayCanvasProject(this.exec, schemaName, row)
        }

        const sceneId = row.id
        let scene = await findPlayCanvasScene(this.exec, schemaName, row.id, sceneId)
        if (!scene) {
            scene =
                (await upsertPlayCanvasScene(
                    this.exec,
                    schemaName,
                    row.id,
                    {
                        id: sceneId,
                        codename: createCodenameVLC('en', 'main-scene'),
                        displayName: createLocalizedContent('en', 'Main Scene'),
                        payloadSchemaVersion: PLAYCANVAS_PROJECT_SCHEMA_VERSION,
                        payload: {
                            schemaVersion: PLAYCANVAS_PROJECT_SCHEMA_VERSION,
                            entities: []
                        },
                        payloadFile: null,
                        checksum: null,
                        sortOrder: 0,
                        publish: true
                    },
                    userId
                )) ?? (await findPlayCanvasScene(this.exec, schemaName, row.id, sceneId))
        }
        if (!scene) {
            throw new MetahubValidationError('PlayCanvas project default scene could not be initialized', {
                messageCode: 'playcanvas.projectDefaultSceneInitFailed',
                projectId
            })
        }

        row = (await findPlayCanvasProject(this.exec, schemaName, projectId)) ?? row
        if (row.defaultSceneId) {
            return summarizePlayCanvasProject(this.exec, schemaName, row)
        }

        const updated = await updatePlayCanvasProject(
            this.exec,
            schemaName,
            row.id,
            {
                defaultSceneId: scene.id,
                expectedVersion: row.version
            },
            userId
        )
        if (updated) {
            return summarizePlayCanvasProject(this.exec, schemaName, updated)
        }

        const latest = await findPlayCanvasProject(this.exec, schemaName, projectId)
        if (latest?.defaultSceneId) {
            return summarizePlayCanvasProject(this.exec, schemaName, latest)
        }
        throw this.optimisticError(row.id, row.version)
    }

    async describeEditorCompatibilityProtocol(
        metahubId: string,
        projectId: string,
        userId: string
    ): Promise<PlayCanvasEditorCompatibilityProtocolDescriptor> {
        const project = await this.getProject(metahubId, projectId, userId)
        const defaultSceneId = project.defaultSceneId ?? null
        const disabledSurface = {
            status: 'disabled' as const,
            reason: 'notRequiredForUniversoBridgeMinimal'
        }
        const stubbedSurface = {
            status: 'stubbed' as const,
            reason: 'cloudOnlySurfaceOutsideFirstSlice'
        }
        const branchId = defaultSceneId ?? project.id

        return playCanvasEditorCompatibilityProtocolDescriptorSchema.parse({
            schemaVersion: PLAYCANVAS_EDITOR_COMPATIBILITY_VERSION,
            mode: PLAYCANVAS_EDITOR_COMPATIBILITY_MODE,
            upstream: {
                repository: 'https://github.com/playcanvas/editor',
                minimumTag: 'v2.23.4'
            },
            project,
            defaultSceneId,
            identity: {
                self: {
                    id: userId,
                    role: 'designer'
                },
                owner: {
                    id: metahubId,
                    type: 'metahub'
                },
                permissions: {
                    read: true,
                    write: true,
                    admin: false
                },
                branch: {
                    id: branchId,
                    name: 'Main',
                    active: true
                },
                teams: [],
                organizations: []
            },
            endpoints: {
                rest: disabledSurface,
                realtime: disabledSurface,
                messenger: disabledSurface
            },
            shareDb: {
                requiredCollections: ['scenes', 'assets', 'settings'],
                persisted: false,
                persistence: 'not-implemented',
                sceneStorage: 'metahub-playcanvas-project-storage'
            },
            cloudOnly: {
                store: stubbedSurface,
                jobs: stubbedSurface,
                branchesCheckpoints: stubbedSurface,
                sourcefiles: stubbedSurface,
                publishing: stubbedSurface,
                usersCollaboration: stubbedSurface,
                assetPipeline: stubbedSurface
            },
            documents: {
                codeEditorSourcefiles: {
                    status: 'unsupported',
                    reason: 'codeEditorSourcefilesOutsideFirstSlice'
                }
            },
            settingsDocuments: {
                user: `user_${userId}`,
                projectUser: `project_${project.id}_${userId}`,
                projectPrivate: `project-private_${project.id}`
            }
        })
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
        const sceneId = generateUuidV7()
        const scene = await upsertPlayCanvasScene(
            this.exec,
            schemaName,
            row.id,
            {
                id: sceneId,
                codename: createCodenameVLC(input.displayName._primary, 'main-scene'),
                displayName: createLocalizedContent(input.displayName._primary, 'Main Scene'),
                payloadSchemaVersion: PLAYCANVAS_PROJECT_SCHEMA_VERSION,
                payload: {
                    schemaVersion: PLAYCANVAS_PROJECT_SCHEMA_VERSION,
                    entities: []
                },
                payloadFile: null,
                checksum: null,
                sortOrder: 0,
                publish: true
            },
            userId
        )
        const updated = await updatePlayCanvasProject(
            this.exec,
            schemaName,
            row.id,
            {
                defaultSceneId: scene.id,
                expectedVersion: row.version
            },
            userId
        )
        if (!updated) {
            throw this.optimisticError(row.id, row.version)
        }
        return summarizePlayCanvasProject(this.exec, schemaName, updated)
    }

    private async createUniqueProjectCodename(
        schemaName: string,
        locale: string,
        baseCodename: string
    ): Promise<NonNullable<CreatePlayCanvasProjectRequest['codename']>> {
        const existingCodenames = new Set(await listPlayCanvasProjectCodenamesByPrefix(this.exec, schemaName, baseCodename))
        for (let index = 0; index < 100; index += 1) {
            const candidate = index === 0 ? baseCodename : `${baseCodename}-${index + 1}`
            if (!existingCodenames.has(candidate)) {
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

    async readEditorScene(
        metahubId: string,
        projectId: string,
        sceneId: string,
        userId: string
    ): Promise<{ scene: PlayCanvasScene & { version: number }; payload: PlayCanvasEditorScenePayload | null }> {
        const scene = await this.getScene(metahubId, projectId, sceneId, userId)
        if (!scene.payloadFile?.path) {
            if (!scene.payload) {
                return { scene, payload: null }
            }
            const parsed = playCanvasEditorScenePayloadSchema.safeParse(scene.payload)
            if (!parsed.success) {
                throw new MetahubValidationError('PlayCanvas editor scene payload is not supported', {
                    messageCode: 'playcanvas.editor.scenePayloadUnsupported'
                })
            }
            return { scene, payload: parsed.data }
        }

        const file = await this.readProjectFile(metahubId, projectId, scene.payloadFile.path, userId)
        let raw: unknown
        try {
            raw = JSON.parse(Buffer.from(file.contentBase64, 'base64').toString('utf8')) as unknown
        } catch {
            throw new MetahubValidationError('PlayCanvas editor scene payload is not supported', {
                messageCode: 'playcanvas.editor.scenePayloadUnsupported'
            })
        }
        const parsed = playCanvasEditorScenePayloadSchema.safeParse(raw)
        if (!parsed.success) {
            throw new MetahubValidationError('PlayCanvas editor scene payload is not supported', {
                messageCode: 'playcanvas.editor.scenePayloadUnsupported'
            })
        }
        return { scene: { ...scene, checksum: file.checksum }, payload: parsed.data }
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

    async saveEditorScene(
        metahubId: string,
        projectId: string,
        sceneId: string,
        input: {
            payload: PlayCanvasEditorScenePayload
            expectedCurrentChecksum?: string | null
        },
        userId: string
    ): Promise<{ scene: PlayCanvasScene & { version: number }; checksum: string | null }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const existing = await findPlayCanvasScene(this.exec, schemaName, projectId, sceneId)
        const existingPayloadFile = this.assertScenePayloadFileReference(projectId, existing?.payloadFile)
        const payloadFilePath = existingPayloadFile?.path ?? this.fileService.buildDefaultScenePath(projectId, sceneId)
        const safePath = this.assertEditorScenePayloadPath(projectId, sceneId, payloadFilePath)
        assertPlayCanvasProjectMimeForPath(safePath, 'application/json')
        const scope = { metahubId, branchSlug: schemaName }
        const previous = await this.readFileForRollback(scope, safePath)
        const preparedPayloadFile: PlayCanvasFileReference = {
            provider: existingPayloadFile?.provider ?? 'local',
            root: existingPayloadFile?.root ?? PLAYCANVAS_PROJECT_FILE_ROOT,
            path: safePath,
            mime: 'application/json',
            hash: existingPayloadFile?.hash ?? null,
            size: existingPayloadFile?.size ?? null,
            status: 'missing'
        }
        let prepared: (PlayCanvasScene & { version: number }) | null = null
        let written: { sourcePath: string; checksum: string; size: number; mime: string | null } | null = null
        try {
            prepared = await upsertPlayCanvasScene(
                this.exec,
                schemaName,
                projectId,
                {
                    id: sceneId,
                    codename: existing?.codename ?? createCodenameVLC('en', `scene-${sceneId.slice(0, 8)}`),
                    displayName: existing?.displayName ?? createLocalizedContent('en', 'PlayCanvas Scene'),
                    payloadSchemaVersion: input.payload.schemaVersion,
                    payload: null,
                    payloadFile: preparedPayloadFile,
                    checksum: existing?.checksum ?? null,
                    sortOrder: existing?.sortOrder ?? 0,
                    publish: existing?.publish ?? true,
                    expectedVersion: existing?.version
                },
                userId
            )
            if (!prepared) {
                throw this.metadataUpdateError(projectId, safePath)
            }
            written = await this.fileService.write(scope, safePath, Buffer.from(JSON.stringify(input.payload), 'utf8'), {
                expectedCurrentChecksum: input.expectedCurrentChecksum,
                mime: 'application/json'
            })
            const marked = await markPlayCanvasProjectFileReferenceReady(this.exec, schemaName, projectId, safePath, written, userId)
            if (!marked) {
                throw this.metadataUpdateError(projectId, safePath)
            }
            const metadata = await findPlayCanvasScene(this.exec, schemaName, projectId, sceneId)
            if (!metadata) {
                throw this.metadataUpdateError(projectId, safePath)
            }
            return {
                scene: metadata,
                checksum: written.checksum
            }
        } catch (error) {
            if (written) {
                await this.rollbackFileWrite(scope, safePath, written.checksum, previous, 'application/json').catch((rollbackError) => {
                    log.warn('Failed to rollback PlayCanvas editor scene file after save failure', {
                        metahubId,
                        schemaName,
                        projectId,
                        sceneId,
                        sourcePath: safePath,
                        rollbackError
                    })
                })
            }
            if (prepared) {
                await this.rollbackEditorSceneMetadata(schemaName, projectId, sceneId, existing, prepared.version, userId).catch(
                    (rollbackError) => {
                        log.warn('Failed to rollback PlayCanvas editor scene metadata after save failure', {
                            metahubId,
                            schemaName,
                            projectId,
                            sceneId,
                            sourcePath: safePath,
                            rollbackError
                        })
                    }
                )
            }
            throw error
        }
    }

    async saveEditorCompatibilityScene(
        metahubId: string,
        projectId: string,
        sceneId: string,
        input: {
            requestId: string
            payload: PlayCanvasEditorScenePayload
            expectedCurrentChecksum?: string | null
        },
        userId: string
    ): Promise<{ scene: PlayCanvasScene & { version: number }; payload: PlayCanvasEditorScenePayload | null; checksum: string | null }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        const sessionService = new PlayCanvasEditorBridgeSessionService()
        const replayInput = {
            sessionId: compatibilitySceneSaveSessionId({ metahubId, projectId, sceneId, userId }),
            requestId: input.requestId,
            commandType: COMPATIBILITY_SCENE_SAVE_COMMAND_TYPE,
            fingerprint: hashEditorCompatibilityReplayFingerprint({
                payload: input.payload,
                expectedCurrentChecksum: input.expectedCurrentChecksum
            }),
            expiresAt: Date.now() + PLAYCANVAS_EDITOR_BRIDGE_SESSION_TTL_MS,
            userId
        }
        const claimed = await sessionService.claimReplay(this.exec, schemaName, replayInput)
        if (!claimed) {
            const storedResponse = await sessionService.readReplayResponse(this.exec, schemaName, replayInput)
            if (storedResponse?.status === 'completed' && isEditorCompatibilitySceneSaveResult(storedResponse.response)) {
                return storedResponse.response
            }
            throw new MetahubConflictError('PlayCanvas Editor compatibility scene save replay is already in progress', {
                messageCode: 'playcanvas.editorCompatibility.replayRejected',
                requestId: input.requestId
            })
        }

        let mutationCommitted = false
        let replayClaimReleased = false
        const releaseReplayClaim = async () => {
            if (replayClaimReleased) return
            replayClaimReleased = true
            await sessionService.releaseReplay(this.exec, schemaName, replayInput).catch(() => undefined)
        }
        try {
            const saved = await this.saveEditorScene(
                metahubId,
                projectId,
                sceneId,
                {
                    payload: input.payload,
                    expectedCurrentChecksum: input.expectedCurrentChecksum
                },
                userId
            )
            mutationCommitted = true
            const read = await this.readEditorScene(metahubId, projectId, sceneId, userId)
            const response = { ...saved, payload: read.payload }
            const completed = await sessionService.completeReplay(this.exec, schemaName, {
                ...replayInput,
                response,
                userId
            })
            if (!completed) {
                throw new MetahubDomainError({
                    message: 'PlayCanvas Editor compatibility replay response could not be recorded',
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

    async listAssets(metahubId: string, projectId: string, _userId: string): Promise<(PlayCanvasAsset & { version: number })[]> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        return listPlayCanvasAssets(this.exec, schemaName, projectId)
    }

    async listMinimalAssetsForEditorScene(
        metahubId: string,
        projectId: string,
        sceneId: string,
        userId: string
    ): Promise<PlayCanvasEditorMinimalAssetMetadata[]> {
        const [{ payload }, assets] = await Promise.all([
            this.readEditorScene(metahubId, projectId, sceneId, userId),
            this.listAssets(metahubId, projectId, userId)
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
                    asset.type === 'json' && (referenced.size === 0 || referenced.has(asset.id) || referenced.has(asset.stableAssetId))
            )
            .map((asset) => ({
                id: asset.id,
                stableAssetId: asset.stableAssetId,
                type: asset.type,
                name: asset.name,
                virtualPath: asset.virtualPath,
                mime: asset.file?.mime ?? null,
                hash: asset.file?.hash ?? null,
                size: asset.file?.size ?? null
            }))
    }

    async readEditorCompatibilitySettings(
        metahubId: string,
        projectId: string,
        kind: CompatibilitySettingsKind,
        userId: string
    ): Promise<PlayCanvasEditorCompatibilitySettingsDocument> {
        const schemaName = await this.resolveSchemaName(metahubId)
        const project = await this.requireProject(schemaName, projectId)
        const documentId = settingsDocumentId(kind, projectId, userId)
        const compatibilitySettings = asRecord(project.settings[COMPATIBILITY_SETTINGS_KEY])
        const settingsDocuments = asRecord(compatibilitySettings.settingsDocuments)
        const existing = asRecord(settingsDocuments[documentId])
        const revision = typeof existing.revision === 'string' ? existing.revision : `project-${project.version}`
        const data = asRecord(existing.data)

        return playCanvasEditorCompatibilitySettingsDocumentSchema.parse({
            kind,
            documentId,
            data,
            revision
        })
    }

    async writeEditorCompatibilitySettings(
        metahubId: string,
        projectId: string,
        kind: CompatibilitySettingsKind,
        input: {
            data: PlayCanvasEditorCompatibilitySettingsDocument['data']
            expectedRevision?: string
            requestId: string
        },
        userId: string
    ): Promise<PlayCanvasEditorCompatibilitySettingsDocument> {
        const schemaName = await this.resolveSchemaName(metahubId)
        const sessionService = new PlayCanvasEditorBridgeSessionService()
        const replayInput = {
            sessionId: compatibilitySettingsWriteSessionId({ metahubId, projectId, kind, userId }),
            requestId: input.requestId,
            commandType: COMPATIBILITY_SETTINGS_WRITE_COMMAND_TYPE,
            fingerprint: hashEditorCompatibilityReplayFingerprint({
                kind,
                data: input.data,
                expectedRevision: input.expectedRevision
            }),
            expiresAt: Date.now() + PLAYCANVAS_EDITOR_BRIDGE_SESSION_TTL_MS,
            userId
        }
        const claimed = await sessionService.claimReplay(this.exec, schemaName, replayInput)
        if (!claimed) {
            const storedResponse = await sessionService.readReplayResponse(this.exec, schemaName, replayInput)
            if (storedResponse?.status === 'completed' && isEditorCompatibilitySettingsWriteResult(storedResponse.response)) {
                return storedResponse.response
            }
            throw new MetahubConflictError('PlayCanvas Editor compatibility settings write replay is already in progress', {
                messageCode: 'playcanvas.editorCompatibility.replayRejected',
                requestId: input.requestId
            })
        }

        let mutationCommitted = false
        let replayClaimReleased = false
        const releaseReplayClaim = async () => {
            if (replayClaimReleased) return
            replayClaimReleased = true
            await sessionService.releaseReplay(this.exec, schemaName, replayInput).catch(() => undefined)
        }
        try {
            const project = await this.requireProject(schemaName, projectId)
            const documentId = settingsDocumentId(kind, projectId, userId)
            const current = await this.readEditorCompatibilitySettings(metahubId, projectId, kind, userId)
            if (input.expectedRevision && input.expectedRevision !== current.revision) {
                throw new OptimisticLockError({
                    entityId: projectId,
                    entityType: 'playcanvasProject',
                    expectedVersion: Number(input.expectedRevision.replace(/^project-/, '')) || 0,
                    actualVersion: project.version,
                    updatedAt: new Date(0),
                    updatedBy: null
                })
            }

            const compatibilitySettings = asRecord(project.settings[COMPATIBILITY_SETTINGS_KEY])
            const settingsDocuments = asRecord(compatibilitySettings.settingsDocuments)
            const nextRevision = `project-${project.version + 1}`
            const nextSettings = {
                ...project.settings,
                [COMPATIBILITY_SETTINGS_KEY]: {
                    ...compatibilitySettings,
                    settingsDocuments: {
                        ...settingsDocuments,
                        [documentId]: {
                            kind,
                            data: input.data,
                            revision: nextRevision,
                            requestId: input.requestId,
                            updatedAt: new Date().toISOString()
                        }
                    }
                }
            }

            const updated = await updatePlayCanvasProject(
                this.exec,
                schemaName,
                projectId,
                {
                    settings: nextSettings,
                    expectedVersion: project.version
                },
                userId
            )
            if (!updated) {
                throw this.optimisticError(projectId, project.version)
            }
            mutationCommitted = true
            const response = playCanvasEditorCompatibilitySettingsDocumentSchema.parse({
                kind,
                documentId,
                data: input.data,
                revision: nextRevision
            })
            const completed = await sessionService.completeReplay(this.exec, schemaName, {
                ...replayInput,
                response,
                userId
            })
            if (!completed) {
                throw new MetahubDomainError({
                    message: 'PlayCanvas Editor compatibility settings replay response could not be recorded',
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

    async deleteProjectFile(
        metahubId: string,
        projectId: string,
        sourcePath: string,
        expectedCurrentChecksum: string,
        userId: string
    ): Promise<void> {
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

    async deleteAssetFile(
        metahubId: string,
        projectId: string,
        assetId: string,
        sourcePath: string,
        expectedCurrentChecksum: string,
        userId: string
    ): Promise<void> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireAssetFilePath(schemaName, projectId, assetId, sourcePath)
        const scope = { metahubId, branchSlug: schemaName }
        const previous = await this.readFileForRollback(scope, sourcePath)
        const markedMissing = await markPlayCanvasAssetFileReferenceMissing(this.exec, schemaName, projectId, assetId, sourcePath, userId)
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

    private async requireProject(schemaName: string, projectId: string) {
        const existing = await findPlayCanvasProject(this.exec, schemaName, projectId)
        if (!existing) {
            throw new MetahubValidationError('PlayCanvas project was not found', {
                messageCode: 'playcanvas.projects.notFound',
                projectId
            })
        }
        return existing
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

    private assertEditorScenePayloadPath(projectId: string, sceneId: string, sourcePath: string): string {
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
        await this.fileService.deleteIfCurrentChecksum(scope, sourcePath, writtenChecksum)
    }

    private async rollbackEditorSceneMetadata(
        schemaName: string,
        projectId: string,
        sceneId: string,
        previous: (PlayCanvasScene & { version: number }) | null,
        preparedVersion: number,
        userId: string
    ): Promise<void> {
        if (previous) {
            const restored = await upsertPlayCanvasScene(
                this.exec,
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

        const deleted = await softDeletePlayCanvasScene(this.exec, schemaName, projectId, sceneId, preparedVersion, userId)
        if (!deleted) {
            log.warn('Failed to remove prepared PlayCanvas editor scene metadata after save rollback', {
                schemaName,
                projectId,
                sceneId
            })
        }
    }
}
