import { createHash } from 'node:crypto'

import { mergeThemeTokens } from './merge'

import {
    serializedJsonByteSize,
    themeTokensSchema,
    THEME_RESOLVED_MAX_BYTES,
    type ThemeOverrides,
    type ThemePresetRef,
    type ThemeResolved,
    type ThemeTokens
} from '@universo-react/types'
import { serialization } from '@universo-react/utils'

/**
 * Server-side theme resolution (TZ Appendix A #7): deep-merge preset tokens
 * with sparse layout overrides and materialize a canonical hash. Node-only —
 * imported through the `@universo-react/theme/resolve` subpath so browser
 * bundles never pull `node:crypto`.
 */

export interface ResolveThemeTokensInput {
    preset: Pick<ThemePresetRef, 'source' | 'id' | 'version'>
    /** Validated preset tokens (file registry or DB store). */
    presetTokens: ThemeTokens
    /** Validated sparse layout overrides. */
    overrides: ThemeOverrides
}

export class ThemeAppearanceResolveError extends Error {
    readonly code = 'THEME_APPEARANCE_RESOLVE_FAILED'
    constructor(message: string, readonly details?: unknown) {
        super(message)
        this.name = 'ThemeAppearanceResolveError'
    }
}

/**
 * Merge preset tokens with layout overrides and re-validate the result. The
 * merged object can never contain a key the token schema rejects, so the
 * resolved snapshot is always renderable and cacheable.
 */
export const resolveThemeTokens = ({ preset, presetTokens, overrides }: ResolveThemeTokensInput): { tokens: ThemeTokens; hash: string } => {
    let tokens: ThemeTokens
    try {
        tokens = mergeThemeTokens(presetTokens, overrides)
    } catch (error) {
        throw new ThemeAppearanceResolveError(
            'Resolved theme tokens failed validation.',
            error instanceof Error ? { message: error.message } : undefined
        )
    }
    const canonical = serialization.stableStringify({
        preset: { source: preset.source, id: preset.id, version: preset.version },
        overrides,
        tokens
    })
    if (serializedJsonByteSize(tokens) > THEME_RESOLVED_MAX_BYTES) {
        throw new ThemeAppearanceResolveError('Resolved theme tokens exceed the 64 KiB limit.')
    }
    const hash = `sha256:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`
    return { tokens, hash }
}

/** Materialize the full `resolved` snapshot stored inside a layout config. */
export const resolveThemeAppearance = (input: ResolveThemeTokensInput): ThemeResolved => {
    const { tokens, hash } = resolveThemeTokens(input)
    return { hash, tokens }
}
