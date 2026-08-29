/**
 * Realtime settings/document operations for the PlayCanvas Editor bridge.
 *
 * This layer coordinates serialized scene and asset data with the realtime
 * document contract and keeps replay/version handling in one place.
 */
import type {
    PlayCanvasAsset,
    PlayCanvasEditorCompatibilitySettingsDocument,
    PlayCanvasEditorScenePayload,
    PlayCanvasScriptKind
} from '@universo-react/types'
import {
    PLAYCANVAS_EDITOR_BRIDGE_SESSION_TTL_MS,
    PLAYCANVAS_PROJECT_SCHEMA_VERSION,
    playCanvasEditorCompatibilityAssetDocumentSchema,
    playCanvasEditorCompatibilityScenePayloadSchema,
    playCanvasEditorCompatibilitySettingsDocumentSchema
} from '@universo-react/types'
import { createPlayCanvasEditorNumericIds } from '@universo-react/playcanvas-editor-backend'
import { type DbExecutor } from '@universo-react/utils/database'
import { generateUuidV7, OptimisticLockError } from '@universo-react/utils'
import stableStringify from 'json-stable-stringify'
import { MetahubConflictError, MetahubDomainError, MetahubValidationError } from '../../shared/domainErrors'
import { isUniqueViolation } from '../../shared/errorGuards'

import { PlayCanvasEditorBridgeSessionService } from './PlayCanvasEditorBridgeSessionService'
import {
    findPlayCanvasScriptAssetByAssetAndName,
    updatePlayCanvasProject,
    upsertPlayCanvasAsset,
    upsertPlayCanvasScriptAsset
} from './playCanvasProjectsStore'
import { createPlayCanvasEditorUserData, normalizePlayCanvasEditorUserData } from './playCanvasEditorUserData'

import { PlayCanvasProjectsServiceAssetFiles } from './playCanvasProjectsServiceAssetFiles'
import {
    COMPATIBILITY_SETTINGS_KEY,
    REALTIME_SETTINGS_KEY,
    COMPATIBILITY_SETTINGS_WRITE_COMMAND_TYPE,
    asStringArray,
    isCurrentChecksumMismatch,
    isSceneMetadataUpdateFailure,
    isStoragePlayCanvasAsset,
    isPlayCanvasAssetType,
    assertEditorAssetName,
    stripPlayCanvasAssetLifecycleMetadata,
    readPlayCanvasEditorAssetDocumentData,
    buildEditorCompatibilityAssetPathContext,
    normalizedEditorAssetPath,
    editorAssetPathKey,
    resolveEditorRealtimeAssetParentPath,
    sceneLocalAssetDocumentMatchesInput,
    applySceneLocalAssetDocumentInput,
    resolveEditorCompatibilityAssetEntry,
    settingsDocumentId,
    realtimeSettingsDocumentKind,
    assertRealtimeUserDataDocumentId,
    areEditorScenePayloadsEqual,
    asRecord,
    readPlayCanvasEditorVector3Tuple,
    findEditorSceneEntityById,
    readEditorJsonMetadataRecord,
    normalizeEditorEntityComponents,
    syncMmoommMetadataWithEditorEntities,
    normalizeEditorSceneSettings,
    readRealtimeSettingsDocumentVersion,
    waitForRealtimeSettingsRetry,
    normalizeRealtimeSceneEntities,
    normalizeRealtimeSettingsDocumentData,
    hashEditorCompatibilityReplayFingerprint,
    compatibilitySettingsWriteSessionId,
    isEditorCompatibilitySettingsWriteResult,
    getPrimaryText
} from './playCanvasProjectsServiceHelpers'
import type {
    CompatibilitySettingsKind,
    PlayCanvasEditorEntityMetadata,
    PlayCanvasEditorSceneMetadata
} from './playCanvasProjectsServiceHelpers'

