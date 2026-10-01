import { describe, expect, it } from 'vitest'

import commonEn from '@universo-react/i18n/locales/en/common.json'
import commonRu from '@universo-react/i18n/locales/ru/common.json'
import { getMarketingActionSectionTargets, MARKETING_ACTION_INTERNAL_ROUTES } from '@universo-react/types'
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
    'variantHelp',
    'variants.logos',
    'variants.features',
    'variants.testimonials',
    'variants.highlights',
    'variants.faq',
    'maxItems',
    'maxItemsHelper',
    'showTitle',
    'showTitleHelper',
    'showDescription',
    'showDescriptionHelper',
    'configurePresentation',
    'showItemDescriptions',
    'showItemDescriptionsHelper',
    'fixedItemsHeight',
    'fixedItemsHeightHelper',
    'showBenefits',
    'showBenefitsHelper',
    'cardStyle',
    'cardStyleHelper',
    'cardStyleFeatured',
    'cardStyleUniform',
    'cardWidth',
    'cardWidthHelper',
    'cardWidthAuto',
    'cardWidthFull',
    'showNewsletter',
    'showNewsletterHelper',
    'showLeadForm',
    'showLeadFormHelper',
    'showAuthActions',
    'showAuthActionsHelper'
] as const

const MARKETING_WIDGET_BINDING_KEYS = [
    'sourceLabel',
    'sourcePlaceholder',
    'sourceHelperText',
    'requiredSourceError',
    'noSources',
    'loadingSources',
    'recordLabel',
    'recordPlaceholder',
    'recordHelperText',
    'missingLocale',
    'locales.en',
    'locales.ru',
    'requiredRecordError',
    'noRecords',
    'loadingRecords',
    'chooseRelationParent',
    'contentField',
    'createRecord',
    'createRecordTitle',
    'editRecord',
    'editRecordTitle',
    'createSeparateSource',
    'createSourceTitle',
    'createSourceDescription',
    'createSourceError',
    'createSourceName',
    'createSourceNameHelp',
    'loadError',
    'loadMore',
    'loadMoreRecords',
    'loadingMore',
    'loadingMoreRecords',
    'loadingRecord',
    'loadingRecordFields',
    'noSlots',
    'notSelected',
    'recordFieldsEmpty',
    'unsupportedRequiredFields',
    'recordFieldsError',
    'recordLoadError',
    'recordSaveError',
    'recordsError',
    'relationHelper',
    'relationSourceIncompatible',
    'requiredSelection',
    'resultsTruncated',
    'saveError',
    'sourcesError',
    'untitledRecord',
    'pageDescription',
    ...(['site', 'items', 'content', 'section', 'tiers', 'benefits', 'links'] as const).flatMap((slot) => [
        `${slot}.label`,
        `${slot}.placeholder`,
        `${slot}.helperText`,
        `${slot}.noOptions`,
        `${slot}.loading`
    ])
] as const

const readWidgetLabel = (bundle: unknown, key: string): string => {
    if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) return ''
    const layouts = (bundle as { layouts?: { marketing?: { widget?: unknown } } }).layouts
    let value: unknown = layouts?.marketing?.widget
    for (const segment of key.split('.')) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
        value = (value as Record<string, unknown>)[segment]
    }
    return typeof value === 'string' ? value.trim() : ''
}

const readCommonWidgetBindingLabel = (locale: unknown, key: string): string => {
    if (!locale || typeof locale !== 'object' || Array.isArray(locale)) return ''
    const root = locale as { common?: { layouts?: { widgetBindings?: unknown } } }
    let value: unknown = root.common?.layouts?.widgetBindings
    for (const segment of key.split('.')) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
        value = (value as Record<string, unknown>)[segment]
    }
    return typeof value === 'string' ? value.trim() : ''
}

