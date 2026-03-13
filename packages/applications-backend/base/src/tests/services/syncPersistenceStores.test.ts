import { persistApplicationSchemaSyncState } from '../../services/ApplicationSchemaSyncStateStore'
import { persistConnectorSyncTouch } from '../../services/ConnectorSyncTouchStore'

function createMockTransaction() {
    const update = jest.fn()
    const where = jest.fn(() => ({ update }))
    const table = jest.fn(() => ({ where }))
    const withSchema = jest.fn(() => ({ table }))

    return {
        trx: {
            withSchema,
            fn: {
                now: jest.fn(() => 'NOW')
            },
            raw: jest.fn((value: string) => value)
        },
        withSchema,
        table,
        where,
        update
    }
}

describe('sync persistence helpers', () => {
    it('persists application schema sync state into the converged cat_applications table', async () => {
        const mock = createMockTransaction()
        mock.update.mockResolvedValue(1)

        await persistApplicationSchemaSyncState(mock.trx as never, {
            applicationId: 'application-1',
            schemaStatus: 'synced' as never,
            schemaError: null,
            schemaSyncedAt: new Date('2026-03-12T12:00:00.000Z'),
            schemaSnapshot: { entities: [] },
            lastSyncedPublicationVersionId: 'publication-version-1',
            appStructureVersion: 53,
            userId: 'user-1'
        })

        expect(mock.withSchema).toHaveBeenCalledWith('applications')
        expect(mock.table).toHaveBeenCalledWith('cat_applications')
        expect(mock.where).toHaveBeenCalledWith({
            id: 'application-1',
            _upl_deleted: false,
            _app_deleted: false
        })
        expect(mock.update).toHaveBeenCalledWith(
            expect.objectContaining({
                schema_status: 'synced',
                last_synced_publication_version_id: 'publication-version-1',
                app_structure_version: 53,
                _upl_updated_by: 'user-1',
                _upl_version: 'COALESCE(_upl_version, 1) + 1'
            })
        )
    })

    it('fails loudly when the application sync state update touches no active rows', async () => {
        const mock = createMockTransaction()
        mock.update.mockResolvedValue(0)

        await expect(
            persistApplicationSchemaSyncState(mock.trx as never, {
                applicationId: 'missing-application',
                schemaStatus: 'failed' as never,
                schemaError: 'boom',
                schemaSyncedAt: null,
                schemaSnapshot: null,
                lastSyncedPublicationVersionId: null,
                appStructureVersion: null,
                userId: null
            })
        ).rejects.toThrow('Application missing-application not found while persisting schema sync state')
    })

    it('touches connector sync audit fields in the converged cat_connectors table', async () => {
        const mock = createMockTransaction()
        mock.update.mockResolvedValue(1)

        await persistConnectorSyncTouch(mock.trx as never, {
            connectorId: 'connector-1',
            userId: 'user-1'
        })

        expect(mock.withSchema).toHaveBeenCalledWith('applications')
        expect(mock.table).toHaveBeenCalledWith('cat_connectors')
        expect(mock.where).toHaveBeenCalledWith({
            id: 'connector-1',
            _upl_deleted: false,
            _app_deleted: false
        })
        expect(mock.update).toHaveBeenCalledWith(
            expect.objectContaining({
                _upl_updated_by: 'user-1',
                _upl_version: 'COALESCE(_upl_version, 1) + 1'
            })
        )
    })

    it('fails loudly when the connector touch update misses the active connector row', async () => {
        const mock = createMockTransaction()
        mock.update.mockResolvedValue(0)

        await expect(
            persistConnectorSyncTouch(mock.trx as never, {
                connectorId: 'missing-connector',
                userId: null
            })
        ).rejects.toThrow('Connector missing-connector not found while touching sync audit fields')
    })
})
