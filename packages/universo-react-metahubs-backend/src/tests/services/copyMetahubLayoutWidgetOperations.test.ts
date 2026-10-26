import { decodeWidgetConfigEnvelope, encodeWidgetConfigEnvelope } from '@universo-react/types'
import { marketingLayoutZoneWidgets } from '../../domains/templates/data/marketing-page.layouts'
import { prepareWidgetCopyGraph } from '../../domains/layouts/services/copyMetahubLayoutWidgetOperations'

describe('prepareWidgetCopyGraph record-copy bindings', () => {
    it('persists the server-cloned record binding for a copied placement', () => {
        const seededHero = Object.values(marketingLayoutZoneWidgets)
            .flat()
            .find(({ widgetKey }) => widgetKey === 'marketing.hero')
        if (!seededHero?.bindings) throw new Error('The Marketing Page template must seed a bound Hero widget')

        const widgetId = '0190a9b5-3cde-7abc-8def-0123456789a6'
        const sourceConfig = encodeWidgetConfigEnvelope(
            { rendererConfig: seededHero.rendererConfig, neutral: { bindings: seededHero.bindings } },
            { templateKey: 'marketing-page', widgetKey: seededHero.widgetKey, zone: seededHero.zone, requireBindings: true }
        )
        const clonedBindings = {
            ...seededHero.bindings,
            slots: seededHero.bindings.slots.map((slot) => ({
                ...slot,
                targets: slot.targets.map((target) =>
                    target.selector.kind === 'semantic-key'
                        ? { ...target, selector: { ...target.selector, value: 'copied-hero-record' } }
                        : target
                )
            }))
        }
        const clonedConfig = encodeWidgetConfigEnvelope(
            { rendererConfig: seededHero.rendererConfig, neutral: { bindings: clonedBindings } },
            { templateKey: 'marketing-page', widgetKey: seededHero.widgetKey, zone: seededHero.zone, requireBindings: true }
        )

        const graph = prepareWidgetCopyGraph({
            templateKey: 'marketing-page',
            sourceWidgets: [
                {
                    id: widgetId,
                    instance_key: '0190a9b5-3cde-7abc-8def-0123456789a7',
                    parent_widget_id: null,
                    slot_key: null,
                    zone: seededHero.zone,
                    widget_key: seededHero.widgetKey,
                    sort_order: seededHero.sortOrder,
                    config: sourceConfig,
                    is_active: seededHero.isActive
                }
            ],
            baseWidgets: [],
            sourceOverrides: [],
            copyWidgets: true,
            shouldDeactivateWidgets: false,
            input: { entityBindingCopyMode: 'clone' },
            isOverlayLayout: false,
            copiedRecordConfigs: new Map([[widgetId, clonedConfig]])
        })

        expect(graph.preparedWidgets).toHaveLength(1)
        const copiedWidget = graph.preparedWidgets[0]
        const copiedEnvelope = decodeWidgetConfigEnvelope(copiedWidget.config, {
            templateKey: 'marketing-page',
            widgetKey: seededHero.widgetKey,
            zone: seededHero.zone,
            requireBindings: true
        })
        expect(copiedEnvelope.neutral.bindings).toEqual(clonedBindings)
    })
})
