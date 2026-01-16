import { describe, expect, it } from 'vitest'
import { createLocalizedContent, updateLocalizedContentLocale } from '@universo/utils'

import { ensureLocalizedContent, extractLocalizedInput, hasPrimaryContent } from '../localizedInput'

describe('localizedInput utils', () => {
    it('extracts normalized input and primary locale', () => {
        const content = createLocalizedContent('en', ' Hello ')
        const result = extractLocalizedInput(content)

        expect(result).toEqual({ input: { en: 'Hello' }, primaryLocale: 'en' })
    })

    it('returns undefined for empty or missing content', () => {
        const emptyContent = createLocalizedContent('en', '   ')

        expect(extractLocalizedInput(null)).toEqual({ input: undefined, primaryLocale: undefined })
        expect(extractLocalizedInput(undefined)).toEqual({ input: undefined, primaryLocale: undefined })
        expect(extractLocalizedInput(emptyContent)).toEqual({ input: undefined, primaryLocale: undefined })
    })

    it('uses first available locale when primary is empty', () => {
        const content = updateLocalizedContentLocale(createLocalizedContent('en', '   '), 'ru', 'Hello RU')
        const result = extractLocalizedInput(content)

        expect(result).toEqual({ input: { ru: 'Hello RU' }, primaryLocale: 'ru' })
    })

    it('detects primary locale content presence', () => {
        const content = createLocalizedContent('en', 'Primary')
        const emptyPrimary = createLocalizedContent('en', '   ')

        expect(hasPrimaryContent(content)).toBe(true)
        expect(hasPrimaryContent(emptyPrimary)).toBe(false)
        expect(hasPrimaryContent(null)).toBe(false)
    })

    it('ensures localized content fallback behavior', () => {
        const existing = createLocalizedContent('en', 'Value')

        expect(ensureLocalizedContent(existing, 'ru', 'fallback')).toEqual(existing)
        expect(ensureLocalizedContent('Test', 'ru', 'fallback')).toMatchObject({
            _schema: '1',
            _primary: 'ru',
            locales: {
                ru: {
                    content: 'Test',
                    isActive: true,
                    version: 1
                }
            }
        })
        expect(ensureLocalizedContent(undefined, 'en', 'Fallback')).toMatchObject({
            _schema: '1',
            _primary: 'en',
            locales: {
                en: {
                    content: 'Fallback',
                    isActive: true,
                    version: 1
                }
            }
        })
    })
})
