import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AppNavbar from '../AppNavbar'

const i18nMock = vi.hoisted(() => ({
    translations: {
        'runtime.menu.open': 'Открыть меню',
        'runtime.menu.navigation': 'Навигация приложения',
        'runtime.menu.more': 'Ещё'
    } as Record<string, string>
}))

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        t: (key: string, fallback?: string) => i18nMock.translations[key] ?? fallback ?? key
    })
}))

vi.mock('../../../components/LanguageSwitcher', () => ({ default: () => null }))
vi.mock('../../../shared-theme/ColorModeIconDropdown', () => ({
    default: () => null
}))
vi.mock('../SideMenuMobileRight', () => ({ default: () => null }))
vi.mock('../widgetRenderer', () => ({
    renderWidget: (widget: { widgetKey: string; id: string }, menus?: Record<string, { items?: Array<{ label: string }> }>) => {
        if (widget.widgetKey !== 'menuWidget') return null
        const label = menus?.[widget.id]?.items?.[0]?.label ?? 'Меню виджета'
        return (
            <nav key={widget.id} aria-label='Меню виджета'>
                <div role='button' aria-label={label}>
                    {label}
                </div>
            </nav>
        )
    }
}))

const menu = {
    title: 'Меню приложения',
    showTitle: true,
    items: [
        {
            id: 'structures',
            label: 'Структуры',
            kind: 'section' as const,
            objectCollectionId: 'structures',
            selected: true
        }
    ]
}

const menuWithOverflow = {
    ...menu,
    overflowLabel: 'Дополнительно',
    overflowItems: [
        {
            id: 'archive',
            label: 'Архив',
            kind: 'section' as const,
            objectCollectionId: 'archive'
        }
    ]
}

const widgetMenus = {
    fallback: menu,
    'widget-menu': {
        title: 'Меню виджета',
        items: [
            {
                id: 'widget-structures',
                label: 'Раздел виджета',
                kind: 'section' as const,
                objectCollectionId: 'widget-structures'
            }
        ]
    }
}

const widgetMenuLayout = {
    left: [{ id: 'widget-menu', widgetKey: 'menuWidget', sortOrder: 0, config: {} }]
}

describe('AppNavbar mobile navigation accessibility', () => {
    beforeEach(() => {
        ;(globalThis as typeof globalThis & { MUI_TEST_ENV?: boolean }).MUI_TEST_ENV = true
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            writable: true,
            value: vi.fn().mockImplementation((query: string) => ({
                matches: query.includes('max-width'),
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

    it('exposes a stable opener-to-drawer relationship with localized labels', async () => {
        const { rerender } = render(<AppNavbar menu={menu} />)
        const opener = screen.getByRole('button', { name: 'Открыть меню', hidden: true })
        const drawerId = opener.getAttribute('aria-controls')

        expect(drawerId).toBeTruthy()
        expect(opener).toHaveAttribute('aria-expanded', 'false')
        expect(document.getElementById(drawerId ?? '')).toBeInTheDocument()

        rerender(<AppNavbar menu={menu} />)
        expect(screen.getByRole('button', { name: 'Открыть меню', hidden: true })).toHaveAttribute('aria-controls', drawerId)

        fireEvent.click(opener)
        expect(opener).toHaveAttribute('aria-expanded', 'true')

        const drawer = drawerId ? document.getElementById(drawerId) : null
        expect(drawer).not.toBeNull()
        if (!drawer) return

        expect(within(drawer).getByRole('navigation', { name: 'Меню приложения' })).toBeInTheDocument()
    })

    it('keeps the mobile drawer open while using the localized overflow menu', async () => {
        render(<AppNavbar menu={menuWithOverflow} />)
        const opener = screen.getByRole('button', { name: 'Открыть меню', hidden: true })

        fireEvent.click(opener)
        fireEvent.click(screen.getByRole('button', { name: 'Дополнительно' }))

        await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument())
        expect(opener).toHaveAttribute('aria-expanded', 'true')

        fireEvent.click(screen.getByRole('menuitem', { name: 'Архив' }))
        await waitFor(() => expect(opener).toHaveAttribute('aria-expanded', 'false'))
        expect(opener).toHaveFocus()
    })

    it('restores focus after selecting a widget-specific navigation item', async () => {
        render(<AppNavbar menus={widgetMenus} zoneWidgets={widgetMenuLayout} />)
        const opener = screen.getByRole('button', { name: 'Открыть меню', hidden: true })

        fireEvent.click(opener)
        fireEvent.click(screen.getByRole('button', { name: 'Раздел виджета' }))

        await waitFor(() => expect(opener).toHaveAttribute('aria-expanded', 'false'))
        expect(opener).toHaveFocus()
    })

    it('restores focus after Escape and after selecting a navigation item', async () => {
        const user = userEvent.setup()
        render(<AppNavbar menu={menu} />)
        const opener = screen.getByRole('button', { name: 'Открыть меню', hidden: true })

        act(() => opener.focus())
        fireEvent.click(opener)
        await user.keyboard('{Escape}')
        await waitFor(() => expect(opener).toHaveAttribute('aria-expanded', 'false'))
        expect(opener).toHaveFocus()

        act(() => opener.focus())
        fireEvent.click(opener)
        fireEvent.click(screen.getByRole('button', { name: 'Структуры' }))
        await waitFor(() => expect(opener).toHaveAttribute('aria-expanded', 'false'))
        expect(opener).toHaveFocus()
    })
})
