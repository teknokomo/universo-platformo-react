import { describe, expect, it } from 'vitest'
import { MAX_VALIDATION_PATTERN_LENGTH, isUsableValidationPattern, isUsableValidationPatternValue } from '../validation/patternSafety'

describe('patternSafety', () => {
    it('accepts the bounded semantic-key style patterns used by templates', () => {
        expect(isUsableValidationPattern('^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$')).toBe(true)
        expect(isUsableValidationPattern('^#[0-9a-fA-F]{6}$')).toBe(true)
    })

    it('rejects nested quantifiers, oversized patterns and non-string input', () => {
        expect(isUsableValidationPattern('^(a+)+$')).toBe(false)
        expect(isUsableValidationPattern('^(.*)*$')).toBe(false)
        expect(isUsableValidationPattern('a'.repeat(MAX_VALIDATION_PATTERN_LENGTH + 1))).toBe(false)
        expect(isUsableValidationPattern('')).toBe(false)
        expect(isUsableValidationPattern(undefined)).toBe(false)
    })

    it('bounds the tested value length', () => {
        expect(isUsableValidationPatternValue('short')).toBe(true)
        expect(isUsableValidationPatternValue('x'.repeat(4096))).toBe(true)
        expect(isUsableValidationPatternValue('x'.repeat(4097))).toBe(false)
    })
})
