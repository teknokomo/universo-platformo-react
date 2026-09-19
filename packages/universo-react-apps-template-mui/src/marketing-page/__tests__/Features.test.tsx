import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Features from '../components/Features'
import type { MarketingFeature } from '../types'

const section = { title: 'Areas of activity', showTitle: true }

const items: MarketingFeature[] = [
    {
        semanticKey: 'territorial-digital-twins',
        title: 'Digital twins of territories',
        description: 'Interactive models of infrastructure assets and territories.'
    },
    {
        semanticKey: 'investment-packaging',
        title: 'Investment packaging',
        description: 'Structured investment products.',
        media: {
            src: 'https://example.com/feature.png',
            alt: 'Investment packaging preview'
        }
    }
]

describe('Features', () => {
    it('renders an icon-only placeholder when a feature has no authored media', () => {
        const iconItems: MarketingFeature[] = [{ ...items[0], icon: 'autoAwesome' }]
        render(<Features section={section} items={iconItems} />)

        expect(screen.getAllByTestId('marketing-feature-placeholder-icon').length).toBeGreaterThan(0)
        expect(screen.queryByTestId('marketing-feature-demo-image')).not.toBeInTheDocument()
    })

    it('prefers authored media over the placeholder', () => {
        render(<Features section={section} items={[items[1]]} />)

        expect(screen.getAllByAltText('Investment packaging preview').length).toBeGreaterThan(0)
        expect(screen.queryByTestId('marketing-feature-placeholder-icon')).not.toBeInTheDocument()
    })

    it('hides item descriptions when the titles-only mode is enabled', () => {
        render(<Features section={section} items={[items[0]]} settings={{ showItemDescriptions: false, fixedItemsHeight: false }} />)

        expect(screen.queryByText('Interactive models of infrastructure assets and territories.')).not.toBeInTheDocument()
        expect(screen.getAllByText('Digital twins of territories').length).toBeGreaterThan(0)
    })

    it('constrains the item list to a scrollable fixed-height area when requested', () => {
        render(<Features section={section} items={items} settings={{ showItemDescriptions: true, fixedItemsHeight: true }} />)

        const list = screen.getByTestId('marketing-features-items')
        expect(list).toHaveStyle({ maxHeight: '500px', overflowY: 'auto' })
        // Cards must keep their content height inside the scrollable column:
        // flex-shrinking them would overflow text over the next card.
        expect(screen.getAllByTestId('marketing-feature-card')[0]).toHaveStyle({ flexShrink: '0' })
    })

    it('keeps the item list unconstrained by default', () => {
        render(<Features section={section} items={items} />)

        const list = screen.getByTestId('marketing-features-items')
        expect(list).not.toHaveStyle({ overflowY: 'auto' })
    })
})
