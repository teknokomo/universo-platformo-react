import { z } from 'zod'

import type { VersionedLocalizedContent } from './admin'
import type { LayoutSemanticRegion } from './applicationTemplates'
import type { LayoutLogicalPlacement, LayoutWidgetMobileProjection } from './layoutEnvelope'
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
export const MARKETING_DEFAULT_IMAGE_URL = 'https://mui.com/static/screenshots/material-ui/getting-started/templates/dashboard.jpg' as const

/** Persisted placements owned by the marketing template adapter. */
export const MARKETING_LAYOUT_ZONES = ['marketing-header', 'marketing-main', 'marketing-footer'] as const
export type MarketingLayoutZone = (typeof MARKETING_LAYOUT_ZONES)[number]
export const marketingLayoutZoneSchema = z.enum(MARKETING_LAYOUT_ZONES)

/** Explicit semantic mapping for the marketing adapter's physical zones. */
export const MARKETING_LAYOUT_ZONE_SEMANTICS = {
    'marketing-header': 'header',
    'marketing-main': 'main',
    'marketing-footer': 'footer'
} as const satisfies Readonly<Record<MarketingLayoutZone, LayoutSemanticRegion>>

/** Template-aware widget keys. Dashboard keys are deliberately not included. */
export const MARKETING_WIDGET_KEYS = [
    'marketing.brand',
    'marketing.navigation',
    'marketing.auth',
    'marketing.hero',
    'marketing.image',
    'marketing.collection',
    'marketing.pricing',
    'marketing.footer'
] as const
export type MarketingWidgetKey = (typeof MARKETING_WIDGET_KEYS)[number]
export const marketingWidgetKeySchema = z.enum(MARKETING_WIDGET_KEYS)

export const MARKETING_COLLECTION_VARIANTS = ['logos', 'features', 'testimonials', 'highlights', 'faq'] as const
export type MarketingCollectionVariant = (typeof MARKETING_COLLECTION_VARIANTS)[number]
export const marketingCollectionVariantSchema = z.enum(MARKETING_COLLECTION_VARIANTS)

/** `featured` keeps one highlighted pricing tier; `uniform` renders equal cards without the highlight. */
export const MARKETING_PRICING_CARD_STYLES = ['featured', 'uniform'] as const
export type MarketingPricingCardStyle = (typeof MARKETING_PRICING_CARD_STYLES)[number]
export const marketingPricingCardStyleSchema = z.enum(MARKETING_PRICING_CARD_STYLES)

/** `auto` keeps the standard section container; `full` widens it so cards fill the viewport. */
export const MARKETING_PRICING_CARD_WIDTHS = ['auto', 'full'] as const
export type MarketingPricingCardWidth = (typeof MARKETING_PRICING_CARD_WIDTHS)[number]
export const marketingPricingCardWidthSchema = z.enum(MARKETING_PRICING_CARD_WIDTHS)

export const MARKETING_WIDGET_DATA_OWNERSHIP = ['entity', 'static', 'none'] as const
export type MarketingWidgetDataOwnership = (typeof MARKETING_WIDGET_DATA_OWNERSHIP)[number]
export const marketingWidgetDataOwnershipSchema = z.enum(MARKETING_WIDGET_DATA_OWNERSHIP)

export interface MarketingWidgetRegistryEntry {
    readonly key: MarketingWidgetKey
    readonly dataOwnership: MarketingWidgetDataOwnership
    /** Header capabilities may be singleton; content widgets can remain repeatable. */
    readonly repeatable: boolean
    readonly allowedZones: readonly MarketingLayoutZone[]
    /** Optional predecessors that visually compose with this widget without the default section divider. */
    readonly seamlessAfter?: readonly MarketingWidgetKey[]
    /** Default logical group for persisted header capabilities. */
    readonly defaultPlacement?: LayoutLogicalPlacement
    /** Responsive projection owned by the marketing header shell. */
    readonly mobileProjection?: LayoutWidgetMobileProjection
}

