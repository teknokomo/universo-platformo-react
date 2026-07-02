import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { sanitizeHref } from '../MenuContent'
import MenuContent from '../MenuContent'

describe('MenuContent sanitizeHref', () => {
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

    it('marks the selected runtime menu item as the current page', () => {
        render(
            <MenuContent
                menu={{
                    items: [
                        { id: 'home', label: 'Home', kind: 'section', sectionId: 'home', selected: false },
                        { id: 'reports', label: 'Reports', kind: 'section', objectCollectionId: 'reports', selected: true }
                    ]
                }}
            />
        )

        const reportsButton = screen.getByRole('button', { name: 'Reports' })
        expect(reportsButton).toHaveAttribute('aria-current', 'page')
        expect(reportsButton).toHaveClass('Mui-selected')
    })

    it('keeps page-backed section clicks separate from object collection clicks', () => {
        const onSelectSection = vi.fn()
        const onSelectObjectCollection = vi.fn()

        render(
            <MenuContent
                menu={{
                    items: [
                        { id: 'intro', label: 'Intro', kind: 'section', sectionId: 'page-intro', selected: false },
                        {
                            id: 'structures',
                            label: 'Structures',
                            kind: 'section',
                            sectionId: 'object-structure',
                            objectCollectionId: 'object-structure',
                            selected: false
                        }
                    ],
                    onSelectSection,
                    onSelectObjectCollection
                }}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'Intro' }))
        expect(onSelectSection).toHaveBeenCalledWith('page-intro')
        expect(onSelectObjectCollection).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Structures' }))
        expect(onSelectObjectCollection).toHaveBeenCalledWith('object-structure')
    })

    it('marks a safe link item as current when its href matches the current location', () => {
        window.history.pushState({}, '', '/a/app-1/reports')

        render(
            <MenuContent
                menu={{
                    items: [{ id: 'reports', label: 'Reports', kind: 'link', href: '/a/app-1/reports', selected: false }]
                }}
            />
        )

        const reportsLink = screen.getByRole('link', { name: 'Reports' })
        expect(reportsLink).toHaveAttribute('aria-current', 'page')
        expect(reportsLink).toHaveClass('Mui-selected')
    })

    it('marks the first runtime link as current on the root application URL', () => {
        window.history.pushState({}, '', '/a/app-1')

        render(
            <MenuContent
                menu={{
                    items: [
                        { id: 'home', label: 'Home', kind: 'link', href: '/a/app-1/home-section', selected: false },
                        { id: 'reports', label: 'Reports', kind: 'link', href: '/a/app-1/reports', selected: false }
                    ]
                }}
            />
        )

        const homeLink = screen.getByRole('link', { name: 'Home' })
        const reportsLink = screen.getByRole('link', { name: 'Reports' })
        expect(homeLink).toHaveAttribute('aria-current', 'page')
        expect(homeLink).toHaveClass('Mui-selected')
        expect(reportsLink).not.toHaveAttribute('aria-current')
    })

    it('keeps compact menu items accessible without rendering visible labels or title', () => {
        render(
            <MenuContent
                variant='compact'
                menu={{
                    title: 'Main menu',
                    showTitle: true,
                    items: [
                        { id: 'home', label: 'Home', kind: 'section', sectionId: 'home', selected: false },
                        { id: 'reports', label: 'Reports', kind: 'section', objectCollectionId: 'reports', selected: true }
                    ],
                    overflowItems: [{ id: 'settings', label: 'Settings', kind: 'link', href: '/settings' }],
                    overflowLabel: 'More actions'
                }}
            />
        )

        const nav = screen.getByRole('navigation', { name: 'Main menu' })
        const reportsButton = within(nav).getByRole('button', { name: 'Reports' })
        expect(reportsButton).toHaveAttribute('aria-current', 'page')
        expect(within(nav).queryByText('Main menu')).not.toBeInTheDocument()
        expect(within(nav).queryByText('Home')).not.toBeInTheDocument()
        expect(within(nav).queryByText('Reports')).not.toBeInTheDocument()
        expect(within(nav).getByRole('button', { name: 'More actions' })).toBeInTheDocument()
    })

    it('does not render unresolved section and hub items as inert navigation entries', () => {
        render(
            <MenuContent
                menu={{
                    items: [
                        { id: 'structure', label: 'Structure', kind: 'section', objectCollectionId: 'structure-id' },
                        { id: 'hub-only', label: 'Hub by id', kind: 'hub', hubId: 'hub-id' },
                        { id: 'stale-section', label: 'Deleted structure', kind: 'section' },
                        { id: 'stale-hub', label: 'Deleted hub', kind: 'hub' },
                        { id: 'safe-link', label: 'Help', kind: 'link', href: '/help' }
                    ],
                    overflowItems: [
                        { id: 'stale-overflow-section', label: 'Deleted overflow structure', kind: 'section' },
                        { id: 'stale-overflow-hub', label: 'Deleted overflow hub', kind: 'hub' }
                    ],
                    overflowLabel: 'More'
                }}
            />
        )

        expect(screen.getByRole('button', { name: 'Structure' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Hub by id' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Help' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Deleted structure' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Deleted hub' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument()
    })
})
