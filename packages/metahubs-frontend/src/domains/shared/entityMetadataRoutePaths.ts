export type ObjectCollectionAuthoringTab = 'components' | 'system' | 'records'
export type TreeEntityAuthoringTab = 'treeEntities' | 'objectCollections' | 'valueGroups' | 'optionLists'

export type EntityMetadataChildKind = 'hub' | 'object' | 'set' | 'enumeration'

type EntityMetadataRouteOptions = {
    metahubId?: string | null
    kindKey?: string | null
    treeEntityId?: string | null
}

type ObjectCollectionAuthoringPathOptions = EntityMetadataRouteOptions & {
    objectCollectionId?: string | null
    tab: ObjectCollectionAuthoringTab
}

type ValueGroupAuthoringPathOptions = EntityMetadataRouteOptions & {
    valueGroupId?: string | null
}

type OptionListAuthoringPathOptions = EntityMetadataRouteOptions & {
    optionListId?: string | null
}

const ENTITY_METADATA_CHILD_KINDS: readonly EntityMetadataChildKind[] = ['hub', 'object', 'set', 'enumeration'] as const
const TREE_TAB_CHILD_KIND: Record<TreeEntityAuthoringTab, EntityMetadataChildKind> = {
    treeEntities: 'hub',
    objectCollections: 'object',
    valueGroups: 'set',
    optionLists: 'enumeration'
}
const OBJECT_COLLECTION_TAB_SEGMENTS: Record<ObjectCollectionAuthoringTab, string> = {
    components: 'components',
    system: 'system',
    records: 'records'
}

const normalizeSegment = (value?: string | null): string => (typeof value === 'string' ? value.trim() : '')

const resolveEntityRouteKindOrDefault = ({
    kindKey,
    treeEntityId,
    fallbackKind
}: {
    kindKey?: string | null
    treeEntityId?: string | null
    fallbackKind: EntityMetadataChildKind
}): string => {
    const normalizedKindKey = normalizeSegment(kindKey)
    if (normalizedKindKey) {
        return normalizedKindKey
    }

    return normalizeSegment(treeEntityId) ? 'hub' : fallbackKind
}

export const resolveEntityChildKindKey = ({
    routeKindKey,
    childObjectKind
}: {
    routeKindKey?: string | null
    childObjectKind: EntityMetadataChildKind
}): string | undefined => {
    const normalizedRouteKindKey = normalizeSegment(routeKindKey)
    if (!normalizedRouteKindKey) {
        return undefined
    }

    if (ENTITY_METADATA_CHILD_KINDS.includes(normalizedRouteKindKey as EntityMetadataChildKind)) {
        return normalizedRouteKindKey !== childObjectKind ? childObjectKind : normalizedRouteKindKey
    }

    return normalizedRouteKindKey
}

export const buildTreeEntityAuthoringPath = ({
    metahubId,
    treeEntityId,
    kindKey,
    tab
}: EntityMetadataRouteOptions & { tab: TreeEntityAuthoringTab }): string => {
    const normalizedMetahubId = normalizeSegment(metahubId)
    const normalizedTreeEntityId = normalizeSegment(treeEntityId)
    const normalizedKindKey =
        resolveEntityChildKindKey({ routeKindKey: kindKey, childObjectKind: TREE_TAB_CHILD_KIND[tab] }) ?? TREE_TAB_CHILD_KIND[tab]

    if (!normalizedMetahubId || !normalizedTreeEntityId) {
        return ''
    }

    return `/metahub/${normalizedMetahubId}/entities/${encodeURIComponent(normalizedKindKey)}/instance/${normalizedTreeEntityId}/instances`
}

export const buildObjectCollectionAuthoringPath = ({
    metahubId,
    objectCollectionId,
    treeEntityId,
    kindKey,
    tab
}: ObjectCollectionAuthoringPathOptions): string => {
    const normalizedMetahubId = normalizeSegment(metahubId)
    const normalizedObjectCollectionId = normalizeSegment(objectCollectionId)
    const normalizedTreeEntityId = normalizeSegment(treeEntityId)
    const normalizedKindKey =
        resolveEntityChildKindKey({ routeKindKey: kindKey, childObjectKind: 'object' }) ??
        resolveEntityRouteKindOrDefault({ kindKey, treeEntityId, fallbackKind: 'object' })

    if (!normalizedMetahubId || !normalizedObjectCollectionId) {
        return ''
    }

    const tabSegment = OBJECT_COLLECTION_TAB_SEGMENTS[tab]

    if (normalizedTreeEntityId) {
        return `/metahub/${normalizedMetahubId}/entities/${encodeURIComponent(
            normalizedKindKey
        )}/instance/${normalizedTreeEntityId}/instance/${normalizedObjectCollectionId}/${tabSegment}`
    }

    return `/metahub/${normalizedMetahubId}/entities/${encodeURIComponent(
        normalizedKindKey
    )}/instance/${normalizedObjectCollectionId}/${tabSegment}`
}

export const buildValueGroupAuthoringPath = ({
    metahubId,
    valueGroupId,
    treeEntityId,
    kindKey
}: ValueGroupAuthoringPathOptions): string => {
    const normalizedMetahubId = normalizeSegment(metahubId)
    const normalizedValueGroupId = normalizeSegment(valueGroupId)
    const normalizedTreeEntityId = normalizeSegment(treeEntityId)
    const normalizedKindKey =
        resolveEntityChildKindKey({ routeKindKey: kindKey, childObjectKind: 'set' }) ??
        resolveEntityRouteKindOrDefault({ kindKey, treeEntityId, fallbackKind: 'set' })

    if (!normalizedMetahubId || !normalizedValueGroupId) {
        return ''
    }

    if (normalizedTreeEntityId) {
        return `/metahub/${normalizedMetahubId}/entities/${encodeURIComponent(
            normalizedKindKey
        )}/instance/${normalizedTreeEntityId}/instance/${normalizedValueGroupId}/fixed-values`
    }

    return `/metahub/${normalizedMetahubId}/entities/${encodeURIComponent(
        normalizedKindKey
    )}/instance/${normalizedValueGroupId}/fixed-values`
}

export const buildOptionListAuthoringPath = ({
    metahubId,
    optionListId,
    treeEntityId,
    kindKey
}: OptionListAuthoringPathOptions): string => {
    const normalizedMetahubId = normalizeSegment(metahubId)
    const normalizedOptionListId = normalizeSegment(optionListId)
    const normalizedTreeEntityId = normalizeSegment(treeEntityId)
    const normalizedKindKey =
        resolveEntityChildKindKey({ routeKindKey: kindKey, childObjectKind: 'enumeration' }) ??
        resolveEntityRouteKindOrDefault({ kindKey, treeEntityId, fallbackKind: 'enumeration' })

    if (!normalizedMetahubId || !normalizedOptionListId) {
        return ''
    }

    if (normalizedTreeEntityId) {
        return `/metahub/${normalizedMetahubId}/entities/${encodeURIComponent(
            normalizedKindKey
        )}/instance/${normalizedTreeEntityId}/instance/${normalizedOptionListId}/values`
    }

    return `/metahub/${normalizedMetahubId}/entities/${encodeURIComponent(normalizedKindKey)}/instance/${normalizedOptionListId}/values`
}
