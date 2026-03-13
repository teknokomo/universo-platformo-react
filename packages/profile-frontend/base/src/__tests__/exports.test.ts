import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../pages/Profile.jsx', () => ({ default: () => null }))

beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
})

describe('profile-frontend entry exports', () => {
    it('exports the profile page entry', async () => {
        const entry = await import('../index')

        expect(entry).toBeTruthy()
        expect(entry.ProfilePage).toBeTruthy()
    })

    it('exports profile translations and fallback helper', async () => {
        const { default: profileTranslations, getProfileTranslations } = await import('../i18n')

        expect(profileTranslations.en).toBeTruthy()
        expect(profileTranslations.ru).toBeTruthy()
        expect(typeof getProfileTranslations('en')).toBe('object')
        expect(typeof getProfileTranslations('ru')).toBe('object')
        expect(typeof getProfileTranslations('fr' as never)).toBe('object')
    })
})
