export type LinkedCollectionAuthoringTab = 'fieldDefinitions' | 'system' | 'records'
export type TreeEntityAuthoringTab = 'treeEntities' | 'linkedCollections' | 'valueGroups' | 'optionLists'

export type EntityMetadataChildKind = 'hub' | 'catalog' | 'set' | 'enumeration'

type EntityMetadataRouteOptions = {
    metahubId?: string | null
    kindKey?: string | null
    treeEntityId?: string | null
}

type LinkedCollectionAuthoringPathOptions = EntityMetadataRouteOptions & {
    linkedCollectionId?: string | null
    tab: LinkedCollectionAuthoringTab
}

type ValueGroupAuthoringPathOptions = EntityMetadataRouteOptions & {
    valueGroupId?: string | null
}

type OptionListAuthoringPathOptions = EntityMetadataRouteOptions & {
    optionListId?: string | null
}

const ENTITY_METADATA_CHILD_KINDS: readonly EntityMetadataChildKind[] = ['hub', 'catalog', 'set', 'enumeration'] as const
const TREE_TAB_CHILD_KIND: Record<TreeEntityAuthoringTab, EntityMetadataChildKind> = {
    treeEntities: 'hub',
    linkedCollections: 'catalog',
    valueGroups: 'set',
    optionLists: 'enumeration'
}
const LINKED_COLLECTION_TAB_SEGMENTS: Record<LinkedCollectionAuthoringTab, string> = {
    fieldDefinitions: 'field-definitions',
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

export const buildLinkedCollectionAuthoringPath = ({
    metahubId,
    linkedCollectionId,
    treeEntityId,
    kindKey,
    tab
}: LinkedCollectionAuthoringPathOptions): string => {
    const normalizedMetahubId = normalizeSegment(metahubId)
    const normalizedLinkedCollectionId = normalizeSegment(linkedCollectionId)
    const normalizedTreeEntityId = normalizeSegment(treeEntityId)
    const normalizedKindKey =
        resolveEntityChildKindKey({ routeKindKey: kindKey, childObjectKind: 'catalog' }) ??
        resolveEntityRouteKindOrDefault({ kindKey, treeEntityId, fallbackKind: 'catalog' })

    if (!normalizedMetahubId || !normalizedLinkedCollectionId) {
        return ''
    }

    const tabSegment = LINKED_COLLECTION_TAB_SEGMENTS[tab]

    if (normalizedTreeEntityId) {
        return `/metahub/${normalizedMetahubId}/entities/${encodeURIComponent(
            normalizedKindKey
        )}/instance/${normalizedTreeEntityId}/instance/${normalizedLinkedCollectionId}/${tabSegment}`
    }

    return `/metahub/${normalizedMetahubId}/entities/${encodeURIComponent(
        normalizedKindKey
    )}/instance/${normalizedLinkedCollectionId}/${tabSegment}`
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
