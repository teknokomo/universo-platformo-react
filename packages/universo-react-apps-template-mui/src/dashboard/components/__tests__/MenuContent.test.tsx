import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import i18n from '@universo-react/i18n'
import '../../../i18n'
import { sanitizeHref } from '../MenuContent'
import MenuContent, { type RuntimeMenuViewModel } from '../MenuContent'

const viewModel = (overrides: Partial<RuntimeMenuViewModel> = {}): RuntimeMenuViewModel => ({
    title: 'Application navigation',
    showTitle: false,
    overflowLabel: 'More',
    items: [],
    overflowItems: [],
    ...overrides
})

describe('MenuContent', () => {
    beforeEach(() => {
        window.history.replaceState({}, '', '/')
    })

    afterEach(async () => {
        await i18n.changeLanguage('en')
    })

    it('localizes the navigation landmark independently of a persisted default title', async () => {
        await i18n.changeLanguage('ru')
        render(<MenuContent viewModel={viewModel()} />)

        expect(await screen.findByRole('navigation', { name: 'Навигация приложения' })).toBeInTheDocument()
    })

    it('keeps safe internal, http, mail, tel, and hash links', () => {
        expect(sanitizeHref('/workspaces')).toBe('/workspaces')
        expect(sanitizeHref('#overview')).toBe('#overview')
        expect(sanitizeHref('https://example.test/path')).toBe('https://example.test/path')
        expect(sanitizeHref('http://example.test/path')).toBe('http://example.test/path')
        expect(sanitizeHref('mailto:support@example.test')).toBe('mailto:support@example.test')
        expect(sanitizeHref('tel:+10000000000')).toBe('tel:+10000000000')
    })

    it('blocks unsafe schemes and protocol-relative links', () => {
        expect(sanitizeHref('javascript:alert(1)')).toBeUndefined()
        expect(sanitizeHref('data:text/html,<script>alert(1)</script>')).toBeUndefined()
        expect(sanitizeHref('vbscript:msgbox(1)')).toBeUndefined()
        expect(sanitizeHref('//example.test/path')).toBeUndefined()
    })

    it('selects only a link whose same-origin route exactly matches the current route', () => {
        window.history.replaceState({}, '', '/a/app-1/reports?locale=ru')
        render(
            <MenuContent
                viewModel={viewModel({
                    items: [
                        { key: 'home', label: 'Home', href: '/a/app-1/home' },
                        { key: 'reports', label: 'Reports', href: '/a/app-1/reports?locale=ru' }
                    ]
                })}
            />
        )

        const reportsLink = screen.getByRole('link', { name: 'Reports' })
        expect(reportsLink).toHaveAttribute('aria-current', 'page')
        expect(reportsLink).toHaveClass('Mui-selected')
        expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
    })

    it('does not implicitly select the first link at the application root', () => {
        window.history.replaceState({}, '', '/a/app-1')
        render(
            <MenuContent
                viewModel={viewModel({
                    items: [
                        { key: 'home', label: 'Home', href: '/a/app-1/home' },
                        { key: 'reports', label: 'Reports', href: '/a/app-1/reports' }
                    ]
                })}
            />
        )

        expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
        expect(screen.getByRole('link', { name: 'Reports' })).not.toHaveAttribute('aria-current')
    })

    it('keeps compact navigation accessible and renders group labels as non-interactive headings', () => {
        render(
            <MenuContent
                variant='compact'
                viewModel={viewModel({
                    title: 'Main menu',
                    showTitle: true,
                    overflowLabel: 'More actions',
                    items: [
                        { key: 'group-0', label: 'Learning', kind: 'group', icon: 'folder' },
                        { key: 'course-0', label: 'Courses', href: '/a/app-1?targetKind=object&entityTypeCodename=Courses', selected: true }
                    ],
                    overflowItems: [{ key: 'settings-0', label: 'Settings', href: '/settings' }]
                })}
            />
        )

        const nav = screen.getByRole('navigation', { name: 'Application navigation' })
        expect(within(nav).getByRole('heading', { name: 'Learning' })).toBeInTheDocument()
        expect(within(nav).queryByRole('button', { name: 'Learning' })).not.toBeInTheDocument()
        expect(within(nav).getByRole('link', { name: 'Courses' })).toHaveAttribute('aria-current', 'page')
        expect(within(nav).queryByText('Main menu')).not.toBeInTheDocument()
        expect(within(nav).queryByText('Courses')).not.toBeInTheDocument()
        expect(within(nav).getByRole('button', { name: 'More actions' })).toBeInTheDocument()
    })

    it('marks the workspace section boundary with the existing divider treatment', () => {
        render(
            <MenuContent
                viewModel={viewModel({
                    items: [
                        { key: 'runtime-menu-item-0', label: 'Courses', href: '/a/app-1?targetKind=object&entityTypeCodename=Courses' },
                        { key: 'runtime-workspaces-list', label: 'Workspaces', href: '/a/app-1/workspaces', dividerBefore: true }
                    ]
                })}
            />
        )

        expect(screen.getByRole('separator')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Workspaces' })).toHaveAttribute('data-runtime-navigation-link')
    })

    it('navigates same-origin application links without a full page reload', () => {
        window.history.replaceState({}, '', '/a/app-1')
        render(<MenuContent viewModel={viewModel({ items: [{ key: 'reports', label: 'Reports', href: '/a/app-1/reports' }] })} />)
        const onPopState = vi.fn()
        window.addEventListener('popstate', onPopState)

        fireEvent.click(screen.getByRole('link', { name: 'Reports' }))

        expect(window.location.pathname).toBe('/a/app-1/reports')
        expect(onPopState).toHaveBeenCalledOnce()
        window.removeEventListener('popstate', onPopState)
    })

    it('delegates same-origin application navigation to the host router when provided', () => {
        window.history.replaceState({}, '', '/a/app-1')
        const onNavigate = vi.fn()
        render(
            <MenuContent
                viewModel={viewModel({
                    items: [{ key: 'workspaces', label: 'Workspaces', href: '/a/app-1/workspaces?locale=ru&workspaceId=workspace-1' }]
                })}
                onNavigate={onNavigate}
            />
        )

        fireEvent.click(screen.getByRole('link', { name: 'Workspaces' }))

        expect(onNavigate).toHaveBeenCalledOnce()
        expect(onNavigate).toHaveBeenCalledWith('/a/app-1/workspaces?locale=ru&workspaceId=workspace-1')
        expect(window.location.pathname).toBe('/a/app-1')
    })

    it('updates standalone hash routes without replacing the application pathname', () => {
        window.history.replaceState({}, '', '/#/a/app-1')
        render(<MenuContent viewModel={viewModel({ items: [{ key: 'workspaces', label: 'Workspaces', href: '/a/app-1/workspaces' }] })} />)

        fireEvent.click(screen.getByRole('link', { name: 'Workspaces' }))

        expect(window.location.pathname).toBe('/')
        expect(window.location.hash).toBe('#/a/app-1/workspaces')
    })

    it('keeps browser modified-click behavior for same-origin application links', () => {
        window.history.replaceState({}, '', '/a/app-1')
        const onNavigate = vi.fn()
        render(
            <MenuContent
                viewModel={viewModel({ items: [{ key: 'reports', label: 'Reports', href: '/a/app-1/reports' }] })}
                onNavigate={onNavigate}
            />
        )
        const reportsLink = screen.getByRole('link', { name: 'Reports' })

        fireEvent.click(reportsLink, { ctrlKey: true })
        fireEvent.click(reportsLink, { metaKey: true })

        expect(onNavigate).not.toHaveBeenCalled()
    })

    it('closes the overflow menu after selecting a runtime link', () => {
        window.history.replaceState({}, '', '/a/app-1')
        render(
            <MenuContent
                viewModel={viewModel({
                    overflowItems: [{ key: 'archive', label: 'Archive', href: '/a/app-1/archive' }]
                })}
            />
        )

        const moreButton = screen.getByRole('button', { name: 'More' })
        expect(moreButton).toHaveAttribute('aria-haspopup', 'menu')
        expect(moreButton).toHaveAttribute('aria-expanded', 'false')
        fireEvent.click(moreButton)
        expect(moreButton).toHaveAttribute('aria-expanded', 'true')
        expect(moreButton).toHaveAttribute('aria-controls', screen.getByRole('menu').id)
        fireEvent.click(screen.getByRole('menuitem', { name: 'Archive' }))

        expect(window.location.pathname).toBe('/a/app-1/archive')
        expect(screen.queryByRole('menuitem', { name: 'Archive' })).not.toBeInTheDocument()
    })

    it('preserves browser modified-click behavior for overflow runtime links', () => {
        window.history.replaceState({}, '', '/a/app-1')
        const onNavigate = vi.fn()
        render(
            <MenuContent
                viewModel={viewModel({
                    overflowItems: [{ key: 'archive', label: 'Archive', href: '/a/app-1/archive' }]
                })}
                onNavigate={onNavigate}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'More' }))
        const archiveLink = screen.getByRole('menuitem', { name: 'Archive' })

        expect(fireEvent.click(archiveLink, { ctrlKey: true })).toBe(true)
        expect(fireEvent.click(archiveLink, { metaKey: true })).toBe(true)
        expect(archiveLink).toHaveAttribute('href', '/a/app-1/archive')
        expect(onNavigate).not.toHaveBeenCalled()
        expect(screen.queryByRole('menuitem', { name: 'Archive' })).not.toBeInTheDocument()
    })
})
