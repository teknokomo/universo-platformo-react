import type { DbExecutor } from '@universo-react/utils'
import { resolveWorkspaceSettingAddressRows } from '../../persistence/workspaceSettingsResolutionStore'

describe('resolveWorkspaceSettingAddressRows', () => {
    const schemaName = 'app_018f8a787b8f7c1da111222233334441'
    const workspaceId = '018f8a78-7b8f-7c1d-a111-2222333344aa'
    const layoutId = '018f8a78-7b8f-7c1d-a111-2222333344bb'
    const widgetId = '018f8a78-7b8f-7c1d-a111-2222333344bc'

    it('rejects an effective layout when a widget ID now belongs to a different instance key', async () => {
        const query = jest.fn(async (sql: string) => {
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334441"."_app_layouts"')) {
                return [{ id: layoutId, version: 7 }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334441"."_app_widgets"') && sql.includes('id = ANY')) {
                return [{ id: widgetId, instanceKey: 'replacement-key' }]
            }
            throw new Error(`Unexpected SQL: ${sql}`)
        })
        const executor = { query } as unknown as DbExecutor

        const result = await resolveWorkspaceSettingAddressRows(
            executor,
            { schemaName, workspaceId },
            [{ key: 'interpretationNetwork.cellStylePolicy.editable.fillColor', target: { kind: 'widget', instanceKey: 'matrix-main' } }],
            true,
            {
                layout: { id: layoutId, version: 7 },
                widgets: [{ id: widgetId, instanceKey: 'matrix-main', isActive: true }]
            }
        )

        expect(result).toEqual({ ok: false, reason: 'widget-inactive' })
        expect(query).toHaveBeenCalledTimes(2)
    })
})
