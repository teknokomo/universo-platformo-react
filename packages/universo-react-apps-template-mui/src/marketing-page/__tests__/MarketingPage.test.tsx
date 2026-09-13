import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'

import AppMainLayout from '../../layouts/AppMainLayout'
import MarketingPage, { widgetAnchorId } from '../MarketingPage'
import { MarketingMediaView } from '../components/MarketingPrimitives'
import type { MarketingAction, MarketingEffectiveLayoutWidgets, MarketingPageData } from '../types'

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        t: (key: string, options?: Record<string, string>) => {
            const labels: Record<string, string> = {
                'marketingPage.actions.signIn': 'Sign in',
                'marketingPage.actions.signUp': 'Sign up',
                'marketingPage.navigation.openMenu': 'Open navigation menu',
                'marketingPage.navigation.closeMenu': 'Close navigation menu',
                'marketingPage.colorMode.label': 'Color mode',
                'marketingPage.colorMode.system': 'System',
                'marketingPage.colorMode.light': 'Light',
                'marketingPage.colorMode.dark': 'Dark',
                'marketingPage.mediaMissing': 'Media unavailable',
                'marketingPage.mediaDeferred': 'Media is configured but unavailable in this runtime.',
                'marketingPage.form.invalidEmail': 'Enter a valid email address',
                'marketingPage.form.submitted': 'Thanks for subscribing!',
                'marketingPage.form.submitting': 'Submitting'
            }
            if (key === 'marketingPage.navigation.landmark') return `${options?.brand} navigation ${options?.index}`
            if (key === 'marketingPage.empty') return `No items in ${options?.section ?? 'section'}`
            return labels[key] ?? options?.defaultValue ?? key
        },
        i18n: { language: 'en', resolvedLanguage: 'en' }
    })
}))

const uuid = '0190a9b5-3cde-7abc-8def-012345678900'

const action = (href: string, label: string): MarketingAction => ({
    semanticKey: label.toLowerCase().replace(/\s+/g, '-'),
    label,
    actionKind: 'internal',
    href,
    target: '_self'
})

const config = {
    themeMode: 'light' as const,
    allowEmailActions: true,
    allowTelephoneActions: true,
    externalLinkTarget: 'new-tab' as const
}

const effectiveLayoutWidgets: MarketingEffectiveLayoutWidgets = [
    {
        id: 'brand',
        widgetKey: 'marketing.brand',
        zone: 'marketing-header',
        semanticRegion: 'header',
        instanceKey: 'brand',
        sortOrder: 0,
        isActive: true,
        config: {}
    },
    {
        id: 'navigation',
        widgetKey: 'marketing.navigation',
        zone: 'marketing-header',
        semanticRegion: 'header',
        instanceKey: 'navigation',
        sortOrder: 1,
        isActive: true,
        config: { __layout: { placement: 'start' } }
    },
    {
        id: 'auth',
        widgetKey: 'marketing.auth',
        zone: 'marketing-header',
        semanticRegion: 'header',
        instanceKey: 'auth',
        sortOrder: 2,
        isActive: true,
        config: { __layout: { placement: 'end' } }
    },
    {
        id: 'language',
        widgetKey: 'languageSwitcher',
        zone: 'marketing-header',
        semanticRegion: 'header',
        instanceKey: 'language',
        sortOrder: 3,
        isActive: true,
        config: { __layout: { placement: 'end' } }
    },
    {
        id: 'color-mode',
        widgetKey: 'colorModeSwitcher',
        zone: 'marketing-header',
        semanticRegion: 'header',
        instanceKey: 'color-mode',
        sortOrder: 4,
        isActive: true,
        config: { __layout: { placement: 'end' } }
    }
]

