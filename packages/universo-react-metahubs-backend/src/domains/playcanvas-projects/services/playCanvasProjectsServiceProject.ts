/**
 * Project aggregate operations for the PlayCanvas compatibility service.
 *
 * Project creation, selection, settings and publication-facing state stay in
 * this layer; scene, asset and file aggregates are implemented below it.
 */
import type {
    CreatePlayCanvasProjectRequest,
    PlayCanvasEditorCompatibilityProtocolDescriptor,
    PlayCanvasProjectSummary,
    UpdatePlayCanvasProjectSettingsRequest
} from '@universo-react/types'
import {
    PLAYCANVAS_EDITOR_FULL_BOOT_MODE,
    PLAYCANVAS_EDITOR_COMPATIBILITY_VERSION,
    PLAYCANVAS_PROJECT_SCHEMA_VERSION,
    playCanvasEditorCompatibilityProtocolDescriptorSchema
} from '@universo-react/types'
import { createPlayCanvasEditorNumericIds } from '@universo-react/playcanvas-editor-backend'
import { withAdvisoryLock, type DbExecutor } from '@universo-react/utils/database'
import { createCodenameVLC, createLocalizedContent, generateUuidV7, OptimisticLockError } from '@universo-react/utils'
import { MetahubValidationError } from '../../shared/domainErrors'

import { PlayCanvasProjectSnapshotService } from './PlayCanvasProjectSnapshotService'
import { buildPlayCanvasMetahubLifecycleLockKey } from './playCanvasLifecycleLocks'
import {
    clearPlayCanvasDefaultProjectPointers,
    createPlayCanvasProject,
    findPlayCanvasProject,
    findPlayCanvasProjectByCodename,
    findPlayCanvasScene,
    listPlayCanvasProjects,
    listPlayCanvasPublicationManifests,
    listPlayCanvasProjectCodenamesByPrefix,
    restoreSoftDeletedPlayCanvasProject,
    softDeletePlayCanvasProject,
    summarizePlayCanvasProject,
    updatePlayCanvasProject,
    upsertPlayCanvasScene
} from './playCanvasProjectsStore'

import { PlayCanvasProjectsServiceFileOperations } from './playCanvasProjectsServiceFileOperations'
import { log } from './playCanvasProjectsServiceCommon'
import {
    REALTIME_SETTINGS_KEY,
    CLOUD_ONLY_SURFACE_REASON,
    UNIVERSO_SOURCEFILES_REASON,
    assertPlayCanvasProjectSettings,
    createDefaultEditorScenePayload,
    slugifyProjectName,
    getPrimaryText
} from './playCanvasProjectsServiceHelpers'

