/**
 * Codename validation and normalization utilities.
 * Used for generating URL-safe, database-friendly identifiers from user input.
 *
 * Supports two styles (kebab-case, pascal-case) × three alphabets (en, ru, en-ru)
 * with optional mixed-alphabet restriction.
 */

import type { CodenameVLC, LocaleCode } from '@universo/types'
import { slugifyCodename } from '../ui-utils/slugify'
import { createCodenameVLC, getCodenamePrimary } from '../vlc'

// ═══════════════════════════════════════
// Kebab-case patterns
// ═══════════════════════════════════════

/** Kebab-case, English-only: lowercase latin + digits + hyphens. */
export const CODENAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Kebab-case, Russian-only: lowercase Cyrillic + digits + hyphens. Allows ё. */
export const CODENAME_KEBAB_RU_PATTERN = /^[а-яё0-9]+(?:-[а-яё0-9]+)*$/

/** Kebab-case, English + Russian: lowercase Latin + Cyrillic + digits + hyphens. */
export const CODENAME_KEBAB_EN_RU_PATTERN = /^[a-zа-яё0-9]+(?:-[a-zа-яё0-9]+)*$/

// ═══════════════════════════════════════
// PascalCase patterns
// ═══════════════════════════════════════

/**
 * PascalCase, English + Russian: uppercase Latin/Cyrillic start, then letters + digits + underscores.
 * Max 80 chars. No ё/Ё (convention).
 */
export const CODENAME_PASCAL_PATTERN = /^[A-ZА-Я][A-Za-zА-Яа-я0-9_]{0,79}$/

/** PascalCase, English-only: uppercase Latin start, then Latin + digits + underscores. Max 80 chars. */
export const CODENAME_PASCAL_EN_PATTERN = /^[A-Z][A-Za-z0-9_]{0,79}$/

/** PascalCase, Russian-only: uppercase Cyrillic start, then Cyrillic + digits + underscores. Max 80 chars. No ё/Ё. */
export const CODENAME_PASCAL_RU_PATTERN = /^[А-Я][А-Яа-я0-9_]{0,79}$/

// ═══════════════════════════════════════
// Basic validators (single-alphabet)
// ═══════════════════════════════════════

/** Validate kebab-case English-only codename. */
export const isValidCodename = (value: string): boolean => CODENAME_PATTERN.test(value)

/** Validate kebab-case Russian-only codename. */
export const isValidKebabRuCodename = (value: string): boolean => CODENAME_KEBAB_RU_PATTERN.test(value)

/** Validate kebab-case English+Russian codename. */
export const isValidKebabEnRuCodename = (value: string): boolean => CODENAME_KEBAB_EN_RU_PATTERN.test(value)

/** Validate PascalCase English+Russian codename (no ё/Ё). */
export const isValidPascalCodename = (value: string): boolean => {
    if (value.includes('ё') || value.includes('Ё')) return false
    return CODENAME_PASCAL_PATTERN.test(value)
}

/** Validate PascalCase English-only codename. */
export const isValidPascalEnCodename = (value: string): boolean => CODENAME_PASCAL_EN_PATTERN.test(value)

/** Validate PascalCase Russian-only codename (no ё/Ё). */
export const isValidPascalRuCodename = (value: string): boolean => {
    if (value.includes('ё') || value.includes('Ё')) return false
    return CODENAME_PASCAL_RU_PATTERN.test(value)
}

// ═══════════════════════════════════════
// Mixed-alphabet detection
// ═══════════════════════════════════════

/** Check if a string contains both Latin and Cyrillic letters. */
export const hasMixedAlphabets = (value: string): boolean => {
    const hasLatin = /[a-zA-Z]/.test(value)
    const hasCyrillic = /[а-яА-ЯёЁ]/.test(value)
    return hasLatin && hasCyrillic
}

const LATIN_TO_CYRILLIC_MAP: Record<string, string> = {
    a: 'а',
    b: 'б',
    c: 'с',
    d: 'д',
    e: 'е',
    f: 'ф',
    g: 'г',
    h: 'х',
    i: 'и',
    j: 'й',
    k: 'к',
    l: 'л',
    m: 'м',
    n: 'н',
    o: 'о',
    p: 'п',
    q: 'к',
    r: 'р',
    s: 'с',
    t: 'т',
    u: 'у',
    v: 'в',
    w: 'в',
    x: 'кс',
    y: 'и',
    z: 'з'
}

const CYRILLIC_TO_LATIN_MAP: Record<string, string> = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'kh',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'sch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya'
}

const detectPrimaryAlphabet = (value: string): 'en' | 'ru' | null => {
    for (const char of value) {
        if (/[A-Za-z]/.test(char)) return 'en'
        if (/[А-Яа-яЁё]/.test(char)) return 'ru'
    }
    return null
}

const toMappedCase = (sourceChar: string, mapped: string): string => {
    if (sourceChar.toLowerCase() === sourceChar) return mapped
    if (mapped.length <= 1) return mapped.toUpperCase()
    return mapped.charAt(0).toUpperCase() + mapped.slice(1)
}

