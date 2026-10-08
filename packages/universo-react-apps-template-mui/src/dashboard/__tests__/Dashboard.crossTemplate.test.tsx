import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

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
    default: ({ rightWidgets }: { rightWidgets?: Array<unknown> }) => <div data-testid='top-shell'>{String(rightWidgets?.length ?? 0)}</div>
}))

vi.mock('../components/Header', () => ({
    default: ({ leading, actions }: { leading?: ReactNode; actions?: ReactNode }) => (
        <div data-testid='header-shell'>
            <div data-testid='header-leading'>{leading}</div>
            <div data-testid='header-actions'>{actions}</div>
        </div>
    )
}))

vi.mock('../components/MainGrid', () => ({
    default: ({ placements }: { placements?: Array<{ widgetKey: string; zone: string }> }) => {
        const centerWidgets = placements?.filter((widget) => widget.zone === 'center') ?? []
        const bottomWidgets = placements?.filter((widget) => widget.zone === 'bottom') ?? []
        return (
            <div data-testid='center-and-bottom-zone'>
                <span data-testid='center-zone'>{String(centerWidgets.length)}</span>
                {bottomWidgets.map((widget) => (
                    <span key={widget.widgetKey} data-testid={`bottom-${widget.widgetKey}`} />
                ))}
            </div>
        )
    }
}))

const details = {
    title: 'Runtime',
    hostCapabilities: ['theme.safe'] as const
}

let widgetId = 0
const widget = (
    instanceKey: string,
    widgetKey: string,
    sortOrder = 0,
    zone: 'left' | 'top' | 'right' | 'bottom' | 'center' = widgetKey === 'menuWidget'
        ? 'left'
        : widgetKey === 'footer'
        ? 'bottom'
        : ['appNavbar', 'header', 'breadcrumbs', 'search', 'datePicker', 'optionsMenu', 'languageSwitcher', 'colorModeSwitcher'].includes(
              widgetKey
          )
        ? 'top'
        : 'center'
) => {
    const id = `018f0000-0000-7000-8000-${String(++widgetId).padStart(12, '0')}`
    return { id, instanceKey, widgetKey, zone, sortOrder, config: {}, isActive: true, parentInstanceKey: null, slotKey: null }
}

