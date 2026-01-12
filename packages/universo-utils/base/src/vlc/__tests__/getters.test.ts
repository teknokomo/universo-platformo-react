import { describe, it, expect } from 'vitest'
import {
    getVLCString,
    getVLCStringWithFallback,
    getSimpleLocalizedValue,
    normalizeLocale,
    type SimpleLocalizedInput,
    type VersatileLocalizedContent
} from '../getters'
import type { VersionedLocalizedContent } from '@universo/types'

describe('normalizeLocale', () => {
    it('should extract base language code from locale with region', () => {
        expect(normalizeLocale('en-US')).toBe('en')
        expect(normalizeLocale('ru-RU')).toBe('ru')
        expect(normalizeLocale('zh-CN')).toBe('zh')
    })

    it('should handle locale with underscore separator', () => {
        expect(normalizeLocale('en_US')).toBe('en')
        expect(normalizeLocale('pt_BR')).toBe('pt')
    })

    it('should handle plain language codes', () => {
        expect(normalizeLocale('en')).toBe('en')
        expect(normalizeLocale('ru')).toBe('ru')
    })

    it('should lowercase the result', () => {
        expect(normalizeLocale('EN-US')).toBe('en')
        expect(normalizeLocale('RU')).toBe('ru')
    })

    it('should return "en" for undefined or empty', () => {
        expect(normalizeLocale(undefined)).toBe('en')
        expect(normalizeLocale('')).toBe('en')
    })
})

describe('getSimpleLocalizedValue', () => {
    it('should return value for requested locale', () => {
        const field: SimpleLocalizedInput = { en: 'English', ru: 'Русский' }
        expect(getSimpleLocalizedValue(field, 'en')).toBe('English')
        expect(getSimpleLocalizedValue(field, 'ru')).toBe('Русский')
    })

    it('should fallback to "en" if requested locale not found', () => {
        const field: SimpleLocalizedInput = { en: 'English' }
        expect(getSimpleLocalizedValue(field, 'ru')).toBe('English')
    })

    it('should fallback to "ru" if "en" also not found', () => {
        const field: SimpleLocalizedInput = { ru: 'Русский' }
        expect(getSimpleLocalizedValue(field, 'de')).toBe('Русский')
    })

    it('should return any non-empty value as last resort', () => {
        const field: SimpleLocalizedInput = { de: 'Deutsch' }
        expect(getSimpleLocalizedValue(field, 'en')).toBe('Deutsch')
    })

    it('should return empty string if no values found', () => {
        const field: SimpleLocalizedInput = {}
        expect(getSimpleLocalizedValue(field, 'en')).toBe('')
    })

    it('should skip empty strings when looking for fallback', () => {
        const field: SimpleLocalizedInput = { en: '', ru: 'Русский' }
        expect(getSimpleLocalizedValue(field, 'en')).toBe('Русский')
    })

    it('should skip whitespace-only strings', () => {
        const field: SimpleLocalizedInput = { en: '   ', ru: 'Русский' }
        expect(getSimpleLocalizedValue(field, 'en')).toBe('Русский')
    })
})

describe('getVLCString', () => {
    describe('with null/undefined input', () => {
        it('should return empty string for null', () => {
            expect(getVLCString(null, 'en')).toBe('')
        })

        it('should return empty string for undefined', () => {
            expect(getVLCString(undefined, 'en')).toBe('')
        })
    })

    describe('with plain string input', () => {
        it('should return the string as-is', () => {
            expect(getVLCString('plain text', 'en')).toBe('plain text')
        })

        it('should return empty string as-is', () => {
            expect(getVLCString('', 'en')).toBe('')
        })
    })

    describe('with VLC format (locales object with content)', () => {
        const vlcContent: VersatileLocalizedContent = {
            _schema: '1',
            _primary: 'en',
            locales: {
                en: { content: 'English Content' },
                ru: { content: 'Русское содержимое' }
            }
        }

        it('should return content for requested locale', () => {
            expect(getVLCString(vlcContent, 'en')).toBe('English Content')
            expect(getVLCString(vlcContent, 'ru')).toBe('Русское содержимое')
        })

        it('should fallback to primary locale', () => {
            expect(getVLCString(vlcContent, 'de')).toBe('English Content')
        })

        it('should normalize locale before lookup', () => {
            expect(getVLCString(vlcContent, 'en-US')).toBe('English Content')
            expect(getVLCString(vlcContent, 'ru-RU')).toBe('Русское содержимое')
        })
    })

    describe('with VLC format without primary', () => {
        const vlcContent: VersatileLocalizedContent = {
            locales: {
                ru: { content: 'Русское содержимое' }
            }
        }

        it('should return any available content as fallback', () => {
            expect(getVLCString(vlcContent, 'de')).toBe('Русское содержимое')
        })
    })

    describe('with SimpleLocalizedInput format', () => {
        const simpleInput: SimpleLocalizedInput = {
            en: 'Simple English',
            ru: 'Простой русский'
        }

        it('should return value for requested locale', () => {
            expect(getVLCString(simpleInput, 'en')).toBe('Simple English')
            expect(getVLCString(simpleInput, 'ru')).toBe('Простой русский')
        })

        it('should use fallback chain for missing locale', () => {
            expect(getVLCString(simpleInput, 'de')).toBe('Simple English')
        })
    })

    describe('with VersionedLocalizedContent type', () => {
        const fullVlc: VersionedLocalizedContent<string> = {
            _schema: '1',
            _primary: 'en',
            locales: {
                en: {
                    content: 'Full VLC Content',
                    version: 1,
                    isActive: true,
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z'
                }
            }
        }

        it('should extract content from full VLC structure', () => {
            expect(getVLCString(fullVlc, 'en')).toBe('Full VLC Content')
        })
    })
})

describe('getVLCStringWithFallback', () => {
    it('should return value for requested locale', () => {
        const field: SimpleLocalizedInput = { en: 'English', ru: 'Русский' }
        expect(getVLCStringWithFallback(field, 'en', 'fallback')).toBe('English')
    })

    it('should try English as fallback before custom fallback', () => {
        const field: SimpleLocalizedInput = { en: 'English' }
        expect(getVLCStringWithFallback(field, 'de', 'custom-fallback')).toBe('English')
    })

    it('should return custom fallback when nothing found', () => {
        const field: SimpleLocalizedInput = {}
        expect(getVLCStringWithFallback(field, 'de', 'custom-fallback')).toBe('custom-fallback')
    })

    it('should return custom fallback for null input', () => {
        expect(getVLCStringWithFallback(null, 'en', 'fallback')).toBe('fallback')
    })

    it('should not double-try English if already requested', () => {
        const field: SimpleLocalizedInput = { ru: 'Русский' }
        expect(getVLCStringWithFallback(field, 'en', 'fallback')).toBe('Русский')
    })
})
