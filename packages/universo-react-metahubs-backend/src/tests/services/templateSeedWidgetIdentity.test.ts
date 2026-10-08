import { resolveTemplateSeedWidgetInstanceKey } from '../../domains/templates/services/templateSeedWidgetIdentity'

describe('resolveTemplateSeedWidgetInstanceKey', () => {
    it('reads semantic identity from every seed placement', () => {
        expect(resolveTemplateSeedWidgetInstanceKey({ instanceKey: 'brand' })).toBe('brand')
        expect(resolveTemplateSeedWidgetInstanceKey({ instanceKey: 'language-switcher' })).toBe('language-switcher')
    })

    it('rejects malformed placement identities without reading renderer configuration', () => {
        expect(() => resolveTemplateSeedWidgetInstanceKey({ instanceKey: '  ' })).toThrow()
    })
})
