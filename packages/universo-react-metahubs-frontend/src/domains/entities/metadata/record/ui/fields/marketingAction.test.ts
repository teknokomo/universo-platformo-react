import { describe, expect, it } from 'vitest'

import { formatMarketingActionSummary, type MarketingActionSummaryLabels } from './marketingAction'

const labels: MarketingActionSummaryLabels = {
    unavailable: 'Action destination unavailable',
    actionKinds: {
        internal: 'Application page',
        external: 'Website',
        anchor: 'Page section',
        email: 'Email',
        tel: 'Phone'
    },
    internalRoutes: { '/auth': 'Sign in or create an account' },
    withTarget: (kind, target) => `${kind} — ${target}`
}

describe('formatMarketingActionSummary', () => {
    it.each([
        [{ kind: 'internal', path: '/auth' }, 'Application page — Sign in or create an account'],
        [{ kind: 'external', url: 'https://example.test/contact' }, 'Website — https://example.test/contact'],
        [{ kind: 'anchor', href: '#pricing' }, 'Page section — #pricing'],
        [{ kind: 'email', address: 'team@example.test' }, 'Email — team@example.test'],
        [{ kind: 'tel', number: '+1 555 123 4567' }, 'Phone — +1 555 123 4567']
    ])('formats %j as localized-friendly text', (action, expected) => {
        expect(formatMarketingActionSummary(action, labels)).toBe(expected)
        expect(formatMarketingActionSummary(action, labels)).not.toContain('"kind"')
    })

    it('uses a localized unavailable label for malformed persisted values', () => {
        expect(formatMarketingActionSummary({ kind: 'external', url: 'javascript:alert(1)' }, labels)).toBe(
            'Action destination unavailable'
        )
    })
})
