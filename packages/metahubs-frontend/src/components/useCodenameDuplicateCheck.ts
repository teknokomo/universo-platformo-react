/**
 * Universo Platformo | Codename Duplicate Check Hook
 *
 * Reactively checks whether the current canonical primary codename conflicts
 * with any existing entity primary codename. Non-primary localized aliases are
 * preserved for editing, but they are not part of the v1 hard uniqueness rule.
 */

import { useMemo } from 'react'
import type { VersionedLocalizedContent } from '@universo/types'
import { getCodenamePrimary } from '@universo/utils'
import type { ExistingCodenameEntity } from './ExistingCodenamesContext'
import { ensureEntityCodenameContent } from '../utils/localizedInput'

const getCanonicalCodenameValue = (codename: VersionedLocalizedContent<string> | null): { original: string; lower: string } | null => {
    const primary = getCodenamePrimary(codename).trim()
    if (!primary) {
        return null
    }

    return {
        original: primary,
        lower: primary.toLowerCase()
    }
}

export interface CodenameDuplicateCheckOptions {
    /** Current VLC codename value */
    codename: VersionedLocalizedContent<string> | null
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
 * Hook that checks the current canonical primary codename against existing entities.
 *
 * Returns an error string when a duplicate is detected, null otherwise.
 * The check is case-insensitive and intentionally follows the backend primary-only contract.
 */
export function useCodenameDuplicateCheck({
    codename,
    existingEntities,
    editingEntityId
}: CodenameDuplicateCheckOptions): CodenameDuplicateCheckResult {
    return useMemo(() => {
        // Don't check empty codenames
        if (!codename) {
            return { error: null, duplicateValue: null }
        }

        const currentValue = getCanonicalCodenameValue(ensureEntityCodenameContent({ codename }, 'en', ''))

        if (!currentValue) {
            return { error: null, duplicateValue: null }
        }

        const existingValuesSet = new Set<string>()
        for (const entity of existingEntities) {
            if (editingEntityId && entity.id === editingEntityId) continue

            const entityValue = getCanonicalCodenameValue(ensureEntityCodenameContent(entity, 'en', entity.codename))
            if (entityValue) {
                existingValuesSet.add(entityValue.lower)
            }
        }

        if (existingValuesSet.has(currentValue.lower)) {
            return { error: 'duplicate', duplicateValue: currentValue.original }
        }

        return { error: null, duplicateValue: null }
    }, [codename, existingEntities, editingEntityId])
}
