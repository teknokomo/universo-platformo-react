import { describe, expect, it } from 'vitest'

import { mapBaseVlcFields } from '../mapBaseVlcFields'

describe('mapBaseVlcFields', () => {
    it('extracts VLC strings for name and description', () => {
        const entity = {
            id: '1',
            codename: 'test-code',
            name: {
                locales: { en: { content: 'English Name' }, ru: { content: 'Русское Имя' } },
                primaryLocale: 'en'
            },
            description: {
                locales: { en: { content: 'English Description' } },
                primaryLocale: 'en'
            }
        }

        const result = mapBaseVlcFields(entity, 'en')

        expect(result.codename).toBe('test-code')
        expect(result.name).toBe('English Name')
        expect(result.description).toBe('English Description')
        expect(result.id).toBe('1')
    })

    it('uses specified locale for name/description', () => {
        const entity = {
            codename: 'test',
            name: {
                locales: { en: { content: 'English' }, ru: { content: 'Русский' } },
                primaryLocale: 'en'
            },
            description: null
        }

        const result = mapBaseVlcFields(entity, 'ru')

        expect(result.name).toBe('Русский')
        expect(result.description).toBe('')
    })

    it('defaults to "en" locale when not specified', () => {
        const entity = {
            codename: 'test',
            name: {
                locales: { en: { content: 'Default English' } },
                primaryLocale: 'en'
            },
            description: null
        }

        const result = mapBaseVlcFields(entity)

        expect(result.name).toBe('Default English')
    })

    it('handles VLC codename (extracts primary string)', () => {
        const entity = {
            codename: {
                locales: { en: { content: 'vlc-codename' } },
                primaryLocale: 'en'
            },
            name: null,
            description: null
        }

        const result = mapBaseVlcFields(entity, 'en')

        expect(result.codename).toBe('vlc-codename')
    })

    it('returns empty strings for null/undefined VLC fields', () => {
        const entity = {
            codename: null,
            name: null,
            description: undefined
        }

        const result = mapBaseVlcFields(entity as Record<string, unknown>, 'en')

        expect(result.codename).toBe('')
        expect(result.name).toBe('')
        expect(result.description).toBe('')
    })

    it('preserves all other entity properties', () => {
        const entity = {
            id: 'abc',
            sortOrder: 5,
            isActive: true,
            codename: 'test',
            name: null,
            description: null
        }

        const result = mapBaseVlcFields(entity, 'en')

        expect(result.id).toBe('abc')
        expect(result.sortOrder).toBe(5)
        expect(result.isActive).toBe(true)
    })
})
