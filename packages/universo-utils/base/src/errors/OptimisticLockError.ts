/**
 * Information about a version conflict during optimistic locking.
 */
export interface ConflictInfo {
    /** ID of the entity that was modified */
    entityId: string
    /** Type of entity */
    entityType: 'metahub' | 'branch' | 'publication' | 'hub' | 'catalog' | 'attribute' | 'element' | 'layout' | 'application' | 'connector'
    /** Version the client expected */
    expectedVersion: number
    /** Actual current version in the database */
    actualVersion: number
    /** When the entity was last updated */
    updatedAt: Date
    /** User ID who last updated the entity (null if unknown) */
    updatedBy: string | null
    /** Email of the user who last updated (optional, populated by route handlers) */
    updatedByEmail?: string | null
}

/**
 * Error thrown when an optimistic locking conflict is detected.
 *
 * This occurs when a user tries to save changes to an entity that was
 * modified by another user since the data was loaded.
 *
 * @example
 * ```typescript
 * try {
 *     await updateCatalog(id, data, { expectedVersion: 1 })
 * } catch (error) {
 *     if (error instanceof OptimisticLockError) {
 *         // Show conflict resolution dialog
 *         console.log(`Entity was modified by ${error.conflict.updatedBy}`)
 *     }
 * }
 * ```
 */
export class OptimisticLockError extends Error {
    public readonly code = 'OPTIMISTIC_LOCK_CONFLICT' as const
    public readonly conflict: ConflictInfo

    constructor(conflict: ConflictInfo) {
        super(`Optimistic lock conflict: entity ${conflict.entityId} was modified by another user`)
        this.name = 'OptimisticLockError'
        this.conflict = conflict

        // Maintains proper stack trace for where error was thrown (V8 engines)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, OptimisticLockError)
        }
    }

    /**
     * Create an OptimisticLockError from an API response.
     */
    static fromResponse(response: {
        conflict: ConflictInfo
    }): OptimisticLockError {
        return new OptimisticLockError({
            ...response.conflict,
            updatedAt: new Date(response.conflict.updatedAt)
        })
    }
}
