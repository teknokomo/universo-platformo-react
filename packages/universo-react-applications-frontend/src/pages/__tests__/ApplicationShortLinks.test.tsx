import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getInstance as getI18nInstance } from '@universo-react/i18n/instance'
import { registerNamespace } from '@universo-react/i18n/registry'
import commonEn from '@universo-react/i18n/locales/en/common.json'
import commonRu from '@universo-react/i18n/locales/ru/common.json'
import { getApplicationsTranslations } from '../../i18n'

const mocks = vi.hoisted(() => ({
    globalAccess: { isSuperuser: false, loading: false },
    list: vi.fn(),
    apiGet: vi.fn(),
    listQuizOptions: vi.fn(),
    listResourceOptions: vi.fn(),
    getApplication: vi.fn(),
    create: vi.fn(),
    release: vi.fn(),
    confirm: vi.fn().mockResolvedValue(true)
}))

vi.mock('@universo-react/store', () => ({
    useHasGlobalAccess: () => ({ ability: null, ...mocks.globalAccess })
}))

vi.mock('@universo-react/template-mui', () => ({
    APIEmptySVG: 'empty.svg',
    EmptyListState: ({ title }: { title: string }) => <div>{title}</div>,
    FlowListTable: ({
        data,
        customColumns
    }: {
        data: Array<{ id: string }>
        customColumns: Array<{ id: string; render?: (row: never) => ReactNode }>
    }) => (
        <div>
            {data.map((row) => (
                <div key={row.id}>
                    {customColumns.map((column) => (
                        <div key={column.id}>{column.render?.(row as never)}</div>
                    ))}
                </div>
            ))}
        </div>
    ),
    PaginationControls: ({
        pagination,
        actions,
        isLoading,
        rowsPerPageOptions
    }: {
        pagination: { currentPage: number; pageSize: number; hasNextPage: boolean; hasPreviousPage: boolean }
        actions: { nextPage: () => void; previousPage: () => void; setPageSize: (pageSize: number) => void }
        isLoading?: boolean
        rowsPerPageOptions: number[]
    }) => (
        <nav aria-label='Short links pagination'>
            <span>Page {pagination.currentPage}</span>
            <button type='button' disabled={isLoading || !pagination.hasPreviousPage} onClick={actions.previousPage}>
                Previous page
            </button>
            <button type='button' disabled={isLoading || !pagination.hasNextPage} onClick={actions.nextPage}>
                Next page
            </button>
            <label>
                Rows per page
                <select value={pagination.pageSize} onChange={(event) => actions.setPageSize(Number(event.target.value))}>
                    {rowsPerPageOptions.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
            </label>
        </nav>
    ),
    ViewHeaderMUI: ({ title, description }: { title: string; description: string }) => (
        <header>
            <h1>{title}</h1>
            <p>{description}</p>
        </header>
    ),
    Loader: () => <div>Loading</div>,
    useConfirm: () => ({ confirm: mocks.confirm })
}))

vi.mock('../../api/apiClient', () => ({ default: { get: mocks.apiGet } }))

vi.mock('../../api/globalShortLinksApi', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../api/globalShortLinksApi')>()
    return {
        ...actual,
        listGlobalShortLinks: mocks.list,
        listGlobalShortLinkQuizAccessOptions: mocks.listQuizOptions,
        listGlobalShortLinkResourceOptions: mocks.listResourceOptions,
        createGlobalShortLink: mocks.create,
        releaseGlobalShortLink: mocks.release
    }
})

vi.mock('../../api/applications', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../api/applications')>()
    return { ...actual, getApplication: mocks.getApplication }
})

import ApplicationShortLinks from '../ApplicationShortLinks'

const APPLICATION_ID = '0190a9b5-3cde-7abc-8def-0123456789ac'
const ACTIVE_QUIZ_LINK = {
    id: '0190a9b5-3cde-7abc-8def-0123456789ad',
    slug: 'marathon-grade-5',
    target: {
        kind: 'lms-access-link' as const,
        applicationId: APPLICATION_ID,
        accessLinkId: '0190a9b5-3cde-7abc-8def-0123456789b0',
        accessLinkSlug: 'grade-5',
        workspaceId: '0190a9b5-3cde-7abc-8def-0123456789ae'
    },
    releasedAt: null,
    createdAt: '2026-10-11T10:00:00.000Z',
    updatedAt: '2026-10-11T10:00:00.000Z'
}

