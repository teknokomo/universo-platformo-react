import { describe, expect, it } from 'vitest'

import { resolvePublicGuestRuntimeLocale } from './publicGuestRuntimeLocale'

describe('resolvePublicGuestRuntimeLocale', () => {
    it('prefers an explicit locale query over browser defaults', () => {
        expect(
            resolvePublicGuestRuntimeLocale({
                location: {
                    search: '?locale=ru'
                },
                navigator: {
                    language: 'en-US',
                    languages: ['en-US', 'en']
                },
                document: {
                    documentElement: {
                        lang: 'en'
                    }
                }
            })
        ).toBe('ru')
    })

    it('prefers the persisted i18next locale over browser defaults when no explicit query exists', () => {
        expect(
            resolvePublicGuestRuntimeLocale({
                localStorage: {
                    getItem: (key) => (key === 'i18nextLng' ? 'ru-RU' : null)
                },
                navigator: {
                    language: 'en-US',
                    languages: ['en-US', 'en']
                },
                document: {
                    documentElement: {
                        lang: 'en'
                    }
                }
            })
        ).toBe('ru')
    })

    it('prefers browser languages over stale document lang', () => {
        expect(
            resolvePublicGuestRuntimeLocale({
                navigator: {
                    language: 'en-US',
                    languages: ['en-US', 'en']
                },
                document: {
                    documentElement: {
                        lang: 'ru'
                    }
                }
            })
        ).toBe('en')
    })

    it('falls back to document lang when browser language is unavailable', () => {
        expect(
            resolvePublicGuestRuntimeLocale({
                navigator: {},
                document: {
                    documentElement: {
                        lang: 'ru-RU'
                    }
                }
            })
        ).toBe('ru')
    })

    it('defaults to en when no locale source is usable', () => {
        expect(resolvePublicGuestRuntimeLocale({ navigator: {}, document: {} })).toBe('en')
    })
})
