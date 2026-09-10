import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APPLICATION_TEMPLATE_REGISTRY, LAYOUT_WIDGET_DEFINITIONS, LAYOUT_ZONE_DEFINITIONS } from '@universo-react/types'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('../../../shared', () => ({
    apiClient: { get }
}))

import { getLayoutZoneWidgetObjects } from '../layouts'

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
})
