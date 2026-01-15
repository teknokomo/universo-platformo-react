import { beforeEach, describe, expect, it, vi } from 'vitest'

// Prevent jsdom/canvas native dependency chain pulled by markdown-related packages.
vi.mock('rehype-mathjax', () => ({ default: () => {} }))
vi.mock('rehype-raw', () => ({ default: () => {} }))
vi.mock('remark-gfm', () => ({ default: () => {} }))
vi.mock('remark-math', () => ({ default: () => {} }))

// The entry re-exports full page modules; mock them to keep this test fast and stable.
vi.mock('../pages/ApplicationList', () => ({ default: () => null }))
vi.mock('../pages/ApplicationBoard', () => ({ default: () => null }))
vi.mock('../pages/ApplicationMembers', () => ({ default: () => null }))
vi.mock('../pages/ApplicationActions', () => ({ default: () => null }))
vi.mock('../pages/ApplicationMemberActions', () => ({ default: () => null }))
vi.mock('../pages/ConnectorList', () => ({ default: () => null }))
vi.mock('../pages/ConnectorActions', () => ({ default: () => null }))

// Avoid pulling in @universo/template-mui (and its side-effect registrations) through ResourceGuard.
vi.mock('../components/ApplicationGuard', () => ({ ApplicationGuard: () => null }))

// Index has a required side-effect import of "./i18n". Mock it here so this test doesn't
// have to load the entire i18n registry + JSON resource graph just to assert exports.
vi.mock('../i18n', () => ({
    applicationsTranslations: { en: {}, ru: {} },
    getApplicationsTranslations: () => ({})
}))

beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
})

describe('applications-frontend entry exports', () => {
    it('exports main pages and menu', async () => {
        const entry = await import('../index')

        expect(entry).toBeTruthy()
        expect(entry.ApplicationList).toBeTruthy()
        expect(entry.ApplicationBoard).toBeTruthy()
        expect(entry.ApplicationMembers).toBeTruthy()
        expect(entry.ApplicationActions).toBeTruthy()
        expect(entry.ApplicationMemberActions).toBeTruthy()
        expect(entry.ConnectorList).toBeTruthy()
        expect(entry.ConnectorActions).toBeTruthy()
        expect(entry.applicationsDashboard).toBeTruthy()
        expect(entry.applicationsTranslations).toBeTruthy()

        expect(entry.ApplicationGuard).toBeTruthy()
        expect(entry.ConnectorDeleteDialog).toBeTruthy()

        expect(entry.toApplicationDisplay).toBeTruthy()
        expect(entry.toConnectorDisplay).toBeTruthy()
        expect(entry.getVLCString).toBeTruthy()
    }, 15000)

    it('exports applications dashboard menu structure', async () => {
        const { default: applicationDashboard } = await import('../menu-items/applicationDashboard')

        expect(applicationDashboard.id).toBe('dashboard')
        expect(applicationDashboard.type).toBe('group')
        expect(Array.isArray(applicationDashboard.children)).toBe(true)
        expect(applicationDashboard.children?.length).toBeGreaterThan(0)
    })

    it('applications translations helper returns en/ru and falls back', async () => {
        const { getApplicationsTranslations, applicationsTranslations } = await vi.importActual<typeof import('../i18n')>('../i18n')

        expect(applicationsTranslations.en).toBeTruthy()
        expect(applicationsTranslations.ru).toBeTruthy()

        const en = getApplicationsTranslations('en')
        const ru = getApplicationsTranslations('ru')
        const fallback = getApplicationsTranslations('fr' as any)

        expect(typeof en).toBe('object')
        expect(typeof ru).toBe('object')
        expect(typeof fallback).toBe('object')
    }, 15000)
})
