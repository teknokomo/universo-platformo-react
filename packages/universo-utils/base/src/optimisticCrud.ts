import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { uuidv7 } from 'uuidv7'
import {
    getNextOptimisticSortOrder,
    getPendingAction,
    isPendingEntity,
    isPendingInteractionBlocked,
    makePendingMarkers,
    revealPendingFeedback,
    shouldShowPendingFeedback,
    stripPendingMarkers
} from './optimistic'
import type { MaybePending, PendingAction, PendingMarkers, SortOrderLike } from './optimistic'

export type ListCache<T = Record<string, unknown>> = {
    items?: T[]
    pagination?: { total?: number; [k: string]: unknown }
    [key: string]: unknown
}

export type RowsListCache<T = Record<string, unknown>> = {
    rows?: T[]
    pagination?: { total?: number; [k: string]: unknown }
    [key: string]: unknown
}

export type OptimisticSnapshot = Array<[QueryKey, unknown]>

export interface OptimisticCreateContext {
    previousSnapshots: OptimisticSnapshot
    optimisticId: string
}

export interface OptimisticUpdateContext {
    previousSnapshots: OptimisticSnapshot
}

export interface OptimisticDeleteContext {
    previousSnapshots: OptimisticSnapshot
}

const updatePaginationTotal = (
    pagination: ListCache['pagination'] | RowsListCache['pagination'] | undefined,
    delta: number
): ListCache['pagination'] | RowsListCache['pagination'] | undefined => {
    if (!pagination) return undefined
    return {
        ...pagination,
        total: Math.max(0, (pagination.total ?? 0) + delta)
    }
}

function hasItemsCollection<T>(entry: ListCache<T> | RowsListCache<T>): entry is ListCache<T> & { items: T[] } {
    return Array.isArray(entry.items)
}

function hasRowsCollection<T>(entry: ListCache<T> | RowsListCache<T>): entry is RowsListCache<T> & { rows: T[] } {
    return Array.isArray(entry.rows)
}

type MaybePendingLike = {
    __pending?: boolean
    __pendingAction?: 'create' | 'update' | 'delete' | 'copy'
    __pendingFeedbackVisible?: boolean
}

const stripPendingMetadata = <T extends Record<string, unknown>>(item: T, nextId?: string): T => {
    return {
        ...item,
        ...(nextId ? { id: nextId } : {}),
        __pending: undefined,
        __pendingAction: undefined,
        __pendingFeedbackVisible: undefined
    } as T
}

const replaceOptimisticEntity = <T extends Record<string, unknown>>(collection: T[], optimisticId: string, realId: string): T[] => {
    const realEntityAlreadyExists = optimisticId !== realId && collection.some((item) => item.id === realId)

    return collection.flatMap((item) => {
        if (item.id !== optimisticId) {
            return [item]
        }

        if (realEntityAlreadyExists) {
            return []
        }

        return [stripPendingMetadata(item, realId)]
    })
}

export {
    isPendingEntity,
    getPendingAction,
    isPendingInteractionBlocked,
    shouldShowPendingFeedback,
    makePendingMarkers,
    revealPendingFeedback,
    getNextOptimisticSortOrder,
    stripPendingMarkers
}
export type { PendingAction, PendingMarkers, MaybePending, SortOrderLike }

export function generateOptimisticId(): string {
    return uuidv7()
}

export interface ApplyOptimisticCreateOptions<T> {
    queryClient: QueryClient
    queryKeyPrefix: QueryKey
    optimisticEntity: T
    insertPosition?: 'prepend' | 'append'
    breadcrumb?: {
        queryKey: QueryKey
        name: string
    }
}

export async function applyOptimisticCreate<T extends { id: string }>(
    options: ApplyOptimisticCreateOptions<T>
): Promise<OptimisticCreateContext> {
    const { queryClient, queryKeyPrefix, optimisticEntity, insertPosition = 'prepend', breadcrumb } = options

    await queryClient.cancelQueries({ queryKey: queryKeyPrefix })

    const previousSnapshots = queryClient.getQueriesData<ListCache<T> | RowsListCache<T>>({
        queryKey: queryKeyPrefix
    }) as OptimisticSnapshot

    queryClient.setQueriesData<ListCache<T> | RowsListCache<T>>({ queryKey: queryKeyPrefix }, (old) => {
        if (!old) return old

        if (hasItemsCollection(old)) {
            const newItems = insertPosition === 'prepend' ? [optimisticEntity, ...old.items] : [...old.items, optimisticEntity]
            return {
                ...old,
                items: newItems,
                pagination: updatePaginationTotal(old.pagination, 1)
            }
        }

        if (hasRowsCollection(old)) {
            const newRows = insertPosition === 'prepend' ? [optimisticEntity, ...old.rows] : [...old.rows, optimisticEntity]
            return {
                ...old,
                rows: newRows,
                pagination: updatePaginationTotal(old.pagination, 1)
            }
        }

        return old
    })

    if (breadcrumb) {
        queryClient.setQueryData(breadcrumb.queryKey, breadcrumb.name)
    }

    return {
        previousSnapshots,
        optimisticId: optimisticEntity.id
    }
}

