import { describe, it, expect } from 'vitest'
import {
    createLocalizedContent,
    updateLocalizedContentLocale,
    resolveLocalizedContent,
    getLocalizedContentLocales,
    isLocalizedContent
} from '../index'
import type { VersionedLocalizedContent } from '@universo/types'

describe('Localized Content Utilities', () => {
    describe('createLocalizedContent', () => {
        it('creates content with primary locale and content', () => {
            const content = createLocalizedContent('en', 'Test Content')

            expect(content._schema).toBe('1')
            expect(content._primary).toBe('en')
            expect(content.locales.en?.content).toBe('Test Content')
            expect(content.locales.en?.version).toBe(1)
            expect(content.locales.en?.isActive).toBe(true)
        })

        it('creates content with Russian as primary locale', () => {
            const content = createLocalizedContent('ru', 'Тестовое содержимое')

            expect(content._primary).toBe('ru')
            expect(content.locales.ru?.content).toBe('Тестовое содержимое')
        })

        it('generates valid ISO 8601 timestamps', () => {
            const content = createLocalizedContent('en', 'Test')
            const entry = content.locales.en!

            expect(() => new Date(entry.createdAt)).not.toThrow()
            expect(() => new Date(entry.updatedAt)).not.toThrow()
            expect(entry.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
            expect(entry.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
        })
    })

    describe('updateLocalizedContentLocale', () => {
        it('updates existing locale immutably', () => {
            const original = createLocalizedContent('en', 'Original')
            const updated = updateLocalizedContentLocale(original, 'en', 'Updated')

            // Original unchanged (immutable)
            expect(original.locales.en?.content).toBe('Original')
            expect(original.locales.en?.version).toBe(1)

            // Updated has new content and incremented version
            expect(updated.locales.en?.content).toBe('Updated')
            expect(updated.locales.en?.version).toBe(2)
        })

        it('adds new locale to content', () => {
            const original = createLocalizedContent('en', 'English')
            const updated = updateLocalizedContentLocale(original, 'ru', 'Русский')

            expect(updated.locales.en?.content).toBe('English')
            expect(updated.locales.ru?.content).toBe('Русский')
            expect(updated.locales.ru?.version).toBe(1)
        })

        it('preserves _primary when adding new locale', () => {
            const original = createLocalizedContent('en', 'English')
            const updated = updateLocalizedContentLocale(original, 'ru', 'Русский')

            expect(updated._primary).toBe('en')
        })

        it('updates timestamps correctly', () => {
            const original = createLocalizedContent('en', 'Original')
            // Small delay to ensure different timestamps
            const beforeUpdate = Date.now()
            const updated = updateLocalizedContentLocale(original, 'en', 'Updated')
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

    describe('resolveLocalizedContent', () => {
        it('returns content for requested locale', () => {
            const content = createLocalizedContent('en', 'English')
            const updated = updateLocalizedContentLocale(content, 'ru', 'Русский')

            expect(resolveLocalizedContent(updated, 'en')).toBe('English')
            expect(resolveLocalizedContent(updated, 'ru')).toBe('Русский')
        })

        it('falls back to primary locale when requested not found', () => {
            const content = createLocalizedContent('en', 'English Only')

            expect(resolveLocalizedContent(content, 'ru')).toBe('English Only')
        })

        it('returns fallback for null/undefined content', () => {
            expect(resolveLocalizedContent(null, 'en')).toBeUndefined()
            expect(resolveLocalizedContent(undefined, 'en')).toBeUndefined()
            expect(resolveLocalizedContent(null, 'en', 'Fallback')).toBe('Fallback')
        })

        it('handles content with missing locales gracefully', () => {
            const malformed = {
                _schema: '1' as const,
                _primary: 'en' as const,
                locales: {}
            } satisfies VersionedLocalizedContent<string>

            expect(resolveLocalizedContent(malformed, 'en', 'Fallback')).toBe('Fallback')
        })

        it('handles inactive locale entries', () => {
            const content = createLocalizedContent('en', 'Active')
            // Manually create inactive locale for testing
            const withInactive: VersionedLocalizedContent<string> = {
                ...content,
                locales: {
                    en: {
                        ...content.locales.en!,
                        isActive: false
                    }
                }
            }

            expect(resolveLocalizedContent(withInactive, 'en', 'Fallback')).toBe('Fallback')
        })

        it('guarantees non-undefined return when fallback provided (type safety)', () => {
            const content = createLocalizedContent('en', 'Test')

            // With fallback - TypeScript knows result is always string
            const withFallback: string = resolveLocalizedContent(content, 'en', 'Fallback')
            expect(withFallback).toBe('Test')

            // Without fallback - TypeScript knows result can be undefined
            const withoutFallback: string | undefined = resolveLocalizedContent(content, 'en')
            expect(withoutFallback).toBe('Test')
        })
    })

    describe('getLocalizedContentLocales', () => {
        it('returns list of active locales', () => {
            const content = createLocalizedContent('en', 'English')
            const updated = updateLocalizedContentLocale(content, 'ru', 'Русский')

            const locales = getLocalizedContentLocales(updated)
            expect(locales).toContain('en')
            expect(locales).toContain('ru')
            expect(locales).toHaveLength(2)
        })

        it('returns empty array for null/undefined', () => {
            expect(getLocalizedContentLocales(null)).toEqual([])
            expect(getLocalizedContentLocales(undefined)).toEqual([])
        })

        it('filters out inactive locales', () => {
            const content = createLocalizedContent('en', 'English')
            const withInactive: VersionedLocalizedContent<string> = {
                ...content,
                locales: {
                    en: content.locales.en!,
                    ru: {
                        content: 'Inactive',
                        version: 1,
                        isActive: false,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                }
            }

            const locales = getLocalizedContentLocales(withInactive)
            expect(locales).toContain('en')
            expect(locales).not.toContain('ru')
            expect(locales).toHaveLength(1)
        })
    })

    describe('isLocalizedContent', () => {
        it('returns true for valid localized content object', () => {
            const content = createLocalizedContent('en', 'Test')
            expect(isLocalizedContent(content)).toBe(true)
        })

        it('returns false for non-content objects', () => {
            expect(isLocalizedContent(null)).toBe(false)
            expect(isLocalizedContent(undefined)).toBe(false)
            expect(isLocalizedContent('string')).toBe(false)
            expect(isLocalizedContent({ name: 'test' })).toBe(false)
            expect(isLocalizedContent({ _schema: '2' })).toBe(false)
        })

        it('returns true for content-like object from API', () => {
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
            expect(isLocalizedContent(apiResponse)).toBe(true)
        })

        it('returns false for objects missing required _schema field', () => {
            expect(isLocalizedContent({ _primary: 'en', locales: {} })).toBe(false)
        })
    })
})
