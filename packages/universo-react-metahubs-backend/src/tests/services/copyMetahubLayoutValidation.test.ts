import { RESERVED_LAYOUT_METADATA_KEY } from '@universo-react/types'
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
        const config = {
            ...placement.rendererConfig,
            instanceKey: 'legacy-placement-key',
            [RESERVED_LAYOUT_METADATA_KEY]: { bindings: placement.bindings }
        }

        expect(() => prepareCopiedWidgetConfig('marketing-page', placement.widgetKey, placement.zone, config)).toThrow(
            'Layout widget configuration is invalid'
        )
    })

    it('rejects legacy placement identity embedded in copied override renderer config', () => {
        const placement = getCollectionPlacement()
        const config = { ...placement.rendererConfig, instanceKey: 'legacy-placement-key' }

        expect(() => prepareCopiedOverrideConfig('marketing-page', placement.widgetKey, placement.zone, config)).toThrow(
            'Widget renderer configuration cannot contain placement identity.'
        )
    })
})
