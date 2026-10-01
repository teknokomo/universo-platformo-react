import { z } from 'zod'

import {
    marketingActionSchema,
    marketingLocaleCodeSchema,
    marketingLocalizedTextSchema,
    marketingMediaSchema,
    marketingPersistedIdSchema,
    marketingProvenanceSchema,
    marketingScopeSchema,
    marketingSemanticKeySchema,
    publicMarketingMediaSchema
} from './marketingPagePrimitives'

const marketingRecordBaseSchema = z.object({
    id: marketingPersistedIdSchema,
    semanticKey: marketingSemanticKeySchema,
    locale: marketingLocaleCodeSchema,
    order: z.number().int().min(0).max(10000),
    isVisible: z.boolean().default(true),
    scope: marketingScopeSchema.default('application'),
    provenance: marketingProvenanceSchema
})

const marketingActionButtonSchema = z
    .object({
        label: marketingLocalizedTextSchema,
        action: marketingActionSchema
    })
    .strict()

const marketingNewsletterSchema = z
    .object({
        title: marketingLocalizedTextSchema,
        description: marketingLocalizedTextSchema.optional(),
        emailLabel: marketingLocalizedTextSchema,
        emailPlaceholder: marketingLocalizedTextSchema,
        submitLabel: marketingLocalizedTextSchema,
        successMessage: marketingLocalizedTextSchema,
        errorMessage: marketingLocalizedTextSchema,
        action: marketingActionSchema.optional()
    })
    .strict()

export const marketingSiteSettingsRecordSchema = marketingRecordBaseSchema
    .extend({
        kind: z.literal('siteSettings'),
        brandName: marketingLocalizedTextSchema,
        brandLogo: marketingMediaSchema.optional(),
        footerDescription: marketingLocalizedTextSchema.optional(),
        copyright: marketingLocalizedTextSchema.optional(),
        copyrightLabel: marketingLocalizedTextSchema.optional(),
        copyrightAction: marketingActionButtonSchema.optional(),
        newsletter: marketingNewsletterSchema.optional()
    })
    .strict()
export type MarketingSiteSettingsRecord = z.infer<typeof marketingSiteSettingsRecordSchema>

export const marketingNavigationLinkRecordSchema = marketingRecordBaseSchema
    .extend({
        kind: z.literal('navigationLink'),
        label: marketingLocalizedTextSchema,
        action: marketingActionSchema,
        iconKey: marketingSemanticKeySchema.optional()
    })
    .strict()
export type MarketingNavigationLinkRecord = z.infer<typeof marketingNavigationLinkRecordSchema>

export const marketingLogoRecordSchema = marketingRecordBaseSchema
    .extend({
        kind: z.literal('logo'),
        name: marketingLocalizedTextSchema,
        /** Partner/ecosystem entries may be text-only; media is optional. */
        media: marketingMediaSchema.optional(),
        darkMedia: marketingMediaSchema.optional()
    })
    .strict()
export type MarketingLogoRecord = z.infer<typeof marketingLogoRecordSchema>

export const marketingFeatureRecordSchema = marketingRecordBaseSchema
    .extend({
        kind: z.literal('feature'),
        title: marketingLocalizedTextSchema,
        /** Feature descriptions are optional content; empty ones are omitted. */
        description: marketingLocalizedTextSchema.optional(),
        iconKey: marketingSemanticKeySchema.optional(),
        lightMedia: marketingMediaSchema.optional(),
        darkMedia: marketingMediaSchema.optional()
    })
    .strict()
export type MarketingFeatureRecord = z.infer<typeof marketingFeatureRecordSchema>

export const marketingTestimonialRecordSchema = marketingRecordBaseSchema
    .extend({
        kind: z.literal('testimonial'),
        quote: marketingLocalizedTextSchema,
        author: marketingLocalizedTextSchema,
        company: marketingLocalizedTextSchema.optional(),
        avatar: marketingMediaSchema.optional(),
        logo: marketingMediaSchema.optional(),
        darkLogo: marketingMediaSchema.optional()
    })
    .strict()
