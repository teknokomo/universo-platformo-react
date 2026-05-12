import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
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
                        { id: 'home', label: 'Home', kind: 'page', sectionId: 'home', selected: false },
                        { id: 'reports', label: 'Reports', kind: 'catalog', linkedCollectionId: 'reports', selected: true }
                    ]
                }}
            />
        )

        const reportsButton = screen.getByRole('button', { name: 'Reports' })
        expect(reportsButton).toHaveAttribute('aria-current', 'page')
        expect(reportsButton).toHaveClass('Mui-selected')
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
})
