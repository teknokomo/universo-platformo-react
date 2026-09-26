import { buildSingleTargetWidgetBinding, getLayoutWidgetDefinition, type EffectiveWidget } from '@universo-react/types'
import { attachApplicationLayoutWidgetSourceBindingState } from '../../persistence/applicationLayoutStoreSupport'
import { collectActivePublicHeroSelections } from '../../controllers/publicApplicationRuntimeController'

const heroDefinition = getLayoutWidgetDefinition('marketing.hero')
if (!heroDefinition) throw new Error('The Hero widget definition must be registered')

const makeHeroWidget = (semanticKey: string, isActive = true): EffectiveWidget => {
    const widget = {
        id: '019ccefc-2f7b-7b36-82f4-85cdb1312298',
        zone: 'marketing-main',
        semanticRegion: 'main',
        widgetKey: 'marketing.hero',
        sortOrder: 0,
        config: { instanceKey: 'hero', showLeadForm: true },
        isActive,
        version: 1
    } as EffectiveWidget
    const bindings = buildSingleTargetWidgetBinding(heroDefinition, 'content', {
        entityKind: 'object',
        entityCodename: 'MarketingPageHero',
        semanticKey
    })
    return attachApplicationLayoutWidgetSourceBindingState(widget, { persistedApplicationRow: true, bindings })
}

describe('collectActivePublicHeroSemanticKeys', () => {
    it('returns only unique Hero keys selected by active, trusted placement bindings', () => {
        const first = makeHeroWidget('hero-alpha')
        const second = makeHeroWidget('hero-beta')
        const duplicate = makeHeroWidget('hero-alpha')
        const inactive = makeHeroWidget('hero-inactive', false)
        const other = { ...makeHeroWidget('hero-other'), widgetKey: 'marketing.image' } as EffectiveWidget

        expect(collectActivePublicHeroSelections([first, second, duplicate, inactive, other])).toEqual([
            { entityCodename: 'MarketingPageHero', semanticKeys: ['hero-alpha', 'hero-beta'] }
        ])
    })

    it('fails closed when an active Hero placement has no persisted source binding', () => {
        const active = {
            id: '019ccefc-2f7b-7b36-82f4-85cdb1312299',
            zone: 'marketing-main',
            semanticRegion: 'main',
            widgetKey: 'marketing.hero',
            sortOrder: 0,
            config: {},
            isActive: true
        } as EffectiveWidget

        expect(() => collectActivePublicHeroSelections([active])).toThrow(/binding is missing/i)
    })

    it('accepts a registered semantic binding for another Object codename', () => {
        const widget = {
            ...makeHeroWidget('hero-alpha'),
            id: '019ccefc-2f7b-7b36-82f4-85cdb1312300'
        } as EffectiveWidget
        const wrongEntityBinding = buildSingleTargetWidgetBinding(heroDefinition, 'content', {
            entityKind: 'object',
            entityCodename: 'MarketingPageLogo',
            semanticKey: 'hero-alpha'
        })
        const invalid = attachApplicationLayoutWidgetSourceBindingState(
            {
                ...widget,
                id: '019ccefc-2f7b-7b36-82f4-85cdb1312301'
            },
            { persistedApplicationRow: true, bindings: wrongEntityBinding }
        )

        expect(collectActivePublicHeroSelections([invalid])).toEqual([
            { entityCodename: 'MarketingPageLogo', semanticKeys: ['hero-alpha'] }
        ])
    })

    it('collects custom Object targets while preserving semantic-key grouping', () => {
        const widget = { ...makeHeroWidget('hero-custom'), id: '019ccefc-2f7b-7b36-82f4-85cdb1312399' }
        const customBindings = buildSingleTargetWidgetBinding(heroDefinition, 'content', {
            entityKind: 'object',
            entityCodename: 'CustomLandingHero',
            semanticKey: 'hero-custom'
        })
        const custom = attachApplicationLayoutWidgetSourceBindingState(widget, { persistedApplicationRow: true, bindings: customBindings })
        expect(collectActivePublicHeroSelections([custom])).toEqual([
            { entityCodename: 'CustomLandingHero', semanticKeys: ['hero-custom'] }
        ])
    })
})
