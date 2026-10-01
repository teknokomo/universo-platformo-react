import { z } from 'zod'

import {
    MARKETING_COLLECTION_VARIANT_RECORD_KINDS,
    MARKETING_MAX_RUNTIME_RECORDS,
    MARKETING_PAGE_TEMPLATE_KEY,
    marketingCollectionVariantSchema,
    marketingLayoutZoneSchema,
    marketingLocaleCodeSchema,
    marketingPricingCardStyleSchema,
    marketingPricingCardWidthSchema,
    marketingSemanticKeySchema
} from './marketingPagePrimitives'
import type { MarketingLocaleCode } from './marketingPagePrimitives'
import { publicMarketingPageRecordSchema } from './marketingPageRecords'
import {
    marketingHeroWidgetDataSchema,
    marketingImageWidgetDataSchema,
    marketingPageConfigSchema,
    marketingPageRuntimeViewModelSchema
} from './marketingPageRuntimeSchemas'
import type { MarketingPageConfig, MarketingPageRuntimeViewModel } from './marketingPageRuntimeSchemas'

const publicMarketingWidgetInstanceKeySchema = z.union([
    z
        .string()
        .trim()
        .regex(/^marketing-[a-z]+-[0-9]+$/u, 'Public widget instance keys must use semantic renderer identities.'),
    marketingSemanticKeySchema
])

const publicMarketingWidgetDataSchema = z
    .object({ records: z.array(publicMarketingPageRecordSchema).max(MARKETING_MAX_RUNTIME_RECORDS) })
    .strict()

const publicMarketingRuntimeWidgetBaseSchema = z
    .object({
        instanceKey: publicMarketingWidgetInstanceKeySchema,
        zone: marketingLayoutZoneSchema,
        sortOrder: z.number().int().min(0).max(100_000),
        isActive: z.boolean(),
        data: publicMarketingWidgetDataSchema
    })
    .strict()

const publicMarketingEntityWidgetConfigBaseSchema = z
    .object({
        instanceKey: publicMarketingWidgetInstanceKeySchema
    })
    .strict()

export const publicMarketingNavigationWidgetSchema = publicMarketingRuntimeWidgetBaseSchema
    .extend({
        widgetKey: z.literal('marketing.navigation'),
        config: publicMarketingEntityWidgetConfigBaseSchema.extend({
            maxItems: z.number().int().min(1).max(100).default(24)
        })
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

export const publicMarketingHeroWidgetSchema = publicMarketingRuntimeWidgetBaseSchema
    .extend({
        widgetKey: z.literal('marketing.hero'),
        config: publicMarketingEntityWidgetConfigBaseSchema.extend({ showLeadForm: z.boolean().default(true) }),
        data: marketingHeroWidgetDataSchema
    })
    .superRefine((value, context) => {
        if (value.zone !== 'marketing-main') {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['zone'], message: 'Hero widgets must use the main zone.' })
        }
    })

export const publicMarketingImageWidgetSchema = publicMarketingRuntimeWidgetBaseSchema
    .extend({
        widgetKey: z.literal('marketing.image'),
        config: z.object({ instanceKey: publicMarketingWidgetInstanceKeySchema }).strict(),
        data: marketingImageWidgetDataSchema
    })
    .superRefine((value, context) => {
        if (value.zone !== 'marketing-main') {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['zone'], message: 'Image widgets must use the main zone.' })
        }
    })

export const publicMarketingCollectionWidgetSchema = publicMarketingRuntimeWidgetBaseSchema
    .extend({
        widgetKey: z.literal('marketing.collection'),
        config: publicMarketingEntityWidgetConfigBaseSchema.extend({
            variant: marketingCollectionVariantSchema,
            maxItems: z.number().int().min(1).max(100).default(100),
            showTitle: z.boolean().default(true),
            showDescription: z.boolean().default(true),
            showItemDescriptions: z.boolean().default(true),
            fixedItemsHeight: z.boolean().default(false)
        })
    })
    .superRefine((value, context) => {
        if (value.zone !== 'marketing-main') {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['zone'], message: 'Collection widgets must use the main zone.' })
        }
        const kinds = MARKETING_COLLECTION_VARIANT_RECORD_KINDS[value.config.variant]
        if (value.data.records.some((record) => record.kind !== 'sectionCopy' && !(kinds as readonly string[]).includes(record.kind))) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['data'], message: 'Collection data does not match its variant.' })
        }
    })

