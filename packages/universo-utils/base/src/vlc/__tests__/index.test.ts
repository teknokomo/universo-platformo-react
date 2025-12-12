import { describe, it, expect } from 'vitest'
import { createVlc, updateVlcLocale, resolveVlcContent, getVlcLocales, isVlc } from '../index'
import type { VersionedLocalizedContent } from '@universo/types'

describe('VLC Utilities', () => {
    describe('createVlc', () => {
        it('creates VLC with primary locale and content', () => {
            const vlc = createVlc('en', 'Test Content')

            expect(vlc._schema).toBe('1')
            expect(vlc._primary).toBe('en')
            expect(vlc.locales.en?.content).toBe('Test Content')
            expect(vlc.locales.en?.version).toBe(1)
            expect(vlc.locales.en?.isActive).toBe(true)
        })

        it('creates VLC with Russian as primary locale', () => {
            const vlc = createVlc('ru', 'Тестовое содержимое')

            expect(vlc._primary).toBe('ru')
            expect(vlc.locales.ru?.content).toBe('Тестовое содержимое')
        })

        it('generates valid ISO 8601 timestamps', () => {
            const vlc = createVlc('en', 'Test')
            const entry = vlc.locales.en!

            expect(() => new Date(entry.createdAt)).not.toThrow()
            expect(() => new Date(entry.updatedAt)).not.toThrow()
            expect(entry.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
            expect(entry.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
        })
    })

    describe('updateVlcLocale', () => {
        it('updates existing locale immutably', () => {
            const original = createVlc('en', 'Original')
            const updated = updateVlcLocale(original, 'en', 'Updated')

            // Original unchanged (immutable)
            expect(original.locales.en?.content).toBe('Original')
            expect(original.locales.en?.version).toBe(1)

            // Updated has new content and incremented version
            expect(updated.locales.en?.content).toBe('Updated')
            expect(updated.locales.en?.version).toBe(2)
        })

        it('adds new locale to VLC', () => {
            const original = createVlc('en', 'English')
            const updated = updateVlcLocale(original, 'ru', 'Русский')

            expect(updated.locales.en?.content).toBe('English')
            expect(updated.locales.ru?.content).toBe('Русский')
            expect(updated.locales.ru?.version).toBe(1)
        })

        it('preserves _primary when adding new locale', () => {
            const original = createVlc('en', 'English')
            const updated = updateVlcLocale(original, 'ru', 'Русский')

            expect(updated._primary).toBe('en')
        })

        it('updates timestamps correctly', () => {
            const original = createVlc('en', 'Original')
            // Small delay to ensure different timestamps
            const beforeUpdate = Date.now()
            const updated = updateVlcLocale(original, 'en', 'Updated')
            const afterUpdate = Date.now()

            const originalTime = new Date(original.locales.en?.updatedAt || '').getTime()
            const updatedTime = new Date(updated.locales.en?.updatedAt || '').getTime()

            // Check that updatedAt changed and is within expected range
            expect(updatedTime).toBeGreaterThanOrEqual(beforeUpdate)
            expect(updatedTime).toBeLessThanOrEqual(afterUpdate)
            expect(updatedTime).toBeGreaterThanOrEqual(originalTime)
            // createdAt should remain the same
            expect(updated.locales.en?.createdAt).toBe(original.locales.en?.createdAt)
        })
    })

    describe('resolveVlcContent', () => {
        it('returns content for requested locale', () => {
            const vlc = createVlc('en', 'English')
            const updated = updateVlcLocale(vlc, 'ru', 'Русский')

            expect(resolveVlcContent(updated, 'en')).toBe('English')
            expect(resolveVlcContent(updated, 'ru')).toBe('Русский')
        })

        it('falls back to primary locale when requested not found', () => {
            const vlc = createVlc('en', 'English Only')

            expect(resolveVlcContent(vlc, 'ru')).toBe('English Only')
        })

        it('returns fallback for null/undefined VLC', () => {
            expect(resolveVlcContent(null, 'en')).toBeUndefined()
            expect(resolveVlcContent(undefined, 'en')).toBeUndefined()
            expect(resolveVlcContent(null, 'en', 'Fallback')).toBe('Fallback')
        })

        it('handles VLC with missing locales gracefully', () => {
            const malformed = {
                _schema: '1' as const,
                _primary: 'en' as const,
                locales: {}
            } satisfies VersionedLocalizedContent<string>

            expect(resolveVlcContent(malformed, 'en', 'Fallback')).toBe('Fallback')
        })

        it('handles inactive locale entries', () => {
            const vlc = createVlc('en', 'Active')
            // Manually create inactive locale for testing
            const withInactive: VersionedLocalizedContent<string> = {
                ...vlc,
                locales: {
                    en: {
                        ...vlc.locales.en!,
                        isActive: false
                    }
                }
            }

            expect(resolveVlcContent(withInactive, 'en', 'Fallback')).toBe('Fallback')
        })

        it('guarantees non-undefined return when fallback provided (type safety)', () => {
            const vlc = createVlc('en', 'Test')
            
            // With fallback - TypeScript knows result is always string
            const withFallback: string = resolveVlcContent(vlc, 'en', 'Fallback')
            expect(withFallback).toBe('Test')
            
            // Without fallback - TypeScript knows result can be undefined
            const withoutFallback: string | undefined = resolveVlcContent(vlc, 'en')
            expect(withoutFallback).toBe('Test')
        })
    })

    describe('getVlcLocales', () => {
        it('returns list of active locales', () => {
            const vlc = createVlc('en', 'English')
            const updated = updateVlcLocale(vlc, 'ru', 'Русский')

            const locales = getVlcLocales(updated)
            expect(locales).toContain('en')
            expect(locales).toContain('ru')
            expect(locales).toHaveLength(2)
        })

        it('returns empty array for null/undefined', () => {
            expect(getVlcLocales(null)).toEqual([])
            expect(getVlcLocales(undefined)).toEqual([])
        })

        it('filters out inactive locales', () => {
            const vlc = createVlc('en', 'English')
            const withInactive: VersionedLocalizedContent<string> = {
                ...vlc,
                locales: {
                    en: vlc.locales.en!,
                    ru: {
                        content: 'Inactive',
                        version: 1,
                        isActive: false,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                }
            }

            const locales = getVlcLocales(withInactive)
            expect(locales).toContain('en')
            expect(locales).not.toContain('ru')
            expect(locales).toHaveLength(1)
        })
    })

    describe('isVlc', () => {
        it('returns true for valid VLC object', () => {
            const vlc = createVlc('en', 'Test')
            expect(isVlc(vlc)).toBe(true)
        })

        it('returns false for non-VLC objects', () => {
            expect(isVlc(null)).toBe(false)
            expect(isVlc(undefined)).toBe(false)
            expect(isVlc('string')).toBe(false)
            expect(isVlc({ name: 'test' })).toBe(false)
            expect(isVlc({ _schema: '2' })).toBe(false)
        })

        it('returns true for VLC-like object from API', () => {
            // Simulates data from Supabase
            const apiResponse = {
                _schema: '1',
                _primary: 'en',
                locales: {
                    en: {
                        content: 'Super User',
                        version: 5,
                        isActive: true,
                        createdAt: '2024-12-06T00:00:00.000Z',
                        updatedAt: '2025-12-12T15:45:20.942Z'
                    }
                }
            }
            expect(isVlc(apiResponse)).toBe(true)
        })

        it('returns false for objects missing required _schema field', () => {
            expect(isVlc({ _primary: 'en', locales: {} })).toBe(false)
        })
    })
})
