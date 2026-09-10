import { z } from 'zod'

import type { ApplicationTemplateKey } from './marketingPage'

/** Logical placement regions shared by template adapters. */
export const LAYOUT_SEMANTIC_REGIONS = ['header', 'main', 'footer', 'sidebar', 'auxiliary'] as const
export type LayoutSemanticRegion = (typeof LAYOUT_SEMANTIC_REGIONS)[number]
export const layoutSemanticRegionSchema = z.enum(LAYOUT_SEMANTIC_REGIONS)

/** Host capabilities required by shared layout widgets. */
export const APPLICATION_TEMPLATE_HOST_CAPABILITIES = [
    'locale.state',
    'locale.change',
    'keyboard.focus',
    'accessibility.label',
    'theme.safe'
] as const
export type ApplicationTemplateHostCapability = (typeof APPLICATION_TEMPLATE_HOST_CAPABILITIES)[number]
export const applicationTemplateHostCapabilitySchema = z.enum(APPLICATION_TEMPLATE_HOST_CAPABILITIES)

export interface ApplicationTemplateRegistryEntry {
    readonly key: ApplicationTemplateKey
    readonly displayNameKey: string
    readonly descriptionKey: string
    readonly supportsDashboardWidgets: boolean
    readonly seedPolicyKey: string
    /** Capabilities exposed by the shell to shared widget adapters. */
    readonly hostCapabilities: readonly ApplicationTemplateHostCapability[]
    /** Semantic regions that the template can render. */
    readonly semanticRegions: readonly LayoutSemanticRegion[]
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
        seedPolicyKey: 'dashboard',
        hostCapabilities: [...APPLICATION_TEMPLATE_HOST_CAPABILITIES],
        semanticRegions: ['header', 'main', 'footer', 'sidebar', 'auxiliary']
    },
    'marketing-page': {
        key: 'marketing-page',
        displayNameKey: 'templates.marketingPage.name',
        descriptionKey: 'templates.marketingPage.description',
        supportsDashboardWidgets: false,
        seedPolicyKey: 'initial-only',
        hostCapabilities: [...APPLICATION_TEMPLATE_HOST_CAPABILITIES],
        semanticRegions: ['header', 'main', 'footer']
    }
}
