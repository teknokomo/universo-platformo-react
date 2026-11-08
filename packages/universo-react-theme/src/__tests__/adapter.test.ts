import { describe, expect, it } from 'vitest'

import { themeTokensSchema } from '@universo-react/types'

import { findFileThemePreset } from '../presets'
import { themeTokensToMuiInput } from '../adapter'

const defaultTokens = themeTokensSchema.parse(findFileThemePreset('universo-default')!.tokens)

describe('themeTokensToMuiInput', () => {
    it('maps palette schemes, typography, shape, and spacing', () => {
        const input = themeTokensToMuiInput(defaultTokens)
        expect(input.palettePerScheme.light.primary.main).toBe(defaultTokens.modes.light.primary.main)
        expect(input.palettePerScheme.dark.background.default).toBe(defaultTokens.modes.dark.background.default)
        expect(input.fontFamily).toContain('Inter')
        expect(input.fontSize).toBe(16)
        expect(input.shape).toEqual({ borderRadius: 8, borderWidth: 1 })
        expect(input.spacingUnit).toBe(8)
    })

    it('computes a descending heading scale and applies the compact density factor', () => {
        const input = themeTokensToMuiInput(defaultTokens)
        const headings = Object.values(input.headingFontSizes)
        expect(headings).toHaveLength(6)
        expect(headings[0]).toBeGreaterThan(headings[headings.length - 1])

        const compact = themeTokensToMuiInput({
            ...defaultTokens,
            shared: { ...defaultTokens.shared, spacing: { base: 8, density: 'compact' } }
        })
        expect(compact.spacingUnit).toBe(6)
    })

    it('emits flat shadows for the none scale and layered shadows otherwise', () => {
        const none = themeTokensToMuiInput({ ...defaultTokens, shared: { ...defaultTokens.shared, shadows: { scale: 'none' } } })
        expect(none.shadows.every((shadow) => shadow === 'none')).toBe(true)
        expect(none.shadows).toHaveLength(25)

        const strong = themeTokensToMuiInput({ ...defaultTokens, shared: { ...defaultTokens.shared, shadows: { scale: 'strong' } } })
        expect(strong.shadows[1]).toContain('0.16')
        expect(strong.shadows[2]).toContain('0.14')
        expect(strong.shadows[0]).toBe('none')
    })
})