describe('Dashboard zone adapter', () => {
    it('passes all five supported zones to their existing shell/renderer owners', () => {
        render(
            <Dashboard
                details={details}
                layoutConfig={{}}
                zoneWidgets={{
                    left: [widget('left-1', 'menuWidget', 0, 'left')],
                    top: [widget('top-1', 'divider', 0, 'top')],
                    right: [widget('right-1', 'infoCard', 0, 'right')],
                    bottom: [widget('bottom-1', 'footer', 0, 'bottom')],
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
                layoutConfig={{}}
                zoneWidgets={{
                    left: [],
                    top: [
                        widget('breadcrumbs-1', 'breadcrumbs', 1, 'top'),
                        widget('search-1', 'search', 2, 'top'),
                        widget('date-picker-1', 'datePicker', 3, 'top'),
                        widget('options-menu-1', 'optionsMenu', 4, 'top')
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
    })

    it('does not revive the legacy Header shell when only a top control is persisted', () => {
        render(
            <Dashboard
                details={details}
                layoutConfig={{}}
                zoneWidgets={{
                    left: [],
                    top: [widget('search-1', 'search', 0, 'top')],
                    bottom: [],
                    center: []
                }}
            />
        )

        expect(screen.getByTestId('runtime-search-widget')).toBeInTheDocument()
        expect(screen.queryByTestId('header-shell')).not.toBeInTheDocument()
    })

    it('does not revive top shells or controls from legacy booleans when top composition is absent', () => {
        render(<Dashboard details={details} layoutConfig={{}} zoneWidgets={{ left: [], bottom: [], center: [] }} />)

        expect(screen.queryByTestId('top-shell')).not.toBeInTheDocument()
        expect(screen.queryByTestId('header-shell')).not.toBeInTheDocument()
        expect(screen.queryByTestId('runtime-breadcrumbs-widget')).not.toBeInTheDocument()
        expect(screen.queryByTestId('runtime-search-widget')).not.toBeInTheDocument()
        expect(screen.queryByTestId('runtime-date-picker-widget')).not.toBeInTheDocument()
        expect(screen.queryByTestId('runtime-options-menu-widget')).not.toBeInTheDocument()
        expect(screen.queryByTestId('runtime-language-switcher')).not.toBeInTheDocument()
    })

    it('does not revive boolean center widgets when the persisted center zone is empty', () => {
        render(<Dashboard details={details} layoutConfig={{}} zoneWidgets={{ left: [], top: [], bottom: [], center: [] }} />)

        expect(screen.queryByText('Overview')).not.toBeInTheDocument()
        expect(screen.getByTestId('center-and-bottom-zone')).toBeInTheDocument()
    })

    it('does not revive the side menu when the persisted left zone is empty', () => {
        render(<Dashboard details={details} layoutConfig={{}} zoneWidgets={{ left: [], top: [], bottom: [], center: [] }} />)

        expect(screen.queryByTestId('left-zone')).not.toBeInTheDocument()
    })

    it('projects persisted language and color-mode placements through the Header shell without boolean adapters', () => {
        render(
            <Dashboard
                details={details}
                layoutConfig={{ sideMenu: { availableModes: ['wide', 'compact'], primaryMode: 'wide', rememberUserChoice: false } }}
                zoneWidgets={{
                    left: [widget('menu-1', 'menuWidget', 0, 'left')],
                    top: [
                        widget('navbar-1', 'appNavbar', 0, 'top'),
                        widget('header-1', 'header', 1, 'top'),
                        widget('language-1', 'languageSwitcher', 2, 'top'),
                        widget('color-mode-1', 'colorModeSwitcher', 3, 'top')
                    ],
                    bottom: [],
                    center: []
                }}
            />
        )

        const actions = screen.getByTestId('header-actions')
        expect(screen.getByTestId('top-shell')).toBeInTheDocument()
        expect(within(actions).getByTestId('runtime-language-switcher')).toBeInTheDocument()
        expect(actions.querySelectorAll('[data-screenshot="toggle-mode"]')).toHaveLength(1)
        expect(screen.queryByTestId('top-zone-widget-languageSwitcher')).not.toBeInTheDocument()
        expect(screen.queryByTestId('top-zone-widget-colorModeSwitcher')).not.toBeInTheDocument()
    })

    it('renders one language and color-mode control when singleton placements are duplicated', () => {
        render(
            <Dashboard
                details={details}
                zoneWidgets={{
                    left: [],
                    top: [
                        widget('header-1', 'header'),
                        widget('language-1', 'languageSwitcher', 1),
                        widget('language-2', 'languageSwitcher', 2),
                        widget('color-mode-1', 'colorModeSwitcher', 3),
                        widget('color-mode-2', 'colorModeSwitcher', 4)
                    ],
                    bottom: [],
                    center: []
                }}
            />
        )

        const actions = screen.getByTestId('header-actions')
        expect(within(actions).getAllByTestId('runtime-language-switcher')).toHaveLength(1)
        expect(actions.querySelectorAll('[data-screenshot="toggle-mode"]')).toHaveLength(1)
        expect(screen.queryByTestId('top-zone-widget-languageSwitcher')).not.toBeInTheDocument()
        expect(screen.queryByTestId('top-zone-widget-colorModeSwitcher')).not.toBeInTheDocument()
    })

    it('projects a persisted color-mode singleton into Header when no options menu exists', () => {
        render(
            <Dashboard
                details={details}
                layoutConfig={{
                    sideMenu: { availableModes: ['wide', 'compact'], primaryMode: 'wide', rememberUserChoice: false }
                }}
                zoneWidgets={{
                    left: [widget('menu-1', 'menuWidget')],
                    top: [
                        widget('navbar-1', 'appNavbar', 1),
                        widget('header-1', 'header', 2),
                        widget('color-mode-1', 'colorModeSwitcher', 3)
                    ],
                    bottom: [],
                    center: []
                }}
            />
        )

        expect(screen.getByTestId('header-actions').querySelectorAll('[data-screenshot="toggle-mode"]')).toHaveLength(1)
        expect(screen.queryByTestId('top-zone-widget-colorModeSwitcher')).not.toBeInTheDocument()
    })

    it('projects persisted options and color-mode placements through Header exactly once', () => {
        render(
            <Dashboard
                details={details}
                zoneWidgets={{
                    left: [],
                    top: [
                        widget('navbar-1', 'appNavbar', 1),
                        widget('header-1', 'header', 2),
                        widget('options-1', 'optionsMenu', 3),
                        widget('color-mode-1', 'colorModeSwitcher', 4)
                    ],
                    bottom: [],
                    center: []
                }}
            />
        )

        const actions = screen.getByTestId('header-actions')
        expect(within(actions).queryByTestId('runtime-options-menu-widget')).not.toBeInTheDocument()
        expect(actions.querySelectorAll('[data-screenshot="toggle-mode"]')).toHaveLength(1)
        expect(screen.queryByTestId('top-zone-widget-optionsMenu')).not.toBeInTheDocument()
        expect(screen.queryByTestId('top-zone-widget-colorModeSwitcher')).not.toBeInTheDocument()
    })

    it('hides the persisted color mode control when the singleton is inactive', () => {
        render(
            <Dashboard
                details={details}
                zoneWidgets={{
                    left: [],
                    top: [widget('header-1', 'header')],
                    bottom: [],
                    center: []
                }}
            />
        )

        expect(screen.getByTestId('header-actions').querySelectorAll('[data-screenshot="toggle-mode"]')).toHaveLength(0)
        expect(screen.queryByTestId('top-zone-widget-colorModeSwitcher')).not.toBeInTheDocument()
    })

    it('projects a persisted language switcher into Header', () => {
        render(
            <Dashboard
                details={details}
                zoneWidgets={{
                    left: [],
                    top: [widget('header-1', 'header'), widget('language-1', 'languageSwitcher')],
                    bottom: [],
                    center: []
                }}
            />
        )

        expect(within(screen.getByTestId('header-actions')).getByTestId('runtime-language-switcher')).toBeInTheDocument()
        expect(screen.queryByTestId('top-zone-widget-languageSwitcher')).not.toBeInTheDocument()
    })

    it('does not restore removed persisted shell widgets from boolean layout flags', () => {
        render(<Dashboard details={details} zoneWidgets={{ left: [], top: [], bottom: [], center: [] }} />)

        expect(screen.queryByTestId('top-shell')).not.toBeInTheDocument()
        expect(screen.queryByTestId('header-shell')).not.toBeInTheDocument()
    })

    it('does not render shell controls when no corresponding placements exist', () => {
        render(<Dashboard details={details} />)

        expect(screen.queryByTestId('top-shell')).not.toBeInTheDocument()
        expect(screen.queryByTestId('header-shell')).not.toBeInTheDocument()
        expect(screen.queryByTestId('top-zone-widget-languageSwitcher')).not.toBeInTheDocument()
        expect(screen.queryByTestId('top-zone-widget-colorModeSwitcher')).not.toBeInTheDocument()
    })

    it('collapses duplicate persisted shell rows to one navbar and one header', () => {
        render(
            <Dashboard
                details={details}
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
