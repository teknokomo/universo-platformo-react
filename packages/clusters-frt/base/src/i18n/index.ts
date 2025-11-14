// Universo Platformo | Clusters module i18n
// Register consolidated clusters namespace (includes domains, resources, members)
import { registerNamespace } from '@universo/i18n/registry'
import enClusters from './locales/en/clusters.json'
import ruClusters from './locales/ru/clusters.json'

// Register single consolidated namespace
registerNamespace('clusters', {
    en: enClusters.clusters,
    ru: ruClusters.clusters
})

type LanguageCode = 'en' | 'ru'

interface ClustersTranslation {
    clusters: Record<string, unknown>
}

interface TranslationsMap {
    [key: string]: ClustersTranslation
}

// Export translations for backwards compatibility
export const clustersTranslations: TranslationsMap = {
    en: { clusters: enClusters.clusters },
    ru: { clusters: ruClusters.clusters }
}

export function getClustersTranslations(language: LanguageCode): Record<string, unknown> {
    return clustersTranslations[language]?.clusters || clustersTranslations.en.clusters
}
