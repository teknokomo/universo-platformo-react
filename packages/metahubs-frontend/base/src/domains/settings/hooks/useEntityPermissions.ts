/**
 * Universo Platformo | Metahubs Entity Permissions Hook
 *
 * Reads allowCopy / allowDelete settings from the already-loaded settings list
 * to control UI state of copy/delete buttons across entity types.
 */

import { useSettings } from './useSettings'

type EntityType = 'hubs' | 'catalogs' | 'enumerations'

interface EntityPermissions {
    /** Whether copying is allowed for this entity type */
    allowCopy: boolean
    /** Whether deleting is allowed for this entity type */
    allowDelete: boolean
    /** Whether settings data is still loading */
    isLoading: boolean
}

/**
 * Hook to check entity-level permissions (allowCopy / allowDelete)
 * based on metahub settings.
 *
 * Returns `{ allowCopy: true, allowDelete: true }` by default (while loading
 * or when settings are absent) to avoid blocking the UI unnecessarily.
 *
 * @param entityType - The entity type to check ('hubs' | 'catalogs' | 'enumerations')
 */
export const useEntityPermissions = (entityType: EntityType): EntityPermissions => {
    const { data, isLoading } = useSettings()

    if (!data) {
        return { allowCopy: true, allowDelete: true, isLoading }
    }

    const copyKey = `${entityType}.allowCopy`
    const deleteKey = `${entityType}.allowDelete`

    const copySetting = data.settings.find((s) => s.key === copyKey)
    const deleteSetting = data.settings.find((s) => s.key === deleteKey)

    // Values are wrapped in `{ _value: <actual> }` envelope by the backend
    const copyValue = copySetting?.value as Record<string, unknown> | undefined
    const deleteValue = deleteSetting?.value as Record<string, unknown> | undefined

    return {
        allowCopy: copyValue?._value !== false,
        allowDelete: deleteValue?._value !== false,
        isLoading
    }
}