export type MarketingTestimonialRecord = z.infer<typeof marketingTestimonialRecordSchema>

export const marketingHighlightRecordSchema = marketingRecordBaseSchema
    .extend({
        kind: z.literal('highlight'),
        title: marketingLocalizedTextSchema,
        description: marketingLocalizedTextSchema,
        iconKey: marketingSemanticKeySchema.optional(),
        media: marketingMediaSchema.optional()
    })
    .strict()
export type MarketingHighlightRecord = z.infer<typeof marketingHighlightRecordSchema>

export const marketingPricingBenefitRecordSchema = marketingRecordBaseSchema
    .extend({
        kind: z.literal('pricingBenefit'),
        label: marketingLocalizedTextSchema
    })
    .strict()
export type MarketingPricingBenefitRecord = z.infer<typeof marketingPricingBenefitRecordSchema>

export const marketingPricingTierRecordSchema = marketingRecordBaseSchema
    .extend({
        kind: z.literal('pricingTier'),
        title: marketingLocalizedTextSchema,
        description: marketingLocalizedTextSchema.optional(),
        price: marketingLocalizedTextSchema,
        period: marketingLocalizedTextSchema.optional(),
        action: marketingActionButtonSchema.optional(),
        benefitKeys: z.array(marketingSemanticKeySchema).max(64).default([]),
        benefits: z.array(marketingLocalizedTextSchema).max(64).default([]),
        featured: z.boolean().default(false)
    })
    .strict()
export type MarketingPricingTierRecord = z.infer<typeof marketingPricingTierRecordSchema>

export const marketingFaqRecordSchema = marketingRecordBaseSchema
    .extend({
        kind: z.literal('faq'),
        question: marketingLocalizedTextSchema,
        answer: marketingLocalizedTextSchema
    })
    .strict()
export type MarketingFaqRecord = z.infer<typeof marketingFaqRecordSchema>

export const marketingFooterLinkRecordSchema = marketingRecordBaseSchema
    .extend({
        kind: z.literal('footerLink'),
        groupKey: marketingSemanticKeySchema,
        groupTitle: marketingLocalizedTextSchema.optional(),
        label: marketingLocalizedTextSchema,
        secondaryLabel: marketingLocalizedTextSchema.optional(),
        action: marketingActionSchema,
        iconKey: marketingSemanticKeySchema.optional()
    })
    .strict()
export type MarketingFooterLinkRecord = z.infer<typeof marketingFooterLinkRecordSchema>

/**
 * Section copy is content owned by the standard Object entity, but it is
 * attached to the widget that consumes it. It never controls widget order or
 * visibility; those semantics belong to the persisted widget instance.
 */
export const marketingSectionCopyRecordSchema = marketingRecordBaseSchema
    .extend({
        kind: z.literal('sectionCopy'),
        sectionKey: marketingSemanticKeySchema,
        title: marketingLocalizedTextSchema,
        description: marketingLocalizedTextSchema.optional()
    })
    .strict()
export type MarketingSectionCopyRecord = z.infer<typeof marketingSectionCopyRecordSchema>

export const marketingPageRecordSchema = z
    .discriminatedUnion('kind', [
        marketingSiteSettingsRecordSchema,
        marketingNavigationLinkRecordSchema,
        marketingLogoRecordSchema,
        marketingFeatureRecordSchema,
        marketingTestimonialRecordSchema,
        marketingHighlightRecordSchema,
        marketingPricingBenefitRecordSchema,
        marketingPricingTierRecordSchema,
        marketingFaqRecordSchema,
        marketingFooterLinkRecordSchema,
        marketingSectionCopyRecordSchema
    ])
    .superRefine((value, context) => {
        if (value.kind === 'pricingTier' && new Set(value.benefitKeys).size !== value.benefitKeys.length) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['benefitKeys'],
                message: 'Pricing benefit keys must be unique within a tier.'
            })
        }
    })
