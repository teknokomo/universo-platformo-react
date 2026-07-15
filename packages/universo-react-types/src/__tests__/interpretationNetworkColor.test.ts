import { describe, expect, it } from 'vitest'

import {
    calculateInterpretationNetworkContrastRatio,
    normalizeInterpretationNetworkHexColor,
    parseInterpretationNetworkHexColor,
    resolveInterpretationNetworkDisplayColor,
    resolveInterpretationNetworkMaximumContrastForeground
} from '../common/interpretationNetworkColor'

describe('Interpretation Network colour contract', () => {
    it('canonicalizes only opaque three- or six-digit hexadecimal input', () => {
        expect(normalizeInterpretationNetworkHexColor('#abc')).toBe('#AABBCC')
        expect(normalizeInterpretationNetworkHexColor('#a1B2c3')).toBe('#A1B2C3')
        expect(normalizeInterpretationNetworkHexColor(null)).toBeNull()
        expect(parseInterpretationNetworkHexColor('#ABC')).toBe('#AABBCC')
    })

    it.each(['#abcd', '#AABBCCDD', 'rgb(1, 2, 3)', 'hsl(0 0% 0%)', 'var(--colour)', ' red ', '', {}, []])(
        'rejects non-contract colour input %#',
        (value) => {
            expect(parseInterpretationNetworkHexColor(value)).toBeNull()
            expect(() => normalizeInterpretationNetworkHexColor(value)).toThrow()
        }
    )

    it('keeps display resolution non-throwing and selects the strongest fallback foreground', () => {
        expect(resolveInterpretationNetworkDisplayColor('not-a-colour')).toBeNull()
        expect(resolveInterpretationNetworkMaximumContrastForeground('#FFFFFF')).toBe('#000000')
        expect(resolveInterpretationNetworkMaximumContrastForeground('#000000')).toBe('#FFFFFF')
        expect(resolveInterpretationNetworkMaximumContrastForeground('not-a-colour', '#AABBCC')).toBe('#AABBCC')
        expect(calculateInterpretationNetworkContrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    })

    it('uses WCAG relative luminance for white text on the orange preset', () => {
        expect(calculateInterpretationNetworkContrastRatio('#FFFFFF', '#FB8C00')).toBeCloseTo(2.372, 3)
        expect(calculateInterpretationNetworkContrastRatio('#000000', '#FB8C00')).toBeGreaterThan(4.5)
    })
})
