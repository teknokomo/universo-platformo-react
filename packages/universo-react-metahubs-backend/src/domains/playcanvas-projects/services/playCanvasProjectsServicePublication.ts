/**
 * Publication orchestration for PlayCanvas projects.
 */
import type { PlayCanvasRuntimeManifest } from '@universo-react/types'

import { MetahubConflictError, MetahubValidationError } from '../../shared/domainErrors'

import { PlayCanvasEditorBridgeSessionService } from './PlayCanvasEditorBridgeSessionService'
import { PlayCanvasProjectSnapshotService } from './PlayCanvasProjectSnapshotService'
import { replacePlayCanvasPublicationManifests } from './playCanvasProjectsStore'

import { PlayCanvasProjectsServiceBackups } from './playCanvasProjectsServiceBackups'

import type { PlayCanvasWrittenFile } from './playCanvasProjectsServiceHelpers'

export class PlayCanvasProjectsServicePublication extends PlayCanvasProjectsServiceBackups {
    async publishProjectState(metahubId: string, projectId: string, userId: string): Promise<PlayCanvasRuntimeManifest[]> {
        const writtenArtifacts: PlayCanvasWrittenFile[] = []
        try {
            return await this.runProjectLifecycleLocked(metahubId, projectId, async (executor) => {
                const schemaName = await this.resolveSchemaName(metahubId)
                await this.requireProject(schemaName, projectId, executor)
                const sessionService = new PlayCanvasEditorBridgeSessionService()
                const hasActiveReplayClaims = await sessionService.hasActiveReplayClaims(executor, schemaName, { metahubId, projectId })
                if (hasActiveReplayClaims) {
                    throw new MetahubConflictError('PlayCanvas Editor project has pending compatibility writes', {
                        messageCode: 'playcanvas.publish.pendingEditorWrites',
                        projectId
                    })
                }
                await this.ensureGeneratedScriptArtifactsUnlocked(metahubId, projectId, userId, executor, writtenArtifacts)
                const snapshot = await new PlayCanvasProjectSnapshotService(
                    executor,
                    this.schemaService,
                    this.fileService
                ).exportProjectSnapshot(metahubId, projectId)
                const runtimeManifests = snapshot?.runtimeManifests ?? []
                if (runtimeManifests.length === 0) {
                    throw new MetahubValidationError('PlayCanvas project has no publishable runtime manifests', {
                        messageCode: 'playcanvas.publish.noRuntimeManifests',
                        projectId
                    })
                }
                await replacePlayCanvasPublicationManifests(executor, schemaName, {
                    projectIds: [projectId],
                    manifests: runtimeManifests,
                    userId,
                    replaceScope: 'projects'
                })
                return runtimeManifests
            })
        } catch (error) {
            await this.cleanupWrittenPlayCanvasFiles(writtenArtifacts, projectId, 'published script artifact creation')
            throw error
        }
    }
}
