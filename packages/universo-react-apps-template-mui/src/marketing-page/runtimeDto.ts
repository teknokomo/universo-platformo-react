import { z } from 'zod'

import {
    MARKETING_COLLECTION_VARIANT_RECORD_KINDS,
    MARKETING_MAX_RUNTIME_RECORDS,
    marketingHeroWidgetDataSchema,
    marketingImageWidgetDataSchema,
    marketingHeaderPositionSchema,
    marketingLayoutZoneSchema,
    marketingLocaleCodeSchema,
    marketingPageConfigSchema,
    marketingRuntimeIdentitySchema,
    marketingWidgetInstanceKeySchema,
    publicMarketingHeaderWidgetSchema,
    publicMarketingPageRecordSchema,
    pageBlockContentSchema
} from '@universo-react/types'

const rendererConfigSchema = marketingPageConfigSchema
const publicRuntimeRecordSchema = publicMarketingPageRecordSchema
// Authenticated and anonymous widget records use renderer-only projections.
// Physical layout/source IDs, Entity IDs, and seed provenance are not renderer inputs.
const authenticatedRuntimeRecordSchema = publicRuntimeRecordSchema

const createRuntimeRecordDataSchema = (recordSchema: z.ZodTypeAny) =>
    z.object({ records: z.array(recordSchema).max(MARKETING_MAX_RUNTIME_RECORDS) }).strict()

const runtimeWidgetFrameSchema = z.object({
    instanceKey: marketingWidgetInstanceKeySchema,
    zone: marketingLayoutZoneSchema,
    sortOrder: z.number().int().min(0).max(100_000),
    isActive: z.boolean()
})

const widgetConfigBaseSchema = z.object({}).strict()

const createMarketingRuntimeWidgetSchema = (recordSchema: z.ZodTypeAny) => {
    const runtimeRecordDataSchema = createRuntimeRecordDataSchema(recordSchema)
    const widgetBase = runtimeWidgetFrameSchema

    return z.union([
        widgetBase
            .extend({
                widgetKey: z.literal('marketing.brand'),
                config: widgetConfigBaseSchema.strict(),
                data: runtimeRecordDataSchema
            })
            .strict()
            .superRefine((widget, context) => {
                if (widget.zone !== 'marketing-header') {
                    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Brand widgets must use the header zone.', path: ['zone'] })
                }
                if (widget.data.records.length > 1 || widget.data.records.some((record) => record.kind !== 'siteSettings')) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'Brand data must contain at most one Site Settings record.',
                        path: ['data']
                    })
                }
            }),
        widgetBase
            .extend({
                widgetKey: z.literal('marketing.navigation'),
                config: widgetConfigBaseSchema.extend({ maxItems: z.number().int().min(1).max(100).default(24) }).strict(),
                data: runtimeRecordDataSchema
            })
            .strict()
            .superRefine((widget, context) => {
                if (widget.zone !== 'marketing-header') {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'Navigation widgets must use the header zone.',
                        path: ['zone']
                    })
                }
                if (widget.data.records.some((record) => record.kind !== 'navigationLink')) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'Navigation data has an unsupported record kind.',
                        path: ['data']
                    })
                }
            }),
        widgetBase
            .extend({
                widgetKey: z.literal('marketing.auth'),
                config: widgetConfigBaseSchema.extend({ showAuthActions: z.boolean().default(true) }).strict(),
                data: z.object({ records: z.tuple([]) }).strict()
            })
            .strict()
            .superRefine((widget, context) => {
                if (widget.zone !== 'marketing-header') {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'Authentication widgets must use the header zone.',
                        path: ['zone']
                    })
                }
            }),
        widgetBase
            .extend({
                widgetKey: z.literal('marketing.hero'),
                config: widgetConfigBaseSchema.extend({ showLeadForm: z.boolean().default(true) }).strict(),
                data: marketingHeroWidgetDataSchema
            })
            .strict()
            .superRefine((widget, context) => {
                if (widget.zone !== 'marketing-main') {
                    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Hero widgets must use the main zone.', path: ['zone'] })
                }
            }),
        widgetBase
            .extend({
                widgetKey: z.literal('marketing.image'),
                config: widgetConfigBaseSchema.strict(),
                data: marketingImageWidgetDataSchema
            })
            .strict()
            .superRefine((widget, context) => {
                if (widget.zone !== 'marketing-main') {
                    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Image widgets must use the main zone.', path: ['zone'] })
                }
            }),
        widgetBase
            .extend({
                widgetKey: z.literal('marketing.collection'),
                config: widgetConfigBaseSchema
                    .extend({
                        variant: z.enum(['logos', 'features', 'testimonials', 'highlights', 'faq']),
                        maxItems: z.number().int().min(1).max(1000).default(100),
                        showTitle: z.boolean().default(true),
                        showDescription: z.boolean().default(true),
                        showItemDescriptions: z.boolean().default(true),
                        fixedItemsHeight: z.boolean().default(false)
                    })
                    .strict(),
                data: runtimeRecordDataSchema
            })
            .strict()
            .superRefine((widget, context) => {
                if (widget.zone !== 'marketing-main') {
                    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Collection widgets must use the main zone.', path: ['zone'] })
                }
                const allowedKinds: readonly string[] = MARKETING_COLLECTION_VARIANT_RECORD_KINDS[widget.config.variant]
                if (widget.data.records.some((record) => record.kind !== 'sectionCopy' && !allowedKinds.includes(record.kind))) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'Collection data does not match its variant.',
                        path: ['data']
                    })
                }
            }),
        widgetBase
            .extend({
                widgetKey: z.literal('marketing.pricing'),
                config: widgetConfigBaseSchema
                    .extend({
                        maxItems: z.number().int().min(1).max(100).default(24),
                        showBenefits: z.boolean().default(true),
                        cardStyle: z.enum(['featured', 'uniform']).default('featured'),
                        cardWidth: z.enum(['auto', 'full']).default('auto')
                    })
                    .strict(),
                data: runtimeRecordDataSchema
            })
            .strict()
            .superRefine((widget, context) => {
                if (widget.zone !== 'marketing-main') {
                    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Pricing widgets must use the main zone.', path: ['zone'] })
                }
                if (widget.data.records.some((record) => !['sectionCopy', 'pricingBenefit', 'pricingTier'].includes(record.kind))) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'Pricing data has an unsupported record kind.',
                        path: ['data']
                    })
                }
            }),
        widgetBase
            .extend({
                widgetKey: z.literal('marketing.footer'),
                config: widgetConfigBaseSchema
                    .extend({
                        maxItems: z.number().int().min(1).max(100).default(100),
                        showNewsletter: z.boolean().default(true)
                    })
                    .strict(),
                data: runtimeRecordDataSchema
            })
            .strict()
            .superRefine((widget, context) => {
                if (widget.zone !== 'marketing-footer') {
                    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Footer widgets must use the footer zone.', path: ['zone'] })
                }
                if (widget.data.records.some((record) => !['siteSettings', 'footerLink'].includes(record.kind))) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'Footer data has an unsupported record kind.',
                        path: ['data']
                    })
                }
            })
    ])
}

