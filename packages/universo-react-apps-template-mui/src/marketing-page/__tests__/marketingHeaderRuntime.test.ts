import { describe, expect, it } from 'vitest'

import {
    calculateMarketingHeaderGeometry,
    MARKETING_HEADER_VISUAL_OFFSET_PX,
    readMarketingHeaderPosition,
    readMarketingHeaderProjections
} from '../marketingHeaderRuntime'

const dataWidgets = [
    {
        instanceKey: 'brand-source',
        zone: 'marketing-header',
        sortOrder: 0,
        isActive: true,
        widgetKey: 'marketing.brand',
        content: { name: 'Acme' }
    },
    {
        instanceKey: 'navigation-source',
        zone: 'marketing-header',
        sortOrder: 1,
        isActive: true,
        widgetKey: 'marketing.navigation',
        content: { navigation: [] }
    }
] as const

describe('readMarketingHeaderProjections', () => {
    it('fails closed when a persisted content instance cannot be resolved exactly', () => {
        const projections = readMarketingHeaderProjections(dataWidgets, [
            { widgetKey: 'marketing.brand', instanceKey: 'missing-brand', zone: 'marketing-header', sortOrder: 0, isActive: true }
        ])

        expect(projections).toEqual([])
    })

    it('keeps repeatable navigation instances and de-duplicates singleton capabilities by widget key', () => {
        const projections = readMarketingHeaderProjections(dataWidgets, [
            { widgetKey: 'marketing.navigation', instanceKey: 'navigation-source', zone: 'marketing-header', sortOrder: 0, isActive: true },
            { widgetKey: 'marketing.navigation', instanceKey: 'navigation-source', zone: 'marketing-header', sortOrder: 1, isActive: true },
            { widgetKey: 'languageSwitcher', instanceKey: 'language-one', zone: 'marketing-header', sortOrder: 2, isActive: true },
            { widgetKey: 'languageSwitcher', instanceKey: 'language-two', zone: 'marketing-header', sortOrder: 3, isActive: true }
        ])

        expect(projections.filter((projection) => projection.widgetKey === 'marketing.navigation')).toHaveLength(2)
        expect(projections.filter((projection) => projection.widgetKey === 'languageSwitcher')).toHaveLength(1)
    })

    it('does not project an inactive content widget even when its persisted layout row is active', () => {
        const projections = readMarketingHeaderProjections(
            [
                ...dataWidgets,
                {
                    instanceKey: 'inactive-brand-source',
                    zone: 'marketing-header',
                    sortOrder: 2,
                    isActive: false,
                    widgetKey: 'marketing.brand',
                    content: { name: 'Hidden brand' }
                },
                {
                    instanceKey: 'inactive-auth-source',
                    zone: 'marketing-header',
                    sortOrder: 3,
                    isActive: false,
                    widgetKey: 'marketing.auth',
                    content: { label: 'Sign in', href: '/sign-in' }
                },
                {
                    instanceKey: 'inactive-navigation-source',
                    zone: 'marketing-header',
                    sortOrder: 4,
                    isActive: false,
                    widgetKey: 'marketing.navigation',
                    content: { navigation: [] }
                }
            ] as const,
            [
                {
                    widgetKey: 'marketing.brand',
                    instanceKey: 'inactive-brand-source',
                    zone: 'marketing-header',
                    sortOrder: 0,
                    isActive: true
                },
                {
                    widgetKey: 'marketing.auth',
                    instanceKey: 'inactive-auth-source',
                    zone: 'marketing-header',
                    sortOrder: 1,
                    isActive: true
                },
                {
                    widgetKey: 'marketing.navigation',
                    instanceKey: 'inactive-navigation-source',
                    zone: 'marketing-header',
                    sortOrder: 2,
                    isActive: true
                }
            ]
        )

        expect(projections).toEqual([])
    })

    it('does not project inactive persisted language or color-mode controls', () => {
        const projections = readMarketingHeaderProjections(dataWidgets, [
            {
                widgetKey: 'languageSwitcher',
                instanceKey: 'language-source',
                zone: 'marketing-header',
                sortOrder: 0,
                isActive: false
            },
            {
                widgetKey: 'colorModeSwitcher',
                instanceKey: 'color-mode-source',
                zone: 'marketing-header',
                sortOrder: 1,
                isActive: false
            }
        ])

        expect(projections).toEqual([])
    })
})

describe('calculateMarketingHeaderGeometry', () => {
    it('retains the original 28px visual offset in the fixed-header occlusion contract', () => {
        expect(calculateMarketingHeaderGeometry(72, 12)).toEqual({
            headerHeightPx: 72,
            frameOffsetPx: 12,
            visualOffsetPx: MARKETING_HEADER_VISUAL_OFFSET_PX,
            topOffsetPx: 40,
            occlusionPx: 112
        })
    })
})

describe('readMarketingHeaderPosition', () => {
    it('fails closed when persisted metadata contains an unsupported value', () => {
        expect(() =>
            readMarketingHeaderPosition({
                templateKey: 'marketing-page',
                zoneSettings: { 'marketing-header': { position: 'unsupported' } }
            } as never)
        ).toThrow('Marketing header position is invalid')
    })

    it('uses the registered default when the canonical setting is absent', () => {
        expect(readMarketingHeaderPosition({ templateKey: 'marketing-page' })).toBe('fixed')
    })

    it('fails closed for another template instead of silently applying marketing defaults', () => {
        expect(() => readMarketingHeaderPosition({ templateKey: 'dashboard' } as never)).toThrow('Unsupported marketing layout template')
    })

    it('ignores renderer and legacy root metadata outside the canonical effective layout contract', () => {
        expect(
            readMarketingHeaderPosition({
                templateKey: 'marketing-page',
                __layout: { zoneSettings: { 'marketing-header': { position: 'flow' } } }
            } as never)
        ).toBe('fixed')
    })
})
