import { z } from 'zod'

import type { VersionedLocalizedContent } from './admin'
export { APPLICATION_TEMPLATE_REGISTRY } from './applicationTemplates'
export type { ApplicationTemplateRegistryEntry } from './applicationTemplates'
import { pageBlockContentSchema } from './pageBlocks'
import { resourceSourceSchema, safeExternalUrlSchema } from './resourceSources'

/**
 * Application layout/rendering keys. These are intentionally separate from
 * metahub template codenames: a metahub may seed more than one application
 * layout and a runtime layout must never be inferred from a metahub codename.
 */
export const APPLICATION_TEMPLATE_KEYS = ['dashboard', 'marketing-page'] as const
export type ApplicationTemplateKey = (typeof APPLICATION_TEMPLATE_KEYS)[number]
export const applicationTemplateKeySchema = z.enum(APPLICATION_TEMPLATE_KEYS)

/** Built-in metahub template codenames owned by the template registry. */
export const METAHUB_TEMPLATE_CODENAMES = [
    'basic',
    'basic-demo',
    'empty',
    'lms',
    '1c-compatible',
    'playcanvas',
    'interpretation-network',
    'marketing-page'
] as const
export type MetahubTemplateCodename = (typeof METAHUB_TEMPLATE_CODENAMES)[number]
export const metahubTemplateCodenameSchema = z.enum(METAHUB_TEMPLATE_CODENAMES)

export const MARKETING_PAGE_TEMPLATE_KEY = 'marketing-page' as const
export const MARKETING_PAGE_SEED_POLICY = 'initial-only' as const

/** Persisted placements owned by the marketing template adapter. */
export const MARKETING_LAYOUT_ZONES = ['marketing-header', 'marketing-main', 'marketing-footer'] as const
export type MarketingLayoutZone = (typeof MARKETING_LAYOUT_ZONES)[number]
export const marketingLayoutZoneSchema = z.enum(MARKETING_LAYOUT_ZONES)

/** Template-aware widget keys. Dashboard keys are deliberately not included. */
export const MARKETING_WIDGET_KEYS = [
    'marketing.navigation',
    'marketing.hero',
    'marketing.collection',
    'marketing.pricing',
    'marketing.footer'
] as const
export type MarketingWidgetKey = (typeof MARKETING_WIDGET_KEYS)[number]
export const marketingWidgetKeySchema = z.enum(MARKETING_WIDGET_KEYS)

export const MARKETING_COLLECTION_VARIANTS = ['logos', 'features', 'testimonials', 'highlights', 'faq'] as const
export type MarketingCollectionVariant = (typeof MARKETING_COLLECTION_VARIANTS)[number]
export const marketingCollectionVariantSchema = z.enum(MARKETING_COLLECTION_VARIANTS)

export interface MarketingWidgetRegistryEntry {
    readonly key: MarketingWidgetKey
    /** Every registered marketing widget can be placed as a separate instance. */
    readonly repeatable: boolean
    readonly allowedZones: readonly MarketingLayoutZone[]
}

export const MARKETING_WIDGET_REGISTRY: Readonly<Record<MarketingWidgetKey, MarketingWidgetRegistryEntry>> = {
    'marketing.navigation': {
        key: 'marketing.navigation',
        repeatable: true,
        allowedZones: ['marketing-header']
    },
    'marketing.hero': {
        key: 'marketing.hero',
        repeatable: true,
        allowedZones: ['marketing-main']
    },
    'marketing.collection': {
        key: 'marketing.collection',
        repeatable: true,
        allowedZones: ['marketing-main']
    },
    'marketing.pricing': {
        key: 'marketing.pricing',
        repeatable: true,
        allowedZones: ['marketing-main']
    },
    'marketing.footer': {
        key: 'marketing.footer',
        repeatable: true,
        allowedZones: ['marketing-footer']
    }
}

/**
 * Entity codenames supported by the built-in marketing adapter. The adapter is
 * intentionally bounded: selecting an entity type never grants access to an
 * arbitrary runtime table or an arbitrary record shape.
 */
export const MARKETING_SOURCE_CODENAMES = [
    'MarketingPageSection',
    'MarketingPageSiteSettings',
    'MarketingPageLogo',
    'MarketingPageFeature',
    'MarketingPageTestimonial',
    'MarketingPageHighlight',
    'MarketingPagePricing',
    'MarketingPagePricingBenefit',
    'MarketingPageFaq',
    'MarketingPageNavigation',
    'MarketingPageFooterLink'
] as const
export type MarketingSourceCodename = (typeof MARKETING_SOURCE_CODENAMES)[number]
export const marketingSourceCodenameSchema = z.enum(MARKETING_SOURCE_CODENAMES)
export const MARKETING_COPY_SOURCE_CODENAME = 'MarketingPageSection' as const

