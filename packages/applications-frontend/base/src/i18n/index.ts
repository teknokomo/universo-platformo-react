// Universo Platformo | Applications module i18n
// Register consolidated applications namespace (includes meta_sections, meta_entities, members)
import { registerNamespace } from '@universo/i18n/registry'
import enApplications from './locales/en/applications.json'
import ruApplications from './locales/ru/applications.json'

interface ApplicationsBundle {
    applications?: Record<string, unknown>
    meta_sections?: Record<string, unknown>
    meta_entities?: Record<string, unknown>
    members?: Record<string, unknown>
    connectors?: Record<string, unknown>
    migrations?: Record<string, unknown>
    common?: Record<string, unknown>
    table?: Record<string, unknown>
    actions?: Record<string, unknown>
    errors?: Record<string, unknown>
}

const consolidateApplicationsNamespace = (bundle: ApplicationsBundle) => {
    const applicationsRoot = (bundle?.applications ?? {}) as Record<string, unknown>

    const applicationsActions = (
        applicationsRoot?.actions && typeof applicationsRoot.actions === 'object' ? applicationsRoot.actions : {}
    ) as Record<string, unknown>

    // Return FLAT structure: spread applicationsRoot at top level
    // This allows t('title') to resolve to 'Applications', not requiring t('applications.title')
    const applicationsTable = (
        applicationsRoot?.table && typeof applicationsRoot.table === 'object' ? applicationsRoot.table : {}
    ) as Record<string, unknown>

    return {
        ...applicationsRoot,
        // Merge applications-level actions with top-level actions (e.g., generic backToList)
        actions: {
            ...applicationsActions,
            ...(bundle?.actions ?? {})
        },
        table: {
            ...applicationsTable,
            ...(bundle?.table ?? {})
        },
        connectors: bundle?.connectors ?? {},
        migrations: bundle?.migrations ?? {},
        members: bundle?.members ?? {},
        common: bundle?.common ?? {},
        errors: bundle?.errors ?? {}
    }
}

// Register single consolidated namespace
registerNamespace('applications', {
    en: consolidateApplicationsNamespace(enApplications),
    ru: consolidateApplicationsNamespace(ruApplications)
})

type LanguageCode = 'en' | 'ru'

interface ApplicationsTranslation {
    applications: Record<string, unknown>
}

interface TranslationsMap {
    [key: string]: ApplicationsTranslation
}

// Export translations for backwards compatibility
export const applicationsTranslations: TranslationsMap = {
    en: { applications: consolidateApplicationsNamespace(enApplications) },
    ru: { applications: consolidateApplicationsNamespace(ruApplications) }
}

export function getApplicationsTranslations(language: LanguageCode): Record<string, unknown> {
    return applicationsTranslations[language]?.applications || applicationsTranslations.en.applications
}
