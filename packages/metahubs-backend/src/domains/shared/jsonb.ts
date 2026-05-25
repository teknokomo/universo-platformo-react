/**
 * Normalize arbitrary JS values for PostgreSQL JSONB columns.
 *
 * PostgreSQL expects valid JSON tokens for JSONB input.
 * Objects/arrays can be passed directly, while primitive scalars
 * must be serialized to valid JSON text.
 */
export const toJsonbValue = (value: unknown): unknown => {
    if (value === undefined || value === null) {
        return null
    }
    if (typeof value === 'object') {
        return value
    }
    return JSON.stringify(value)
}
