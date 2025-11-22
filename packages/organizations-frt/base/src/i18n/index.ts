// Universo Platformo | Organizations module i18n
// Register consolidated organizations namespace (includes departments, positions, members)
import { registerNamespace } from '@universo/i18n/registry'
import enOrganizations from './locales/en/organizations.json'
import ruOrganizations from './locales/ru/organizations.json'

// Register single consolidated namespace
registerNamespace('organizations', {
    en: enOrganizations.organizations,
    ru: ruOrganizations.organizations
})

type LanguageCode = 'en' | 'ru'

interface OrganizationsTranslation {
    organizations: Record<string, unknown>
}

interface TranslationsMap {
    [key: string]: OrganizationsTranslation
}

// Export translations for backwards compatibility
export const organizationsTranslations: TranslationsMap = {
    en: { organizations: enOrganizations.organizations },
    ru: { organizations: ruOrganizations.organizations }
}

export function getOrganizationsTranslations(language: LanguageCode): Record<string, unknown> {
    return organizationsTranslations[language]?.organizations || organizationsTranslations.en.organizations
}