/** Serializable transport contract for one marketing widget capability. */
export const marketingWidgetRegistryEntrySchema = z
    .object({
        key: marketingWidgetKeySchema,
        dataOwnership: marketingWidgetDataOwnershipSchema,
        repeatable: z.boolean(),
        allowedZones: z.array(marketingLayoutZoneSchema).min(1),
        seamlessAfter: z.array(marketingWidgetKeySchema).optional(),
        defaultPlacement: z.enum(['start', 'end']).optional(),
        mobileProjection: z.enum(['compact-header', 'drawer']).optional()
    })
    .strict()

/** Strict registry envelope used by metadata consumers; it contains no executable validators. */
export const marketingWidgetRegistrySchema = z
    .record(z.string().trim().min(1).max(128), marketingWidgetRegistryEntrySchema)
    .superRefine((registry, context) => {
        for (const [registryKey, entry] of Object.entries(registry)) {
            if (registryKey !== entry.key) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: [registryKey, 'key'],
                    message: 'Marketing registry keys must match their entry keys.'
                })
            }
        }
    })
export type MarketingWidgetRegistry = z.infer<typeof marketingWidgetRegistrySchema>

export const MARKETING_WIDGET_REGISTRY: Readonly<Record<MarketingWidgetKey, MarketingWidgetRegistryEntry>> = {
    'marketing.brand': {
        key: 'marketing.brand',
        dataOwnership: 'entity',
        repeatable: false,
        allowedZones: ['marketing-header'],
        defaultPlacement: 'start',
        mobileProjection: 'compact-header'
    },
    'marketing.navigation': {
        key: 'marketing.navigation',
        dataOwnership: 'entity',
        repeatable: true,
        allowedZones: ['marketing-header'],
        defaultPlacement: 'start',
        mobileProjection: 'drawer'
    },
    'marketing.auth': {
        key: 'marketing.auth',
        dataOwnership: 'none',
        repeatable: false,
        allowedZones: ['marketing-header'],
        defaultPlacement: 'end',
        mobileProjection: 'drawer'
    },
    'marketing.hero': {
        key: 'marketing.hero',
        dataOwnership: 'entity',
        repeatable: true,
        allowedZones: ['marketing-main']
    },
    'marketing.image': {
        key: 'marketing.image',
        dataOwnership: 'static',
        repeatable: true,
        allowedZones: ['marketing-main'],
        seamlessAfter: ['marketing.hero']
    },
    'marketing.collection': {
        key: 'marketing.collection',
        dataOwnership: 'entity',
        repeatable: true,
        allowedZones: ['marketing-main']
    },
    'marketing.pricing': {
        key: 'marketing.pricing',
        dataOwnership: 'entity',
        repeatable: true,
        allowedZones: ['marketing-main']
    },
    'marketing.footer': {
        key: 'marketing.footer',
        dataOwnership: 'entity',
        repeatable: true,
        allowedZones: ['marketing-footer']
    }
}

export const MARKETING_HERO_ENTITY_CODENAME = 'MarketingPageHero' as const

/**
 * Entity codenames supported by the built-in marketing adapter. The adapter is
 * intentionally bounded: selecting an entity type never grants access to an
 * arbitrary runtime table or an arbitrary record shape.
 */