export interface ApplyOptimisticUpdateOptions<T> {
    queryClient: QueryClient
    queryKeyPrefix: QueryKey
    entityId: string
    updater: Partial<T>
    moveToFront?: boolean
    detailQueryKey?: QueryKey
    breadcrumb?: {
        queryKey: QueryKey
        name: string
    }
}

export async function applyOptimisticUpdate<T extends { id: string }>(
    options: ApplyOptimisticUpdateOptions<T>
): Promise<OptimisticUpdateContext> {
    const { queryClient, queryKeyPrefix, entityId, updater, moveToFront = false, detailQueryKey, breadcrumb } = options

    await queryClient.cancelQueries({ queryKey: queryKeyPrefix })
    if (detailQueryKey) {
        await queryClient.cancelQueries({ queryKey: detailQueryKey })
    }

    const previousSnapshots = queryClient.getQueriesData<ListCache<T> | RowsListCache<T>>({
        queryKey: queryKeyPrefix
    }) as OptimisticSnapshot

    if (detailQueryKey) {
        const detailData = queryClient.getQueryData(detailQueryKey)
        if (detailData !== undefined) {
            previousSnapshots.push([detailQueryKey, detailData])
        }
    }

    const pendingMarkers = makePendingMarkers('update')

    queryClient.setQueriesData<ListCache<T> | RowsListCache<T>>({ queryKey: queryKeyPrefix }, (old) => {
        if (!old) return old

        if (hasItemsCollection(old)) {
            if (moveToFront) {
                const currentItem = old.items.find((item) => item.id === entityId)
                if (!currentItem) return old

                const updatedItem = {
                    ...currentItem,
                    ...updater,
                    ...pendingMarkers
                }

                return {
                    ...old,
                    items: [updatedItem, ...old.items.filter((item) => item.id !== entityId)]
                }
            }

            return {
                ...old,
                items: old.items.map((item) => (item.id === entityId ? { ...item, ...updater, ...pendingMarkers } : item))
            }
        }

        if (hasRowsCollection(old)) {
            if (moveToFront) {
                const currentRow = old.rows.find((row) => row.id === entityId)
                if (!currentRow) return old

                const updatedRow = {
                    ...currentRow,
                    ...updater,
                    ...pendingMarkers
                }

                return {
                    ...old,
                    rows: [updatedRow, ...old.rows.filter((row) => row.id !== entityId)]
                }
            }

            return {
                ...old,
                rows: old.rows.map((row) => (row.id === entityId ? { ...row, ...updater, ...pendingMarkers } : row))
            }
        }

        return old
    })

    if (detailQueryKey) {
        queryClient.setQueryData<T>(detailQueryKey, (old) => {
            if (!old) return old
            return { ...old, ...updater, ...pendingMarkers }
        })
    }

    if (breadcrumb) {
        queryClient.setQueryData(breadcrumb.queryKey, breadcrumb.name)
    }

    return { previousSnapshots }
}

export interface ApplyOptimisticDeleteOptions {
    queryClient: QueryClient
    queryKeyPrefix: QueryKey
    entityId: string
    strategy?: 'remove' | 'fade'
}