export const MARKETING_WIDGET_SOURCE_CODENAMES: Readonly<Record<MarketingWidgetKey, readonly MarketingSourceCodename[]>> = {
    'marketing.navigation': ['MarketingPageNavigation'],
    'marketing.hero': ['MarketingPageSiteSettings'],
    'marketing.collection': [
        'MarketingPageLogo',
        'MarketingPageFeature',
        'MarketingPageTestimonial',
        'MarketingPageHighlight',
        'MarketingPageFaq'
    ],
    'marketing.pricing': ['MarketingPagePricing'],
    'marketing.footer': ['MarketingPageFooterLink']
}

export const marketingWidgetSourceCodenames = (
    widgetKey: MarketingWidgetKey,
    variant?: MarketingCollectionVariant
): readonly MarketingSourceCodename[] => {
    if (widgetKey !== 'marketing.collection' || variant === undefined) return MARKETING_WIDGET_SOURCE_CODENAMES[widgetKey]
    const variantSources: Record<MarketingCollectionVariant, readonly MarketingSourceCodename[]> = {
        logos: ['MarketingPageLogo'],
        features: ['MarketingPageFeature'],
        testimonials: ['MarketingPageTestimonial'],
        highlights: ['MarketingPageHighlight'],
        faq: ['MarketingPageFaq']
    }
    return variantSources[variant]
}

/**
 * Logical fields supported by the built-in adapter. A field map can only
 * redirect one known presentation field to another known field; it can never
 * introduce a physical table or column identifier into runtime configuration.
 */
export const MARKETING_SOURCE_FIELD_KEYS: Readonly<Record<MarketingSourceCodename, readonly string[]>> = {
    MarketingPageSection: ['sectionKey', 'title', 'description'],
    MarketingPageSiteSettings: [
        'brandName',
        'brandLogo',
        'heroTitle',
        'heroSubtitle',
        'heroAccent',
        'heroEmailLabel',
        'heroEmailPlaceholder',
        'heroTermsText',
        'heroPrimaryAction',
        'heroSecondaryAction',
        'heroLightPreview',
        'heroDarkPreview',
        'footerDescription',
        'copyright',
        'copyrightLabel',
        'copyrightAction',
        'newsletter'
    ],
    MarketingPageLogo: ['name', 'media', 'darkMedia', 'order', 'isVisible'],
    MarketingPageFeature: ['title', 'description', 'iconKey', 'lightMedia', 'darkMedia', 'order', 'isVisible'],
    MarketingPageTestimonial: ['quote', 'author', 'company', 'avatar', 'logo', 'darkLogo', 'order', 'isVisible'],
    MarketingPageHighlight: ['title', 'description', 'iconKey', 'media', 'order', 'isVisible'],
    MarketingPagePricing: [
        'title',
        'description',
        'price',
        'period',
        'action',
        'benefitKeys',
        'benefits',
        'featured',
        'order',
        'isVisible'
    ],
    MarketingPagePricingBenefit: ['label', 'order', 'isVisible'],
    MarketingPageFaq: ['question', 'answer', 'order', 'isVisible'],
    MarketingPageNavigation: ['label', 'action', 'order', 'isVisible'],
    MarketingPageFooterLink: ['groupKey', 'groupTitle', 'label', 'secondaryLabel', 'action', 'iconKey', 'order', 'isVisible']
}
/**
 * Runtime rows are bounded per known marketing collection (1000 rows each)
 * and the singleton site-settings record. Keep the aggregate schema bound in
 * the shared contract so a controller cannot accidentally return an unlimited
 * payload when a collection grows.
 */
export const MARKETING_MAX_RUNTIME_RECORDS = 12_001

/** Stable semantic identities used by contracts and fixtures, never as UI labels. */
export const MARKETING_SEMANTIC_KEY_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/
export const marketingSemanticKeySchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(MARKETING_SEMANTIC_KEY_PATTERN, 'Semantic keys must use lowercase stable identifiers.')
export type MarketingSemanticKey = z.infer<typeof marketingSemanticKeySchema>