export const MARKETING_SOURCE_CODENAMES = [
    'MarketingPageSection',
    'MarketingPageSiteSettings',
    MARKETING_HERO_ENTITY_CODENAME,
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
    'marketing.brand': ['MarketingPageSiteSettings'],
    'marketing.navigation': ['MarketingPageNavigation'],
    'marketing.auth': [],
    'marketing.hero': [],
    'marketing.image': [],
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

/**
 * Canonical record kind produced by each collection variant. Kept in one place
 * so the authoring schema, the public schema and the renderer cannot drift.
 */
export const MARKETING_COLLECTION_VARIANT_RECORD_KINDS = {
    logos: ['logo'],
    features: ['feature'],
    testimonials: ['testimonial'],
    highlights: ['highlight'],
    faq: ['faq']
} as const satisfies Record<MarketingCollectionVariant, readonly string[]>

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
        'footerDescription',
        'copyright',
        'copyrightLabel',
        'copyrightAction',
        'newsletter'
    ],
    [MARKETING_HERO_ENTITY_CODENAME]: [
        'key',
        'title',
        'accent',
        'description',
        'emailLabel',
        'emailPlaceholder',
        'primaryActionLabel',
        'primaryAction',
        'termsText',
        'termsLinkLabel',
        'termsAction'
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

/**
 * PostgreSQL returns NUMERIC values as scaled strings ("1.00"). The canonical
 * shape is the only one treated as a number: strings with thousands
 * separators, units or long fractions stay authored text on every surface.
 */
export const MARKETING_NUMERIC_TEXT_PATTERN = /^-?\d{1,15}(?:[.,]\d{1,2})?$/

/**
 * Canonicalizes a scaled NUMERIC text ("1.00" → "1", "15.50" → "15.5") so the
 * API never ships fake precision. Non-numeric authored text passes through.
 */
export const normalizeMarketingNumericText = (value: string): string => {
    const trimmed = value.trim()
    // Authored text (units, ranges, prose) is preserved verbatim.
    if (!MARKETING_NUMERIC_TEXT_PATTERN.test(trimmed)) return value
    const normalized = trimmed.replace(',', '.')
    const [whole, fraction] = normalized.split('.')
    const trimmedFraction = fraction ? fraction.replace(/0+$/, '') : ''
    // Collapse signed negative zero to a plain zero, but keep the sign for
    // genuine negative fractions such as "-0.10".
    if ((whole === '0' || whole === '-0') && trimmedFraction.length === 0) return '0'
    if (!fraction) return whole
    return trimmedFraction.length > 0 ? `${whole}.${trimmedFraction}` : whole
}

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

/** Neutral reference passed from application layout resolution to marketing renderers. */
export const marketingLayoutWidgetReferenceSchema = z
    .object({
        id: z.string().trim().min(1),
        widgetKey: z.string().trim().min(1),
        zone: z.string().trim().min(1),
        instanceKey: z
            .string()
            .trim()
            .min(1)
            .max(128)
            .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u)
            .optional(),
        sortOrder: z.number().int().nonnegative(),
        isActive: z.boolean()
    })
    .strict()
export type MarketingLayoutWidgetReference = z.infer<typeof marketingLayoutWidgetReferenceSchema>

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

/**
 * Public media is deliberately URL-only. Storage keys and package
 * descriptors are server-side locators and must never cross the anonymous
 * runtime boundary.
 */
/** Remote publishable marketing media must use HTTPS; loopback HTTP is the only local-development exception. */
export const isLoopbackMarketingUrl = (value: string): boolean => {
    let url: URL
    try {
        url = new URL(value)
    } catch {
        return false
    }
    const hostname = url.hostname.toLowerCase()
    return url.protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1')
}

const publicMarketingMediaResourceSchema = z
    .object({
        type: z.literal('url'),
        url: safeExternalUrlSchema,
        launchMode: z.enum(['inline', 'newTab', 'download']).default('inline')
    })
    .strict()
    .superRefine((value, context) => {
        // Defense-in-depth for the anonymous boundary: remote plain-HTTP media
        // must never be representable in a public DTO. Loopback HTTP stays
        // allowed as the explicit local-development exception.
        let parsed: URL
        try {
            parsed = new URL(value.url)
        } catch {
            return
        }
        if (parsed.protocol !== 'http:') return
        if (!isLoopbackMarketingUrl(value.url)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['url'],
                message: 'Public remote media must use HTTPS.'
            })
        }
    })

