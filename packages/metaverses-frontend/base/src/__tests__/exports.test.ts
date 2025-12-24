import { beforeEach, describe, expect, it, vi } from 'vitest'

// Prevent jsdom/canvas native dependency chain pulled by markdown-related packages.
vi.mock('rehype-mathjax', () => ({ default: () => {} }))
vi.mock('rehype-raw', () => ({ default: () => {} }))
vi.mock('remark-gfm', () => ({ default: () => {} }))
vi.mock('remark-math', () => ({ default: () => {} }))

// The entry re-exports full page modules; mock them to keep this test fast and stable.
vi.mock('../pages/MetaverseList', () => ({ default: () => null }))
vi.mock('../pages/MetaverseBoard', () => ({ default: () => null }))
vi.mock('../pages/SectionList', () => ({ default: () => null }))
vi.mock('../pages/EntityList', () => ({ default: () => null }))
vi.mock('../pages/MetaverseMembers', () => ({ default: () => null }))

beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
})

describe('metaverses-frontend entry exports', () => {
    it(
        'exports main pages and menu',
        async () => {
        // Import via package entry to cover side-effect i18n registration and re-exports
        const entry = await import('../index')

        expect(entry).toBeTruthy()
        expect(entry.MetaverseList).toBeTruthy()
        expect(entry.MetaverseBoard).toBeTruthy()
        expect(entry.SectionList).toBeTruthy()
        expect(entry.EntityList).toBeTruthy()
        expect(entry.MetaverseMembers).toBeTruthy()
        expect(entry.metaversesDashboard).toBeTruthy()
        expect(entry.metaversesTranslations).toBeTruthy()
        },
        10000
        )

    it('exports metaverse dashboard menu structure', async () => {
        const { default: metaversesDashboard } = await import('../menu-items/metaverseDashboard')

        expect(metaversesDashboard.id).toBe('dashboard')
        expect(metaversesDashboard.type).toBe('group')
        expect(Array.isArray(metaversesDashboard.children)).toBe(true)
        expect(metaversesDashboard.children?.length).toBeGreaterThan(0)
    })

    it('metaverses translations helper returns en/ru and falls back', async () => {
        const { getMetaversesTranslations, metaversesTranslations } = await import('../i18n')

        expect(metaversesTranslations.en).toBeTruthy()
        expect(metaversesTranslations.ru).toBeTruthy()

        const en = getMetaversesTranslations('en')
        const ru = getMetaversesTranslations('ru')
        const fallback = getMetaversesTranslations('fr' as any)

        expect(typeof en).toBe('object')
        expect(typeof ru).toBe('object')
        expect(typeof fallback).toBe('object')
    })
})