export type MarketingPageRecord = z.infer<typeof marketingPageRecordSchema>

const publicMarketingRecordBaseSchema = z.object({
    semanticKey: marketingSemanticKeySchema,
    order: z.number().int().min(0).max(10000),
    isVisible: z.boolean().default(true)
})

export const publicMarketingSiteSettingsRecordSchema = publicMarketingRecordBaseSchema
    .extend({
        kind: z.literal('siteSettings'),
        brandName: marketingLocalizedTextSchema,
        brandLogo: publicMarketingMediaSchema.optional(),
        footerDescription: marketingLocalizedTextSchema.optional(),
        copyright: marketingLocalizedTextSchema.optional(),
        copyrightLabel: marketingLocalizedTextSchema.optional(),
        copyrightAction: marketingActionButtonSchema.optional(),
        newsletter: marketingNewsletterSchema.optional()
    })
    .strict()
export type PublicMarketingSiteSettingsRecord = z.infer<typeof publicMarketingSiteSettingsRecordSchema>

export const publicMarketingNavigationLinkRecordSchema = publicMarketingRecordBaseSchema
    .extend({
        kind: z.literal('navigationLink'),
        label: marketingLocalizedTextSchema,
        action: marketingActionSchema,
        iconKey: marketingSemanticKeySchema.optional()
    })
    .strict()
export type PublicMarketingNavigationLinkRecord = z.infer<typeof publicMarketingNavigationLinkRecordSchema>

export const publicMarketingLogoRecordSchema = publicMarketingRecordBaseSchema
    .extend({
        kind: z.literal('logo'),
        name: marketingLocalizedTextSchema,
        /** Partner/ecosystem entries may be text-only; media is optional. */
        media: publicMarketingMediaSchema.optional(),
        darkMedia: publicMarketingMediaSchema.optional()
    })
    .strict()
export type PublicMarketingLogoRecord = z.infer<typeof publicMarketingLogoRecordSchema>

export const publicMarketingFeatureRecordSchema = publicMarketingRecordBaseSchema
    .extend({
        kind: z.literal('feature'),
        title: marketingLocalizedTextSchema,
        /** Feature descriptions are optional content; empty ones are omitted. */
        description: marketingLocalizedTextSchema.optional(),
        iconKey: marketingSemanticKeySchema.optional(),
        lightMedia: publicMarketingMediaSchema.optional(),
        darkMedia: publicMarketingMediaSchema.optional()
    })
    .strict()
export type PublicMarketingFeatureRecord = z.infer<typeof publicMarketingFeatureRecordSchema>

export const publicMarketingTestimonialRecordSchema = publicMarketingRecordBaseSchema
    .extend({
        kind: z.literal('testimonial'),
        quote: marketingLocalizedTextSchema,
        author: marketingLocalizedTextSchema,
        company: marketingLocalizedTextSchema.optional(),
        avatar: publicMarketingMediaSchema.optional(),
        logo: publicMarketingMediaSchema.optional(),
        darkLogo: publicMarketingMediaSchema.optional()
    })
    .strict()
export type PublicMarketingTestimonialRecord = z.infer<typeof publicMarketingTestimonialRecordSchema>

export const publicMarketingHighlightRecordSchema = publicMarketingRecordBaseSchema
    .extend({
        kind: z.literal('highlight'),
        title: marketingLocalizedTextSchema,
        description: marketingLocalizedTextSchema,
        iconKey: marketingSemanticKeySchema.optional(),
        media: publicMarketingMediaSchema.optional()
    })
    .strict()
export type PublicMarketingHighlightRecord = z.infer<typeof publicMarketingHighlightRecordSchema>

