import type { AppDataResponse } from '../api/api'

/** Resolves the loaded section metadata used by the standalone details surface. */
export const resolveSectionRecord = (
    appData: AppDataResponse | undefined,
    sectionId: string | null | undefined
): AppDataResponse['objectCollection'] | undefined => {
    if (!appData || !sectionId) return undefined

    const candidates = [...(appData.sections ?? []), ...(appData.objectCollections ?? [])]
    return candidates.find((candidate) => candidate.id === sectionId)
}

/** Returns the section identifier currently represented by loaded runtime data. */
export const getLoadedRuntimeSectionId = (appData: AppDataResponse | undefined): string | null =>
    appData?.section?.id ?? appData?.activeSectionId ?? appData?.objectCollection?.id ?? appData?.activeObjectCollectionId ?? null

/** Projects already loaded metadata onto a route-selected section without leaking stale rows. */
export const buildRouteProjectedAppData = (
    appData: AppDataResponse | undefined,
    currentRuntimeSection: AppDataResponse['objectCollection'] | undefined,
    currentRuntimeSectionId: string | null
): AppDataResponse | undefined => {
    if (!appData || !currentRuntimeSection || !currentRuntimeSectionId) return undefined
    if (getLoadedRuntimeSectionId(appData) === currentRuntimeSectionId) return undefined

    const hasTable = typeof currentRuntimeSection.tableName === 'string' && currentRuntimeSection.tableName.trim().length > 0

    return {
        ...appData,
        section: currentRuntimeSection,
        objectCollection: currentRuntimeSection,
        activeSectionId: currentRuntimeSectionId,
        activeObjectCollectionId: hasTable ? currentRuntimeSectionId : null,
        columns: [],
        rows: [],
        pagination: {
            ...appData.pagination,
            total: 0,
            offset: 0
        }
    }
}
