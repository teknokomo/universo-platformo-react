import { z } from 'zod'

import { pageBlockContentSchema } from './pageBlocks'
import {
    MARKETING_COLLECTION_VARIANT_RECORD_KINDS,
    MARKETING_MAX_RUNTIME_RECORDS,
    MARKETING_PAGE_TEMPLATE_KEY,
    marketingActionSchema,
    marketingCollectionVariantSchema,
    marketingLayoutZoneSchema,
    marketingLinkTargetSchema,
    marketingLocaleCodeSchema,
    marketingLocalizedTextSchema,
    marketingPricingCardStyleSchema,
    marketingPricingCardWidthSchema,
    marketingProvenanceSchema,
    marketingWidgetInstanceKeySchema
} from './marketingPagePrimitives'
import type { MarketingAction, MarketingLocaleCode, MarketingProvenance } from './marketingPagePrimitives'
import { publicMarketingImageRecordSchema, publicMarketingPageRecordSchema } from './marketingPageRecords'

const marketingThemeModeSchema = z.enum(['system', 'light', 'dark']).default('system')

const marketingHexColorSchema = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

const marketingColorLuminance = (value: string): number | undefined => {
    if (!marketingHexColorSchema.test(value)) return undefined
    const hex = value.slice(1)
    if (hex.length === 8 && hex.slice(6).toLowerCase() !== 'ff') return undefined
    const channels =
        hex.length === 3
            ? hex.split('').map((channel) => Number.parseInt(`${channel}${channel}`, 16))
            : [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16))
    if (channels.some((channel) => Number.isNaN(channel))) return undefined
    return channels
        .map((channel) => channel / 255)
        .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
        .reduce((luminance, channel, index) => luminance + channel * [0.2126, 0.7152, 0.0722][index], 0)
}

/** Brand colors must have an AA-safe foreground choice on light or dark surfaces. */
export const marketingThemeColorSchema = z
    .string()
    .trim()
    .regex(marketingHexColorSchema)
    .refine((value) => {
        const luminance = marketingColorLuminance(value)
        if (luminance === undefined) return false
        const lightContrast = 1.05 / (luminance + 0.05)
        const darkContrast = (luminance + 0.05) / 0.05
        return Math.max(lightContrast, darkContrast) >= 4.5
    }, 'Theme colors must provide at least 4.5:1 contrast with black or white text.')

export const marketingPageConfigSchema = z
    .object({
        themeMode: marketingThemeModeSchema,
        primaryColor: marketingThemeColorSchema.optional(),
        accentColor: marketingThemeColorSchema.optional(),
        allowEmailActions: z.boolean().default(true),
        allowTelephoneActions: z.boolean().default(true),
        externalLinkTarget: marketingLinkTargetSchema.default('new-tab')
    })
    .strict()
export type MarketingPageConfig = z.infer<typeof marketingPageConfigSchema>

export const marketingNavigationWidgetConfigSchema = z
    .object({
        instanceKey: marketingWidgetInstanceKeySchema,
        maxItems: z.number().int().min(1).max(100).default(24)
    })
    .strict()

export const marketingHeroWidgetConfigSchema = z
    .object({
        instanceKey: marketingWidgetInstanceKeySchema,
        showLeadForm: z.boolean().default(true)
    })
    .strict()

const marketingHeroActionTargetLength = (action: MarketingAction): number => {
    switch (action.kind) {
        case 'internal':
            return action.path.length
        case 'external':
            return action.url.length
        case 'anchor':
            return action.href.length
        case 'email':
            return action.address.length + (action.subject?.length ?? 0)
        case 'tel':
            return action.number.length
    }
}

