import { describe, expect, it } from 'vitest'

import type { ApplicationEffectiveLayoutResponse } from '../../../types'
import { toDashboardZoneWidgets } from '../runtimeLayout'

describe('runtime layout conversion', () => {
    it('groups dashboard placements by zone and preserves graph identity plus runtime data', () => {
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
                templateKey: 'dashboard',
                sourceKind: 'application',
                sourceLayoutId: null,
                compositionMode: 'independent',
                baseLayoutId: null,
                config: {}
            },
            widgets: [
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789a3',
                    layoutId,
                    zone: 'center',
                    semanticRegion: 'main',
                    widgetKey: 'detailsTable',
                    instanceKey: 'details-primary',
                    parentInstanceKey: 'content-grid',
                    slotKey: 'column:primary',
                    sortOrder: 2,
                    config: { showSearch: true },
                    isActive: true,
                    runtimeData: {
                        status: 'ready',
                        data: {
                            kind: 'table',
                            columns: [{ key: 'title', label: 'Title' }],
                            rows: [{ key: 'course-1', cells: [{ key: 'title', value: 'Course 1' }] }]
                        }
                    }
                },
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789a4',
                    layoutId,
                    zone: 'top',
                    semanticRegion: 'header',
                    widgetKey: 'header',
                    instanceKey: 'header',
                    parentInstanceKey: null,
                    slotKey: null,
                    sortOrder: 0,
                    config: { variant: 'compact' },
                    isActive: true
                },
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789a5',
                    layoutId,
                    zone: 'center',
                    semanticRegion: 'main',
                    widgetKey: 'detailsTable',
                    instanceKey: 'details-secondary',
                    parentInstanceKey: null,
                    slotKey: null,
                    sortOrder: 1,
                    config: {},
                    isActive: true
                },
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789a6',
                    layoutId,
                    zone: 'center',
                    semanticRegion: 'main',
                    widgetKey: 'detailsTable',
                    instanceKey: 'details-disabled',
                    parentInstanceKey: null,
                    slotKey: null,
                    sortOrder: 0,
                    config: {},
                    isActive: false
                },
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789a7',
                    layoutId,
                    zone: 'right',
                    semanticRegion: 'sidebar',
                    widgetKey: 'infoCard',
                    instanceKey: 'help-card',
                    parentInstanceKey: null,
                    slotKey: null,
                    sortOrder: 0,
                    config: {},
                    isActive: true
                }
            ],
            precedence: ['application-global'],
            publicationIdentity: null,
            effectiveHash: 'a'.repeat(64)
        } as ApplicationEffectiveLayoutResponse

        expect(toDashboardZoneWidgets(effectiveLayout)).toEqual({
            left: [],
            top: [
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789a4',
                    layoutId,
                    widgetKey: 'header',
                    sortOrder: 0,
                    config: { variant: 'compact' },
                    isActive: true,
                    instanceKey: 'header',
                    zone: 'top',
                    parentInstanceKey: null,
                    slotKey: null
                }
            ],
            right: [
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789a7',
                    layoutId,
                    widgetKey: 'infoCard',
                    sortOrder: 0,
                    config: {},
                    isActive: true,
                    instanceKey: 'help-card',
                    zone: 'right',
                    parentInstanceKey: null,
                    slotKey: null
                }
            ],
            bottom: [],
            center: [
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789a6',
                    layoutId,
                    widgetKey: 'detailsTable',
                    sortOrder: 0,
                    config: {},
                    isActive: false,
                    instanceKey: 'details-disabled',
                    zone: 'center',
                    parentInstanceKey: null,
                    slotKey: null
                },
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789a5',
                    layoutId,
                    widgetKey: 'detailsTable',
                    sortOrder: 1,
                    config: {},
                    isActive: true,
                    instanceKey: 'details-secondary',
                    zone: 'center',
                    parentInstanceKey: null,
                    slotKey: null
                },
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789a3',
                    layoutId,
                    widgetKey: 'detailsTable',
                    sortOrder: 2,
                    config: { showSearch: true },
                    isActive: true,
                    instanceKey: 'details-primary',
                    zone: 'center',
                    parentInstanceKey: 'content-grid',
                    slotKey: 'column:primary',
                    runtimeData: {
                        status: 'ready',
                        data: {
                            kind: 'table',
                            columns: [{ key: 'title', label: 'Title' }],
                            rows: [{ key: 'course-1', cells: [{ key: 'title', value: 'Course 1' }] }]
                        }
                    }
                }
            ]
        })

        expect(() =>
            toDashboardZoneWidgets({
                ...effectiveLayout,
                widgets: [{ ...effectiveLayout.widgets[0], zone: 'marketing-header' }]
            })
        ).toThrow('unsupported Dashboard zone')
    })

    it('does not adapt a marketing effective layout into dashboard zones', () => {
        const marketingLayout = {
            layout: {
                templateKey: 'marketing-page'
            },
            widgets: []
        } as unknown as ApplicationEffectiveLayoutResponse

        expect(toDashboardZoneWidgets(marketingLayout)).toBeUndefined()
        expect(toDashboardZoneWidgets(undefined)).toBeUndefined()
    })
})
