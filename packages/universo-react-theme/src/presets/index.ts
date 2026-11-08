import { themeFilePresetEnvelopeSchema, type ThemeFilePreset } from '@universo-react/types'

import universoDefaultJson from './universo-default.theme.json'

/**
 * Build-validated file-preset registry (TZ FR-036): every preset is parsed
 * against the shared envelope schema at module init and codenames must be
 * unique — a duplicate or invalid file fails the build/boot.
 */
const FILE_PRESET_SOURCES: readonly unknown[] = [universoDefaultJson]

const parseFilePresets = (): readonly ThemeFilePreset[] => {
    const seen = new Set<string>()
    return FILE_PRESET_SOURCES.map((source) => {
        const preset = themeFilePresetEnvelopeSchema.parse(source)
        if (seen.has(preset.id)) {
            throw new Error(`Duplicate file theme preset codename: ${preset.id}`)
        }
        seen.add(preset.id)
        return preset
    }).sort((first, second) => first.id.localeCompare(second.id))
}

export const fileThemePresets: readonly ThemeFilePreset[] = parseFilePresets()

export const DEFAULT_FILE_PRESET_ID = 'universo-default'

export const findFileThemePreset = (id: string): ThemeFilePreset | undefined => fileThemePresets.find((preset) => preset.id === id)

export const isFileThemePresetCodename = (codename: string): boolean => fileThemePresets.some((preset) => preset.id === codename)
