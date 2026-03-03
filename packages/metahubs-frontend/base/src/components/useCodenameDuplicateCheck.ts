/**
 * Universo Platformo | Codename Duplicate Check Hook
 *
 * Reactively checks whether the current codename (and VLC locale variants)
 * conflicts with any existing entity codename. Handles both simple and VLC
 * cross-locale uniqueness checking.
 *
 * When VLC is enabled, ALL codename values across ALL locales of ALL entities
 * are collected into a single flat set — duplicates are detected across
 * locale boundaries (e.g. EN "Nazvanie" conflicts with RU "Nazvanie" of
 * another entity).
 */

import { useMemo } from 'react'
import type { VersionedLocalizedContent } from '@universo/types'
import type { ExistingCodenameEntity } from './ExistingCodenamesContext'

/**
 * Extract all non-empty codename values from an entity, including:
 * - the primary `codename` string
 * - all localized variants from `codenameLocalized.locales`
 *
 * Returns an array of { original, lower } pairs so callers can
 * compare case-insensitively while preserving the original form
 * for display in error messages.
 */
function collectAllCodenameValues(
    codename: string,
    codenameLocalized?: VersionedLocalizedContent<string> | null
): { original: string; lower: string }[] {
    const seen = new Set<string>()
    const values: { original: string; lower: string }[] = []

    const add = (raw: string) => {
        const lower = raw.toLowerCase()
        if (!seen.has(lower)) {
            seen.add(lower)
            values.push({ original: raw, lower })
        }
    }

    if (codename) {
        add(codename)
    }

    if (codenameLocalized?.locales) {
        for (const entry of Object.values(codenameLocalized.locales)) {
            const content = typeof entry?.content === 'string' ? entry.content.trim() : ''
            if (content) {
                add(content)
            }
        }
    }

    return values
}

export interface CodenameDuplicateCheckOptions {
    /** Current plain codename value */
    codename: string
    /** Current VLC codename value (when VLC is enabled) */
    codenameVlc?: VersionedLocalizedContent<string> | null
    /** Whether VLC mode is active */
    localizedEnabled: boolean
    /** List of existing entities to check against */
    existingEntities: ExistingCodenameEntity[]
    /** ID of the entity being edited (excluded from duplicate check). Null/undefined for create mode. */
    editingEntityId?: string | null
}

export interface CodenameDuplicateCheckResult {
    /** Error message for the first duplicate found, or null if no duplicate */
    error: string | null
    /** The specific duplicate codename value found */
    duplicateValue: string | null
}

/**
 * Hook that checks the current codename (+ VLC variants) against existing entities.
 *
 * Returns an error string when a duplicate is detected, null otherwise.
 * The check is case-insensitive and works across VLC locale boundaries.
 */
export function useCodenameDuplicateCheck({
    codename,
    codenameVlc,
    localizedEnabled,
    existingEntities,
    editingEntityId
}: CodenameDuplicateCheckOptions): CodenameDuplicateCheckResult {
    return useMemo(() => {
        // Don't check empty codenames
        if (!codename && (!localizedEnabled || !codenameVlc)) {
            return { error: null, duplicateValue: null }
        }

        // Collect all codename values from the current entity (with original case)
        const currentValues = localizedEnabled
            ? collectAllCodenameValues(codename, codenameVlc)
            : codename
            ? [{ original: codename, lower: codename.toLowerCase() }]
            : []

        if (currentValues.length === 0) {
            return { error: null, duplicateValue: null }
        }

        // Build a flat set of all lowercase codename values from other entities
        const existingValuesSet = new Set<string>()
        for (const entity of existingEntities) {
            // Skip the entity being edited
            if (editingEntityId && entity.id === editingEntityId) continue

            const entityValues = collectAllCodenameValues(entity.codename, entity.codenameLocalized)
            for (const { lower } of entityValues) {
                existingValuesSet.add(lower)
            }
        }

        // Check for intersection — return the original-case value for the error message
        for (const { original, lower } of currentValues) {
            if (existingValuesSet.has(lower)) {
                return { error: 'duplicate', duplicateValue: original }
            }
        }

        return { error: null, duplicateValue: null }
    }, [codename, codenameVlc, localizedEnabled, existingEntities, editingEntityId])
}
