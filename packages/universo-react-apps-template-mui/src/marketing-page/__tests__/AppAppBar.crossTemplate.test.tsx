import type { ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'

import AppAppBar from '../components/AppAppBar'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}))

vi.mock('../../components/LanguageSwitcher', () => ({
    default: () => (
        <button type='button' data-testid='shared-language-switcher'>
            Language
        </button>
    )
}))

vi.mock('../components/MarketingPrimitives', () => ({
    MarketingActionButton: ({
        action,
        children,
        onAction: _onAction,
        fullWidth: _fullWidth,
        color: _color,
        variant: _variant,
        size: _size,
        sx: _sx,
        ...props
    }: {
        action?: { href: string; label: string; target?: string; rel?: string }
        children?: ReactNode
        onAction?: unknown
        fullWidth?: boolean
        color?: string
        variant?: string
        size?: string
        sx?: unknown
        [key: string]: unknown
    }) =>
        action ? (
            <a href={action.href} target={action.target} rel={action.rel} {...props}>
                {children ?? action.label}
            </a>
        ) : null,
    MarketingColorModeControl: () => null,
    MarketingMediaView: () => null,
    invokeMarketingAction: vi.fn(),
    resolveMarketingAction: (action?: { href?: string; target?: string }) =>
        action?.href ? { href: action.href, target: action.target } : null,
    sortVisibleMarketingItems: <T,>(items: T[]) => items
}))

describe('marketing shell shared capabilities', () => {
    it('keeps the primary navigation fixed like the original marketing template', () => {
        render(<AppAppBar brand={{ name: 'Acme' }} navigation={[]} auth={{}} />)

        expect(screen.getByTestId('marketing-navigation-instance').closest('.MuiAppBar-root')).toHaveClass('MuiAppBar-positionFixed')
    })

    it('supports static positioning for repeated navigation instances', () => {
        render(<AppAppBar brand={{ name: 'Acme' }} navigation={[]} auth={{}} navigationPosition='static' />)

        expect(screen.getByTestId('marketing-navigation-instance').closest('.MuiAppBar-root')).toHaveClass('MuiAppBar-positionStatic')
    })

    it('keeps every current fixed navigation instance on the shared stack contract', () => {
        render(<AppAppBar brand={{ name: 'Acme' }} navigation={[]} auth={{}} navigationStackIndex={2} />)

        expect(screen.getByTestId('marketing-navigation-instance').closest('.MuiAppBar-root')).toHaveClass('MuiAppBar-positionFixed')
    })

    it('renders the existing LanguageSwitcher once in the responsive AppBar action area', () => {
        render(<AppAppBar brand={{ name: 'Acme' }} navigation={[]} auth={{}} />)

        expect(screen.getAllByTestId('shared-language-switcher')).toHaveLength(1)
    })

    it('keeps the responsive navigation keyboard-accessible without nested interactive controls', async () => {
        const user = userEvent.setup()
        const menuButtonName = 'marketingPage.navigation.openMenu'
        const closeButtonName = 'marketingPage.navigation.closeMenu'

        render(
            <AppAppBar
                brand={{ name: 'Acme' }}
                navigation={[
                    {
                        semanticKey: 'docs',
                        label: 'Docs',
                        actionKind: 'internal',
                        href: '/docs'
                    }
                ]}
                auth={{
                    signIn: { semanticKey: 'sign-in', label: 'Sign in', actionKind: 'internal', href: '/sign-in' },
                    signUp: { semanticKey: 'sign-up', label: 'Sign up', actionKind: 'internal', href: '/sign-up' }
                }}
            />
        )

        const menuButton = screen.getByRole('button', { name: menuButtonName, hidden: true })
        expect(menuButton).toHaveAttribute('aria-expanded', 'false')
        expect(menuButton).toHaveAttribute('aria-controls', 'marketing-navigation-drawer')

        fireEvent.click(menuButton)

        const drawer = document.getElementById('marketing-navigation-drawer')
        expect(drawer).not.toBeNull()
        if (!drawer) return

        const docsLink = within(drawer).getByRole('link', { name: 'Docs' })
        expect(docsLink).toHaveAttribute('href', '/docs')
        expect(docsLink).not.toHaveAttribute('tabindex', '-1')
        expect(drawer.querySelectorAll('a button, button a')).toHaveLength(0)

        await user.click(within(drawer).getByRole('button', { name: closeButtonName }))
        expect(menuButton).toHaveFocus()
    })
})
