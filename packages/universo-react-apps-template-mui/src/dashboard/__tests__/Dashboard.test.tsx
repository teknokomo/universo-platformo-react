import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dashboard from '../Dashboard'

vi.mock('../components/Header', () => ({
    default: () => <div data-testid='dashboard-header' />
}))

vi.mock('../components/MainGrid', () => ({
    default: ({ fullWidth = false }: { fullWidth?: boolean }) => (
        <main data-testid='dashboard-main-grid' data-full-width={fullWidth ? 'true' : 'false'} />
    )
}))

vi.mock('../components/WorkspaceSwitcher', () => ({
    default: () => <div data-testid='workspace-switcher' />
}))

const menu = {
    title: 'Runtime menu',
    showTitle: true,
    items: [
        {
            id: 'structures',
            label: 'Structures',
            kind: 'section' as const,
            objectCollectionId: 'structure-section',
            selected: true
        }
    ]
}

const zoneWidgets = {
    left: [
        {
            id: 'menu-widget',
            widgetKey: 'menuWidget',
            sortOrder: 1,
            config: {}
        }
    ],
    center: []
}

const zoneWidgetsWithoutMenu = {
    left: [
        {
            id: 'workspace-switcher',
            widgetKey: 'workspaceSwitcher',
            sortOrder: 1,
            config: {}
        },
        {
            id: 'divider',
            widgetKey: 'divider',
            sortOrder: 2,
            config: {}
        }
    ],
    center: []
}

const details = {
    title: 'Runtime',
    rows: [],
    columns: []
}

const setupUser = () => userEvent.setup({ skipHover: true })

