import { describe, expect, it } from 'vitest'

import { parseApplicationLayoutConfig } from '../common/applicationLayoutConfig'
import {
    THEME_HASH_REGEX,
    THEME_PRESET_ERROR_CODES,
    serializedJsonByteSize,
    themeAppearanceSchema,
    themeAppearanceDraftSchema,
    themeColorLuminance,
    themeContrastIssues,
    themeContrastRatio,
    themeFilePresetEnvelopeSchema,
    themeHexColorSchema,
    themeOverridesSchema,
    themeTokensSchema
} from '../common/themePreset'

const validModeColors = {
    primary: { main: '#1976d2', contrastText: '#ffffff' },
    secondary: { main: '#00838f', contrastText: '#ffffff' },
    background: { default: '#f7f8fa', paper: '#ffffff' },
    text: { primary: '#1a1a1a', secondary: '#5f6368' },
    divider: '#e0e0e0'
}

const validTokens = {
    shared: {
        typography: { fontFamily: 'inter', baseSize: 16, scale: 1.2, weights: { regular: 400, medium: 500, bold: 700 } },
        spacing: { base: 8, density: 'comfortable' },
        shape: { borderRadius: 8, borderWidth: 1 },
        shadows: { scale: 'default' }
    },
    modes: { light: validModeColors, dark: validModeColors }
} as const

const validResolved = {
    hash: `sha256:${'a'.repeat(64)}`,
    tokens: validTokens
}

describe('theme tokens schema', () => {
    it('accepts a valid token set', () => {
        expect(themeTokensSchema.parse(validTokens)).toMatchObject(validTokens)
    })

    it('rejects out-of-range values', () => {
        expect(
            themeTokensSchema.safeParse({ ...validTokens, shared: { ...validTokens.shared, spacing: { base: 2, density: 'comfortable' } } })
                .success
        ).toBe(false)
        expect(
            themeTokensSchema.safeParse({ ...validTokens, shared: { ...validTokens.shared, shape: { borderRadius: 40, borderWidth: 1 } } })
                .success
        ).toBe(false)
        expect(
            themeTokensSchema.safeParse({
                ...validTokens,
                shared: { ...validTokens.shared, typography: { ...validTokens.shared.typography, baseSize: 22 } }
            }).success
        ).toBe(false)
    })

    it('rejects unknown keys and prototype-pollution keys at every level', () => {
        expect(themeTokensSchema.safeParse({ ...validTokens, injected: 'x' }).success).toBe(false)
        expect(
            themeTokensSchema.safeParse(JSON.parse('{"__proto__": {}, "shared": {"typography": {"fontFamily": "inter"}}}')).success
        ).toBe(false)
        expect(
            themeTokensSchema.safeParse({
                ...validTokens,
                modes: { light: { ...validModeColors, constructor: 'x' }, dark: validModeColors }
            }).success
        ).toBe(false)
    })

    it('rejects FR-017 injection vectors by construction (hex colors and enums only)', () => {
        expect(
            themeTokensSchema.safeParse({
                ...validTokens,
                modes: { light: { ...validModeColors, divider: 'url(javascript:alert(1))' }, dark: validModeColors }
            }).success
        ).toBe(false)
        expect(
            themeTokensSchema.safeParse({
                ...validTokens,
                modes: { light: { ...validModeColors, divider: '@import "x.css"' }, dark: validModeColors }
            }).success
        ).toBe(false)
        expect(
            themeTokensSchema.safeParse({
                ...validTokens,
                modes: { light: { ...validModeColors, divider: 'expression(alert(1))' }, dark: validModeColors }
            }).success
        ).toBe(false)
        expect(themeHexColorSchema.safeParse('#1976d2').success).toBe(true)
        expect(themeHexColorSchema.safeParse('expression(alert(1))').success).toBe(false)
    })
})

describe('theme overrides schema', () => {
    it('accepts sparse overrides and null reverts', () => {
        expect(themeOverridesSchema.safeParse({}).success).toBe(true)
        expect(
            themeOverridesSchema.safeParse({
                shared: { spacing: { base: 10, density: 'compact' } },
                modes: { light: { primary: { main: '#1f6feb' } } }
            }).success
        ).toBe(true)
        expect(
            themeOverridesSchema.safeParse({
                modes: { light: { primary: { main: null, contrastText: null } } }
            }).success
        ).toBe(true)
    })

    it('rejects unknown override keys', () => {
        expect(themeOverridesSchema.safeParse({ shared: { unknown: 1 } }).success).toBe(false)
        expect(themeOverridesSchema.safeParse({ modes: { light: { primary: { other: '#000000' } } } }).success).toBe(false)
    })
})

