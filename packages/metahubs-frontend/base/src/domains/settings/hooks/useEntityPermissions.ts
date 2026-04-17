/**
 * Universo Platformo | Metahubs Entity Permissions Hook
 *
 * Reads allowCopy / allowDelete settings from the already-loaded settings list
 * to control UI state of copy/delete buttons across entity types.
 */

import { buildEntitySurfaceSettingKey, resolveEntitySurfaceKey, type EntitySettingsScope } from '@universo/types'
import { useSettings } from './useSettings'

interface EntityPermissions {
    /** Whether copying is allowed for this entity type */
    allowCopy: boolean
    /** Whether deleting is allowed for this entity type */
    allowDelete: boolean
    /** Whether attaching previously created entities from hub-scoped lists is allowed */
    allowAttachExistingEntities: boolean
    /** Whether nested treeEntities are allowed (tree entity parent-child relations) */
    allowTreeEntityNesting: boolean
    /** Backward-compatible alias for tree nesting checks */
    allowHubNesting: boolean
    /** Whether settings data is still loading */
    isLoading: boolean
}

/**
 * Hook to check entity-level permissions (allowCopy / allowDelete)
 * based on metahub settings.
 *
 * Returns a fail-closed result while settings are loading or absent so action
 * menus never expose copy/delete affordances before the effective policy is known.
 *
 * @param entityType - Builtin kind or neutral entity surface alias for the settings scope
 */
export const useEntityPermissions = (entityType: EntitySettingsScope): EntityPermissions => {
    const { data, isLoading } = useSettings()

    if (!data) {
        return {
            allowCopy: false,
            allowDelete: false,
            allowAttachExistingEntities: false,
            allowTreeEntityNesting: false,
            allowHubNesting: false,
            isLoading
        }
    }

    const resolvedSurface = resolveEntitySurfaceKey(entityType)
    if (!resolvedSurface) {
        return {
            allowCopy: false,
            allowDelete: false,
            allowAttachExistingEntities: false,
            allowTreeEntityNesting: false,
            allowHubNesting: false,
            isLoading
        }
    }

    const copyKey = buildEntitySurfaceSettingKey(resolvedSurface, 'allowCopy')
    const deleteKey = buildEntitySurfaceSettingKey(resolvedSurface, 'allowDelete')
    const attachExistingKey = buildEntitySurfaceSettingKey('treeEntity', 'allowAttachExistingEntities')
    const allowNestingKey = buildEntitySurfaceSettingKey('treeEntity', 'allowNesting')

    const copySetting = data.settings.find((s) => s.key === copyKey)
    const deleteSetting = data.settings.find((s) => s.key === deleteKey)
    const attachSetting = data.settings.find((s) => s.key === attachExistingKey)
    const allowNestingSetting = data.settings.find((s) => s.key === allowNestingKey)

    // Values are wrapped in `{ _value: <actual> }` envelope by the backend
    const copyValue = copySetting?.value as Record<string, unknown> | undefined
    const deleteValue = deleteSetting?.value as Record<string, unknown> | undefined
    const attachValue = attachSetting?.value as Record<string, unknown> | undefined
    const allowNestingValue = allowNestingSetting?.value as Record<string, unknown> | undefined

    const allowTreeEntityNesting = allowNestingValue?._value !== false

    return {
        allowCopy: copyValue?._value !== false,
        allowDelete: deleteValue?._value !== false,
        allowAttachExistingEntities: attachValue?._value !== false,
        allowTreeEntityNesting,
        allowHubNesting: allowTreeEntityNesting,
        isLoading
    }
}
