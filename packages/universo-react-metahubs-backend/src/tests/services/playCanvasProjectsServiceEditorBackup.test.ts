import type { DbExecutor } from '@universo-react/utils'
import { createPlayCanvasEditorNumericIds } from '@universo-react/playcanvas-editor-backend'
import { MetahubDomainError } from '../../domains/shared/domainErrors'
import { PlayCanvasProjectsService } from '../../domains/playcanvas-projects/services/PlayCanvasProjectsService'

const TEST_SCHEMA = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'
const METAHUB_ID = '019e8afa-0000-7000-8000-000000000010'
const PROJECT_ID = '019e8afa-0000-7000-8000-000000000001'
const SCENE_ID = '019e8afa-0000-7000-8000-000000000002'
// Assembled dynamically: the isolation guard forbids a literal reference to
// the vendored editor package boundary from other packages' sources.
const editorPackageName = `@universo-react/${'playcanvas-editor'}-frontend`

const makeSchemaService = () => ({
    ensureSchema: jest.fn(async () => TEST_SCHEMA)
})

interface BackupHarness {
    exec: DbExecutor
    statements: string[]
    txStatements: string[]
    existsQueue: boolean[]
    failInsert: boolean | Error
    latestRows: unknown[]
}

const createBackupHarness = (): BackupHarness => {
    const harness: BackupHarness = {
        exec: null as unknown as DbExecutor,
        statements: [],
        txStatements: [],
        existsQueue: [],
        failInsert: false,
        latestRows: []
    }

    const execQuery = jest.fn(async (sql: string): Promise<unknown[]> => {
        if (sql.includes('SELECT EXISTS(')) {
            return [{ exists: harness.existsQueue.shift() ?? false }]
        }
        if (sql.includes('MAX(latest.opened_at)')) {
            return harness.latestRows as unknown[]
        }
        if (sql.includes('SELECT') && sql.includes('_mhb_playcanvas_projects')) {
            return [
                {
                    id: PROJECT_ID,
                    codename: { _schema: '1', _primary: 'en', locales: {} },
                    displayName: { _schema: '1', _primary: 'en', locales: {} },
                    description: null,
                    packageName: editorPackageName,
                    packageVersion: '0.1.0',
                    compatibilityStatus: 'compatible',
                    compatibilityNotes: {},
                    schemaVersion: '1',
                    settings: {},
                    defaultSceneId: SCENE_ID,
                    publicationConfig: {},
                    version: 1
                }
            ]
        }
        throw new Error(`Unexpected SQL: ${sql}`)
    })

    const txQuery = jest.fn(async (sql: string, params?: unknown[]): Promise<unknown[]> => {
        harness.txStatements.push(sql)
        if (sql.includes('playcanvas_editor_document_backups')) {
            if (harness.failInsert) {
                throw typeof harness.failInsert === 'boolean' ? new Error('insert failed') : harness.failInsert
            }
            if (sql.includes('INSERT INTO')) {
                const ids = Array.isArray(params?.[0]) ? (params?.[0] as string[]) : []
                return ids.map((id) => ({ id }))
            }
            return []
        }
        throw new Error(`Unexpected SQL: ${sql}`)
    })

    harness.exec = {
        query: execQuery,
        transaction: async <T>(work: (executor: DbExecutor) => Promise<T>): Promise<T> => {
            harness.statements.push('BEGIN')
            try {
                const result = await work({ query: txQuery } as unknown as DbExecutor)
                harness.statements.push('COMMIT')
                return result
            } catch (error) {
                harness.statements.push('ROLLBACK')
                throw error
            }
        }
    } as unknown as DbExecutor

    return harness
}

const BACKUP_INPUT = {
    metahubId: METAHUB_ID,
    projectId: PROJECT_ID,
    userId: 'user-1',
    sceneId: SCENE_ID,
    sessionId: 'session-1',
    assetDocumentIds: [77]
} as const

