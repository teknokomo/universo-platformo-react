import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/apiClient'

/**
 * Universo Platformo | Theme-presets feature flag (TZ §15.4)
 *
 * The server exposes the feature toggle through GET /auth/permissions as
 * `themePresets.themePresetsEnabled`. The flag is resolved once per session
 * (staleTime Infinity) so theme authoring surfaces stay hidden until the
 * server confirms the feature, and never hit 404 theme-preset routes when the
 * feature is disabled.
 */

/** Query key for the theme-presets feature flag exposed through /auth/permissions. */
export const THEME_PRESETS_FLAG_QUERY_KEY = ['auth', 'permissions', 'themePresets'] as const

/** Server feature flag payload from GET /auth/permissions. */
interface AuthPermissionsFlagPayload {
    themePresets?: { themePresetsEnabled?: boolean }
}

/** Resolve the theme-presets feature flag from GET /auth/permissions (`themePresets.themePresetsEnabled`). */
export const fetchThemePresetsFlag = async (): Promise<boolean> => {
    const response = await apiClient.get<AuthPermissionsFlagPayload>('/auth/permissions')
    return response.data?.themePresets?.themePresetsEnabled === true
}

/**
 * Server-side theme-presets feature flag. `undefined` while loading or when
 * the flag endpoint fails, so callers hide theme authoring until confirmed
 * enabled.
 */
export function useThemePresetsFlag() {
    return useQuery({
        queryKey: THEME_PRESETS_FLAG_QUERY_KEY,
        queryFn: fetchThemePresetsFlag,
        staleTime: Infinity
    })
}

export default useThemePresetsFlag
