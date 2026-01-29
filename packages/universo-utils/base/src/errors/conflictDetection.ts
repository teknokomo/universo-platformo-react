/**
 * Optimistic Lock Conflict Detection Utilities
 *
 * Utilities for detecting and handling 409 Conflict responses
 * from the backend when optimistic locking fails.
 */

import type { ConflictInfo } from './OptimisticLockError'

/**
 * Check if an error is an optimistic lock conflict (409 status with conflict info)
 *
 * @example
 * ```typescript
 * try {
 *     await updateEntity(id, data, { expectedVersion })
 * } catch (error) {
 *     if (isOptimisticLockConflict(error)) {
 *         const conflict = extractConflictInfo(error)
 *         // Show conflict resolution dialog
 *     }
 * }
 * ```
 */
export function isOptimisticLockConflict(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false

    const axiosError = error as { response?: { status?: number; data?: { code?: string } } }
    return (
        axiosError.response?.status === 409 &&
        axiosError.response?.data?.code === 'OPTIMISTIC_LOCK_CONFLICT'
    )
}

/**
 * Extract conflict info from an axios error response.
 * Returns null if the error is not an optimistic lock conflict.
 *
 * @example
 * ```typescript
 * const conflict = extractConflictInfo(error)
 * if (conflict) {
 *     setConflictState({ open: true, conflict, pendingUpdate: { id, patch } })
 * }
 * ```
 */
export function extractConflictInfo(error: unknown): ConflictInfo | null {
    if (!isOptimisticLockConflict(error)) return null

    const axiosError = error as { response?: { data?: { conflict?: ConflictInfo & { updatedByEmail?: string | null } } } }
    const conflict = axiosError.response?.data?.conflict

    if (!conflict) return null

    return {
        entityId: conflict.entityId,
        entityType: conflict.entityType,
        expectedVersion: conflict.expectedVersion,
        actualVersion: conflict.actualVersion,
        updatedAt: conflict.updatedAt,
        updatedBy: conflict.updatedBy,
        updatedByEmail: conflict.updatedByEmail
    }
}

/**
 * Type guard to check if error has axios response structure
 */
export function hasAxiosResponse(error: unknown): error is { response: { status: number; data: unknown } } {
    return (
        error !== null &&
        typeof error === 'object' &&
        'response' in error &&
        error.response !== null &&
        typeof error.response === 'object' &&
        'status' in error.response
    )
}
