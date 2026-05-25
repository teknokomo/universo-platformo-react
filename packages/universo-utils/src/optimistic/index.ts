// Optimistic update utilities — re-exports
export {
    isPendingEntity,
    getPendingAction,
    isPendingInteractionBlocked,
    shouldShowPendingFeedback,
    makePendingMarkers,
    revealPendingFeedback,
    getNextOptimisticSortOrder,
    stripPendingMarkers
} from './pendingState'

export type { PendingAction, PendingMarkers, MaybePending, SortOrderLike } from './pendingState'
