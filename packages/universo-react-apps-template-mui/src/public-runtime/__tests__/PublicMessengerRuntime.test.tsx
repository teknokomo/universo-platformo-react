import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PublicMessengerAppRuntime } from '@universo-react/types'
import AppMainLayout from '../../layouts/AppMainLayout'
import { createPublicMessengerRuntimeDetails, PublicMessengerRuntime } from '../PublicMessengerRuntime'

const headerPlacement = {
    instanceKey: 'app-header',
    widgetKey: 'header' as const,
    zone: 'top' as const,
    sortOrder: 0,
    parentInstanceKey: null,
    slotKey: null,
    config: {}
}

const overviewRuntime: PublicMessengerAppRuntime = {
    locale: 'en',
    title: 'Public Messenger',
    placements: [
        headerPlacement,
        {
            instanceKey: 'app-overview',
            widgetKey: 'detailsTabs',
            zone: 'center',
            sortOrder: 0,
            parentInstanceKey: null,
            slotKey: null,
            config: { tabs: [{ slotKey: 'tab:overview', label: 'Overview', isDefault: true }] }
        }
    ]
}

const overviewWithGeneratedMenuRuntime: PublicMessengerAppRuntime = {
    ...overviewRuntime,
    placements: [
        ...overviewRuntime.placements,
        {
            instanceKey: 'overview-navigation',
            widgetKey: 'menuWidget',
            zone: 'center',
            sortOrder: 0,
            parentInstanceKey: 'app-overview',
            slotKey: 'tab:overview',
            config: { variant: 'generated' },
            runtimeData: {
                status: 'ready',
                data: {
                    kind: 'menu',
                    title: 'Navigation',
                    showTitle: false,
                    overflowLabel: 'More',
                    items: [
                        {
                            key: 'main-page-about',
                            label: 'About',
                            icon: null,
                            kind: 'section',
                            target: { kind: 'page', codename: 'About' }
                        }
                    ],
                    overflowItems: []
                }
            }
        }
    ]
}

const relationRuntime: PublicMessengerAppRuntime = {
    ...overviewRuntime,
    placements: [
        headerPlacement,
        {
            instanceKey: 'public-relations',
            widgetKey: 'relationBuilder',
            zone: 'center',
            sortOrder: 0,
            parentInstanceKey: null,
            slotKey: null,
            config: {
                parentLabel: 'Account',
                panels: [{ slotKey: 'panel:items', title: 'Related items' }]
            },
            runtimeData: {
                status: 'ready',
                data: {
                    kind: 'relation',
                    parents: [{ key: 'parent1', label: 'North account' }],
                    panels: [
                        {
                            slotKey: 'panel:items',
                            title: 'Related items',
                            displayColumns: [{ key: 'display1', label: 'Status' }],
                            rows: [
                                {
                                    key: 'row1-1',
                                    parentKey: 'parent1',
                                    label: 'Monthly report',
                                    cells: [{ key: 'display1', value: 'Published' }]
                                }
                            ]
                        }
                    ]
                }
            }
        }
    ]
}

const nestedRelationRuntime: PublicMessengerAppRuntime = {
    ...relationRuntime,
    placements: [
        headerPlacement,
        {
            instanceKey: 'app-overview',
            widgetKey: 'detailsTabs',
            zone: 'center',
            sortOrder: 0,
            parentInstanceKey: null,
            slotKey: null,
            config: { tabs: [{ slotKey: 'tab:overview', label: 'Overview', isDefault: true }] }
        },
        {
            instanceKey: 'public-relations',
            widgetKey: 'relationBuilder',
            zone: 'center',
            sortOrder: 1,
            parentInstanceKey: 'app-overview',
            slotKey: 'tab:overview',
            config: { parentLabel: 'Account', panels: [{ slotKey: 'panel:items', title: 'Related items' }] },
            runtimeData: relationRuntime.placements.find((placement) => placement.widgetKey === 'relationBuilder')?.runtimeData
        },
        {
            instanceKey: 'zzz-neighbor',
            widgetKey: 'detailsTitle',
            zone: 'center',
            sortOrder: 1,
            parentInstanceKey: 'app-overview',
            slotKey: 'tab:overview',
            config: { level: 'h2' },
            runtimeData: { status: 'ready', data: { kind: 'title', text: 'Following section' } }
        }
    ]
}

