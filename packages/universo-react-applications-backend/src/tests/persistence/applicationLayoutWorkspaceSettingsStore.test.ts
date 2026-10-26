import { tombstoneApplicationLayoutWorkspaceSettings } from '../../persistence/applicationLayoutWorkspaceSettingsStore'
import { createMockDbExecutor } from '../utils/dbMocks'

const schemaName = 'app_018f8a787b8f7c1da111222233334444'
const layoutId = '0190a9b5-3cde-7abc-8def-2123456789d1'

describe('application layout workspace settings persistence', () => {
    it('skips cleanup when workspace support has not created its optional table', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([{ exists: false }])

        await expect(tombstoneApplicationLayoutWorkspaceSettings(executor, schemaName, layoutId, 'user-1', true)).resolves.toBeUndefined()

        expect(executor.query).toHaveBeenCalledTimes(1)
        expect(executor.query.mock.calls[0]?.[0]).toContain('information_schema.tables')
        expect(executor.query.mock.calls[0]?.[1]).toEqual([schemaName, '_app_workspace_settings'])
    })

    it('tombstones layout settings when workspace support exists', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([{ exists: true }]).mockResolvedValueOnce([
            {
                id: '0190a9b5-3cde-7abc-8def-2123456789d2',
                target_owner_id: layoutId,
                _upl_deleted: true,
                _app_deleted: true
            }
        ])

        await expect(tombstoneApplicationLayoutWorkspaceSettings(executor, schemaName, layoutId, 'user-1', true)).resolves.toBeUndefined()

        expect(executor.query).toHaveBeenCalledTimes(2)
        expect(executor.query.mock.calls[1]?.[0]).toContain(`UPDATE "${schemaName}"."_app_workspace_settings"`)
        expect(executor.query.mock.calls[1]?.[1]).toEqual([layoutId, 'user-1', true])
    })

    it('fails closed when the workspace settings table lookup is malformed', async () => {
        const { executor } = createMockDbExecutor()

        await expect(tombstoneApplicationLayoutWorkspaceSettings(executor, schemaName, layoutId, 'user-1', true)).rejects.toThrow(
            'APPLICATION_LAYOUT_WORKSPACE_SETTINGS_SCHEMA_LOOKUP_FAILED'
        )

        expect(executor.query).toHaveBeenCalledTimes(1)
    })
})