export class PlayCanvasProjectsServiceRealtime extends PlayCanvasProjectsServiceAssetFiles {
    async readEditorCompatibilitySettings(
        metahubId: string,
        projectId: string,
        kind: CompatibilitySettingsKind,
        userId: string,
        executor: DbExecutor = this.exec
    ): Promise<PlayCanvasEditorCompatibilitySettingsDocument> {
        const schemaName = await this.resolveSchemaName(metahubId)
        const project = await this.requireProject(schemaName, projectId, executor)
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
            metahubId,
            projectId,
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
            if (storedResponse && sessionService.isReplayClaimRecoverable(storedResponse)) {
                const current = await this.runProjectLifecycleLocked(metahubId, projectId, (executor) =>
                    this.readEditorCompatibilitySettings(metahubId, projectId, kind, userId, executor)
                )
                if (stableStringify(current.data) === stableStringify(input.data)) {
                    const completed = await sessionService.completeReplay(this.exec, schemaName, {
                        ...replayInput,
                        response: current,
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
                    return current
                }
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
            const response = await this.runProjectLifecycleLocked(metahubId, projectId, async (executor) => {
                const project = await this.requireProject(schemaName, projectId, executor)
                const documentId = settingsDocumentId(kind, projectId, userId)
                const current = await this.readEditorCompatibilitySettings(metahubId, projectId, kind, userId, executor)
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
                    executor,
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
                return playCanvasEditorCompatibilitySettingsDocumentSchema.parse({
                    kind,
                    documentId,
                    data: input.data,
                    revision: nextRevision
                })
            })
            mutationCommitted = true
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

    async loadEditorRealtimeDocument(
        input: {
            metahubId: string
            projectId: string
            sceneId: string
            userId: string
            collection: 'scenes' | 'assets' | 'settings' | 'user_data'
            documentId: string
            numericProjectId: number
            numericSceneId: number
            numericUserId: number
        },
        executor: DbExecutor = this.exec
    ): Promise<{
        collection: 'scenes' | 'assets' | 'settings' | 'user_data'
        id: string
        data: Record<string, unknown>
        version?: number
        checksum?: string | null
        revision?: string | null
    } | null> {
        if (input.collection === 'scenes') {
            const read = await this.readEditorScene(input.metahubId, input.projectId, input.sceneId, input.userId, executor)
            return {
                collection: 'scenes',
                id: input.documentId,
                version: read.scene.version,
                checksum: read.scene.checksum ?? null,
                data: {
                    item_id: input.numericSceneId,
                    name: getPrimaryText(read.scene.displayName),
                    settings: normalizeEditorSceneSettings(read.payload?.settings),
                    entities: normalizeRealtimeSceneEntities(read.payload?.entities ?? []),
                    ...(read.payload?.metadata ? { metadata: read.payload.metadata } : {}),
                    scene: input.numericSceneId
                }
            }
        }

        if (input.collection === 'settings') {
            if (!realtimeSettingsDocumentKind(input.documentId)) {
                throw new MetahubValidationError('Unsupported PlayCanvas Editor realtime settings document', {
                    messageCode: 'playcanvas.editorRealtime.unsupportedSettingsDocument',
                    documentId: input.documentId
                })
            }
            const schemaName = await this.resolveSchemaName(input.metahubId)
            const project = await this.requireProject(schemaName, input.projectId, executor)
            const realtimeSettings = asRecord(project.settings[REALTIME_SETTINGS_KEY])
            const documents = asRecord(realtimeSettings.documents)
            const existing = asRecord(documents[input.documentId])
            return {
                collection: 'settings',
                id: input.documentId,
                data: normalizeRealtimeSettingsDocumentData(input.documentId, asRecord(existing.data), {
                    numericProjectId: input.numericProjectId,
                    numericUserId: input.numericUserId
                }),
                version: readRealtimeSettingsDocumentVersion(existing),
                revision: String(readRealtimeSettingsDocumentVersion(existing))
            }
        }

        if (input.collection === 'user_data') {
            const numericIds = createPlayCanvasEditorNumericIds({
                metahubId: input.metahubId,
                projectId: input.projectId,
                sceneId: input.sceneId,
                userId: input.userId
            })
            assertRealtimeUserDataDocumentId(input.documentId, numericIds.sceneId, numericIds.selfId)
            const schemaName = await this.resolveSchemaName(input.metahubId)
            const project = await this.requireProject(schemaName, input.projectId, executor)
            const realtimeSettings = asRecord(project.settings[REALTIME_SETTINGS_KEY])
            const documentsByScene = asRecord(realtimeSettings.userDataDocumentsByScene)
            const existing = asRecord(asRecord(documentsByScene[input.sceneId])[input.userId])
            const scene = await this.readEditorScene(input.metahubId, input.projectId, input.sceneId, input.userId, executor)
            const data =
                Object.keys(asRecord(existing.data)).length > 0
                    ? normalizePlayCanvasEditorUserData(existing.data)
                    : createPlayCanvasEditorUserData(scene.payload)
            const version = readRealtimeSettingsDocumentVersion(existing)
            return {
                collection: 'user_data',
                id: input.documentId,
                data,
                version,
                revision: String(version)
            }
        }

        const entries = await this.loadEditorCompatibilityAssetEntries(
            input.metahubId,
            input.projectId,
            input.userId,
            {
                sceneId: input.sceneId
            },
            executor
        )
        const matchedEntry = resolveEditorCompatibilityAssetEntry(entries, input.documentId, input.sceneId)
        const pathContext = buildEditorCompatibilityAssetPathContext(entries).get(matchedEntry.asset.id)
        return {
            collection: 'assets',
            id: input.documentId,
            data: {
                ...readPlayCanvasEditorAssetDocumentData(matchedEntry.asset, matchedEntry.documentId, pathContext),
                branch_id: input.numericSceneId,
                project: input.numericProjectId
            },
            version: matchedEntry.asset.version
        }
    }

    async persistEditorRealtimeDocument(
        input: {
            metahubId: string
            projectId: string
            sceneId: string
            userId: string
            collection: 'scenes' | 'assets' | 'settings' | 'user_data'
            documentId: string
            data: Record<string, unknown>
            version: number
            checksum?: string | null
            revision?: string | null
        },
        executor?: DbExecutor
    ): Promise<{ checksum?: string | null; revision?: string | null } | void> {
        if (executor) {
            return this.persistEditorRealtimeDocumentUnlocked(input, executor)
        }
        if (typeof this.exec.transaction !== 'function') {
            return this.persistEditorRealtimeDocumentUnlocked(input, this.exec)
        }
        return this.runProjectLifecycleLocked(input.metahubId, input.projectId, (executor) =>
            this.persistEditorRealtimeDocumentUnlocked(input, executor)
        )
    }

    protected async persistEditorRealtimeDocumentUnlocked(
        input: {
            metahubId: string
            projectId: string
            sceneId: string
            userId: string
            collection: 'scenes' | 'assets' | 'settings' | 'user_data'
            documentId: string
            data: Record<string, unknown>
            version: number
            checksum?: string | null
            revision?: string | null
        },
        executor: DbExecutor
    ): Promise<{ checksum?: string | null; revision?: string | null } | void> {
        if (input.collection === 'scenes') {
            const buildPayloadFromCurrentScene = async () => {
                const current = await this.readEditorScene(input.metahubId, input.projectId, input.sceneId, input.userId, executor)
                const entitiesRecord =
                    input.data.entities && typeof input.data.entities === 'object' && !Array.isArray(input.data.entities)
                        ? (input.data.entities as Record<string, Record<string, unknown>>)
                        : {}
                const syntheticRootIds = new Set(
                    Object.entries(entitiesRecord)
                        .filter(
                            ([id, entity]) =>
                                id === 'root' ||
                                (entity.resource_id === 'root' &&
                                    (entity.parent === null || entity.parent === undefined) &&
                                    typeof entity.name === 'string' &&
                                    entity.name.toLowerCase() === 'root')
                        )
                        .map(([id]) => id)
                )
                const entityIdByDocumentId = new Map(
                    Object.entries(entitiesRecord)
                        .filter(([documentId]) => !syntheticRootIds.has(documentId))
                        .map(([documentId, entity]) => [
                            documentId,
                            typeof entity.resource_id === 'string' && entity.resource_id ? entity.resource_id : documentId
                        ])
                )
                const resolveRealtimeEntityId = (value: unknown): string | null => {
                    if (typeof value !== 'string' || syntheticRootIds.has(value)) {
                        return null
                    }
                    return entityIdByDocumentId.get(value) ?? value
                }
                const existingMetadata = readEditorJsonMetadataRecord<PlayCanvasEditorSceneMetadata>(current.payload?.metadata)
                const incomingMetadata = readEditorJsonMetadataRecord<PlayCanvasEditorSceneMetadata>(input.data.metadata)
                const effectiveMetadata = incomingMetadata ?? existingMetadata
                const incomingAssets = Array.isArray(input.data.assets) ? input.data.assets : current.payload?.assets
                const entities = Object.entries(entitiesRecord)
                    .filter(([id]) => !syntheticRootIds.has(id))
                    .map(([id, entity]) => {
                        const entityId = entityIdByDocumentId.get(id) ?? id
                        const previousEntity = findEditorSceneEntityById(current.payload, entityId)
                        const position = readPlayCanvasEditorVector3Tuple(entity.position, previousEntity?.position)
                        const rotation = readPlayCanvasEditorVector3Tuple(entity.rotation, previousEntity?.rotation)
                        const scale = readPlayCanvasEditorVector3Tuple(entity.scale, previousEntity?.scale)
                        const hasComponentsRecord =
                            entity.components && typeof entity.components === 'object' && !Array.isArray(entity.components)
                        const incomingEntityMetadata = readEditorJsonMetadataRecord<PlayCanvasEditorEntityMetadata>(entity.metadata)
                        const existingEntityMetadata = readEditorJsonMetadataRecord<PlayCanvasEditorEntityMetadata>(
                            previousEntity?.metadata
                        )
                        const normalizedComponents = normalizeEditorEntityComponents(hasComponentsRecord ? entity.components : {}, entity)
                        return {
                            id: entityId,
                            name: typeof entity.name === 'string' ? entity.name : previousEntity?.name ?? 'Entity',
                            parentId: resolveRealtimeEntityId(entity.parent),
                            enabled: typeof entity.enabled === 'boolean' ? entity.enabled : previousEntity?.enabled ?? true,
                            ...(position ? { position } : {}),
                            ...(rotation ? { rotation } : {}),
                            ...(scale ? { scale } : {}),
                            components:
                                hasComponentsRecord || Object.keys(normalizedComponents).length > 0
                                    ? normalizedComponents
                                    : previousEntity?.components ?? {},
                            metadata: incomingEntityMetadata ?? existingEntityMetadata,
                            children: Array.isArray(entity.children)
                                ? entity.children
                                      .map((child) => resolveRealtimeEntityId(child))
                                      .filter((child): child is string => typeof child === 'string')
                                : previousEntity?.children ?? []
                        }
                    })
                const payload = playCanvasEditorCompatibilityScenePayloadSchema.parse({
                    schemaVersion: PLAYCANVAS_PROJECT_SCHEMA_VERSION,
                    settings: normalizeEditorSceneSettings(input.data.settings),
                    metadata: syncMmoommMetadataWithEditorEntities(effectiveMetadata, entities),
                    ...(incomingAssets ? { assets: incomingAssets } : {}),
                    entities
                })
                return { current, payload }
            }

            const maxAttempts = 4
            for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                const { current, payload } = await buildPayloadFromCurrentScene()
                if (areEditorScenePayloadsEqual(current.payload, payload)) {
                    return { checksum: current.scene.checksum ?? null }
                }
                const expectedCurrentChecksum =
                    attempt === 1 && input.checksum !== undefined ? input.checksum : current.scene.checksum ?? null
                try {
                    const compatibilityInput = {
                        requestId: generateUuidV7(),
                        payload,
                        expectedCurrentChecksum
                    }
                    const saved =
                        executor === this.exec
                            ? await this.saveEditorCompatibilityScene(
                                  input.metahubId,
                                  input.projectId,
                                  input.sceneId,
                                  compatibilityInput,
                                  input.userId
                              )
                            : await this.saveEditorCompatibilityScene(
                                  input.metahubId,
                                  input.projectId,
                                  input.sceneId,
                                  compatibilityInput,
                                  input.userId,
                                  executor
                              )
                    return { checksum: saved.checksum ?? null }
                } catch (error) {
                    if (isCurrentChecksumMismatch(error)) {
                        const latest = await this.readEditorScene(input.metahubId, input.projectId, input.sceneId, input.userId, executor)
                        if (areEditorScenePayloadsEqual(latest.payload, payload)) {
                            return { checksum: latest.scene.checksum ?? null }
                        }
                        throw error
                    }
                    if (!isSceneMetadataUpdateFailure(error) || attempt === maxAttempts) {
                        throw error
                    }
                    await waitForRealtimeSettingsRetry(attempt)
                }
            }
            throw new MetahubValidationError('PlayCanvas Editor realtime scene persistence retry exhausted', {
                messageCode: 'playcanvas.editorRealtime.scenePersistRetryExhausted',
                projectId: input.projectId,
                sceneId: input.sceneId
            })
        }

        if (input.collection === 'settings') {
            const kind = realtimeSettingsDocumentKind(input.documentId)
            if (!kind) {
                throw new MetahubValidationError('Unsupported PlayCanvas Editor realtime settings document', {
                    messageCode: 'playcanvas.editorRealtime.unsupportedSettingsDocument',
                    documentId: input.documentId
                })
            }
            const parsed = playCanvasEditorCompatibilitySettingsDocumentSchema.parse({
                kind,
                documentId: input.documentId,
                data: input.data,
                revision: String(input.version)
            })
            const schemaName = await this.resolveSchemaName(input.metahubId)
            const maxAttempts = 8
            for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                const project = await this.requireProject(schemaName, input.projectId, executor)
                const realtimeSettings = asRecord(project.settings[REALTIME_SETTINGS_KEY])
                const documents = asRecord(realtimeSettings.documents)
                const existing = asRecord(documents[input.documentId])
                const existingVersion = readRealtimeSettingsDocumentVersion(existing)
                if (input.revision !== undefined && input.revision !== null && input.revision !== String(existingVersion)) {
                    if (stableStringify(asRecord(existing.data)) === stableStringify(parsed.data)) {
                        return { revision: String(existingVersion) }
                    }
                    throw new MetahubValidationError('PlayCanvas Editor realtime settings revision mismatch', {
                        messageCode: 'playcanvas.editorRealtime.settingsRevisionMismatch',
                        documentId: input.documentId,
                        expectedRevision: input.revision,
                        actualRevision: String(existingVersion)
                    })
                }
                const updated = await updatePlayCanvasProject(
                    executor,
                    schemaName,
                    input.projectId,
                    {
                        settings: {
                            ...project.settings,
                            [REALTIME_SETTINGS_KEY]: {
                                ...realtimeSettings,
                                documents: {
                                    ...documents,
                                    [input.documentId]: {
                                        data: parsed.data,
                                        version: input.version,
                                        updatedAt: new Date().toISOString()
                                    }
                                }
                            }
                        },
                        expectedVersion: project.version
                    },
                    input.userId
                )
                if (updated) {
                    return { revision: String(input.version) }
                }
                if (attempt === maxAttempts) {
                    throw this.optimisticError(input.projectId, project.version)
                }
                await waitForRealtimeSettingsRetry(attempt)
            }
        }

        if (input.collection === 'user_data') {
            const numericIds = createPlayCanvasEditorNumericIds({
                metahubId: input.metahubId,
                projectId: input.projectId,
                sceneId: input.sceneId,
                userId: input.userId
            })
            assertRealtimeUserDataDocumentId(input.documentId, numericIds.sceneId, numericIds.selfId)
            const schemaName = await this.resolveSchemaName(input.metahubId)
            let parsed: Record<string, unknown>
            try {
                parsed = normalizePlayCanvasEditorUserData(input.data)
            } catch (error) {
                throw new MetahubValidationError('Invalid PlayCanvas Editor realtime user data document', {
                    messageCode: 'playcanvas.editorRealtime.invalidUserDataDocument',
                    documentId: input.documentId,
                    reasonCode: error instanceof Error ? error.name : typeof error
                })
            }
            const maxAttempts = 8
            for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                const project = await this.requireProject(schemaName, input.projectId, executor)
                const realtimeSettings = asRecord(project.settings[REALTIME_SETTINGS_KEY])
                const documentsByScene = asRecord(realtimeSettings.userDataDocumentsByScene)
                const documentsByUser = asRecord(documentsByScene[input.sceneId])
                const existing = asRecord(documentsByUser[input.userId])
                const existingVersion = readRealtimeSettingsDocumentVersion(existing)
                if (input.revision !== undefined && input.revision !== null && input.revision !== String(existingVersion)) {
                    if (stableStringify(asRecord(existing.data)) === stableStringify(parsed)) {
                        return { revision: String(existingVersion) }
                    }
                    throw new MetahubValidationError('PlayCanvas Editor realtime user data revision mismatch', {
                        messageCode: 'playcanvas.editorRealtime.userDataRevisionMismatch',
                        documentId: input.documentId,
                        expectedRevision: input.revision,
                        actualRevision: String(existingVersion)
                    })
                }
                const updated = await updatePlayCanvasProject(
                    executor,
                    schemaName,
                    input.projectId,
                    {
                        settings: {
                            ...project.settings,
                            [REALTIME_SETTINGS_KEY]: {
                                ...realtimeSettings,
                                userDataDocumentsByScene: {
                                    ...documentsByScene,
                                    [input.sceneId]: {
                                        ...documentsByUser,
                                        [input.userId]: {
                                            data: parsed,
                                            version: input.version,
                                            updatedAt: new Date().toISOString()
                                        }
                                    }
                                }
                            }
                        },
                        expectedVersion: project.version
                    },
                    input.userId
                )
                if (updated) {
                    return { revision: String(input.version) }
                }
                if (attempt === maxAttempts) {
                    throw this.optimisticError(input.projectId, project.version)
                }
                await waitForRealtimeSettingsRetry(attempt)
            }
        }

        if (input.collection === 'assets') {
            const schemaName = await this.resolveSchemaName(input.metahubId)
            await this.requireProject(schemaName, input.projectId, executor)
            const parsedAssetDocument = playCanvasEditorCompatibilityAssetDocumentSchema.safeParse(input.data)
            if (!parsedAssetDocument.success) {
                throw new MetahubValidationError('PlayCanvas Editor asset document is not supported', {
                    messageCode: 'playcanvas.editorRealtime.invalidAssetDocument',
                    documentId: input.documentId,
                    issues: parsedAssetDocument.error.issues.slice(0, 8).map((issue) => issue.message)
                })
            }
            input = { ...input, data: parsedAssetDocument.data }
            const entries = await this.loadEditorCompatibilityAssetEntries(
                input.metahubId,
                input.projectId,
                input.userId,
                { sceneId: input.sceneId },
                executor
            )
            const asset = resolveEditorCompatibilityAssetEntry(entries, input.documentId, input.sceneId).asset
            if (input.data.name !== undefined) {
                assertEditorAssetName(input.data.name)
            }
            if (!isStoragePlayCanvasAsset(asset)) {
                if (input.data.path !== undefined) {
                    resolveEditorRealtimeAssetParentPath(entries, input.data.path)
                }
                if (input.revision !== undefined && input.revision !== null && input.revision !== String(asset.version)) {
                    if (sceneLocalAssetDocumentMatchesInput(asset, input.data)) {
                        return { revision: String(asset.version) }
                    }
                    throw new MetahubValidationError('PlayCanvas Editor scene-local asset revision mismatch', {
                        messageCode: 'playcanvas.editorRealtime.sceneLocalAssetRevisionMismatch',
                        documentId: input.documentId,
                        expectedRevision: input.revision,
                        actualRevision: String(asset.version)
                    })
                }
                if (sceneLocalAssetDocumentMatchesInput(asset, input.data)) {
                    return { revision: String(asset.version) }
                }
                const maxAttempts = 4
                for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                    const read = await this.readEditorScene(input.metahubId, input.projectId, asset.sceneId, input.userId, executor)
                    const currentAssets = read.payload?.assets ?? []
                    const next = applySceneLocalAssetDocumentInput(currentAssets, {
                        projectId: input.projectId,
                        sceneId: asset.sceneId,
                        assetId: asset.id,
                        data: input.data,
                        version: input.version,
                        sceneVersion: read.scene.version
                    })
                    if (!next.matched) {
                        throw new MetahubValidationError('Unsupported PlayCanvas Editor scene-local asset document', {
                            messageCode: 'playcanvas.editorRealtime.unsupportedSceneLocalAssetDocument',
                            documentId: input.documentId
                        })
                    }
                    if (next.alreadyApplied) {
                        return { revision: String(read.scene.version) }
                    }
                    try {
                        const sceneInput = {
                            payload: {
                                ...(read.payload ?? { schemaVersion: PLAYCANVAS_PROJECT_SCHEMA_VERSION, entities: [] }),
                                assets: next.assets
                            } as PlayCanvasEditorScenePayload,
                            expectedCurrentChecksum: read.scene.checksum ?? null
                        }
                        const saved =
                            executor === this.exec
                                ? await this.saveEditorScene(input.metahubId, input.projectId, asset.sceneId, sceneInput, input.userId)
                                : await this.saveEditorScene(
                                      input.metahubId,
                                      input.projectId,
                                      asset.sceneId,
                                      sceneInput,
                                      input.userId,
                                      executor
                                  )
                        return { revision: String(saved.scene.version) }
                    } catch (error) {
                        if (!isCurrentChecksumMismatch(error) && !isSceneMetadataUpdateFailure(error)) {
                            throw error
                        }
                        if (attempt === maxAttempts) {
                            throw error
                        }
                        await waitForRealtimeSettingsRetry(attempt)
                    }
                }
                throw new MetahubValidationError('PlayCanvas Editor scene-local asset persistence failed', {
                    messageCode: 'playcanvas.editorRealtime.sceneLocalAssetPersistFailed',
                    documentId: input.documentId
                })
            }
            const nextType =
                input.data.type === undefined
                    ? asset.type
                    : isPlayCanvasAssetType(input.data.type)
                    ? input.data.type
                    : (() => {
                          throw new MetahubValidationError('PlayCanvas Editor asset type is not supported', {
                              messageCode: 'playcanvas.editorCompatibility.assetTypeUnsupported',
                              type: input.data.type
                          })
                      })()
            const nextName = input.data.name === undefined ? assertEditorAssetName(asset.name) : assertEditorAssetName(input.data.name)
            const currentPath = normalizedEditorAssetPath(asset.virtualPath.length > 0 ? asset.virtualPath : [asset.name])
            const nextParentPath =
                input.data.path === undefined ? currentPath.slice(0, -1) : resolveEditorRealtimeAssetParentPath(entries, input.data.path)
            const currentLeaf = currentPath.at(-1) ?? nextName
            const nextPath = [...nextParentPath, currentLeaf]
            if (editorAssetPathKey(nextPath) !== editorAssetPathKey(currentPath)) {
                throw new MetahubConflictError('PlayCanvas Editor asset path changes must use the compatibility REST update route', {
                    messageCode: 'playcanvas.editorRealtime.assetPathUpdateUnsupported',
                    documentId: input.documentId
                })
            }
            const nextMetadata = {
                ...stripPlayCanvasAssetLifecycleMetadata(asset.metadata),
                editorDocument: {
                    data: input.data.data ?? null,
                    meta: input.data.meta ?? null,
                    tags: asStringArray(input.data.tags),
                    preload: typeof input.data.preload === 'boolean' ? input.data.preload : true,
                    source: typeof input.data.source === 'boolean' ? input.data.source : false,
                    version: input.version
                }
            }
            let updated: (PlayCanvasAsset & { version: number }) | undefined
            try {
                updated = await upsertPlayCanvasAsset(
                    executor,
                    schemaName,
                    input.projectId,
                    {
                        id: asset.id,
                        stableAssetId: asset.stableAssetId,
                        type: nextType,
                        name: nextName,
                        virtualPath: nextPath,
                        file: asset.file,
                        metadata: nextMetadata,
                        publish: asset.publish,
                        expectedVersion: asset.version
                    },
                    input.userId
                )
            } catch (error) {
                if (isUniqueViolation(error)) {
                    throw new MetahubConflictError('A PlayCanvas Editor asset with this path already exists', {
                        messageCode: 'playcanvas.editorCompatibility.assetNameConflict',
                        projectId: input.projectId,
                        path: nextPath.join('/')
                    })
                }
                throw error
            }
            if (!updated) {
                throw this.optimisticError(asset.id, asset.version)
            }
            // Mirror editor-parsed script definitions into the script-asset table so
            // publication can compile ESM artifacts without re-parsing sources.
            const editorAssetData = asRecord(input.data.data)
            const parsedScripts = asRecord(editorAssetData.scripts)
            if (updated.type === 'script' && Object.keys(parsedScripts).length > 0) {
                const scriptKind: PlayCanvasScriptKind = /\.mjs$/i.test(updated.virtualPath.join('/')) ? 'esm' : 'classic'
                for (const [scriptName, parsed] of Object.entries(parsedScripts)) {
                    const existingScript = await findPlayCanvasScriptAssetByAssetAndName(
                        executor,
                        schemaName,
                        input.projectId,
                        updated.id,
                        scriptName
                    )
                    await upsertPlayCanvasScriptAsset(
                        executor,
                        schemaName,
                        input.projectId,
                        {
                            id: existingScript?.id ?? generateUuidV7(),
                            assetId: updated.id,
                            moduleId: existingScript?.moduleId ?? null,
                            moduleCodename: existingScript?.moduleCodename ?? null,
                            moduleSourcePath: existingScript?.moduleSourcePath ?? null,
                            scriptName,
                            scriptKind,
                            parsedAttributes: asRecord(parsed),
                            parseStatus: 'ready',
                            parseDiagnostics: existingScript?.parseDiagnostics ?? null,
                            expectedVersion: existingScript?.version
                        },
                        input.userId
                    )
                }
            }
            return { revision: String(updated.version) }
        }
    }

    /**
     * Fail-closed backup gate for editor sessions.
     *
     * Snapshots every derived realtime document of the project into one backup set
     * BEFORE the first authoring write of the editor session. Callers must invoke this
     * at editor-session bootstrap (full-boot config issuance) so that the snapshot
     * strictly precedes any persistEditorRealtimeDocument call of that session; a
     * backup failure must abort session bootstrap instead of allowing unmigrated
     * writes. Repeated calls presenting the same `openedAtMarker` skip re-backup,
     * while a new marker creates a fresh set.
     */
}
