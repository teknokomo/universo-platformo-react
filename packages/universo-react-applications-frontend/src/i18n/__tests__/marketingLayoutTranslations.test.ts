import { describe, expect, it } from 'vitest'

import commonEn from '@universo-react/i18n/locales/en/common.json'
import commonRu from '@universo-react/i18n/locales/ru/common.json'
import { LAYOUT_WIDGET_DEFINITIONS } from '@universo-react/types'
import enApplications from '../locales/en/applications.json'
import ruApplications from '../locales/ru/applications.json'

/**
 * The shared marketing widget dialog lives in `@universo-react/template-mui`,
 * so the i18n coverage gate cannot scan it; these are the labels it resolves
 * from the consumer bundle.
 */
const MARKETING_WIDGET_DIALOG_KEYS = [
    'variant',
    'maxItems',
    'maxItemsHelper',
    'showTitle',
    'showDescription',
    'showItemDescriptions',
    'fixedItemsHeight',
    'showBenefits',
    'cardStyle',
    'cardStyleFeatured',
    'cardStyleUniform',
    'cardWidth',
    'cardWidthAuto',
    'cardWidthFull',
    'showNewsletter',
    'showLeadForm',
    'showAuthActions'
] as const

const readWidgetLabel = (bundle: unknown, key: string): string => {
    if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) return ''
    const applications = (bundle as { applications?: { layouts?: { marketing?: { widget?: unknown } } } }).applications
    const widget = applications?.layouts?.marketing?.widget
    if (!widget || typeof widget !== 'object' || Array.isArray(widget)) return ''
    const value = (widget as Record<string, unknown>)[key]
    return typeof value === 'string' ? value.trim() : ''
}

const readMarketingLayoutMessage = (bundle: unknown, key: string): string => {
    if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) return ''
    const applications = (bundle as { applications?: { layouts?: { marketing?: unknown } } }).applications
    const marketing = applications?.layouts?.marketing
    if (!marketing || typeof marketing !== 'object' || Array.isArray(marketing)) return ''
    const value = (marketing as Record<string, unknown>)[key]
    return typeof value === 'string' ? value.trim() : ''
}

const readTranslation = (bundle: unknown, rootKey: string, key: string): string => {
    if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) return ''

    let value: unknown = bundle
    for (const segment of [rootKey, ...key.split('.')]) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
        value = (value as Record<string, unknown>)[segment]
    }

    return typeof value === 'string' ? value.trim() : ''
}

const MARKETING_WIDGET_HELPER_TEXT_FIELDS = LAYOUT_WIDGET_DEFINITIONS.filter(({ templateKey }) => templateKey === 'marketing-page').flatMap(
    ({ key: widgetKey, bindingSlots = [], bindingVariants = {}, presentationFields = [] }) => [
        ...[...bindingSlots, ...Object.values(bindingVariants).flat()].map(({ key: slotKey, authoring }) => ({
            widgetKey,
            fieldKey: `binding.${slotKey}`,
            helperTextKey: authoring.helperTextKey,
            resource: 'common' as const
        })),
        ...presentationFields.flatMap(({ key: fieldKey, helperTextKey }) =>
            helperTextKey ? [{ widgetKey, fieldKey, helperTextKey, resource: 'applications' as const }] : []
        )
    ]
)

const MARKETING_ZONE_KEYS = ['marketingHeader', 'marketingMain', 'marketingFooter'] as const

const readZoneLabel = (locale: unknown, key: string): string => {
    if (!locale || typeof locale !== 'object' || Array.isArray(locale)) return ''
    const root = locale as { common?: { layouts?: unknown } }
    const layouts = root.common?.layouts
    if (!layouts || typeof layouts !== 'object' || Array.isArray(layouts)) return ''
    const zones = (layouts as { zones?: unknown }).zones
    if (!zones || typeof zones !== 'object' || Array.isArray(zones)) return ''
    const value = (zones as Record<string, unknown>)[key]
    return typeof value === 'string' ? value.trim() : ''
}

describe('application marketing layout translations', () => {
    it('keeps all marketing zone labels present and localized in English and Russian', () => {
        for (const key of MARKETING_ZONE_KEYS) {
            const english = readZoneLabel(commonEn, key)
            const russian = readZoneLabel(commonRu, key)

            expect(english).not.toBe('')
            expect(russian).not.toBe('')
            expect(russian).not.toBe(english)
        }
    })

    it('keeps every shared marketing widget dialog label present in both locales', () => {
        for (const key of MARKETING_WIDGET_DIALOG_KEYS) {
            const english = readWidgetLabel(enApplications, key)
            const russian = readWidgetLabel(ruApplications, key)

            expect(english, `applications layouts.marketing.widget.${key} (EN)`).not.toBe('')
            expect(russian, `applications layouts.marketing.widget.${key} (RU)`).not.toBe('')
        }
    })

    it('resolves every registered marketing widget helper text in English and Russian without fallback', () => {
        expect(MARKETING_WIDGET_HELPER_TEXT_FIELDS.length).toBeGreaterThan(0)

        for (const { widgetKey, fieldKey, helperTextKey, resource } of MARKETING_WIDGET_HELPER_TEXT_FIELDS) {
            const englishBundle = resource === 'applications' ? enApplications : commonEn
            const russianBundle = resource === 'applications' ? ruApplications : commonRu
            const rootKey = resource === 'applications' ? 'applications' : 'common'
            const english = readTranslation(englishBundle, rootKey, helperTextKey)
            const russian = readTranslation(russianBundle, rootKey, helperTextKey)
            const context = `${widgetKey}.${fieldKey} (${helperTextKey})`

            expect(english, `${context} (EN)`).not.toBe('')
            expect(russian, `${context} (RU)`).not.toBe('')
            expect(russian, `${context} must have a Russian translation`).not.toBe(english)
        }
    })

    it('keeps the Hero action integrity conflict message in the namespace used by the runtime UI', () => {
        const english = readMarketingLayoutMessage(enApplications, 'heroActionIntegrityConflict')
        const russian = readMarketingLayoutMessage(ruApplications, 'heroActionIntegrityConflict')

        expect(english).not.toBe('')
        expect(russian).not.toBe('')
        expect(russian).not.toBe(english)
    })
})
