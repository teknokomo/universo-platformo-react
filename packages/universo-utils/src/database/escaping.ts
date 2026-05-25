/**
 * Database escaping utilities for safe query construction
 */

/**
 * Escape SQL LIKE wildcard characters to prevent injection
 * Escapes % and _ characters that have special meaning in LIKE patterns
 *
 * @param value - Raw search string from user input
 * @returns Escaped string safe for use in LIKE queries
 *
 * @example
 * ```typescript
 * const search = escapeLikeWildcards(req.query.search)
 * // Input: "test_data%"  → Output: "test\\_data\\%"
 * qb.andWhere('LOWER(name) LIKE :search', { search: `%${search}%` })
 * ```
 */
export function escapeLikeWildcards(value: string): string {
    return value.replace(/[%_]/g, '\\$&')
}
