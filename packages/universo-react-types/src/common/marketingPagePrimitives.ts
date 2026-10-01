import { z } from 'zod'

import type { VersionedLocalizedContent } from './admin'
import type { LayoutSemanticRegion } from './applicationTemplates'
import type { LayoutLogicalPlacement, LayoutWidgetMobileProjection } from './layoutWidgetPrimitives'
import { marketingWidgetKeySchema, marketingSemanticKeySchema } from './marketingWidgetPrimitives'
import type { MarketingWidgetKey, MarketingCollectionVariant } from './marketingWidgetPrimitives'

export {
    MARKETING_PAGE_REQUIRED_LOCALES,
    MARKETING_WIDGET_KEYS,
    marketingWidgetKeySchema,
    MARKETING_COLLECTION_VARIANTS,
    marketingCollectionVariantSchema,
    MARKETING_SEMANTIC_KEY_PATTERN,
    marketingSemanticKeySchema
} from './marketingWidgetPrimitives'
export type { MarketingWidgetKey, MarketingCollectionVariant, MarketingSemanticKey } from './marketingWidgetPrimitives'
export { APPLICATION_TEMPLATE_REGISTRY } from './applicationTemplates'
export type { ApplicationTemplateRegistryEntry } from './applicationTemplates'
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
        dataOwnership: 'entity',
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
export const MARKETING_PAGE_HUB_CODENAME = 'MarketingPage' as const

/** Built-in Object codenames seeded by the Marketing Page metahub template. */
export const MARKETING_TEMPLATE_ENTITY_CODENAMES = [
    'MarketingPageSection',
    'MarketingPageSiteSettings',
    MARKETING_HERO_ENTITY_CODENAME,
    'MarketingPageImage',
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

/**
 * Runtime rows are bounded per known marketing collection (1000 rows each)
 * and the singleton site-settings record. Keep the aggregate schema bound in
 * the shared contract so a controller cannot accidentally return an unlimited
 * payload when a collection grows.
 */
export const MARKETING_MAX_RUNTIME_RECORDS = 12_001

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

/** Persisted Entity media Components use the same safe URL contract as public media resources. */
export const marketingMediaReferenceSchema = publicMarketingMediaResourceSchema

export type MarketingCanonicalLocalizedText = VersionedLocalizedContent<string>
