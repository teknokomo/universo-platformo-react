import { ApplicationSchemaStatus } from '@universo/types'
import { persistApplicationSchemaSyncState } from '../../domains/applications/services/ApplicationSchemaStateStore'

describe('ApplicationSchemaStateStore', () => {
    it('updates application schema state with audit/version fields', async () => {
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

        expect(withSchema).toHaveBeenCalledWith('applications')
        expect(table).toHaveBeenCalledWith('applications')
        expect(where).toHaveBeenCalledWith({ id: 'app-1' })
        expect(raw).toHaveBeenCalledWith('COALESCE(_upl_version, 1) + 1')
        expect(update).toHaveBeenCalledWith(
            expect.objectContaining({
                schema_status: ApplicationSchemaStatus.SYNCED,
                schema_error: null,
                schema_snapshot: { entities: {} },
                last_synced_publication_version_id: 'pub-ver-1',
                app_structure_version: 1,
                _upl_updated_at: 'NOW()',
                _upl_updated_by: 'user-1',
                _upl_version: 'VERSION_INCREMENT'
            })
        )
    })

    it('throws when the application row is missing', async () => {
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
        ).rejects.toThrow('Application missing-app not found while persisting schema sync state')
    })
})