describe('Dashboard side menu modes', () => {
    beforeEach(() => {
        ;(globalThis as typeof globalThis & { MUI_TEST_ENV?: boolean }).MUI_TEST_ENV = true
        window.localStorage.clear()
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            writable: true,
            value: vi.fn().mockImplementation((query: string) => ({
                matches: query.includes('min-width'),
                media: query,
                onchange: null,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                addListener: vi.fn(),
                removeListener: vi.fn(),
                dispatchEvent: vi.fn()
            }))
        })
    })

    afterEach(() => {
        delete (globalThis as typeof globalThis & { MUI_TEST_ENV?: boolean }).MUI_TEST_ENV
    })

    it('renders compact mode with accessible icon-only menu items', () => {
        render(
            <Dashboard
                details={details}
                menu={menu}
                zoneWidgets={zoneWidgets}
                layoutConfig={{
                    sideMenu: {
                        availableModes: ['wide', 'compact', 'overlay'],
                        primaryMode: 'compact',
                        rememberUserChoice: false
                    }
                }}
            />
        )

        const nav = screen.getByRole('navigation', { name: 'Runtime menu' })
        expect(within(nav).getByRole('button', { name: 'Structures' })).toHaveAttribute('aria-current', 'page')
        expect(within(nav).queryByText('Runtime menu')).not.toBeInTheDocument()
        expect(within(nav).queryByText('Structures')).not.toBeInTheDocument()
    })

    it('toggles wide and compact modes without cycling into overlay', async () => {
        const user = setupUser()
        render(
            <Dashboard
                details={{ ...details, applicationId: 'app-side-menu' }}
                menu={menu}
                zoneWidgets={zoneWidgets}
                layoutConfig={{
                    sideMenu: {
                        availableModes: ['wide', 'compact', 'overlay'],
                        primaryMode: 'wide',
                        rememberUserChoice: true
                    }
                }}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Enable compact menu' }))

        expect(window.localStorage.getItem('universo:apps-template:side-menu-mode:app-side-menu')).toBe('compact')
        expect(screen.getByRole('button', { name: 'Enable wide menu' })).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Enable wide menu' }))

        expect(window.localStorage.getItem('universo:apps-template:side-menu-mode:app-side-menu')).toBe('wide')
        expect(screen.getByRole('button', { name: 'Enable compact menu' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Use overlay menu' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Open overlay menu' })).not.toBeInTheDocument()
    })

    it('clears stale remembered menu modes when remembering is disabled', () => {
        window.localStorage.setItem('universo:apps-template:side-menu-mode:app-side-menu', 'compact')

        render(
            <Dashboard
                details={{ ...details, applicationId: 'app-side-menu' }}
                menu={menu}
                zoneWidgets={zoneWidgets}
                layoutConfig={{
                    sideMenu: {
                        availableModes: ['wide', 'compact'],
                        primaryMode: 'wide',
                        rememberUserChoice: false
                    }
                }}
            />
        )

        expect(window.localStorage.getItem('universo:apps-template:side-menu-mode:app-side-menu')).toBeNull()
        expect(screen.getByRole('button', { name: 'Enable compact menu' })).toBeInTheDocument()
    })

    it('keeps the dashboard usable when browser storage is unavailable', async () => {
        const user = setupUser()
        const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('Storage disabled', 'SecurityError')
        })
        const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('Storage disabled', 'SecurityError')
        })
        const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
            throw new DOMException('Storage disabled', 'SecurityError')
        })

        try {
            render(
                <Dashboard
                    details={{ ...details, applicationId: 'app-storage-disabled' }}
                    menu={menu}
                    zoneWidgets={zoneWidgets}
                    layoutConfig={{
                        sideMenu: {
                            availableModes: ['wide', 'compact', 'overlay'],
                            primaryMode: 'wide',
                            rememberUserChoice: true
                        }
                    }}
                />
            )

            await user.click(screen.getByRole('button', { name: 'Enable compact menu' }))
            expect(screen.getByRole('button', { name: 'Enable wide menu' })).toBeInTheDocument()
            await user.click(screen.getByRole('button', { name: 'Use overlay menu' }))
            expect(screen.getByTestId('runtime-side-menu-overlay')).toBeInTheDocument()
        } finally {
            getItem.mockRestore()
            setItem.mockRestore()
            removeItem.mockRestore()
        }
    })

    it('applies a valid remembered docked mode before the first visible render', () => {
        window.localStorage.setItem('universo:apps-template:side-menu-mode:app-side-menu', 'compact')

        render(
            <Dashboard
                details={{ ...details, applicationId: 'app-side-menu' }}
                menu={menu}
                zoneWidgets={zoneWidgets}
                layoutConfig={{
                    sideMenu: {
                        availableModes: ['wide', 'compact'],
                        primaryMode: 'wide',
                        rememberUserChoice: true
                    }
                }}
            />
        )

        expect(screen.getByRole('button', { name: 'Enable wide menu' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Enable compact menu' })).not.toBeInTheDocument()
        expect(window.localStorage.getItem('universo:apps-template:side-menu-mode:app-side-menu')).toBe('compact')
    })

    it('clears remembered menu modes that are no longer available', () => {
        window.localStorage.setItem('universo:apps-template:side-menu-mode:app-side-menu', 'overlay')

        render(
            <Dashboard
                details={{ ...details, applicationId: 'app-side-menu' }}
                menu={menu}
                zoneWidgets={zoneWidgets}
                layoutConfig={{
                    sideMenu: {
                        availableModes: ['wide', 'compact'],
                        primaryMode: 'wide',
                        rememberUserChoice: true
                    }
                }}
            />
        )

        expect(window.localStorage.getItem('universo:apps-template:side-menu-mode:app-side-menu')).toBeNull()
        expect(screen.getByRole('button', { name: 'Enable compact menu' })).toBeInTheDocument()
    })

    it('does not persist a side-menu mode outside the available mode set', () => {
        window.localStorage.setItem('universo:apps-template:side-menu-mode:app-side-menu', 'overlay')
        render(
            <Dashboard
                details={{ ...details, applicationId: 'app-side-menu' }}
                menu={menu}
                zoneWidgets={zoneWidgets}
                layoutConfig={{
                    sideMenu: {
                        availableModes: ['wide'],
                        primaryMode: 'wide',
                        rememberUserChoice: true
                    }
                }}
            />
        )

        expect(window.localStorage.getItem('universo:apps-template:side-menu-mode:app-side-menu')).toBeNull()
        expect(screen.queryAllByRole('button', { name: /Enable (compact|wide) menu/i })).toHaveLength(0)
        expect(screen.getByRole('navigation', { name: 'Runtime menu' })).toBeInTheDocument()
    })

    it('renders the desktop navbar for wide and compact side-menu switching', () => {
        render(
            <Dashboard
                details={details}
                menu={menu}
                zoneWidgets={zoneWidgets}
                layoutConfig={{
                    sideMenu: {
                        availableModes: ['wide', 'compact'],
                        primaryMode: 'wide',
                        rememberUserChoice: false
                    }
                }}
            />
        )

        expect(screen.getByRole('button', { name: 'Enable compact menu' })).toBeInTheDocument()
        const toolbarActions = screen.getByTestId('runtime-app-toolbar-actions')
        expect(toolbarActions).toBeInTheDocument()
        expect(toolbarActions.querySelector('[data-screenshot="toggle-mode"]')).toBeInTheDocument()
        expect(screen.queryByTestId('runtime-color-mode-button')).not.toBeInTheDocument()
        expect(screen.getByTestId('dashboard-main-grid')).toHaveAttribute('data-full-width', 'false')
    })

    it('lets compact side-menu mode use the full content rail', async () => {
        const user = setupUser()
        render(
            <Dashboard
                details={details}
                menu={menu}
                zoneWidgets={zoneWidgets}
                layoutConfig={{
                    sideMenu: {
                        availableModes: ['wide', 'compact', 'overlay'],
                        primaryMode: 'wide',
                        rememberUserChoice: false
                    }
                }}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Enable compact menu' }))

        expect(screen.getByRole('button', { name: 'Enable wide menu' })).toBeInTheDocument()
        expect(screen.getByTestId('dashboard-main-grid')).toHaveAttribute('data-full-width', 'true')
    })

    it('opens overlay menu from the navbar without reserving a permanent menu slot', async () => {
        const user = setupUser()
        render(
            <Dashboard
                details={details}
                menu={menu}
                zoneWidgets={zoneWidgets}
                layoutConfig={{
                    sideMenu: {
                        availableModes: ['overlay'],
                        primaryMode: 'overlay',
                        rememberUserChoice: false
                    }
                }}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Open menu' }))

        const navigations = screen.getAllByRole('navigation', { name: 'Runtime menu' })
        expect(navigations).toHaveLength(1)
        expect(within(navigations[0]).getByRole('button', { name: 'Structures' })).toBeInTheDocument()
        const drawerPaper = navigations[0].closest('.MuiDrawer-paper')
        expect(drawerPaper).toHaveStyle({ width: '240px' })
        expect(drawerPaper?.parentElement).not.toHaveStyle({ width: '0px' })
    })

    it('keeps the overlay opener available when the layout hides the app navbar', async () => {
        const user = setupUser()
        render(
            <Dashboard
                details={details}
                menu={menu}
                zoneWidgets={zoneWidgets}
                layoutConfig={{
                    showAppNavbar: false,
                    sideMenu: {
                        availableModes: ['overlay'],
                        primaryMode: 'overlay',
                        rememberUserChoice: false
                    }
                }}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Open menu' }))

        const drawerNavigation = screen.getByRole('navigation', { name: 'Runtime menu' })
        expect(within(drawerNavigation).getByRole('button', { name: 'Structures' })).toBeInTheDocument()
    })

    it('keeps the side menu mode switcher available when the layout hides the app navbar', () => {
        render(
            <Dashboard
                details={details}
                menu={menu}
                zoneWidgets={zoneWidgets}
                layoutConfig={{
                    showAppNavbar: false,
                    sideMenu: {
                        availableModes: ['wide', 'compact', 'overlay'],
                        primaryMode: 'wide',
                        rememberUserChoice: false
                    }
                }}
            />
        )

        expect(screen.getByRole('button', { name: 'Enable compact menu' })).toBeInTheDocument()
    })

    it('does not force side-menu navbar controls when the side menu is disabled', () => {
        render(
            <Dashboard
                details={details}
                menu={menu}
                zoneWidgets={zoneWidgets}
                layoutConfig={{
                    showSideMenu: false,
                    showAppNavbar: false,
                    sideMenu: {
                        availableModes: ['wide', 'compact', 'overlay'],
                        primaryMode: 'wide',
                        rememberUserChoice: false
                    }
                }}
            />
        )

        expect(screen.queryByRole('button', { name: /Enable (compact|wide) menu/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Open overlay menu' })).not.toBeInTheDocument()
        expect(screen.queryByRole('navigation', { name: 'Runtime menu' })).not.toBeInTheDocument()
    })

    it('switches overlay mode from the side-menu controls and restores the previous docked mode', async () => {
        const user = setupUser()
        render(
            <Dashboard
                details={{ ...details, applicationId: 'app-side-menu' }}
                menu={menu}
                zoneWidgets={zoneWidgets}
                layoutConfig={{
                    sideMenu: {
                        availableModes: ['wide', 'compact', 'overlay'],
                        primaryMode: 'wide',
                        rememberUserChoice: true
                    }
                }}
            />
        )

        expect(screen.queryByRole('heading', { name: 'Runtime menu' })).not.toBeInTheDocument()
        expect(screen.getByTestId('runtime-side-menu-docked')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Enable compact menu' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Use overlay menu' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Open overlay menu' })).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Use overlay menu' }))

        expect(window.localStorage.getItem('universo:apps-template:side-menu-mode:app-side-menu')).toBe('overlay')
        expect(screen.queryByTestId('runtime-side-menu-docked')).not.toBeInTheDocument()
        expect(screen.getByTestId('runtime-side-menu-overlay')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Use docked menu' })).toBeInTheDocument()
        expect(screen.getByTestId('runtime-overlay-menu-edge-control')).toBeInTheDocument()
        expect(screen.getByTestId('dashboard-main-grid')).toHaveAttribute('data-full-width', 'true')
        expect(document.body.querySelectorAll('nav[aria-label="Runtime menu"]')).toHaveLength(1)

        await user.click(screen.getByRole('button', { name: 'Use docked menu' }))

        expect(window.localStorage.getItem('universo:apps-template:side-menu-mode:app-side-menu')).toBe('wide')
        expect(screen.getByTestId('runtime-side-menu-docked')).toBeInTheDocument()
        expect(screen.queryByTestId('runtime-side-menu-overlay')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Enable compact menu' })).toBeInTheDocument()
        expect(screen.getByTestId('dashboard-main-grid')).toHaveAttribute('data-full-width', 'false')
        expect(screen.getByRole('button', { name: 'Use overlay menu' })).toBeInTheDocument()
    })

    it('centers and stacks side-menu controls in compact mode', () => {
        render(
            <Dashboard
                details={details}
                menu={menu}
                zoneWidgets={zoneWidgets}
                layoutConfig={{
                    sideMenu: {
                        availableModes: ['wide', 'compact', 'overlay'],
                        primaryMode: 'compact',
                        rememberUserChoice: false
                    }
                }}
            />
        )

        const dockedSideMenu = screen.getByTestId('runtime-side-menu-docked')
        const controls = within(dockedSideMenu).getByTestId('runtime-side-menu-controls')
        expect(controls).toHaveStyle({ flexDirection: 'column', justifyContent: 'center' })
        expect(within(controls).getByRole('button', { name: 'Enable wide menu' })).toBeInTheDocument()
        expect(within(controls).getByRole('button', { name: 'Use overlay menu' })).toBeInTheDocument()
        expect(within(controls).getByRole('button', { name: 'Enable wide menu' })).not.toHaveStyle({ width: '100%' })
        expect(within(controls).getByRole('button', { name: 'Use overlay menu' })).not.toHaveStyle({ width: '100%' })
    })

    it('opens the configured overlay drawer from mobile navbar clicks', async () => {
        vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
            matches: query.includes('max-width'),
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn()
        }))
        const user = setupUser()
        render(
            <Dashboard
                details={details}
                menu={menu}
                zoneWidgets={zoneWidgets}
                layoutConfig={{
                    sideMenu: {
                        availableModes: ['overlay'],
                        primaryMode: 'overlay',
                        rememberUserChoice: false
                    }
                }}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Open menu' }))

        const navigations = screen.getAllByRole('navigation', { name: 'Runtime menu' })
        expect(navigations).toHaveLength(1)
        expect(within(navigations[0]).getByRole('button', { name: 'Structures' })).toBeInTheDocument()
    })

    it('keeps fallback mobile navigation when left widgets do not include a menu widget', async () => {
        const user = setupUser()
        render(
            <Dashboard
                details={details}
                menu={menu}
                zoneWidgets={zoneWidgetsWithoutMenu}
                layoutConfig={{
                    sideMenu: {
                        availableModes: ['overlay'],
                        primaryMode: 'overlay',
                        rememberUserChoice: false
                    }
                }}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Open menu' }))

        const drawerNavigation = screen.getByRole('navigation', { name: 'Runtime menu' })
        expect(within(drawerNavigation).getByRole('button', { name: 'Structures' })).toBeInTheDocument()
        expect(screen.getByTestId('workspace-switcher')).toBeInTheDocument()
    })
})
