/**
 * Scene aggregate operations for the PlayCanvas compatibility service.
 *
 * This layer owns scene persistence and the Editor scene payload contract;
 * project lifecycle and physical file primitives come from its ancestors.
 */
import type { PlayCanvasFileReference, PlayCanvasEditorScenePayload, PlayCanvasScene } from '@universo-react/types'
import { PLAYCANVAS_EDITOR_BRIDGE_SESSION_TTL_MS, PLAYCANVAS_PROJECT_FILE_ROOT } from '@universo-react/types'

import { playCanvasEditorScenePayloadSchema } from '@universo-react/types'
import { type DbExecutor } from '@universo-react/utils/database'
import { createCodenameVLC, createLocalizedContent } from '@universo-react/utils'
import { MetahubConflictError, MetahubDomainError, MetahubValidationError } from '../../shared/domainErrors'
import { assertPlayCanvasProjectMimeForPath } from './PlayCanvasProjectFileService'
import { PlayCanvasEditorBridgeSessionService } from './PlayCanvasEditorBridgeSessionService'
import {
    findPlayCanvasScene,
    listPlayCanvasScenes,
    markPlayCanvasProjectFileReferenceReady,
    upsertPlayCanvasScene
} from './playCanvasProjectsStore'

import { PlayCanvasProjectsServiceProject } from './playCanvasProjectsServiceProject'
import { log } from './playCanvasProjectsServiceCommon'
import {
    COMPATIBILITY_SCENE_SAVE_COMMAND_TYPE,
    assertPlayCanvasProjectPayload,
    areEditorScenePayloadsEqual,
    normalizeEditorCompatibilityScenePayloadForSave,
    hashEditorCompatibilityReplayFingerprint,
    compatibilitySceneSaveSessionId,
    isEditorCompatibilitySceneSaveResult
} from './playCanvasProjectsServiceHelpers'

