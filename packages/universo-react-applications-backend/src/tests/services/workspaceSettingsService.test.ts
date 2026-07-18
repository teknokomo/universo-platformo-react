import {
    WORKSPACE_SETTINGS_ERROR_CODES,
    listRuntimeWorkspaceSettings,
    updateWorkspaceSettingOverrides
} from '../../services/workspaceSettingsService'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('workspaceSettingsService', () => {
    const schemaName = 'app_018f8a787b8f7c1da111222233334441'
    const workspaceId = '018f8a78-7b8f-7c1d-a111-2222333344aa'
    const applicationSettings = {
        sectionLinksEnabled: true,
        dashboardDefaultMode: 'layout-default',
        workspaceOverrides: {
            allowedKeys: ['sectionLinksEnabled', 'dashboardDefaultMode'],
            lockedKeys: []
        }
    }

    it('serializes first-write updates for a workspace setting with a transaction advisory lock', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const generatedIds = ['018f8a78-7b8f-7c1d-a111-2222333344ab']

        txExecutor.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
            if (sql.includes('pg_advisory_xact_lock')) {
                expect(params).toEqual([`${schemaName}:workspace-settings:${workspaceId}:sectionLinksEnabled`])
                return []
            }

            if (sql.includes('SELECT id') && sql.includes(`FROM "${schemaName}"."_app_workspace_settings"`)) {
                return []
            }

            if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
                return [{ id: generatedIds.shift() }]
            }

            if (sql.includes(`INSERT INTO "${schemaName}"."_app_workspace_settings"`)) {
                expect(params).toEqual([
                    '018f8a78-7b8f-7c1d-a111-2222333344ab',
                    workspaceId,
                    'sectionLinksEnabled',
                    'false',
                    'user-1',
                    'user-1'
                ])
                return [{ key: 'sectionLinksEnabled', value: false, version: 1 }]
            }

            if (sql.includes('ORDER BY key ASC')) {
                return [{ key: 'sectionLinksEnabled', value: false, version: 1 }]
            }

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        const result = await updateWorkspaceSettingOverrides(executor, {
            schemaName,
            workspaceId,
            applicationSettings,
            settings: [{ key: 'sectionLinksEnabled', value: false }],
            resetKeys: [],
            actorUserId: 'user-1'
        })

        expect(result).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    key: 'sectionLinksEnabled',
                    value: false,
                    source: 'workspace',
                    version: 1
                })
            ])
        )
        expect(txExecutor.query.mock.calls[0]?.[0]).toBe('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))')
    })

    it('maps active unique insert races to a deterministic version conflict', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) {
                return []
            }

            if (sql.includes('SELECT id') && sql.includes(`FROM "${schemaName}"."_app_workspace_settings"`)) {
                return []
            }

            if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
                return [{ id: '018f8a78-7b8f-7c1d-a111-2222333344ac' }]
            }

            if (sql.includes(`INSERT INTO "${schemaName}"."_app_workspace_settings"`)) {
                throw Object.assign(new Error('duplicate key value violates unique constraint'), {
                    code: '23505',
                    constraint: '_app_workspace_settings_workspace_key_active_uidx'
                })
            }

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await expect(
            updateWorkspaceSettingOverrides(executor, {
                schemaName,
                workspaceId,
                applicationSettings,
                settings: [{ key: 'sectionLinksEnabled', value: false }],
                resetKeys: [],
                actorUserId: 'user-1'
            })
        ).rejects.toMatchObject({
            code: WORKSPACE_SETTINGS_ERROR_CODES.settingConflict
        })
    })

    it('rejects settings that the application policy does not expose to workspaces', async () => {
        const { executor } = createMockDbExecutor()

        await expect(
            updateWorkspaceSettingOverrides(executor, {
                schemaName,
                workspaceId,
                applicationSettings: {
                    workspaceOverrides: {
                        allowedKeys: [],
                        lockedKeys: ['sectionLinksEnabled']
                    }
                },
                settings: [{ key: 'sectionLinksEnabled', value: false }],
                resetKeys: [],
                actorUserId: 'user-1'
            })
        ).rejects.toMatchObject({
            code: WORKSPACE_SETTINGS_ERROR_CODES.settingNotAllowed
        })
    })

    it('ignores persisted overrides after application policy locks the key', async () => {
        const { executor } = createMockDbExecutor()

        executor.query.mockResolvedValue([
            {
                key: 'sectionLinksEnabled',
                value: false,
                version: 3
            }
        ])

        const result = await listRuntimeWorkspaceSettings(executor, {
            schemaName,
            workspaceId,
            applicationSettings: {
                sectionLinksEnabled: true,
                workspaceOverrides: {
                    allowedKeys: [],
                    lockedKeys: ['sectionLinksEnabled']
                }
            }
        })

        expect(result.find((setting) => setting.key === 'sectionLinksEnabled')).toEqual(
            expect.objectContaining({
                allowed: false,
                source: 'application',
                isInherited: true,
                value: true,
                version: 3
            })
        )
    })

    it('checks expected versions before resetting an override', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) {
                return []
            }

            if (sql.includes('SELECT id') && sql.includes(`FROM "${schemaName}"."_app_workspace_settings"`)) {
                return [{ id: 'setting-1', version: 4 }]
            }

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await expect(
            updateWorkspaceSettingOverrides(executor, {
                schemaName,
                workspaceId,
                applicationSettings,
                settings: [],
                resetKeys: [{ key: 'sectionLinksEnabled', expectedVersion: 3 }],
                actorUserId: 'user-1'
            })
        ).rejects.toMatchObject({
            code: WORKSPACE_SETTINGS_ERROR_CODES.settingConflict
        })
    })

    it('treats reset with expected version as stale when the override no longer exists', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) {
                return []
            }

            if (sql.includes('SELECT id') && sql.includes(`FROM "${schemaName}"."_app_workspace_settings"`)) {
                return []
            }

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await expect(
            updateWorkspaceSettingOverrides(executor, {
                schemaName,
                workspaceId,
                applicationSettings,
                settings: [],
                resetKeys: [{ key: 'sectionLinksEnabled', expectedVersion: 3 }],
                actorUserId: 'user-1'
            })
        ).rejects.toMatchObject({
            code: WORKSPACE_SETTINGS_ERROR_CODES.settingConflict
        })
    })

    it('keeps idempotent reset without expected version safe when the override is already absent', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) {
                return []
            }

            if (sql.includes('SELECT id') && sql.includes(`FROM "${schemaName}"."_app_workspace_settings"`)) {
                return []
            }

            if (sql.includes('ORDER BY key ASC')) {
                return []
            }

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        const result = await updateWorkspaceSettingOverrides(executor, {
            schemaName,
            workspaceId,
            applicationSettings,
            settings: [],
            resetKeys: [{ key: 'sectionLinksEnabled' }],
            actorUserId: 'user-1'
        })

        expect(result.find((setting) => setting.key === 'sectionLinksEnabled')).toEqual(
            expect.objectContaining({
                key: 'sectionLinksEnabled',
                source: 'application',
                value: true,
                version: null
            })
        )
    })
})