const authenticatedMarketingRuntimeWidgetSchema = createMarketingRuntimeWidgetSchema(authenticatedRuntimeRecordSchema)
const publicMarketingRuntimeWidgetSchema = createMarketingRuntimeWidgetSchema(publicRuntimeRecordSchema)

const validateWidgetIdentities = <T extends { widgets: Array<{ instanceKey: string; isActive: boolean }> }>(
    page: T,
    context: z.RefinementCtx
) => {
    const instanceKeys = new Set<string>()
    for (const [index, widget] of page.widgets.entries()) {
        const key = String(widget.instanceKey)
        if (instanceKeys.has(key)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Marketing widget instance keys must be unique.',
                path: ['widgets', index, 'instanceKey']
            })
        }
        instanceKeys.add(key)
    }
    // A scoped layout may intentionally have no widget rows. Global-layout
    // readiness is enforced by the server resolver before either DTO is built.
}

const authenticatedMarketingPageSchema = z
    .object({
        templateKey: z.literal('marketing-page'),
        locale: marketingLocaleCodeSchema,
        config: rendererConfigSchema,
        widgets: z.array(authenticatedMarketingRuntimeWidgetSchema).max(64),
        runtime: marketingRuntimeIdentitySchema,
        richContent: pageBlockContentSchema.optional()
    })
    .strict()
    .superRefine(validateWidgetIdentities)

const publicMarketingPageSchema = z
    .object({
        templateKey: z.literal('marketing-page'),
        locale: marketingLocaleCodeSchema,
        config: rendererConfigSchema,
        headerPosition: marketingHeaderPositionSchema,
        widgets: z.array(publicMarketingRuntimeWidgetSchema).max(64),
        headerWidgets: z.array(publicMarketingHeaderWidgetSchema).max(24)
    })
    .strict()
    .superRefine(validateWidgetIdentities)

export const authenticatedMarketingPageRuntimePayloadSchema = z
    .object({ templateKey: z.literal('marketing-page'), marketingPage: authenticatedMarketingPageSchema })
    .strict()

export const publicMarketingPageRuntimePayloadSchema = z
    .object({ templateKey: z.literal('marketing-page'), marketingPage: publicMarketingPageSchema })
    .strict()

export const marketingPageRuntimePayloadSchema = z.union([
    authenticatedMarketingPageRuntimePayloadSchema,
    publicMarketingPageRuntimePayloadSchema
])

export type MarketingRendererConfig = z.infer<typeof rendererConfigSchema>
export type MarketingRuntimeWidgetProjection =
    | z.infer<typeof authenticatedMarketingRuntimeWidgetSchema>
    | z.infer<typeof publicMarketingRuntimeWidgetSchema>
export type MarketingRuntimeRecordProjection =
    | z.infer<typeof publicRuntimeRecordSchema>
    | z.infer<typeof marketingHeroWidgetDataSchema>['records'][number]
export type MarketingPageRuntimePayload = z.infer<typeof marketingPageRuntimePayloadSchema>
export type AuthenticatedMarketingPageRuntimePayload = z.infer<typeof authenticatedMarketingPageRuntimePayloadSchema>
