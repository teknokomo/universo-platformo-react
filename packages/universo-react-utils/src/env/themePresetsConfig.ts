// Universo Platformo | Theme presets feature flag (TZ §15.4)
// Controls registration of the theme-presets API routes in both backends and
// the appearance authoring UI via the /auth/permissions config payload. The
// flag is a rollback mechanism, not a staged-rollout gate: preset tables ship
// regardless, and the runtime read path stays ungated (research F8).

/**
 * Parse boolean from environment variable value
 * @param value - Environment variable value
 * @param defaultValue - Default if value is undefined/empty
 */
const parseEnvBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
    if (value === undefined || value === '') {
        return defaultValue
    }
    return value.toLowerCase() === 'true' || value === '1'
}

/**
 * Get THEME_PRESETS_ENABLED environment variable
 * Controls the theme-presets API surface and authoring UI
 * @returns true if theme presets are enabled (default: true)
 */
export const isThemePresetsEnabled = (): boolean => {
    const value = typeof process !== 'undefined' ? process.env.THEME_PRESETS_ENABLED : undefined
    return parseEnvBoolean(value, true)
}

/** Server-controlled feature payload shared through /auth/permissions. */
export const getThemePresetsConfig = (): { themePresetsEnabled: boolean } => ({
    themePresetsEnabled: isThemePresetsEnabled()
})
