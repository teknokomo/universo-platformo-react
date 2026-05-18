import type { DashboardDetailsSlot } from '../dashboard/Dashboard'

const normalizeRuntimeCodename = (value: string | null | undefined): string | undefined => {
    const normalized = value?.trim().toLocaleLowerCase()
    return normalized ? normalized : undefined
}

export const findRuntimeSectionIdByCodename = (
    details: DashboardDetailsSlot | undefined,
    codename: string | null | undefined
): string | undefined => {
    if (!details) return undefined

    const normalized = normalizeRuntimeCodename(codename)
    if (!normalized) return undefined

    if (normalizeRuntimeCodename(details.sectionCodename) === normalized && details.sectionId) {
        return details.sectionId
    }

    if (normalizeRuntimeCodename(details.objectCollectionCodename) === normalized && details.objectCollectionId) {
        return details.objectCollectionId
    }

    return (
        details.sections?.find((section) => normalizeRuntimeCodename(section.codename) === normalized)?.id ??
        details.objectCollections?.find((section) => normalizeRuntimeCodename(section.codename) === normalized)?.id ??
        undefined
    )
}