const nestedEmptyRelationRuntime: PublicMessengerAppRuntime = {
    ...nestedRelationRuntime,
    placements: nestedRelationRuntime.placements.map((placement) =>
        placement.widgetKey === 'relationBuilder' ? { ...placement, runtimeData: { status: 'empty' as const } } : placement
    )
}

const expandedNestedRelationRuntime: PublicMessengerAppRuntime = {
    ...overviewRuntime,
    placements: [
        headerPlacement,
        {
            instanceKey: 'app-overview',
            widgetKey: 'detailsTabs',
            zone: 'center',
            sortOrder: 0,
            parentInstanceKey: null,
            slotKey: null,
            config: { tabs: [{ slotKey: 'tab:overview', label: 'Overview', isDefault: true }] }
        },
        ...Array.from({ length: 16 }, (_, relationIndex) => ({
            instanceKey: `relation-${relationIndex + 1}`,
            widgetKey: 'relationBuilder' as const,
            zone: 'center' as const,
            sortOrder: 1,
            parentInstanceKey: 'app-overview',
            slotKey: 'tab:overview',
            config: {
                parentLabel: 'Account',
                panels: Array.from({ length: 16 }, (_, panelIndex) => ({
                    slotKey: `panel:r${relationIndex + 1}-p${panelIndex + 1}`,
                    title: `Relation ${relationIndex + 1}, panel ${panelIndex + 1}`
                }))
            },
            runtimeData: { status: 'empty' as const }
        }))
    ]
}

const renderRuntime = (messengerApp: PublicMessengerAppRuntime) =>
    render(
        <AppMainLayout>
            <PublicMessengerRuntime applicationRef='public-app' messengerApp={messengerApp} onNavigate={vi.fn()} />
        </AppMainLayout>
    )

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    Reflect.deleteProperty(window, 'Telegram')
    Reflect.deleteProperty(window, 'WebApp')
})

