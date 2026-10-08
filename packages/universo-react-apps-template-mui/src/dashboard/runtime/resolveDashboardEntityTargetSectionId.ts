export interface DashboardEntityTarget {
    sectionId?: string | null
    sectionCodename?: string | null
    objectCollectionId?: string | null
    objectCollectionCodename?: string | null
}

export interface DashboardEntityDescriptor {
    id: string
    codename: string
}

export interface DashboardEntityIndex {
    sections?: readonly DashboardEntityDescriptor[]
    objectCollections?: readonly DashboardEntityDescriptor[]
}

/** Resolve an Entity target by explicit ID or by an unambiguous codename. */
export const resolveDashboardEntityTargetSectionId = (
    target: DashboardEntityTarget,
    entities: DashboardEntityIndex | null | undefined
): string | null => {
    const directId = target.sectionId ?? target.objectCollectionId
    if (directId) return directId

    const targetCodename = target.sectionCodename ?? target.objectCollectionCodename
    if (!targetCodename) return null

    const candidateIds = new Set(
        [...(entities?.sections ?? []), ...(entities?.objectCollections ?? [])]
            .filter((candidate) => candidate.codename === targetCodename)
            .map((candidate) => candidate.id)
    )
    return candidateIds.size === 1 ? [...candidateIds][0] ?? null : null
}
