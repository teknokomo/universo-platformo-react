import { z } from 'zod'

import type { VersionedLocalizedContent } from './admin'
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
        marketingFooterLinkRecordSchema
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

export const MARKETING_SECTION_KEYS = ['hero', 'logos', 'features', 'testimonials', 'highlights', 'pricing', 'faq', 'footer'] as const
export type MarketingSectionKey = (typeof MARKETING_SECTION_KEYS)[number]
export const marketingSectionKeySchema = z.enum(MARKETING_SECTION_KEYS)

export const marketingSectionCopySchema = z
    .object({
        title: marketingLocalizedTextSchema,
        description: marketingLocalizedTextSchema.optional()
    })
    .strict()
export type MarketingSectionCopy = z.infer<typeof marketingSectionCopySchema>

const marketingSectionVisibilitySchema = z
    .record(z.string(), z.boolean())
    .default({})
    .superRefine((value, context) => {
        for (const key of Object.keys(value)) {
            if (!marketingSectionKeySchema.safeParse(key).success) {
                context.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'Unknown marketing section key.' })
            }
        }
    })

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
        sectionOrder: z
            .array(marketingSectionKeySchema)
            .max(MARKETING_SECTION_KEYS.length)
            .default([...MARKETING_SECTION_KEYS]),
        sectionVisibility: marketingSectionVisibilitySchema,
        primaryColor: marketingThemeColorSchema.optional(),
        accentColor: marketingThemeColorSchema.optional(),
        brandLogo: marketingMediaSchema.optional(),
        allowEmailActions: z.boolean().default(true),
        allowTelephoneActions: z.boolean().default(true),
        externalLinkTarget: marketingLinkTargetSchema.default('new-tab')
    })
    .strict()
    .superRefine((value, context) => {
        if (new Set(value.sectionOrder).size !== value.sectionOrder.length) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['sectionOrder'],
                message: 'Marketing section order must not contain duplicates.'
            })
        }
    })
export type MarketingPageConfig = z.infer<typeof marketingPageConfigSchema>

export const marketingPageDataSchema = z
    .object({
        templateKey: z.literal(MARKETING_PAGE_TEMPLATE_KEY),
        locale: marketingLocaleCodeSchema,
        config: marketingPageConfigSchema,
        records: z.array(marketingPageRecordSchema).max(MARKETING_MAX_RUNTIME_RECORDS),
        sectionCopies: z.record(marketingSectionKeySchema, marketingSectionCopySchema).default({}),
        provenance: marketingProvenanceSchema.optional(),
        richContent: pageBlockContentSchema.optional()
    })
    .strict()
    .superRefine((value, context) => {
        // Semantic identities are scoped to a record kind. A marketing page
        // may legitimately have a `support` highlight and a `support` FAQ;
        // each collection still needs unique keys for deterministic rendering
        // and relation lookups.
        const semanticKeys = new Set<string>()
        const ids = new Set<string>()

        value.records.forEach((record, index) => {
            const scopedSemanticKey = `${record.kind}:${record.semanticKey}`
            if (semanticKeys.has(scopedSemanticKey)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['records', index, 'semanticKey'],
                    message: 'Marketing semantic keys must be unique within each record kind.'
                })
            }
            semanticKeys.add(scopedSemanticKey)

            if (ids.has(record.id)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['records', index, 'id'],
                    message: 'Marketing record identifiers must be unique in a runtime payload.'
                })
            }
            ids.add(record.id)
        })
    })
export type MarketingPageData = z.infer<typeof marketingPageDataSchema>

export const marketingPageRuntimeViewModelSchema = z
    .object({
        templateKey: z.literal(MARKETING_PAGE_TEMPLATE_KEY),
        marketingPage: marketingPageDataSchema
    })
    .strict()
export type MarketingPageRuntimeViewModel = z.infer<typeof marketingPageRuntimeViewModelSchema>

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

export interface ApplicationTemplateRegistryEntry {
    readonly key: ApplicationTemplateKey
    readonly displayNameKey: string
    readonly descriptionKey: string
    readonly supportsDashboardWidgets: boolean
    readonly seedPolicyKey: string
}

/**
 * Neutral metadata only. Concrete dashboard payload validation remains owned by
 * the runtime package and is injected through createRuntimeViewModelSchema.
 */
export const APPLICATION_TEMPLATE_REGISTRY: Readonly<Record<ApplicationTemplateKey, ApplicationTemplateRegistryEntry>> = {
    dashboard: {
        key: 'dashboard',
        displayNameKey: 'templates.dashboard.name',
        descriptionKey: 'templates.dashboard.description',
        supportsDashboardWidgets: true,
        seedPolicyKey: 'dashboard'
    },
    'marketing-page': {
        key: MARKETING_PAGE_TEMPLATE_KEY,
        displayNameKey: 'templates.marketingPage.name',
        descriptionKey: 'templates.marketingPage.description',
        supportsDashboardWidgets: false,
        seedPolicyKey: MARKETING_PAGE_SEED_POLICY
    }
}

export type MarketingCanonicalLocalizedText = VersionedLocalizedContent<string>
