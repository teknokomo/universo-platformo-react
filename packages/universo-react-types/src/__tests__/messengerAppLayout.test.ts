import { describe, expect, it } from 'vitest'

import { APPLICATION_TEMPLATE_REGISTRY } from '../common/applicationTemplates'
import { parseApplicationLayoutConfig } from '../common/applicationLayouts'
import { applicationTemplateKeySchema } from '../common/marketingPagePrimitives'
import {
    DEFAULT_MESSENGER_APP_ZONE_WIDGETS,
    messengerAppConfigSchema,
    MESSENGER_APP_LAYOUT_ZONES,
    MESSENGER_APP_LAYOUT_ZONE_SEMANTICS
} from '../common/messengerAppPrimitives'
import {
    LAYOUT_WIDGET_DEFINITIONS,
    LAYOUT_ZONE_DEFINITIONS,
    getLayoutWidgetAllowedZones,
    layoutWidgetMetadataResponseSchema
} from '../common/layoutWidgetDefinitions'
import {
    publicApplicationRuntimeSchema,
    publicMessengerAppRuntimeSchema,
    publicMessengerPlacementSchema
} from '../common/publicApplicationRuntime'
import { MAX_PUBLIC_MESSENGER_CHART_POINTS } from '../common/publicMessengerRuntime'

const FR006_MUST_WIDGETS = [
    'overviewCards',
    'detailsTable',
    'detailsTitle',
    'detailsTabs',
    'resourcePreview',
    'relationBuilder',
    'columnsContainer',
    'sessionsChart',
    'pageViewsChart'
] as const

const FR006_MUST_WIDGET_KEYS = [...FR006_MUST_WIDGETS]
const FR008_MUST_WIDGETS = ['menuWidget'] as const
const FR006_MESSENGER_PUBLIC_WIDGET_KEYS = [...FR006_MUST_WIDGET_KEYS, ...FR008_MUST_WIDGETS, 'header'] as const

const emptyRuntimeData = { status: 'empty' } as const

describe('Messenger App default composition', () => {
    it('seeds the localized header and an unbound generated navigation list inside Overview', () => {
        expect(DEFAULT_MESSENGER_APP_ZONE_WIDGETS).toEqual([
            {
                zone: 'top',
                widgetKey: 'header',
                instanceKey: 'messenger-header',
                parentInstanceKey: null,
                slotKey: null,
                sortOrder: 1
            },
            {
                zone: 'center',
                widgetKey: 'detailsTabs',
                instanceKey: 'messenger-overview-tabs',
                parentInstanceKey: null,
                slotKey: null,
                sortOrder: 1,
                config: { tabs: [{ slotKey: 'tab:overview', label: { en: 'Overview', ru: 'Обзор' }, isDefault: true }] }
            },
            {
                zone: 'center',
                widgetKey: 'menuWidget',
                instanceKey: 'messenger-overview-navigation',
                parentInstanceKey: 'messenger-overview-tabs',
                slotKey: 'tab:overview',
                sortOrder: 1,
                config: { variant: 'generated' }
            }
        ])
        expect(DEFAULT_MESSENGER_APP_ZONE_WIDGETS[2]).not.toHaveProperty('bindings')
    })
})