export const publicMarketingPricingWidgetSchema = publicMarketingRuntimeWidgetBaseSchema
    .extend({
        widgetKey: z.literal('marketing.pricing'),
        config: publicMarketingEntityWidgetConfigBaseSchema.extend({
            maxItems: z.number().int().min(1).max(100).default(24),
            showBenefits: z.boolean().default(true),
            cardStyle: marketingPricingCardStyleSchema.default('featured'),
            cardWidth: marketingPricingCardWidthSchema.default('auto')
        })
    })
    .superRefine((value, context) => {
        if (value.zone !== 'marketing-main') {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['zone'], message: 'Pricing widgets must use the main zone.' })
        }
        if (value.data.records.some((record) => !['pricingTier', 'pricingBenefit', 'sectionCopy'].includes(record.kind))) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['data'], message: 'Pricing data contains an unsupported record kind.' })
        }
    })

export const publicMarketingFooterWidgetSchema = publicMarketingRuntimeWidgetBaseSchema
    .extend({
        widgetKey: z.literal('marketing.footer'),
        config: publicMarketingEntityWidgetConfigBaseSchema.extend({
            maxItems: z.number().int().min(1).max(100).default(100),
            showNewsletter: z.boolean().default(true)
        })
    })
    .superRefine((value, context) => {
        if (value.zone !== 'marketing-footer') {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['zone'], message: 'Footer widgets must use the footer zone.' })
        }
        if (value.data.records.some((record) => !['siteSettings', 'footerLink', 'sectionCopy'].includes(record.kind))) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['data'], message: 'Footer data contains an unsupported record kind.' })
        }
    })

export type PublicMarketingRuntimeWidget =
    | z.infer<typeof publicMarketingNavigationWidgetSchema>
    | z.infer<typeof publicMarketingHeroWidgetSchema>
    | z.infer<typeof publicMarketingImageWidgetSchema>
    | z.infer<typeof publicMarketingCollectionWidgetSchema>
    | z.infer<typeof publicMarketingPricingWidgetSchema>
    | z.infer<typeof publicMarketingFooterWidgetSchema>

export const publicMarketingRuntimeWidgetSchema: z.ZodType<PublicMarketingRuntimeWidget> = z.union([
    publicMarketingNavigationWidgetSchema,
    publicMarketingHeroWidgetSchema,
    publicMarketingImageWidgetSchema,
    publicMarketingCollectionWidgetSchema,
    publicMarketingPricingWidgetSchema,
    publicMarketingFooterWidgetSchema
])

const publicMarketingAtomicHeaderWidgetBaseSchema = z.object({
    instanceKey: publicMarketingWidgetInstanceKeySchema,
    zone: z.literal('marketing-header'),
    sortOrder: z.number().int().min(0).max(100_000),
    isActive: z.boolean(),
    data: publicMarketingWidgetDataSchema
})

export const publicMarketingBrandWidgetSchema = publicMarketingAtomicHeaderWidgetBaseSchema
    .extend({
        widgetKey: z.literal('marketing.brand'),
        config: z.object({ instanceKey: publicMarketingWidgetInstanceKeySchema }).strict()
    })
    .superRefine((value, context) => {
        if (value.data.records.some((record) => record.kind !== 'siteSettings')) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['data'], message: 'Brand data must contain site settings only.' })
        }
    })

