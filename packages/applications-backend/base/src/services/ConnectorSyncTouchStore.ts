import type { SqlQueryable } from '@universo/utils'

export interface PersistConnectorSyncTouchInput {
    connectorId: string
    userId?: string | null
}

export const persistConnectorSyncTouch = async (trx: SqlQueryable, input: PersistConnectorSyncTouchInput): Promise<void> => {
    const rows = await trx.query<{ id: string }>(
        `UPDATE applications.obj_connectors
         SET _upl_updated_at = NOW(),
             _upl_updated_by = $1,
             _upl_version = COALESCE(_upl_version, 1) + 1
         WHERE id = $2 AND _upl_deleted = false AND _app_deleted = false
         RETURNING id`,
        [input.userId ?? null, input.connectorId]
    )

    if (rows.length < 1) {
        throw new Error(`Connector ${input.connectorId} not found while touching sync audit fields`)
    }
}
