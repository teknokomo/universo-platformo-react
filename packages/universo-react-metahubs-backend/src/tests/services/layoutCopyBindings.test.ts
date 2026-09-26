import { buildSingleTargetWidgetBinding, encodeWidgetConfigEnvelope, getLayoutWidgetDefinition } from '@universo-react/types'
import { resolveLayoutCopyBindings } from '../../domains/layouts/services/layoutCopyBindings'

const heroDefinition = getLayoutWidgetDefinition('marketing.hero')
if (!heroDefinition) throw new Error('The Hero widget definition must be registered')

const heroConfig = encodeWidgetConfigEnvelope(
    {
        rendererConfig: { instanceKey: 'hero-copy-test', showLeadForm: true },
        neutral: {
            bindings: buildSingleTargetWidgetBinding(heroDefinition, 'content', {
                entityKind: 'object',
                entityCodename: 'MarketingPageHero',
                semanticKey: 'hero-copy-test'
            })
        }
    },
    { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main', requireBindings: true }
)

describe('resolveLayoutCopyBindings', () => {
    it('requires an explicit copy mode for direct and inherited bound Hero placements', () => {
        expect(() =>
            resolveLayoutCopyBindings({
                templateKey: 'marketing-page',
                preparedWidgets: [{ widget: { widget_key: 'marketing.hero', zone: 'marketing-main' }, config: heroConfig, isActive: true }],
                baseWidgets: [{ id: 'base-hero', widget_key: 'marketing.hero', zone: 'marketing-main', config: heroConfig }],
                sourceOverrides: [],
                copyMode: undefined
            })
        ).toThrow('Choose how to copy bound Hero placements')
    })

    it('omits direct selections and reports inherited targets for atomic deletion overrides', () => {
        const result = resolveLayoutCopyBindings({
            templateKey: 'marketing-page',
            preparedWidgets: [{ widget: { widget_key: 'marketing.hero', zone: 'marketing-main' }, config: heroConfig, isActive: true }],
            baseWidgets: [{ id: 'base-hero', widget_key: 'marketing.hero', zone: 'marketing-main', config: heroConfig }],
            sourceOverrides: [],
            copyMode: 'omit'
        })

        expect(result.preparedWidgets).toEqual([])
        expect(result.boundInheritedHeroWidgets).toEqual(new Set(['base-hero']))
    })

    it('does not treat a deleted inherited override as an active binding', () => {
        const result = resolveLayoutCopyBindings({
            templateKey: 'marketing-page',
            preparedWidgets: [],
            baseWidgets: [{ id: 'base-hero', widget_key: 'marketing.hero', zone: 'marketing-main', config: heroConfig }],
            sourceOverrides: [{ base_widget_id: 'base-hero', is_deleted_override: true }],
            copyMode: undefined
        })

        expect(result.boundInheritedHeroWidgets.size).toBe(0)
        expect(result.sourceOverrideByWidgetId.get('base-hero')?.is_deleted_override).toBe(true)
    })

    it('converts invalid inherited Hero configuration into a copy conflict before writing', () => {
        expect(() =>
            resolveLayoutCopyBindings({
                templateKey: 'marketing-page',
                preparedWidgets: [],
                baseWidgets: [{ id: 'base-hero', widget_key: 'marketing.hero', zone: 'marketing-main', config: { malformed: true } }],
                sourceOverrides: [],
                copyMode: 'reuse'
            })
        ).toThrow(/Layout widget configuration is invalid/)
    })
})
