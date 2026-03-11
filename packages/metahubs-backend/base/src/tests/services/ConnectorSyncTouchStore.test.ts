import { persistConnectorSyncTouch } from '../../domains/applications/services/ConnectorSyncTouchStore'

describe('ConnectorSyncTouchStore', () => {
    it('updates connector audit fields and version counter', async () => {
        const update = jest.fn().mockResolvedValue(1)
        const where = jest.fn(() => ({ update }))
        const table = jest.fn(() => ({ where }))
        const withSchema = jest.fn(() => ({ table }))
        const raw = jest.fn(() => 'VERSION_INCREMENT')
        const trx = {
            withSchema,
            raw,
            fn: {
                now: jest.fn(() => 'NOW()')
            }
        } as unknown as import('knex').Knex.Transaction

        await persistConnectorSyncTouch(trx, {
            connectorId: 'connector-1',
            userId: 'user-1'
        })

        expect(withSchema).toHaveBeenCalledWith('applications')
        expect(table).toHaveBeenCalledWith('connectors')
        expect(where).toHaveBeenCalledWith({ id: 'connector-1' })
        expect(raw).toHaveBeenCalledWith('COALESCE(_upl_version, 1) + 1')
        expect(update).toHaveBeenCalledWith({
            _upl_updated_at: 'NOW()',
            _upl_updated_by: 'user-1',
            _upl_version: 'VERSION_INCREMENT'
        })
    })

    it('throws when the connector row is missing', async () => {
        const update = jest.fn().mockResolvedValue(0)
        const where = jest.fn(() => ({ update }))
        const table = jest.fn(() => ({ where }))
        const withSchema = jest.fn(() => ({ table }))
        const trx = {
            withSchema,
            raw: jest.fn(() => 'VERSION_INCREMENT'),
            fn: {
                now: jest.fn(() => 'NOW()')
            }
        } as unknown as import('knex').Knex.Transaction

        await expect(
            persistConnectorSyncTouch(trx, {
                connectorId: 'missing-connector',
                userId: null
            })
        ).rejects.toThrow('Connector missing-connector not found while touching sync audit fields')
    })
})