describe('metahub marketing layout translations', () => {
    it('keeps the shared bound-record deletion message aligned across locales', () => {
        expect(enMetahubs.records.deleteBound).toBe(
            'This record is used by a layout widget. Open Layouts, choose another content record or remove the widget before deleting this record.'
        )
        expect(ruMetahubs.records.deleteBound).toBe(
            'Эта запись используется виджетом макета. Откройте макеты, выберите для виджета другую запись содержимого или удалите виджет, затем повторите удаление.'
        )
        expect(ruMetahubs.records.deleteBound).not.toBe(enMetahubs.records.deleteBound)
    })

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

    it('keeps every generic marketing binding label present and localized in the shared bundles', () => {
        for (const key of MARKETING_WIDGET_BINDING_KEYS) {
            const english = readCommonWidgetBindingLabel(commonEn, key)
            const russian = readCommonWidgetBindingLabel(commonRu, key)

            expect(english, `layouts.widgetBindings.${key} (EN)`).not.toBe('')
            expect(russian, `layouts.widgetBindings.${key} (RU)`).not.toBe('')
            expect(russian, `layouts.widgetBindings.${key} locale parity`).not.toBe(english)
        }
    })

    it('keeps marketing action route and section labels localized in common bundles', () => {
        const getLabel = (locale: unknown, path: string): string => {
            if (!locale || typeof locale !== 'object' || Array.isArray(locale)) return ''
            const root = locale as { common?: { layouts?: unknown } }
            let value: unknown = root.common?.layouts
            for (const segment of path.replace(/^layouts\./u, '').split('.')) {
                if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
                value = (value as Record<string, unknown>)[segment]
            }
            return typeof value === 'string' ? value.trim() : ''
        }

        const sections = getMarketingActionSectionTargets([
            { widgetKey: 'marketing.hero' },
            { widgetKey: 'marketing.collection', content: { variant: 'logos' } },
            { widgetKey: 'marketing.collection', content: { variant: 'features' } },
            { widgetKey: 'marketing.collection', content: { variant: 'testimonials' } },
            { widgetKey: 'marketing.collection', content: { variant: 'highlights' } },
            { widgetKey: 'marketing.collection', content: { variant: 'faq' } },
            { widgetKey: 'marketing.pricing' },
            { widgetKey: 'marketing.footer' }
        ])
        const labelKeys = [...MARKETING_ACTION_INTERNAL_ROUTES.map(({ labelKey }) => labelKey), ...sections.map(({ labelKey }) => labelKey)]

        for (const key of labelKeys) {
            const english = getLabel(commonEn, key)
            const russian = getLabel(commonRu, key)
            expect(english, `${key} (EN)`).not.toBe('')
            expect(russian, `${key} (RU)`).not.toBe('')
            expect(russian).not.toBe(english)
        }
    })

    it('keeps the shared widget presentation action localized in common bundles', () => {
        const getWidgetHint = (locale: unknown, key: 'configurePresentation' | 'entityContentHint'): string => {
            if (!locale || typeof locale !== 'object' || Array.isArray(locale)) return ''
            const root = locale as { common?: { layouts?: { marketing?: { widget?: unknown } } } }
            const widget = root.common?.layouts?.marketing?.widget
            if (!widget || typeof widget !== 'object' || Array.isArray(widget)) return ''
            const value = (widget as Record<string, unknown>)[key]
            return typeof value === 'string' ? value.trim() : ''
        }

        for (const key of ['configurePresentation', 'entityContentHint'] as const) {
            const english = getWidgetHint(commonEn, key)
            const russian = getWidgetHint(commonRu, key)
            expect(english, `layouts.marketing.widget.${key} (EN)`).not.toBe('')
            expect(russian, `layouts.marketing.widget.${key} (RU)`).not.toBe('')
            expect(russian).not.toBe(english)
        }
    })

    it('keeps the marketing layout page description localized in common bundles', () => {
        const getDescription = (locale: unknown): string => {
            if (!locale || typeof locale !== 'object' || Array.isArray(locale)) return ''
            const root = locale as { common?: { layouts?: { widgetBindings?: { pageDescription?: unknown } } } }
            const value = root.common?.layouts?.widgetBindings?.pageDescription
            return typeof value === 'string' ? value.trim() : ''
        }

        const english = getDescription(commonEn)
        const russian = getDescription(commonRu)
        expect(english).not.toBe('')
        expect(russian).not.toBe('')
        expect(russian).not.toBe(english)
    })

    it('keeps content-record locale validation labels localized in common bundles', () => {
        const getWidgetBindingLabel = (locale: unknown, key: string): string => {
            if (!locale || typeof locale !== 'object' || Array.isArray(locale)) return ''
            const root = locale as { common?: { layouts?: { widgetBindings?: unknown } } }
            const widgetBindings = root.common?.layouts?.widgetBindings
            if (!widgetBindings || typeof widgetBindings !== 'object' || Array.isArray(widgetBindings)) return ''
            const value = (widgetBindings as Record<string, unknown>)[key]
            if (typeof value === 'string') return value.trim()
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                return Object.values(value as Record<string, unknown>)
                    .filter((entry) => typeof entry === 'string')
                    .join(' ')
                    .trim()
            }
            return ''
        }

        for (const key of ['missingLocale', 'locales'] as const) {
            const english = getWidgetBindingLabel(commonEn, key)
            const russian = getWidgetBindingLabel(commonRu, key)
            expect(english, `layouts.widgetBindings.${key} (EN)`).not.toBe('')
            expect(russian, `layouts.widgetBindings.${key} (RU)`).not.toBe('')
            expect(russian).not.toBe(english)
        }
    })
})