const mapToSingleAlphabet = (value: string, target: 'en' | 'ru'): string => {
    return Array.from(value)
        .map((char) => {
            if (target === 'ru') {
                if (!/[A-Za-z]/.test(char)) return char
                const mapped = LATIN_TO_CYRILLIC_MAP[char.toLowerCase()]
                return mapped ? toMappedCase(char, mapped) : char
            }

            if (!/[А-Яа-яЁё]/.test(char)) return char
            const mapped = CYRILLIC_TO_LATIN_MAP[char.toLowerCase()]
            return mapped !== undefined ? toMappedCase(char, mapped) : char
        })
        .join('')
}

/**
 * Auto-convert mixed Latin+Cyrillic text to a single alphabet using the first detected letter as source of truth.
 * - first Latin letter -> convert Cyrillic chars to Latin
 * - first Cyrillic letter -> convert Latin chars to Cyrillic
 */
export const autoConvertMixedAlphabetsByFirstSymbol = (value: string): string => {
    if (!hasMixedAlphabets(value)) return value

    const primaryAlphabet = detectPrimaryAlphabet(value)
    if (!primaryAlphabet) return value

    return mapToSingleAlphabet(value, primaryAlphabet)
}

// ═══════════════════════════════════════
// Style-aware validation
// ═══════════════════════════════════════

/**
 * Validate codename against the specified style, alphabet, and mixed-alphabet policy.
 *
 * @param value - Codename to validate
 * @param style - 'kebab-case' or 'pascal-case'
 * @param alphabet - 'en', 'ru', or 'en-ru'
 * @param allowMixed - Whether mixed Latin+Cyrillic is allowed (only relevant for 'en-ru')
 */
export const isValidCodenameForStyle = (
    value: string,
    style: 'kebab-case' | 'pascal-case' = 'pascal-case',
    alphabet: 'en' | 'ru' | 'en-ru' = 'en-ru',
    allowMixed = true
): boolean => {
    if (!value) return false

    // Mixed-alphabet check (only for en-ru when mixing is disallowed)
    if (alphabet === 'en-ru' && !allowMixed && hasMixedAlphabets(value)) {
        return false
    }

    if (style === 'pascal-case') {
        switch (alphabet) {
            case 'en':
                return isValidPascalEnCodename(value)
            case 'ru':
                return isValidPascalRuCodename(value)
            case 'en-ru':
                return isValidPascalCodename(value)
        }
    }

    // kebab-case
    switch (alphabet) {
        case 'en':
            return isValidCodename(value)
        case 'ru':
            return isValidKebabRuCodename(value)
        case 'en-ru':
            return isValidKebabEnRuCodename(value)
    }
}

/** Normalize the primary codename content while preserving the surrounding VLC container. */
export const normalizeCodenameVLC = (
    value: CodenameVLC | null | undefined,
    style: 'kebab-case' | 'pascal-case' = 'pascal-case',
    alphabet: 'en' | 'ru' | 'en-ru' = 'en-ru'
): CodenameVLC | null => {
    if (!value) return null

    const primary = value._primary
    const primaryEntry = value.locales?.[primary]
    if (!primaryEntry || typeof primaryEntry.content !== 'string') {
        return value
    }

    return {
        ...value,
        locales: {
            ...value.locales,
            [primary]: {
                ...primaryEntry,
                content: normalizeCodenameForStyle(primaryEntry.content, style, alphabet)
            }
        }
    }
}

/** Normalize every locale entry in a codename VLC value under the configured codename policy. */
export const normalizeCodenameVLCAllLocales = (
    value: CodenameVLC | null | undefined,
    style: 'kebab-case' | 'pascal-case' = 'pascal-case',
    alphabet: 'en' | 'ru' | 'en-ru' = 'en-ru'
): CodenameVLC | null => {
    if (!value) return null

    let hasChanges = false
    const nextLocales = Object.fromEntries(
        Object.entries(value.locales ?? {}).map(([locale, entry]) => {
            if (!entry || typeof entry.content !== 'string') {
                return [locale, entry]
            }

            const normalizedContent = normalizeCodenameForStyle(entry.content, style, alphabet)
            if (normalizedContent !== entry.content) {
                hasChanges = true
            }

            return [
                locale,
                {
                    ...entry,
                    content: normalizedContent
                }
            ]
        })
    ) as CodenameVLC['locales']

    if (!hasChanges) {
        return value
    }

    return {
        ...value,
        locales: nextLocales
    }
}

/** Convert a raw codename string into canonical codename VLC after style-aware sanitization. */
export const sanitizeCodenameToVLC = (
    value: string,
    locale: LocaleCode,
    style: 'kebab-case' | 'pascal-case' = 'pascal-case',
    alphabet: 'en' | 'ru' | 'en-ru' = 'en-ru',
    allowMixed = true,
    autoConvertMixedAlphabets = true
): CodenameVLC => {
    const sanitized = sanitizeCodenameForStyle(value, style, alphabet, allowMixed, autoConvertMixedAlphabets)
    return createCodenameVLC(locale, sanitized)
}

