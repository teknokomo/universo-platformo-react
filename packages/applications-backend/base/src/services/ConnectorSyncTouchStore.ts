import type { Knex } from 'knex'

export interface PersistConnectorSyncTouchInput {
    connectorId: string
    userId?: string | null
}

export const persistConnectorSyncTouch = async (trx: Knex.Transaction, input: PersistConnectorSyncTouchInput): Promise<void> => {
    const result = await trx
        .withSchema('applications')
        .table('cat_connectors')
        .where({ id: input.connectorId, _upl_deleted: false, _app_deleted: false })
        .update({
            _upl_updated_at: trx.fn.now(),
            _upl_updated_by: input.userId ?? null,
            _upl_version: trx.raw('COALESCE(_upl_version, 1) + 1')
        })

    if (Number(result) < 1) {
        throw new Error(`Connector ${input.connectorId} not found while touching sync audit fields`)
    }
}
