import { describe, expect, it } from 'vitest'

import {
    ApplicationAliasValidationError,
    applicationAliasRoutingModeSchema,
    applicationAliasSchema,
    normalizeApplicationAlias,
    RESERVED_APPLICATION_ALIASES
} from '../common/applicationAliases'

describe('application alias contracts', () => {
    it('normalizes casing and surrounding whitespace exactly once', () => {
        expect(normalizeApplicationAlias('  Meridian-73  ')).toBe('meridian-73')
        expect(applicationAliasSchema.parse('OM73')).toBe('om73')
    })

    it('accepts boundary lengths and rejects invalid separators or edges', () => {
        expect(normalizeApplicationAlias('a')).toBe('a')
        expect(normalizeApplicationAlias(`a${'b'.repeat(61)}c`)).toHaveLength(63)
        for (const invalid of ['', '-abc', 'abc-', 'a--?', 'a_b', 'a.b', 'a/b', 'a\\b', 'a%b', 'a b']) {
            expect(() => normalizeApplicationAlias(invalid)).toThrow(ApplicationAliasValidationError)
        }
        expect(() => normalizeApplicationAlias('a'.repeat(64))).toThrow(ApplicationAliasValidationError)
    })

    it('rejects non-ascii, controls, encoded delimiters, malformed encodings and uuid-shaped aliases', () => {
        for (const invalid of ['ом73', 'om\u0000-73', 'om%2f73', 'om%ZZ73', '0190a9b5-3cde-7abc-8def-0123456789ab']) {
            expect(() => normalizeApplicationAlias(invalid)).toThrow(ApplicationAliasValidationError)
        }
    })

    it('rejects non-string runtime input instead of coercing null into a valid alias', () => {
        expect(() => normalizeApplicationAlias(null as unknown as string)).toThrowError(
            expect.objectContaining<ApplicationAliasValidationError>({ reason: 'format' })
        )
    })

    it('rejects every centrally reserved platform route word', () => {
        for (const reserved of RESERVED_APPLICATION_ALIASES) {
            expect(() => normalizeApplicationAlias(reserved)).toThrowError(
                expect.objectContaining<ApplicationAliasValidationError>({ reason: 'reserved' })
            )
        }
    })

    it('keeps routing policy closed to direct and canonical modes', () => {
        expect(applicationAliasRoutingModeSchema.parse('direct')).toBe('direct')
        expect(applicationAliasRoutingModeSchema.parse('canonical')).toBe('canonical')
        expect(applicationAliasRoutingModeSchema.safeParse('redirect').success).toBe(false)
    })
})