const messengerPlacements = [
    {
        instanceKey: 'messenger-header',
        zone: 'top',
        sortOrder: 0,
        parentInstanceKey: null,
        slotKey: null,
        widgetKey: 'header',
        config: {}
    },
    {
        instanceKey: 'messenger-overview',
        zone: 'center',
        sortOrder: 1,
        parentInstanceKey: null,
        slotKey: null,
        widgetKey: 'overviewCards',
        config: { maxCards: 4, density: 'standard' },
        runtimeData: emptyRuntimeData
    },
    {
        instanceKey: 'messenger-details-title',
        zone: 'center',
        sortOrder: 2,
        parentInstanceKey: null,
        slotKey: null,
        widgetKey: 'detailsTitle',
        config: { level: 'h2' },
        runtimeData: emptyRuntimeData
    },
    {
        instanceKey: 'messenger-tabs',
        zone: 'center',
        sortOrder: 3,
        parentInstanceKey: null,
        slotKey: null,
        widgetKey: 'detailsTabs',
        config: { tabs: [{ slotKey: 'tab:main', label: 'Messages', isDefault: true }] }
    },
    {
        instanceKey: 'messenger-navigation',
        zone: 'center',
        sortOrder: 4,
        parentInstanceKey: 'messenger-tabs',
        slotKey: 'tab:main',
        widgetKey: 'menuWidget',
        config: { variant: 'generated' },
        runtimeData: {
            status: 'ready',
            data: {
                kind: 'menu',
                title: 'Navigation',
                showTitle: false,
                overflowLabel: 'More',
                items: [
                    {
                        key: 'messenger.item.1',
                        label: 'Start',
                        icon: null,
                        kind: 'section',
                        target: { kind: 'page', codename: 'Start' }
                    }
                ],
                overflowItems: []
            }
        }
    },
    {
        instanceKey: 'messenger-records',
        zone: 'center',
        sortOrder: 4,
        parentInstanceKey: 'messenger-tabs',
        slotKey: 'tab:main',
        widgetKey: 'detailsTable',
        config: { variant: 'records', showSearch: true, maxRows: 20 },
        runtimeData: emptyRuntimeData
    },
    {
        instanceKey: 'messenger-resource',
        zone: 'center',
        sortOrder: 5,
        parentInstanceKey: null,
        slotKey: null,
        widgetKey: 'resourcePreview',
        config: { displayMode: 'card' },
        runtimeData: emptyRuntimeData
    },
    {
        instanceKey: 'messenger-relation',
        zone: 'center',
        sortOrder: 6,
        parentInstanceKey: null,
        slotKey: null,
        widgetKey: 'relationBuilder',
        config: { panels: [{ slotKey: 'panel:related', title: 'Related' }] },
        runtimeData: emptyRuntimeData
    },
    {
        instanceKey: 'messenger-columns',
        zone: 'center',
        sortOrder: 7,
        parentInstanceKey: null,
        slotKey: null,
        widgetKey: 'columnsContainer',
        config: { columns: [{ slotKey: 'column:main', width: 12 }] }
    },
    {
        instanceKey: 'messenger-session-chart',
        zone: 'center',
        sortOrder: 8,
        parentInstanceKey: null,
        slotKey: null,
        widgetKey: 'sessionsChart',
        config: { chartStyle: 'line', maxPoints: 30 },
        runtimeData: emptyRuntimeData
    },
    {
        instanceKey: 'messenger-page-views-chart',
        zone: 'center',
        sortOrder: 9,
        parentInstanceKey: null,
        slotKey: null,
        widgetKey: 'pageViewsChart',
        config: { chartStyle: 'bar', maxPoints: 30 },
        runtimeData: emptyRuntimeData
    }
]

