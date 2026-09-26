import { hashApplicationLayoutContent } from '../../utils/applicationLayoutHash'
import { buildSingleTargetWidgetBinding, encodeLayoutWidgetConfigEnvelope, LAYOUT_WIDGET_DEFINITIONS } from '@universo-react/types'
import { mapWidget } from '../../persistence/applicationLayoutStoreSupport'

describe('application layout content hash', () => {
    const layout = {
        scopeEntityId: null,
        templateKey: 'dashboard',
        name: { en: 'Main' },
        description: null,
        config: {
            showHeader: true,
            __layout: { composition: { mode: 'independent', baseLayoutId: null } }
        },
        isActive: true,
        isDefault: true,
        sortOrder: 0
    }

    const heroDefinition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')
    if (!heroDefinition) throw new Error('The marketing hero widget must be registered')

    const heroBinding = (semanticKey: string) =>
        buildSingleTargetWidgetBinding(heroDefinition, 'content', {
            entityKind: 'object',
            entityCodename: 'MarketingPageHero',
            semanticKey
        })

    const mappedHero = (showLeadForm: boolean, semanticKey = 'default') =>
        mapWidget(
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789a1',
                layout_id: '0190a9b5-3cde-7abc-8def-0123456789a2',
                zone: 'marketing-main',
                widget_key: 'marketing.hero',
                sort_order: 1,
                config: { instanceKey: 'hero', showLeadForm },
                source_config: encodeLayoutWidgetConfigEnvelope(
                    {
                        rendererConfig: { instanceKey: 'hero', showLeadForm: true },
                        neutral: { bindings: heroBinding(semanticKey) }
                    },
                    { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
                ),
                source_widget_id: '0190a9b5-3cde-7abc-8def-0123456789a3',
                source_base_widget_id: null,
                is_customized: !showLeadForm,
                is_active: true,
                version: 2
            },
            'marketing-page'
        )

    it('is stable when widget input order changes', () => {
        const first = hashApplicationLayoutContent({
            layout,
            widgets: [
                { zone: 'center', widgetKey: 'detailsTable', sortOrder: 2, config: {}, isActive: true },
                { zone: 'left', widgetKey: 'menuWidget', sortOrder: 1, config: {}, isActive: true }
            ]
        })
        const second = hashApplicationLayoutContent({
            layout,
            widgets: [
                { zone: 'left', widgetKey: 'menuWidget', sortOrder: 1, config: {}, isActive: true },
                { zone: 'center', widgetKey: 'detailsTable', sortOrder: 2, config: {}, isActive: true }
            ]
        })

        expect(second).toBe(first)
    })

    it('changes when widget activation changes', () => {
        const active = hashApplicationLayoutContent({
            layout,
            widgets: [{ zone: 'left', widgetKey: 'menuWidget', sortOrder: 1, config: {}, isActive: true }]
        })
        const inactive = hashApplicationLayoutContent({
            layout,
            widgets: [{ zone: 'left', widgetKey: 'menuWidget', sortOrder: 1, config: {}, isActive: false }]
        })

        expect(inactive).not.toBe(active)
    })

    it('ignores physical row and lineage identifiers', () => {
        const first = hashApplicationLayoutContent({
            layout,
            widgets: [
                {
                    id: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                    layoutId: '018f8a78-7b8f-7c1d-a111-2222333344a2',
                    version: 4,
                    zone: 'center',
                    widgetKey: 'detailsTable',
                    sortOrder: 1,
                    config: {},
                    sourceConfig: { showSearch: true },
                    sourceWidgetId: '018f8a78-7b8f-7c1d-a111-2222333344a3',
                    sourceBaseWidgetId: '018f8a78-7b8f-7c1d-a111-2222333344a4',
                    isActive: true
                }
            ]
        })
        const second = hashApplicationLayoutContent({
            layout,
            widgets: [
                {
                    id: '018f8a78-7b8f-7c1d-a111-2222333344b1',
                    layoutId: '018f8a78-7b8f-7c1d-a111-2222333344b2',
                    version: 9,
                    zone: 'center',
                    widgetKey: 'detailsTable',
                    sortOrder: 1,
                    config: {},
                    sourceConfig: { showSearch: true },
                    sourceWidgetId: '018f8a78-7b8f-7c1d-a111-2222333344b3',
                    sourceBaseWidgetId: '018f8a78-7b8f-7c1d-a111-2222333344b4',
                    isActive: true
                }
            ]
        })

        expect(second).toBe(first)
    })

    it('ignores source baseline metadata when the effective widget config is unchanged', () => {
        const first = hashApplicationLayoutContent({
            layout,
            widgets: [
                {
                    zone: 'center',
                    widgetKey: 'detailsTable',
                    sortOrder: 1,
                    config: { datasource: { objectCodename: 'Products' } },
                    sourceConfig: { datasource: { objectCodename: 'Products' } },
                    isActive: true
                }
            ]
        })
        const second = hashApplicationLayoutContent({
            layout,
            widgets: [
                {
                    zone: 'center',
                    widgetKey: 'detailsTable',
                    sortOrder: 1,
                    config: { datasource: { objectCodename: 'Products' } },
                    sourceConfig: { datasource: { objectCodename: 'Orders' } },
                    isActive: true
                }
            ]
        })

        expect(second).toBe(first)
    })

    it('uses the semantic instance key to order tied repeatable widgets', () => {
        const first = hashApplicationLayoutContent({
            layout,
            widgets: [
                { zone: 'center', widgetKey: 'detailsTable', sortOrder: 1, config: { instanceKey: 'b' }, isActive: true },
                { zone: 'center', widgetKey: 'detailsTable', sortOrder: 1, config: { instanceKey: 'a' }, isActive: true }
            ]
        })
        const second = hashApplicationLayoutContent({
            layout,
            widgets: [
                { zone: 'center', widgetKey: 'detailsTable', sortOrder: 1, config: { instanceKey: 'a' }, isActive: true },
                { zone: 'center', widgetKey: 'detailsTable', sortOrder: 1, config: { instanceKey: 'b' }, isActive: true }
            ]
        })

        expect(second).toBe(first)
    })

    it('excludes source baseline changes when the effective zone setting stays fixed', () => {
        const first = hashApplicationLayoutContent({
            layout: {
                ...layout,
                templateKey: 'marketing-page',
                config: {
                    themeMode: 'light',
                    __layout: {
                        composition: { mode: 'independent', baseLayoutId: null },
                        sourceZoneSettings: { 'marketing-header': { position: 'flow' } },
                        zoneSettings: { 'marketing-header': { position: 'fixed' } }
                    }
                }
            }
        })
        const second = hashApplicationLayoutContent({
            layout: {
                ...layout,
                templateKey: 'marketing-page',
                config: {
                    themeMode: 'light',
                    __layout: {
                        composition: { mode: 'independent', baseLayoutId: null },
                        sourceZoneSettings: { 'marketing-header': { position: 'fixed' } },
                        zoneSettings: { 'marketing-header': { position: 'fixed' } }
                    }
                }
            }
        })

        expect(second).toBe(first)
    })

    it('includes effective zone settings and logical placement', () => {
        const sourceFlow = hashApplicationLayoutContent({
            layout: {
                ...layout,
                templateKey: 'marketing-page',
                config: {
                    themeMode: 'light',
                    __layout: {
                        composition: { mode: 'independent', baseLayoutId: null },
                        sourceZoneSettings: { 'marketing-header': { position: 'flow' } }
                    }
                }
            },
            widgets: [{ zone: 'marketing-header', widgetKey: 'languageSwitcher', sortOrder: 1, config: {}, isActive: true }]
        })
        const sourceFixedStart = hashApplicationLayoutContent({
            layout: {
                ...layout,
                templateKey: 'marketing-page',
                config: {
                    themeMode: 'light',
                    __layout: {
                        composition: { mode: 'independent', baseLayoutId: null },
                        sourceZoneSettings: { 'marketing-header': { position: 'fixed' } }
                    }
                }
            },
            widgets: [
                {
                    zone: 'marketing-header',
                    widgetKey: 'languageSwitcher',
                    sortOrder: 1,
                    config: { __layout: { placement: 'start' } },
                    isActive: true
                }
            ]
        })
        const sourceFixedEnd = hashApplicationLayoutContent({
            layout: {
                ...layout,
                templateKey: 'marketing-page',
                config: {
                    themeMode: 'light',
                    __layout: {
                        composition: { mode: 'independent', baseLayoutId: null },
                        sourceZoneSettings: { 'marketing-header': { position: 'fixed' } }
                    }
                }
            },
            widgets: [{ zone: 'marketing-header', widgetKey: 'languageSwitcher', sortOrder: 1, config: {}, isActive: true }]
        })

        expect(sourceFixedStart).not.toBe(sourceFlow)
        expect(sourceFixedEnd).not.toBe(sourceFixedStart)
    })

    it('includes the trusted source binding while hashing a local presentation override', () => {
        const marketingLayout = {
            ...layout,
            templateKey: 'marketing-page' as const,
            config: {
                themeMode: 'system',
                __layout: { composition: { mode: 'independent', baseLayoutId: null } }
            }
        }
        const localOverride = mappedHero(false)
        const sourcePresentation = mappedHero(true)
        const differentBinding = mappedHero(false, 'campaign')

        const localHash = hashApplicationLayoutContent({ layout: marketingLayout, widgets: [localOverride] })
        const presentationHash = hashApplicationLayoutContent({ layout: marketingLayout, widgets: [sourcePresentation] })
        const bindingHash = hashApplicationLayoutContent({ layout: marketingLayout, widgets: [differentBinding] })

        expect(localHash).not.toBe(presentationHash)
        expect(localHash).not.toBe(bindingHash)
    })

    it('includes the complete overlay base lineage in the semantic hash', () => {
        const baseLayoutId = '0190a9b5-3cde-7abc-8def-1123456789b1'
        const nextBaseLayoutId = '0190a9b5-3cde-7abc-8def-1123456789b2'
        const first = hashApplicationLayoutContent({
            layout: {
                ...layout,
                scopeEntityId: '0190a9b5-3cde-7abc-8def-1123456789b3',
                config: {
                    __layout: { composition: { mode: 'overlay', baseLayoutId } }
                }
            }
        })
        const second = hashApplicationLayoutContent({
            layout: {
                ...layout,
                scopeEntityId: '0190a9b5-3cde-7abc-8def-1123456789b3',
                config: {
                    __layout: { composition: { mode: 'overlay', baseLayoutId: nextBaseLayoutId } }
                }
            }
        })

        expect(second).not.toBe(first)
    })

    it('includes snapshot source composition mode and full base layout id in the semantic hash', () => {
        const firstBaseLayoutId = '0190a9b5-3cde-7abc-8def-1123456789b1'
        const secondBaseLayoutId = '0190a9b5-3cde-7abc-8def-1123456789b2'
        const independent = hashApplicationLayoutContent({
            layout: {
                ...layout,
                config: {},
                sourceComposition: { mode: 'independent', baseLayoutId: null }
            }
        })
        const firstOverlay = hashApplicationLayoutContent({
            layout: {
                ...layout,
                config: {},
                sourceComposition: { mode: 'overlay', baseLayoutId: firstBaseLayoutId }
            }
        })
        const secondOverlay = hashApplicationLayoutContent({
            layout: {
                ...layout,
                config: {},
                sourceComposition: { mode: 'overlay', baseLayoutId: secondBaseLayoutId }
            }
        })

        expect(firstOverlay).not.toBe(independent)
        expect(secondOverlay).not.toBe(firstOverlay)
    })

    it('fails closed when neither persisted nor source composition metadata is present', () => {
        expect(() =>
            hashApplicationLayoutContent({
                layout: {
                    ...layout,
                    config: { showHeader: true }
                }
            })
        ).toThrow()
    })

    it('fails closed on a null layout config even when snapshot source composition is present', () => {
        expect(() =>
            hashApplicationLayoutContent({
                layout: {
                    ...layout,
                    config: null as never,
                    sourceComposition: { mode: 'independent', baseLayoutId: null }
                }
            })
        ).toThrow()
    })

    it('fails closed when source and persisted composition metadata conflict', () => {
        expect(() =>
            hashApplicationLayoutContent({
                layout: {
                    ...layout,
                    sourceComposition: {
                        mode: 'overlay',
                        baseLayoutId: '0190a9b5-3cde-7abc-8def-1123456789b1'
                    }
                }
            })
        ).toThrow('conflicting composition metadata')
    })
})
