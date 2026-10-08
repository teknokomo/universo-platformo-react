import { encodeWidgetConfigEnvelope } from '@universo-react/types'
import { marketingLayoutZoneWidgets } from '../../domains/templates/data/marketing-page.layouts'
import { prepareCopiedOverrideConfig, prepareCopiedWidgetConfig } from '../../domains/layouts/services/copyMetahubLayoutValidation'

const getCollectionPlacement = () => {
    const placement = marketingLayoutZoneWidgets['marketing-main'].find(({ widgetKey }) => widgetKey === 'marketing.collection')
    if (!placement?.bindings) throw new Error('Marketing Page collection placement with Entity bindings is required')
    return placement
}

describe('copyMetahubLayoutValidation clean-cutover contracts', () => {
    it('rejects legacy placement identity embedded in copied renderer config', () => {
        const placement = getCollectionPlacement()
        const config = encodeWidgetConfigEnvelope(
            {
                rendererConfig: { ...placement.rendererConfig, instanceKey: 'legacy-placement-key' },
                neutral: { bindings: placement.bindings }
            },
            {
                templateKey: 'marketing-page',
                widgetKey: placement.widgetKey,
                zone: placement.zone,
                requireBindings: true
            }
        )

        expect(() => prepareCopiedWidgetConfig('marketing-page', placement.widgetKey, placement.zone, config)).toThrow(
            'Layout widget configuration is invalid'
        )
    })

    it('rejects legacy placement identity embedded in copied override renderer config', () => {
        const placement = getCollectionPlacement()
        const config = encodeWidgetConfigEnvelope(
            {
                rendererConfig: { ...placement.rendererConfig, instanceKey: 'legacy-placement-key' },
                neutral: {}
            },
            {
                templateKey: 'marketing-page',
                widgetKey: placement.widgetKey,
                zone: placement.zone,
                requireBindings: false
            }
        )

        expect(() => prepareCopiedOverrideConfig('marketing-page', placement.widgetKey, placement.zone, config)).toThrow(
            'Widget placement identity must not be stored in renderer config'
        )
    })
})
