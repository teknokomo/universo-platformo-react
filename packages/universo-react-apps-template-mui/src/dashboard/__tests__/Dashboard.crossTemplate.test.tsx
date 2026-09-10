import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import Dashboard from '../Dashboard'

vi.mock('../components/SideMenu', () => ({
    default: ({ zoneWidgets }: { zoneWidgets?: { left?: Array<unknown> } }) => (
        <div data-testid='left-zone'>
            {String(zoneWidgets?.left?.length ?? 0)}
            {(zoneWidgets?.left ?? []).map((widget) => {
                const item = widget as { id: string; widgetKey: string }
                return <span key={item.id} data-testid={`left-widget-${item.widgetKey}`} />
            })}
        </div>
    )
}))

vi.mock('../components/SideMenuRight', () => ({
    default: ({ widgets }: { widgets: Array<unknown> }) => <div data-testid='right-zone'>{String(widgets.length)}</div>
}))

vi.mock('../components/AppNavbar', () => ({
    default: ({
        rightWidgets,
        showColorModeOnDesktop = true,
        showLanguageSwitcher = true,
        showLanguageSwitcherOnDesktop = true
    }: {
        rightWidgets?: Array<unknown>
        showColorModeOnDesktop?: boolean
        showLanguageSwitcher?: boolean
        showLanguageSwitcherOnDesktop?: boolean
    }) => (
        <div
            data-testid='top-shell'
            data-color-mode-desktop={String(showColorModeOnDesktop)}
            data-language-switcher={String(showLanguageSwitcher)}
            data-language-switcher-desktop={String(showLanguageSwitcherOnDesktop)}
        >
            {String(rightWidgets?.length ?? 0)}
        </div>
    )
}))

vi.mock('../components/Header', () => ({
    default: ({
        layoutConfig
    }: {
        layoutConfig?: {
            showBreadcrumbs?: boolean
            showSearch?: boolean
            showDatePicker?: boolean
            showOptionsMenu?: boolean
            showLanguageSwitcher?: boolean
            showColorMode?: boolean
        }
    }) => (
        <div
            data-testid='header-shell'
            data-show-breadcrumbs={String(layoutConfig?.showBreadcrumbs ?? true)}
            data-show-search={String(layoutConfig?.showSearch ?? true)}
            data-show-date-picker={String(layoutConfig?.showDatePicker ?? true)}
            data-show-options-menu={String(layoutConfig?.showOptionsMenu ?? true)}
            data-language-switcher={String(layoutConfig?.showLanguageSwitcher ?? true)}
            data-show-color-mode={String(layoutConfig?.showColorMode ?? true)}
        />
    )
}))

vi.mock('../components/MainGrid', () => ({
    default: ({
        centerWidgets,
        bottomWidgets
    }: {
        centerWidgets?: Array<{ widgetKey: string }>
        bottomWidgets?: Array<{ widgetKey: string }>
    }) => (
        <div data-testid='center-and-bottom-zone'>
            <span data-testid='center-zone'>{String(centerWidgets?.length ?? 0)}</span>
            {bottomWidgets?.map((widget) => (
                <span key={widget.widgetKey} data-testid={`bottom-${widget.widgetKey}`} />
            ))}
        </div>
    )
}))

const details = {
    title: 'Runtime',
    rows: [],
    columns: []
}

const widget = (id: string, widgetKey: string, sortOrder = 0) => ({ id, widgetKey, sortOrder, config: {}, isActive: true })

