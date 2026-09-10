import { describe, expect, it } from 'vitest'

import type { ApplicationEffectiveLayoutResponse } from '../../../types'
import { toMarketingLayoutWidgets } from '../runtimeLayout'

describe('runtime layout conversion', () => {
    it('preserves instance keys for repeated marketing widget identities', () => {
        const layoutId = '0190a9b5-3cde-7abc-8def-0123456789a1'
        const effectiveLayout = {
            status: 'ok',
            target: {
                applicationId: '0190a9b5-3cde-7abc-8def-0123456789a2',
                targetKind: null,
                locale: 'en'
            },
            scope: 'global',
            layout: {
                id: layoutId,
                templateKey: 'marketing-page',
                sourceKind: 'application',
                sourceLayoutId: null,
                compositionMode: 'independent',
                baseLayoutId: null
            },
            widgets: [
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789a3',
                    layoutId,
                    zone: 'marketing-main',
                    semanticRegion: 'main',
                    widgetKey: 'marketing.collection',
                    instanceKey: 'collection-primary',
                    sortOrder: 0,
                    config: {},
                    isActive: true
                },
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789a4',
                    layoutId,
                    zone: 'marketing-main',
                    semanticRegion: 'main',
                    widgetKey: 'marketing.collection',
                    instanceKey: 'collection-secondary',
                    sortOrder: 1,
                    config: {},
                    isActive: true
                },
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789a5',
                    layoutId,
                    zone: 'marketing-main',
                    semanticRegion: 'main',
                    widgetKey: 'marketing.collection',
                    instanceKey: 'collection-disabled',
                    sortOrder: 2,
                    config: {},
                    isActive: false
                }
            ],
            precedence: ['application-global'],
            publicationIdentity: null,
            effectiveHash: 'a'.repeat(64)
        } as ApplicationEffectiveLayoutResponse

        expect(toMarketingLayoutWidgets(effectiveLayout)).toEqual([
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789a3',
                widgetKey: 'marketing.collection',
                zone: 'marketing-main',
                instanceKey: 'collection-primary',
                sortOrder: 0,
                isActive: true
            },
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789a4',
                widgetKey: 'marketing.collection',
                zone: 'marketing-main',
                instanceKey: 'collection-secondary',
                sortOrder: 1,
                isActive: true
            }
        ])

        expect(() =>
            toMarketingLayoutWidgets({
                ...effectiveLayout,
                widgets: [{ ...effectiveLayout.widgets[0], zone: 'top' }]
            })
        ).toThrow('unsupported Marketing zone')
    })
})
