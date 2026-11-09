/**
 * Browser-safe entry: file-preset registry, contrast/size helpers, and the
 * MUI adapter. The Node-only resolver lives behind the `./resolve` subpath so
 * browser bundles never pull `node:crypto`.
 */
export { DEFAULT_FILE_PRESET_ID, fileThemePresets, findFileThemePreset, isFileThemePresetCodename } from './presets'
export { resolveEffectiveThemeTokens } from './effective'
export { assertThemeTokensWithinLimit, ThemePresetSizeLimitError } from './validate'
export { mergeThemeTokens } from './merge'
export { themeTokensToMuiInput } from './adapter'
export type { ThemeMuiInput, ThemeMuiPaletteScheme } from './adapter'
