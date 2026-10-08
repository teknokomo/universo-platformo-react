import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AppNavbar from '../AppNavbar'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'
import type { DashboardDetailsSlot, ZoneWidgetItem } from '../../contracts'

const i18nMock = vi.hoisted(() => ({
    translations: {
        'runtime.menu.open': 'Открыть меню',
        'runtime.menu.navigation': 'Навигация приложения',
        'runtime.menu.more': 'Ещё',
        'workspace.title': 'Рабочие пространства',
        'workspace.dashboard': 'Дашборд',
        'workspace.access': 'Доступ',
        'workspace.settings': 'Настройки'
    } as Record<string, string>
}))

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        t: (key: string, options?: string | { defaultValue?: string }) =>
            i18nMock.translations[key] ?? (typeof options === 'string' ? options : options?.defaultValue) ?? key
    })
}))

vi.mock('../SideMenuMobileRight', () => ({ default: () => null }))

const createMenuWidget = (overflow = false): ZoneWidgetItem => ({
    id: '018f0000-0000-7000-8000-000000000001',
    instanceKey: 'mobile-menu',
    widgetKey: 'menuWidget',
    zone: 'left',
    sortOrder: 0,
    config: {},
    isActive: true,
    parentInstanceKey: null,
    slotKey: null,
    runtimeData: {
        status: 'ready',
        data: {
            kind: 'menu',
            title: 'Меню приложения',
            showTitle: true,
            overflowLabel: 'Дополнительно',
            items: [
                {
                    key: 'menu.structures',
                    label: 'Структуры',
                    icon: 'database',
                    kind: 'section',
                    target: { kind: 'object', codename: 'Structures' }
                }
            ],
            overflowItems: overflow ? [{ key: 'menu.archive', label: 'Архив', icon: 'folder', kind: 'link', href: '/a/app-1/archive' }] : []
        }
    } as unknown as ZoneWidgetItem['runtimeData']
})

const details: DashboardDetailsSlot = {
    title: 'Runtime',
    locale: 'ru',
    applicationId: 'app-1',
    runtimeAccessMode: 'member',
    workspacesEnabled: true
}

const renderNavbar = (widget = createMenuWidget()) => {
    const placements = [widget]
    return render(
        <DashboardDetailsProvider value={details}>
            <AppNavbar zoneWidgets={{ left: placements }} placements={placements} />
        </DashboardDetailsProvider>
    )
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
        window.history.replaceState({}, '', '/a/app-1')
    })

    afterEach(() => {
        delete (globalThis as typeof globalThis & { MUI_TEST_ENV?: boolean }).MUI_TEST_ENV
    })

    it('exposes a stable opener-to-drawer relationship with localized labels', () => {
        const { rerender } = renderNavbar()
        const opener = screen.getByRole('button', { name: 'Открыть меню', hidden: true })
        const drawerId = opener.getAttribute('aria-controls')

        expect(drawerId).toBeTruthy()
        expect(opener).toHaveAttribute('aria-expanded', 'false')
        expect(document.getElementById(drawerId ?? '')).toBeInTheDocument()

        rerender(
            <DashboardDetailsProvider value={details}>
                <AppNavbar zoneWidgets={{ left: [createMenuWidget()] }} placements={[createMenuWidget()]} />
            </DashboardDetailsProvider>
        )
        expect(screen.getByRole('button', { name: 'Открыть меню', hidden: true })).toHaveAttribute('aria-controls', drawerId)

        fireEvent.click(opener)
        expect(opener).toHaveAttribute('aria-expanded', 'true')

        const drawer = drawerId ? document.getElementById(drawerId) : null
        expect(drawer).not.toBeNull()
        if (!drawer) return
        expect(within(drawer).getByRole('navigation', { name: 'Навигация приложения' })).toBeInTheDocument()
    })

    it('keeps the mobile drawer open while using the localized overflow menu', async () => {
        renderNavbar(createMenuWidget(true))
        const opener = screen.getByRole('button', { name: 'Открыть меню', hidden: true })

        fireEvent.click(opener)
        fireEvent.click(screen.getByRole('button', { name: 'Дополнительно' }))

        await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument())
        expect(opener).toHaveAttribute('aria-expanded', 'true')

        fireEvent.click(screen.getByRole('menuitem', { name: 'Архив' }))
        await waitFor(() => expect(opener).toHaveAttribute('aria-expanded', 'false'))
        expect(opener).toHaveFocus()
    })

    it('restores focus after choosing a runtime-projected workspace navigation link', async () => {
        window.history.replaceState({}, '', '/a/app-1/workspaces/workspace-alpha/access?locale=ru')
        renderNavbar()
        const opener = screen.getByRole('button', { name: 'Открыть меню', hidden: true })

        fireEvent.click(opener)
        const workspaceAccessLink = screen.getByRole('link', { name: 'Доступ' })
        expect(workspaceAccessLink).toHaveAttribute('aria-current', 'page')
        fireEvent.click(workspaceAccessLink)

        await waitFor(() => expect(opener).toHaveAttribute('aria-expanded', 'false'))
        expect(opener).toHaveFocus()
    })

    it('restores focus after Escape and after selecting a navigation item', async () => {
        const user = userEvent.setup()
        renderNavbar()
        const opener = screen.getByRole('button', { name: 'Открыть меню', hidden: true })

        act(() => opener.focus())
        fireEvent.click(opener)
        await user.keyboard('{Escape}')
        await waitFor(() => expect(opener).toHaveAttribute('aria-expanded', 'false'))
        expect(opener).toHaveFocus()

        act(() => opener.focus())
        fireEvent.click(opener)
        fireEvent.click(screen.getByRole('link', { name: 'Структуры' }))
        await waitFor(() => expect(opener).toHaveAttribute('aria-expanded', 'false'))
        expect(opener).toHaveFocus()
    })
})
