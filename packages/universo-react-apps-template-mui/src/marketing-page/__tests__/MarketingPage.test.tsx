import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AppMainLayout from '../../layouts/AppMainLayout'
import MarketingPage, { widgetAnchorId } from '../MarketingPage'
import { MarketingMediaView } from '../components/MarketingPrimitives'
import type { MarketingAction, MarketingPageData } from '../types'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, string>) => {
            const labels: Record<string, string> = {
                'marketingPage.actions.signIn': 'Sign in',
                'marketingPage.actions.signUp': 'Sign up',
                'marketingPage.navigation.openMenu': 'Open navigation menu',
                'marketingPage.navigation.closeMenu': 'Close navigation menu',
                'marketingPage.navigation.skipToContent': 'Skip to content',
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
            if (key === 'marketingPage.empty') return `No items in ${options?.section ?? 'section'}`
            return labels[key] ?? key
        },
        i18n: { language: 'en', resolvedLanguage: 'en' }
    })
}))

const uuid = '0190a9b5-3cde-7abc-8def-012345678900'

const action = (href: string, label: string): MarketingAction => ({
    semanticKey: label.toLowerCase().replace(/\s+/g, '-'),
    label,
    actionKind: href.startsWith('#') ? 'internal' : 'internal',
    href,
    target: '_self'
})

const config = {
    themeMode: 'light' as const,
    allowEmailActions: true,
    allowTelephoneActions: true,
    externalLinkTarget: 'new-tab' as const
}

const data: MarketingPageData = {
    templateKey: 'marketing-page',
    locale: 'en',
    config,
    runtime: { layoutId: uuid, layoutVersion: 1, layoutHash: 'a'.repeat(64) },
    widgets: [
        {
            instanceKey: 'navigation',
            widgetKey: 'marketing.navigation',
            zone: 'marketing-header',
            sortOrder: 0,
            isActive: true,
            content: {
                brand: { name: 'Acme' },
                navigation: [{ ...action('#features', 'Features'), order: 1, visible: true }],
                auth: { signIn: action('/sign-in', 'Sign in'), signUp: action('/sign-up', 'Sign up') }
            }
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
            content: {
                title: 'Our latest',
                accent: 'products',
                description: 'A typed marketing page.'
            }
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

describe('MarketingPage', () => {
    beforeEach(() => {
        window.localStorage.clear()
    })

    it('renders active payload widgets by canonical zone and persisted order', () => {
        render(
            <AppMainLayout>
                <MarketingPage data={data} />
            </AppMainLayout>
        )

        expect(screen.getByRole('heading', { name: 'Our latest products' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Product features' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Automation features' })).toBeInTheDocument()
        expect(screen.queryByText('Hidden?')).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#marketing-page-main')
        expect(screen.getByRole('contentinfo').closest('main')).toBeNull()
        expect(
            Array.from(document.querySelectorAll<HTMLElement>('[data-marketing-widget-instance]')).map(
                (node) => node.dataset.marketingWidgetInstance
            )
        ).toEqual(['navigation', 'hero', 'features-primary', 'features-secondary', 'logos-empty', 'footer'])
        const ids = Array.from(document.querySelectorAll<HTMLElement>('[id]')).map((node) => node.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(document.getElementById('features-features-secondary')).toBeInTheDocument()
    })

    it('renders repeated and empty collection instances without requiring section state', () => {
        render(
            <AppMainLayout>
                <MarketingPage data={data} />
            </AppMainLayout>
        )

        expect(screen.getAllByText('Automation').length).toBeGreaterThan(0)
        expect(screen.getByText('No items in Trusted companies')).toBeInTheDocument()
        expect(data).not.toHaveProperty('sectionOrder')
        expect(data).not.toHaveProperty('sectionVisibility')
        expect(data).not.toHaveProperty('records')
        expect(data).not.toHaveProperty('sectionCopies')
    })

    it('keeps widget fragment anchors unique for distinct semantic keys', () => {
        expect(widgetAnchorId('promo.one')).not.toBe(widgetAnchorId('promo-one'))
        expect(widgetAnchorId('promo.one')).toMatch(/^marketing-widget-/)
    })

    it('keeps navigation actions and mobile menu user-facing', () => {
        render(
            <AppMainLayout>
                <MarketingPage data={data} />
            </AppMainLayout>
        )

        fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu', hidden: true }))

        expect(screen.getByRole('button', { name: 'Close navigation menu' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Features' })).toHaveAttribute('href', '#features')
    })

    it('does not expose storage-backed media identifiers in the runtime UI', () => {
        render(
            <AppMainLayout>
                <MarketingMediaView
                    media={{
                        src: '',
                        resource: { type: 'file', storageKey: 'marketing/hero.webp' },
                        alt: 'Product preview'
                    }}
                />
            </AppMainLayout>
        )

        expect(screen.getByText('Media is configured but unavailable in this runtime.')).toBeInTheDocument()
        expect(screen.queryByText(/storageKey|marketing\/hero\.webp/)).not.toBeInTheDocument()
    })
})