describe('PublicMessengerRuntime', () => {
    it('renders the shared title header once and keeps the empty Overview tab keyboard accessible', async () => {
        const user = userEvent.setup()
        renderRuntime(overviewRuntime)

        expect(screen.getAllByRole('main')).toHaveLength(1)
        const main = screen.getByRole('main')
        expect(getComputedStyle(main).minHeight).toContain('dvh')
        expect(getComputedStyle(screen.getByTestId('messenger-runtime-shell')).minHeight).toBe('0')
        expect(screen.getByTestId('public-messenger-top-zone')).toContainElement(screen.getByRole('heading', { name: 'Public Messenger' }))
        expect(screen.getAllByRole('heading')).toHaveLength(1)
        expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument()
        expect(screen.getByRole('status')).toHaveTextContent('This section is empty.')

        await user.tab()
        expect(screen.getByRole('tab', { name: 'Overview' })).toHaveFocus()
    })

    it('applies the MAX viewport height to the public runtime scroll container', async () => {
        vi.stubGlobal('WebApp', {
            getViewportSize: vi.fn().mockResolvedValue({ width: '390px', height: '640px' })
        })
        renderRuntime(overviewRuntime)

        const main = screen.getByRole('main')
        await waitFor(() => expect(getComputedStyle(main).getPropertyValue('--max-viewport-height')).toBe('640px'))
    })

    it('renders generated public navigation through the shared menu and navigates by semantic target', async () => {
        const user = userEvent.setup()
        const onNavigate = vi.fn()
        render(
            <AppMainLayout>
                <PublicMessengerRuntime
                    applicationRef='public-app'
                    messengerApp={overviewWithGeneratedMenuRuntime}
                    onNavigate={onNavigate}
                />
            </AppMainLayout>
        )

        const aboutLink = screen.getByRole('link', { name: 'About' })
        expect(aboutLink).toHaveAttribute('href', '/a/public-app?targetKind=page&entityTypeCodename=About&locale=en')
        expect(screen.queryByRole('link', { name: /workspace|admin|settings/i })).not.toBeInTheDocument()

        await user.click(aboutLink)

        expect(onNavigate).toHaveBeenCalledWith('/a/public-app?targetKind=page&entityTypeCodename=About&locale=en')
    })

    it('projects public relation labels and display cells into read-only shared table cards', () => {
        const fetchSpy = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => Promise.resolve(new Response()))
        vi.stubGlobal('fetch', fetchSpy)
        renderRuntime(relationRuntime)

        expect(screen.getByRole('heading', { name: 'Public Messenger' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Related items' })).toBeInTheDocument()
        expect(screen.getByText('Monthly report')).toBeInTheDocument()
        expect(screen.getByText(/North account/)).toBeInTheDocument()
        expect(screen.getByText(/Published/)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /create|edit|delete|remove|add|save|reorder/i })).not.toBeInTheDocument()
        const requestMethods = fetchSpy.mock.calls.map(([input, init]) => {
            if (init?.method) return init.method.toUpperCase()
            if (input instanceof Request) return input.method.toUpperCase()
            return 'GET'
        })
        expect(requestMethods.filter((method) => method !== 'GET')).toEqual([])
    })

    it('preserves the author-selected parent tab and renders nested relations with existing content widgets', () => {
        vi.stubGlobal(
            'fetch',
            vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => Promise.resolve(new Response()))
        )
        renderRuntime(nestedRelationRuntime)

        expect(screen.queryByText('Messenger application is unavailable.')).not.toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Public Messenger' })).toBeInTheDocument()
        const overviewTab = screen.getByRole('tab', { name: 'Overview' })
        const overviewPanelId = overviewTab.getAttribute('aria-controls')
        expect(overviewPanelId).toBeTruthy()
        const overviewPanel = document.getElementById(overviewPanelId ?? '')
        expect(overviewPanel).not.toBeNull()
        if (!overviewPanel) throw new Error('The public Overview tab panel was not rendered')

        const nestedRelationHeading = within(overviewPanel).getByRole('heading', { name: 'Related items' })
        expect(overviewPanel).toContainElement(nestedRelationHeading)
        expect(within(overviewPanel).queryByRole('tab', { name: 'Related items' })).not.toBeInTheDocument()
        const rowLabel = within(overviewPanel).getByText('Monthly report')
        const followingHeading = within(overviewPanel).getByRole('heading', { name: 'Following section' })
        expect(nestedRelationHeading.compareDocumentPosition(rowLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(rowLabel.compareDocumentPosition(followingHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('keeps the nested panel heading and localized empty status when its relation data is empty', () => {
        renderRuntime(nestedEmptyRelationRuntime)

        const overviewTab = screen.getByRole('tab', { name: 'Overview' })
        const overviewPanelId = overviewTab.getAttribute('aria-controls')
        const overviewPanel = document.getElementById(overviewPanelId ?? '')
        expect(overviewPanel).not.toBeNull()
        if (!overviewPanel) throw new Error('The public Overview tab panel was not rendered')

        expect(within(overviewPanel).getByRole('heading', { name: 'Related items' })).toBeInTheDocument()
        expect(within(overviewPanel).getByRole('status')).toHaveTextContent('No matching content was found.')
        expect(within(overviewPanel).getByRole('heading', { name: 'Following section' })).toBeInTheDocument()
    })

    it('renders a valid layout when nested relation panels expand beyond the generic graph limit', () => {
        renderRuntime(expandedNestedRelationRuntime)

        expect(screen.queryByText('Messenger application is unavailable.')).not.toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Relation 16, panel 16' })).toBeInTheDocument()
    }, 15000)

    it('creates a public-only, read-only details context with no workspace or action callbacks', () => {
        const onNavigate = vi.fn()
        const details = createPublicMessengerRuntimeDetails('public-app', overviewRuntime, onNavigate)

        expect(details).toMatchObject({
            title: 'Public Messenger',
            applicationId: 'public-app',
            locale: 'en',
            currentWorkspaceId: null,
            runtimeAccessMode: 'public',
            publicWorkspaceAvailable: false,
            workspacesEnabled: false,
            permissions: {
                manageMembers: false,
                manageApplication: false,
                createContent: false,
                editContent: false,
                deleteContent: false,
                readReports: false
            },
            navigate: onNavigate
        })
        for (const callback of [
            'rowReorder',
            'relationRowReorder',
            'onOpenCreateTarget',
            'onOpenRowMenu',
            'onOpenRowTarget',
            'onRuntimeDataChanged'
        ]) {
            expect(details).not.toHaveProperty(callback)
        }
        expect(details).not.toHaveProperty('apiBaseUrl')
    })
})
