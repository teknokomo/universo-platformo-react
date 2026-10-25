import {
    WORKSPACE_SETTINGS_ERROR_CODES,
    isWorkspaceSettingAddressAllowed,
    listRuntimeWorkspaceSettings,
    resetWorkspaceSettingOverride,
    resolveEffectiveWorkspaceWidgetConfig,
    upsertWorkspaceSettingOverride,
    updateWorkspaceSettingOverrides,
    workspaceSettingBatchUpdateSchema
} from '../../services/workspaceSettingsService'
import { createMockDbExecutor } from '../utils/dbMocks'

const mockResolveEffectiveLayoutStructureForRequest = jest.fn()

jest.mock('../../services/effectiveLayoutResolverCore', () => ({
    __esModule: true,
    EffectiveLayoutError: class EffectiveLayoutError extends Error {},
    resolveEffectiveLayoutStructureForRequest: (...args: unknown[]) => mockResolveEffectiveLayoutStructureForRequest(...args)
}))

describe('workspaceSettingsService', () => {
    const schemaName = 'app_018f8a787b8f7c1da111222233334441'
    const workspaceId = '018f8a78-7b8f-7c1d-a111-2222333344aa'
    const layoutId = '018f8a78-7b8f-7c1d-a111-2222333344bb'
    const applicationId = '018f8a78-7b8f-7c1d-a111-2222333344ac'
    const globalTarget = { kind: 'global' as const }
    const widgetTarget = { kind: 'widget' as const, instanceKey: 'matrix-main' }
    const applicationSettings = {
        sectionLinksEnabled: true,
        dashboardDefaultMode: 'layout-default',
        workspaceOverrides: {
            allowedAddresses: [
                { key: 'sectionLinksEnabled', target: globalTarget },
                { key: 'dashboardDefaultMode', target: globalTarget }
            ],
            lockedAddresses: []
        }
    }

    it('defaults key-only v1 requests to global and rejects physical layout/widget identities', () => {
        expect(
            workspaceSettingBatchUpdateSchema.safeParse({ settings: [{ key: 'sectionLinksEnabled', value: false }] }).data
        ).toMatchObject({
            settings: [{ key: 'sectionLinksEnabled', target: { kind: 'global' }, value: false }]
        })
        expect(
            workspaceSettingBatchUpdateSchema.safeParse({
                settings: [
                    {
                        key: 'sectionLinksEnabled',
                        target: globalTarget,
                        value: false,
                        layoutId
                    }
                ]
            }).success
        ).toBe(false)
        expect(
            workspaceSettingBatchUpdateSchema.safeParse({
                settings: [{ key: 'sectionLinksEnabled', target: { ...widgetTarget, widgetId: 'untrusted-widget-id' }, value: false }]
            }).success
        ).toBe(false)
    })

    it('does not grant defaults from the retired key-only Application policy', () => {
        expect(
            isWorkspaceSettingAddressAllowed(
                { workspaceOverrides: { allowedKeys: ['sectionLinksEnabled'], lockedKeys: [] } },
                { key: 'sectionLinksEnabled', target: globalTarget }
            )
        ).toBe(false)
    })

    it('persists a global override under the workspace target and locks the complete address', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const generatedId = '018f8a78-7b8f-7c1d-a111-2222333344bc'

        txExecutor.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes(`FROM "${schemaName}"."_app_workspace_settings"`) && sql.includes('LIMIT 1')) return []
            if (sql.includes('COALESCE(MAX(')) return [{ version: 0 }]
            if (sql.includes('SELECT public.uuid_generate_v7() AS id')) return [{ id: generatedId }]
            if (sql.includes(`INSERT INTO "${schemaName}"."_app_workspace_settings"`)) {
                expect(params).toEqual([
                    generatedId,
                    workspaceId,
                    'global',
                    workspaceId,
                    '',
                    'sectionLinksEnabled',
                    'false',
                    1,
                    'user-1',
                    'user-1'
                ])
                return [{ key: 'sectionLinksEnabled', value: false, version: 1 }]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_workspace_settings" setting_row`)) {
                return [
                    {
                        key: 'sectionLinksEnabled',
                        targetKind: 'global',
                        targetOwnerId: workspaceId,
                        targetKey: '',
                        value: false,
                        version: 1
                    }
                ]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_layouts"`)) return []
            throw new Error(`Unexpected SQL: ${sql}`)
        })

        const result = await updateWorkspaceSettingOverrides(executor, {
            schemaName,
            workspaceId,
            applicationSettings,
            settings: [{ key: 'sectionLinksEnabled', target: globalTarget, value: false }],
            resets: [],
            actorUserId: 'user-1'
        })

        const lockKey = txExecutor.query.mock.calls.find(([sql]) => String(sql).includes('pg_advisory_xact_lock'))?.[1]?.[0]
        expect(JSON.parse(String(lockKey))).toEqual([
            schemaName,
            'workspace-settings',
            workspaceId,
            'global',
            workspaceId,
            '',
            'sectionLinksEnabled'
        ])
        expect(result.items.find((setting) => setting.key === 'sectionLinksEnabled')).toEqual(
            expect.objectContaining({
                target: globalTarget,
                value: false,
                source: 'workspace',
                version: 1
            })
        )
        expect(result.layoutToken).toBeNull()
    })

    it('requires the current version when updating an existing workspace override', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes(`FROM "${schemaName}"."_app_workspace_settings"`) && sql.includes('LIMIT 1')) {
                return [{ id: '018f8a78-7b8f-7c1d-a111-2222333344be', version: 4 }]
            }
            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await expect(
            upsertWorkspaceSettingOverride(executor, {
                schemaName,
                workspaceId,
                applicationSettings,
                key: 'sectionLinksEnabled',
                target: globalTarget,
                value: false
            })
        ).rejects.toMatchObject({ code: WORKSPACE_SETTINGS_ERROR_CODES.settingConflict })

        await expect(
            upsertWorkspaceSettingOverride(executor, {
                schemaName,
                workspaceId,
                applicationSettings,
                key: 'sectionLinksEnabled',
                target: globalTarget,
                value: false,
                expectedVersion: 0
            })
        ).rejects.toMatchObject({ code: WORKSPACE_SETTINGS_ERROR_CODES.settingConflict })

        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes(`UPDATE "${schemaName}"."_app_workspace_settings"`))).toBe(
            false
        )
    })

    it('guards workspace override updates and resets with the expected database version', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const settingId = '018f8a78-7b8f-7c1d-a111-2222333344bf'
        let currentVersion = 4
        txExecutor.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes(`FROM "${schemaName}"."_app_workspace_settings"`) && sql.includes('LIMIT 1')) {
                return [{ id: settingId, version: currentVersion }]
            }
            if (sql.includes(`UPDATE "${schemaName}"."_app_workspace_settings"`) && sql.includes('RETURNING key, value')) {
                expect(sql).toContain('"_upl_version" = $9')
                expect(params).toEqual([settingId, 'false', null, workspaceId, 'global', workspaceId, '', 'sectionLinksEnabled', 4])
                currentVersion = 5
                return [{ key: 'sectionLinksEnabled', value: false, version: 5 }]
            }
            if (sql.includes(`UPDATE "${schemaName}"."_app_workspace_settings"`) && sql.includes('RETURNING id')) {
                expect(sql).toContain('"_upl_version" = $8')
                expect(params).toEqual([settingId, null, workspaceId, 'global', workspaceId, '', 'sectionLinksEnabled', 5])
                return [{ id: settingId }]
            }
            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await expect(
            upsertWorkspaceSettingOverride(executor, {
                schemaName,
                workspaceId,
                applicationSettings,
                key: 'sectionLinksEnabled',
                target: globalTarget,
                value: false,
                expectedVersion: 4
            })
        ).resolves.toMatchObject({ version: 5 })

        await expect(
            resetWorkspaceSettingOverride(executor, {
                schemaName,
                workspaceId,
                applicationSettings,
                key: 'sectionLinksEnabled',
                target: globalTarget,
                expectedVersion: 5
            })
        ).resolves.toBeUndefined()
    })

    it('resolves widget addresses against the active default Application layout before persisting', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const generatedId = '018f8a78-7b8f-7c1d-a111-2222333344bd'
        const key = 'interpretationNetwork.cellStylePolicy.editable.fillColor'
        const typedSettings = {
            workspaceOverrides: {
                allowedAddresses: [{ key, target: widgetTarget }],
                lockedAddresses: []
            }
        }

        txExecutor.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
            if (sql.includes(`FROM "${schemaName}"."_app_workspace_settings" setting_row`)) {
                return [
                    {
                        key,
                        targetKind: 'widget',
                        targetOwnerId: layoutId,
                        targetKey: 'matrix-main',
                        value: true,
                        version: 1
                    }
                ]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_layouts"`)) return [{ id: layoutId, version: 4 }]
            if (sql.includes(`FROM "${schemaName}"."_app_widgets"`)) {
                expect(params).toEqual([layoutId, ['matrix-main']])
                expect(sql).toContain('is_active = true')
                expect(sql).toContain('FOR SHARE')
                return [{ instanceKey: 'matrix-main' }]
            }
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes(`FROM "${schemaName}"."_app_workspace_settings"`) && sql.includes('LIMIT 1')) return []
            if (sql.includes('COALESCE(MAX(')) return [{ version: 0 }]
            if (sql.includes('SELECT public.uuid_generate_v7() AS id')) return [{ id: generatedId }]
            if (sql.includes(`INSERT INTO "${schemaName}"."_app_workspace_settings"`)) {
                expect(params).toEqual([generatedId, workspaceId, 'widget', layoutId, 'matrix-main', key, 'true', 1, 'user-1', 'user-1'])
                return [{ key, value: true, version: 1 }]
            }
            throw new Error(`Unexpected SQL: ${sql}`)
        })

        const result = await updateWorkspaceSettingOverrides(executor, {
            schemaName,
            workspaceId,
            applicationSettings: typedSettings,
            settings: [{ key, target: widgetTarget, value: true }],
            resets: [],
            actorUserId: 'user-1'
        })

        const insertCall = txExecutor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."_app_workspace_settings"`)
        )
        expect(insertCall?.[0]).toContain('target_owner_id')
        expect(insertCall?.[1]).toEqual(expect.arrayContaining([layoutId, 'matrix-main']))
        expect(result.widgetOverrides).toEqual([{ key, target: widgetTarget, value: true, version: 1 }])
        expect(result.layoutToken).toMatch(/^[a-f0-9]{64}$/u)
    })

    it('acquires mixed set/reset locks in canonical resolved-address order', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const generatedIds = ['setting-1', 'setting-2']
        const alphaTarget = { kind: 'widget' as const, instanceKey: 'alpha' }
        const zetaTarget = { kind: 'widget' as const, instanceKey: 'zeta' }
        const alphaKey = 'interpretationNetwork.cellStylePolicy.editable.fillColor'
        const zetaKey = 'interpretationNetwork.cellStylePolicy.editable.textColor'
        const typedSettings = {
            workspaceOverrides: {
                allowedAddresses: [
                    { key: 'dashboardDefaultMode', target: globalTarget },
                    { key: 'sectionLinksEnabled', target: globalTarget },
                    { key: alphaKey, target: alphaTarget },
                    { key: zetaKey, target: zetaTarget }
                ],
                lockedAddresses: []
            }
        }

        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes(`FROM "${schemaName}"."_app_layouts"`)) return [{ id: layoutId, version: 6 }]
            if (sql.includes(`FROM "${schemaName}"."_app_widgets"`)) return [{ instanceKey: 'alpha' }, { instanceKey: 'zeta' }]
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes(`FROM "${schemaName}"."_app_workspace_settings"`) && sql.includes('LIMIT 1')) return []
            if (sql.includes('COALESCE(MAX(')) return [{ version: 0 }]
            if (sql.includes('SELECT public.uuid_generate_v7() AS id')) return [{ id: generatedIds.shift() }]
            if (sql.includes(`INSERT INTO "${schemaName}"."_app_workspace_settings"`)) {
                return [{ key: 'inserted', value: null, version: 1 }]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_workspace_settings"`)) return []
            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await updateWorkspaceSettingOverrides(executor, {
            schemaName,
            workspaceId,
            applicationSettings: typedSettings,
            settings: [
                { key: zetaKey, target: zetaTarget, value: true },
                { key: 'sectionLinksEnabled', target: globalTarget, value: false }
            ],
            resets: [
                { key: alphaKey, target: alphaTarget },
                { key: 'dashboardDefaultMode', target: globalTarget }
            ]
        })

        const lockKeys = txExecutor.query.mock.calls
            .filter(([sql]) => String(sql).includes('pg_advisory_xact_lock'))
            .map(([, params]) => JSON.parse(String(params?.[0])) as string[])
        expect(lockKeys[0]).toEqual([schemaName, 'workspace-settings-policy', workspaceId, 'interpretationNetwork.cellStylePolicy'])
        expect(lockKeys.slice(1).map((key) => key.slice(3))).toEqual([
            ['global', workspaceId, '', 'dashboardDefaultMode'],
            ['global', workspaceId, '', 'sectionLinksEnabled'],
            ['widget', layoutId, 'alpha', alphaKey],
            ['widget', layoutId, 'zeta', zetaKey]
        ])
    })

    it('fails closed on stale widget rows when listing overrides for a replacement layout', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes(`FROM "${schemaName}"."_app_layouts"`)) return [{ id: 'replacement-layout', version: 1 }]
            if (sql.includes(`FROM "${schemaName}"."_app_workspace_settings"`)) return []
            throw new Error(`Unexpected SQL: ${sql}`)
        })

        const result = await listRuntimeWorkspaceSettings(executor, {
            schemaName,
            workspaceId,
            applicationSettings: {
                workspaceOverrides: {
                    allowedAddresses: [{ key: 'widget.setting', target: widgetTarget }],
                    lockedAddresses: []
                }
            }
        })

        const listCall = txExecutor.query.mock.calls.find(([sql]) => String(sql).includes(`FROM "${schemaName}"."_app_workspace_settings"`))
        expect(listCall?.[0]).toContain('layout_row.id = setting_row.target_owner_id')
        expect(listCall?.[0]).toContain('widget_row.instance_key = setting_row.target_key')
        expect(result.widgetOverrides).toEqual([])
        expect(result.layoutToken).toMatch(/^[a-f0-9]{64}$/u)
    })

    it('rejects un-delegated widget addresses before database access', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        await expect(
            updateWorkspaceSettingOverrides(executor, {
                schemaName,
                workspaceId,
                applicationSettings: { workspaceOverrides: { allowedAddresses: [], lockedAddresses: [] } },
                settings: [{ key: 'widget.setting', target: widgetTarget, value: true }],
                resets: []
            })
        ).rejects.toMatchObject({ code: WORKSPACE_SETTINGS_ERROR_CODES.settingNotAllowed })
        expect(txExecutor.query).not.toHaveBeenCalled()
    })

    it('uses the effective layout and delegated Workspace rows for the Settings widget config resolver', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const allowedColorsKey = 'interpretationNetwork.cellStylePolicy.allowedColors'
        const fillColorKey = 'interpretationNetwork.cellStylePolicy.editable.fillColor'
        const lockedKey = 'interpretationNetwork.cellStylePolicy.allowCustomColors'
        const target = { applicationId, targetKind: null, workspaceId, locale: 'en' } as const
        const authContext = { applicationId, userId: 'user-1', role: 'owner' as const }
        const widgetConfig = {
            cellStylePolicy: {
                allowedColors: ['#abc', '#00ff00'],
                allowCustomColors: false,
                editable: {
                    fillColor: false,
                    textColor: false,
                    borderColor: false,
                    borderWidth: false,
                    borderStyle: false
                }
            },
            displayMode: 'grid'
        }
        const applicationPolicy = {
            workspaceOverrides: {
                allowedAddresses: [
                    { key: allowedColorsKey, target: widgetTarget },
                    { key: fillColorKey, target: widgetTarget },
                    { key: 'interpretationNetwork.cellStylePolicy.editable.textColor', target: widgetTarget },
                    { key: lockedKey, target: widgetTarget }
                ],
                lockedAddresses: [{ key: lockedKey, target: widgetTarget }]
            }
        }

        mockResolveEffectiveLayoutStructureForRequest.mockResolvedValue({
            layout: { id: layoutId, version: 7 },
            widgets: [
                {
                    id: '018f8a78-7b8f-7c1d-a111-2222333344be',
                    instanceKey: widgetTarget.instanceKey,
                    widgetKey: 'interpretationNetworkWorkspace',
                    config: widgetConfig,
                    isActive: true,
                    zone: 'center',
                    semanticRegion: 'main'
                }
            ]
        })
        txExecutor.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
            if (sql.includes(`FROM "${schemaName}"."_app_workspace_settings" setting_row`)) {
                expect(params).toEqual([workspaceId, layoutId])
                return [
                    {
                        key: allowedColorsKey,
                        targetKind: 'widget',
                        targetOwnerId: layoutId,
                        targetKey: widgetTarget.instanceKey,
                        value: ['#123', '#AABBCC', '#def'],
                        version: 2
                    },
                    {
                        key: fillColorKey,
                        targetKind: 'widget',
                        targetOwnerId: layoutId,
                        targetKey: widgetTarget.instanceKey,
                        value: true,
                        version: 3
                    },
                    {
                        key: lockedKey,
                        targetKind: 'widget',
                        targetOwnerId: layoutId,
                        targetKey: widgetTarget.instanceKey,
                        value: true,
                        version: 4
                    }
                ]
            }
            throw new Error(`Unexpected SQL: ${sql}`)
        })

        const resolved = await resolveEffectiveWorkspaceWidgetConfig(executor, {
            schemaName,
            workspaceId,
            applicationSettings: applicationPolicy,
            authContext,
            runtimeTarget: target,
            instanceKey: widgetTarget.instanceKey
        })

        expect(mockResolveEffectiveLayoutStructureForRequest).toHaveBeenCalledWith(txExecutor, authContext, target)
        expect(resolved).toMatchObject({
            target: widgetTarget,
            widgetKey: 'interpretationNetworkWorkspace',
            config: {
                displayMode: 'grid',
                cellStylePolicy: {
                    allowedColors: ['#112233', '#AABBCC', '#DDEEFF'],
                    allowCustomColors: false,
                    editable: {
                        fillColor: true,
                        textColor: false,
                        borderColor: false,
                        borderWidth: false,
                        borderStyle: false
                    }
                }
            }
        })
        expect(resolved.layoutToken).toMatch(/^[a-f0-9]{64}$/u)

        const settings = await listRuntimeWorkspaceSettings(executor, {
            schemaName,
            workspaceId,
            applicationSettings: applicationPolicy,
            authContext,
            runtimeTarget: target
        })
        expect(settings.effectiveWidgetConfigs).toHaveLength(1)
        expect(settings.effectiveWidgetConfigs[0]).toMatchObject({
            target: widgetTarget,
            zone: 'center',
            semanticRegion: 'main',
            config: resolved.config,
            layoutToken: resolved.layoutToken
        })
        expect(settings.widgetSettings).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    key: allowedColorsKey,
                    target: widgetTarget,
                    value: ['#112233', '#AABBCC', '#DDEEFF'],
                    source: 'workspace',
                    isInherited: false,
                    allowed: true,
                    version: 2
                }),
                expect.objectContaining({
                    key: 'interpretationNetwork.cellStylePolicy.editable.textColor',
                    target: widgetTarget,
                    value: false,
                    source: 'application',
                    isInherited: true,
                    allowed: true,
                    version: null
                })
            ])
        )
        expect(settings.widgetSettings.some((setting) => setting.key === lockedKey)).toBe(false)
    })
})
