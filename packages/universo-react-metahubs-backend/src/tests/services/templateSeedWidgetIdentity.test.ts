import { resolveMarketingSeedWidgetLookup } from '../../domains/templates/services/templateSeedWidgetIdentity'

describe('resolveMarketingSeedWidgetLookup', () => {
    it('uses the renderer instance key for authored marketing widgets', () => {
        expect(resolveMarketingSeedWidgetLookup('marketing.brand', { instanceKey: 'brand' })).toEqual({
            kind: 'instanceKey',
            value: 'brand'
        })
    })

    it('uses the registered widget key for shared single-instance widgets', () => {
        expect(resolveMarketingSeedWidgetLookup('languageSwitcher', {})).toEqual({
            kind: 'widgetKey',
            value: 'languageSwitcher'
        })
    })

    it('fails closed when a non-shared marketing widget has no instance key', () => {
        expect(() => resolveMarketingSeedWidgetLookup('marketing.brand', {})).toThrow(
            'Marketing widget marketing.brand must define a non-empty instanceKey.'
        )
    })
})
