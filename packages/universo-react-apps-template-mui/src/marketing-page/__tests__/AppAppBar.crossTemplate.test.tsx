import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'

import { MarketingHeaderShell } from '../components/AppAppBar'
import type { MarketingHeaderProjection } from '../marketingHeaderRuntime'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { defaultValue?: string; brand?: string; index?: string }) => {
            if (key === 'marketingPage.navigation.landmark') return `${options?.brand} navigation ${options?.index}`
            return options?.defaultValue ?? key
        }
    })
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
    MarketingColorModeControl: () => (
        <button type='button' data-testid='color-mode-switcher'>
            Color mode
        </button>
    ),
    MarketingMediaView: () => null,
    invokeMarketingAction: vi.fn(),
    resolveMarketingAction: (action?: { href?: string; target?: string }) =>
        action?.href ? { href: action.href, target: action.target } : null,
    sortVisibleMarketingItems: <T,>(items: T[]) => items
}))

const action = (href: string, label: string) => ({
    semanticKey: label.toLowerCase().replace(/\s+/g, '-'),
    label,
    actionKind: 'internal' as const,
    href,
    target: '_self' as const
})

const headerWidgets: MarketingHeaderProjection[] = [
    {
        widgetKey: 'marketing.brand',
        instanceKey: 'brand',
        sortOrder: 0,
        placement: 'start',
        content: { name: 'Acme' }
    },
    {
        widgetKey: 'marketing.navigation',
        instanceKey: 'primary-navigation',
        sortOrder: 1,
        placement: 'start',
        content: { navigation: [action('/docs', 'Docs')] }
    },
    {
        widgetKey: 'marketing.navigation',
        instanceKey: 'secondary-navigation',
        sortOrder: 2,
        placement: 'start',
        content: { navigation: [action('/about', 'About')] }
    },
    {
        widgetKey: 'marketing.auth',
        instanceKey: 'auth',
        sortOrder: 3,
        placement: 'end',
        content: { signIn: action('/sign-in', 'Sign in'), signUp: action('/sign-up', 'Sign up') }
    },
    { widgetKey: 'languageSwitcher', instanceKey: 'language', sortOrder: 4, placement: 'end', content: null },
    { widgetKey: 'colorModeSwitcher', instanceKey: 'color-mode', sortOrder: 5, placement: 'end', content: null }
]

afterEach(() => {
    document.documentElement.style.removeProperty('--template-frame-height')
    document.documentElement.style.removeProperty('--marketing-header-occlusion')
    document.documentElement.style.removeProperty('scroll-padding-block-start')
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('marketing header shell', () => {
    it('owns one semantic banner and one Drawer for repeated navigation projections', () => {
        render(<MarketingHeaderShell widgets={headerWidgets} />)

        expect(screen.getAllByTestId('marketing-header-shell')).toHaveLength(1)
        expect(document.querySelectorAll('[role="banner"]')).toHaveLength(1)
        expect(document.querySelectorAll('.MuiAppBar-root')).toHaveLength(1)
        expect(document.querySelectorAll('[data-testid="marketing-header-drawer"]')).toHaveLength(1)
        expect(screen.getAllByTestId('marketing-header-navigation')).toHaveLength(2)
        expect(screen.getAllByRole('navigation', { hidden: true })).toHaveLength(4)
    })

    it('keeps flow mode in normal document flow without a spacer or scroll padding', () => {
        render(<MarketingHeaderShell widgets={headerWidgets} position='flow' />)

        expect(screen.getByTestId('marketing-header-shell')).toHaveClass('MuiAppBar-positionStatic')
        expect(screen.queryByTestId('marketing-header-spacer')).not.toBeInTheDocument()
        expect(document.documentElement.style.getPropertyValue('--marketing-header-occlusion')).toBe('')
        expect(document.documentElement.style.getPropertyValue('scroll-padding-block-start')).toBe('')
    })

    it('uses the original fixed visual offset without reserving document space', async () => {
        class NoopObserver {
            observe() {
                return undefined
            }

            disconnect() {
                return undefined
            }
        }

        vi.stubGlobal('ResizeObserver', NoopObserver)
        vi.stubGlobal('MutationObserver', NoopObserver)
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ height: 72 } as DOMRect))

        render(<MarketingHeaderShell widgets={headerWidgets} frameOffsetPx={12} />)

        expect(screen.getByTestId('marketing-header-shell')).toHaveAttribute('data-marketing-header-visual-offset', '28')
        expect(screen.getByTestId('marketing-header-shell')).toHaveAttribute('data-marketing-header-top-offset', '40')
        expect(screen.getByTestId('marketing-header-shell')).toHaveAttribute('data-marketing-header-occlusion', '112')
        expect(screen.queryByTestId('marketing-header-spacer')).not.toBeInTheDocument()
        expect(document.documentElement.style.getPropertyValue('--marketing-header-occlusion')).toBe('112px')
        expect(document.documentElement.style.getPropertyValue('scroll-padding-block-start')).toBe('112px')
    })

    it('projects persisted shared controls once and restores focus after closing the one Drawer', async () => {
        const user = userEvent.setup()
        render(<MarketingHeaderShell widgets={headerWidgets} />)

        expect(screen.getAllByTestId('shared-language-switcher')).toHaveLength(1)
        expect(screen.getAllByTestId('color-mode-switcher')).toHaveLength(1)

        const menuButton = screen.getByRole('button', { name: 'Open menu', hidden: true })
        await user.click(menuButton)
        const drawer = document.getElementById('marketing-header-drawer')
        expect(drawer).not.toBeNull()
        if (!drawer) return

        expect(within(drawer).getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs')
        expect(within(drawer).getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about')
        expect(within(drawer).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in')
        expect(drawer.querySelectorAll('a button, button a')).toHaveLength(0)

        await user.click(within(drawer).getByRole('button', { name: 'Close menu' }))
        expect(menuButton).toHaveFocus()
    })
})