/** Bounded, localized Hero projection produced by the Entity binding resolver. */
export const marketingHeroEntityContentSchema = z
    .object({
        title: marketingLocalizedTextSchema,
        accent: marketingLocalizedTextSchema.optional(),
        description: marketingLocalizedTextSchema,
        emailLabel: marketingLocalizedTextSchema,
        emailPlaceholder: marketingLocalizedTextSchema,
        primaryActionLabel: marketingLocalizedTextSchema,
        primaryAction: marketingActionSchema,
        termsText: marketingLocalizedTextSchema.optional(),
        termsLinkLabel: marketingLocalizedTextSchema.optional(),
        termsAction: marketingActionSchema.optional()
    })
    .strict()
    .superRefine((content, context) => {
        const fields: Array<[keyof typeof content, number]> = [
            ['title', 255],
            ['accent', 120],
            ['description', 2000],
            ['emailLabel', 120],
            ['emailPlaceholder', 120],
            ['primaryActionLabel', 120],
            ['termsText', 500],
            ['termsLinkLabel', 120]
        ]
        for (const [field, maxLength] of fields) {
            const localized = content[field]
            if (!localized || typeof localized === 'string') continue
            for (const [locale, value] of Object.entries(localized)) {
                if (value.length > maxLength) {
                    context.addIssue({
                        code: z.ZodIssueCode.too_big,
                        type: 'string',
                        maximum: maxLength,
                        inclusive: true,
                        path: [field, locale],
                        message: 'Hero text exceeds the configured length limit.'
                    })
                }
            }
        }

        const hasTerms = ['termsText', 'termsLinkLabel', 'termsAction'].some(
            (field) => content[field as keyof typeof content] !== undefined
        )
        if (hasTerms && (!content.termsText || !content.termsLinkLabel || !content.termsAction)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['termsText'],
                message: 'Terms text, link label, and action must be provided together.'
            })
        }
        if (marketingHeroActionTargetLength(content.primaryAction) > 500) {
            context.addIssue({
                code: z.ZodIssueCode.too_big,
                type: 'string',
                maximum: 500,
                inclusive: true,
                path: ['primaryAction'],
                message: 'Hero action targets may contain at most 500 characters.'
            })
        }
        if (content.termsAction && marketingHeroActionTargetLength(content.termsAction) > 500) {
            context.addIssue({
                code: z.ZodIssueCode.too_big,
                type: 'string',
                maximum: 500,
                inclusive: true,
                path: ['termsAction'],
                message: 'Hero action targets may contain at most 500 characters.'
            })
        }
    })
export type MarketingHeroEntityContent = z.infer<typeof marketingHeroEntityContentSchema>

/**
 * Keeps the established `data.records` runtime envelope while carrying a
 * bounded projection of the Entity record that owns Hero content.
 */
export const marketingHeroContentRecordSchema = z
    .object({
        kind: z.literal('heroContent'),
        semanticKey: z.literal('content'),
        order: z.literal(0),
        isVisible: z.literal(true),
        content: marketingHeroEntityContentSchema
    })
    .strict()

export const marketingHeroWidgetDataSchema = z.object({ records: z.tuple([marketingHeroContentRecordSchema]) }).strict()
export type MarketingHeroWidgetData = z.infer<typeof marketingHeroWidgetDataSchema>

export const marketingCollectionWidgetConfigSchema = z
    .object({
        instanceKey: marketingWidgetInstanceKeySchema,
        variant: marketingCollectionVariantSchema,
        maxItems: z.number().int().min(1).max(100).default(100),
        showTitle: z.boolean().default(true),
        showDescription: z.boolean().default(true),
        /** Features-only: hide item descriptions so the cards show titles only. */
        showItemDescriptions: z.boolean().default(true),
        /** Features-only: constrain the item list to the media area height with vertical scrolling. */
        fixedItemsHeight: z.boolean().default(false)
    })
    .strict()

export const marketingPricingWidgetConfigSchema = z
    .object({
        instanceKey: marketingWidgetInstanceKeySchema,
        maxItems: z.number().int().min(1).max(100).default(24),
        showBenefits: z.boolean().default(true),
        cardStyle: marketingPricingCardStyleSchema.default('featured'),
        cardWidth: marketingPricingCardWidthSchema.default('auto')
    })
    .strict()

export const marketingFooterWidgetConfigSchema = z
    .object({
        instanceKey: marketingWidgetInstanceKeySchema,
        maxItems: z.number().int().min(1).max(100).default(100),
        showNewsletter: z.boolean().default(true)
    })
    .strict()

/** Brand content is resolved from the bound SiteSettings record. */
export const marketingBrandWidgetConfigSchema = z.object({ instanceKey: marketingWidgetInstanceKeySchema }).strict()

export const marketingImageWidgetConfigSchema = z.object({ instanceKey: marketingWidgetInstanceKeySchema }).strict()

export const marketingAuthWidgetConfigSchema = z
    .object({
        instanceKey: marketingWidgetInstanceKeySchema,
        showAuthActions: z.boolean().default(true)
    })
    .strict()

