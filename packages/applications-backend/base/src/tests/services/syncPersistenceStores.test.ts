import { persistApplicationSchemaSyncState } from '../../services/ApplicationSchemaSyncStateStore'
import { persistConnectorSyncTouch } from '../../services/ConnectorSyncTouchStore'
import { ApplicationSchemaStatus } from '@universo/types'

function createMockTransaction() {
    const query = jest.fn()

    return {
        trx: { query },
        query
    }
}

describe('sync persistence helpers', () => {
    it('persists application schema sync state into the converged obj_applications table', async () => {
        const mock = createMockTransaction()
        mock.query.mockResolvedValue([{ id: 'application-1' }])

        await persistApplicationSchemaSyncState(mock.trx as never, {
            applicationId: 'application-1',
            schemaStatus: ApplicationSchemaStatus.SYNCED,
            schemaError: null,
            schemaSyncedAt: new Date('2026-03-12T12:00:00.000Z'),
            schemaSnapshot: { entities: [] },
            lastSyncedPublicationVersionId: 'publication-version-1',
            appStructureVersion: 53,
            userId: 'user-1'
        })

        expect(mock.query).toHaveBeenCalledTimes(1)
        const [sql, params] = mock.query.mock.calls[0]
        expect(sql).toContain('UPDATE applications.obj_applications')
        expect(sql).toContain('RETURNING id')
        expect(sql).toContain('workspaces_enabled = COALESCE($8, workspaces_enabled)')
        expect(sql).toContain('WHERE id = $10 AND _upl_deleted = false AND _app_deleted = false')
        expect(params).toEqual([
            ApplicationSchemaStatus.SYNCED,
            null,
            new Date('2026-03-12T12:00:00.000Z'),
            JSON.stringify({ entities: [] }),
            'publication-version-1',
            53,
            null,
            undefined,
            'user-1',
            'application-1'
        ])
    })

    it('fails loudly when the application sync state update touches no active rows', async () => {
        const mock = createMockTransaction()
        mock.query.mockResolvedValue([])

        await expect(
            persistApplicationSchemaSyncState(mock.trx as never, {
                applicationId: 'missing-application',
                schemaStatus: ApplicationSchemaStatus.FAILED,
                schemaError: 'boom',
                schemaSyncedAt: null,
                schemaSnapshot: null,
                lastSyncedPublicationVersionId: null,
                appStructureVersion: null,
                userId: null
            })
        ).rejects.toThrow('Application missing-application not found while persisting schema sync state')
    })

    it('touches connector sync audit fields in the converged obj_connectors table', async () => {
        const mock = createMockTransaction()
        mock.query.mockResolvedValue([{ id: 'connector-1' }])

        await persistConnectorSyncTouch(mock.trx as never, {
            connectorId: 'connector-1',
            userId: 'user-1'
        })

        expect(mock.query).toHaveBeenCalledTimes(1)
        const [sql, params] = mock.query.mock.calls[0]
        expect(sql).toContain('UPDATE applications.obj_connectors')
        expect(sql).toContain('RETURNING id')
        expect(sql).toContain('WHERE id = $2 AND _upl_deleted = false AND _app_deleted = false')
        expect(params).toEqual(['user-1', 'connector-1'])
    })

    it('fails loudly when the connector touch update misses the active connector row', async () => {
        const mock = createMockTransaction()
        mock.query.mockResolvedValue([])

        await expect(
            persistConnectorSyncTouch(mock.trx as never, {
                connectorId: 'missing-connector',
                userId: null
            })
        ).rejects.toThrow('Connector missing-connector not found while touching sync audit fields')
    })
})
