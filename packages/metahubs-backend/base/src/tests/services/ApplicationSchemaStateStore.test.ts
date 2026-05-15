import { ApplicationSchemaStatus } from '@universo/types'
import type { SqlQueryable } from '@universo/utils/database'
import { persistApplicationSchemaSyncState } from '../../domains/applications/services/ApplicationSchemaStateStore'
import { MetahubNotFoundError } from '../../domains/shared/domainErrors'

describe('ApplicationSchemaStateStore', () => {
    it('updates application schema state with audit/version fields', async () => {
        const mockQuery = jest.fn().mockResolvedValue([{ id: 'app-1' }])
        const trx: SqlQueryable = { query: mockQuery }

        await persistApplicationSchemaSyncState(trx, {
            applicationId: 'app-1',
            schemaStatus: ApplicationSchemaStatus.SYNCED,
            schemaError: null,
            schemaSyncedAt: new Date('2026-03-09T10:00:00.000Z'),
            schemaSnapshot: { entities: {} },
            lastSyncedPublicationVersionId: 'pub-ver-1',
            appStructureVersion: 1,
            userId: 'user-1'
        })

        expect(mockQuery).toHaveBeenCalledTimes(1)
        const [sql, params] = mockQuery.mock.calls[0]
        expect(sql).toContain('UPDATE applications.obj_applications')
        expect(sql).toContain('RETURNING id')
        expect(sql).toContain('_upl_deleted = false AND _app_deleted = false')
        expect(params).toContain(ApplicationSchemaStatus.SYNCED)
        expect(params).toContain(null) // schemaError
        expect(params).toContain('pub-ver-1')
        expect(params).toContain(1) // appStructureVersion
        expect(params).toContain('user-1')
        expect(params).toContain('app-1') // applicationId (last param)
    })

    it('includes installedReleaseMetadata when provided', async () => {
        const mockQuery = jest.fn().mockResolvedValue([{ id: 'app-1' }])
        const trx: SqlQueryable = { query: mockQuery }

        await persistApplicationSchemaSyncState(trx, {
            applicationId: 'app-1',
            schemaStatus: ApplicationSchemaStatus.SYNCED,
            schemaError: null,
            schemaSyncedAt: null,
            schemaSnapshot: null,
            lastSyncedPublicationVersionId: null,
            appStructureVersion: null,
            installedReleaseMetadata: { release: 'v1' },
            userId: null
        })

        const [sql, params] = mockQuery.mock.calls[0]
        expect(sql).toContain('installed_release_metadata')
        expect(params).toContain(JSON.stringify({ release: 'v1' }))
    })

    it('throws when the application row is missing', async () => {
        const mockQuery = jest.fn().mockResolvedValue([])
        const trx: SqlQueryable = { query: mockQuery }

        await expect(
            persistApplicationSchemaSyncState(trx, {
                applicationId: 'missing-app',
                schemaStatus: ApplicationSchemaStatus.SYNCED,
                schemaError: null,
                schemaSyncedAt: null,
                schemaSnapshot: null,
                lastSyncedPublicationVersionId: null,
                appStructureVersion: null,
                userId: null
            })
        ).rejects.toThrow(MetahubNotFoundError)
    })
})