describe('theme appearance schema', () => {
    const appearance = {
        mode: 'system',
        preset: { source: 'file', id: 'universo-default', version: 1 },
        overrides: {},
        resolved: validResolved
    }

    it('accepts a full appearance and normalizes mode default', () => {
        const parsed = themeAppearanceSchema.parse({ ...appearance, mode: undefined })
        expect(parsed.mode).toBe('system')
        expect(themeAppearanceSchema.parse(appearance)).toMatchObject(appearance)
    })

    it('keeps the draft (client) schema free of server-owned resolved', () => {
        expect(themeAppearanceDraftSchema.safeParse({ preset: appearance.preset, overrides: {} }).success).toBe(true)
        expect(themeAppearanceDraftSchema.safeParse(appearance).success).toBe(false)
    })

    it('requires UUID v7 ids for DB-sourced preset refs and accepts file codenames', () => {
        expect(
            themeAppearanceSchema.safeParse({ ...appearance, preset: { source: 'file', id: 'universo-default', version: 1 } }).success
        ).toBe(true)
        // A malformed DB identifier must fail validation (400 THEME_PRESET_INVALID)
        // instead of reaching the SQL store as a garbage literal.
        expect(
            themeAppearanceSchema.safeParse({ ...appearance, preset: { source: 'metahub', id: 'garbage-id', version: 1 } }).success
        ).toBe(false)
        expect(
            themeAppearanceSchema.safeParse({
                ...appearance,
                preset: { source: 'metahub', id: '0190a9b5-0000-7000-8000-000000000003', version: 1 }
            }).success
        ).toBe(true)
    })

    it('round-trips through parseApplicationLayoutConfig for all three templates', () => {
        for (const templateKey of ['marketing-page', 'dashboard', 'messenger-app']) {
            const config = templateKey === 'marketing-page' ? { allowEmailActions: true, appearance } : { appearance }
            expect(() => parseApplicationLayoutConfig(templateKey, config)).not.toThrow()
        }
    })

    it('rejects the removed legacy marketing appearance fields', () => {
        expect(() => parseApplicationLayoutConfig('marketing-page', { themeMode: 'dark' })).toThrow()
        expect(() => parseApplicationLayoutConfig('marketing-page', { primaryColor: '#1976d2' })).toThrow()
        expect(() => parseApplicationLayoutConfig('dashboard', { accentColor: '#9c27b0' })).toThrow()
    })
})

describe('theme contrast checker', () => {
    it('reports no issues for the valid token set', () => {
        const { errors, warnings } = themeContrastIssues(themeTokensSchema.parse(validTokens))
        expect(errors).toEqual([])
        expect(warnings).toEqual([])
    })

    it('blocks text pairs below 4.5:1 and warns for UI pairs below 3:1', () => {
        const failing = themeTokensSchema.parse({
            ...validTokens,
            modes: {
                light: {
                    ...validModeColors,
                    text: { primary: '#959595', secondary: '#9a9a9a' },
                    primary: { main: '#f0f0f0', contrastText: '#ffffff' },
                    divider: '#f2f2f2'
                },
                dark: validModeColors
            }
        })
        const { errors, warnings } = themeContrastIssues(failing)
        expect(errors.length).toBeGreaterThanOrEqual(4)
        expect(errors.every((issue) => issue.minimum === 4.5)).toBe(true)
        expect(warnings.some((issue) => issue.pair === 'light:primary.main/background.default')).toBe(true)
        expect(warnings.every((issue) => !issue.pair.includes('divider'))).toBe(true)
    })

    it('computes WCAG luminance and ratios', () => {
        expect(themeColorLuminance('#000000')).toBeCloseTo(0, 5)
        expect(themeColorLuminance('#ffffff')).toBeCloseTo(1, 5)
        expect(themeContrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5)
    })
})

describe('file preset envelope and helpers', () => {
    it('validates the file preset envelope', () => {
        expect(
            themeFilePresetEnvelopeSchema.safeParse({
                schemaVersion: 1,
                id: 'universo-default',
                version: 1,
                name: { en: 'Universo Default', ru: 'Universo по умолчанию' },
                tokens: validTokens
            }).success
        ).toBe(true)
        expect(
            themeFilePresetEnvelopeSchema.safeParse({
                id: 'Uppercase-Invalid',
                version: 1,
                name: { en: 'X' },
                tokens: validTokens
            }).success
        ).toBe(false)
    })

    it('bounds resolved snapshots and exposes TZ error codes', () => {
        expect(THEME_HASH_REGEX.test(validResolved.hash)).toBe(true)
        expect(serializedJsonByteSize(validResolved)).toBeLessThan(64 * 1024)
        expect(THEME_PRESET_ERROR_CODES.sourceUnavailable).toBe('THEME_PRESET_SOURCE_UNAVAILABLE')
        expect(THEME_PRESET_ERROR_CODES.limitReached).toBe('THEME_PRESET_LIMIT_REACHED')
    })
})
