import { MARKETING_SOURCE_CODENAMES } from '@universo-react/types'
import { PUBLIC_MARKETING_ROW_LIMIT } from '../persistence/publicApplicationRuntimeStore'

/**
 * Shared marketing seed guards used by the application sync and the workspace
 * seed paths. Published marketing content is read back through the anonymous
 * public runtime, which caps each object and requires unique semantic keys, so
 * both write paths fail closed at seed time instead of breaking the page later.
 */
export const assertMarketingSeedRows = (params: {
    objectCodename: string
    rows: readonly unknown[]
    uniqueFieldCodenames: readonly string[]
}): void => {
    if (params.rows.length > PUBLIC_MARKETING_ROW_LIMIT) {
        throw new Error(
            `Published marketing object ${params.objectCodename} exceeds the public runtime row limit (${PUBLIC_MARKETING_ROW_LIMIT}); reduce the records or split the collection`
        )
    }
    if (params.uniqueFieldCodenames.length === 0) return
    const seen = new Map<string, string>()
    for (const [index, row] of params.rows.entries()) {
        const data = (row && typeof row === 'object' ? (row as { data?: Record<string, unknown> }).data : undefined) ?? {}
        for (const codename of params.uniqueFieldCodenames) {
            const value = data[codename]
            if (typeof value !== 'string' || value.trim().length === 0) continue
            // Compare case-insensitively/trimmed: the public serializer
            // normalizes semantic keys, so case-only collisions still break it.
            const compositeKey = `${codename}\u0000${value.trim().toLowerCase()}`
            if (seen.has(compositeKey)) {
                throw new Error(
                    `Snapshot predefined elements contain a duplicate unique key "${value}" for ${codename} in ${params.objectCodename}; resolve the duplicate before publishing`
                )
            }
            seen.set(compositeKey, String(index))
        }
    }
}

export const isMarketingSeedObject = (codename: string): boolean => (MARKETING_SOURCE_CODENAMES as readonly string[]).includes(codename)
