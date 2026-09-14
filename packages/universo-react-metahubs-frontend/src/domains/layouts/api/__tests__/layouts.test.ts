import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APPLICATION_TEMPLATE_REGISTRY, LAYOUT_WIDGET_DEFINITIONS, LAYOUT_ZONE_DEFINITIONS } from '@universo-react/types'

const { get, patch, post } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn() }))

vi.mock('../../../shared', () => ({
    apiClient: { get, patch, post }
}))

import { getLayoutZoneWidgetObjects, resetLayoutZoneSetting, updateLayoutZoneSetting } from '../layouts'

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
