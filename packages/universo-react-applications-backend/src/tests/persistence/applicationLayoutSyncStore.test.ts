import { describe, expect, it, jest } from '@jest/globals'
import type { DbExecutor } from '@universo-react/utils'

import {
    getPersistedDashboardLayoutConfig,
    getPersistedPublishedLayouts,
    getPersistedPublishedWidgets
} from '../../persistence/applicationLayoutSyncStore'
import { getPersistedPublishedWidgets as getPublishedWidgetsThroughSyncBoundary } from '../../routes/sync/syncLayoutPersistence'

const createExecutor = (query: DbExecutor['query']): DbExecutor => ({ query })
const schemaName = 'app_018f8a787b8f7c1da111222233334444'

describe('applicationLayoutSyncStore canonical layout boundaries', () => {
    it('returns an empty dashboard config only when no persisted dashboard layout exists', async () => {
        const executor = createExecutor(jest.fn(async () => []))

        await expect(getPersistedDashboardLayoutConfig(executor, schemaName)).resolves.toEqual({})
    })

    it('fails closed when a persisted dashboard config is not an object', async () => {
        const executor = createExecutor(jest.fn(async () => [{ config: 'invalid' }] as never))

        await expect(getPersistedDashboardLayoutConfig(executor, schemaName)).rejects.toThrow(
            '[SchemaSync] Persisted dashboard layout config is invalid'
        )
    })

    it('exports published layouts through the canonical snapshot envelope', async () => {
        const layoutId = '0190a9b5-3cde-7000-8000-000000000001'
        const executor = createExecutor(
            jest.fn(
                async () =>
                    [
                        {
                            id: layoutId,
                            scope_entity_id: null,
                            template_key: 'marketing-page',
                            name: { en: 'Marketing' },
                            description: null,
                            config: {
                                themeMode: 'light',
                                __layout: {
                                    composition: { mode: 'independent', baseLayoutId: null },
                                    zoneSettings: { 'marketing-header': { position: 'flow' } },
                                    sourceZoneSettings: { 'marketing-header': { position: 'fixed' } }
                                }
                            },
                            is_active: true,
                            is_default: true,
                            sort_order: 0
                        }
                    ] as never
            )
        )

        const result = await getPersistedPublishedLayouts(executor, schemaName)

        expect(result.defaultLayoutId).toBe(layoutId)
        expect(result.layouts).toHaveLength(1)
        expect(result.layouts[0]).toEqual(
            expect.objectContaining({
                id: layoutId,
                sourceComposition: { mode: 'independent', baseLayoutId: null }
            })
        )
        expect(result.layouts[0]?.config).toEqual(
            expect.objectContaining({
                themeMode: 'light',
                __layout: { zoneSettings: { 'marketing-header': { position: 'flow' } } }
            })
        )
        expect(result.layouts[0]?.config.__layout).not.toHaveProperty('composition')
        expect(result.layouts[0]?.config.__layout).not.toHaveProperty('sourceZoneSettings')
    })

    it('fails closed when a published layout carries malformed neutral metadata', async () => {
        const executor = createExecutor(
            jest.fn(
                async () =>
                    [
                        {
                            id: '0190a9b5-3cde-7000-8000-000000000002',
                            scope_entity_id: null,
                            template_key: 'dashboard',
                            name: { en: 'Dashboard' },
                            description: null,
                            config: { __layout: { unsupported: true } },
                            is_active: true,
                            is_default: true,
                            sort_order: 0
                        }
                    ] as never
            )
        )

        await expect(getPersistedPublishedLayouts(executor, schemaName)).rejects.toThrow()
    })

    it('uses the joined layout template to validate shared marketing widgets', async () => {
        const executor = createExecutor(
            jest.fn(
                async () =>
                    [
                        {
                            id: '0190a9b5-3cde-7000-8000-000000000003',
                            layout_id: '0190a9b5-3cde-7000-8000-000000000001',
                            source_base_widget_id: null,
                            zone: 'marketing-header',
                            widget_key: 'languageSwitcher',
                            sort_order: 2,
                            config: { __layout: { placement: 'end' } },
                            is_active: true,
                            template_key: 'marketing-page'
                        }
                    ] as never
            )
        )

        await expect(getPublishedWidgetsThroughSyncBoundary({ schemaName, executor })).resolves.toEqual([
            expect.objectContaining({
                zone: 'marketing-header',
                widgetKey: 'languageSwitcher',
                config: { __layout: { placement: 'end' } }
            })
        ])
    })

    it('fails closed when a published widget does not match its layout template', async () => {
        const executor = createExecutor(
            jest.fn(
                async () =>
                    [
                        {
                            id: '0190a9b5-3cde-7000-8000-000000000004',
                            layout_id: '0190a9b5-3cde-7000-8000-000000000001',
                            source_base_widget_id: null,
                            zone: 'marketing-header',
                            widget_key: 'languageSwitcher',
                            sort_order: 2,
                            config: {},
                            is_active: true,
                            template_key: 'dashboard'
                        }
                    ] as never
            )
        )

        await expect(getPersistedPublishedWidgets(executor, schemaName)).rejects.toThrow()
    })
})
