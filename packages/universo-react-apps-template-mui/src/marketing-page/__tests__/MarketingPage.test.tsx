import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AppMainLayout from '../../layouts/AppMainLayout'
import MarketingPage from '../MarketingPage'
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

const action = (href: string, label: string): MarketingAction => ({
    semanticKey: label.toLowerCase().replace(/\s+/g, '-'),
    label,
    actionKind: 'internal',
    href,
    target: '_self'
})

const data: MarketingPageData = {
    templateKey: 'marketing-page',
    config: {
        themeMode: 'light',
        sectionOrder: ['hero', 'logos', 'features', 'testimonials', 'highlights', 'pricing', 'faq', 'footer']
    },
    brand: { name: 'Acme' },
    navigation: [{ ...action('#features', 'Features'), order: 1, visible: true }],
    auth: { signIn: action('/sign-in', 'Sign in'), signUp: action('/sign-up', 'Sign up') },
    hero: {
        title: 'Our latest',
        accent: 'products',
        description: 'A typed marketing page.',
        lead: {
            label: 'Email',
            placeholder: 'Your email address',
            submitLabel: 'Start now',
            action: action('/sign-up', 'Start now'),
            termsText: 'By continuing you agree to our',
            termsAction: action('/terms', 'Terms')
        }
    },
    sections: {
        logoCollection: { title: 'Trusted by the best companies' },
        features: { title: 'Product features', description: 'Features description' },
        testimonials: { title: 'Testimonials' },
        highlights: { title: 'Highlights' },
        pricing: { title: 'Pricing' },
        faq: { title: 'Frequently asked questions' }
    },
    logos: [],
    features: [
        {
            semanticKey: 'dashboard',
            title: 'Dashboard',
            description: 'A useful dashboard.',
            icon: 'viewQuilt',
            order: 1,
            visible: true
        }
    ],
    testimonials: [],
    highlights: [],
    pricing: [],
    faq: [
        {
            semanticKey: 'support',
            question: 'How do I contact support?',
            answer: 'Email support@email.com for help.',
            order: 1,
            visible: true
        },
        {
            semanticKey: 'returns',
            question: 'Can I return the product?',
            answer: 'Yes, within 30 days.',
            order: 2,
            visible: true
        }
    ],
    footer: {
        brandName: 'Acme',
        copyrightText: 'Copyright ©',
        groups: [],
        legalLinks: [action('/privacy', 'Privacy Policy'), action('/terms', 'Terms of Service')],
        copyrightAction: {
            semanticKey: 'copyright',
            label: 'Sitemark',
            actionKind: 'external',
            href: 'https://mui.com/',
            target: '_blank'
        },
        newsletter: {
            title: 'Join the newsletter',
            description: 'Weekly updates.',
            label: 'Email',
            placeholder: 'Your email address',
            submitLabel: 'Subscribe',
            successMessage: 'Thanks for subscribing!',
            errorMessage: 'Subscription failed.',
            action: action('/sign-up', 'Subscribe')
        }
    }
}