/** Dynamic BCP-47-like locale keys are normalized by the shared utility layer. */
export const MARKETING_LOCALE_PATTERN = /^[a-z]{2,8}(?:[-_][a-z0-9]{2,8})*$/i
export const marketingLocaleCodeSchema = z.string().trim().min(2).max(32).regex(MARKETING_LOCALE_PATTERN)
export type MarketingLocaleCode = z.infer<typeof marketingLocaleCodeSchema>

const UNSAFE_MARKETING_TEXT_CONTROL_CHAR_RE = new RegExp(String.raw`[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]`)
const MARKETING_HTML_TAG_RE = /<\/?[a-z][\s\S]*>/i
const UNSAFE_MARKETING_SUBJECT_CONTROL_CHAR_RE = new RegExp(String.raw`[\u0000-\u001F\u007F]`)

/** Plain localized text. Rich content must use the existing Page block schema. */
const createMarketingLocalizedTextValueSchema = (maxLength: number) =>
    z
        .string()
        .trim()
        .min(1)
        .max(maxLength)
        .refine((value) => !UNSAFE_MARKETING_TEXT_CONTROL_CHAR_RE.test(value), 'Localized text contains unsupported control characters.')
        .refine((value) => !MARKETING_HTML_TAG_RE.test(value), 'Localized text must not contain HTML markup.')

export const marketingLocalizedTextValueSchema = createMarketingLocalizedTextValueSchema(10000)
export const marketingLocalizedLabelSchema = createMarketingLocalizedTextValueSchema(240)

export const marketingLocalizedTextSchema = z
    .record(marketingLocaleCodeSchema, marketingLocalizedTextValueSchema)
    .superRefine((value, context) => {
        if (Object.keys(value).length === 0) {
            context.addIssue({ code: z.ZodIssueCode.custom, message: 'Localized text must contain at least one locale.' })
        }
    })
export type MarketingLocalizedText = z.infer<typeof marketingLocalizedTextSchema>

/** Persisted marketing rows use time-ordered UUIDs. Derived display keys are not row IDs. */
export const marketingPersistedIdSchema = z
    .string()
    .uuid()
    .refine((value) => value[14]?.toLowerCase() === '7', 'Persisted marketing identifiers must be UUID v7.')
export type MarketingPersistedId = z.infer<typeof marketingPersistedIdSchema>

/** Instance identity is semantic for seed rows and UUID v7 for authored rows. */
export const marketingWidgetInstanceKeySchema = z.union([marketingSemanticKeySchema, marketingPersistedIdSchema])
export type MarketingWidgetInstanceKey = z.infer<typeof marketingWidgetInstanceKeySchema>

/** Server-resolved entity metadata reference; physical tables and SQL never cross this boundary. */
export const marketingWidgetSourceSchema = z
    .object({
        entityCodename: marketingSourceCodenameSchema,
        entityKind: z.enum(['hub', 'object', 'page', 'set', 'enumeration']).default('object'),
        recordKey: marketingSemanticKeySchema.optional(),
        fieldMap: z
            .record(
                z
                    .string()
                    .trim()
                    .min(1)
                    .max(128)
                    .regex(/^[A-Za-z][A-Za-z0-9._-]*$/, 'Field aliases must use stable identifiers.'),
                z
                    .string()
                    .trim()
                    .min(1)
                    .max(128)
                    .regex(/^[A-Za-z][A-Za-z0-9._-]*$/, 'Field references must use stable identifiers.')
            )
            .superRefine((value, context) => {
                if (Object.keys(value).length > 64) {
                    context.addIssue({
                        code: z.ZodIssueCode.too_big,
                        type: 'object',
                        maximum: 64,
                        inclusive: true,
                        message: 'Field maps may contain at most 64 entries.'
                    })
                }
            })
            .default({})
    })
    .strict()
export type MarketingWidgetSource = z.infer<typeof marketingWidgetSourceSchema>

export const MARKETING_DATA_LAYERS = ['metahub', 'publication', 'application', 'workspace'] as const
export type MarketingDataLayer = (typeof MARKETING_DATA_LAYERS)[number]
export const marketingDataLayerSchema = z.enum(MARKETING_DATA_LAYERS)

export const MARKETING_SCOPES = ['application', 'workspace'] as const
export type MarketingScope = (typeof MARKETING_SCOPES)[number]
export const marketingScopeSchema = z.enum(MARKETING_SCOPES)

