import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APPLICATION_TEMPLATE_REGISTRY, LAYOUT_WIDGET_DEFINITIONS, LAYOUT_ZONE_DEFINITIONS } from '@universo-react/types'

const { get, patch, post, put } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn() }))

vi.mock('../../../shared', () => ({
    apiClient: { get, patch, post, put }
}))

import {
    assignLayoutZoneWidget,
    duplicateLayoutZoneWidgetPlacement,
    duplicateLayoutZoneWidgetWithRecordCopy,
    getLayoutZoneWidgetBindings,
    getLayoutZoneWidgetObjects,
    listWidgetBindingRecords,
    listWidgetBindingSources,
    moveLayoutZoneWidget,
    provisionWidgetBindingSource,
    replaceLayoutZoneWidgetBindings,
    resetLayoutZoneSetting,
    updateLayoutZoneSetting
} from '../layouts'

describe('layout metadata API wrapper', () => {
    beforeEach(() => {
        vi.resetAllMocks()
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

    it('loads generic binding state and paginated compatible sources and semantic records', async () => {
        const bindings = {
            widgetKey: 'marketing.hero',
            version: 7,
            bindings: [
                {
                    slot: 'content',
                    sourceKey: 'MarketingHeroContent',
                    sourceName: 'Hero content',
                    selectorKind: 'semantic-key',
                    selectionLabel: 'Launch',
                    semanticKey: 'launch'
                }
            ]
        }
        const sources = {
            widgetKey: 'marketing.hero',
            slot: 'content',
            selectorKinds: ['semantic-key'],
            sources: [{ sourceKey: 'MarketingHeroContent', label: 'Hero content', recordsCount: 2, selectorKinds: ['semantic-key'] }],
            selectedSource: {
                sourceKey: 'MarketingHeroContent',
                label: 'Hero content',
                recordsCount: 2,
                selectorKinds: ['semantic-key'],
                compatible: true
            },
            nextOffset: 20,
            truncated: true
        }
        const records = {
            widgetKey: 'marketing.hero',
            slot: 'content',
            sourceKey: 'MarketingHeroContent',
            records: [{ semanticKey: 'launch', label: 'Launch' }],
            nextOffset: null,
            truncated: false
        }
        get.mockResolvedValueOnce({ data: bindings }).mockResolvedValueOnce({ data: sources }).mockResolvedValueOnce({ data: records })

        await expect(getLayoutZoneWidgetBindings('metahub-1', 'layout-1', 'widget-1', 'ru')).resolves.toEqual({ data: bindings })
        expect(get).toHaveBeenNthCalledWith(1, '/metahub/metahub-1/layout/layout-1/zone-widget/widget-1/binding', {
            params: { locale: 'ru' }
        })
        await expect(
            listWidgetBindingSources('metahub-1', 'layout-1', 'marketing.hero', 'content', 'widget-1', 'en', 20, undefined, undefined)
        ).resolves.toEqual({
            data: sources
        })
        expect(get).toHaveBeenNthCalledWith(2, '/metahub/metahub-1/layout/layout-1/widget-binding-sources/marketing.hero/content', {
            params: { widgetId: 'widget-1', locale: 'en', offset: 20 }
        })
        await expect(
            listWidgetBindingRecords('metahub-1', 'layout-1', 'marketing.hero', 'content', 'widget-1', 'MarketingHeroContent', 'ru', 0)
        ).resolves.toEqual({ data: records })
        expect(get).toHaveBeenNthCalledWith(3, '/metahub/metahub-1/layout/layout-1/zone-widget/widget-1/binding-records/content', {
            params: { sourceKey: 'MarketingHeroContent', locale: 'ru', offset: 0 }
        })
    })

    it('discovers Add choices without a placement and sends bounded search, selected key, and final variant', async () => {
        get.mockResolvedValueOnce({ data: { widgetKey: 'marketing.collection', slot: 'items', sources: [] } }).mockResolvedValueOnce({
            data: {
                widgetKey: 'marketing.collection',
                slot: 'section',
                sourceKey: 'MarketingSections',
                records: [],
                selectedRecord: { semanticKey: 'launch', label: 'Launch' },
                nextOffset: null,
                truncated: false
            }
        })

        await listWidgetBindingSources('metahub-1', 'layout-1', 'marketing.collection', 'items', null, 'ru', 40, 'company', 'logos')
        expect(get).toHaveBeenNthCalledWith(1, '/metahub/metahub-1/layout/layout-1/widget-binding-sources/marketing.collection/items', {
            params: { locale: 'ru', offset: 40, search: 'company', variant: 'logos' }
        })

        await expect(
            listWidgetBindingRecords(
                'metahub-1',
                'layout-1',
                'marketing.collection',
                'section',
                null,
                'MarketingSections',
                'en',
                0,
                'launch',
                'logos',
                'launch'
            )
        ).resolves.toMatchObject({ data: { selectedRecord: { semanticKey: 'launch', label: 'Launch' } } })
        expect(get).toHaveBeenNthCalledWith(2, '/metahub/metahub-1/layout/layout-1/widget-binding-records/marketing.collection/section', {
            params: {
                sourceKey: 'MarketingSections',
                locale: 'en',
                offset: 0,
                search: 'launch',
                variant: 'logos',
                selectedSemanticKey: 'launch'
            }
        })
    })

    it('creates a source model from a compatible source without sending physical entity ids', async () => {
        const result = {
            widgetKey: 'marketing.hero',
            slot: 'content',
            source: { sourceKey: 'MarketingWidgetSourceNew', label: 'Alternative hero', recordsCount: 0, selectorKinds: ['semantic-key'] }
        }
        post.mockResolvedValueOnce({ data: result })

        await expect(
            provisionWidgetBindingSource('metahub-1', 'layout-1', 'marketing.hero', 'content', {
                locale: 'ru',
                templateSourceKey: 'MarketingPageHero',
                name: 'Alternative hero'
            })
        ).resolves.toEqual({ data: result })
        expect(post).toHaveBeenCalledWith('/metahub/metahub-1/layout/layout-1/widget-binding-sources/marketing.hero/content', {
            locale: 'ru',
            templateSourceKey: 'MarketingPageHero',
            name: 'Alternative hero'
        })
    })

    it('resolves an existing relation source against the draft parent without sending placement ids', async () => {
        const page = {
            widgetKey: 'marketing.pricing',
            slot: 'benefits',
            selectorKinds: ['relation-set'],
            sources: [],
            selectedSource: {
                sourceKey: 'PricingBenefits',
                label: 'Plan benefits',
                recordsCount: 4,
                selectorKinds: ['relation-set'],
                compatible: false
            },
            nextOffset: null,
            truncated: false
        }
        get.mockResolvedValueOnce({ data: page })

        await expect(
            listWidgetBindingSources(
                'metahub-1',
                'layout-1',
                'marketing.pricing',
                'benefits',
                null,
                'en',
                0,
                undefined,
                undefined,
                'PricingTiers',
                'PricingBenefits'
            )
        ).resolves.toEqual({ data: page })
        expect(get).toHaveBeenCalledWith('/metahub/metahub-1/layout/layout-1/widget-binding-sources/marketing.pricing/benefits', {
            params: {
                locale: 'en',
                offset: 0,
                parentSourceKey: 'PricingTiers',
                selectedSourceKey: 'PricingBenefits'
            }
        })
    })

    it('replaces the full generic slot set in one atomic mutation', async () => {
        const result = { widgetKey: 'marketing.collection', version: 8 }
        const input = {
            expectedVersion: 7,
            bindings: [
                { slot: 'section', sourceKey: 'MarketingSection', selector: { kind: 'semantic-key', value: 'pricing' } },
                { slot: 'items', sourceKey: 'FeatureItems', selector: { kind: 'record-set' } }
            ],
            locale: 'en' as const,
            rendererConfig: { variant: 'features' }
        }
        patch.mockResolvedValueOnce({ data: result })

        await expect(replaceLayoutZoneWidgetBindings('metahub-1', 'layout-1', 'widget-1', input)).resolves.toEqual({ data: result })
        expect(patch).toHaveBeenCalledWith('/metahub/metahub-1/layout/layout-1/zone-widget/widget-1/binding', input)
    })

    it('sends generic renderer configuration when placing a widget', async () => {
        put.mockResolvedValueOnce({ data: { id: 'widget-1' } })
        const payload = {
            zone: 'marketing-main' as const,
            widgetKey: 'marketing.hero' as const,
            config: { showLeadForm: false },
            expectedVersion: 3
        }

        await assignLayoutZoneWidget('metahub-1', 'layout-1', payload)

        expect(put).toHaveBeenCalledWith('/metahub/metahub-1/layout/layout-1/zone-widget', payload)
        expect(payload.config).not.toHaveProperty('bindings')
    })

    it('sends semantic parent and slot keys when adding a nested placement', async () => {
        const payload = {
            zone: 'center' as const,
            widgetKey: 'overviewTitle' as const,
            parentInstanceKey: 'container-instance',
            slotKey: 'column:main',
            expectedVersion: 4
        }

        await assignLayoutZoneWidget('metahub-1', 'layout-1', payload)

        expect(put).toHaveBeenCalledWith('/metahub/metahub-1/layout/layout-1/zone-widget', payload)
    })

    it('sends lane order and the optional semantic destination for nested moves', async () => {
        const payload = {
            widgetId: 'widget-1',
            targetZone: 'center' as const,
            targetIndex: 2,
            targetParentInstanceKey: 'tabs-instance',
            targetSlotKey: 'tab:overview',
            expectedVersion: 5
        }

        await moveLayoutZoneWidget('metahub-1', 'layout-1', payload)

        expect(patch).toHaveBeenCalledWith('/metahub/metahub-1/layout/layout-1/zone-widgets/move', payload)
    })

    it('uses the generic placement endpoint to duplicate a complete nested subtree', async () => {
        const payload = { widgetId: 'container-placement', expectedVersion: 6, expectedLayoutVersion: 9 }

        await duplicateLayoutZoneWidgetPlacement('metahub-1', 'layout-1', payload)

        expect(post).toHaveBeenCalledWith('/metahub/metahub-1/layout/layout-1/zone-widget/placement-duplicate', payload)
    })

    it('uses the atomic record-copy placement endpoint for Marketing duplicates', async () => {
        const payload = {
            zone: 'marketing-main' as const,
            widgetKey: 'marketing.image' as const,
            config: {},
            expectedVersion: 7,
            recordCopy: {
                entityId: '01a0eac4-0a52-7053-a127-9e8c3a0fd3bb',
                recordId: '01a0eac4-0a52-7053-a127-9e8c3a0fd3bc',
                sourceKey: 'MarketingPageImage',
                sourceSemanticKey: 'image-source',
                slot: 'content'
            }
        }

        await duplicateLayoutZoneWidgetWithRecordCopy('metahub-1', 'layout-1', payload)

        expect(post).toHaveBeenCalledWith('/metahub/metahub-1/layout/layout-1/zone-widget/duplicate', payload)
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