export class PlayCanvasProjectsServiceProject extends PlayCanvasProjectsServiceFileOperations {
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
        return this.runProjectLifecycleLocked(metahubId, projectId, (executor) =>
            this.loadSelectedProjectForEditorUnlocked(metahubId, projectId, userId, executor)
        )
    }

    protected async loadSelectedProjectForEditorUnlocked(
        metahubId: string,
        projectId: string,
        userId: string,
        executor: DbExecutor
    ): Promise<PlayCanvasProjectSummary> {
        const schemaName = await this.resolveSchemaName(metahubId)
        let row = await findPlayCanvasProject(executor, schemaName, projectId)
        if (!row) {
            throw new MetahubValidationError('PlayCanvas project was not found', {
                messageCode: 'playcanvas.projects.notFound',
                projectId
            })
        }
        if (row.defaultSceneId) {
            return summarizePlayCanvasProject(executor, schemaName, row)
        }

        const sceneId = row.id
        let scene = await findPlayCanvasScene(executor, schemaName, row.id, sceneId)
        if (!scene) {
            scene =
                (await upsertPlayCanvasScene(
                    executor,
                    schemaName,
                    row.id,
                    {
                        id: sceneId,
                        codename: createCodenameVLC('en', 'main-scene'),
                        displayName: createLocalizedContent('en', 'Main Scene'),
                        payloadSchemaVersion: PLAYCANVAS_PROJECT_SCHEMA_VERSION,
                        payload: createDefaultEditorScenePayload(),
                        payloadFile: null,
                        checksum: null,
                        sortOrder: 0,
                        publish: true
                    },
                    userId
                )) ?? (await findPlayCanvasScene(executor, schemaName, row.id, sceneId))
        }
        if (!scene) {
            throw new MetahubValidationError('PlayCanvas project default scene could not be initialized', {
                messageCode: 'playcanvas.projectDefaultSceneInitFailed',
                projectId
            })
        }

        row = (await findPlayCanvasProject(executor, schemaName, projectId)) ?? row
        if (row.defaultSceneId) {
            return summarizePlayCanvasProject(executor, schemaName, row)
        }

        const updated = await updatePlayCanvasProject(
            executor,
            schemaName,
            row.id,
            {
                defaultSceneId: scene.id,
                expectedVersion: row.version
            },
            userId
        )
        if (updated) {
            return summarizePlayCanvasProject(executor, schemaName, updated)
        }

        const latest = await findPlayCanvasProject(executor, schemaName, projectId)
        if (latest?.defaultSceneId) {
            return summarizePlayCanvasProject(executor, schemaName, latest)
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
        const enabledSurface = {
            status: 'enabled' as const,
            reason: 'universoFullUpstreamUi'
        }
        const stubbedSurface = {
            status: 'stubbed' as const,
            reason: CLOUD_ONLY_SURFACE_REASON
        }
        const sourcefilesSurface = {
            status: 'enabled' as const,
            reason: UNIVERSO_SOURCEFILES_REASON
        }
        const branchId = defaultSceneId ?? project.id
        const numericIds = createPlayCanvasEditorNumericIds({
            metahubId,
            projectId,
            sceneId: branchId,
            userId
        })

        return playCanvasEditorCompatibilityProtocolDescriptorSchema.parse({
            schemaVersion: PLAYCANVAS_EDITOR_COMPATIBILITY_VERSION,
            mode: PLAYCANVAS_EDITOR_FULL_BOOT_MODE,
            upstream: {
                repository: 'https://github.com/playcanvas/editor',
                minimumTag: 'v2.30.4'
            },
            project,
            defaultSceneId,
            numericIds,
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
                rest: enabledSurface,
                realtime: enabledSurface,
                messenger: enabledSurface,
                relay: enabledSurface
            },
            shareDb: {
                requiredCollections: ['scenes', 'assets', 'settings', 'user_data'],
                persisted: true,
                persistence: 'snapshot-port',
                sceneStorage: 'metahub-playcanvas-project-storage'
            },
            cloudOnly: {
                store: stubbedSurface,
                jobs: stubbedSurface,
                branchesCheckpoints: stubbedSurface,
                sourcefiles: sourcefilesSurface,
                publishing: stubbedSurface,
                usersCollaboration: stubbedSurface,
                assetPipeline: stubbedSurface
            },
            documents: {
                codeEditorSourcefiles: {
                    status: 'enabled',
                    reason: UNIVERSO_SOURCEFILES_REASON
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
        return withAdvisoryLock(this.exec, buildPlayCanvasMetahubLifecycleLockKey(metahubId), async (tx) => {
            const codename =
                input.codename ??
                (await this.createUniqueProjectCodename(
                    schemaName,
                    input.displayName._primary,
                    slugifyProjectName(getPrimaryText(input.displayName)),
                    tx
                ))
            const row = await createPlayCanvasProject(
                tx,
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
                tx,
                schemaName,
                row.id,
                {
                    id: sceneId,
                    codename: createCodenameVLC(input.displayName._primary, 'main-scene'),
                    displayName: createLocalizedContent(input.displayName._primary, 'Main Scene'),
                    payloadSchemaVersion: PLAYCANVAS_PROJECT_SCHEMA_VERSION,
                    payload: createDefaultEditorScenePayload(),
                    payloadFile: null,
                    checksum: null,
                    sortOrder: 0,
                    publish: true
                },
                userId
            )
            const updated = await updatePlayCanvasProject(
                tx,
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
            return summarizePlayCanvasProject(tx, schemaName, updated)
        })
    }

    protected async createUniqueProjectCodename(
        schemaName: string,
        locale: string,
        baseCodename: string,
        exec: DbExecutor = this.exec
    ): Promise<NonNullable<CreatePlayCanvasProjectRequest['codename']>> {
        const existingCodenames = new Set(await listPlayCanvasProjectCodenamesByPrefix(exec, schemaName, baseCodename))
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

    async listPublishedRuntimeManifests(metahubId: string) {
        const schemaName = await this.resolveSchemaName(metahubId)
        return listPlayCanvasPublicationManifests(this.exec, schemaName)
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
        return this.runProjectLifecycleLocked(metahubId, projectId, (executor) =>
            this.updateProjectSettingsUnlocked(metahubId, projectId, input, userId, executor)
        )
    }

    protected async updateProjectSettingsUnlocked(
        metahubId: string,
        projectId: string,
        input: UpdatePlayCanvasProjectSettingsRequest & { expectedVersion?: number },
        userId: string,
        executor: DbExecutor
    ): Promise<PlayCanvasProjectSummary> {
        const schemaName = await this.resolveSchemaName(metahubId)
        if (input.defaultSceneId) {
            const scene = await findPlayCanvasScene(executor, schemaName, projectId, input.defaultSceneId)
            if (!scene) {
                throw new MetahubValidationError('PlayCanvas default scene was not found', {
                    messageCode: 'playcanvas.project.defaultSceneNotFound',
                    projectId,
                    sceneId: input.defaultSceneId
                })
            }
        }
        const updateInput = { ...input }
        if (input.settings !== undefined) {
            if (input.expectedVersion === undefined) {
                throw new MetahubValidationError('PlayCanvas project settings updates require an expected version', {
                    messageCode: 'playcanvas.project.settingsExpectedVersionRequired',
                    projectId
                })
            }
            const requestedSettings = assertPlayCanvasProjectSettings(input.settings)
            if (Object.prototype.hasOwnProperty.call(requestedSettings, REALTIME_SETTINGS_KEY)) {
                throw new MetahubValidationError('PlayCanvas Editor realtime settings are reserved for the realtime adapter', {
                    messageCode: 'playcanvas.project.settingsReservedKey',
                    projectId,
                    settingsKey: REALTIME_SETTINGS_KEY
                })
            }
            const project = await this.requireProject(schemaName, projectId, executor)
            updateInput.settings = assertPlayCanvasProjectSettings({
                ...requestedSettings,
                ...(project.settings[REALTIME_SETTINGS_KEY] === undefined
                    ? {}
                    : { [REALTIME_SETTINGS_KEY]: project.settings[REALTIME_SETTINGS_KEY] })
            })
        }
        const updated = await updatePlayCanvasProject(executor, schemaName, projectId, updateInput, userId)
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
        return summarizePlayCanvasProject(executor, schemaName, updated)
    }

    async deleteProject(
        metahubId: string,
        projectId: string,
        input: { expectedVersion: number },
        userId: string
    ): Promise<PlayCanvasProjectSummary> {
        if (typeof this.exec.transaction !== 'function') {
            return this.deleteProjectUnlocked(metahubId, projectId, input, userId, this.exec)
        }
        // Project deletion and every editor tree mutation share one
        // transaction-scoped lifecycle lock. This closes the window where a
        // concurrent asset/scene write passes `requireProject` and resurrects
        // child metadata after the parent has been soft-deleted.
        return this.runProjectLifecycleLocked(metahubId, projectId, (tx) =>
            this.deleteProjectUnlocked(metahubId, projectId, input, userId, tx)
        )
    }

    protected async deleteProjectUnlocked(
        metahubId: string,
        projectId: string,
        input: { expectedVersion: number },
        userId: string,
        executor: DbExecutor
    ): Promise<PlayCanvasProjectSummary> {
        const schemaName = await this.resolveSchemaName(metahubId)
        const deleted = await softDeletePlayCanvasProject(executor, schemaName, projectId, userId, input.expectedVersion)
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
            clearedPackagePointers = await clearPlayCanvasDefaultProjectPointers(executor, metahubId, projectId, userId)
            fileCleanupStarted = true
            await this.fileService.deleteProjectTree({ metahubId, branchSlug: schemaName }, projectId)
        } catch (error) {
            if (!fileCleanupStarted) {
                await restoreSoftDeletedPlayCanvasProject(executor, schemaName, projectId, userId, deleted.deletionToken).catch(
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
        return summarizePlayCanvasProject(executor, schemaName, deleted)
    }

    /**
     * Cascade-deletes the PlayCanvas project bound 1:1 to a "Projects" entity
     * instance. Resolves the project by id (preferred) or codename and reuses
     * {@link deleteProject}. Idempotent: a missing/already-deleted project is a
     * no-op so deleting the owning instance never fails on a stale binding.
     */
    async deleteBoundProject(
        metahubId: string,
        binding: { projectId?: string | null; projectCodename?: string | null },
        userId: string
    ): Promise<void> {
        const schemaName = await this.resolveSchemaName(metahubId)
        let row = binding.projectId ? await findPlayCanvasProject(this.exec, schemaName, binding.projectId) : null
        if (!row && binding.projectCodename) {
            row = await findPlayCanvasProjectByCodename(this.exec, schemaName, binding.projectCodename)
        }
        if (!row) {
            return
        }
        await this.deleteProject(metahubId, row.id, { expectedVersion: row.version }, userId)
    }

    /**
     * Resolves the live PlayCanvas project a `projectBinding` references, by its
     * codename, in the same project-store schema the rest of this service uses
     * ({@link resolveSchemaName} — the metahub's default branch). Returns `null`
     * for a missing or soft-deleted project. The single source of truth for
     * "where projects live" so binding validation cannot drift from the store.
     */
    async resolveBoundProjectByCodename(metahubId: string, codename: string): Promise<{ id: string } | null> {
        const schemaName = await this.resolveSchemaName(metahubId)
        const row = await findPlayCanvasProjectByCodename(this.exec, schemaName, codename)
        return row ? { id: row.id } : null
    }
}
