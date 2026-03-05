import type { QueryClient, QueryKey } from '@tanstack/react-query'

type ReorderableItem = {
    id: string
    sortOrder?: number | null
}

type ListCache<T extends ReorderableItem> = {
    items?: T[]
    [key: string]: unknown
}

export type ReorderQuerySnapshot = Array<[QueryKey, unknown]>

const toFiniteSortOrder = (value: number, max: number): number => {
    if (!Number.isFinite(value)) return 1
    return Math.max(1, Math.min(Math.trunc(value), max))
}

export const reorderItemsBySortOrder = <T extends ReorderableItem>(items: T[], itemId: string, newSortOrder: number): T[] => {
    if (!Array.isArray(items) || items.length <= 1) return items

    const fromIndex = items.findIndex((item) => item.id === itemId)
    if (fromIndex < 0) return items

    const boundedSortOrder = toFiniteSortOrder(newSortOrder, items.length)
    let toIndex = items.findIndex((item) => (item.sortOrder ?? 0) === boundedSortOrder)
    if (toIndex < 0) {
        toIndex = boundedSortOrder - 1
    }

    if (fromIndex === toIndex) return items

    const nextItems = [...items]
    const [movedItem] = nextItems.splice(fromIndex, 1)
    nextItems.splice(toIndex, 0, movedItem)

    return nextItems.map((item, index) => ({ ...item, sortOrder: index + 1 }))
}

export const applyOptimisticReorder = async <T extends ReorderableItem>(
    queryClient: QueryClient,
    queryKeyPrefix: QueryKey,
    itemId: string,
    newSortOrder: number
): Promise<ReorderQuerySnapshot> => {
    await queryClient.cancelQueries({ queryKey: queryKeyPrefix })
    const snapshots = queryClient.getQueriesData<ListCache<T>>({ queryKey: queryKeyPrefix }) as ReorderQuerySnapshot

    queryClient.setQueriesData<ListCache<T>>({ queryKey: queryKeyPrefix }, (old) => {
        if (!old || !Array.isArray(old.items)) return old
        const reordered = reorderItemsBySortOrder(old.items, itemId, newSortOrder)
        if (reordered === old.items) return old
        return { ...old, items: reordered }
    })

    return snapshots
}

export const rollbackReorderSnapshots = (queryClient: QueryClient, snapshots?: ReorderQuerySnapshot): void => {
    if (!Array.isArray(snapshots) || snapshots.length === 0) return
    for (const [queryKey, data] of snapshots) {
        queryClient.setQueryData(queryKey, data)
    }
}
