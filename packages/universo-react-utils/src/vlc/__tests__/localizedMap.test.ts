import { describe, expect, it } from 'vitest'
import { toLocalizedStringMap } from '../index'

describe('toLocalizedStringMap', () => {
    it('normalizes simple locale maps and excludes metadata fields', () => {
        expect(toLocalizedStringMap({ en: 'Welcome', ru: 'Добро пожаловать', _schema: '1', _primary: 'en' })).toEqual({
            en: 'Welcome',
            ru: 'Добро пожаловать'
        })
    })

    it('keeps only active string values from versioned localized content', () => {
        expect(
            toLocalizedStringMap({
                _schema: '1',
                _primary: 'en',
                locales: {
                    en: { content: 'Welcome', isActive: true },
                    ru: { content: 'Добро пожаловать', isActive: false },
                    de: { content: 42, isActive: true }
                }
            })
        ).toEqual({ en: 'Welcome' })
    })

    it('fails closed when a localized wrapper has no active locale entries', () => {
        expect(toLocalizedStringMap({ _schema: '1', _primary: 'en', en: 'legacy value', locales: {} })).toBeUndefined()
        expect(toLocalizedStringMap({ locales: { en: { content: 'Inactive', isActive: false } } })).toBeUndefined()
        expect(toLocalizedStringMap('plain string')).toBeUndefined()
    })
})
