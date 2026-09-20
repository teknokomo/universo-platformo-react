import { describe, expect, it } from 'vitest'

import commonEn from '@universo-react/i18n/locales/en/common.json'
import commonRu from '@universo-react/i18n/locales/ru/common.json'
import enMetahubs from '../locales/en/metahubs.json'
import ruMetahubs from '../locales/ru/metahubs.json'

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

/**
 * The shared marketing widget dialog lives in `@universo-react/template-mui`,
 * so the i18n coverage gate cannot scan it; these are the labels it resolves
 * from the metahubs bundle.
 */
const MARKETING_WIDGET_DIALOG_KEYS = [
    'variant',
    'maxItems',
    'brandLogoHelper',
    'brandLogoUrl',
    'brandNameHelper',
    'brandName',
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
    const layouts = (bundle as { layouts?: { marketing?: { widget?: unknown } } }).layouts
    const widget = layouts?.marketing?.widget
    if (!widget || typeof widget !== 'object' || Array.isArray(widget)) return ''
    const value = (widget as Record<string, unknown>)[key]
    return typeof value === 'string' ? value.trim() : ''
}

describe('metahub marketing layout translations', () => {
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
            expect(readWidgetLabel(enMetahubs, key), `layouts.marketing.widget.${key} (EN)`).not.toBe('')
            expect(readWidgetLabel(ruMetahubs, key), `layouts.marketing.widget.${key} (RU)`).not.toBe('')
        }
    })
})