describe('MarketingPage', () => {
    beforeEach(() => {
        window.localStorage.clear()
    })

    it('renders data-driven sections in the configured order without dashboard state', () => {
        render(
            <AppMainLayout>
                <MarketingPage data={data} />
            </AppMainLayout>
        )

        expect(screen.getByRole('heading', { name: 'Our latest products' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Product features' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Frequently asked questions' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#marketing-page-main')
        expect(Array.from(document.querySelectorAll('main > section > [id]')).map((section) => section.id)).toEqual([
            'hero',
            'logoCollection',
            'features',
            'testimonials',
            'highlights',
            'pricing',
            'faq'
        ])
        expect(screen.queryByText('objectCollection')).not.toBeInTheDocument()
    })

    it('renders navigation actions instead of inert email fields without a submission endpoint', () => {
        render(
            <AppMainLayout>
                <MarketingPage data={data} />
            </AppMainLayout>
        )

        expect(screen.queryByRole('textbox', { name: 'Email' })).not.toBeInTheDocument()
        expect(document.querySelector('#email-hero')).not.toBeInTheDocument()
        expect(document.querySelector('#marketing-footer-email')).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Start now' })).toHaveAttribute('href', '/sign-up')
        expect(screen.getByRole('link', { name: 'Subscribe' })).toHaveAttribute('href', '/sign-up')
    })

    it('honors the configured footer position instead of forcing it after the page', () => {
        const footerFirst = {
            ...data,
            config: {
                ...data.config,
                sectionOrder: ['footer', 'hero', 'logos', 'features', 'testimonials', 'highlights', 'pricing', 'faq'] as const
            }
        }

        render(
            <AppMainLayout>
                <MarketingPage data={footerFirst} />
            </AppMainLayout>
        )

        const main = screen.getByRole('main')
        const footer = screen.getByRole('contentinfo')
        const hero = document.getElementById('hero')
        expect(main).toContainElement(footer)
        expect(hero).not.toBeNull()
        expect(footer.compareDocumentPosition(hero!) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    })

    it('opens the mobile navigation without violating the MUI menu-list contract', () => {
        render(
            <AppMainLayout>
                <MarketingPage data={data} />
            </AppMainLayout>
        )

        fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu', hidden: true }))

        expect(screen.getByRole('button', { name: 'Close navigation menu' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Features' })).toHaveAttribute('href', '#features')
    })

    it('closes the shared color-mode menu when focus moves outside it', () => {
        render(
            <AppMainLayout>
                <MarketingPage data={data} />
            </AppMainLayout>
        )

        const colorModeButton = screen.getAllByRole('button', { name: 'Color mode', hidden: true })[0]!
        fireEvent.click(colorModeButton)
        const menu = screen.getByRole('menu')
        expect(menu).toBeInTheDocument()
        const controlledMenuId = colorModeButton.getAttribute('aria-controls')
        expect(controlledMenuId).toBeTruthy()
        expect(document.getElementById(controlledMenuId!)).toBeInTheDocument()

        const backdrop = document.querySelector('.MuiBackdrop-root')
        expect(backdrop).not.toBeNull()
        fireEvent.click(backdrop!)

        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('handles localized email validation and invokes the host lead callback', async () => {
        const onLeadSubmit = vi.fn().mockResolvedValue(undefined)
        render(
            <AppMainLayout>
                <MarketingPage data={data} onLeadSubmit={onLeadSubmit} />
            </AppMainLayout>
        )

        const email = within(screen.getByRole('contentinfo')).getByRole('textbox')
        const form = email.closest('form')
        expect(form).not.toBeNull()
        await act(async () => {
            fireEvent.change(email, { target: { value: 'invalid' } })
            fireEvent.submit(form!)
        })
        expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
        expect(onLeadSubmit).not.toHaveBeenCalled()

        await act(async () => {
            fireEvent.change(email, { target: { value: 'person@example.test' } })
            fireEvent.submit(form!)
        })
        await vi.waitFor(() => expect(onLeadSubmit).toHaveBeenCalledWith('person@example.test', 'footer'))
    })

    it('hides lead controls when their configured actions are unavailable', () => {
        const onLeadSubmit = vi.fn()
        const withoutLeadActions: MarketingPageData = {
            ...data,
            hero: { ...data.hero, lead: data.hero.lead ? { ...data.hero.lead, action: undefined } : undefined },
            footer: {
                ...data.footer,
                newsletter: data.footer.newsletter ? { ...data.footer.newsletter, action: undefined } : undefined
            }
        }

        render(
            <AppMainLayout>
                <MarketingPage data={withoutLeadActions} onLeadSubmit={onLeadSubmit} />
            </AppMainLayout>
        )

        expect(document.querySelector('#email-hero')).not.toBeInTheDocument()
        expect(document.querySelector('#marketing-footer-email')).not.toBeInTheDocument()
        expect(onLeadSubmit).not.toHaveBeenCalled()
    })

    it('keeps multiple FAQ answers open and links email addresses safely', () => {
        render(
            <AppMainLayout>
                <MarketingPage data={data} />
            </AppMainLayout>
        )

        const supportQuestion = screen.getByRole('button', { name: 'How do I contact support?' })
        const returnsQuestion = screen.getByRole('button', { name: 'Can I return the product?' })
        fireEvent.click(supportQuestion)
        fireEvent.click(returnsQuestion)

        expect(screen.getByRole('link', { name: 'support@email.com' })).toHaveAttribute('href', 'mailto:support@email.com')
        expect(screen.getByText('Yes, within 30 days.')).toBeVisible()
    })

    it('keeps footer legal links beside dynamic copyright and preserves safe external branding', () => {
        render(
            <AppMainLayout>
                <MarketingPage data={data} />
            </AppMainLayout>
        )

        const footer = screen.getByRole('contentinfo')
        expect(within(footer).getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy')
        expect(within(footer).getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms')
        expect(within(footer).getByRole('link', { name: 'Sitemark' })).toHaveAttribute('href', 'https://mui.com/')
        expect(within(footer).getByRole('link', { name: 'Sitemark' })).toHaveAttribute('rel', 'noopener noreferrer')
        expect(footer.textContent).toContain('Copyright ©')
        expect(footer.textContent).toContain(String(new Date().getFullYear()))
    })

    it('falls back to the media-missing state after both theme sources fail', () => {
        render(
            <AppMainLayout>
                <MarketingMediaView
                    media={{
                        src: 'https://cdn.example.test/light.png',
                        darkSrc: 'https://cdn.example.test/dark.png',
                        alt: 'Product preview'
                    }}
                />
            </AppMainLayout>
        )

        const firstImage = screen.getByRole('img', { name: 'Product preview' })
        expect(firstImage).toHaveAttribute('src', 'https://cdn.example.test/light.png')
        fireEvent.error(firstImage)

        const fallbackImage = screen.getByRole('img', { name: 'Product preview' })
        expect(fallbackImage).toHaveAttribute('src', 'https://cdn.example.test/dark.png')
        fireEvent.error(fallbackImage)

        expect(screen.getByText('Media unavailable')).toBeInTheDocument()
    })

    it('keeps a storage-backed media descriptor user-safe when no runtime URL is available', () => {
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