const data: MarketingPageData = {
    templateKey: 'marketing-page',
    locale: 'en',
    config,
    runtime: { layoutId: uuid, layoutVersion: 1, layoutHash: 'a'.repeat(64) },
    widgets: [
        {
            instanceKey: 'brand',
            widgetKey: 'marketing.brand',
            zone: 'marketing-header',
            sortOrder: 0,
            isActive: true,
            content: { name: 'Acme' }
        },
        {
            instanceKey: 'navigation',
            widgetKey: 'marketing.navigation',
            zone: 'marketing-header',
            sortOrder: 1,
            isActive: true,
            content: { navigation: [{ ...action('#features', 'Features'), order: 1, visible: true }] }
        },
        {
            instanceKey: 'auth',
            widgetKey: 'marketing.auth',
            zone: 'marketing-header',
            sortOrder: 2,
            isActive: true,
            content: { signIn: action('/sign-in', 'Sign in'), signUp: action('/sign-up', 'Sign up') }
        },
        {
            instanceKey: 'features-secondary',
            widgetKey: 'marketing.collection',
            zone: 'marketing-main',
            sortOrder: 2,
            isActive: true,
            content: {
                variant: 'features',
                section: { title: 'Automation features' },
                items: [
                    {
                        semanticKey: 'automation',
                        title: 'Automation',
                        description: 'Automate recurring work.',
                        icon: 'autoAwesome',
                        order: 1,
                        visible: true
                    }
                ]
            }
        },
        {
            instanceKey: 'faq-disabled',
            widgetKey: 'marketing.collection',
            zone: 'marketing-main',
            sortOrder: 9,
            isActive: false,
            content: {
                variant: 'faq',
                section: { title: 'Hidden questions' },
                items: [{ semanticKey: 'hidden', question: 'Hidden?', answer: 'Not rendered.', order: 1, visible: true }]
            }
        },
        {
            instanceKey: 'hero',
            widgetKey: 'marketing.hero',
            zone: 'marketing-main',
            sortOrder: 0,
            isActive: true,
            content: { title: 'Our latest', accent: 'products', description: 'A typed marketing page.' }
        },
        {
            instanceKey: 'features-primary',
            widgetKey: 'marketing.collection',
            zone: 'marketing-main',
            sortOrder: 1,
            isActive: true,
            content: {
                variant: 'features',
                section: { title: 'Product features', description: 'Feature description' },
                items: [
                    {
                        semanticKey: 'dashboard',
                        title: 'Dashboard',
                        description: 'A useful dashboard.',
                        icon: 'viewQuilt',
                        order: 1,
                        visible: true
                    }
                ]
            }
        },
        {
            instanceKey: 'logos-empty',
            widgetKey: 'marketing.collection',
            zone: 'marketing-main',
            sortOrder: 3,
            isActive: true,
            content: { variant: 'logos', section: { title: 'Trusted companies' }, items: [] }
        },
        {
            instanceKey: 'footer',
            widgetKey: 'marketing.footer',
            zone: 'marketing-footer',
            sortOrder: 0,
            isActive: true,
            content: { brandName: 'Acme', copyrightText: 'Copyright ©' }
        }
    ]
}

const renderPage = (position: 'fixed' | 'flow' = 'fixed') =>
    render(
        <AppMainLayout>
            <MarketingPage
                data={data}
                effectiveLayoutWidgets={effectiveLayoutWidgets}
                effectiveLayoutConfig={{ templateKey: 'marketing-page', zoneSettings: { 'marketing-header': { position } } }}
            />
        </AppMainLayout>
    )

