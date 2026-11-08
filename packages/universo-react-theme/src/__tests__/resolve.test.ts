import { describe, expect, it } from 'vitest'

import { themeTokensSchema, type ThemeTokens } from '@universo-react/types'

import { findFileThemePreset } from '../presets'
import { resolveThemeAppearance, resolveThemeTokens, ThemeAppearanceResolveError } from '../resolve'

const presetTokens: ThemeTokens = themeTokensSchema.parse(findFileThemePreset('universo-default')!.tokens)

describe('resolveThemeTokens', () => {
    it('returns the preset tokens unchanged for empty overrides', () => {
        const { tokens, hash } = resolveThemeTokens({
            preset: { source: 'file', id: 'universo-default', version: 1 },
            presetTokens,
            overrides: {}
        })
        expect(tokens).toEqual(presetTokens)
        expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/)
    })

    it('applies sparse overrides and keeps unpreset keys out', () => {
        const { tokens } = resolveThemeTokens({
            preset: { source: 'file', id: 'universo-default', version: 1 },
            presetTokens,
            overrides: { shared: { spacing: { base: 12, density: 'compact' } }, modes: { light: { primary: { main: '#1f6feb' } } } }
        })
        expect(tokens.shared.spacing).toEqual({ base: 12, density: 'compact' })
        expect(tokens.modes.light.primary.main).toBe('#1f6feb')
        expect(tokens.modes.dark.primary.main).toBe(presetTokens.modes.dark.primary.main)
        expect(tokens.modes.light.primary.contrastText).toBe(presetTokens.modes.light.primary.contrastText)
    })

    it('reverts values to the preset on null overrides', () => {
        const first = resolveThemeTokens({
            preset: { source: 'file', id: 'universo-default', version: 1 },
            presetTokens,
            overrides: { modes: { light: { primary: { main: '#1f6feb' } } } }
        })
        const second = resolveThemeTokens({
            preset: { source: 'file', id: 'universo-default', version: 1 },
            presetTokens,
            overrides: { modes: { light: { primary: { main: null } } } }
        })
        expect(second.tokens.modes.light.primary.main).toBe(presetTokens.modes.light.primary.main)
        expect(second.hash).not.toBe(first.hash)
    })

    it('produces stable hashes independent of key order and drops unknown keys', () => {
        const base = {
            preset: { source: 'file' as const, id: 'universo-default', version: 1 },
            presetTokens,
            overrides: { shared: { shape: { borderRadius: 4 } } }
        }
        const first = resolveThemeTokens(base)
        const second = resolveThemeTokens(base)
        expect(first.hash).toBe(second.hash)
        expect((first.tokens as unknown as Record<string, unknown>).injected).toBeUndefined()
    })

    it('rejects forbidden pollution keys even below the schema layer', () => {
        expect(() =>
            resolveThemeTokens({
                preset: { source: 'file', id: 'universo-default', version: 1 },
                presetTokens,
                overrides: JSON.parse('{"__proto__": {"polluted": true}}')
            })
        ).not.toThrow()
        expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    })

    it('throws a typed resolve error for unresolvable input', () => {
        expect(() =>
            resolveThemeAppearance({
                preset: { source: 'file', id: 'universo-default', version: 1 },
                presetTokens: { ...presetTokens, modes: undefined as unknown as ThemeTokens['modes'] },
                overrides: {}
            })
        ).toThrow(ThemeAppearanceResolveError)
    })
})