export const publicMarketingAuthWidgetSchema = publicMarketingAtomicHeaderWidgetBaseSchema
    .extend({
        widgetKey: z.literal('marketing.auth'),
        config: z.object({ instanceKey: publicMarketingWidgetInstanceKeySchema, showAuthActions: z.boolean().default(true) }).strict()
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

export type PublicMarketingAtomicHeaderWidget =
    | z.infer<typeof publicMarketingBrandWidgetSchema>
    | z.infer<typeof publicMarketingAuthWidgetSchema>

export const publicMarketingAtomicHeaderWidgetSchema: z.ZodType<PublicMarketingAtomicHeaderWidget> = z.union([
    publicMarketingBrandWidgetSchema,
    publicMarketingAuthWidgetSchema
])

export const publicMarketingPageWidgetSchema: z.ZodType<PublicMarketingRuntimeWidget | PublicMarketingAtomicHeaderWidget> = z.union([
    publicMarketingRuntimeWidgetSchema,
    publicMarketingAtomicHeaderWidgetSchema
])

/**
 * Header capabilities whose presence, order and visibility are decided by the
 * persisted layout rows, including the shared language/color-mode switchers.
 */
export const MARKETING_HEADER_WIDGET_KEYS = [
    'marketing.brand',
    'marketing.navigation',
    'marketing.auth',
    'languageSwitcher',
    'colorModeSwitcher'
] as const
export type MarketingHeaderWidgetKey = (typeof MARKETING_HEADER_WIDGET_KEYS)[number]
export const marketingHeaderWidgetKeySchema = z.enum(MARKETING_HEADER_WIDGET_KEYS)

/**
 * Renderer-safe projection of one header layout row. Shared widgets have no
 * content records, so the row carries placement plus a minimal config only.
 */
/** Physical header slots the shared widgets can occupy within the header zone. */
export const MARKETING_HEADER_PLACEMENTS = ['start', 'end'] as const
export const marketingHeaderPlacementSchema = z.enum(MARKETING_HEADER_PLACEMENTS)
export type MarketingHeaderPlacement = (typeof MARKETING_HEADER_PLACEMENTS)[number]

const publicMarketingHeaderWidgetBaseShape = {
    instanceKey: publicMarketingWidgetInstanceKeySchema,
    zone: z.literal('marketing-header'),
    sortOrder: z.number().int().min(0).max(100_000),
    isActive: z.boolean(),
    placement: marketingHeaderPlacementSchema.optional()
} as const

const publicMarketingHeaderWidgetConfigShape = {
    instanceKey: publicMarketingWidgetInstanceKeySchema
} as const

/**
 * Each header row carries exactly the config its renderer consumes: the shared
 * switchers and the brand/navigation rows have no settings beyond the instance
 * key, while the auth row may hide its actions. A per-widget schema keeps the
 * payload from silently shipping renderer-unknown configuration.
 */
/**
 * Exhaustiveness guard for the header projection: every header key declares its
 * config schema in the union below, so a new key either gets an entry here or
 * the build fails instead of shipping a projection the renderer cannot parse.
 */
export const PUBLIC_HEADER_WIDGET_CONFIG_COVERAGE = {
    'marketing.brand': true,
    'marketing.navigation': true,
    'marketing.auth': true,
    languageSwitcher: true,
    colorModeSwitcher: true
} as const satisfies Record<MarketingHeaderWidgetKey, true>

export const publicMarketingHeaderWidgetSchema = z
    .discriminatedUnion('widgetKey', [
        z
            .object({
                widgetKey: z.literal('marketing.auth'),
                ...publicMarketingHeaderWidgetBaseShape,
                config: z.object({ ...publicMarketingHeaderWidgetConfigShape, showAuthActions: z.boolean() }).strict()
            })
            .strict(),
        z
            .object({
                widgetKey: z.literal('marketing.brand'),
                ...publicMarketingHeaderWidgetBaseShape,
                config: z.object(publicMarketingHeaderWidgetConfigShape).strict()
            })
            .strict(),
        z
            .object({
                widgetKey: z.literal('marketing.navigation'),
                ...publicMarketingHeaderWidgetBaseShape,
                config: z.object(publicMarketingHeaderWidgetConfigShape).strict()
            })
            .strict(),
        z
            .object({
                widgetKey: z.literal('languageSwitcher'),
                ...publicMarketingHeaderWidgetBaseShape,
                config: z.object(publicMarketingHeaderWidgetConfigShape).strict()
            })
            .strict(),
        z
            .object({
                widgetKey: z.literal('colorModeSwitcher'),
                ...publicMarketingHeaderWidgetBaseShape,
                config: z.object(publicMarketingHeaderWidgetConfigShape).strict()
            })
            .strict()
    ])
    .superRefine((value, context) => {
        if (value.config.instanceKey !== value.instanceKey) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['config', 'instanceKey'],
                message: 'Header widget config must repeat the row instance key.'
            })
        }
    })