describe('Dashboard zone adapter', () => {
    it('passes all five supported zones to their existing shell/renderer owners', () => {
        render(
            <Dashboard
                details={details}
                layoutConfig={{ showRightSideMenu: true }}
                zoneWidgets={{
                    left: [widget('left-1', 'menuWidget')],
                    top: [widget('top-1', 'divider')],
                    right: [widget('right-1', 'productTree')],
                    bottom: [widget('bottom-1', 'footer')],
                    center: [widget('center-1', 'detailsTable')]
                }}
            />
        )

        expect(screen.getByTestId('left-zone')).toHaveTextContent('1')
        expect(screen.queryByTestId('top-shell')).not.toBeInTheDocument()
        expect(screen.getByTestId('top-zone-widget-divider')).toBeInTheDocument()
        expect(screen.getByTestId('right-zone')).toHaveTextContent('1')
        expect(screen.getByTestId('center-zone')).toHaveTextContent('1')
        expect(screen.getByTestId('bottom-footer')).toBeInTheDocument()
    })

    it('renders persisted top controls without requiring the Header shell', () => {
        render(
            <Dashboard
                details={details}
                layoutConfig={{ showSideMenu: false, showAppNavbar: false, showHeader: false, showFooter: false }}
                zoneWidgets={{
                    left: [],
                    top: [
                        widget('breadcrumbs-1', 'breadcrumbs', 1),
                        widget('search-1', 'search', 2),
                        widget('date-picker-1', 'datePicker', 3),
                        widget('options-menu-1', 'optionsMenu', 4)
                    ],
                    bottom: [],
                    center: []
                }}
            />
        )

        expect(screen.getByTestId('runtime-breadcrumbs-widget')).toBeInTheDocument()
        expect(screen.getByTestId('runtime-search-widget')).toBeInTheDocument()
        expect(screen.getByTestId('runtime-date-picker-widget')).toBeInTheDocument()
        expect(screen.getByTestId('runtime-options-menu-widget')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Open notifications' })).toBeInTheDocument()
    })

    it('does not revive the legacy Header shell when only a top control is persisted', () => {
        render(
            <Dashboard
                details={details}
                layoutConfig={{ showSideMenu: false, showAppNavbar: false, showFooter: false }}
                zoneWidgets={{
                    left: [],
                    top: [widget('search-1', 'search')],
                    bottom: [],
                    center: []
                }}
            />
        )

        expect(screen.getByTestId('runtime-search-widget')).toBeInTheDocument()
        expect(screen.queryByTestId('header-shell')).not.toBeInTheDocument()
    })

    it('does not revive boolean center widgets when the persisted center zone is empty', () => {
        render(
            <Dashboard
                details={details}
                layoutConfig={{
                    showSideMenu: false,
                    showAppNavbar: false,
                    showHeader: false,
                    showOverviewTitle: true,
                    showOverviewCards: true
                }}
                zoneWidgets={{ left: [], top: [], bottom: [], center: [] }}
            />
        )

        expect(screen.queryByText('Overview')).not.toBeInTheDocument()
        expect(screen.getByTestId('center-and-bottom-zone')).toBeInTheDocument()
    })

    it('does not revive the side menu when the persisted left zone is empty', () => {
        render(
            <Dashboard
                details={details}
                layoutConfig={{ showSideMenu: true, showAppNavbar: false, showHeader: false }}
                zoneWidgets={{ left: [], top: [], bottom: [], center: [] }}
            />
        )

        expect(screen.queryByTestId('left-zone')).not.toBeInTheDocument()
    })

    it('assigns desktop shell controls to one owner when both persisted shells are enabled', () => {
        render(
            <Dashboard
                details={details}
                layoutConfig={{
                    showSideMenu: true,
                    showAppNavbar: false,
                    showHeader: false,
                    showLanguageSwitcher: false,
                    sideMenu: { availableModes: ['wide', 'compact'], primaryMode: 'wide', rememberUserChoice: false }
                }}
                zoneWidgets={{
                    left: [widget('menu-1', 'menuWidget')],
                    top: [widget('navbar-1', 'appNavbar'), widget('header-1', 'header'), widget('language-1', 'languageSwitcher')],
                    bottom: [],
                    center: []
                }}
            />
        )

        expect(screen.getByTestId('top-shell')).toHaveAttribute('data-color-mode-desktop', 'true')
        expect(screen.getByTestId('top-shell')).toHaveAttribute('data-language-switcher', 'true')
        expect(screen.getByTestId('top-shell')).toHaveAttribute('data-language-switcher-desktop', 'false')
        expect(screen.getByTestId('header-shell')).toHaveAttribute('data-show-breadcrumbs', 'false')
        expect(screen.getByTestId('header-shell')).toHaveAttribute('data-show-search', 'false')
        expect(screen.getByTestId('header-shell')).toHaveAttribute('data-show-date-picker', 'false')
        expect(screen.getByTestId('header-shell')).toHaveAttribute('data-show-options-menu', 'false')
        expect(screen.getByTestId('header-shell')).toHaveAttribute('data-language-switcher', 'true')
        expect(screen.getByTestId('header-shell')).toHaveAttribute('data-show-color-mode', 'false')
    })

    it('moves desktop color mode to AppNavbar when persisted Header has no options menu', () => {
        render(
            <Dashboard
                details={details}
                layoutConfig={{
                    showSideMenu: true,
                    showFooter: false,
                    sideMenu: { availableModes: ['wide', 'compact'], primaryMode: 'wide', rememberUserChoice: false }
                }}
                zoneWidgets={{
                    left: [widget('menu-1', 'menuWidget')],
                    top: [widget('navbar-1', 'appNavbar', 1), widget('header-1', 'header', 2)],
                    bottom: [],
                    center: []
                }}
            />
        )

        expect(screen.getByTestId('top-shell')).toHaveAttribute('data-color-mode-desktop', 'true')
        expect(screen.getByTestId('header-shell')).toHaveAttribute('data-show-options-menu', 'false')
        expect(screen.getByTestId('header-shell')).toHaveAttribute('data-show-color-mode', 'false')
    })

    it('keeps the persisted options menu owned by Header on desktop and available on mobile', () => {
        render(
            <Dashboard
                details={details}
                layoutConfig={{ showSideMenu: false, showFooter: false }}
                zoneWidgets={{
                    left: [],
                    top: [widget('navbar-1', 'appNavbar', 1), widget('header-1', 'header', 2), widget('options-1', 'optionsMenu', 3)],
                    bottom: [],
                    center: []
                }}
            />
        )

        expect(screen.getByTestId('top-shell')).toHaveAttribute('data-color-mode-desktop', 'false')
        expect(screen.getByTestId('header-shell')).toHaveAttribute('data-show-options-menu', 'true')
        expect(screen.getByTestId('header-shell')).toHaveAttribute('data-show-color-mode', 'true')
        expect(screen.getByTestId('top-zone-widget-optionsMenu')).toBeInTheDocument()
    })

    it('keeps a persisted language switcher available below the desktop-only Header', () => {
        render(
            <Dashboard
                details={details}
                layoutConfig={{ showSideMenu: false, showAppNavbar: false, showHeader: true, showLanguageSwitcher: true }}
                zoneWidgets={{
                    left: [],
                    top: [widget('header-1', 'header'), widget('language-1', 'languageSwitcher')],
                    bottom: [],
                    center: []
                }}
            />
        )

        expect(screen.getByTestId('header-shell')).toHaveAttribute('data-language-switcher', 'true')
        expect(screen.getByTestId('top-zone-widget-languageSwitcher')).toBeInTheDocument()
    })

    it('does not restore removed persisted shell widgets from boolean layout flags', () => {
        render(
            <Dashboard
                details={details}
                layoutConfig={{ showSideMenu: false, showAppNavbar: true, showHeader: true, showLanguageSwitcher: true }}
                zoneWidgets={{ left: [], top: [], bottom: [], center: [] }}
            />
        )

        expect(screen.queryByTestId('top-shell')).not.toBeInTheDocument()
        expect(screen.queryByTestId('header-shell')).not.toBeInTheDocument()
    })

    it('collapses duplicate persisted shell rows to one navbar and one header', () => {
        render(
            <Dashboard
                details={details}
                layoutConfig={{ showSideMenu: false, showAppNavbar: false, showHeader: false, showFooter: false }}
                zoneWidgets={{
                    left: [],
                    top: [
                        widget('navbar-1', 'appNavbar'),
                        widget('navbar-2', 'appNavbar'),
                        widget('header-1', 'header'),
                        widget('header-2', 'header')
                    ],
                    bottom: [],
                    center: []
                }}
            />
        )

        expect(screen.getAllByTestId('top-shell')).toHaveLength(1)
        expect(screen.getAllByTestId('header-shell')).toHaveLength(1)
    })

    it('keeps repeatable menuWidget placements in the persisted side menu', () => {
        render(
            <Dashboard
                details={details}
                layoutConfig={{ sideMenu: { availableModes: ['wide'], primaryMode: 'wide', rememberUserChoice: false } }}
                zoneWidgets={{
                    left: [widget('menu-1', 'menuWidget'), widget('menu-2', 'menuWidget')],
                    top: [],
                    bottom: [],
                    center: []
                }}
            />
        )

        expect(screen.getAllByTestId('left-widget-menuWidget')).toHaveLength(2)
    })
})
