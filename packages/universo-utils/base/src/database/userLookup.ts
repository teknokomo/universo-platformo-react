import type { DataSource } from 'typeorm'

/**
 * Lookup user email from auth.users table by user ID.
 * Used for enriching conflict responses with user email.
 *
 * @param ds - TypeORM DataSource instance
 * @param userId - User ID to lookup
 * @returns User email or null if not found or error occurred
 *
 * @example
 * ```typescript
 * const email = await lookupUserEmail(getDataSource(), conflict.updatedBy)
 * return res.status(409).json({
 *     conflict: { ...conflict, updatedByEmail: email }
 * })
 * ```
 */
export async function lookupUserEmail(
    ds: DataSource,
    userId: string | null | undefined
): Promise<string | null> {
    if (!userId) return null

    try {
        const result = await ds.query(
            'SELECT email FROM auth.users WHERE id = $1',
            [userId]
        )
        return result?.[0]?.email ?? null
    } catch (error) {
        // Log error for debugging but don't block main functionality
        console.error('[lookupUserEmail] Failed to fetch user email:', error)
        return null
    }
}