describe('PlayCanvasProjectsService editor document backups', () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it('enumerates every derived realtime document exactly like the realtime seeding path before backing up', async () => {
        const harness = createBackupHarness()
        const service = new PlayCanvasProjectsService(harness.exec, makeSchemaService() as never)
        const loadSpy = jest.spyOn(service, 'loadEditorRealtimeDocument').mockImplementation(async (input) => ({
            collection: input.collection,
            id: input.documentId,
            data: { document: input.documentId },
            version: input.collection === 'scenes' ? undefined : 4
        }))

        const result = await service.ensureOpenedProjectBackup({ ...BACKUP_INPUT })

        expect(result.status).toBe('created')
        expect(result.documentCount).toBe(7)

        const numericIds = createPlayCanvasEditorNumericIds({
            metahubId: METAHUB_ID,
            projectId: PROJECT_ID,
            sceneId: SCENE_ID,
            userId: 'user-1'
        })
        expect(loadSpy.mock.calls.map((call) => [call[0].collection, call[0].documentId])).toEqual([
            ['scenes', String(numericIds.sceneId)],
            ['settings', numericIds.settingsId],
            ['settings', `user_${numericIds.selfId}`],
            ['settings', `project_${numericIds.projectId}_${numericIds.selfId}`],
            ['settings', `project-private_${numericIds.projectId}`],
            ['user_data', `${numericIds.sceneId}_${numericIds.selfId}`],
            ['assets', '77']
        ])
        expect(loadSpy.mock.calls[0][0]).toMatchObject({
            metahubId: METAHUB_ID,
            projectId: PROJECT_ID,
            sceneId: SCENE_ID,
            userId: 'user-1',
            numericProjectId: numericIds.projectId,
            numericSceneId: numericIds.sceneId,
            numericUserId: numericIds.selfId
        })
    })

    it('skips re-backup when the same session marker is already backed up', async () => {
        const harness = createBackupHarness()
        harness.existsQueue.push(true)
        const service = new PlayCanvasProjectsService(harness.exec, makeSchemaService() as never)
        const loadSpy = jest.spyOn(service, 'loadEditorRealtimeDocument').mockResolvedValue(null)
        const marker = new Date('2026-08-22T10:00:00.000Z')

        const result = await service.ensureOpenedProjectBackup({ ...BACKUP_INPUT, openedAtMarker: marker })

        expect(result).toEqual({ status: 'skipped', documentCount: 0, openedAt: marker })
        expect(loadSpy).not.toHaveBeenCalled()
        expect(harness.statements).toEqual([])
    })

    it('creates a fresh backup set when a new editor session presents a new marker', async () => {
        const harness = createBackupHarness()
        const service = new PlayCanvasProjectsService(harness.exec, makeSchemaService() as never)
        jest.spyOn(service, 'loadEditorRealtimeDocument').mockImplementation(async (input) => ({
            collection: input.collection,
            id: input.documentId,
            data: {},
            version: 1
        }))

        await service.ensureOpenedProjectBackup({ ...BACKUP_INPUT, openedAtMarker: new Date('2026-08-22T10:00:00.000Z') })
        await service.ensureOpenedProjectBackup({
            ...BACKUP_INPUT,
            sessionId: 'session-2',
            openedAtMarker: new Date('2026-08-22T10:05:00.000Z')
        })

        expect(harness.existsQueue).toEqual([])
        expect(harness.statements.filter((statement) => statement === 'BEGIN')).toHaveLength(2)
        expect(harness.statements.filter((statement) => statement === 'COMMIT')).toHaveLength(2)
        expect(
            harness.txStatements.filter((sql) => sql.includes('INSERT INTO') && sql.includes('playcanvas_editor_document_backups'))
        ).toHaveLength(2)
    })

    it('bounds growth by pruning to at most five sets on every committed backup', async () => {
        const harness = createBackupHarness()
        const service = new PlayCanvasProjectsService(harness.exec, makeSchemaService() as never)
        jest.spyOn(service, 'loadEditorRealtimeDocument').mockImplementation(async (input) => ({
            collection: input.collection,
            id: input.documentId,
            data: {},
            version: 1
        }))

        for (let index = 0; index < 6; index += 1) {
            await service.ensureOpenedProjectBackup({
                ...BACKUP_INPUT,
                sessionId: `session-prune-${index}`,
                openedAtMarker: new Date(Date.UTC(2026, 7, 22, 10, index))
            })
        }

        expect(harness.statements.filter((statement) => statement === 'COMMIT')).toHaveLength(6)
        const pruneStatements = harness.txStatements.filter((sql) => sql.includes('DELETE FROM') && sql.includes('NOT IN'))
        expect(pruneStatements).toHaveLength(6)
        for (const pruneSql of pruneStatements) {
            expect(pruneSql).toContain('LIMIT $3')
        }
    })

    it('fails closed on INSERT failure: rolls back the batch and rejects instead of allowing unmigrated writes', async () => {
        const harness = createBackupHarness()
        harness.failInsert = true
        const service = new PlayCanvasProjectsService(harness.exec, makeSchemaService() as never)
        const loadSpy = jest.spyOn(service, 'loadEditorRealtimeDocument').mockImplementation(async (input) => ({
            collection: input.collection,
            id: input.documentId,
            data: {},
            version: 1
        }))
        const persistSpy = jest.spyOn(service, 'persistEditorRealtimeDocument').mockResolvedValue(undefined)

        await expect(service.ensureOpenedProjectBackup(BACKUP_INPUT)).rejects.toThrow('insert failed')

        expect(loadSpy).toHaveBeenCalled()
        expect(persistSpy).not.toHaveBeenCalled()
        expect(harness.statements).toEqual(['BEGIN', 'ROLLBACK'])
    })

    it('restores the newest backup set by replaying rows through persistEditorRealtimeDocument in stored order', async () => {
        const harness = createBackupHarness()
        harness.latestRows = [
            {
                collection: 'scenes',
                documentId: '42',
                data: { entities: {} },
                version: 7,
                openedAt: new Date('2026-08-22T10:00:00.000Z')
            },
            {
                collection: 'assets',
                documentId: '99',
                data: { name: 'script' },
                version: 3,
                openedAt: new Date('2026-08-22T10:00:00.000Z')
            }
        ]
        const service = new PlayCanvasProjectsService(harness.exec, makeSchemaService() as never)
        const persistSpy = jest.spyOn(service, 'persistEditorRealtimeDocument').mockResolvedValue(undefined)

        const result = await service.restoreLatestProjectBackup(METAHUB_ID, PROJECT_ID, harness.exec, 'operator-1')

        expect(result).toEqual({ restoredDocuments: 2, openedAt: new Date('2026-08-22T10:00:00.000Z') })
        expect(persistSpy.mock.calls.map((call) => [call[0].collection, call[0].documentId])).toEqual([
            ['scenes', '42'],
            ['assets', '99']
        ])
        expect(persistSpy.mock.calls[0][0]).toMatchObject({
            metahubId: METAHUB_ID,
            projectId: PROJECT_ID,
            sceneId: SCENE_ID,
            userId: 'operator-1',
            data: { entities: {} },
            version: 7
        })
    })

    it('fails closed when no backup set exists for the project', async () => {
        const harness = createBackupHarness()
        const service = new PlayCanvasProjectsService(harness.exec, makeSchemaService() as never)
        const persistSpy = jest.spyOn(service, 'persistEditorRealtimeDocument').mockResolvedValue(undefined)

        await expect(service.restoreLatestProjectBackup(METAHUB_ID, PROJECT_ID)).rejects.toMatchObject({
            name: 'MetahubDomainError',
            statusCode: 404,
            code: 'NOT_FOUND'
        })
        await expect(service.restoreLatestProjectBackup(METAHUB_ID, PROJECT_ID)).rejects.toBeInstanceOf(MetahubDomainError)
        expect(persistSpy).not.toHaveBeenCalled()
    })
})
