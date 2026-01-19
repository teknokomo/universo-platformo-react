import { beforeEach, describe, expect, it, vi } from 'vitest'

// Prevent jsdom/canvas native dependency chain pulled by markdown-related packages.
vi.mock('rehype-mathjax', () => ({ default: () => {} }))
vi.mock('rehype-raw', () => ({ default: () => {} }))
vi.mock('remark-gfm', () => ({ default: () => {} }))
vi.mock('remark-math', () => ({ default: () => {} }))

// The entry re-exports full page modules; mock them to keep this test fast and stable.
vi.mock('../domains/metahubs/ui/MetahubList', () => ({ default: () => null }))
vi.mock('../domains/metahubs/ui/MetahubBoard', () => ({ default: () => null }))
vi.mock('../domains/metahubs/ui/MetahubMembers', () => ({ default: () => null }))
vi.mock('../domains/publications/ui/PublicationList', () => ({ default: () => null }))
vi.mock('../domains/hubs/ui/HubList', () => ({ default: () => null }))
vi.mock('../domains/catalogs/ui/CatalogList', () => ({ default: () => null }))
vi.mock('../domains/attributes/ui/AttributeList', () => ({ default: () => null }))
vi.mock('../domains/records/ui/RecordList', () => ({ default: () => null }))

beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
})

describe('metahubs-frontend entry exports', () => {
    it('exports main pages and menu', async () => {
        // Import via package entry to cover side-effect i18n registration and re-exports
        const entry = await import('../index')

        expect(entry).toBeTruthy()
        expect(entry.MetahubList).toBeTruthy()
        expect(entry.MetahubBoard).toBeTruthy()
        expect(entry.MetahubMembers).toBeTruthy()
        expect(entry.PublicationList).toBeTruthy()
        expect(entry.HubList).toBeTruthy()
        expect(entry.CatalogList).toBeTruthy()
        expect(entry.AttributeList).toBeTruthy()
        expect(entry.RecordList).toBeTruthy()
        expect(entry.metahubsDashboard).toBeTruthy()
        expect(entry.metahubsTranslations).toBeTruthy()
    }, 10000)

    it('exports metahubs dashboard menu structure', async () => {
        const { default: metahubDashboard } = await import('../menu-items/metahubDashboard')

        expect(metahubDashboard.id).toBe('dashboard')
        expect(metahubDashboard.type).toBe('group')
        expect(Array.isArray(metahubDashboard.children)).toBe(true)
        expect(metahubDashboard.children?.length).toBeGreaterThan(0)
    })

    it('metahubs translations helper returns en/ru and falls back', async () => {
        const { getMetahubsTranslations, metahubsTranslations } = await import('../i18n')

        expect(metahubsTranslations.en).toBeTruthy()
        expect(metahubsTranslations.ru).toBeTruthy()

        const en = getMetahubsTranslations('en')
        const ru = getMetahubsTranslations('ru')
        const fallback = getMetahubsTranslations('fr' as any)

        expect(typeof en).toBe('object')
        expect(typeof ru).toBe('object')
        expect(typeof fallback).toBe('object')
    })
})
