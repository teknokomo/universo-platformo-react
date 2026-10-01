import {
    buildFormDataSignature,
    getMissingRequiredLocale,
    hasLocalizedLocaleValue,
    resolveEffectiveField
} from '../dynamicEntityFormValidation'

describe('dynamic entity form validation helpers', () => {
    describe('getMissingRequiredLocale', () => {
        const localizedRequiredField = {
            type: 'STRING',
            required: true,
            validationRules: { localized: true, requiredLocales: ['en', 'ru'] }
        }

        it('returns the first locale without non-blank localized content', () => {
            expect(
                getMissingRequiredLocale(localizedRequiredField, {
                    locales: {
                        en: { content: 'Welcome' },
                        ru: { content: '   ' }
                    }
                })
            ).toBe('ru')
        })

        it('does not enforce locales for non-string, unlocalized, or empty optional fields', () => {
            const emptyValue = { locales: { en: { content: '' }, ru: { content: '' } } }

            expect(getMissingRequiredLocale({ ...localizedRequiredField, type: 'JSON' }, emptyValue)).toBeNull()
            expect(
                getMissingRequiredLocale(
                    { ...localizedRequiredField, validationRules: { ...localizedRequiredField.validationRules, localized: false } },
                    emptyValue
                )
            ).toBeNull()
            expect(getMissingRequiredLocale({ ...localizedRequiredField, required: false }, emptyValue)).toBeNull()
        })

        it('enforces all configured locales for an optional field after localized content is authored', () => {
            const authoredValue = {
                locales: {
                    en: { content: 'Welcome' }
                }
            }

            expect(getMissingRequiredLocale({ ...localizedRequiredField, required: false }, authoredValue)).toBe('ru')
            expect(hasLocalizedLocaleValue(authoredValue, 'en-GB')).toBe(true)
        })

        it('returns null after every required locale is filled', () => {
            expect(
                getMissingRequiredLocale(localizedRequiredField, {
                    locales: {
                        en: { content: 'Welcome' },
                        ru: { content: 'Добро пожаловать' }
                    }
                })
            ).toBeNull()
        })
    })

    describe('resolveEffectiveField', () => {
        it('resolves conditional requirements for matching values including false', () => {
            const field = {
                type: 'STRING',
                required: false,
                validationRules: { requiredWhen: { field: 'Decorative', equals: false } }
            }

            expect(resolveEffectiveField(field, { Decorative: false }).required).toBe(true)
            expect(resolveEffectiveField(field, { Decorative: true }).required).toBe(false)
            expect(field.required).toBe(false)
        })

        it('preserves unconditional required fields and returns fields without conditions unchanged', () => {
            const alwaysRequired = {
                type: 'STRING',
                required: true,
                validationRules: { requiredWhen: { field: 'Decorative', equals: false } }
            }
            const noCondition = { type: 'STRING', required: false }

            expect(resolveEffectiveField(alwaysRequired, { Decorative: true }).required).toBe(true)
            expect(resolveEffectiveField(noCondition, {})).toBe(noCondition)
        })
    })

    describe('buildFormDataSignature', () => {
        it('sorts top-level fields and excludes metadata and blank localized content', () => {
            const first = buildFormDataSignature({
                _schema: 'v1',
                Title: { locales: { en: { content: 'Welcome' } } },
                Empty: { locales: { en: { content: '  ' } } },
                Enabled: true
            })
            const reordered = buildFormDataSignature({
                Enabled: true,
                Empty: { locales: { en: { content: '' } } },
                Title: { locales: { en: { content: 'Welcome' } } },
                _internal: 'ignored'
            })

            expect(first).toBe(reordered)
        })

        it('changes when user-authored form data changes', () => {
            expect(buildFormDataSignature({ Title: 'Before' })).not.toBe(buildFormDataSignature({ Title: 'After' }))
        })
    })
})
