import { describe, expect, it } from 'vitest'
import {
    publicApplicationRuntimeSchema,
    publicDashboardPlacementSchema,
    publicDashboardRuntimeSchema,
    publicInterpretationNetworkRendererConfigSchema,
    publicInterpretationNetworkReadResponseSchema
} from '../common/publicApplicationRuntime'

const route = {
    matchedBy: 'uuid' as const,
    matchedAlias: null,
    routingMode: 'direct' as const,
    primaryAlias: null,
    canonicalAlias: null
}

const publicHandle = `pn1.${'A'.repeat(32)}`

describe('public application runtime contracts', () => {
    it('discriminates Marketing and Dashboard while retaining the Marketing DTO', () => {
        expect(
            publicApplicationRuntimeSchema.safeParse({
                route,
                templateKey: 'marketing-page',
                marketingPage: {
                    templateKey: 'marketing-page',
                    locale: 'en',
                    config: {},
                    headerPosition: 'fixed',
                    widgets: [],
                    headerWidgets: []
                }
            }).success
        ).toBe(true)

        expect(
            publicApplicationRuntimeSchema.safeParse({
                route,
                templateKey: 'dashboard',
                dashboard: { locale: 'en', workspaceAvailability: 'available', placements: [] }
            }).success
        ).toBe(true)
    })

    it.each([
        {
            name: 'compact',
            sideMenu: {
                availableModes: ['wide', 'compact'],
                primaryMode: 'compact',
                rememberUserChoice: false
            }
        },
        {
            name: 'overlay',
            sideMenu: {
                availableModes: ['wide', 'overlay'],
                primaryMode: 'overlay',
                rememberUserChoice: true
            }
        }
    ])('round-trips the public $name side-menu presentation config', ({ sideMenu }) => {
        const parsed = publicDashboardRuntimeSchema.safeParse({
            locale: 'en',
            workspaceAvailability: 'none',
            layoutConfig: { sideMenu },
            placements: []
        })

        expect(parsed.success).toBe(true)
        if (parsed.success) expect(parsed.data.layoutConfig).toEqual({ sideMenu })
    })

    it('rejects private and unallowlisted Dashboard layout config in the public DTO', () => {
        const dashboard = {
            locale: 'en',
            workspaceAvailability: 'none',
            placements: []
        }
        const sideMenu = {
            availableModes: ['wide', 'compact'],
            primaryMode: 'compact',
            rememberUserChoice: false
        }

        expect(
            publicDashboardRuntimeSchema.safeParse({
                ...dashboard,
                layoutConfig: { sideMenu, objectBehavior: { showCreateButton: false } }
            }).success
        ).toBe(false)
        expect(publicDashboardRuntimeSchema.safeParse({ ...dashboard, layoutConfig: { sideMenu, internalOption: true } }).success).toBe(
            false
        )
    })

    it('accepts only strict canonical renderer placements with semantic identity', () => {
        const menu = {
            instanceKey: 'main-menu',
            zone: 'left',
            sortOrder: 2,
            parentInstanceKey: null,
            slotKey: null,
            widgetKey: 'menuWidget',
            config: { variant: 'generated' },
            runtimeData: {
                status: 'ready',
                data: { title: 'Navigation', showTitle: false, overflowLabel: 'More', items: [], overflowItems: [] }
            }
        }
        const network = {
            instanceKey: 'interpretation-workspace',
            zone: 'center',
            sortOrder: 1,
            parentInstanceKey: null,
            slotKey: null,
            widgetKey: 'interpretationNetworkWorkspace',
            config: {},
            runtimeData: { status: 'deferred' }
        }

        expect(publicDashboardPlacementSchema.safeParse(menu).success).toBe(true)
        expect(publicDashboardPlacementSchema.safeParse(network).success).toBe(true)
        expect(publicDashboardPlacementSchema.safeParse({ ...network, id: '0190a9b5-3cde-7abc-8def-0123456789ab' }).success).toBe(false)
        expect(publicDashboardPlacementSchema.safeParse({ ...network, instanceKey: '0190a9b5-3cde-7abc-8def-0123456789ab' }).success).toBe(
            false
        )
        expect(publicDashboardPlacementSchema.safeParse({ ...network, config: { conceptCodename: 'Structure' } }).success).toBe(false)
        expect(publicDashboardPlacementSchema.safeParse({ ...network, widgetKey: 'optionsMenu' }).success).toBe(false)
        expect(publicDashboardPlacementSchema.safeParse({ ...network, zone: 'marketing-main' }).success).toBe(false)
        expect(publicDashboardPlacementSchema.safeParse({ ...network, parentInstanceKey: 'menu', slotKey: null }).success).toBe(false)
    })

    it('allows presentation-only tabs and bounded read-only table payloads without handles or actions', () => {
        const tabs = {
            instanceKey: 'public-tabs',
            zone: 'center',
            sortOrder: 0,
            parentInstanceKey: null,
            slotKey: null,
            widgetKey: 'detailsTabs',
            config: { tabs: [{ slotKey: 'tab:public', label: 'Public content', isDefault: true }] }
        }
        const table = {
            instanceKey: 'public-table',
            zone: 'center',
            sortOrder: 1,
            parentInstanceKey: 'public-tabs',
            slotKey: 'tab:public',
            widgetKey: 'detailsTable',
            config: { variant: 'records', showSearch: true },
            runtimeData: {
                status: 'ready',
                data: {
                    kind: 'table',
                    columns: [{ key: 'Title', label: 'Title', valueType: 'string' }],
                    rows: [{ key: 'row-1', cells: [{ key: 'Title', value: 'Public course' }] }],
                    pagination: { total: 1, limit: 24, offset: 0 }
                }
            }
        }

        expect(publicDashboardPlacementSchema.safeParse(tabs).success).toBe(true)
        expect(publicDashboardPlacementSchema.safeParse(table).success).toBe(true)
        expect(
            publicDashboardPlacementSchema.safeParse({
                ...table,
                runtimeData: {
                    status: 'ready',
                    data: {
                        ...table.runtimeData.data,
                        rows: [
                            {
                                key: 'row-1',
                                actionTarget: { entityCodename: 'Course', recordHandle: `pn1.${'A'.repeat(32)}` },
                                cells: [{ key: 'Title', value: 'Public course' }]
                            }
                        ]
                    }
                }
            }).success
        ).toBe(false)
        expect(
            publicDashboardPlacementSchema.safeParse({
                ...table,
                config: { variant: 'records', createTargets: [] }
            }).success
        ).toBe(false)
    })

    it('limits the anonymous menu projection to a single visible item and no overflow', () => {
        const menu = {
            instanceKey: 'public-menu',
            zone: 'left',
            sortOrder: 0,
            parentInstanceKey: null,
            slotKey: null,
            widgetKey: 'menuWidget',
            config: { variant: 'generated' },
            runtimeData: {
                status: 'ready',
                data: {
                    title: 'Explore',
                    showTitle: false,
                    overflowLabel: 'More',
                    items: [{ key: 'start', label: 'Start', icon: null, kind: 'section', target: { kind: 'page', codename: 'Start' } }],
                    navigationAction: {
                        label: 'Structures',
                        source: { kind: 'page', codename: 'Start' },
                        target: { kind: 'object', codename: 'Structure' }
                    },
                    overflowItems: []
                }
            }
        }
        expect(publicDashboardPlacementSchema.safeParse(menu).success).toBe(true)
        expect(
            publicDashboardPlacementSchema.safeParse({
                ...menu,
                runtimeData: {
                    status: 'ready',
                    data: {
                        ...menu.runtimeData.data,
                        items: [
                            ...menu.runtimeData.data.items,
                            { key: 'second', label: 'Second', icon: null, kind: 'section', target: { kind: 'page', codename: 'Second' } }
                        ]
                    }
                }
            }).success
        ).toBe(false)
        expect(
            publicDashboardPlacementSchema.safeParse({
                ...menu,
                runtimeData: {
                    status: 'ready',
                    data: { ...menu.runtimeData.data, navigationAction: { label: 'External', href: 'https://example.com' } }
                }
            }).success
        ).toBe(false)
    })

    it('preserves renderer constraints while rejecting persistence config fields', () => {
        expect(publicInterpretationNetworkRendererConfigSchema.safeParse({ conceptCodename: 'Structure' }).success).toBe(false)
        expect(
            publicInterpretationNetworkRendererConfigSchema.safeParse({
                matrixMode: 'independentRows',
                allowedMatrixViews: ['verticalTree']
            }).success
        ).toBe(false)
        expect(
            publicInterpretationNetworkRendererConfigSchema.safeParse({
                matrixMode: 'independentRows',
                tableProjection: 'hierarchicalPath'
            }).success
        ).toBe(false)
        expect(publicInterpretationNetworkRendererConfigSchema.safeParse({ allowedMatrixViews: ['table', 'table'] }).success).toBe(false)
    })

    it('validates bounded specialized IN reads and rejects persistence identity fields', () => {
        const structures = {
            locale: 'en',
            view: 'structures',
            items: [{ handle: publicHandle, name: 'Research', description: null }],
            page: { offset: 0, limit: 100, hasMore: false }
        }
        expect(publicInterpretationNetworkReadResponseSchema.safeParse(structures).success).toBe(true)
        expect(
            publicInterpretationNetworkReadResponseSchema.safeParse({
                locale: 'en',
                view: 'matrix',
                interpretation: { handle: publicHandle, title: 'Primary' },
                items: [],
                page: { offset: 0, limit: 250, hasMore: false }
            }).success
        ).toBe(true)
        expect(
            publicInterpretationNetworkReadResponseSchema.safeParse({ ...structures, items: [{ ...structures.items[0], id: 'row-id' }] })
                .success
        ).toBe(false)
        expect(
            publicInterpretationNetworkReadResponseSchema.safeParse({
                locale: 'en',
                view: 'matrix',
                interpretation: { handle: publicHandle, title: 'Primary' },
                items: [],
                page: { offset: 10_001, limit: 250, hasMore: false }
            }).success
        ).toBe(false)
    })
})