const renderPage = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const i18n = getI18nInstance()
    return render(
        <I18nextProvider i18n={i18n}>
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={[`/a/${APPLICATION_ID}/admin/short-links`]}>
                    <Routes>
                        <Route path='/a/:applicationId/admin/short-links' element={<ApplicationShortLinks />} />
                        <Route path='/a/:applicationId/admin/settings' element={<div>Application settings destination</div>} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        </I18nextProvider>
    )
}

const selectQuizAccessDestination = async (user: ReturnType<typeof userEvent.setup>, locale: 'en' | 'ru' = 'en') => {
    const destinationLabel = locale === 'ru' ? 'Тип назначения' : 'Destination type'
    const targetLabel = locale === 'ru' ? 'Ссылка доступа к тесту' : 'Quiz access link'
    await user.click(await screen.findByRole('combobox', { name: destinationLabel }))
    await user.click(await screen.findByRole('option', { name: targetLabel, exact: true }))
}

describe('ApplicationShortLinks', () => {
    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    beforeEach(async () => {
        vi.clearAllMocks()
        mocks.apiGet.mockReset()
        mocks.globalAccess.isSuperuser = false
        mocks.globalAccess.loading = false
        const i18n = getI18nInstance()
        registerNamespace('common', { en: commonEn, ru: commonRu })
        registerNamespace('applications', { en: getApplicationsTranslations('en'), ru: getApplicationsTranslations('ru') })
        await i18n.changeLanguage('en')
        mocks.confirm.mockResolvedValue(true)
        mocks.list.mockResolvedValue({ items: [ACTIVE_QUIZ_LINK], hasMore: false })
        mocks.listQuizOptions.mockResolvedValue([
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789b0',
                slug: 'grade-5',
                label: 'Grade 5 — Marathon',
                workspaceId: '0190a9b5-3cde-7abc-8def-0123456789ae',
                workspaceLabel: 'Grade 5 workspace'
            },
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789b1',
                slug: 'grade-6',
                label: 'Grade 6 — Marathon',
                workspaceId: '0190a9b5-3cde-7abc-8def-0123456789af',
                workspaceLabel: 'Grade 6 workspace'
            }
        ])
        mocks.listResourceOptions.mockResolvedValue([
            { targetKind: 'page', entityTypeCodename: 'home', label: 'Marketing home' },
            { targetKind: 'object', entityTypeCodename: 'quizzes', label: 'Published quizzes' }
        ])
        mocks.getApplication.mockResolvedValue({
            data: {
                id: APPLICATION_ID,
                isPublic: true,
                workspacesEnabled: true,
                accessType: 'member',
                role: 'owner',
                permissions: { manageApplication: true }
            }
        })
        mocks.create.mockResolvedValue(ACTIVE_QUIZ_LINK)
        mocks.release.mockResolvedValue({ ...ACTIVE_QUIZ_LINK, releasedAt: '2026-10-11T10:10:00.000Z' })
    })

    it('defaults to a usable application entry when the application has no quiz access links', async () => {
        const user = userEvent.setup()
        mocks.listQuizOptions.mockResolvedValueOnce([])
        renderPage()

        await user.type(await screen.findByRole('textbox'), 'application-home')
        expect(screen.getByRole('combobox', { name: 'Destination type' })).toHaveTextContent('Application entry')
        expect(screen.queryByRole('combobox', { name: 'Published quiz' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Create link' })).toBeEnabled()

        await user.click(screen.getByRole('button', { name: 'Create link' }))

        await waitFor(() =>
            expect(mocks.create).toHaveBeenCalledWith({
                slug: 'application-home',
                target: { kind: 'application-entry', applicationId: APPLICATION_ID }
            })
        )
    })

    it('requests only the current server page and advances the offset when moving forward', async () => {
        const user = userEvent.setup()
        const nextPageLink = {
            ...ACTIVE_QUIZ_LINK,
            id: '0190a9b5-3cde-7abc-8def-0123456789af',
            slug: 'marathon-grade-6'
        }
        mocks.list
            .mockResolvedValueOnce({ items: [ACTIVE_QUIZ_LINK], hasMore: true })
            .mockResolvedValueOnce({ items: [nextPageLink], hasMore: false })
        renderPage()

        expect(await screen.findByText('Page 1')).toBeVisible()
        expect(mocks.list).toHaveBeenCalledWith({ applicationId: APPLICATION_ID, includeReleased: false, limit: 20, offset: 0 })
        await user.click(screen.getByRole('button', { name: 'Next page' }))

        expect(await screen.findByText('/l/marathon-grade-6')).toBeVisible()
        expect(screen.getByText('Page 2')).toBeVisible()
        expect(mocks.list).toHaveBeenLastCalledWith({ applicationId: APPLICATION_ID, includeReleased: false, limit: 20, offset: 20 })
    })

    it('uses a look-ahead row to determine whether another server page exists', async () => {
        const { listGlobalShortLinks } = await vi.importActual<typeof import('../../api/globalShortLinksApi')>(
            '../../api/globalShortLinksApi'
        )
        const serverRows = Array.from({ length: 21 }, (_, index) => ({
            ...ACTIVE_QUIZ_LINK,
            id: `0190a9b5-3cde-7abc-8def-${String(index).padStart(12, '0')}`,
            slug: `marathon-grade-${index}`
        }))
        mocks.apiGet.mockResolvedValueOnce({ data: { items: serverRows } })

        const page = await listGlobalShortLinks({ applicationId: APPLICATION_ID, limit: 20, offset: 40 })

        expect(page.items).toEqual(serverRows.slice(0, 20))
        expect(page.hasMore).toBe(true)
        expect(mocks.apiGet).toHaveBeenCalledWith('/global-short-links', {
            params: { applicationId: APPLICATION_ID, includeReleased: false, limit: 21, offset: 40 }
        })
    })

    it('probes beyond a full 100-row server response without exceeding the backend limit', async () => {
        const { listGlobalShortLinks } = await vi.importActual<typeof import('../../api/globalShortLinksApi')>(
            '../../api/globalShortLinksApi'
        )
        const serverRows = Array.from({ length: 100 }, (_, index) => ({
            ...ACTIVE_QUIZ_LINK,
            id: `0190a9b5-3cde-7abc-8def-${String(index).padStart(12, '0')}`,
            slug: `marathon-grade-${index}`
        }))
        mocks.apiGet
            .mockResolvedValueOnce({ data: { items: serverRows } })
            .mockResolvedValueOnce({ data: { items: [{ ...ACTIVE_QUIZ_LINK, slug: 'marathon-grade-next' }] } })

        const page = await listGlobalShortLinks({ applicationId: APPLICATION_ID, limit: 100, offset: 100 })

        expect(page.items).toEqual(serverRows)
        expect(page.hasMore).toBe(true)
        expect(mocks.apiGet).toHaveBeenNthCalledWith(1, '/global-short-links', {
            params: { applicationId: APPLICATION_ID, includeReleased: false, limit: 100, offset: 100 }
        })
        expect(mocks.apiGet).toHaveBeenNthCalledWith(2, '/global-short-links', {
            params: { applicationId: APPLICATION_ID, includeReleased: false, limit: 1, offset: 200 }
        })
    })

    it('creates an LMS short link with the selected quiz workspace scope', async () => {
        const user = userEvent.setup()
        renderPage()

        await screen.findByRole('textbox')
        await user.type(screen.getByRole('textbox'), 'marathon-grade-6')
        await selectQuizAccessDestination(user)
        await user.click(screen.getByRole('combobox', { name: 'Published quiz' }))
        await user.click(await screen.findByRole('option', { name: 'Grade 6 — Marathon — Grade 6 workspace' }))
        await user.click(screen.getByRole('button', { name: 'Create link' }))

        await waitFor(() =>
            expect(mocks.create).toHaveBeenCalledWith({
                slug: 'marathon-grade-6',
                target: {
                    kind: 'lms-access-link',
                    applicationId: APPLICATION_ID,
                    accessLinkId: '0190a9b5-3cde-7abc-8def-0123456789b1',
                    accessLinkSlug: 'grade-6',
                    workspaceId: '0190a9b5-3cde-7abc-8def-0123456789af'
                }
            })
        )
    })

    it('keeps same-slug quizzes distinct by workspace without showing workspace IDs', async () => {
        const workspaceA = '0190a9b5-3cde-7abc-8def-0123456789ae'
        const workspaceB = '0190a9b5-3cde-7abc-8def-0123456789af'
        mocks.listQuizOptions.mockResolvedValue([
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789b2',
                slug: 'grade-5',
                label: 'Grade 5 — Marathon',
                workspaceId: workspaceA,
                workspaceLabel: 'Main workspace'
            },
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789b3',
                slug: 'grade-5',
                label: 'Grade 5 — Marathon',
                workspaceId: workspaceB,
                workspaceLabel: 'Additional workspace'
            }
        ])
        const user = userEvent.setup()
        renderPage()

        await user.type(await screen.findByRole('textbox'), 'grade-5-additional')
        await selectQuizAccessDestination(user)
        await user.click(screen.getByRole('combobox', { name: 'Published quiz' }))
        expect(await screen.findByRole('option', { name: 'Grade 5 — Marathon — Main workspace' })).toBeVisible()
        await user.click(screen.getByRole('option', { name: 'Grade 5 — Marathon — Additional workspace' }))
        await user.click(screen.getByRole('button', { name: 'Create link' }))

        await waitFor(() =>
            expect(mocks.create).toHaveBeenCalledWith({
                slug: 'grade-5-additional',
                target: {
                    kind: 'lms-access-link',
                    applicationId: APPLICATION_ID,
                    accessLinkId: '0190a9b5-3cde-7abc-8def-0123456789b3',
                    accessLinkSlug: 'grade-5',
                    workspaceId: workspaceB
                }
            })
        )
        expect(screen.queryByText(workspaceA)).not.toBeInTheDocument()
        expect(screen.queryByText(workspaceB)).not.toBeInTheDocument()
    })

    it('creates a published resource short link by target kind and codename', async () => {
        const user = userEvent.setup()
        renderPage()

        await screen.findByRole('textbox')
        await user.type(screen.getByRole('textbox'), 'lyceum-home')
        await user.click(screen.getByRole('combobox', { name: 'Destination type' }))
        await user.click(await screen.findByRole('option', { name: 'Published resource', exact: true }))
        await user.click(await screen.findByRole('combobox', { name: 'Published resource' }))
        await user.click(await screen.findByRole('option', { name: 'Marketing home' }))
        await user.click(screen.getByRole('button', { name: 'Create link' }))

        await waitFor(() =>
            expect(mocks.create).toHaveBeenCalledWith({
                slug: 'lyceum-home',
                target: {
                    kind: 'application-resource',
                    applicationId: APPLICATION_ID,
                    targetKind: 'page',
                    entityTypeCodename: 'home'
                }
            })
        )
    })

    it('shows an application-resource destination with its localized label and no internal codename', async () => {
        mocks.list.mockResolvedValue({
            items: [
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789ae',
                    slug: 'lyceum-home',
                    target: {
                        kind: 'application-resource',
                        applicationId: APPLICATION_ID,
                        targetKind: 'page',
                        entityTypeCodename: 'internal-marketing-home'
                    },
                    releasedAt: null,
                    createdAt: '2026-10-11T10:00:00.000Z',
                    updatedAt: '2026-10-11T10:00:00.000Z'
                }
            ],
            hasMore: false
        })
        mocks.listResourceOptions.mockResolvedValue([
            { targetKind: 'page', entityTypeCodename: 'internal-marketing-home', label: 'Marketing home' }
        ])
        renderPage()

        expect(await screen.findByText('Marketing home')).toBeVisible()
        expect(screen.queryByText('internal-marketing-home')).not.toBeInTheDocument()
        expect(screen.queryByText(APPLICATION_ID)).not.toBeInTheDocument()
    })

    it('copies the exact absolute `/l/` URL for a localized quiz destination without exposing UUIDs', async () => {
        const user = userEvent.setup()
        const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
        renderPage()

        expect((await screen.findAllByText('Grade 5 — Marathon — Grade 5 workspace')).length).toBeGreaterThan(0)
        expect(screen.queryByText(APPLICATION_ID)).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Copy' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Short link copied.')
        expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/l/marathon-grade-5`)
    })

    it('lists full guest quiz URLs and copies the selected link', async () => {
        const user = userEvent.setup()
        const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
        renderPage()

        const guestUrl = `${window.location.origin}/public/a/${APPLICATION_ID}/links/grade-5`
        expect(await screen.findByText('Full guest quiz links')).toBeVisible()
        expect(await screen.findByText(guestUrl, { exact: true })).toBeVisible()

        await user.click(screen.getAllByRole('button', { name: 'Copy link' })[0]!)

        expect(await screen.findByRole('alert')).toHaveTextContent('Full guest link copied.')
        expect(writeText).toHaveBeenCalledWith(guestUrl)
        expect(writeText).toHaveBeenCalledWith(guestUrl)
    })

    it('explains that guest URLs require a public application and opens its settings', async () => {
        const user = userEvent.setup()
        mocks.getApplication.mockResolvedValue({
            data: {
                id: APPLICATION_ID,
                isPublic: false,
                workspacesEnabled: true,
                accessType: 'member',
                role: 'owner',
                permissions: { manageApplication: true }
            }
        })
        renderPage()

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Make this application public before sharing guest links. Change its visibility in application settings.'
        )
        expect(screen.queryByRole('button', { name: 'Create link' })).not.toBeInTheDocument()
        expect(mocks.listQuizOptions).not.toHaveBeenCalled()

        await user.click(screen.getByRole('button', { name: 'Application settings' }))
        expect(screen.getByText('Application settings destination')).toBeVisible()
    })

    it('does not release a link when confirmation is cancelled and releases it after acceptance', async () => {
        const user = userEvent.setup()
        renderPage()

        await screen.findByRole('button', { name: 'Release' })
        mocks.confirm.mockResolvedValueOnce(false)
        await user.click(screen.getByRole('button', { name: 'Release' }))

        await waitFor(() =>
            expect(mocks.confirm).toHaveBeenCalledWith({
                title: 'Release this short link?',
                description: '/l/marathon-grade-5 will stop opening its destination.'
            })
        )
        expect(mocks.release).not.toHaveBeenCalled()

        mocks.confirm.mockResolvedValueOnce(true)
        await user.click(screen.getByRole('button', { name: 'Release' }))
        await waitFor(() => expect(mocks.release.mock.calls[0]?.[0]).toBe(ACTIVE_QUIZ_LINK.id))
    })

    it('shows the English required-name validation instead of leaking a translation key', async () => {
        const user = userEvent.setup()
        renderPage()

        await selectQuizAccessDestination(user)
        await screen.findByRole('combobox', { name: 'Published quiz' })
        await user.click(screen.getByRole('combobox', { name: 'Published quiz' }))
        await user.click(await screen.findByRole('option', { name: 'Grade 5 — Marathon — Grade 5 workspace' }))
        await user.click(screen.getByRole('button', { name: 'Create link' }))

        expect(await screen.findByText('Enter a short link name.', { exact: true })).toBeVisible()
        expect(mocks.create).not.toHaveBeenCalled()
    })

    it('localizes the required-name validation in Russian', async () => {
        const user = userEvent.setup()
        await getI18nInstance().changeLanguage('ru')
        renderPage()

        await selectQuizAccessDestination(user, 'ru')
        await screen.findByRole('combobox', { name: 'Опубликованный тест' })
        await user.click(screen.getByRole('combobox', { name: 'Опубликованный тест' }))
        await user.click(await screen.findByRole('option', { name: 'Grade 5 — Marathon — Grade 5 workspace' }))
        await user.click(screen.getByRole('button', { name: 'Создать ссылку' }))

        expect(await screen.findByText('Введите имя короткой ссылки.', { exact: true })).toBeVisible()
        expect(mocks.create).not.toHaveBeenCalled()
    })

    it('scopes the registry query to the current application', async () => {
        renderPage()
        await waitFor(() =>
            expect(mocks.list).toHaveBeenCalledWith({ applicationId: APPLICATION_ID, includeReleased: false, limit: 20, offset: 0 })
        )
        await waitFor(() => expect(mocks.listQuizOptions).toHaveBeenCalledWith({ applicationId: APPLICATION_ID, locale: 'en' }))
    })

    it('shows management controls to an application owner without a global alias permission', async () => {
        renderPage()

        expect(await screen.findByRole('button', { name: 'Create link' })).toBeVisible()
        expect(await screen.findByRole('button', { name: 'Release' })).toBeVisible()
        expect(mocks.list).toHaveBeenCalledWith({ applicationId: APPLICATION_ID, includeReleased: false, limit: 20, offset: 0 })
    })

    it('hides short-link access from a user without target-application manageApplication permission', async () => {
        mocks.getApplication.mockResolvedValue({
            data: {
                id: APPLICATION_ID,
                isPublic: true,
                workspacesEnabled: true,
                accessType: 'member',
                role: 'member',
                permissions: { manageApplication: false }
            }
        })
        renderPage()

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'You need the Manage application permission for this application to view and manage its guest and short links.'
        )
        expect(mocks.list).not.toHaveBeenCalled()
        expect(mocks.listQuizOptions).not.toHaveBeenCalled()
        expect(screen.queryByRole('button', { name: 'Create link' })).not.toBeInTheDocument()
    })

    it('localizes the target-application permission denial in Russian', async () => {
        await getI18nInstance().changeLanguage('ru')
        mocks.getApplication.mockResolvedValue({
            data: {
                id: APPLICATION_ID,
                isPublic: true,
                workspacesEnabled: true,
                accessType: 'member',
                role: 'member',
                permissions: { manageApplication: false }
            }
        })
        renderPage()

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Для просмотра и управления гостевыми и короткими ссылками требуется право «Управление приложением» в этом приложении.'
        )
        expect(mocks.list).not.toHaveBeenCalled()
    })

    it('allows a superuser when the target-application membership permission is absent', async () => {
        mocks.globalAccess.isSuperuser = true
        mocks.getApplication.mockResolvedValue({
            data: {
                id: APPLICATION_ID,
                isPublic: true,
                workspacesEnabled: true,
                accessType: 'supermoderator',
                role: 'owner',
                permissions: { manageApplication: true }
            }
        })
        renderPage()

        expect(await screen.findByRole('button', { name: 'Create link' })).toBeVisible()
        await waitFor(() =>
            expect(mocks.list).toHaveBeenCalledWith({ applicationId: APPLICATION_ID, includeReleased: false, limit: 20, offset: 0 })
        )
    })

    it('does not treat a synthetic global application role as target-application membership', async () => {
        mocks.getApplication.mockResolvedValue({
            data: {
                id: APPLICATION_ID,
                workspacesEnabled: true,
                accessType: 'supermoderator',
                role: 'owner',
                permissions: { manageApplication: true }
            }
        })
        renderPage()

        expect(await screen.findByRole('alert')).toHaveTextContent('Manage application permission')
        expect(mocks.list).not.toHaveBeenCalled()
    })

    it('offers workspace destinations only when workspaces are enabled for the application', async () => {
        const user = userEvent.setup()
        renderPage()

        await screen.findByRole('combobox', { name: 'Destination type' })
        await user.click(screen.getByRole('combobox', { name: 'Destination type' }))
        await user.click(await screen.findByRole('option', { name: 'Application section' }))
        await user.click(screen.getByRole('combobox', { name: 'Application section' }))
        expect(await screen.findByRole('option', { name: 'Workspaces' })).toBeVisible()
    })

    it('hides the workspace destination when the application has no workspaces', async () => {
        const user = userEvent.setup()
        mocks.getApplication.mockResolvedValue({
            data: { id: APPLICATION_ID, isPublic: true, workspacesEnabled: false, accessType: 'member', role: 'owner' }
        })
        renderPage()

        await waitFor(() => expect(mocks.getApplication).toHaveBeenCalledOnce())
        await screen.findByRole('combobox', { name: 'Destination type' })
        await user.click(screen.getByRole('combobox', { name: 'Destination type' }))
        await user.click(await screen.findByRole('option', { name: 'Application section' }))
        await user.click(screen.getByRole('combobox', { name: 'Application section' }))
        expect(await screen.findByRole('option', { name: 'Dashboard' })).toBeVisible()
        expect(screen.queryByRole('option', { name: 'Workspaces' })).not.toBeInTheDocument()
    })
})