export const marketingWidgetDataSchema = z
    .object({ records: z.array(publicMarketingPageRecordSchema).max(MARKETING_MAX_RUNTIME_RECORDS) })
    .strict()

export const marketingImageWidgetDataSchema = z.object({ records: z.tuple([publicMarketingImageRecordSchema]) }).strict()

export const marketingRuntimeIdentitySchema = z
    .object({
        layoutVersion: z.number().int().positive(),
        layoutHash: z
            .string()
            .trim()
            .regex(/^[a-f0-9]{64}$/i)
    })
    .strict()
export type MarketingRuntimeIdentity = z.infer<typeof marketingRuntimeIdentitySchema>

const marketingRuntimeWidgetBaseSchema = z.object({
    instanceKey: marketingWidgetInstanceKeySchema,
    zone: marketingLayoutZoneSchema,
    sortOrder: z.number().int().min(0).max(100_000),
    isActive: z.boolean(),
    data: marketingWidgetDataSchema
})

export const marketingNavigationWidgetSchema = marketingRuntimeWidgetBaseSchema
    .extend({
        widgetKey: z.literal('marketing.navigation'),
        config: marketingNavigationWidgetConfigSchema
    })
    .superRefine((value, context) => {
        if (value.zone !== 'marketing-header') {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['zone'], message: 'Navigation widgets must use the header zone.' })
        }
        if (value.data.records.some((record) => record.kind !== 'navigationLink')) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['data'],
                message: 'Navigation data contains an unsupported record kind.'
            })
        }
    })

export const marketingHeroWidgetSchema = marketingRuntimeWidgetBaseSchema
    .extend({
        widgetKey: z.literal('marketing.hero'),
        config: marketingHeroWidgetConfigSchema,
        data: marketingHeroWidgetDataSchema
    })
    .superRefine((value, context) => {
        if (value.zone !== 'marketing-main') {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['zone'], message: 'Hero widgets must use the main zone.' })
        }
    })

export const marketingImageWidgetSchema = marketingRuntimeWidgetBaseSchema
    .extend({
        widgetKey: z.literal('marketing.image'),
        config: marketingImageWidgetConfigSchema,
        data: marketingImageWidgetDataSchema
    })
    .superRefine((value, context) => {
        if (value.zone !== 'marketing-main') {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['zone'], message: 'Image widgets must use the main zone.' })
        }
    })

export const marketingCollectionWidgetSchema = marketingRuntimeWidgetBaseSchema
    .extend({
        widgetKey: z.literal('marketing.collection'),
        config: marketingCollectionWidgetConfigSchema
    })
    .superRefine((value, context) => {
        if (value.zone !== 'marketing-main') {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['zone'], message: 'Collection widgets must use the main zone.' })
        }
        const kinds = MARKETING_COLLECTION_VARIANT_RECORD_KINDS[value.config.variant]
        if (value.data.records.some((record) => record.kind !== 'sectionCopy' && !(kinds as readonly string[]).includes(record.kind))) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['data'],
                message: `Collection data does not match the ${value.config.variant} variant.`
            })
        }
    })

export const marketingPricingWidgetSchema = marketingRuntimeWidgetBaseSchema
    .extend({
        widgetKey: z.literal('marketing.pricing'),
        config: marketingPricingWidgetConfigSchema
    })
    .superRefine((value, context) => {
        if (value.zone !== 'marketing-main') {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['zone'], message: 'Pricing widgets must use the main zone.' })
        }
        if (value.data.records.some((record) => !['pricingTier', 'pricingBenefit', 'sectionCopy'].includes(record.kind))) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['data'], message: 'Pricing data contains an unsupported record kind.' })
        }
    })

export const marketingFooterWidgetSchema = marketingRuntimeWidgetBaseSchema
    .extend({
        widgetKey: z.literal('marketing.footer'),
        config: marketingFooterWidgetConfigSchema
    })
    .superRefine((value, context) => {
        if (value.zone !== 'marketing-footer') {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['zone'], message: 'Footer widgets must use the footer zone.' })
        }
        if (value.data.records.some((record) => !['siteSettings', 'footerLink', 'sectionCopy'].includes(record.kind))) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['data'], message: 'Footer data contains an unsupported record kind.' })
        }
    })