export async function applyOptimisticDelete<T extends { id: string }>(
    options: ApplyOptimisticDeleteOptions
): Promise<OptimisticDeleteContext> {
    const { queryClient, queryKeyPrefix, entityId, strategy = 'remove' } = options

    await queryClient.cancelQueries({ queryKey: queryKeyPrefix })

    const previousSnapshots = queryClient.getQueriesData<ListCache<T> | RowsListCache<T>>({
        queryKey: queryKeyPrefix
    }) as OptimisticSnapshot

    if (strategy === 'remove') {
        queryClient.setQueriesData<ListCache<T> | RowsListCache<T>>({ queryKey: queryKeyPrefix }, (old) => {
            if (!old) return old

            if (hasItemsCollection(old)) {
                return {
                    ...old,
                    items: old.items.filter((item) => item.id !== entityId),
                    pagination: updatePaginationTotal(old.pagination, -1)
                }
            }

            if (hasRowsCollection(old)) {
                return {
                    ...old,
                    rows: old.rows.filter((row) => row.id !== entityId),
                    pagination: updatePaginationTotal(old.pagination, -1)
                }
            }

            return old
        })
    } else {
        const pendingMarkers = makePendingMarkers('delete')
        queryClient.setQueriesData<ListCache<T> | RowsListCache<T>>({ queryKey: queryKeyPrefix }, (old) => {
            if (!old) return old

            if (hasItemsCollection(old)) {
                return {
                    ...old,
                    items: old.items.map((item) => (item.id === entityId ? { ...item, ...pendingMarkers } : item))
                }
            }

            if (hasRowsCollection(old)) {
                return {
                    ...old,
                    rows: old.rows.map((row) => (row.id === entityId ? { ...row, ...pendingMarkers } : row))
                }
            }

            return old
        })
    }

    return { previousSnapshots }
}

export function rollbackOptimisticSnapshots(queryClient: QueryClient, snapshots?: OptimisticSnapshot): void {
    if (!Array.isArray(snapshots) || snapshots.length === 0) return
    for (const [queryKey, data] of snapshots) {
        queryClient.setQueryData(queryKey, data)
    }
}

export function cleanupBreadcrumbCache(queryClient: QueryClient, breadcrumbQueryKey: QueryKey): void {
    queryClient.removeQueries({
        queryKey: breadcrumbQueryKey,
        exact: true
    })
}

const revealPendingFeedbackInEntity = <T extends { id: string }>(entity: T, entityId: string): T => {
    if (entity.id !== entityId) return entity
    return revealPendingFeedback(entity as T & MaybePendingLike) as T
}

const revealPendingFeedbackInCache = <T extends { id: string }>(cacheEntry: unknown, entityId: string): unknown => {
    if (!cacheEntry || typeof cacheEntry !== 'object') return cacheEntry

    if (Array.isArray((cacheEntry as ListCache<T>).items)) {
        const items = (cacheEntry as ListCache<T>).items ?? []
        const nextItems = items.map((item) => revealPendingFeedbackInEntity(item, entityId))
        return { ...cacheEntry, items: nextItems }
    }

    if (Array.isArray((cacheEntry as RowsListCache<T>).rows)) {
        const rows = (cacheEntry as RowsListCache<T>).rows ?? []
        const nextRows = rows.map((row) => revealPendingFeedbackInEntity(row, entityId))
        return { ...cacheEntry, rows: nextRows }
    }

    if (typeof (cacheEntry as { id?: unknown }).id === 'string') {
        return revealPendingFeedbackInEntity(cacheEntry as T, entityId)
    }

    return cacheEntry
}

export interface RevealPendingEntityFeedbackOptions {
    queryClient: QueryClient
    queryKeyPrefix: QueryKey
    entityId: string
    extraQueryKeys?: QueryKey[]
}

export function revealPendingEntityFeedback(options: RevealPendingEntityFeedbackOptions): void {
    const { queryClient, queryKeyPrefix, entityId, extraQueryKeys = [] } = options

    queryClient.setQueriesData({ queryKey: queryKeyPrefix }, (old) => revealPendingFeedbackInCache(old, entityId))

    for (const queryKey of extraQueryKeys) {
        queryClient.setQueryData(queryKey, (old: unknown) => revealPendingFeedbackInCache(old, entityId))
    }
}

export function getNextOptimisticSortOrderFromQueries<T extends { sortOrder?: number | null }>(
    queryClient: QueryClient,
    queryKeyPrefix: QueryKey,
    startAt = 1
): number {
    const queryEntries = queryClient.getQueriesData<unknown>({ queryKey: queryKeyPrefix })
    const entities: T[] = []

    for (const [, entry] of queryEntries) {
        if (!entry || typeof entry !== 'object') continue

        if (Array.isArray((entry as ListCache<T>).items)) {
            entities.push(...(((entry as ListCache<T>).items ?? []) as T[]))
            continue
        }

        if (Array.isArray((entry as RowsListCache<T>).rows)) {
            entities.push(...(((entry as RowsListCache<T>).rows ?? []) as T[]))
        }
    }

    return getNextOptimisticSortOrder(entities, startAt)
}

