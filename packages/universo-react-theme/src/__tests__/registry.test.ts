import { describe, expect, it } from 'vitest'

import { DEFAULT_FILE_PRESET_ID, fileThemePresets, findFileThemePreset, isFileThemePresetCodename } from '../presets'
import { themeTokensSchema } from '@universo-react/types'

describe('file theme preset registry', () => {
    it('ships universo-default as a valid, schema-conformant preset', () => {
        expect(fileThemePresets.length).toBeGreaterThanOrEqual(1)
        const preset = findFileThemePreset(DEFAULT_FILE_PRESET_ID)
        expect(preset).toBeDefined()
        expect(preset?.id).toBe(DEFAULT_FILE_PRESET_ID)
        expect(preset?.version).toBe(1)
        expect(themeTokensSchema.safeParse(preset?.tokens).success).toBe(true)
    })

    it('keeps codenames unique and sorted', () => {
        const codenames = fileThemePresets.map((preset) => preset.id)
        expect(new Set(codenames).size).toBe(codenames.length)
        expect([...codenames]).toEqual([...codenames].sort((first, second) => first.localeCompare(second)))
    })

    it('resolves membership lookups', () => {
        expect(isFileThemePresetCodename(DEFAULT_FILE_PRESET_ID)).toBe(true)
        expect(isFileThemePresetCodename('missing-preset')).toBe(false)
        expect(findFileThemePreset('missing-preset')).toBeUndefined()
    })
})
