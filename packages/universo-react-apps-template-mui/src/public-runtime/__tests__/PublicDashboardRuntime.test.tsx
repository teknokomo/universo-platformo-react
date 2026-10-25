import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { createInstance } from 'i18next'
import { initReactI18next, I18nextProvider } from 'react-i18next'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { publicDashboardRuntimeSchema } from '@universo-react/types'
import { PublicDashboardRuntime } from '../PublicDashboardRuntime'
import en from '../../i18n/locales/en/publicInterpretationNetwork.json'
import ru from '../../i18n/locales/ru/publicInterpretationNetwork.json'
import { responses } from './fixtures'

const i18n = createInstance()

const stubIntrinsicLayout = () => {
    const width = 640
    const height = 480
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
        x: 0,
        y: 0,
        width,
        height,
        top: 0,
        right: width,
        bottom: height,
        left: 0,
        toJSON: () => ({})
    } as DOMRect)
}

beforeAll(async () => {
    await i18n
        .use(initReactI18next)
        .init({ lng: 'en', resources: { en: { publicInterpretationNetwork: en }, ru: { publicInterpretationNetwork: ru } } })
})
beforeEach(stubIntrinsicLayout)
afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})
const dashboard = {
    locale: 'en' as const,
    workspaceAvailability: 'available' as const,
    placements: [
        {
            instanceKey: 'public-network',
            widgetKey: 'interpretationNetworkWorkspace' as const,
            zone: 'center' as const,
            sortOrder: 0,
            parentInstanceKey: null,
            slotKey: null,
            config: {},
            runtimeData: { status: 'deferred' as const }
        }
    ]
}