export interface ConfirmOptimisticUpdateOptions {
    serverEntity?: Record<string, unknown> | null
    moveToFront?: boolean
}

export function confirmOptimisticUpdate(
    queryClient: QueryClient,
    queryKeyPrefix: QueryKey,
    entityId: string,
    options?: ConfirmOptimisticUpdateOptions
): void {
    const serverEntity = options?.serverEntity
    const moveToFront = options?.moveToFront ?? false

    void queryClient.cancelQueries({ queryKey: queryKeyPrefix })

    queryClient.setQueriesData<ListCache | RowsListCache>({ queryKey: queryKeyPrefix }, (old) => {
        if (!old) return old

        const merge = (item: Record<string, unknown>) =>
            item.id === entityId
                ? {
                      ...item,
                      ...(serverEntity ?? {}),
                      __pending: undefined,
                      __pendingAction: undefined,
                      __pendingFeedbackVisible: undefined
                  }
                : item

        if (hasItemsCollection(old)) {
            let result: ListCache
            if (moveToFront) {
                const target = old.items.find((i) => i.id === entityId)
                if (target) {
                    const merged = merge(target)
                    result = { ...old, items: [merged, ...old.items.filter((i) => i.id !== entityId)] }
                } else {
                    result = { ...old, items: old.items.map(merge) }
                }
            } else {
                result = { ...old, items: old.items.map(merge) }
            }
            return result
        }
        if (hasRowsCollection(old)) {
            if (moveToFront) {
                const target = old.rows.find((r) => r.id === entityId)
                if (target) {
                    const merged = merge(target)
                    return { ...old, rows: [merged, ...old.rows.filter((r) => r.id !== entityId)] }
                }
            }
            return { ...old, rows: old.rows.map(merge) }
        }
        return old
    })
}

export interface ConfirmOptimisticCreateOptions {
    serverEntity?: Record<string, unknown>
    insertPosition?: 'prepend' | 'append'
}

export function confirmOptimisticCreate(
    queryClient: QueryClient,
    queryKeyPrefix: QueryKey,
    optimisticId: string,
    realId: string,
    options?: ConfirmOptimisticCreateOptions
): void {
    void queryClient.cancelQueries({ queryKey: queryKeyPrefix })

    queryClient.setQueriesData<ListCache | RowsListCache>({ queryKey: queryKeyPrefix }, (old) => {
        if (!old) return old

        if (hasItemsCollection(old)) {
            const newItems = replaceOptimisticEntity(old.items, optimisticId, realId)
            const entityPresent = newItems.some((item) => item.id === realId)

            if (!entityPresent && options?.serverEntity) {
                const entity = { ...options.serverEntity, id: realId } as Record<string, unknown>
                const pos = options.insertPosition ?? 'prepend'
                return {
                    ...old,
                    items: pos === 'prepend' ? [entity, ...newItems] : [...newItems, entity],
                    pagination: updatePaginationTotal(old.pagination, 1)
                }
            }

            return { ...old, items: newItems }
        }

        if (hasRowsCollection(old)) {
            const newRows = replaceOptimisticEntity(old.rows, optimisticId, realId)
            const entityPresent = newRows.some((row) => row.id === realId)

            if (!entityPresent && options?.serverEntity) {
                const entity = { ...options.serverEntity, id: realId } as Record<string, unknown>
                const pos = options.insertPosition ?? 'prepend'
                return {
                    ...old,
                    rows: pos === 'prepend' ? [entity, ...newRows] : [...newRows, entity],
                    pagination: updatePaginationTotal(old.pagination, 1)
                }
            }

            return { ...old, rows: newRows }
        }
        return old
    })
}

export function safeInvalidateQueries(queryClient: QueryClient, mutationKeyDomain: QueryKey, ...queryKeysToInvalidate: QueryKey[]): void {
    const pendingCount = queryClient.isMutating({ mutationKey: mutationKeyDomain })
    if (pendingCount <= 1) {
        for (const queryKey of queryKeysToInvalidate) {
            queryClient.invalidateQueries({ queryKey })
        }
    }
}

export function safeInvalidateQueriesInactive(
    queryClient: QueryClient,
    mutationKeyDomain: QueryKey,
    ...queryKeysToInvalidate: QueryKey[]
): void {
    const pendingCount = queryClient.isMutating({ mutationKey: mutationKeyDomain })
    if (pendingCount <= 1) {
        for (const queryKey of queryKeysToInvalidate) {
            queryClient.invalidateQueries({ queryKey, refetchType: 'inactive' })
        }
    }
}
