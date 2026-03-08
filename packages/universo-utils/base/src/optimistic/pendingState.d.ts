/**
 * Pending state markers for optimistically-inserted entities.
 * These markers are ephemeral — they only exist in the React Query cache
 * and disappear on page reload (server never returns them).
 *
 * Pure TypeScript module with zero React/Query dependencies.
 * Safe to import from any package in the monorepo.
 */
export type PendingAction = 'create' | 'update' | 'delete' | 'copy';
export interface PendingMarkers {
    readonly __pending: true;
    readonly __pendingAction: PendingAction;
    readonly __pendingFeedbackVisible?: true;
}
export interface MaybePending {
    __pending?: boolean;
    __pendingAction?: PendingAction;
    __pendingFeedbackVisible?: boolean;
}
/** Type guard: is this entity pending (not yet server-confirmed)? */
export declare function isPendingEntity(item: unknown): item is MaybePending & {
    __pending: true;
};
/** Get pending action or undefined */
export declare function getPendingAction(item: unknown): PendingAction | undefined;
/** Returns true when the entity is an optimistic create/copy that should not be opened yet. */
export declare function isPendingInteractionBlocked(item: unknown): item is MaybePending & {
    __pending: true;
};
/** Returns true when pending visuals should be shown to the user. */
export declare function shouldShowPendingFeedback(item: unknown): boolean;
/** Create pending markers object */
export declare function makePendingMarkers(action: PendingAction, options?: {
    feedbackVisible?: boolean;
}): PendingMarkers;
/** Reveal deferred pending feedback for an optimistic create/copy entity after premature interaction. */
export declare function revealPendingFeedback<T extends MaybePending>(item: T): T;
export interface SortOrderLike {
    sortOrder?: number | null;
}
/** Compute the next optimistic sort order from the current collection, starting from 1. */
export declare function getNextOptimisticSortOrder(items: Iterable<SortOrderLike> | null | undefined, startAt?: number): number;
/** Strip pending markers from an entity (for comparison/serialization) */
export declare function stripPendingMarkers<T extends MaybePending>(item: T): Omit<T, '__pending' | '__pendingAction' | '__pendingFeedbackVisible'>;
//# sourceMappingURL=pendingState.d.ts.map