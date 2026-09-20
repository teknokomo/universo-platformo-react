import { describe, expect, it } from 'vitest'
import {
    MAX_VALIDATION_PATTERN_LENGTH,
    isUnsafeValidationPattern,
    isUsableValidationPattern,
    isUsableValidationPatternValue
} from '../validation/patternSafety'

describe('patternSafety', () => {
    it('accepts the bounded semantic-key style patterns used by templates', () => {
        expect(isUsableValidationPattern('^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$')).toBe(true)
        expect(isUsableValidationPattern('^#[0-9a-fA-F]{6}$')).toBe(true)
        expect(isUsableValidationPattern('^([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d(\\.\\d{1,3})?)?$')).toBe(true)
    })

    it('accepts repeated groups whose repetitions cannot be partitioned ambiguously', () => {
        expect(isUsableValidationPattern('^(?:ab|cd)+$')).toBe(true)
        expect(isUsableValidationPattern('^(?:\\d{3}-){2}\\d{4}$')).toBe(true)
        expect(isUsableValidationPattern('^(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)$')).toBe(true)
    })

    it('rejects nested quantifiers, oversized patterns and non-string input', () => {
        expect(isUsableValidationPattern('^(a+)+$')).toBe(false)
        expect(isUsableValidationPattern('^(.*)*$')).toBe(false)
        expect(isUsableValidationPattern('a'.repeat(MAX_VALIDATION_PATTERN_LENGTH))).toBe(true)
        expect(isUsableValidationPattern('a'.repeat(MAX_VALIDATION_PATTERN_LENGTH + 1))).toBe(false)
        expect(isUsableValidationPattern('')).toBe(false)
        expect(isUsableValidationPattern(undefined)).toBe(false)
    })

    it('rejects overlapping alternations under an unbounded quantifier', () => {
        const attackPatterns = ['^(a|aa)+$', '^(?:a|aa)+$', '^(\\d|\\d\\d)+$', '^(a|a?)+$', '^(?:[a-z]+|[0-9]+)+$', '^(?:x+x+)+y$']

        for (const pattern of attackPatterns) {
            expect(isUsableValidationPattern(pattern)).toBe(false)
            expect(isUnsafeValidationPattern(pattern)).toBe(true)
        }
    })

    it('rejects repeated unbounded quantifiers over the same atom without a group', () => {
        const attackPatterns = ['^a*a*a*a*a*b$', '^\\d*\\d*\\d*x$', '^.*.*$', '^[a-z]*[a-z]*z$']

        for (const pattern of attackPatterns) {
            expect(isUsableValidationPattern(pattern)).toBe(false)
            expect(isUnsafeValidationPattern(pattern)).toBe(true)
        }
    })

    it('keeps legitimate multi-class patterns without quantified groups usable', () => {
        expect(isUsableValidationPattern('^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')).toBe(true)
        expect(isUsableValidationPattern('^\\+?[0-9 ()-]{7,20}$')).toBe(true)
        expect(isUsableValidationPattern('^https?://[^\\s/$.?#].[^\\s]*$')).toBe(true)
    })

    it('classifies only executable exponential patterns as unsafe', () => {
        expect(isUnsafeValidationPattern('^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$')).toBe(false)
        expect(isUnsafeValidationPattern('(')).toBe(false)
        expect(isUnsafeValidationPattern('a'.repeat(MAX_VALIDATION_PATTERN_LENGTH + 1))).toBe(false)
        expect(isUnsafeValidationPattern(undefined)).toBe(false)
    })

    it('bounds the tested value length', () => {
        expect(isUsableValidationPatternValue('short')).toBe(true)
        expect(isUsableValidationPatternValue('x'.repeat(4096))).toBe(true)
        expect(isUsableValidationPatternValue('x'.repeat(4097))).toBe(false)
    })
})