/** Provenance needed to protect authored values during republish and reset-to-source. */
export const marketingProvenanceSchema = z
    .object({
        layer: marketingDataLayerSchema,
        sourceId: marketingPersistedIdSchema.nullable().optional(),
        seedKey: marketingSemanticKeySchema.optional(),
        isSeeded: z.boolean().default(false),
        isAuthored: z.boolean().default(false)
    })
    .strict()
    .superRefine((value, context) => {
        if (value.isSeeded && !value.seedKey) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['seedKey'],
                message: 'Seeded marketing records must retain their seed key.'
            })
        }

        if (value.isSeeded && value.isAuthored) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['isAuthored'],
                message: 'A marketing record cannot be both seeded and authored.'
            })
        }
    })
export type MarketingProvenance = z.infer<typeof marketingProvenanceSchema>

export const MARKETING_ACTION_KINDS = ['internal', 'external', 'anchor', 'email', 'tel'] as const
export type MarketingActionKind = (typeof MARKETING_ACTION_KINDS)[number]
export const marketingActionKindSchema = z.enum(MARKETING_ACTION_KINDS)

export const MARKETING_LINK_TARGETS = ['same-tab', 'new-tab'] as const
export type MarketingLinkTarget = (typeof MARKETING_LINK_TARGETS)[number]
export const marketingLinkTargetSchema = z.enum(MARKETING_LINK_TARGETS)

const safeInternalPathSchema = z
    .string()
    .trim()
    .min(1)
    .max(2048)
    .refine((value) => value.startsWith('/') && !value.startsWith('//'), 'Internal actions must use an application-relative path.')
    .refine((value) => !value.includes('\\'), 'Internal actions must not contain backslashes.')
    .refine((value) => value !== '#', 'Placeholder links are not valid actions.')
    .refine((value) => !UNSAFE_MARKETING_TEXT_CONTROL_CHAR_RE.test(value), 'Action paths contain unsupported control characters.')

const safeAnchorSchema = z
    .string()
    .trim()
    .regex(/^#[A-Za-z][A-Za-z0-9_-]{0,127}$/, 'Anchor actions must point to a named section.')

const safeTelephoneNumberSchema = z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9 ()-]{2,31}$/, 'Telephone actions must contain a safe phone number.')

const marketingEmailAddressSchema = z.string().trim().max(320).email()

export const marketingActionSchema = z.discriminatedUnion('kind', [
    z
        .object({
            kind: z.literal('internal'),
            path: safeInternalPathSchema,
            target: z.literal('same-tab').default('same-tab')
        })
        .strict(),
    z
        .object({
            kind: z.literal('external'),
            url: safeExternalUrlSchema,
            target: marketingLinkTargetSchema.default('new-tab')
        })
        .strict(),
    z
        .object({
            kind: z.literal('anchor'),
            href: safeAnchorSchema
        })
        .strict(),
    z
        .object({
            kind: z.literal('email'),
            address: marketingEmailAddressSchema,
            subject: z
                .string()
                .trim()
                .max(240)
                .refine(
                    (value) => !UNSAFE_MARKETING_SUBJECT_CONTROL_CHAR_RE.test(value),
                    'Email subjects must not contain control characters.'
                )
                .optional()
        })
        .strict(),
    z
        .object({
            kind: z.literal('tel'),
            number: safeTelephoneNumberSchema
        })
        .strict()
])
export type MarketingAction = z.infer<typeof marketingActionSchema>

export const MARKETING_MEDIA_KINDS = ['logo', 'hero', 'avatar', 'feature', 'highlight'] as const
export type MarketingMediaKind = (typeof MARKETING_MEDIA_KINDS)[number]

const marketingMediaResourceSchema = resourceSourceSchema.superRefine((value, context) => {
    if (!['url', 'file', 'video', 'audio', 'document'].includes(value.type)) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['type'],
            message: 'Marketing media must use a URL or a supported stored resource.'
        })
    }
})

export const marketingMediaSchema = z
    .object({
        kind: z.enum(MARKETING_MEDIA_KINDS),
        resource: marketingMediaResourceSchema,
        alt: marketingLocalizedTextSchema.optional(),
        decorative: z.boolean().default(false),
        width: z.number().int().positive().max(10000).optional(),
        height: z.number().int().positive().max(10000).optional()
    })
    .strict()
    .superRefine((value, context) => {
        if (!value.decorative && !value.alt) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['alt'],
                message: 'Non-decorative marketing media must include localized alt text.'
            })
        }

        if (value.decorative && value.alt) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['alt'],
                message: 'Decorative marketing media must not expose alternative text.'
            })
        }
    })
