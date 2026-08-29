/**
 * Normalize arbitrary JS values for PostgreSQL JSONB columns.
 *
 * PostgreSQL expects valid JSON tokens for JSONB input.
 * Plain objects can be passed directly, while arrays and primitive scalars
 * must be serialized to valid JSON text. The pg driver formats arrays as
 * PostgreSQL array literals (for example `{value}`), which are not valid
 * JSON tokens for JSONB columns.
 */
export const toJsonbValue = (value: unknown): unknown => {
    if (value === undefined || value === null) {
        return null
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
        return value
    }
    return JSON.stringify(value)
}
