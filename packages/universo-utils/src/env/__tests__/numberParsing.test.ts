import { describe, expect, it } from 'vitest'
import { parsePositiveInt, parseNonNegativeInt } from '../numberParsing'

describe('numberParsing', () => {
    it('parsePositiveInt returns parsed value when valid', () => {
        expect(parsePositiveInt('12', 3)).toBe(12)
    })

    it('parsePositiveInt falls back for zero/negative/invalid', () => {
        expect(parsePositiveInt('0', 3)).toBe(3)
        expect(parsePositiveInt('-1', 3)).toBe(3)
        expect(parsePositiveInt('abc', 3)).toBe(3)
        expect(parsePositiveInt(undefined, 3)).toBe(3)
    })

    it('parseNonNegativeInt returns parsed value for 0 and positive values', () => {
        expect(parseNonNegativeInt('0', 4)).toBe(0)
        expect(parseNonNegativeInt('7', 4)).toBe(7)
    })

    it('parseNonNegativeInt falls back for negative/invalid values', () => {
        expect(parseNonNegativeInt('-2', 4)).toBe(4)
        expect(parseNonNegativeInt('xyz', 4)).toBe(4)
        expect(parseNonNegativeInt(undefined, 4)).toBe(4)
    })
})
