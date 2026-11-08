import { serializedJsonByteSize, THEME_PRESET_MAX_BYTES, type ThemeTokens } from '@universo-react/types'

/**
 * Size guards shared by the preset stores and the resolver. The DB CHECK
 * constraints (`pg_column_size(tokens) <= 65536`) remain the authoritative
 * backend boundary; these helpers give the resolver and API layer the same
 * limit client-side.
 */
export class ThemePresetSizeLimitError extends Error {
    readonly code = 'THEME_PRESET_INVALID'
    constructor(message: string) {
        super(message)
        this.name = 'ThemePresetSizeLimitError'
    }
}

export const assertThemeTokensWithinLimit = (tokens: ThemeTokens): void => {
    if (serializedJsonByteSize(tokens) > THEME_PRESET_MAX_BYTES) {
        throw new ThemePresetSizeLimitError('Theme tokens exceed the 64 KiB limit.')
    }
}

export { serializedJsonByteSize, THEME_PRESET_MAX_BYTES }