export const publicMarketingMediaSchema = z
    .object({
        kind: z.enum(MARKETING_MEDIA_KINDS),
        resource: publicMarketingMediaResourceSchema,
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
                message: 'Non-decorative public marketing media must include localized alt text.'
            })
        }
        if (value.decorative && value.alt) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['alt'],
                message: 'Decorative public marketing media must not include alternative text.'
            })
        }
    })
export type PublicMarketingMedia = z.infer<typeof publicMarketingMediaSchema>

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
        publicMarketingSectionCopyRecordSchema
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

const marketingEntityWidgetConfigBaseSchema = z.object({
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

export const marketingNavigationWidgetConfigSchema = marketingEntityWidgetConfigBaseSchema
    .extend({
        maxItems: z.number().int().min(1).max(100).default(24),
        showAuthActions: z.boolean().default(true)
    })
    .strict()
    .superRefine((value, context) => refineMarketingWidgetSources(value, context, 'marketing.navigation'))

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

export const marketingCollectionWidgetConfigSchema = marketingEntityWidgetConfigBaseSchema
    .extend({
        variant: marketingCollectionVariantSchema,
        maxItems: z.number().int().min(1).max(1000).default(100),
        showTitle: z.boolean().default(true),
        showDescription: z.boolean().default(true),
        /** Features-only: hide item descriptions so the cards show titles only. */
        showItemDescriptions: z.boolean().default(true),
        /** Features-only: constrain the item list to the media area height with vertical scrolling. */
        fixedItemsHeight: z.boolean().default(false)
    })
    .strict()
    .superRefine((value, context) => refineMarketingWidgetSources(value, context, 'marketing.collection', value.variant))

export const marketingPricingWidgetConfigSchema = marketingEntityWidgetConfigBaseSchema
    .extend({
        maxItems: z.number().int().min(1).max(100).default(24),
        showBenefits: z.boolean().default(true),
        cardStyle: marketingPricingCardStyleSchema.default('featured'),
        cardWidth: marketingPricingCardWidthSchema.default('auto')
    })
    .strict()
    .superRefine((value, context) => refineMarketingWidgetSources(value, context, 'marketing.pricing'))

export const marketingFooterWidgetConfigSchema = marketingEntityWidgetConfigBaseSchema
    .extend({
        maxItems: z.number().int().min(1).max(100).default(100),
        showNewsletter: z.boolean().default(true)
    })
    .strict()
    .superRefine((value, context) => refineMarketingWidgetSources(value, context, 'marketing.footer'))

/** Header-only content capabilities are persisted separately from navigation. */
export const marketingBrandWidgetConfigSchema = marketingEntityWidgetConfigBaseSchema
    .extend({
        /** Optional layout-level brand name override; a plain value applies to every locale. */
        brandName: z.string().trim().min(1).max(120).optional(),
        /** Optional layout-level brand logo override; otherwise the site settings record is used. */
        brandLogo: marketingMediaSchema.optional()
    })
    .strict()
    .strict()
    .superRefine((value, context) => refineMarketingWidgetSources(value, context, 'marketing.brand'))

export const marketingImageMediaSchema = marketingMediaSchema.superRefine((value, context) => {
    if (value.kind !== 'hero') {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['kind'], message: 'Marketing image widgets must use hero media.' })
    }
    if (value.resource.type !== 'url' || !value.resource.url) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['resource', 'type'],
            message: 'Marketing image widgets must use an external URL resource.'
        })
        return
    }
    if (value.resource.launchMode !== 'inline') {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['resource', 'launchMode'],
            message: 'Marketing image widgets render inline.'
        })
    }
    const parsed = new URL(value.resource.url)
    if (parsed.protocol !== 'https:' && !isLoopbackMarketingUrl(value.resource.url)) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['resource', 'url'],
            message: 'Remote marketing images must use HTTPS.'
        })
    }
})

