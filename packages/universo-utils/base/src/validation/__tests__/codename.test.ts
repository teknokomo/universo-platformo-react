import { describe, expect, it } from 'vitest'

import {
    autoConvertMixedAlphabetsByFirstSymbol,
    hasMixedAlphabets,
    isValidCodenameForStyle,
    normalizeCodenameForStyle,
    sanitizeCodenameForStyle
} from '../codename'

describe('codename validation and normalization', () => {
    it('validates kebab-case English codename', () => {
        expect(isValidCodenameForStyle('my-code-42', 'kebab-case', 'en')).toBe(true)
        expect(isValidCodenameForStyle('My-Code-42', 'kebab-case', 'en')).toBe(false)
    })

    it('respects mixed alphabet policy for en-ru', () => {
        const mixed = 'test-тест'
        expect(isValidCodenameForStyle(mixed, 'kebab-case', 'en-ru', true)).toBe(true)
        expect(isValidCodenameForStyle(mixed, 'kebab-case', 'en-ru', false)).toBe(false)
    })

    it('validates PascalCase English codename', () => {
        expect(isValidCodenameForStyle('MyCode_1', 'pascal-case', 'en')).toBe(true)
        expect(isValidCodenameForStyle('myCode_1', 'pascal-case', 'en')).toBe(false)
    })

    it('normalizes kebab-case values for English and Russian alphabets', () => {
        expect(normalizeCodenameForStyle(' Hello_World 42! ', 'kebab-case', 'en')).toBe('hello-world-42')
        expect(normalizeCodenameForStyle(' Привет Мир_42! ', 'kebab-case', 'ru')).toBe('привет-мир-42')
    })

    it('normalizes PascalCase values for English and Russian alphabets', () => {
        expect(normalizeCodenameForStyle('hello world_42', 'pascal-case', 'en')).toBe('HelloWorld42')
        expect(normalizeCodenameForStyle('привет мир_42', 'pascal-case', 'ru')).toBe('ПриветМир42')
    })

    it('sanitizes to expected style and alphabet', () => {
        expect(sanitizeCodenameForStyle('hello world', 'pascal-case', 'en')).toBe('HelloWorld')
        expect(sanitizeCodenameForStyle('my value', 'kebab-case', 'en')).toBe('my-value')
    })

    it('auto-converts mixed alphabets to a single alphabet using first symbol', () => {
        const latinFirst = autoConvertMixedAlphabetsByFirstSymbol('TestТест')
        expect(hasMixedAlphabets(latinFirst)).toBe(false)
        expect(/^[A-Za-z]/.test(latinFirst)).toBe(true)

        const cyrillicFirst = autoConvertMixedAlphabetsByFirstSymbol('ТестTest')
        expect(hasMixedAlphabets(cyrillicFirst)).toBe(false)
        expect(/^[А-Яа-яЁё]/.test(cyrillicFirst)).toBe(true)
    })

    it('can sanitize mixed value into en-ru without mixed alphabets when auto conversion is enabled', () => {
        const sanitized = sanitizeCodenameForStyle('TestТест Value', 'pascal-case', 'en-ru', false, true)
        expect(sanitized.length).toBeGreaterThan(0)
        expect(hasMixedAlphabets(sanitized)).toBe(false)
    })
})