export type MarketingMedia = z.infer<typeof marketingMediaSchema>

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
        emailLabel: marketingLocalizedLabelSchema,
        emailPlaceholder: marketingLocalizedLabelSchema,
        submitLabel: marketingLocalizedLabelSchema,
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
        heroTitle: marketingLocalizedTextSchema,
        heroSubtitle: marketingLocalizedTextSchema,
        heroAccent: marketingLocalizedTextSchema.optional(),
        heroEmailLabel: marketingLocalizedLabelSchema.optional(),
        heroEmailPlaceholder: marketingLocalizedLabelSchema.optional(),
        heroTermsText: marketingLocalizedTextSchema.optional(),
        heroPrimaryAction: marketingActionButtonSchema.optional(),
        heroSecondaryAction: marketingActionButtonSchema.optional(),
        heroLightPreview: marketingMediaSchema.optional(),
        heroDarkPreview: marketingMediaSchema.optional(),
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
        media: marketingMediaSchema,
        darkMedia: marketingMediaSchema.optional()
    })
    .strict()
export type MarketingLogoRecord = z.infer<typeof marketingLogoRecordSchema>

export const marketingFeatureRecordSchema = marketingRecordBaseSchema
    .extend({
        kind: z.literal('feature'),
        title: marketingLocalizedTextSchema,
        description: marketingLocalizedTextSchema,
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
        brandLogo: marketingMediaSchema.optional(),
        allowEmailActions: z.boolean().default(true),
        allowTelephoneActions: z.boolean().default(true),
        externalLinkTarget: marketingLinkTargetSchema.default('new-tab')
    })
    .strict()
export type MarketingPageConfig = z.infer<typeof marketingPageConfigSchema>

const marketingWidgetConfigBaseSchema = z.object({
    instanceKey: marketingWidgetInstanceKeySchema,
    source: marketingWidgetSourceSchema,
    copySource: marketingWidgetSourceSchema.optional()
})

const refineMarketingWidgetSources = (
    value: {
        source: MarketingWidgetSource
        copySource?: MarketingWidgetSource
    },
    context: z.RefinementCtx,
    widgetKey: MarketingWidgetKey,
    variant?: MarketingCollectionVariant
): void => {
    if (value.source.entityKind !== 'object') {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['source', 'entityKind'],
            message: 'Marketing widget sources must reference Object entities.'
        })
    }
    if (!marketingWidgetSourceCodenames(widgetKey, variant).includes(value.source.entityCodename)) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['source', 'entityCodename'],
            message: 'Marketing widget source does not match the widget variant.'
        })
    }
    const allowedFieldKeys = MARKETING_SOURCE_FIELD_KEYS[value.source.entityCodename]
    for (const [alias, field] of Object.entries(value.source.fieldMap)) {
        if (!allowedFieldKeys.includes(alias) || !allowedFieldKeys.includes(field)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['source', 'fieldMap', alias],
                message: 'Marketing field mappings must use fields supported by the selected built-in source.'
            })
        }
    }
    if (value.copySource !== undefined) {
        if (
            value.copySource.entityKind !== 'object' ||
            value.copySource.entityCodename !== MARKETING_COPY_SOURCE_CODENAME ||
            value.copySource.recordKey === undefined
        ) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['copySource'],
                message: 'Marketing widget copy sources must reference a keyed MarketingPageSection Object.'
            })
        }
        const copyFieldKeys = MARKETING_SOURCE_FIELD_KEYS[MARKETING_COPY_SOURCE_CODENAME]
        for (const [alias, field] of Object.entries(value.copySource.fieldMap)) {
            if (!copyFieldKeys.includes(alias) || !copyFieldKeys.includes(field)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['copySource', 'fieldMap', alias],
                    message: 'Marketing copy mappings must use supported section fields.'
                })
            }
        }
    }
}

export const marketingNavigationWidgetConfigSchema = marketingWidgetConfigBaseSchema
    .extend({
        maxItems: z.number().int().min(1).max(100).default(24),
        showAuthActions: z.boolean().default(true)
    })
    .strict()
    .superRefine((value, context) => refineMarketingWidgetSources(value, context, 'marketing.navigation'))

export const marketingHeroWidgetConfigSchema = marketingWidgetConfigBaseSchema
    .extend({
        showLeadForm: z.boolean().default(true)
    })
    .strict()
    .superRefine((value, context) => refineMarketingWidgetSources(value, context, 'marketing.hero'))