export const marketingImageWidgetConfigSchema = z
    .object({
        instanceKey: marketingWidgetInstanceKeySchema,
        media: marketingImageMediaSchema
    })
    .strict()

export const marketingAuthWidgetConfigSchema = z
    .object({
        instanceKey: marketingWidgetInstanceKeySchema,
        showAuthActions: z.boolean().default(true)
    })
    .strict()

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
        config: marketingImageWidgetConfigSchema
    })
    .superRefine((value, context) => {
        if (value.zone !== 'marketing-main') {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['zone'], message: 'Image widgets must use the main zone.' })
        }
        if (value.data.records.length > 0) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['data'],
                message: 'Static image widgets must not contain entity records.'
            })
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
        widgets: z.array(marketingPageWidgetSchema).min(1).max(64),
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
 * Public widget identities are either the persisted semantic instance key
 * (kept so rendered section anchors stay resolvable) or a deterministic
 * synthetic key that never exposes opaque internal identifiers.
 */
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

const publicMarketingRuntimeWidgetBaseSchema = z.object({
    instanceKey: publicMarketingWidgetInstanceKeySchema,
    zone: marketingLayoutZoneSchema,
    sortOrder: z.number().int().min(0).max(100_000),
    isActive: z.boolean(),
    data: publicMarketingWidgetDataSchema
})

const publicMarketingEntityWidgetConfigBaseSchema = z.object({
    instanceKey: publicMarketingWidgetInstanceKeySchema
})

export const publicMarketingNavigationWidgetSchema = publicMarketingRuntimeWidgetBaseSchema
    .extend({
        widgetKey: z.literal('marketing.navigation'),
        config: publicMarketingEntityWidgetConfigBaseSchema.extend({
            maxItems: z.number().int().min(1).max(100).default(24),
            showAuthActions: z.boolean().default(true)
        })
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
        config: z.object({ instanceKey: publicMarketingWidgetInstanceKeySchema, media: publicMarketingMediaSchema }).strict()
    })
    .superRefine((value, context) => {
        if (value.zone !== 'marketing-main') {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['zone'], message: 'Image widgets must use the main zone.' })
        }
        if (value.data.records.length > 0) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['data'],
                message: 'Static image widgets must not contain entity records.'
            })
        }
    })

export const publicMarketingCollectionWidgetSchema = publicMarketingRuntimeWidgetBaseSchema
    .extend({
        widgetKey: z.literal('marketing.collection'),
        config: publicMarketingEntityWidgetConfigBaseSchema.extend({
            variant: marketingCollectionVariantSchema,
            maxItems: z.number().int().min(1).max(1000).default(100),
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

/** Anonymous payload with only renderer inputs; internal IDs, provenance and source locators are excluded. */
export type PublicMarketingPageData = {
    templateKey: typeof MARKETING_PAGE_TEMPLATE_KEY
    locale: MarketingLocaleCode
    config: MarketingPageConfig
    widgets: Array<PublicMarketingRuntimeWidget | PublicMarketingAtomicHeaderWidget>
    /** Layout-driven header rows; absent on payloads created before this contract. */
    headerWidgets?: PublicMarketingHeaderWidget[]
}

export const publicMarketingPageDataSchema: z.ZodType<PublicMarketingPageData> = z
    .object({
        templateKey: z.literal(MARKETING_PAGE_TEMPLATE_KEY),
        locale: marketingLocaleCodeSchema,
        config: marketingPageConfigSchema,
        widgets: z.array(publicMarketingPageWidgetSchema).min(1).max(64),
        headerWidgets: z.array(publicMarketingHeaderWidgetSchema).max(24).optional()
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
        if (!value.widgets.some((widget) => widget.isActive)) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['widgets'], message: 'Marketing layout must contain an active widget.' })
        }

        const headerKeys = new Set<string>()
        for (const [index, widget] of (value.headerWidgets ?? []).entries()) {
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

export type MarketingCanonicalLocalizedText = VersionedLocalizedContent<string>