export const publicMarketingPricingBenefitRecordSchema = publicMarketingRecordBaseSchema
    .extend({
        kind: z.literal('pricingBenefit'),
        label: marketingLocalizedTextSchema
    })
    .strict()
export type PublicMarketingPricingBenefitRecord = z.infer<typeof publicMarketingPricingBenefitRecordSchema>

export const publicMarketingPricingTierRecordSchema = publicMarketingRecordBaseSchema
    .extend({
        kind: z.literal('pricingTier'),
        title: marketingLocalizedTextSchema,
        description: marketingLocalizedTextSchema.optional(),
        price: marketingLocalizedTextSchema,
        period: marketingLocalizedTextSchema.optional(),
        action: marketingActionButtonSchema.optional(),
        benefitKeys: z.array(marketingSemanticKeySchema).max(64).default([]),
        benefits: z.array(marketingLocalizedTextSchema).max(64).default([]),
        featured: z.boolean().default(false)
    })
    .strict()
export type PublicMarketingPricingTierRecord = z.infer<typeof publicMarketingPricingTierRecordSchema>

export const publicMarketingFaqRecordSchema = publicMarketingRecordBaseSchema
    .extend({
        kind: z.literal('faq'),
        question: marketingLocalizedTextSchema,
        answer: marketingLocalizedTextSchema
    })
    .strict()
export type PublicMarketingFaqRecord = z.infer<typeof publicMarketingFaqRecordSchema>

export const publicMarketingFooterLinkRecordSchema = publicMarketingRecordBaseSchema
    .extend({
        kind: z.literal('footerLink'),
        groupKey: marketingSemanticKeySchema,
        groupTitle: marketingLocalizedTextSchema.optional(),
        label: marketingLocalizedTextSchema,
        secondaryLabel: marketingLocalizedTextSchema.optional(),
        action: marketingActionSchema,
        iconKey: marketingSemanticKeySchema.optional()
    })
    .strict()
export type PublicMarketingFooterLinkRecord = z.infer<typeof publicMarketingFooterLinkRecordSchema>

export const publicMarketingSectionCopyRecordSchema = publicMarketingRecordBaseSchema
    .extend({
        kind: z.literal('sectionCopy'),
        sectionKey: marketingSemanticKeySchema,
        title: marketingLocalizedTextSchema,
        description: marketingLocalizedTextSchema.optional()
    })
    .strict()
export type PublicMarketingSectionCopyRecord = z.infer<typeof publicMarketingSectionCopyRecordSchema>

/** Image widget content comes from its bound MarketingPageImage Entity record. */
export const publicMarketingImageRecordSchema = publicMarketingRecordBaseSchema
    .extend({
        kind: z.literal('image'),
        media: publicMarketingMediaSchema
    })
    .strict()
export type PublicMarketingImageRecord = z.infer<typeof publicMarketingImageRecordSchema>

export const publicMarketingPageRecordSchema = z
    .discriminatedUnion('kind', [
        publicMarketingSiteSettingsRecordSchema,
        publicMarketingNavigationLinkRecordSchema,
        publicMarketingLogoRecordSchema,
        publicMarketingFeatureRecordSchema,
        publicMarketingTestimonialRecordSchema,
        publicMarketingHighlightRecordSchema,
        publicMarketingPricingBenefitRecordSchema,
        publicMarketingPricingTierRecordSchema,
        publicMarketingFaqRecordSchema,
        publicMarketingFooterLinkRecordSchema,
        publicMarketingSectionCopyRecordSchema,
        publicMarketingImageRecordSchema
    ])
    .superRefine((value, context) => {
        if (value.kind === 'pricingTier' && new Set(value.benefitKeys).size !== value.benefitKeys.length) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['benefitKeys'],
                message: 'Pricing benefit keys must be unique within a tier.'
            })
        }
    })
export type PublicMarketingPageRecord = z.infer<typeof publicMarketingPageRecordSchema>
