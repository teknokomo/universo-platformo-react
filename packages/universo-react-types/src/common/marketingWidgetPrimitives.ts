import { z } from 'zod'

export const MARKETING_PAGE_REQUIRED_LOCALES = ['en', 'ru'] as const

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

/** Stable semantic identities used by contracts and fixtures, never as UI labels. */
export const MARKETING_SEMANTIC_KEY_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/
export const marketingSemanticKeySchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(MARKETING_SEMANTIC_KEY_PATTERN, 'Semantic keys must use lowercase stable identifiers.')
export type MarketingSemanticKey = z.infer<typeof marketingSemanticKeySchema>
