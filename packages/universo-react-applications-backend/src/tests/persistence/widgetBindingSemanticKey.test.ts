import { getLayoutWidgetDefinition, type WidgetBindingComponentRequirement } from '@universo-react/types'
import { isWidgetBindingSemanticKeyValid } from '../../persistence/widgetBindingSemanticKey'

const semanticRequirement = (): WidgetBindingComponentRequirement => {
    const slot = getLayoutWidgetDefinition('marketing.footer')?.bindingSlots?.find(({ key }) => key === 'site')
    const requirement = slot?.requirements.components.find(({ semanticKey }) => semanticKey === true)
    if (!requirement) throw new Error('Marketing footer semantic key contract is unavailable')
    return requirement
}

describe('isWidgetBindingSemanticKeyValid', () => {
    it('uses the registered Component pattern after validating the neutral semantic selector contract', () => {
        const requirement = {
            ...semanticRequirement(),
            pattern: '^Marketing[A-Z][A-Za-z0-9]*$'
        }

        expect(isWidgetBindingSemanticKeyValid('MarketingSite', requirement)).toBe(true)
        expect(isWidgetBindingSemanticKeyValid('site-default', requirement)).toBe(false)
    })

    it('rejects physical identifiers, non-canonical whitespace, missing patterns, and unsafe patterns', () => {
        const requirement = semanticRequirement()

        expect(isWidgetBindingSemanticKeyValid('019ccefc-2f7b-7b36-82f4-85cdb1312271', requirement)).toBe(false)
        expect(isWidgetBindingSemanticKeyValid(' site-default ', requirement)).toBe(false)
        expect(isWidgetBindingSemanticKeyValid('site-default', { ...requirement, pattern: undefined })).toBe(false)
        expect(isWidgetBindingSemanticKeyValid('aaaaaaaaaaaaaaaaaaaaaaaa', { ...requirement, pattern: '^(a+)+$' })).toBe(false)
    })
})
