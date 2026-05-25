/**
 * Convert PostgreSQL $1, $2, ... placeholders to Knex ? format.
 * Handles repeated parameter references (e.g., $6, $6 → ?, ? with duplicated binding).
 * Handles casts (e.g., $1::text → ?::text).
 *
 * NOTE: The regex does NOT skip dollar-quoted strings ($$...$$).
 * This is safe in practice because dollar-quoted SQL only appears in migration
 * definitions which have no params (bindings=[]), so the converter is bypassed.
 */
export function convertPgBindings(sql: string, params?: unknown[]): { sql: string; bindings: unknown[] } {
    if (!params?.length) return { sql, bindings: [] }

    const hasDollarN = /\$(\d+)/.test(sql)
    const hasQuestionMark = sql.includes('?')

    // Guard: mixed placeholders are never valid
    if (hasDollarN && hasQuestionMark) {
        throw new Error('Mixed ?/$N placeholders in a single SQL statement are not supported')
    }

    // Pure ? SQL — pass params through unchanged (e.g., locking.ts style)
    if (!hasDollarN) {
        return { sql, bindings: [...params] }
    }

    // $N conversion path
    const bindings: unknown[] = []
    const convertedSql = sql.replace(/\$(\d+)/g, (_match, numStr: string) => {
        const paramIndex = parseInt(numStr, 10) - 1
        if (paramIndex < 0 || paramIndex >= params.length) {
            throw new Error(`Binding $${numStr} references index ${paramIndex} but only ${params.length} params provided`)
        }
        bindings.push(params[paramIndex])
        return '?'
    })

    return { sql: convertedSql, bindings }
}