describe('MarketingPage', () => {
    beforeEach(() => {
        window.localStorage.clear()
        document.documentElement.style.removeProperty('--marketing-header-occlusion')
        document.documentElement.style.removeProperty('scroll-padding-block-start')
    })

    it('renders active content payload widgets by canonical zone and persisted order', () => {
        renderPage()

        expect(screen.getByRole('heading', { name: 'Our latest products' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Product features' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Automation features' })).toBeInTheDocument()
        expect(screen.queryByText('Hidden?')).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'Skip to content' })).not.toBeInTheDocument()
        expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1')
        expect(screen.getByRole('contentinfo').closest('main')).toBeNull()
        expect(
            Array.from(document.querySelectorAll<HTMLElement>('[data-marketing-widget-instance]')).map(
                (node) => node.dataset.marketingWidgetInstance
            )
        ).toEqual(['hero', 'features-primary', 'features-secondary', 'logos-empty', 'footer'])
        expect(document.getElementById('marketing-widget-features-secondary')).toBeInTheDocument()
    })

    it('uses one zone-owned shell, one Drawer, and atomic persisted header projections', () => {
        renderPage()

        expect(screen.getAllByTestId('marketing-header-shell')).toHaveLength(1)
        expect(document.querySelectorAll('.MuiAppBar-root')).toHaveLength(1)
        expect(document.querySelectorAll('[data-testid="marketing-header-drawer"]')).toHaveLength(1)
        expect(screen.getAllByRole('button', { name: 'Language' })).toHaveLength(1)
        expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in')
    })

    it('renders no header shell when every projected capability is inactive at its authoritative source', () => {
        const inactiveHeaderData: MarketingPageData = {
            ...data,
            widgets: data.widgets.map((widget) =>
                widget.zone === 'marketing-header'
                    ? {
                          ...widget,
                          isActive: false
                      }
                    : widget
            ) as MarketingPageData['widgets']
        }
        const inactiveControls: MarketingEffectiveLayoutWidgets = effectiveLayoutWidgets.map((widget) =>
            widget.widgetKey === 'languageSwitcher' || widget.widgetKey === 'colorModeSwitcher' ? { ...widget, isActive: false } : widget
        )

        render(
            <AppMainLayout>
                <MarketingPage
                    data={inactiveHeaderData}
                    effectiveLayoutWidgets={inactiveControls}
                    effectiveLayoutConfig={{ templateKey: 'marketing-page' }}
                />
            </AppMainLayout>
        )

        expect(screen.queryByTestId('marketing-header-shell')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Language' })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument()
        expect(screen.getByRole('main')).toBeInTheDocument()
    })

    it('projects all navigation instances into one mobile Drawer and restores menu focus', async () => {
        const user = userEvent.setup()
        const duplicatedData: MarketingPageData = {
            ...data,
            widgets: [
                ...data.widgets,
                {
                    instanceKey: 'navigation-secondary',
                    widgetKey: 'marketing.navigation',
                    zone: 'marketing-header',
                    sortOrder: 5,
                    isActive: true,
                    content: { navigation: [{ ...action('/about', 'About') }] }
                }
            ]
        }
        const duplicatedLayout: MarketingEffectiveLayoutWidgets = [
            ...effectiveLayoutWidgets,
            {
                id: 'navigation-secondary',
                widgetKey: 'marketing.navigation',
                zone: 'marketing-header',
                semanticRegion: 'header',
                instanceKey: 'navigation-secondary',
                sortOrder: 5,
                isActive: true,
                config: { __layout: { placement: 'start' } }
            }
        ]

        render(
            <AppMainLayout>
                <MarketingPage
                    data={duplicatedData}
                    effectiveLayoutWidgets={duplicatedLayout}
                    effectiveLayoutConfig={{
                        templateKey: 'marketing-page',
                        zoneSettings: { 'marketing-header': { position: 'fixed' } }
                    }}
                />
            </AppMainLayout>
        )

        const menuButton = screen.getByRole('button', { name: 'Open navigation menu', hidden: true })
        await user.click(menuButton)
        const drawer = document.getElementById('marketing-header-drawer')
        expect(drawer).not.toBeNull()
        if (!drawer) return
        expect(within(drawer).getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about')
        expect(within(drawer).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in')
        await user.click(within(drawer).getByRole('button', { name: 'Close navigation menu' }))
        expect(menuButton).toHaveFocus()
    })

    it('keeps flow mode in normal flow without fixed spacer or scroll padding', () => {
        renderPage('flow')

        expect(screen.getByTestId('marketing-header-shell')).toHaveClass('MuiAppBar-positionStatic')
        expect(screen.queryByTestId('marketing-header-spacer')).not.toBeInTheDocument()
        expect(document.documentElement.style.getPropertyValue('--marketing-header-occlusion')).toBe('')
        expect(document.documentElement.style.getPropertyValue('scroll-padding-block-start')).toBe('')
    })

    it('keeps storage-backed media locators out of the runtime UI', () => {
        render(
            <AppMainLayout>
                <MarketingMediaView
                    media={{ src: '', resource: { type: 'file', storageKey: 'marketing/hero.webp' }, alt: 'Product preview' }}
                />
            </AppMainLayout>
        )

        expect(screen.getByText('Media is configured but unavailable in this runtime.')).toBeInTheDocument()
        expect(screen.queryByText(/storageKey|marketing\/hero\.webp/)).not.toBeInTheDocument()
    })

    it('keeps widget fragment anchors unique for distinct semantic keys', () => {
        expect(widgetAnchorId('promo.one')).not.toBe(widgetAnchorId('promo-one'))
        expect(widgetAnchorId('promo.one')).toMatch(/^marketing-widget-/)
    })
})