export const marketingCollectionWidgetConfigSchema = marketingWidgetConfigBaseSchema
    .extend({
        variant: marketingCollectionVariantSchema,
        maxItems: z.number().int().min(1).max(1000).default(100),
        showTitle: z.boolean().default(true),
        showDescription: z.boolean().default(true)
    })
    .strict()
    .superRefine((value, context) => refineMarketingWidgetSources(value, context, 'marketing.collection', value.variant))

export const marketingPricingWidgetConfigSchema = marketingWidgetConfigBaseSchema
    .extend({
        maxItems: z.number().int().min(1).max(100).default(24),
        showBenefits: z.boolean().default(true)
    })
    .strict()
    .superRefine((value, context) => refineMarketingWidgetSources(value, context, 'marketing.pricing'))

export const marketingFooterWidgetConfigSchema = marketingWidgetConfigBaseSchema
    .extend({
        maxItems: z.number().int().min(1).max(100).default(100),
        showNewsletter: z.boolean().default(true)
    })
    .strict()
    .superRefine((value, context) => refineMarketingWidgetSources(value, context, 'marketing.footer'))

export const marketingWidgetDataSchema = z
    .object({ records: z.array(marketingPageRecordSchema).max(MARKETING_MAX_RUNTIME_RECORDS) })
    .strict()

export const marketingRuntimeIdentitySchema = z
    .object({
        layoutId: marketingPersistedIdSchema,
        layoutVersion: z.number().int().positive(),
        layoutHash: z
            .string()
            .trim()
            .regex(/^[a-f0-9]{64}$/i),
        sourceLayoutId: marketingPersistedIdSchema.nullable().optional(),
        sourceContentHash: z
            .string()
            .trim()
            .regex(/^[a-f0-9]{64}$/i)
            .nullable()
            .optional()
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
        if (value.data.records.some((record) => !['siteSettings', 'navigationLink'].includes(record.kind))) {
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
        config: marketingHeroWidgetConfigSchema
    })
    .superRefine((value, context) => {
        if (value.zone !== 'marketing-main') {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['zone'], message: 'Hero widgets must use the main zone.' })
        }
        if (value.data.records.some((record) => !['siteSettings', 'sectionCopy'].includes(record.kind))) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['data'], message: 'Hero data must contain site settings only.' })
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
        const allowedKinds: Record<MarketingCollectionVariant, readonly MarketingPageRecord['kind'][]> = {
            logos: ['logo'],
            features: ['feature'],
            testimonials: ['testimonial'],
            highlights: ['highlight'],
            faq: ['faq']
        }
        const kinds = allowedKinds[value.config.variant]
        if (value.data.records.some((record) => record.kind !== 'sectionCopy' && !kinds.includes(record.kind))) {
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
    | z.infer<typeof marketingCollectionWidgetSchema>
    | z.infer<typeof marketingPricingWidgetSchema>
    | z.infer<typeof marketingFooterWidgetSchema>

export const marketingRuntimeWidgetSchema: z.ZodType<MarketingRuntimeWidget> = z.union([
    marketingNavigationWidgetSchema,
    marketingHeroWidgetSchema,
    marketingCollectionWidgetSchema,
    marketingPricingWidgetSchema,
    marketingFooterWidgetSchema
])

export type MarketingPageData = {
    templateKey: typeof MARKETING_PAGE_TEMPLATE_KEY
    locale: MarketingLocaleCode
    config: MarketingPageConfig
    widgets: MarketingRuntimeWidget[]
    runtime: MarketingRuntimeIdentity
    provenance?: MarketingProvenance
    richContent?: z.infer<typeof pageBlockContentSchema>
}

export const marketingPageDataSchema: z.ZodType<MarketingPageData> = z
    .object({
        templateKey: z.literal(MARKETING_PAGE_TEMPLATE_KEY),
        locale: marketingLocaleCodeSchema,
        config: marketingPageConfigSchema,
        widgets: z.array(marketingRuntimeWidgetSchema).min(1).max(64),
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

        const activeKeys = new Set(value.widgets.filter((widget) => widget.isActive).map((widget) => widget.widgetKey))
        if (activeKeys.size === 0) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['widgets'], message: 'Marketing layout must contain an active widget.' })
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

export type MarketingCanonicalLocalizedText = VersionedLocalizedContent<string>
