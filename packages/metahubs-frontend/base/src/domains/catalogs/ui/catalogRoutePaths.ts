export type CatalogAuthoringTab = 'attributes' | 'system' | 'elements'

type BuildCatalogAuthoringPathOptions = {
    metahubId?: string | null
    catalogId?: string | null
    hubId?: string | null
    kindKey?: string | null
    tab: CatalogAuthoringTab
}

export const buildCatalogAuthoringPath = ({ metahubId, catalogId, hubId, kindKey, tab }: BuildCatalogAuthoringPathOptions): string => {
    const normalizedMetahubId = typeof metahubId === 'string' ? metahubId.trim() : ''
    const normalizedCatalogId = typeof catalogId === 'string' ? catalogId.trim() : ''
    const normalizedHubId = typeof hubId === 'string' ? hubId.trim() : ''
    const normalizedKindKey = typeof kindKey === 'string' ? kindKey.trim() : ''

    if (!normalizedMetahubId || !normalizedCatalogId) {
        return ''
    }

    if (normalizedKindKey) {
        return `/metahub/${normalizedMetahubId}/entities/${encodeURIComponent(normalizedKindKey)}/instance/${normalizedCatalogId}/${tab}`
    }

    if (normalizedHubId) {
        return `/metahub/${normalizedMetahubId}/hub/${normalizedHubId}/catalog/${normalizedCatalogId}/${tab}`
    }

    return `/metahub/${normalizedMetahubId}/catalog/${normalizedCatalogId}/${tab}`
}