describe('Messenger App application layout contracts', () => {
    it('accepts only the registered Messenger App template and its empty renderer config', () => {
        expect(applicationTemplateKeySchema.safeParse('messenger-app').success).toBe(true)
        expect(applicationTemplateKeySchema.safeParse('unknown-template').success).toBe(false)
        expect(messengerAppConfigSchema.parse({})).toEqual({})
        expect(messengerAppConfigSchema.safeParse({ themeMode: 'dark' }).success).toBe(false)
        expect(parseApplicationLayoutConfig('messenger-app', {})).toEqual({})
        expect(() => parseApplicationLayoutConfig('messenger-app', { themeMode: 'dark' })).toThrow()
        expect(APPLICATION_TEMPLATE_REGISTRY['messenger-app']).toMatchObject({
            key: 'messenger-app',
            supportsDashboardWidgets: true,
            semanticRegions: ['header', 'main', 'footer']
        })
    })

    it('maps the canonical top, center, and bottom zones to header, main, and footer', () => {
        expect(MESSENGER_APP_LAYOUT_ZONES).toEqual(['top', 'center', 'bottom'])
        expect(MESSENGER_APP_LAYOUT_ZONE_SEMANTICS).toEqual({ top: 'header', center: 'main', bottom: 'footer' })
        expect(
            LAYOUT_ZONE_DEFINITIONS.filter(({ templateKey }) => templateKey === 'messenger-app').map(({ key, semanticRegion }) => [
                key,
                semanticRegion
            ])
        ).toEqual([
            ['top', 'header'],
            ['center', 'main'],
            ['bottom', 'footer']
        ])
    })

    it('keeps all FR-006 Must classes in the canonical registry with their authoring and copy policies', () => {
        expect(FR006_MUST_WIDGET_KEYS).toHaveLength(9)
        for (const widgetKey of FR006_MUST_WIDGET_KEYS) {
            const definition = LAYOUT_WIDGET_DEFINITIONS.find((widget) => widget.key === widgetKey)
            expect(definition, `${widgetKey} definition`).toBeDefined()
            expect(definition?.supportedTemplates).toContain('dashboard')
            expect(definition?.allowedZonesByTemplate.dashboard?.length).toBeGreaterThan(0)
            expect(definition?.sourcePolicy).toBeDefined()
            expect(definition?.authoring.metahub).toBeDefined()
            expect(definition?.authoring.application).toBeDefined()
            expect(definition?.copyPolicy).toBeDefined()
            expect(definition?.seedPolicies.length).toBeGreaterThan(0)
        }
    })

    it('enables the FR-006 and FR-008 widgets plus header for Messenger App', () => {
        const messengerWidgetKeys = LAYOUT_WIDGET_DEFINITIONS.filter((widget) => widget.supportedTemplates.includes('messenger-app'))
            .map(({ key }) => key)
            .sort()
        expect(messengerWidgetKeys).toEqual([...FR006_MESSENGER_PUBLIC_WIDGET_KEYS].sort())
        expect(getLayoutWidgetAllowedZones('header', 'messenger-app')).toEqual(['top'])
        expect(getLayoutWidgetAllowedZones('menuWidget', 'messenger-app')).toEqual(['center'])
        for (const widgetKey of FR006_MUST_WIDGET_KEYS) {
            expect(getLayoutWidgetAllowedZones(widgetKey, 'messenger-app')?.length, `${widgetKey} Messenger App policy`).toBeGreaterThan(0)
        }

        for (const placement of messengerPlacements) {
            expect(publicMessengerPlacementSchema.safeParse(placement).success, `${placement.widgetKey} strict Messenger DTO`).toBe(true)
        }
        const messengerApp = { locale: 'en', title: 'Public app', placements: messengerPlacements }
        expect(publicMessengerAppRuntimeSchema.safeParse(messengerApp).success).toBe(true)
        expect(
            publicApplicationRuntimeSchema.safeParse({
                route: {
                    matchedBy: 'alias',
                    matchedAlias: 'public-app',
                    routingMode: 'direct',
                    primaryAlias: 'public-app',
                    canonicalAlias: null
                },
                templateKey: 'messenger-app',
                messengerApp
            }).success
        ).toBe(true)

        const relation = messengerPlacements.find(({ widgetKey }) => widgetKey === 'relationBuilder')!
        expect(
            publicMessengerPlacementSchema.safeParse({
                ...relation,
                config: { ...relation.config, rowLink: { fieldCodename: 'Title', pathTemplate: '/records/{value}' } }
            }).success
        ).toBe(false)

        const menu = messengerPlacements.find(({ widgetKey }) => widgetKey === 'menuWidget')!
        expect(
            publicMessengerPlacementSchema.safeParse({
                ...menu,
                runtimeData: {
                    status: 'ready',
                    data: {
                        kind: 'menu',
                        title: 'Navigation',
                        showTitle: false,
                        overflowLabel: 'More',
                        items: [
                            {
                                key: 'messenger.item.1',
                                label: 'Start',
                                icon: null,
                                kind: 'section',
                                target: { kind: 'page', codename: 'Start' }
                            }
                        ],
                        overflowItems: []
                    }
                }
            }).success
        ).toBe(true)
        expect(
            publicMessengerPlacementSchema.safeParse({
                ...menu,
                runtimeData: {
                    status: 'ready',
                    data: {
                        kind: 'menu',
                        title: 'Navigation',
                        showTitle: false,
                        overflowLabel: 'More',
                        items: [
                            {
                                key: 'messenger.item.1',
                                label: 'Admin',
                                icon: null,
                                kind: 'section',
                                target: { kind: 'page', codename: 'Start' }
                            },
                            { key: 'messenger.item.2', label: 'Workspaces', icon: null, kind: 'link', href: '/workspaces' }
                        ],
                        overflowItems: []
                    }
                }
            }).success
        ).toBe(false)
        const table = messengerPlacements.find(({ widgetKey }) => widgetKey === 'detailsTable')!
        expect(
            publicMessengerPlacementSchema.safeParse({
                ...table,
                runtimeData: {
                    status: 'ready',
                    data: { kind: 'record', title: 'Message', fields: [{ label: 'Subject', value: 'Welcome' }] }
                }
            }).success
        ).toBe(true)
        for (const label of ['Name', 'Person Name', 'Customer Name', 'Member name', 'Profile name']) {
            expect(
                publicMessengerPlacementSchema.safeParse({
                    ...table,
                    runtimeData: {
                        status: 'ready',
                        data: {
                            kind: 'record',
                            title: 'Message',
                            fields: [{ label, value: 'Private identity value' }]
                        }
                    }
                }).success,
                `private record label ${label}`
            ).toBe(false)
            expect(
                publicMessengerPlacementSchema.safeParse({
                    ...table,
                    runtimeData: {
                        status: 'ready',
                        data: {
                            kind: 'table',
                            columns: [{ key: 'column1', label }],
                            rows: [],
                            pagination: { total: 0, limit: 20, offset: 0 }
                        }
                    }
                }).success,
                `private table label ${label}`
            ).toBe(false)
        }
        const overviewCards = messengerPlacements.find(({ widgetKey }) => widgetKey === 'overviewCards')!
        const sessionsChart = messengerPlacements.find(({ widgetKey }) => widgetKey === 'sessionsChart')!
        for (const label of ['Name', 'Person Name', 'Customer Name', 'Member name', 'Profile name']) {
            expect(
                publicMessengerPlacementSchema.safeParse({
                    ...overviewCards,
                    runtimeData: { status: 'ready', data: { kind: 'metrics', cards: [{ label, value: '1' }] } }
                }).success,
                `private metric label ${label}`
            ).toBe(false)
            expect(
                publicMessengerPlacementSchema.safeParse({
                    ...sessionsChart,
                    runtimeData: {
                        status: 'ready',
                        data: { kind: 'series', title: 'Activity', labels: ['Mon'], series: [{ label, values: [1] }] }
                    }
                }).success,
                `private chart label ${label}`
            ).toBe(false)
        }
        const chartData = (label: string) => ({
            status: 'ready' as const,
            data: { kind: 'series' as const, title: 'Activity', labels: [label], series: [{ label: 'Views', values: [1] }] }
        })
        expect(
            publicMessengerPlacementSchema.safeParse({
                ...sessionsChart,
                runtimeData: chartData('2026-10-25T00:00:00.000Z')
            }).success
        ).toBe(true)
        for (const label of ['+1 (415) 555-0198', '123e4567-e89b-42d3-a456-426614174000', '2026-13-45T00:00:00.000Z']) {
            expect(
                publicMessengerPlacementSchema.safeParse({ ...sessionsChart, runtimeData: chartData(label) }).success,
                `unsafe chart label ${label}`
            ).toBe(false)
        }
        expect(
            publicMessengerPlacementSchema.safeParse({
                ...table,
                runtimeData: {
                    status: 'ready',
                    data: {
                        kind: 'record',
                        title: 'Message',
                        fields: [{ label: 'Notes', value: '-----BEGIN PRIVATE KEY-----\\nprivate-data\\n-----END PRIVATE KEY-----' }]
                    }
                }
            }).success
        ).toBe(false)
        expect(
            publicMessengerPlacementSchema.safeParse({
                ...table,
                runtimeData: {
                    status: 'ready',
                    data: { kind: 'record', title: 'Message', id: 'raw-id', fields: [{ label: 'Subject', value: 'Welcome' }] }
                }
            }).success
        ).toBe(false)
        const detailsTitle = messengerPlacements.find(({ widgetKey }) => widgetKey === 'detailsTitle')!
        expect(detailsTitle.runtimeData).toMatchObject({ status: 'empty' })
        expect(
            publicMessengerPlacementSchema.safeParse({
                ...detailsTitle,
                runtimeData: { status: 'ready', data: { kind: 'title', text: 'Messages' } }
            }).success
        ).toBe(true)
        expect(
            publicMessengerPlacementSchema.safeParse({
                ...detailsTitle,
                runtimeData: { status: 'ready', data: { kind: 'record', title: 'Message', fields: [] } }
            }).success
        ).toBe(false)
        expect(publicMessengerPlacementSchema.safeParse({ ...table, config: { ...table.config, createTargets: [] } }).success).toBe(false)
        expect(publicMessengerPlacementSchema.safeParse({ ...table, config: { ...table.config, maxRows: 21 } }).success).toBe(false)
        expect(
            publicMessengerPlacementSchema.safeParse({
                ...sessionsChart,
                config: { ...sessionsChart.config, maxPoints: MAX_PUBLIC_MESSENGER_CHART_POINTS + 1 }
            }).success
        ).toBe(false)
        const tooManyChartPoints = Array.from({ length: MAX_PUBLIC_MESSENGER_CHART_POINTS + 1 }, (_, index) => index)
        expect(
            publicMessengerPlacementSchema.safeParse({
                ...sessionsChart,
                runtimeData: {
                    status: 'ready',
                    data: {
                        kind: 'series',
                        title: 'Activity',
                        labels: tooManyChartPoints.map((index) => `day-${index}`),
                        series: [{ label: 'Views', values: tooManyChartPoints }]
                    }
                }
            }).success
        ).toBe(false)
        expect(publicMessengerPlacementSchema.safeParse({ ...table, config: { ...table.config, enableRowReordering: true } }).success).toBe(
            false
        )
        expect(publicMessengerPlacementSchema.safeParse({ ...table, id: '0190a9b5-3cde-7abc-8def-0123456789ab' }).success).toBe(false)
        expect(publicMessengerAppRuntimeSchema.safeParse({ ...messengerApp, currentWorkspaceId: null }).success).toBe(false)
    })

    it('validates Messenger App in the existing template metadata envelope', () => {
        const messengerWidgets = LAYOUT_WIDGET_DEFINITIONS.filter((widget) => widget.supportedTemplates.includes('messenger-app'))
        const result = layoutWidgetMetadataResponseSchema.safeParse({
            items: messengerWidgets,
            templates: [
                {
                    ...APPLICATION_TEMPLATE_REGISTRY['messenger-app'],
                    zones: LAYOUT_ZONE_DEFINITIONS.filter(({ templateKey }) => templateKey === 'messenger-app'),
                    widgets: messengerWidgets
                }
            ]
        })

        expect(result.success).toBe(true)
    })
})