/** Return the canonical primary-text view used for uniqueness, lookup and sorting. */
export const getCanonicalCodenameText = (value: CodenameVLC | string | null | undefined): string => getCodenamePrimary(value)

// ═══════════════════════════════════════
// Normalizers (strip invalid chars from user-typed codename)
// ═══════════════════════════════════════

/** Normalize to kebab-case English-only. */
export const normalizeCodename = (value: string): string =>
    value
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')

/** Normalize to kebab-case Russian-only. */
export const normalizeKebabRuCodename = (value: string): string =>
    value
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/[^а-яё0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')

/** Normalize to kebab-case English+Russian. */
export const normalizeKebabEnRuCodename = (value: string): string =>
    value
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-zа-яё0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')

/** Normalize to PascalCase English+Russian (no ё/Ё). */
export const normalizePascalCodename = (value: string): string =>
    value
        .trim()
        .match(/[A-Za-zА-Яа-яЁё0-9]+/g)
        ?.filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('')
        .replace(/[ёЁ]/g, (match) => (match === 'ё' ? 'е' : 'Е'))
        .replace(/[^A-Za-zА-Яа-я0-9_]/g, '')
        .slice(0, 80) ?? ''

/** Normalize to PascalCase English-only. */
export const normalizePascalEnCodename = (value: string): string =>
    value
        .trim()
        .match(/[A-Za-z0-9]+/g)
        ?.filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('')
        .replace(/[^A-Za-z0-9_]/g, '')
        .slice(0, 80) ?? ''

/** Normalize to PascalCase Russian-only (no ё/Ё). */
export const normalizePascalRuCodename = (value: string): string =>
    value
        .trim()
        .match(/[А-Яа-яЁё0-9]+/g)
        ?.filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('')
        .replace(/[ёЁ]/g, (match) => (match === 'ё' ? 'е' : 'Е'))
        .replace(/[^А-Яа-я0-9_]/g, '')
        .slice(0, 80) ?? ''

/**
 * Normalize codename per style and alphabet (strip invalid chars from user input).
 */
export const normalizeCodenameForStyle = (
    value: string,
    style: 'kebab-case' | 'pascal-case' = 'pascal-case',
    alphabet: 'en' | 'ru' | 'en-ru' = 'en-ru'
): string => {
    if (style === 'pascal-case') {
        switch (alphabet) {
            case 'en':
                return normalizePascalEnCodename(value)
            case 'ru':
                return normalizePascalRuCodename(value)
            case 'en-ru':
                return normalizePascalCodename(value)
        }
    }
    switch (alphabet) {
        case 'en':
            return normalizeCodename(value)
        case 'ru':
            return normalizeKebabRuCodename(value)
        case 'en-ru':
            return normalizeKebabEnRuCodename(value)
    }
}

// ═══════════════════════════════════════
// Sanitizers (auto-generate codename from display name)
// ═══════════════════════════════════════

/** Sanitize (transliterate + kebab-case) — legacy English-only. */
export const sanitizeCodename = (value: string): string => slugifyCodename(value)

/**
 * Auto-generate a codename from a display name respecting style and alphabet.
 *
 * - kebab + en: transliterate Cyrillic → Latin, then kebab-case (via slugify)
 * - kebab + ru: lowercase, Cyrillic only, hyphens
 * - kebab + en-ru: lowercase, both alphabets, hyphens
 * - pascal + en: transliterate Cyrillic → Latin via slugify, then PascalCase
 * - pascal + ru: PascalCase with Cyrillic only
 * - pascal + en-ru: PascalCase with both alphabets
 */
export const sanitizeCodenameForStyle = (
    value: string,
    style: 'kebab-case' | 'pascal-case' = 'pascal-case',
    alphabet: 'en' | 'ru' | 'en-ru' = 'en-ru',
    allowMixed = true,
    autoConvertMixedAlphabets = false
): string => {
    if (!value) return ''

    const sourceValue =
        alphabet === 'en-ru' && !allowMixed && autoConvertMixedAlphabets ? autoConvertMixedAlphabetsByFirstSymbol(value) : value

    if (style === 'pascal-case') {
        switch (alphabet) {
            case 'en': {
                // Transliterate to Latin via slugify, then re-PascalCase
                const slugified = slugifyCodename(sourceValue)
                if (!slugified) return ''
                return slugified
                    .split('-')
                    .filter(Boolean)
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join('')
                    .replace(/[^A-Za-z0-9_]/g, '')
                    .slice(0, 80)
            }
            case 'ru':
                return normalizePascalRuCodename(sourceValue)
            case 'en-ru':
                return normalizePascalCodename(sourceValue)
        }
    }

    // kebab-case
    switch (alphabet) {
        case 'en':
            return slugifyCodename(sourceValue)
        case 'ru':
            return normalizeKebabRuCodename(sourceValue)
        case 'en-ru':
            return normalizeKebabEnRuCodename(sourceValue)
    }
}