export class PlayCanvasProjectsServiceScenes extends PlayCanvasProjectsServiceProject {
    async listScenes(
        metahubId: string,
        projectId: string,
        _userId: string,
        executor: DbExecutor = this.exec
    ): Promise<(PlayCanvasScene & { version: number })[]> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId, executor)
        return listPlayCanvasScenes(executor, schemaName, projectId)
    }

    async getScene(
        metahubId: string,
        projectId: string,
        sceneId: string,
        _userId: string,
        executor: DbExecutor = this.exec
    ): Promise<PlayCanvasScene & { version: number }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        const scene = await findPlayCanvasScene(executor, schemaName, projectId, sceneId)
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
        userId: string,
        executor: DbExecutor = this.exec
    ): Promise<{ scene: PlayCanvasScene & { version: number }; payload: PlayCanvasEditorScenePayload | null }> {
        const scene = await this.getScene(metahubId, projectId, sceneId, userId, executor)
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

        const file = await this.readProjectFile(metahubId, projectId, scene.payloadFile.path, userId, executor)
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
        return this.runProjectLifecycleLocked(metahubId, projectId, (executor) =>
            this.writeSceneUnlocked(metahubId, projectId, input, userId, executor)
        )
    }

    protected async writeSceneUnlocked(
        metahubId: string,
        projectId: string,
        input: Omit<PlayCanvasScene, 'projectId'> & { expectedVersion?: number },
        userId: string,
        executor: DbExecutor
    ): Promise<PlayCanvasScene & { version: number }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId, executor)
        const payloadFile = this.assertScenePayloadFileReference(projectId, input.payloadFile)
        const payload = input.payload == null ? null : assertPlayCanvasProjectPayload(input.payload)
        const scene = await upsertPlayCanvasScene(executor, schemaName, projectId, { ...input, payload, payloadFile }, userId)
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
        userId: string,
        executor?: DbExecutor
    ): Promise<{ scene: PlayCanvasScene & { version: number }; checksum: string | null }> {
        if (executor) {
            return this.saveEditorSceneUnlocked(metahubId, projectId, sceneId, input, userId, executor)
        }
        if (typeof this.exec.transaction !== 'function') {
            return this.saveEditorSceneUnlocked(metahubId, projectId, sceneId, input, userId, this.exec)
        }
        return this.runProjectLifecycleLocked(metahubId, projectId, (tx) =>
            this.saveEditorSceneUnlocked(metahubId, projectId, sceneId, input, userId, tx)
        )
    }

    protected async saveEditorSceneUnlocked(
        metahubId: string,
        projectId: string,
        sceneId: string,
        input: {
            payload: PlayCanvasEditorScenePayload
            expectedCurrentChecksum?: string | null
        },
        userId: string,
        executor: DbExecutor
    ): Promise<{ scene: PlayCanvasScene & { version: number }; checksum: string | null }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId, executor)
        const payload = normalizeEditorCompatibilityScenePayloadForSave(input.payload)
        const existing = await findPlayCanvasScene(executor, schemaName, projectId, sceneId)
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
                executor,
                schemaName,
                projectId,
                {
                    id: sceneId,
                    codename: existing?.codename ?? createCodenameVLC('en', `scene-${sceneId.slice(0, 8)}`),
                    displayName: existing?.displayName ?? createLocalizedContent('en', 'PlayCanvas Scene'),
                    payloadSchemaVersion: payload.schemaVersion,
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
            written = await this.fileService.write(scope, safePath, Buffer.from(JSON.stringify(payload), 'utf8'), {
                expectedCurrentChecksum: input.expectedCurrentChecksum,
                mime: 'application/json'
            })
            const marked = await markPlayCanvasProjectFileReferenceReady(executor, schemaName, projectId, safePath, written, userId)
            if (!marked) {
                throw this.metadataUpdateError(projectId, safePath)
            }
            const metadata = await findPlayCanvasScene(executor, schemaName, projectId, sceneId)
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
                await this.rollbackEditorSceneMetadata(schemaName, projectId, sceneId, existing, prepared.version, userId, executor).catch(
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
        userId: string,
        executor?: DbExecutor
    ): Promise<{ scene: PlayCanvasScene & { version: number }; payload: PlayCanvasEditorScenePayload | null; checksum: string | null }> {
        const replayExecutor = executor ?? this.exec
        const schemaName = await this.resolveSchemaName(metahubId)
        const sessionService = new PlayCanvasEditorBridgeSessionService()
        const payload = normalizeEditorCompatibilityScenePayloadForSave(input.payload)
        const replayInput = {
            sessionId: compatibilitySceneSaveSessionId({ metahubId, projectId, sceneId, userId }),
            metahubId,
            projectId,
            requestId: input.requestId,
            commandType: COMPATIBILITY_SCENE_SAVE_COMMAND_TYPE,
            fingerprint: hashEditorCompatibilityReplayFingerprint({
                payload,
                expectedCurrentChecksum: input.expectedCurrentChecksum
            }),
            expiresAt: Date.now() + PLAYCANVAS_EDITOR_BRIDGE_SESSION_TTL_MS,
            userId
        }
        const claimed = await sessionService.claimReplay(replayExecutor, schemaName, replayInput)
        if (!claimed) {
            const storedResponse = await sessionService.readReplayResponse(replayExecutor, schemaName, replayInput)
            if (storedResponse?.status === 'completed' && isEditorCompatibilitySceneSaveResult(storedResponse.response)) {
                return storedResponse.response
            }
            if (storedResponse && sessionService.isReplayClaimRecoverable(storedResponse)) {
                const current = executor
                    ? await this.readEditorScene(metahubId, projectId, sceneId, userId, executor)
                    : await this.runProjectLifecycleLocked(metahubId, projectId, (lockedExecutor) =>
                          this.readEditorScene(metahubId, projectId, sceneId, userId, lockedExecutor)
                      )
                if (areEditorScenePayloadsEqual(current.payload, payload)) {
                    const response = {
                        scene: current.scene,
                        payload: current.payload,
                        checksum: current.scene.checksum ?? null
                    }
                    const completed = await sessionService.completeReplay(replayExecutor, schemaName, {
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
                }
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
            await sessionService.releaseReplay(replayExecutor, schemaName, replayInput).catch(() => undefined)
        }
        try {
            const saveWork = (lockedExecutor: DbExecutor) => {
                const sceneInput = {
                    payload,
                    expectedCurrentChecksum: input.expectedCurrentChecksum
                }
                // Keep the no-transaction adapter seam overrideable for unit tests and
                // host integrations, while the real request executor stays inside the
                // lifecycle transaction and uses the unlocked implementation.
                if (lockedExecutor === this.exec && typeof this.exec.transaction !== 'function') {
                    return this.saveEditorScene(metahubId, projectId, sceneId, sceneInput, userId)
                }
                return this.saveEditorSceneUnlocked(metahubId, projectId, sceneId, sceneInput, userId, lockedExecutor)
            }
            const saved = executor ? await saveWork(executor) : await this.runProjectLifecycleLocked(metahubId, projectId, saveWork)
            mutationCommitted = true
            const read = await this.readEditorScene(metahubId, projectId, sceneId, userId, replayExecutor)
            const response = { ...saved, payload: read.payload }
            const completed = await sessionService.completeReplay(replayExecutor, schemaName, {
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
}
