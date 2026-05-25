/**
 * Pending state markers for optimistically-inserted entities.
 * These markers are ephemeral — they only exist in the React Query cache
 * and disappear on page reload (server never returns them).
 *
 * Pure TypeScript module with zero React/Query dependencies.
 * Safe to import from any package in the monorepo.
 */

export type PendingAction = 'create' | 'update' | 'delete' | 'copy'

export interface PendingMarkers {
    readonly __pending: true
    readonly __pendingAction: PendingAction
    readonly __pendingFeedbackVisible?: true
}

export interface MaybePending {
    __pending?: boolean
    __pendingAction?: PendingAction
    __pendingFeedbackVisible?: boolean
}

/** Type guard: is this entity pending (not yet server-confirmed)? */
export function isPendingEntity(item: unknown): item is MaybePending & { __pending: true } {
    return Boolean(item && typeof item === 'object' && (item as MaybePending).__pending)
}

/** Get pending action or undefined */
export function getPendingAction(item: unknown): PendingAction | undefined {
    if (!isPendingEntity(item)) return undefined
    return (item as MaybePending).__pendingAction
}

/** Returns true when the entity is an optimistic create/copy that should not be opened yet. */
export function isPendingInteractionBlocked(item: unknown): item is MaybePending & { __pending: true } {
    const pendingAction = getPendingAction(item)
    return pendingAction === 'create' || pendingAction === 'copy'
}

/** Returns true when pending visuals should be shown to the user. */
export function shouldShowPendingFeedback(item: unknown): boolean {
    if (!isPendingEntity(item)) return false
    const pendingAction = getPendingAction(item)
    if (pendingAction === 'create' || pendingAction === 'copy') {
        return Boolean((item as MaybePending).__pendingFeedbackVisible)
    }
    return true
}

/** Create pending markers object */
export function makePendingMarkers(action: PendingAction, options?: { feedbackVisible?: boolean }): PendingMarkers {
    return {
        __pending: true,
        __pendingAction: action,
        ...(options?.feedbackVisible ? { __pendingFeedbackVisible: true } : {})
    } as const
}

/** Reveal deferred pending feedback for an optimistic create/copy entity after premature interaction. */
export function revealPendingFeedback<T extends MaybePending>(item: T): T {
    if (!isPendingInteractionBlocked(item) || item.__pendingFeedbackVisible) return item
    return { ...item, __pendingFeedbackVisible: true }
}

export interface SortOrderLike {
    sortOrder?: number | null
}

/** Compute the next optimistic sort order from the current collection, starting from 1. */
export function getNextOptimisticSortOrder(items: Iterable<SortOrderLike> | null | undefined, startAt = 1): number {
    let maxSortOrder = startAt - 1
    if (!items) return startAt

    for (const item of items) {
        const sortOrder = item?.sortOrder
        if (typeof sortOrder === 'number' && Number.isFinite(sortOrder)) {
            maxSortOrder = Math.max(maxSortOrder, sortOrder)
        }
    }

    return maxSortOrder + 1
}

/** Strip pending markers from an entity (for comparison/serialization) */
export function stripPendingMarkers<T extends MaybePending>(
    item: T
): Omit<T, '__pending' | '__pendingAction' | '__pendingFeedbackVisible'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { __pending, __pendingAction, __pendingFeedbackVisible, ...rest } = item
    return rest as Omit<T, '__pending' | '__pendingAction' | '__pendingFeedbackVisible'>
}
