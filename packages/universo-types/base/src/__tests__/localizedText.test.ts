import { describe, expect, it } from 'vitest'

import { isLocalizedTextValue, readLocalizedTextValue } from '../common/localizedText'

describe('localized text helpers', () => {
    it('reads versioned localized content using requested locale and fallbacks', () => {
        const value = {
            _schema: '1',
            _primary: 'en',
            locales: {
                en: { content: 'English title' },
                ru: { content: 'Русский заголовок' }
            }
        }

        expect(readLocalizedTextValue(value, 'ru-RU')).toBe('Русский заголовок')
        expect(readLocalizedTextValue(value, 'de-DE')).toBe('English title')
        expect(isLocalizedTextValue(value)).toBe(true)
    })

    it('supports legacy locale-key records without treating arbitrary JSON as localized text', () => {
        expect(readLocalizedTextValue({ en: 'Course', ru: 'Курс' }, 'ru')).toBe('Курс')
        expect(readLocalizedTextValue({ id: 'row-1', name: 'Course' }, 'ru')).toBeUndefined()
        expect(isLocalizedTextValue({ id: 'row-1', name: 'Course' })).toBe(false)
    })
})