// Branch-level refinements are intentional: Zod 3 cannot build a discriminated
// union from ZodEffects, so this union remains strict and fail-closed through
// each branch's literal widget key and refinement.
export type MarketingRuntimeWidget =
    | z.infer<typeof marketingNavigationWidgetSchema>
    | z.infer<typeof marketingHeroWidgetSchema>
    | z.infer<typeof marketingImageWidgetSchema>
    | z.infer<typeof marketingCollectionWidgetSchema>
    | z.infer<typeof marketingPricingWidgetSchema>
    | z.infer<typeof marketingFooterWidgetSchema>

export const marketingRuntimeWidgetSchema: z.ZodType<MarketingRuntimeWidget> = z.union([
    marketingNavigationWidgetSchema,
    marketingHeroWidgetSchema,
    marketingImageWidgetSchema,
    marketingCollectionWidgetSchema,
    marketingPricingWidgetSchema,
    marketingFooterWidgetSchema
])

const marketingAtomicHeaderWidgetBaseSchema = z.object({
    instanceKey: marketingWidgetInstanceKeySchema,
    zone: z.literal('marketing-header'),
    sortOrder: z.number().int().min(0).max(100_000),
    isActive: z.boolean(),
    data: marketingWidgetDataSchema
})

export const marketingBrandWidgetSchema = marketingAtomicHeaderWidgetBaseSchema
    .extend({
        widgetKey: z.literal('marketing.brand'),
        config: marketingBrandWidgetConfigSchema
    })
    .superRefine((value, context) => {
        if (value.data.records.some((record) => record.kind !== 'siteSettings')) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['data'],
                message: 'Brand data must contain site settings only.'
            })
        }
    })

export const marketingAuthWidgetSchema = marketingAtomicHeaderWidgetBaseSchema
    .extend({
        widgetKey: z.literal('marketing.auth'),
        config: marketingAuthWidgetConfigSchema
    })
    .superRefine((value, context) => {
        if (value.data.records.length > 0) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['data'],
                message: 'Authentication data must not contain content records.'
            })
        }
    })

export type MarketingAtomicHeaderWidget = z.infer<typeof marketingBrandWidgetSchema> | z.infer<typeof marketingAuthWidgetSchema>

export const marketingAtomicHeaderWidgetSchema = z.union([marketingBrandWidgetSchema, marketingAuthWidgetSchema])

export const marketingPageWidgetSchema = z.union([marketingRuntimeWidgetSchema, marketingAtomicHeaderWidgetSchema])

export type MarketingPageData = {
    templateKey: typeof MARKETING_PAGE_TEMPLATE_KEY
    locale: MarketingLocaleCode
    config: MarketingPageConfig
    widgets: Array<MarketingRuntimeWidget | MarketingAtomicHeaderWidget>
    runtime: MarketingRuntimeIdentity
    provenance?: MarketingProvenance
    richContent?: z.infer<typeof pageBlockContentSchema>
}

export const marketingPageDataSchema: z.ZodType<MarketingPageData> = z
    .object({
        templateKey: z.literal(MARKETING_PAGE_TEMPLATE_KEY),
        locale: marketingLocaleCodeSchema,
        config: marketingPageConfigSchema,
        widgets: z.array(marketingPageWidgetSchema).max(64),
        runtime: marketingRuntimeIdentitySchema,
        provenance: marketingProvenanceSchema.optional(),
        richContent: pageBlockContentSchema.optional()
    })
    .strict()
    .superRefine((value, context) => {
        const instanceKeys = new Set<string>()
        for (const [index, widget] of value.widgets.entries()) {
            const key = String(widget.instanceKey)
            if (instanceKeys.has(key)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['widgets', index, 'instanceKey'],
                    message: 'Marketing widget instance keys must be unique within a layout.'
                })
            }
            instanceKeys.add(key)
        }
    })

export type MarketingPageRuntimeViewModel = {
    templateKey: typeof MARKETING_PAGE_TEMPLATE_KEY
    marketingPage: MarketingPageData
}

export const marketingPageRuntimeViewModelSchema: z.ZodType<MarketingPageRuntimeViewModel> = z
    .object({
        templateKey: z.literal(MARKETING_PAGE_TEMPLATE_KEY),
        marketingPage: marketingPageDataSchema
    })
    .strict()

/**
 * Public widget identities are either the persisted semantic instance key
 * (kept so rendered section anchors stay resolvable) or a deterministic
 * synthetic key that never exposes opaque internal identifiers.
 */
