/**
 * Universo Platformo | Metahubs Settings Hooks
 *
 * TanStack Query v5 hooks for fetching and mutating metahub settings.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { settingsApi } from '../api/settingsApi'
import { metahubsQueryKeys, invalidateSettingsQueries, invalidateTreeEntitiesQueries } from '../../shared/queryKeys'

/**
 * Fetch all settings for the current metahub (merged with defaults).
 * Stale time set to 5 minutes since settings change rarely.
 */
export const useSettings = () => {
    const { metahubId } = useParams<{ metahubId: string }>()

    return useQuery({
        queryKey: metahubsQueryKeys.settingsList(metahubId!),
        queryFn: () => settingsApi.getAll(metahubId!),
        enabled: !!metahubId,
        staleTime: 5 * 60 * 1000
    })
}

/**
 * Bulk update (PUT) settings for the current metahub.
 * Uses the mutation response to update cache immediately (prevents flicker),
 * then invalidates to ensure full consistency.
 */
export const useUpdateSettings = () => {
    const { metahubId } = useParams<{ metahubId: string }>()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (settings: Array<{ key: string; value: Record<string, unknown> }>) => settingsApi.update(metahubId!, settings),
        onSuccess: (data) => {
            // Immediately update cache with server response to prevent flicker
            queryClient.setQueryData(metahubsQueryKeys.settingsList(metahubId!), data)
            // Then invalidate to ensure full consistency on next access
            invalidateSettingsQueries.all(queryClient, metahubId!)
            // Settings may trigger mass hub updates (e.g. reset nesting one-shot action).
            invalidateTreeEntitiesQueries.all(queryClient, metahubId!)
            // Drop hub caches to avoid showing stale parent-child relations while refetch is in flight.
            queryClient.removeQueries({ queryKey: metahubsQueryKeys.treeEntities(metahubId!) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(metahubId!) })
        }
    })
}

/**
 * Reset a single setting to its default value.
 * Invalidates all settings queries on success.
 */
export const useResetSetting = () => {
    const { metahubId } = useParams<{ metahubId: string }>()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (key: string) => settingsApi.resetToDefault(metahubId!, key),
        onSuccess: (_data, key) => {
            // Update cache optimistically: mark the setting as default
            queryClient.setQueryData(
                metahubsQueryKeys.settingsList(metahubId!),
                (old: ReturnType<typeof settingsApi.getAll> extends Promise<infer R> ? R : never) => {
                    if (!old) return old
                    return {
                        ...old,
                        settings: old.settings.map((s: { key: string; isDefault: boolean }) =>
                            s.key === key ? { ...s, isDefault: true } : s
                        )
                    }
                }
            )
            invalidateSettingsQueries.all(queryClient, metahubId!)
            if (key.startsWith('entity.hub.')) {
                invalidateTreeEntitiesQueries.all(queryClient, metahubId!)
                queryClient.removeQueries({ queryKey: metahubsQueryKeys.treeEntities(metahubId!) })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(metahubId!) })
            }
        }
    })
}

/**
 * Helper hook to read the effective value of a specific setting from the
 * already-loaded settings list. Returns `undefined` when data is not yet loaded.
 */
export const useSettingValue = <T = unknown>(key: string): T | undefined => {
    const { data } = useSettings()
    if (!data) return undefined

    const settings = (
        data as {
            settings?: Array<{ key: string; value: Record<string, unknown> }>
        }
    ).settings
    if (!Array.isArray(settings)) return undefined

    const setting = settings.find((s) => s.key === key)
    if (!setting) return undefined

    // Values are wrapped in `{ _value: <actual> }` envelope by the backend
    const raw = setting.value as Record<string, unknown>
    return (raw._value ?? raw) as T
}
