/**
 * Universo Platformo | Metahubs Entity Permissions Hook
 *
 * Reads allowCopy / allowDelete settings from the already-loaded settings list
 * to control UI state of copy/delete buttons across entity types.
 */

import { buildEntitySurfaceSettingKey, resolveEntitySurfaceKey, type EntitySettingsScope } from '@universo-react/types'
import { useSettings } from './useSettings'

interface EntityPermissions {
    /** Whether copying is allowed for this entity type */
    allowCopy: boolean
    /** Whether deleting is allowed for this entity type */
    allowDelete: boolean
    /** Whether attaching previously created entities from hub-scoped lists is allowed */
    allowAttachExistingEntities: boolean
    /** Whether nested hubs are allowed (hub parent-child relations) */
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
export const useEntityPermissions = (entityType: EntitySettingsScope | string): EntityPermissions => {
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
    if (!resolvedSurface && !entityType) {
        return {
            allowCopy: false,
            allowDelete: false,
            allowAttachExistingEntities: false,
            allowTreeEntityNesting: false,
            allowHubNesting: false,
            isLoading
        }
    }

    const copyKeys = resolvedSurface
        ? [buildEntitySurfaceSettingKey(resolvedSurface, 'allowCopy')]
        : [`entity.${entityType}.allowCopy`, buildEntitySurfaceSettingKey('objectCollection', 'allowCopy')]
    const deleteKeys = resolvedSurface
        ? [buildEntitySurfaceSettingKey(resolvedSurface, 'allowDelete')]
        : [`entity.${entityType}.allowDelete`, buildEntitySurfaceSettingKey('objectCollection', 'allowDelete')]
    const attachExistingKey = buildEntitySurfaceSettingKey('treeEntity', 'allowAttachExistingEntities')
    const allowNestingKey = buildEntitySurfaceSettingKey('treeEntity', 'allowNesting')

    const copySettings = copyKeys.flatMap((key) => {
        const setting = data.settings.find((s) => s.key === key)
        return setting ? [setting] : []
    })
    const deleteSettings = deleteKeys.flatMap((key) => {
        const setting = data.settings.find((s) => s.key === key)
        return setting ? [setting] : []
    })
    const attachSetting = data.settings.find((s) => s.key === attachExistingKey)
    const allowNestingSetting = data.settings.find((s) => s.key === allowNestingKey)

    // Values are wrapped in `{ _value: <actual> }` envelope by the backend
    const copyValues = copySettings.map((setting) => setting.value as Record<string, unknown>)
    const deleteValues = deleteSettings.map((setting) => setting.value as Record<string, unknown>)
    const attachValue = attachSetting?.value as Record<string, unknown> | undefined
    const allowNestingValue = allowNestingSetting?.value as Record<string, unknown> | undefined

    const allowTreeEntityNesting = allowNestingValue?._value !== false

    return {
        allowCopy: copyValues.every((value) => value._value !== false),
        allowDelete: deleteValues.every((value) => value._value !== false),
        allowAttachExistingEntities: attachValue?._value !== false,
        allowTreeEntityNesting,
        allowHubNesting: allowTreeEntityNesting,
        isLoading
    }
}