describe('public Dashboard renderer', () => {
    it('renders the selected public Page introduction in the shared Dashboard content area', () => {
        const publicDashboard = {
            locale: 'en' as const,
            workspaceAvailability: 'available' as const,
            placements: [],
            pageBlocks: [
                { id: 'intro-title', type: 'header' as const, data: { text: 'Interpretation Network', level: 2 } },
                {
                    id: 'intro-purpose',
                    type: 'paragraph' as const,
                    data: { text: 'The interpretation network helps build structures and relations.' }
                }
            ]
        }

        render(
            <I18nextProvider i18n={i18n}>
                <PublicDashboardRuntime applicationRef='network' locale='en' dashboard={publicDashboard} onNavigate={vi.fn()} />
            </I18nextProvider>
        )

        expect(screen.getByTestId('dashboard-host-content')).toHaveTextContent('Interpretation Network')
        expect(screen.getByTestId('dashboard-host-content')).toHaveTextContent(
            'The interpretation network helps build structures and relations.'
        )
        expect(screen.queryByText('No dashboard content is available yet.')).not.toBeInTheDocument()
    })

    it('resets navigation when the application reference changes and never mounts mutation UI', async () => {
        const fetcher = vi.fn(
            async (url: string) =>
                new Response(
                    JSON.stringify(responses[new URL(url, 'https://public.test').searchParams.get('view') as keyof typeof responses])
                )
        )
        vi.stubGlobal('fetch', fetcher)
        const client = new QueryClient()
        const props = { applicationRef: 'one-network', locale: 'en', dashboard, onNavigate: vi.fn() }
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <I18nextProvider i18n={i18n}>
                <QueryClientProvider client={client}>{children}</QueryClientProvider>
            </I18nextProvider>
        )
        const view = render(<PublicDashboardRuntime {...props} />, { wrapper })
        await userEvent.setup().click(await screen.findByRole('button', { name: 'Cities' }))
        await screen.findByTestId('interpretation-network-matrix-workspace')
        view.rerender(<PublicDashboardRuntime {...props} applicationRef='two-network' />)
        await screen.findByRole('button', { name: 'Cities' })
        expect(fetcher.mock.calls.map((call) => String((call as unknown[])[0]))).toEqual(
            expect.arrayContaining([expect.stringContaining('/one-network/'), expect.stringContaining('/two-network/')])
        )
        expect(
            fetcher.mock.calls.every((call) => String((call as unknown[])[0]).includes('/api/v1/public/applications/')),
            'The anonymous Dashboard must use only the credential-free public read transport'
        ).toBe(true)
        expect(screen.queryByRole('button', { name: /create|edit|delete|favorite|settings|save|template/i })).not.toBeInTheDocument()
    })

    it('rejects an incompatible placement rather than adapting physical IDs', () => {
        const fetcher = vi.fn()
        vi.stubGlobal('fetch', fetcher)
        render(
            <I18nextProvider i18n={i18n}>
                <PublicDashboardRuntime
                    applicationRef='network'
                    locale='en'
                    dashboard={
                        { ...dashboard, placements: [{ ...dashboard.placements[0], id: 'physical-widget' }] } as unknown as typeof dashboard
                    }
                    onNavigate={vi.fn()}
                />
            </I18nextProvider>
        )
        expect(screen.getByRole('alert')).toHaveTextContent(en.publicViewer.error)
        expect(fetcher).not.toHaveBeenCalled()
    })

    it('uses the existing menu for semantic Page targets and has no workspace navigation', async () => {
        const menu = {
            instanceKey: 'public-menu',
            widgetKey: 'menuWidget' as const,
            zone: 'left' as const,
            sortOrder: 0,
            parentInstanceKey: null,
            slotKey: null,
            config: { variant: 'generated' as const },
            runtimeData: {
                status: 'ready' as const,
                data: {
                    title: 'Explore',
                    showTitle: true,
                    overflowLabel: 'More',
                    overflowItems: [],
                    items: [
                        {
                            key: 'overview',
                            kind: 'section' as const,
                            label: 'Overview',
                            icon: null,
                            target: { kind: 'page' as const, codename: 'Overview' }
                        }
                    ],
                    navigationAction: {
                        label: 'Structures',
                        source: { kind: 'page' as const, codename: 'Overview' },
                        target: { kind: 'object' as const, codename: 'Structure' }
                    }
                }
            }
        }
        const onNavigate = vi.fn()
        const publicDashboard = {
            locale: 'en' as const,
            workspaceAvailability: 'available' as const,
            layoutConfig: {
                sideMenu: { availableModes: ['compact'], primaryMode: 'compact', rememberUserChoice: false }
            },
            placements: [menu]
        }
        const parsedPublicDashboard = publicDashboardRuntimeSchema.safeParse(publicDashboard)
        expect(parsedPublicDashboard.success, JSON.stringify(parsedPublicDashboard.error?.issues)).toBe(true)
        render(
            <I18nextProvider i18n={i18n}>
                <PublicDashboardRuntime applicationRef='network' locale='en' dashboard={publicDashboard} onNavigate={onNavigate} />
            </I18nextProvider>
        )
        expect(screen.getByTestId('runtime-main-content')).toBeVisible()
        expect(screen.getByTestId('runtime-side-menu-docked')).toBeVisible()
        expect(screen.queryByRole('button', { name: 'Enable compact menu' })).not.toBeInTheDocument()
        expect(screen.getAllByRole('navigation')).toHaveLength(1)
        const applicationNavigation = screen.getByRole('navigation', { name: 'Application navigation' })
        expect(within(applicationNavigation).getAllByRole('link')).toHaveLength(1)
        expect(within(applicationNavigation).getByRole('link', { name: 'Overview' })).toBeVisible()
        const nextSectionLink = screen.getByRole('link', { name: 'Structures' })
        expect(nextSectionLink).toHaveAttribute('data-testid', 'public-dashboard-next-section')
        await userEvent.setup().click(nextSectionLink)
        const [nextHref] = onNavigate.mock.calls.at(-1) ?? []
        const nextUrl = new URL(nextHref as string, 'https://application.test')
        expect(nextUrl.pathname).toBe('/a/network')
        expect(nextUrl.searchParams.get('targetKind')).toBe('object')
        expect(nextUrl.searchParams.get('entityTypeCodename')).toBe('Structure')
        expect(nextUrl.searchParams.get('locale')).toBe('en')
        await userEvent.setup().click(screen.getByRole('link', { name: 'Overview' }))
        const [href] = onNavigate.mock.calls.at(-1) ?? []
        expect(typeof href).toBe('string')
        const url = new URL(href as string, 'https://application.test')
        expect(url.pathname).toBe('/a/network')
        expect(url.searchParams.get('locale')).toBe('en')
        expect(url.searchParams.get('targetKind')).toBe('page')
        expect(url.searchParams.get('entityTypeCodename')).toBe('Overview')
        expect(screen.queryByText(/Workspaces|Favorites|Settings/)).not.toBeInTheDocument()
    })

    it('shows the projected next section only on the start route when a public workspace is available', () => {
        const menu = {
            instanceKey: 'public-menu',
            widgetKey: 'menuWidget' as const,
            zone: 'left' as const,
            sortOrder: 0,
            parentInstanceKey: null,
            slotKey: null,
            config: { variant: 'generated' as const },
            runtimeData: {
                status: 'ready' as const,
                data: {
                    title: 'Explore',
                    showTitle: false,
                    overflowLabel: 'More',
                    items: [
                        {
                            key: 'start',
                            label: 'Start',
                            icon: null,
                            kind: 'section' as const,
                            target: { kind: 'page' as const, codename: 'Start' }
                        }
                    ],
                    overflowItems: [],
                    navigationAction: {
                        label: 'Structures',
                        source: { kind: 'page' as const, codename: 'Start' },
                        target: { kind: 'object' as const, codename: 'Structure' }
                    }
                }
            }
        }
        const publicDashboard = {
            locale: 'en' as const,
            workspaceAvailability: 'available' as const,
            layoutConfig: {
                sideMenu: { availableModes: ['compact' as const], primaryMode: 'compact' as const, rememberUserChoice: false }
            },
            placements: [menu]
        }
        const wrapper = ({ children }: { children: React.ReactNode }) => <I18nextProvider i18n={i18n}>{children}</I18nextProvider>

        const { rerender } = render(
            <PublicDashboardRuntime applicationRef='network' locale='en' dashboard={publicDashboard} onNavigate={vi.fn()} />,
            { wrapper }
        )
        expect(screen.getByRole('link', { name: 'Structures' })).toBeVisible()

        rerender(
            <PublicDashboardRuntime
                applicationRef='network'
                locale='en'
                dashboard={publicDashboard}
                target={{ targetKind: 'object', entityTypeCodename: 'Structure' }}
                onNavigate={vi.fn()}
            />
        )
        expect(screen.queryByTestId('public-dashboard-next-section')).not.toBeInTheDocument()

        rerender(
            <PublicDashboardRuntime
                applicationRef='network'
                locale='en'
                dashboard={{ ...publicDashboard, workspaceAvailability: 'none' }}
                onNavigate={vi.fn()}
            />
        )
        expect(screen.queryByTestId('public-dashboard-next-section')).not.toBeInTheDocument()
    })

    it('forwards the bootstrap entity selector to anonymous widget reads without rendering it', async () => {
        const entityTypeId = '0190a9b5-3cde-7abc-8def-0123456789ac'
        const fetcher = vi.fn(async (_url: string) => new Response(JSON.stringify(responses.structures)))
        vi.stubGlobal('fetch', fetcher)
        const client = new QueryClient()
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <I18nextProvider i18n={i18n}>
                <QueryClientProvider client={client}>{children}</QueryClientProvider>
            </I18nextProvider>
        )
        const { container } = render(
            <PublicDashboardRuntime
                applicationRef='network'
                locale='en'
                dashboard={dashboard}
                target={{ targetKind: 'object', entityTypeId }}
                onNavigate={vi.fn()}
            />,
            { wrapper }
        )

        await screen.findByRole('button', { name: 'Cities' })
        const requestUrl = new URL(String(fetcher.mock.calls[0][0]), 'https://public.test')
        expect(requestUrl.searchParams.get('targetKind')).toBe('object')
        expect(requestUrl.searchParams.get('entityTypeId')).toBe(entityTypeId)
        expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'GET', credentials: 'omit', cache: 'no-store' })
        expect(container.textContent).not.toContain(entityTypeId)
        client.clear()
    })

    it('renders the canonical public Dashboard shell and a localized empty-workspaces state without private data requests', () => {
        const fetcher = vi.fn()
        vi.stubGlobal('fetch', fetcher)
        const publicMenu = {
            instanceKey: 'public-menu',
            widgetKey: 'menuWidget' as const,
            zone: 'left' as const,
            sortOrder: 0,
            parentInstanceKey: null,
            slotKey: null,
            config: { variant: 'generated' as const },
            runtimeData: {
                status: 'ready' as const,
                data: {
                    title: 'Explore',
                    showTitle: true,
                    overflowLabel: 'More',
                    overflowItems: [],
                    items: [
                        {
                            key: 'overview',
                            kind: 'section' as const,
                            label: 'Overview',
                            icon: null,
                            target: { kind: 'page' as const, codename: 'Overview' }
                        }
                    ]
                }
            }
        }
        render(
            <I18nextProvider i18n={i18n}>
                <PublicDashboardRuntime
                    applicationRef='network'
                    locale='ru'
                    dashboard={{
                        ...dashboard,
                        locale: 'ru',
                        workspaceAvailability: 'none',
                        placements: [...dashboard.placements, publicMenu]
                    }}
                    onNavigate={vi.fn()}
                />
            </I18nextProvider>
        )

        expect(screen.getByRole('alert')).toHaveTextContent(ru.publicViewer.noWorkspaces)
        expect(screen.getByRole('main')).toBeVisible()
        expect(screen.getByTestId('runtime-main-content')).toBeVisible()
        expect(screen.getByTestId('runtime-main-grid')).toBeVisible()
        expect(screen.getByTestId('runtime-side-menu-docked')).toBeVisible()
        expect(screen.getByRole('link', { name: 'Overview' })).toBeVisible()
        expect(screen.queryByRole('heading', { name: /Сеть интерпретаций/u })).not.toBeInTheDocument()
        expect(screen.queryByRole('list', { name: ru.publicViewer.structures })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /создать|добавить|изменить|удалить|сохранить/iu })).not.toBeInTheDocument()
        expect(fetcher).not.toHaveBeenCalled()
    })

    it('renders a generic group-first public LMS Dashboard and its server-projected route action', async () => {
        const onNavigate = vi.fn()
        const publicDashboard = {
            locale: 'en' as const,
            workspaceAvailability: 'available' as const,
            placements: [
                {
                    instanceKey: 'public-catalog',
                    widgetKey: 'detailsTable' as const,
                    zone: 'center' as const,
                    sortOrder: 0,
                    parentInstanceKey: null,
                    slotKey: null,
                    config: { variant: 'records' as const, showSearch: false },
                    runtimeData: {
                        status: 'ready' as const,
                        data: {
                            kind: 'table' as const,
                            columns: [{ key: 'Title', label: 'Course', valueType: 'string' as const }],
                            rows: [{ key: 'row-1', cells: [{ key: 'Title', value: 'Public photosynthesis course' }] }],
                            pagination: { total: 1, limit: 24, offset: 0 }
                        }
                    }
                },
                {
                    instanceKey: 'lms-menu',
                    widgetKey: 'menuWidget' as const,
                    zone: 'left' as const,
                    sortOrder: 0,
                    parentInstanceKey: null,
                    slotKey: null,
                    config: { variant: 'generated' as const },
                    runtimeData: {
                        status: 'ready' as const,
                        data: {
                            title: 'Learning navigation',
                            showTitle: false,
                            overflowLabel: 'More',
                            items: [
                                {
                                    key: 'learning',
                                    label: 'Learning',
                                    icon: null,
                                    kind: 'group' as const,
                                    target: { kind: 'hub' as const, codename: 'Learning' }
                                }
                            ],
                            overflowItems: [],
                            navigationAction: {
                                label: 'Courses',
                                source: { kind: 'page' as const, codename: 'LearnerHome' },
                                target: { kind: 'object' as const, codename: 'Courses' }
                            }
                        }
                    }
                }
            ]
        }
        const parsed = publicDashboardRuntimeSchema.safeParse(publicDashboard)
        expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true)

        render(
            <I18nextProvider i18n={i18n}>
                <PublicDashboardRuntime
                    applicationRef='lms'
                    locale='en'
                    dashboard={publicDashboard}
                    target={{ targetKind: 'page', entityTypeCodename: 'LearnerHome' }}
                    onNavigate={onNavigate}
                />
            </I18nextProvider>
        )

        expect(screen.getByTestId('runtime-main-content')).toBeVisible()
        const applicationNavigation = screen.getByRole('navigation', { name: 'Application navigation' })
        expect(within(applicationNavigation).getAllByRole('listitem')).toHaveLength(1)
        expect(within(applicationNavigation).getByRole('heading', { name: 'Learning' })).toBeVisible()
        expect(screen.getByTestId('dashboard-entity-table')).toBeVisible()
        expect(screen.getByText('Public photosynthesis course')).toBeVisible()
        const coursesLink = screen.getByRole('link', { name: 'Courses' })
        expect(coursesLink).toHaveAttribute('data-testid', 'public-dashboard-next-section')
        await userEvent.setup().click(coursesLink)
        const [coursesHref] = onNavigate.mock.calls[0] ?? []
        const coursesUrl = new URL(coursesHref as string, 'https://application.test')
        expect(coursesUrl.pathname).toBe('/a/lms')
        expect(coursesUrl.searchParams.get('targetKind')).toBe('object')
        expect(coursesUrl.searchParams.get('entityTypeCodename')).toBe('Courses')
        expect(screen.queryByRole('button', { name: /^(?:Create|Add|Edit|Delete|Save)/iu })).not.toBeInTheDocument()
    })
})
