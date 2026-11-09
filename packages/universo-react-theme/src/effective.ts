import { themeTokensSchema, type ThemeTokens } from '@universo-react/types'

import { DEFAULT_FILE_PRESET_ID, findFileThemePreset } from './presets'

/**
 * The tokens a layout effectively renders: the applied appearance snapshot
 * when one is persisted, otherwise the built-in universo-default snapshot
 * (TZ §11.4/§15.2 runtime fallback). Display-only — saving always re-resolves
 * server-side (TZ Appendix A #7: the client never merges tokens itself).
 */
export const resolveEffectiveThemeTokens = (appearanceTokens: unknown): ThemeTokens | null => {
    if (appearanceTokens) {
        const parsed = themeTokensSchema.safeParse(appearanceTokens)
        if (parsed.success) return parsed.data
    }
    const builtIn = findFileThemePreset(DEFAULT_FILE_PRESET_ID)
    if (!builtIn) return null
    const parsed = themeTokensSchema.safeParse(builtIn.tokens)
    return parsed.success ? parsed.data : null
}
