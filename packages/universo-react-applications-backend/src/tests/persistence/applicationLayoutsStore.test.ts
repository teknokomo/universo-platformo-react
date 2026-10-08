import {
    createApplicationLayout,
    copyApplicationLayout,
    deleteApplicationLayout,
    listApplicationLayouts,
    listApplicationLayoutWidgetObject,
    resetApplicationLayoutConfig,
    resetApplicationLayoutZoneSetting,
    updateApplicationLayout,
    updateApplicationLayoutZoneSetting
} from '../../persistence/applicationLayoutsStore'
import { buildSingleTargetWidgetBinding, encodeLayoutWidgetConfigEnvelope, LAYOUT_WIDGET_DEFINITIONS } from '@universo-react/types'
import { createMockDbExecutor } from '../utils/dbMocks'
import { independentLayoutConfig, primeLockedLayout } from './applicationLayoutsStore.test-utils'

describe('applicationLayoutsStore layout and scope persistence', () => {
    it('returns complete localized metadata for application layout widgets', () => {
        const items = listApplicationLayoutWidgetObject()
        const marketingItems = items.filter((item) => item.templateKey === 'marketing-page')

        expect(marketingItems).toHaveLength(8)
        expect(marketingItems.every((item) => item.labelKey && item.defaultLabel)).toBe(true)
        expect(marketingItems.map((item) => item.labelKey)).toEqual([
            'layouts.widgets.marketing.brand',
            'layouts.widgets.marketing.navigation',
            'layouts.widgets.marketing.auth',
            'layouts.widgets.marketing.hero',
            'layouts.widgets.marketing.image',
            'layouts.widgets.marketing.collection',
            'layouts.widgets.marketing.pricing',
            'layouts.widgets.marketing.footer'
        ])
    })

    it('does not bind an unused scope parameter when listing global layouts', async () => {
        const { executor } = createMockDbExecutor()

        executor.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: '0' }])

        await listApplicationLayouts(executor, 'app_018f8a787b8f7c1da111222233334444', {
            limit: 100,
            offset: 0,
            scopeEntityId: null
        })

        expect(executor.query).toHaveBeenCalledTimes(2)
        expect(executor.query.mock.calls[0]?.[0]).toContain('scope_entity_id IS NULL')
        expect(executor.query.mock.calls[0]?.[1]).toEqual([100, 0])
        expect(executor.query.mock.calls[1]?.[0]).toContain('scope_entity_id IS NULL')
        expect(executor.query.mock.calls[1]?.[1]).toEqual([])
    })

    it('fails closed when the layout list count response is malformed', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 'invalid' }])

        await expect(
            listApplicationLayouts(executor, 'app_018f8a787b8f7c1da111222233334444', {
                limit: 100,
                offset: 0,
                scopeEntityId: null
            })
        ).rejects.toThrow('APPLICATION_LAYOUT_RESPONSE_INVALID')
    })

    it('rejects a scoped layout when the application object is not layout-capable', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([])

        await expect(
            createApplicationLayout(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                {
                    name: { en: 'Scoped layout' },
                    scopeEntityId: '0190a9b5-3cde-7abc-8def-0123456789c2',
                    templateKey: 'marketing-page'
                },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_SCOPE_INVALID')

        expect(txExecutor.query.mock.calls[2]?.[0]).toContain("config->'capabilities'->'layoutConfig'->>'enabled'")
        expect(txExecutor.query.mock.calls[2]?.[0]).toContain("COALESCE(kind, '') = 'page'")
        expect(txExecutor.query.mock.calls[2]?.[0]).toContain("NOT IN ('hub', 'set', 'enumeration', 'page', 'ledger')")
        expect(txExecutor.query).toHaveBeenCalledTimes(3)
    })

    it('rejects scope changes through the application layout update contract', async () => {
        const { executor } = createMockDbExecutor()

        await expect(
            updateApplicationLayout(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                '018f8a78-7b8f-7c1d-a111-2222333344a1',
                { scopeEntityId: 'object-1' } as never,
                'user-1'
            )
        ).rejects.toThrow()
        expect(executor.transaction).not.toHaveBeenCalled()
    })

    it('normalizes a concurrent default unique violation instead of returning a stale layout', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const conflict = Object.assign(new Error('duplicate default'), {
            code: '23505',
            constraint: 'idx_app_layouts_default_active'
        })
        txExecutor.query
            .mockResolvedValueOnce([]) // global mutation lock
            .mockResolvedValueOnce([]) // scope advisory lock
            .mockResolvedValueOnce([{ count: '0' }]) // active layouts
            .mockResolvedValueOnce([]) // demote current default
            .mockRejectedValueOnce(conflict) // insert races with another default writer

        await expect(
            createApplicationLayout(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                { name: { en: 'Main' }, templateKey: 'dashboard', isDefault: true },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_DEFAULT_CONFLICT')
    })

    it('takes scope, layout, and widget locks before rejecting a stale layout update', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const layoutId = '018f8a78-7b8f-7c1d-a111-2222333344a1'
        const layoutRow = {
            id: layoutId,
            scope_entity_id: '0190a9b5-3cde-7abc-8def-2123456789d3',
            template_key: 'dashboard',
            name: { en: 'Main' },
            description: null,
            config: independentLayoutConfig,
            is_active: true,
            is_default: true,
            sort_order: 0,
            source_kind: 'application',
            source_layout_id: null,
            source_snapshot_hash: null,
            source_content_hash: null,
            local_content_hash: 'hash-local',
            sync_state: 'clean',
            is_source_excluded: false,
            source_deleted_at: null,
            source_deleted_by: null,
            version: 8
        }
        txExecutor.query
            .mockResolvedValueOnce([{ scope_entity_id: '0190a9b5-3cde-7abc-8def-2123456789d3' }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([layoutRow])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])

        await expect(
            updateApplicationLayout(executor, 'app_018f8a787b8f7c1da111222233334444', layoutId, { expectedVersion: 7 }, 'user-1')
        ).rejects.toThrow('APPLICATION_LAYOUT_VERSION_CONFLICT')

        expect(txExecutor.query).toHaveBeenCalledTimes(7)
        expect(txExecutor.query.mock.calls[1]?.[1]).toEqual(['app_018f8a787b8f7c1da111222233334444:application-layout-mutations'])
        expect(txExecutor.query.mock.calls[2]?.[1]).toEqual([
            'app_018f8a787b8f7c1da111222233334444:layout-scope:0190a9b5-3cde-7abc-8def-2123456789d3'
        ])
        expect(txExecutor.query.mock.calls[3]?.[1]).toEqual([
            'app_018f8a787b8f7c1da111222233334444:layout:018f8a78-7b8f-7c1d-a111-2222333344a1'
        ])
        expect(txExecutor.query.mock.calls[4]?.[0]).toContain('FOR UPDATE')
        expect(txExecutor.query.mock.calls[5]?.[1]).toEqual([
            'app_018f8a787b8f7c1da111222233334444:layout:018f8a78-7b8f-7c1d-a111-2222333344a1:widgets'
        ])
        expect(txExecutor.query.mock.calls[6]?.[0]).toContain('FOR UPDATE')
    })

    it('resets only marketing layout appearance and records an optimistic versioned update', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const layoutId = '018f8a78-7b8f-7c1d-a111-2222333344a1'
        const layoutRow = {
            id: layoutId,
            scope_entity_id: null,
            template_key: 'marketing-page',
            name: { en: 'Marketing' },
            description: null,
            config: {
                themeMode: 'dark',
                primaryColor: '#1976d2',
                __layout: {
                    composition: { mode: 'independent', baseLayoutId: null },
                    sourceZoneSettings: { 'marketing-header': { position: 'flow' } },
                    zoneSettings: { 'marketing-header': { position: 'fixed' } }
                }
            },
            is_active: true,
            is_default: true,
            sort_order: 0,
            source_kind: 'application',
            source_layout_id: null,
            source_snapshot_hash: null,
            source_content_hash: null,
            local_content_hash: 'before-reset',
            sync_state: 'clean',
            is_source_excluded: false,
            source_deleted_at: null,
            source_deleted_by: null,
            version: 4
        }
        txExecutor.query
            .mockResolvedValueOnce([{ scope_entity_id: null }]) // safe scope lookup
            .mockResolvedValueOnce([]) // global mutation lock
            .mockResolvedValueOnce([]) // scope advisory lock
            .mockResolvedValueOnce([]) // layout advisory lock
            .mockResolvedValueOnce([layoutRow]) // locked current layout
            .mockResolvedValueOnce([]) // widgets advisory lock
            .mockResolvedValueOnce([]) // locked current widgets
            .mockResolvedValueOnce([
                {
                    ...layoutRow,
                    config: {
                        __layout: {
                            composition: { mode: 'independent', baseLayoutId: null },
                            sourceZoneSettings: { 'marketing-header': { position: 'flow' } },
                            zoneSettings: { 'marketing-header': { position: 'fixed' } }
                        }
                    },
                    version: 5
                }
            ]) // updated layout

        const saved = await resetApplicationLayoutConfig(
            executor,
            'app_018f8a787b8f7c1da111222233334444',
            layoutId,
            { expectedVersion: 4 },
            'user-1'
        )

        expect(saved).toEqual(
            expect.objectContaining({
                templateKey: 'marketing-page',
                version: 5,
                config: expect.objectContaining({
                    themeMode: 'system',
                    allowEmailActions: true,
                    allowTelephoneActions: true,
                    externalLinkTarget: 'new-tab'
                }),
                neutral: expect.objectContaining({
                    composition: { mode: 'independent', baseLayoutId: null },
                    sourceZoneSettings: { 'marketing-header': { position: 'flow' } },
                    zoneSettings: { 'marketing-header': { position: 'fixed' } }
                })
            })
        )
        expect(txExecutor.query).toHaveBeenCalledTimes(8)
        expect(txExecutor.query.mock.calls[2]?.[1]).toEqual(['app_018f8a787b8f7c1da111222233334444:layout-scope:global'])
        expect(txExecutor.query.mock.calls[3]?.[1]).toEqual([
            'app_018f8a787b8f7c1da111222233334444:layout:018f8a78-7b8f-7c1d-a111-2222333344a1'
        ])
        expect(txExecutor.query.mock.calls[4]?.[0]).toContain('FOR UPDATE')
        expect(txExecutor.query.mock.calls[5]?.[1]).toEqual([
            'app_018f8a787b8f7c1da111222233334444:layout:018f8a78-7b8f-7c1d-a111-2222333344a1:widgets'
        ])
        expect(txExecutor.query.mock.calls[6]?.[0]).toContain('FOR UPDATE')
        expect(txExecutor.query.mock.calls[7]?.[0]).toContain('SET config = $2::jsonb')
        expect(txExecutor.query.mock.calls[7]?.[0]).toContain('_upl_updated_by = $5')
        expect(txExecutor.query.mock.calls[7]?.[1]?.slice(0, 2)).toEqual([layoutId, expect.any(String)])
        expect(txExecutor.query.mock.calls[7]?.[1]?.[4]).toBe('user-1')
        expect(txExecutor.query.mock.calls[7]?.[1]?.[5]).toBe(4)
    })

    it('fails closed when the copied layout config update does not return its target row', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const sourceLayoutId = '018f8a78-7b8f-7c1d-a111-2222333344c1'
        const layoutRow = primeLockedLayout(txExecutor, {
            layoutId: sourceLayoutId,
            templateKey: 'dashboard',
            widgets: [],
            includeStructureLock: false
        })
        txExecutor.query
            .mockResolvedValueOnce([{ ...layoutRow, id: '018f8a78-7b8f-7c1d-a111-2222333344c2', is_default: false, version: 1 }])
            .mockResolvedValueOnce([])

        await expect(
            copyApplicationLayout(executor, 'app_018f8a787b8f7c1da111222233334444', sourceLayoutId, { expectedVersion: 1 }, 'user-1')
        ).rejects.toThrow('APPLICATION_LAYOUT_COPY_CONFIG_UPDATE_FAILED')
    })

    it.each(['widget-key', 'entity-binding'] as const)(
        'rejects generic layout copies containing marketing.hero by %s before any row write',
        async (_contentKind) => {
            const { executor, txExecutor } = createMockDbExecutor()
            const layoutId = '0190a9b5-3cde-7abc-8def-2123456789d8'
            const heroDefinition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')
            if (!heroDefinition) throw new Error('Expected marketing.hero to be registered')
            const bindingConfig = encodeLayoutWidgetConfigEnvelope(
                {
                    rendererConfig: { showLeadForm: true },
                    neutral: {
                        bindings: buildSingleTargetWidgetBinding(heroDefinition, 'content', {
                            entityKind: 'object',
                            entityCodename: 'MarketingPageHero',
                            semanticKey: 'default'
                        })
                    }
                },
                { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
            )

            primeLockedLayout(txExecutor, {
                layoutId,
                templateKey: 'marketing-page',
                includeStructureLock: false,
                widgets: [
                    {
                        id: '0190a9b5-3cde-7abc-8def-2123456789d9',
                        layout_id: layoutId,
                        zone: 'marketing-main',
                        widget_key: 'marketing.hero',
                        instance_key: 'hero',
                        parent_widget_id: null,
                        slot_key: null,
                        sort_order: 0,
                        config: bindingConfig,
                        source_config: bindingConfig,
                        source_widget_id: null,
                        source_base_widget_id: null,
                        is_customized: false,
                        is_active: true,
                        version: 1
                    }
                ]
            })

            await expect(
                copyApplicationLayout(executor, 'app_018f8a787b8f7c1da111222233334444', layoutId, { expectedVersion: 1 }, 'user-1')
            ).rejects.toThrow('APPLICATION_LAYOUT_ENTITY_BACKED_WIDGET_COPY_CONFLICT')

            expect(txExecutor.query.mock.calls.some(([sql]) => /^\s*(?:INSERT|UPDATE|DELETE)\b/iu.test(String(sql)))).toBe(false)
        }
    )

    it('updates and resets a marketing zone setting while preserving the neutral envelope', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const layoutId = '018f8a78-7b8f-7c1d-a111-2222333344a1'
        const currentConfig = {
            themeMode: 'light',
            __layout: {
                composition: { mode: 'independent', baseLayoutId: null },
                sourceZoneSettings: { 'marketing-header': { position: 'flow' } },
                zoneSettings: { 'marketing-header': { position: 'fixed' } }
            }
        }
        const layoutRow = {
            id: layoutId,
            scope_entity_id: null,
            template_key: 'marketing-page',
            name: { en: 'Marketing' },
            description: null,
            config: currentConfig,
            is_active: true,
            is_default: true,
            sort_order: 0,
            source_kind: 'metahub',
            source_layout_id: layoutId,
            source_snapshot_hash: 'a'.repeat(64),
            source_content_hash: 'b'.repeat(64),
            local_content_hash: 'c'.repeat(64),
            sync_state: 'local_modified',
            is_source_excluded: false,
            source_deleted_at: null,
            source_deleted_by: null,
            version: 4
        }

        primeLockedLayout(txExecutor, {
            layoutId,
            templateKey: 'marketing-page',
            config: currentConfig,
            version: 4,
            includeStructureLock: false
        })
        const updatedConfig = {
            themeMode: 'light',
            __layout: {
                composition: { mode: 'independent', baseLayoutId: null },
                sourceZoneSettings: { 'marketing-header': { position: 'flow' } },
                zoneSettings: { 'marketing-header': { position: 'flow' } }
            }
        }
        txExecutor.query.mockResolvedValueOnce([{ ...layoutRow, config: updatedConfig, version: 5 }])

        const updated = await updateApplicationLayoutZoneSetting(
            executor,
            'app_018f8a787b8f7c1da111222233334444',
            layoutId,
            'marketing-header',
            'position',
            { value: 'flow', expectedVersion: 4 },
            'user-1'
        )

        expect(updated?.config).toEqual(expect.objectContaining({ themeMode: 'light' }))
        const persistedUpdatedConfig = JSON.parse(String(txExecutor.query.mock.calls.at(-1)?.[1]?.[1])) as Record<string, unknown>
        expect(persistedUpdatedConfig.__layout).toEqual(
            expect.objectContaining({
                sourceZoneSettings: { 'marketing-header': { position: 'flow' } },
                zoneSettings: { 'marketing-header': { position: 'flow' } }
            })
        )

        primeLockedLayout(txExecutor, {
            layoutId,
            templateKey: 'marketing-page',
            config: updatedConfig,
            version: 5,
            includeStructureLock: false
        })
        const resetConfig = {
            themeMode: 'light',
            __layout: {
                composition: { mode: 'independent', baseLayoutId: null },
                sourceZoneSettings: { 'marketing-header': { position: 'flow' } }
            }
        }
        txExecutor.query.mockResolvedValueOnce([{ ...layoutRow, config: resetConfig, version: 6 }])

        const reset = await resetApplicationLayoutZoneSetting(
            executor,
            'app_018f8a787b8f7c1da111222233334444',
            layoutId,
            'marketing-header',
            'position',
            { expectedVersion: 5 },
            'user-1'
        )

        expect(reset?.config).toEqual(expect.objectContaining({ themeMode: 'light' }))
        const persistedResetConfig = JSON.parse(String(txExecutor.query.mock.calls.at(-1)?.[1]?.[1])) as Record<string, unknown>
        expect(persistedResetConfig.__layout).toEqual(
            expect.objectContaining({ sourceZoneSettings: { 'marketing-header': { position: 'flow' } } })
        )
        expect((persistedResetConfig.__layout as Record<string, unknown>).zoneSettings).toBeUndefined()
    })

    it('rejects a stale marketing appearance reset before issuing an update', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query
            .mockResolvedValueOnce([{ scope_entity_id: null }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                {
                    id: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                    scope_entity_id: null,
                    template_key: 'marketing-page',
                    name: { en: 'Marketing' },
                    description: null,
                    config: independentLayoutConfig,
                    is_active: true,
                    is_default: true,
                    sort_order: 0,
                    source_kind: 'application',
                    source_layout_id: null,
                    source_snapshot_hash: null,
                    source_content_hash: null,
                    local_content_hash: 'hash-local',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    source_deleted_at: null,
                    source_deleted_by: null,
                    version: 8
                }
            ])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])

        await expect(
            resetApplicationLayoutConfig(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                '018f8a78-7b8f-7c1d-a111-2222333344a1',
                { expectedVersion: 7 },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_VERSION_CONFLICT')
        expect(txExecutor.query).toHaveBeenCalledTimes(7)
    })

    it('does not reset a dashboard layout through the marketing endpoint store contract', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query
            .mockResolvedValueOnce([{ scope_entity_id: null }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                {
                    id: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                    scope_entity_id: null,
                    template_key: 'dashboard',
                    name: { en: 'Dashboard' },
                    description: null,
                    config: independentLayoutConfig,
                    is_active: true,
                    is_default: true,
                    sort_order: 0,
                    source_kind: 'application',
                    source_layout_id: null,
                    source_snapshot_hash: null,
                    source_content_hash: null,
                    local_content_hash: 'hash-local',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    source_deleted_at: null,
                    source_deleted_by: null,
                    version: 2
                }
            ])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])

        await expect(
            resetApplicationLayoutConfig(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                '018f8a78-7b8f-7c1d-a111-2222333344a1',
                { expectedVersion: 2 },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_MARKETING_RESET_NOT_SUPPORTED')
        expect(txExecutor.query).toHaveBeenCalledTimes(7)
    })

    it('reassigns the default layout when deleting the current default layout', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        txExecutor.query
            .mockResolvedValueOnce([{ scope_entity_id: null }]) // safe scope lookup
            .mockResolvedValueOnce([]) // global mutation lock
            .mockResolvedValueOnce([]) // scope advisory lock
            .mockResolvedValueOnce([]) // layout advisory lock
            .mockResolvedValueOnce([
                {
                    id: '0190a9b5-3cde-7abc-8def-2123456789d1',
                    scope_entity_id: null,
                    template_key: 'dashboard',
                    name: { en: 'Main' },
                    description: null,
                    config: independentLayoutConfig,
                    is_active: true,
                    is_default: true,
                    sort_order: 0,
                    source_kind: 'application',
                    source_layout_id: null,
                    source_snapshot_hash: null,
                    source_content_hash: null,
                    local_content_hash: 'hash-local',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    source_deleted_at: null,
                    source_deleted_by: null,
                    version: 4
                }
            ]) // locked layout row
            .mockResolvedValueOnce([]) // widgets advisory lock
            .mockResolvedValueOnce([]) // locked widgets
            .mockResolvedValueOnce([{ count: '1' }]) // other active rows
            .mockResolvedValueOnce([
                {
                    id: '0190a9b5-3cde-7abc-8def-2123456789d1',
                    is_active: false,
                    is_default: false,
                    _upl_deleted: true,
                    _app_deleted: true
                }
            ]) // application-owned layout tombstone
            .mockResolvedValueOnce([
                {
                    id: '0190a9b5-3cde-7abc-8def-2123456789d4',
                    layout_id: '0190a9b5-3cde-7abc-8def-2123456789d1',
                    is_active: false,
                    _upl_deleted: true,
                    _app_deleted: true
                }
            ]) // dependent application-owned widget tombstone
            .mockResolvedValueOnce([{ id: '0190a9b5-3cde-7abc-8def-2123456789d2' }]) // next default candidate
            .mockResolvedValueOnce([]) // assign next default

        const deleted = await deleteApplicationLayout(
            executor,
            'app_018f8a787b8f7c1da111222233334444',
            '0190a9b5-3cde-7abc-8def-2123456789d1',
            'user-1',
            4
        )

        expect(deleted).toBe(true)
        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expect(txExecutor.query).toHaveBeenCalledTimes(12)
        expect(txExecutor.query.mock.calls[8]?.[0]).toContain('SET is_active = false')
        expect(txExecutor.query.mock.calls[8]?.[0]).toContain('is_default = false')
        expect(txExecutor.query.mock.calls[8]?.[0]).toContain('RETURNING id, is_active, is_default, _upl_deleted, _app_deleted')
        expect(txExecutor.query.mock.calls[8]?.[1]).toEqual(['0190a9b5-3cde-7abc-8def-2123456789d1', 'user-1', 4])
        expect(txExecutor.query.mock.calls[9]?.[0]).toContain('UPDATE')
        expect(txExecutor.query.mock.calls[9]?.[0]).toContain('_app_widgets')
        expect(txExecutor.query.mock.calls[9]?.[0]).toContain('_app_deleted_by = CASE WHEN $3 THEN $2::uuid ELSE NULL::uuid END')
        expect(txExecutor.query.mock.calls[9]?.[0]).toContain('RETURNING id, layout_id, is_active, _upl_deleted, _app_deleted')
        expect(txExecutor.query.mock.calls[9]?.[1]).toEqual(['0190a9b5-3cde-7abc-8def-2123456789d1', 'user-1', true])
        expect(txExecutor.query.mock.calls[10]?.[0]).toContain('SELECT id')
        expect(txExecutor.query.mock.calls[11]?.[0]).toContain('CASE WHEN id = $2 THEN true ELSE false END')
        expect(txExecutor.query.mock.calls[11]?.[1]).toEqual([null, '0190a9b5-3cde-7abc-8def-2123456789d2', 'user-1'])
    })

    it('fails closed when the application-owned delete does not return a valid tombstone', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        txExecutor.query
            .mockResolvedValueOnce([{ scope_entity_id: null }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                {
                    id: '0190a9b5-3cde-7abc-8def-2123456789d1',
                    scope_entity_id: null,
                    template_key: 'dashboard',
                    name: { en: 'Main' },
                    description: null,
                    config: independentLayoutConfig,
                    is_active: true,
                    is_default: true,
                    sort_order: 0,
                    source_kind: 'application',
                    source_layout_id: null,
                    source_snapshot_hash: null,
                    source_content_hash: null,
                    local_content_hash: 'hash-local',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    source_deleted_at: null,
                    source_deleted_by: null,
                    version: 4
                }
            ])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ count: '1' }])
            .mockResolvedValueOnce([
                {
                    id: '0190a9b5-3cde-7abc-8def-2123456789d1',
                    is_active: true,
                    is_default: false,
                    _upl_deleted: true,
                    _app_deleted: true
                }
            ])

        await expect(
            deleteApplicationLayout(executor, 'app_018f8a787b8f7c1da111222233334444', '0190a9b5-3cde-7abc-8def-2123456789d1', 'user-1', 4)
        ).rejects.toThrow('APPLICATION_LAYOUT_DELETE_INVARIANT_VIOLATION')

        expect(txExecutor.query).toHaveBeenCalledTimes(9)
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('SELECT id\n'))).toBe(false)
    })

    it('serializes two store transactions and prevents a stale second delete from mutating the row', async () => {
        // This Jest suite has only the DbExecutor contract, not a live PostgreSQL
        // server. The two independent mock executors below model the production
        // transaction boundary: the second caller waits on the application
        // advisory lock, then re-reads the row with FOR UPDATE and cannot issue
        // a second version-guarded update after the first caller tombstones it.
        const schemaName = 'app_018f8a787b8f7c1da111222233334444'
        const layoutId = '0190a9b5-3cde-7abc-8def-2123456789c1'
        const state = {
            deleted: false,
            deleteMutations: 0,
            lockOwner: null as ReturnType<typeof createMockDbExecutor>['txExecutor'] | null,
            waiters: [] as Array<() => void>
        }
        const layoutRow = {
            id: layoutId,
            scope_entity_id: null,
            template_key: 'dashboard',
            name: { en: 'Concurrent layout' },
            description: null,
            config: independentLayoutConfig,
            is_active: true,
            is_default: false,
            sort_order: 0,
            source_kind: 'application',
            source_layout_id: null,
            source_snapshot_hash: null,
            source_content_hash: null,
            local_content_hash: 'hash-local',
            sync_state: 'clean',
            is_source_excluded: false,
            source_deleted_at: null,
            source_deleted_by: null,
            version: 4
        }
        let releaseFirstLock: (() => void) | undefined
        const firstLockAcquired = new Promise<void>((resolve) => {
            releaseFirstLock = resolve
        })
        let releaseFirstTransaction: (() => void) | undefined
        const firstTransactionMayContinue = new Promise<void>((resolve) => {
            releaseFirstTransaction = resolve
        })

        const createConnection = () => {
            const db = createMockDbExecutor()
            db.executor.transaction.mockImplementation(async (callback: (executor: typeof db.txExecutor) => Promise<unknown>) => {
                try {
                    return await callback(db.txExecutor)
                } finally {
                    if (state.lockOwner === db.txExecutor) {
                        state.lockOwner = null
                        state.waiters.shift()?.()
                    }
                }
            })
            db.txExecutor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT scope_entity_id')) {
                    return state.deleted ? [] : [{ scope_entity_id: null }]
                }

                if (sql.includes('pg_advisory_xact_lock')) {
                    if (params?.[0] === `${schemaName}:application-layout-mutations`) {
                        if (state.lockOwner && state.lockOwner !== db.txExecutor) {
                            await new Promise<void>((resolve) => state.waiters.push(resolve))
                        }
                        state.lockOwner = db.txExecutor
                        if (!releaseFirstLock) {
                            await firstTransactionMayContinue
                        } else {
                            releaseFirstLock()
                            releaseFirstLock = undefined
                        }
                    }
                    return []
                }

                if (sql.includes('FOR UPDATE') && sql.includes('template_key')) {
                    return state.deleted ? [] : [layoutRow]
                }
                if (sql.includes('FOR UPDATE')) return []
                if (sql.includes('SELECT COUNT(*)::text AS count')) return [{ count: '1' }]

                if (sql.includes('SET is_active = false')) {
                    if (state.deleted) return []
                    state.deleted = true
                    state.deleteMutations += 1
                    return [
                        {
                            id: layoutId,
                            is_active: false,
                            is_default: false,
                            _upl_deleted: true,
                            _app_deleted: true
                        }
                    ]
                }

                return []
            })
            return db.executor
        }

        const first = deleteApplicationLayout(createConnection(), schemaName, layoutId, 'user-1', 4)
        await firstLockAcquired
        const second = deleteApplicationLayout(createConnection(), schemaName, layoutId, 'user-2', 4)
        await Promise.resolve()

        expect(state.waiters).toHaveLength(1)
        expect(state.deleteMutations).toBe(0)
        releaseFirstTransaction?.()
        await expect(first).resolves.toBe(true)
        await expect(second).resolves.toBe(false)
        expect(state.deleteMutations).toBe(1)
    })
})
