import { describe, expect, it } from 'vitest'
import type { Component, RecordItem } from '../../../../types'
import { buildHeroRecordFields, getHeroRecordLabel, validateHeroRecordData } from '../marketingHeroAuthoring'

const makeComponent = (overrides: Partial<Component>): Component =>
    ({
        id: 'component-1',
        objectCollectionId: 'hero-object',
        codename: 'Title',
        dataType: 'STRING',
        name: 'Title',
        validationRules: {},
        uiConfig: {},
        isRequired: false,
        sortOrder: 0,
        createdAt: '',
        updatedAt: '',
        ...overrides
    } as Component)

const heroComponents = [
    makeComponent({ codename: 'HeroKey', uiConfig: { hidden: true }, isRequired: true }),
    makeComponent({
        codename: 'Title',
        name: 'Headline',
        validationRules: { localized: true },
        isRequired: true,
        isDisplayComponent: true
    }),
    makeComponent({ codename: 'PrimaryAction', dataType: 'JSON', validationRules: { format: 'marketingAction' }, isRequired: true }),
    makeComponent({ codename: 'TermsText', name: 'Terms', validationRules: { localized: true } }),
    makeComponent({ codename: 'TermsLinkLabel', name: 'Terms link', validationRules: { localized: true } }),
    makeComponent({ codename: 'TermsAction', dataType: 'JSON', validationRules: { format: 'marketingAction' } }),
    makeComponent({ codename: 'Published', name: 'Published', dataType: 'BOOLEAN' }),
    makeComponent({ codename: 'PublishedAt', name: 'Published at', dataType: 'DATE' }),
    makeComponent({ codename: 'PublishedBy', name: 'Published by', dataType: 'REF' }),
    makeComponent({ codename: 'DeletedAt', name: 'Deleted at', dataType: 'DATE' })
]
const localized = (en: string, ru: string) => ({
    locales: {
        en: { content: en, version: 1, isActive: true },
        ru: { content: ru, version: 1, isActive: true }
    }
})

describe('Marketing Hero Entity authoring contracts', () => {
    it('builds localized record fields without exposing the hidden semantic key', () => {
        const fields = buildHeroRecordFields(heroComponents, 'en', 'Content field')

        expect(fields.map((field) => field.id)).toEqual(['Title', 'PrimaryAction', 'TermsText', 'TermsLinkLabel', 'TermsAction'])
        expect(fields.map((field) => field.label)).not.toEqual(
            expect.arrayContaining(['Published', 'Published at', 'Published by', 'Deleted at'])
        )
        expect(fields.find((field) => field.id === 'Title')).toMatchObject({ label: 'Headline', localized: true, required: true })
        expect(fields.find((field) => field.id === 'PrimaryAction')).toMatchObject({ type: 'JSON', required: true })
    })

    it('validates typed actions and all-or-none optional terms fields before using the Entity records API', () => {
        const validAction = { kind: 'internal', path: '/auth' }
        const title = localized('Launch', 'Запуск')
        expect(validateHeroRecordData({ Title: title, PrimaryAction: validAction }, heroComponents, 'en')).toEqual({
            success: true,
            data: { Title: title, PrimaryAction: { kind: 'internal', path: '/auth', target: 'same-tab' } }
        })
        expect(
            validateHeroRecordData({ Title: title, PrimaryAction: { kind: 'external', url: 'javascript:alert(1)' } }, heroComponents, 'en')
        ).toEqual({
            success: false,
            error: 'invalidAction'
        })
        expect(
            validateHeroRecordData(
                { Title: title, PrimaryAction: validAction, TermsText: localized('Terms apply', 'Условия') },
                heroComponents,
                'en'
            )
        ).toEqual({
            success: false,
            error: 'termsGroup'
        })
    })

    it('requires English and Russian for required and authored optional localized fields', () => {
        const title = { locales: { en: { content: 'Launch', version: 1, isActive: true } } }
        expect(validateHeroRecordData({ Title: title, PrimaryAction: { kind: 'internal', path: '/auth' } }, heroComponents, 'en')).toEqual({
            success: false,
            error: 'missingLocale',
            field: 'Title',
            locale: 'ru'
        })

        const completeTitle = localized('Launch', 'Запуск')
        expect(
            validateHeroRecordData(
                { Title: completeTitle, Accent: { en: 'For teams' }, PrimaryAction: { kind: 'internal', path: '/auth' } },
                [...heroComponents, makeComponent({ codename: 'Accent', validationRules: { localized: true } })],
                'en'
            )
        ).toEqual({ success: false, error: 'missingLocale', field: 'Accent', locale: 'ru' })
    })

    it('treats inactive versioned locales as missing', () => {
        const title = {
            locales: {
                en: { content: 'Launch', version: 1, isActive: false },
                ru: { content: 'Запуск', version: 1, isActive: true }
            }
        }

        expect(validateHeroRecordData({ Title: title, PrimaryAction: { kind: 'internal', path: '/auth' } }, heroComponents, 'en')).toEqual({
            success: false,
            error: 'missingLocale',
            field: 'Title',
            locale: 'en'
        })
    })

    it('uses the localized display field and a neutral fallback instead of showing a record identifier', () => {
        const record = {
            id: 'record-secret-id',
            objectCollectionId: 'hero-object',
            data: { Title: 'Autumn launch' },
            ownerId: null,
            sortOrder: 0,
            createdAt: '',
            updatedAt: ''
        } as RecordItem

        expect(getHeroRecordLabel(record, heroComponents, 'en', 'Untitled Hero content')).toBe('Autumn launch')
        expect(getHeroRecordLabel({ ...record, data: {} }, heroComponents, 'en', 'Untitled Hero content')).toBe('Untitled Hero content')
    })
})
