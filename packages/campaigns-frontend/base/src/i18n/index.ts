// Universo Platformo | Campaigns module i18n
// Register consolidated campaigns namespace (includes events, activities, members)
import { registerNamespace } from '@universo/i18n/registry'
import enCampaigns from './locales/en/campaigns.json'
import ruCampaigns from './locales/ru/campaigns.json'

// Register single consolidated namespace
registerNamespace('campaigns', {
    en: enCampaigns.campaigns,
    ru: ruCampaigns.campaigns
})

type LanguageCode = 'en' | 'ru'

interface CampaignsTranslation {
    campaigns: Record<string, unknown>
}

interface TranslationsMap {
    [key: string]: CampaignsTranslation
}

// Export translations for backwards compatibility
export const campaignsTranslations: TranslationsMap = {
    en: { campaigns: enCampaigns.campaigns },
    ru: { campaigns: ruCampaigns.campaigns }
}

export function getCampaignsTranslations(language: LanguageCode): Record<string, unknown> {
    return campaignsTranslations[language]?.campaigns || campaignsTranslations.en.campaigns
}
