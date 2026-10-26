import type { DbExecutor } from '@universo-react/utils'
import { insertWorkspaceSettingsForCopy, listWorkspaceSettingsSnapshotForCopy } from '../../persistence/workspaceSettingsCopyStore'

describe('workspaceSettingsCopyStore', () => {
    const schemaName = 'app_018f8a787b8f7c1da111222233334441'

    it('lists source overrides from the materialized workspace snapshot', async () => {
        const rows = [{ key: 'sectionLinksEnabled', targetKind: 'global', targetOwnerId: 'source', targetKey: '', value: true }]
        const executor = { query: jest.fn().mockResolvedValue(rows) } as unknown as DbExecutor

        await expect(listWorkspaceSettingsSnapshotForCopy(executor, 'source')).resolves.toEqual(rows)

        expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('FROM workspace_copy_source_settings'), ['source'])
        expect(executor.query).not.toHaveBeenCalledWith(expect.stringContaining('_app_workspace_settings'), expect.anything())
    })

    it('bulk inserts validated settings with database-generated UUID v7 identities', async () => {
        const executor = { query: jest.fn().mockResolvedValue([{ id: '019f2000-0000-7000-8000-000000000001' }]) } as unknown as DbExecutor

        await insertWorkspaceSettingsForCopy(executor, {
            schemaName,
            targetWorkspaceId: '019f2000-0000-7000-8000-000000000002',
            actorUserId: '019f2000-0000-7000-8000-000000000003',
            settings: [
                {
                    targetKind: 'widget',
                    targetOwnerId: '019f2000-0000-7000-8000-000000000004',
                    targetKey: 'matrix-main',
                    key: 'interpretationNetwork.cellStylePolicy.editable.fillColor',
                    value: true
                }
            ]
        })

        const [sql, params] = jest.mocked(executor.query).mock.calls[0] as [string, unknown[]]
        expect(sql).toContain('public.uuid_generate_v7()')
        expect(sql).toContain('jsonb_to_recordset($1::jsonb)')
        expect(sql).toContain('target_owner_id uuid')
        expect(params).toEqual([
            JSON.stringify([
                {
                    target_kind: 'widget',
                    target_owner_id: '019f2000-0000-7000-8000-000000000004',
                    target_key: 'matrix-main',
                    key: 'interpretationNetwork.cellStylePolicy.editable.fillColor',
                    value: true
                }
            ]),
            '019f2000-0000-7000-8000-000000000002',
            '019f2000-0000-7000-8000-000000000003'
        ])
    })

    it('avoids a database call for an empty batch and fails closed on a partial insert', async () => {
        const executor = { query: jest.fn().mockResolvedValue([]) } as unknown as DbExecutor
        const input = {
            schemaName,
            targetWorkspaceId: '019f2000-0000-7000-8000-000000000002',
            actorUserId: null,
            settings: [
                {
                    targetKind: 'global' as const,
                    targetOwnerId: '019f2000-0000-7000-8000-000000000002',
                    targetKey: '',
                    key: 'sectionLinksEnabled',
                    value: true
                }
            ]
        }

        await insertWorkspaceSettingsForCopy(executor, { ...input, settings: [] })
        expect(executor.query).not.toHaveBeenCalled()
        await expect(insertWorkspaceSettingsForCopy(executor, input)).rejects.toThrow('WORKSPACE_SETTING_COPY_INSERT_FAILED')
    })
})
