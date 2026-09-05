import type { ApplicationTemplateKey } from './marketingPage'

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
        key: 'marketing-page',
        displayNameKey: 'templates.marketingPage.name',
        descriptionKey: 'templates.marketingPage.description',
        supportsDashboardWidgets: false,
        seedPolicyKey: 'initial-only'
    }
}
