import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Pricing from '../components/Pricing'
import type { MarketingPricingTier } from '../types'

const section = { title: 'Investment stages', showTitle: true }

const tiers: MarketingPricingTier[] = [
    {
        semanticKey: 'pre-seed',
        title: 'Pre-seed',
        price: '1',
        period: 'stage',
        description: 'Financing: RUB 30–90 million',
        benefits: ['MVP'],
        featured: false
    },
    {
        semanticKey: 'seed',
        title: 'Seed',
        price: '2',
        period: 'stage',
        description: 'Financing: RUB 150–500 million',
        benefits: ['Pilots'],
        featured: true
    },
    {
        semanticKey: 'growth',
        title: 'Growth',
        price: '3',
        period: 'stage',
        description: 'Financing to be confirmed',
        benefits: ['SPVs'],
        featured: false
    }
]

const backgroundImageOf = (element: HTMLElement): string => window.getComputedStyle(element).backgroundImage
const cardForTier = (title: string): HTMLElement => {
    const card = screen.getByRole('heading', { name: title }).closest('[data-testid="marketing-pricing-card"]')
    if (!card) throw new Error(`Pricing card for "${title}" was not rendered`)
    return card
}

describe('Pricing', () => {
    it('highlights the featured tier in the default card style', () => {
        render(<Pricing section={section} tiers={tiers} />)

        const featuredCard = cardForTier('Seed')
        const regularCard = cardForTier('Pre-seed')

        expect(backgroundImageOf(featuredCard)).toContain('radial-gradient')
        expect(backgroundImageOf(regularCard)).not.toContain('radial-gradient')
    })

    it('renders equal cards without the highlight in uniform mode', () => {
        render(<Pricing section={section} tiers={tiers} cardStyle='uniform' />)

        for (const title of ['Pre-seed', 'Seed', 'Growth']) {
            expect(backgroundImageOf(cardForTier(title))).not.toContain('radial-gradient')
        }
        expect(screen.queryByText('Recommended')).not.toBeInTheDocument()
    })

    it('renders the financing description together with the price', () => {
        render(<Pricing section={section} tiers={tiers} cardStyle='uniform' />)

        expect(screen.getByText('Financing: RUB 30–90 million')).toBeVisible()
        expect(screen.getByText('Financing to be confirmed')).toBeVisible()
    })

    it('widens the section container when the full card width is requested', () => {
        const { container: standard } = render(<Pricing section={section} tiers={tiers} />)
        expect(standard.querySelector('.MuiContainer-root')).toHaveClass('MuiContainer-maxWidthLg')

        const { container: full } = render(<Pricing section={section} tiers={tiers} cardWidth='full' />)
        expect(full.querySelector('.MuiContainer-root')).toHaveClass('MuiContainer-maxWidthXl')
    })

    it('hides the benefit lists when benefits are disabled', () => {
        render(<Pricing section={section} tiers={tiers} showBenefits={false} />)

        expect(screen.queryByText('MVP')).not.toBeInTheDocument()
        expect(screen.queryByText('Pilots')).not.toBeInTheDocument()
    })
})
