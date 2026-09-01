import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'
import { Fragment, type ReactNode } from 'react'

import AppAppBar from './components/AppAppBar'
import FAQ from './components/FAQ'
import Features from './components/Features'
import Footer from './components/Footer'
import Hero from './components/Hero'
import Highlights from './components/Highlights'
import LogoCollection from './components/LogoCollection'
import Pricing from './components/Pricing'
import Testimonials from './components/Testimonials'
import type { MarketingPageProps } from './types'
import { useTranslation } from 'react-i18next'

/**
 * Presentational marketing template. The application shell owns the theme and
 * baseline providers; this component only renders the validated view model.
 */
export default function MarketingPage({ data, onAction, onLeadSubmit }: MarketingPageProps) {
    const { t } = useTranslation('apps')
    const visibility = data.config?.sectionVisibility
    const isVisible = (key: string) => visibility?.[key as keyof typeof visibility] !== false
    const auth = {
        signIn: data.auth?.signIn ? { ...data.auth.signIn, label: t('marketingPage.actions.signIn') } : undefined,
        signUp: data.auth?.signUp ? { ...data.auth.signUp, label: t('marketingPage.actions.signUp') } : undefined
    }
    const sectionNodes: Record<string, ReactNode> = {
        hero: isVisible('hero') ? <Hero data={data.hero} onAction={onAction} onLeadSubmit={onLeadSubmit} /> : null,
        logos: isVisible('logos') ? <LogoCollection section={data.sections.logoCollection} items={data.logos} onAction={onAction} /> : null,
        features: isVisible('features') ? <Features section={data.sections.features} items={data.features} /> : null,
        testimonials: isVisible('testimonials') ? <Testimonials section={data.sections.testimonials} items={data.testimonials} /> : null,
        highlights: isVisible('highlights') ? <Highlights section={data.sections.highlights} items={data.highlights} /> : null,
        pricing: isVisible('pricing') ? <Pricing section={data.sections.pricing} tiers={data.pricing} onAction={onAction} /> : null,
        faq: isVisible('faq') ? <FAQ section={data.sections.faq} items={data.faq} /> : null,
        footer: isVisible('footer') ? <Footer data={data.footer} onAction={onAction} onLeadSubmit={onLeadSubmit} /> : null
    }
    const sectionOrder = (
        data.config?.sectionOrder ?? ['hero', 'logos', 'features', 'testimonials', 'highlights', 'pricing', 'faq', 'footer']
    ).filter((key) => sectionNodes[key])
    const sectionHeadingIds: Record<string, string> = {
        hero: 'hero-title',
        logos: 'logoCollection-title',
        features: 'features-title',
        testimonials: 'testimonials-title',
        highlights: 'highlights-title',
        pricing: 'pricing-title',
        faq: 'faq-title'
    }

    return (
        <>
            <Box
                component='a'
                href='#marketing-page-main'
                sx={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    zIndex: (theme) => theme.zIndex.modal + 1,
                    px: 2,
                    py: 1,
                    color: 'text.primary',
                    bgcolor: 'background.paper',
                    boxShadow: 2,
                    transform: 'translateY(-150%)',
                    transition: 'transform 120ms ease-in-out',
                    '&:focus': { transform: 'translateY(0)' }
                }}
            >
                {t('marketingPage.navigation.skipToContent')}
            </Box>
            <AppAppBar brand={data.brand} navigation={data.navigation} auth={auth} onAction={onAction} />
            <main id='marketing-page-main'>
                {sectionOrder.map((key, index) =>
                    key === 'footer' ? (
                        <Fragment key={key}>
                            {index > 0 ? <Divider /> : null}
                            {sectionNodes[key]}
                        </Fragment>
                    ) : (
                        <Box component='section' key={key} aria-labelledby={sectionHeadingIds[key]}>
                            {index > 0 ? <Divider /> : null}
                            {sectionNodes[key]}
                        </Box>
                    )
                )}
            </main>
        </>
    )
}

export type { MarketingPageProps } from './types'
