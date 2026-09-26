import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APPLICATION_TEMPLATE_REGISTRY, LAYOUT_WIDGET_DEFINITIONS, LAYOUT_ZONE_DEFINITIONS } from '@universo-react/types'

const { get, patch, post, put } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn() }))

vi.mock('../../../shared', () => ({
    apiClient: { get, patch, post, put }
}))

import {
    assignLayoutZoneWidget,
    getWidgetBindingSources,
    getWidgetBindingUsage,
    getLayoutZoneWidgetBinding,
    getLayoutZoneWidgetObjects,
    resetLayoutZoneSetting,
    updateLayoutZoneWidgetBinding,
    updateLayoutZoneSetting,
    provisionWidgetBindingSource
} from '../layouts'

describe('layout metadata API wrapper', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns template-aware widget metadata from the complete API envelope', async () => {
        const widget = LAYOUT_WIDGET_DEFINITIONS.find((item) => item.key === 'languageSwitcher')
        if (!widget) throw new Error('languageSwitcher metadata is missing')

        get.mockResolvedValueOnce({
            data: {
                items: [widget],
                templates: [
                    {
                        ...APPLICATION_TEMPLATE_REGISTRY.dashboard,
                        zones: LAYOUT_ZONE_DEFINITIONS.filter((zone) => zone.templateKey === 'dashboard'),
                        widgets: [widget]
                    }
                ]
            }
        })

        await expect(getLayoutZoneWidgetObjects('metahub-1', 'layout-1')).resolves.toEqual([widget])
        expect(get).toHaveBeenCalledWith('/metahub/metahub-1/layout/layout-1/zone-widgets/object')
    })

    it('rejects an incomplete registry response before it reaches the layout editor', async () => {
        get.mockResolvedValueOnce({
            data: {
                items: [{ key: 'languageSwitcher', templateKey: 'dashboard' }],
                templates: []
            }
        })

        await expect(getLayoutZoneWidgetObjects('metahub-1', 'layout-1')).rejects.toThrow('LAYOUT_WIDGET_METADATA_INVALID')
    })

    it('loads the bound Entity record with a locale and patches only the binding contract', async () => {
        const binding = { recordId: 'record-1', recordVersion: 4, widgetVersion: 7, label: 'Launch' }
        get.mockResolvedValueOnce({ data: binding })
        const updatedWidget = { id: 'widget-1', widgetKey: 'marketing.hero' }
        patch.mockResolvedValueOnce({ data: updatedWidget })

        await expect(getLayoutZoneWidgetBinding('metahub-1', 'layout-1', 'widget-1', 'ru')).resolves.toEqual({ data: binding })
        expect(get).toHaveBeenCalledWith('/metahub/metahub-1/layout/layout-1/zone-widget/widget-1/binding', {
            params: { locale: 'ru' }
        })

        await expect(
            updateLayoutZoneWidgetBinding('metahub-1', 'layout-1', 'widget-1', { recordId: 'record-2', expectedVersion: 7 })
        ).resolves.toMatchObject({ data: updatedWidget })
        expect(patch).toHaveBeenCalledWith('/metahub/metahub-1/layout/layout-1/zone-widget/widget-1/binding', {
            recordId: 'record-2',
            expectedVersion: 7
        })
    })

    it('sends Hero binding intent separately from renderer-only configuration when placing a widget', async () => {
        put.mockResolvedValueOnce({ data: { id: 'widget-1' } })
        const payload = {
            zone: 'marketing-main' as const,
            widgetKey: 'marketing.hero' as const,
            heroContent: { mode: 'auto' as const },
            config: { instanceKey: 'hero', showLeadForm: false },
            expectedVersion: 3
        }

        await assignLayoutZoneWidget('metahub-1', 'layout-1', payload)

        expect(put).toHaveBeenCalledWith('/metahub/metahub-1/layout/layout-1/zone-widget', payload)
        expect(payload.config).not.toHaveProperty('bindings')
    })

    it('uses the layout source, provision, and usage endpoints', async () => {
        const sources = [
            { entityId: 'entity-1', entityCodename: 'MarketingPageHero', name: 'Hero content', recordsCount: 2, otherWidgetUsageCount: 1 }
        ]
        get.mockResolvedValueOnce({ data: { items: sources } }).mockResolvedValueOnce({ data: { recordId: 'record-1', usageCount: 3 } })
        post.mockResolvedValueOnce({ data: { source: sources[0], initialRecord: { recordId: 'record-1' } } })

        await expect(
            getWidgetBindingSources('metahub-1', 'layout-1', 'marketing.hero', 'content', 'ru', 'widget-1')
        ).resolves.toMatchObject({
            data: { items: sources }
        })
        expect(get).toHaveBeenNthCalledWith(1, '/metahub/metahub-1/layout/layout-1/widget-binding-sources/marketing.hero/content', {
            params: { locale: 'ru', excludeWidgetId: 'widget-1' }
        })
        await expect(
            provisionWidgetBindingSource('metahub-1', 'layout-1', 'marketing.hero', 'content', {
                codename: 'HeroContent',
                name: 'Hero content'
            })
        ).resolves.toMatchObject({ data: { source: sources[0] } })
        expect(post).toHaveBeenCalledWith('/metahub/metahub-1/layout/layout-1/widget-binding-sources/marketing.hero/content', {
            codename: 'HeroContent',
            name: 'Hero content'
        })
        await expect(getWidgetBindingUsage('metahub-1', 'layout-1', 'record-1', 'widget-1')).resolves.toMatchObject({
            data: { usageCount: 3 }
        })
        expect(get).toHaveBeenNthCalledWith(2, '/metahub/metahub-1/layout/layout-1/widget-binding-usage', {
            params: { recordId: 'record-1', excludeWidgetId: 'widget-1' }
        })
    })

    it('unwraps zone-setting mutation responses to the public MetahubLayout result', async () => {
        const layout = {
            id: 'layout-1',
            scopeEntityId: null,
            templateKey: 'marketing-page',
            name: { en: 'Marketing page' },
            description: null,
            config: {},
            neutral: { zoneSettings: { 'marketing-header': { position: 'flow' } } },
            isActive: true,
            isDefault: true,
            sortOrder: 0,
            version: 8,
            createdAt: '2026-09-13T00:00:00.000Z',
            updatedAt: '2026-09-13T00:00:00.000Z'
        }
        patch.mockResolvedValueOnce({ data: { item: layout } })
        post.mockResolvedValueOnce({ data: { item: { ...layout, neutral: {}, version: 9 } } })

        await expect(updateLayoutZoneSetting('metahub-1', 'layout-1', 'marketing-header', 'position', 'flow', 7)).resolves.toEqual(layout)
        expect(patch).toHaveBeenCalledWith('/metahub/metahub-1/layout/layout-1/zone-settings/marketing-header/position', {
            value: 'flow',
            expectedVersion: 7
        })

        await expect(resetLayoutZoneSetting('metahub-1', 'layout-1', 'marketing-header', 'position', 8)).resolves.toEqual({
            ...layout,
            neutral: {},
            version: 9
        })
        expect(post).toHaveBeenCalledWith('/metahub/metahub-1/layout/layout-1/zone-settings/marketing-header/position/reset', {
            expectedVersion: 8
        })
    })
})