export type PublicMarketingHeaderWidget = z.infer<typeof publicMarketingHeaderWidgetSchema>

export const marketingHeaderPositionSchema = z.enum(['fixed', 'flow'])
export type MarketingHeaderPosition = z.infer<typeof marketingHeaderPositionSchema>

/** Anonymous payload with only renderer inputs; internal IDs, provenance and source locators are excluded. */
export type PublicMarketingPageData = {
    templateKey: typeof MARKETING_PAGE_TEMPLATE_KEY
    locale: MarketingLocaleCode
    config: MarketingPageConfig
    headerPosition: MarketingHeaderPosition
    widgets: Array<PublicMarketingRuntimeWidget | PublicMarketingAtomicHeaderWidget>
    /** Layout-driven header rows, including an empty array when none are configured. */
    headerWidgets: PublicMarketingHeaderWidget[]
}

export const publicMarketingPageDataSchema: z.ZodType<PublicMarketingPageData> = z
    .object({
        templateKey: z.literal(MARKETING_PAGE_TEMPLATE_KEY),
        locale: marketingLocaleCodeSchema,
        config: marketingPageConfigSchema,
        headerPosition: marketingHeaderPositionSchema,
        widgets: z.array(publicMarketingPageWidgetSchema).max(64),
        headerWidgets: z.array(publicMarketingHeaderWidgetSchema).max(24)
    })
    .strict()
    .superRefine((value, context) => {
        const instanceKeys = new Set<string>()
        for (const [index, widget] of value.widgets.entries()) {
            if (instanceKeys.has(widget.instanceKey)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['widgets', index, 'instanceKey'],
                    message: 'Marketing widget instance keys must be unique within a layout.'
                })
            }
            instanceKeys.add(widget.instanceKey)
        }
        const headerKeys = new Set<string>()
        for (const [index, widget] of value.headerWidgets.entries()) {
            if (headerKeys.has(widget.instanceKey)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['headerWidgets', index, 'instanceKey'],
                    message: 'Marketing header widget instance keys must be unique within a layout.'
                })
            }
            headerKeys.add(widget.instanceKey)
        }
    })

export type PublicMarketingPageRuntimeViewModel = {
    templateKey: typeof MARKETING_PAGE_TEMPLATE_KEY
    marketingPage: PublicMarketingPageData
}

export const publicMarketingPageRuntimeViewModelSchema: z.ZodType<PublicMarketingPageRuntimeViewModel> = z
    .object({
        templateKey: z.literal(MARKETING_PAGE_TEMPLATE_KEY),
        marketingPage: publicMarketingPageDataSchema
    })
    .strict()

export type MarketingPageRendererViewModel = MarketingPageRuntimeViewModel | PublicMarketingPageRuntimeViewModel

/**
 * Build the complete runtime envelope without importing the dashboard package.
 * The caller supplies the dashboard-owned schema, keeping this package neutral.
 */
export const createRuntimeViewModelSchema = <TDashboardPayload extends z.ZodTypeAny>(dashboardPayloadSchema: TDashboardPayload) =>
    z.discriminatedUnion('templateKey', [
        z
            .object({
                templateKey: z.literal('dashboard'),
                dashboard: dashboardPayloadSchema
            })
            .strict(),
        marketingPageRuntimeViewModelSchema
    ])

export type RuntimeViewModel<TDashboardPayload = unknown> =
    | { templateKey: 'dashboard'; dashboard: TDashboardPayload }
    | MarketingPageRuntimeViewModel
