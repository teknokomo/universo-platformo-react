import type { QueryClient, QueryKey } from '@tanstack/react-query'
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
    pagination?: {
        total?: number
        [k: string]: unknown
    }
    [key: string]: unknown
}
export type RowsListCache<T = Record<string, unknown>> = {
    rows?: T[]
    pagination?: {
        total?: number
        [k: string]: unknown
    }
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
export declare function generateOptimisticId(): string
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
export declare function applyOptimisticCreate<
    T extends {
        id: string
    }
>(options: ApplyOptimisticCreateOptions<T>): Promise<OptimisticCreateContext>
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
export declare function applyOptimisticUpdate<
    T extends {
        id: string
    }
>(options: ApplyOptimisticUpdateOptions<T>): Promise<OptimisticUpdateContext>
export interface ApplyOptimisticDeleteOptions {
    queryClient: QueryClient
    queryKeyPrefix: QueryKey
    entityId: string
    strategy?: 'remove' | 'fade'
}
export declare function applyOptimisticDelete<
    T extends {
        id: string
    }
>(options: ApplyOptimisticDeleteOptions): Promise<OptimisticDeleteContext>
export declare function rollbackOptimisticSnapshots(queryClient: QueryClient, snapshots?: OptimisticSnapshot): void
export declare function cleanupBreadcrumbCache(queryClient: QueryClient, breadcrumbQueryKey: QueryKey): void
export interface RevealPendingEntityFeedbackOptions {
    queryClient: QueryClient
    queryKeyPrefix: QueryKey
    entityId: string
    extraQueryKeys?: QueryKey[]
}
export declare function revealPendingEntityFeedback(options: RevealPendingEntityFeedbackOptions): void
export declare function getNextOptimisticSortOrderFromQueries<
    T extends {
        sortOrder?: number | null
    }
>(queryClient: QueryClient, queryKeyPrefix: QueryKey, startAt?: number): number
export interface ConfirmOptimisticUpdateOptions {
    serverEntity?: Record<string, unknown> | null
    moveToFront?: boolean
}
export declare function confirmOptimisticUpdate(
    queryClient: QueryClient,
    queryKeyPrefix: QueryKey,
    entityId: string,
    options?: ConfirmOptimisticUpdateOptions
): void
export interface ConfirmOptimisticCreateOptions {
    serverEntity?: Record<string, unknown>
    insertPosition?: 'prepend' | 'append'
}
export declare function confirmOptimisticCreate(
    queryClient: QueryClient,
    queryKeyPrefix: QueryKey,
    optimisticId: string,
    realId: string,
    options?: ConfirmOptimisticCreateOptions
): void
export declare function safeInvalidateQueries(
    queryClient: QueryClient,
    mutationKeyDomain: QueryKey,
    ...queryKeysToInvalidate: QueryKey[]
): void
export declare function safeInvalidateQueriesInactive(
    queryClient: QueryClient,
    mutationKeyDomain: QueryKey,
    ...queryKeysToInvalidate: QueryKey[]
): void
//# sourceMappingURL=optimisticCrud.d.ts.map
