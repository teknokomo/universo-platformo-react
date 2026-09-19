import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
                config: { showItemDescriptions: true, fixedItemsHeight: false },
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
                config: { showItemDescriptions: true, fixedItemsHeight: false },
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

const renderPage = (input: 'fixed' | 'flow' | { position?: 'fixed' | 'flow'; data?: MarketingPageData } = 'fixed') => {
    const options = typeof input === 'string' ? { position: input } : input
    return render(
        <AppMainLayout>
            <MarketingPage
                data={options.data ?? data}
                effectiveLayoutWidgets={effectiveLayoutWidgets}
                effectiveLayoutConfig={{
                    templateKey: 'marketing-page',
                    zoneSettings: { 'marketing-header': { position: options.position ?? 'fixed' } }
                }}
            />
        </AppMainLayout>
    )
}

const brandLogoMedia = {
    resource: { type: 'url' as const, url: 'https://example.test/brand.png', launchMode: 'inline' as const },
    src: 'https://example.test/brand.png',
    alt: '',
    decorative: true
}

const dataWithHeaderAndFooterLogos: MarketingPageData = {
    ...data,
    widgets: data.widgets.map((widget) =>
        widget.widgetKey === 'marketing.brand'
            ? { ...widget, content: { name: 'Acme', logo: brandLogoMedia } }
            : widget.widgetKey === 'marketing.footer'
            ? { ...widget, content: { ...widget.content, logo: brandLogoMedia } }
            : widget
    )
}

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

    it('renders a configured brand name as visible text instead of the demo wordmark', () => {
        renderPage()

        // The brand name is the accessible and visible identity when no logo
        // asset is configured; the template wordmark must not replace it.
        const header = screen.getByTestId('marketing-header-shell')
        expect(within(header).getByText('Acme')).toBeVisible()
        expect(within(header).queryByTestId('marketing-brand-wordmark')).not.toBeInTheDocument()
    })

    it('renders a configured brand logo media instead of the brand name text', () => {
        const branded: MarketingPageData = {
            ...data,
            widgets: data.widgets.map((widget) =>
                widget.widgetKey === 'marketing.brand'
                    ? {
                          ...widget,
                          content: {
                              name: 'Acme',
                              logo: {
                                  resource: { type: 'url', url: 'https://example.test/brand.png', launchMode: 'inline' },
                                  src: 'https://example.test/brand.png',
                                  alt: '',
                                  decorative: true
                              }
                          }
                      }
                    : widget
            )
        }

        renderPage({ data: branded })

        const header = screen.getByTestId('marketing-header-shell')
        expect(header.querySelector('img')).toHaveAttribute('src', 'https://example.test/brand.png')
        expect(within(header).queryByText('Acme')).not.toBeInTheDocument()
        expect(within(header).queryByTestId('marketing-brand-wordmark')).not.toBeInTheDocument()
    })

    it('falls back to the configured brand name when the header logo image fails to load', async () => {
        renderPage({ data: dataWithHeaderAndFooterLogos })

        const header = screen.getByTestId('marketing-header-shell')
        const logo = header.querySelector('img')
        expect(logo).not.toBeNull()
        fireEvent.error(logo!)

        await waitFor(() => expect(within(header).getByText('Acme')).toBeVisible())
        expect(header.querySelector('img')).not.toBeInTheDocument()
        expect(within(header).getByRole('img', { name: 'Acme' })).toBeInTheDocument()
    })

    it('renders the configured footer logo with the brand name as its accessible name', () => {
        renderPage({ data: dataWithHeaderAndFooterLogos })

        const footer = screen.getByRole('contentinfo')
        const logo = footer.querySelector('img')
        expect(logo).toHaveAttribute('src', 'https://example.test/brand.png')
        expect(logo).toHaveAttribute('alt', '')
        expect(logo).toHaveAttribute('aria-hidden', 'true')
        expect(within(footer).getByRole('img', { name: 'Acme' })).toBeInTheDocument()
    })

    it('falls back to the configured brand name when the footer logo image fails to load', async () => {
        renderPage({ data: dataWithHeaderAndFooterLogos })

        const footer = screen.getByRole('contentinfo')
        const logo = footer.querySelector('img')
        expect(logo).not.toBeNull()
        fireEvent.error(logo!)

        await waitFor(() => expect(within(footer).getByText('Acme')).toBeVisible())
        expect(footer.querySelector('img')).not.toBeInTheDocument()
        expect(within(footer).getByRole('img', { name: 'Acme' })).toBeInTheDocument()
    })

    it('resolves semantic navigation anchors to the rendered section ids and drops unknown anchors', () => {
        const anchorData: MarketingPageData = {
            ...data,
            widgets: [
                ...data.widgets.map((widget) =>
                    widget.widgetKey === 'marketing.navigation'
                        ? {
                              ...widget,
                              content: {
                                  navigation: [
                                      { ...action('#logos', 'Partners'), order: 1, visible: true },
                                      { ...action('#features', 'Features'), order: 2, visible: true },
                                      { ...action('#highlights', 'Why us'), order: 3, visible: true },
                                      {
                                          ...action('#highlights-development-stage-pre-seed', 'Investment'),
                                          order: 4,
                                          visible: true
                                      },
                                      { ...action('#unknown-section', 'Unknown'), order: 5, visible: true }
                                  ]
                              }
                          }
                        : widget
                ),
                {
                    instanceKey: 'highlights',
                    widgetKey: 'marketing.collection',
                    zone: 'marketing-main',
                    sortOrder: 4,
                    isActive: true,
                    content: {
                        variant: 'highlights',
                        section: { title: 'Why 73rd Meridian' },
                        items: [
                            {
                                semanticKey: 'corridor',
                                title: 'Corridor',
                                description: 'Eurasian corridor.',
                                icon: 'autoAwesome',
                                order: 1,
                                visible: true
                            }
                        ]
                    }
                },
                {
                    instanceKey: 'development-stage-pre-seed',
                    widgetKey: 'marketing.collection',
                    zone: 'marketing-main',
                    sortOrder: 5,
                    isActive: true,
                    content: {
                        variant: 'highlights',
                        section: { title: 'Pre-seed' },
                        items: [
                            {
                                semanticKey: 'pre-seed',
                                title: 'Pre-seed',
                                description: '30–90m RUB.',
                                icon: 'autoAwesome',
                                order: 1,
                                visible: true
                            }
                        ]
                    }
                }
            ] as MarketingPageData['widgets']
        }

        render(
            <AppMainLayout>
                <MarketingPage
                    data={anchorData}
                    effectiveLayoutWidgets={effectiveLayoutWidgets}
                    effectiveLayoutConfig={{ templateKey: 'marketing-page' }}
                />
            </AppMainLayout>
        )

        // The persisted `logos` semantic key maps to the rendered collection id.
        expect(screen.getByRole('link', { name: 'Partners' })).toHaveAttribute('href', '#logoCollection-logos-empty')
        expect(document.getElementById('logoCollection-logos-empty')).toBeInTheDocument()
        // Canonical-name anchors keep resolving to instance-derived section ids.
        expect(screen.getByRole('link', { name: 'Features' })).toHaveAttribute('href', '#features-features-primary')
        expect(document.getElementById('features-features-primary')).toBeInTheDocument()
        // Repeated widget instances stay addressable through their emitted
        // section ids (for example a repeated highlights instance anchor).
        expect(screen.getByRole('link', { name: 'Why us' })).toHaveAttribute('href', '#highlights')
        expect(document.getElementById('highlights')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Investment' })).toHaveAttribute('href', '#highlights-development-stage-pre-seed')
        expect(document.getElementById('highlights-development-stage-pre-seed')).toBeInTheDocument()
        // Unknown anchors stay fail-closed.
        expect(screen.queryByRole('link', { name: 'Unknown' })).not.toBeInTheDocument()
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
