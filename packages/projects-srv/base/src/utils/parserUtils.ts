/**
 * Parser utilities for request parameter validation
 */

/**
 * Safely parse integer from query parameter with bounds checking
 * @param value - Query parameter value (can be string, number, or undefined)
 * @param defaultValue - Default value if parsing fails
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Parsed integer clamped to [min, max] range
 *
 * @example
 * const limit = parseIntSafe(req.query.limit, 100, 1, 1000)
 * // Returns: 100 if undefined, or clamped value between 1 and 1000
 */
export function parseIntSafe(value: any, defaultValue: number, min: number, max: number): number {
    const parsed = parseInt(String(value || ''), 10)
    if (!Number.isFinite(parsed)) return defaultValue
    return Math.max(min, Math.min(max, parsed))
}

/**
 * Escape SQL LIKE wildcard characters to prevent injection
 * Escapes % and _ characters that have special meaning in LIKE patterns
 *
 * @param value - Raw search string from user input
 * @returns Escaped string safe for use in LIKE queries
 *
 * @example
 * const search = escapeLikeWildcards(req.query.search)
 * // Input: "test_data%"  → Output: "test\\_data\\%"
 * qb.andWhere('LOWER(name) LIKE :search', { search: `%${search}%` })
 */
export function escapeLikeWildcards(value: string): string {
    return value.replace(/[%_]/g, '\\$&')
}
