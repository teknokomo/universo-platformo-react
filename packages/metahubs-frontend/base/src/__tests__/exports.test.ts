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
vi.mock('../domains/branches/ui/BranchList', () => ({ default: () => null }))
vi.mock('../domains/entities/ui/EntitiesWorkspace', () => ({ default: () => null }))
vi.mock('../domains/entities/ui/EntityInstanceList', () => ({ default: () => null }))
vi.mock('../domains/entities/ui/BuiltinEntityCollectionPage', () => ({
    BuiltinEntityCollectionPage: () => null,
    StandardEntityChildCollectionPage: () => null
}))
vi.mock('../domains/entities/metadata/fieldDefinition/ui/FieldDefinitionList', () => ({ default: () => null }))
vi.mock('../domains/entities/metadata/record/ui/RecordList', () => ({ default: () => null }))
vi.mock('../domains/entities/metadata/fixedValue/ui/FixedValueList', () => ({ default: () => null }))
vi.mock('../domains/entities/shared/ui/SharedResourcesPage', () => ({ default: () => null }))
vi.mock('../domains/layouts/ui/LayoutList', () => ({ default: () => null }))
vi.mock('../domains/layouts/ui/LayoutDetails', () => ({ default: () => null }))

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
        expect(entry.BranchList).toBeTruthy()
        expect(entry.EntitiesWorkspace).toBeTruthy()
        expect(entry.EntityInstanceList).toBeTruthy()
        expect(entry.BuiltinEntityCollectionPage).toBeTruthy()
        expect(entry.StandardEntityChildCollectionPage).toBeTruthy()
        expect(entry.FieldDefinitionList).toBeTruthy()
        expect(entry.RecordList).toBeTruthy()
        expect(entry.MetahubResources).toBeTruthy()
        expect(entry.MetahubLayouts).toBeTruthy()
        expect(entry.MetahubLayoutDetails).toBeTruthy()
        expect(entry.metahubsDashboard).toBeTruthy()
        expect(entry.metahubsTranslations).toBeTruthy()
    }, 90000)

    it('exports metahubs dashboard menu structure', async () => {
        const { default: metahubDashboard } = await import('../menu-items/metahubDashboard')

        expect(metahubDashboard.id).toBe('dashboard')
        expect(metahubDashboard.type).toBe('group')
        expect(Array.isArray(metahubDashboard.children)).toBe(true)
        expect(metahubDashboard.children?.length).toBeGreaterThan(0)
        expect(metahubDashboard.children?.some((item) => item.id === 'entities')).toBe(true)
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

        expect((en as any).general.title).toBe('Resources')
        expect((en as any).linkedCollections.tabs.layout).toBe('Layouts')
        expect((en as any).linkedCollections.runtime.showSearch).toBe('Search/filter bar')
        expect((en as any).linkedCollections.runtime.createSurface).toBe('Create form type')
        expect((en as any).linkedCollections.runtime.surfacePage).toBe('Page')
        expect((en as any).entities.title).toBe('Entities')
        expect((en as any).valueGroups.tabs).toEqual({
            general: 'General',
            options: 'Options'
        })
        expect((en as any).valueGroups.runtime).toBeUndefined()

        expect((ru as any).general.title).toBe('Ресурсы')
        expect((ru as any).linkedCollections.tabs.layout).toBe('Макеты')
        expect((ru as any).linkedCollections.runtime.showSearch).toBe('Строка поиска/фильтрации')
        expect((ru as any).linkedCollections.runtime.createSurface).toBe('Тип окна создания')
        expect((ru as any).entities.title).toBe('Сущности')
    })
})
