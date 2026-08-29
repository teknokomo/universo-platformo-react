/**
 * Durable backup and restore operations for PlayCanvas Editor documents.
 */

import { createPlayCanvasEditorNumericIds } from '@universo-react/playcanvas-editor-backend'
import { withAdvisoryLock, type DbExecutor } from '@universo-react/utils/database'
import { MetahubDomainError } from '../../shared/domainErrors'

import { buildPlayCanvasMetahubLifecycleLockKey, buildPlayCanvasProjectLifecycleLockKey } from './playCanvasLifecycleLocks'

import {
    insertEditorDocumentBackupSet,
    latestEditorDocumentBackupSetExists,
    listLatestEditorDocumentBackupRows,
    type EditorDocumentBackupRow
} from './editorDocumentBackupsStore'

import { PlayCanvasProjectsServiceRealtime } from './playCanvasProjectsServiceRealtime'
import { log } from './playCanvasProjectsServiceCommon'

export class PlayCanvasProjectsServiceBackups extends PlayCanvasProjectsServiceRealtime {
    async ensureOpenedProjectBackup(input: {
        metahubId: string
        projectId: string
        userId: string
        sceneId: string
        sessionId?: string
        assetDocumentIds?: readonly number[]
        openedAtMarker?: Date
    }): Promise<{ status: 'created' | 'skipped'; documentCount: number; openedAt: Date }> {
        const openedAt = input.openedAtMarker ?? new Date(Date.now())

        return this.runProjectLifecycleLocked(input.metahubId, input.projectId, async (executor) => {
            if (
                input.openedAtMarker &&
                (await latestEditorDocumentBackupSetExists(executor, {
                    metahubId: input.metahubId,
                    projectId: input.projectId,
                    openedAtMarker: input.openedAtMarker
                }))
            ) {
                return { status: 'skipped' as const, documentCount: 0, openedAt }
            }

            const rows = await this.buildEditorRealtimeBackupRows(
                {
                    metahubId: input.metahubId,
                    projectId: input.projectId,
                    sceneId: input.sceneId,
                    userId: input.userId,
                    assetDocumentIds: input.assetDocumentIds
                },
                executor
            )

            try {
                await insertEditorDocumentBackupSet(executor, {
                    metahubId: input.metahubId,
                    projectId: input.projectId,
                    openedAt,
                    rows
                })
            } catch (error) {
                log.error('PlayCanvas Editor open backup failed; failing editor session bootstrap closed', {
                    metahubId: input.metahubId,
                    projectId: input.projectId,
                    sessionId: input.sessionId ?? null,
                    documentCount: rows.length,
                    errorType: error instanceof Error ? error.name : typeof error
                })
                throw error
            }

            log.info('PlayCanvas Editor open backup committed before first authoring write', {
                metahubId: input.metahubId,
                projectId: input.projectId,
                sessionId: input.sessionId ?? null,
                documentCount: rows.length
            })
            return { status: 'created' as const, documentCount: rows.length, openedAt }
        })
    }

    /**
     * Restores the newest backup set by replaying every row through
     * persistEditorRealtimeDocument in stored insertion order.
     *
     * Fails closed with NOT_FOUND when no backup set exists. The optional executor
     * participates in the same lifecycle lock and transaction as the backup read and
     * replay, so callers can keep an existing request-scoped transaction intact.
     * When no operator identity is supplied, replays are attributed to the owning
     * metahub principal.
     */
    async restoreLatestProjectBackup(
        metahubId: string,
        projectId: string,
        executor?: DbExecutor,
        userId?: string
    ): Promise<{ restoredDocuments: number; openedAt: Date }> {
        const actorId = userId ?? metahubId
        const runRestore = async (lockedExecutor: DbExecutor) => {
            const rows = await listLatestEditorDocumentBackupRows(lockedExecutor, { metahubId, projectId })
            if (rows.length === 0) {
                throw new MetahubDomainError({
                    message: 'No PlayCanvas Editor document backup set exists for this project',
                    statusCode: 404,
                    code: 'NOT_FOUND',
                    details: {
                        messageCode: 'playcanvas.editorRealtime.backupSetMissing',
                        projectId
                    }
                })
            }

            // Mirrors the realtime seeding derivation: the persisted scene identity is the
            // project's default scene, falling back to the project id itself.
            const schemaName = await this.resolveSchemaName(metahubId)
            const project = await this.requireProject(schemaName, projectId, lockedExecutor)
            const sceneId = project.defaultSceneId ?? projectId

            let restoredDocuments = 0
            for (const row of rows) {
                await this.persistEditorRealtimeDocument(
                    {
                        metahubId,
                        projectId,
                        sceneId,
                        userId: actorId,
                        collection: row.collection,
                        documentId: row.documentId,
                        data: row.data,
                        version: row.version
                    },
                    lockedExecutor
                )
                restoredDocuments += 1
            }

            return { restoredDocuments, openedAt: rows[0].openedAt }
        }

        if (executor) {
            return withAdvisoryLock(executor, buildPlayCanvasMetahubLifecycleLockKey(metahubId), async (metahubExecutor) => {
                await metahubExecutor.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
                    buildPlayCanvasProjectLifecycleLockKey(metahubId, projectId)
                ])
                return runRestore(metahubExecutor)
            })
        }
        return this.runProjectLifecycleLocked(metahubId, projectId, runRestore)
    }

    /**
     * Enumerates the derived realtime documents exactly like the realtime seeding path
     * does (scenes/settings/user_data plus signed asset documents) and loads each one
     * through loadEditorRealtimeDocument to build immutable backup rows.
     */
    protected async buildEditorRealtimeBackupRows(
        input: {
            metahubId: string
            projectId: string
            sceneId: string
            userId: string
            assetDocumentIds?: readonly number[]
        },
        executor: DbExecutor = this.exec
    ): Promise<EditorDocumentBackupRow[]> {
        const numericIds = createPlayCanvasEditorNumericIds({
            metahubId: input.metahubId,
            projectId: input.projectId,
            sceneId: input.sceneId,
            userId: input.userId
        })
        const documents: Array<{ collection: EditorDocumentBackupRow['collection']; documentId: string }> = [
            { collection: 'scenes', documentId: String(numericIds.sceneId) },
            { collection: 'settings', documentId: numericIds.settingsId },
            { collection: 'settings', documentId: `user_${numericIds.selfId}` },
            { collection: 'settings', documentId: `project_${numericIds.projectId}_${numericIds.selfId}` },
            { collection: 'settings', documentId: `project-private_${numericIds.projectId}` },
            { collection: 'user_data', documentId: `${numericIds.sceneId}_${numericIds.selfId}` },
            ...(input.assetDocumentIds ?? []).map((assetDocumentId) => ({
                collection: 'assets' as const,
                documentId: String(assetDocumentId)
            }))
        ]

        const rows: EditorDocumentBackupRow[] = []
        for (const document of documents) {
            const loaded = await this.loadEditorRealtimeDocument(
                {
                    metahubId: input.metahubId,
                    projectId: input.projectId,
                    sceneId: input.sceneId,
                    userId: input.userId,
                    collection: document.collection,
                    documentId: document.documentId,
                    numericProjectId: numericIds.projectId,
                    numericSceneId: numericIds.sceneId,
                    numericUserId: numericIds.selfId
                },
                executor
            )
            if (!loaded) {
                continue
            }
            rows.push({
                collection: document.collection,
                documentId: document.documentId,
                data: loaded.data,
                version: loaded.version ?? 0
            })
        }
        return rows
    }
}
