import type { QueryKey, QueryClient } from '@tanstack/react-query'
import {
    applyOptimisticCreate,
    confirmOptimisticCreate,
    type ApplyOptimisticCreateOptions,
    type ConfirmOptimisticCreateOptions,
    type ListCache,
    type OptimisticCreateContext,
    type OptimisticSnapshot,
    type RowsListCache
} from '@universo/template-mui'
import { metahubsQueryKeys } from './queryKeys'

type HubScopedEntitySegment = 'valueGroups' | 'linkedCollections' | 'optionLists'

type EntityWithOptionalHubs = {
    id: string
    treeEntities?: Array<{ id: string }>
    [key: string]: unknown
}

type CopyScopeOptions = {
    queryClient: QueryClient
    metahubId: string
    entityId: string
    entitySegment: HubScopedEntitySegment
    broadQueryKeyPrefix: QueryKey
    scopedQueryKeyPrefixFactory: (treeEntityId: string) => QueryKey
    knownTreeEntityIds?: string[]
}

type MultiScopeApplyOptions<T extends { id: string }> = Omit<ApplyOptimisticCreateOptions<T>, 'queryKeyPrefix'> & {
    queryKeyPrefixes: QueryKey[]
}

const uniqueQueryKeyPrefixes = (queryKeyPrefixes: QueryKey[]): QueryKey[] => {
    const seen = new Set<string>()
    const unique: QueryKey[] = []

    for (const queryKeyPrefix of queryKeyPrefixes) {
        const serialized = JSON.stringify(queryKeyPrefix)
        if (seen.has(serialized)) {
            continue
        }
        seen.add(serialized)
        unique.push(queryKeyPrefix)
    }

    return unique
}

const getCollectionItems = (
    cacheEntry: ListCache<EntityWithOptionalHubs> | RowsListCache<EntityWithOptionalHubs> | undefined
): EntityWithOptionalHubs[] => {
    if (!cacheEntry) {
        return []
    }

    if (Array.isArray(cacheEntry.items)) {
        return cacheEntry.items
    }

    if (Array.isArray(cacheEntry.rows)) {
        return cacheEntry.rows
    }

    return []
}

const queryKeyStartsWith = (queryKey: QueryKey, prefix: readonly unknown[]): boolean => {
    return prefix.length <= queryKey.length && prefix.every((value, index) => queryKey[index] === value)
}

const extractTreeEntityIdFromScopedQueryKey = (
    queryKey: QueryKey,
    metahubId: string,
    entitySegment: HubScopedEntitySegment
): string | null => {
    const detailPrefix = metahubsQueryKeys.detail(metahubId)

    if (!queryKeyStartsWith(queryKey, detailPrefix)) {
        return null
    }

    const relativeParts = queryKey.slice(detailPrefix.length)

    if (
        relativeParts[0] !== 'treeEntities' ||
        relativeParts[1] !== 'detail' ||
        typeof relativeParts[2] !== 'string' ||
        relativeParts[3] !== entitySegment
    ) {
        return null
    }

    return relativeParts[2]
}

export const collectMetahubCopyQueryKeyPrefixes = ({
    queryClient,
    metahubId,
    entityId,
    entitySegment,
    broadQueryKeyPrefix,
    scopedQueryKeyPrefixFactory,
    knownTreeEntityIds = []
}: CopyScopeOptions): QueryKey[] => {
    const treeEntityIds = new Set<string>(knownTreeEntityIds.filter((treeEntityId) => treeEntityId.length > 0))
    const cachedEntries = queryClient.getQueriesData<ListCache<EntityWithOptionalHubs> | RowsListCache<EntityWithOptionalHubs>>({
        queryKey: metahubsQueryKeys.detail(metahubId)
    })

    for (const [queryKey, cacheEntry] of cachedEntries) {
        const matchedEntity = getCollectionItems(cacheEntry).find((item) => item.id === entityId)
        if (!matchedEntity) {
            continue
        }

        for (const hub of matchedEntity.treeEntities ?? []) {
            if (typeof hub?.id === 'string' && hub.id.length > 0) {
                treeEntityIds.add(hub.id)
            }
        }

        const hubIdFromQueryKey = extractTreeEntityIdFromScopedQueryKey(queryKey, metahubId, entitySegment)
        if (hubIdFromQueryKey) {
            treeEntityIds.add(hubIdFromQueryKey)
        }
    }

    return uniqueQueryKeyPrefixes([
        broadQueryKeyPrefix,
        ...Array.from(treeEntityIds).map((treeEntityId) => scopedQueryKeyPrefixFactory(treeEntityId))
    ])
}

export const applyOptimisticCreateToQueryKeyPrefixes = async <T extends { id: string }>(
    options: MultiScopeApplyOptions<T>
): Promise<OptimisticCreateContext> => {
    const { queryKeyPrefixes, ...sharedOptions } = options
    const previousSnapshotsMap = new Map<string, [QueryKey, unknown]>()

    for (const queryKeyPrefix of uniqueQueryKeyPrefixes(queryKeyPrefixes)) {
        const context = await applyOptimisticCreate({
            ...sharedOptions,
            queryKeyPrefix
        })

        for (const snapshot of context.previousSnapshots) {
            previousSnapshotsMap.set(JSON.stringify(snapshot[0]), snapshot)
        }
    }

    return {
        previousSnapshots: Array.from(previousSnapshotsMap.values()) as OptimisticSnapshot,
        optimisticId: sharedOptions.optimisticEntity.id
    }
}

export const confirmOptimisticCreateInQueryKeyPrefixes = (
    queryClient: QueryClient,
    queryKeyPrefixes: QueryKey[],
    optimisticId: string,
    realId: string,
    options?: ConfirmOptimisticCreateOptions
): void => {
    for (const queryKeyPrefix of uniqueQueryKeyPrefixes(queryKeyPrefixes)) {
        confirmOptimisticCreate(queryClient, queryKeyPrefix, optimisticId, realId, options)
    }
}
