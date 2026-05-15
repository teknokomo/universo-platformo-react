const mockGetPoolExecutor = jest.fn()

jest.mock('@universo/database', () => {
    const actual = jest.requireActual('@universo/database')
    return {
        __esModule: true,
        ...actual,
        getPoolExecutor: () => mockGetPoolExecutor()
    }
})

import { attachLayoutsToSnapshot } from '../../domains/shared/snapshotLayouts'
import type { MetahubSnapshot } from '../../domains/publications/services/SnapshotSerializer'

type MockPoolExecutor = {
    query: jest.Mock<Promise<unknown[]>, [string, unknown[]]>
}

const createPoolExecutor = (): MockPoolExecutor => ({
    query: jest.fn(async (sql: string, params: unknown[]) => {
        if (sql.includes('_mhb_layouts')) {
            return [
                {
                    id: 'layout-global-active',
                    scope_entity_id: null,
                    base_layout_id: null,
                    template_key: 'dashboard',
                    name: { en: 'Global active' },
                    description: null,
                    config: { showHeader: true },
                    is_active: true,
                    is_default: true,
                    sort_order: 0
                },
                {
                    id: 'layout-global-inactive',
                    scope_entity_id: null,
                    base_layout_id: null,
                    template_key: 'dashboard',
                    name: { en: 'Global inactive' },
                    description: null,
                    config: { showHeader: false },
                    is_active: false,
                    is_default: false,
                    sort_order: 1
                },
                {
                    id: 'layout-object-active',
                    scope_entity_id: 'object-1',
                    base_layout_id: 'layout-global-active',
                    template_key: 'dashboard',
                    name: { en: 'Object active' },
                    description: null,
                    config: { showHeader: false },
                    is_active: true,
                    is_default: true,
                    sort_order: 0
                },
                {
                    id: 'layout-object-inactive',
                    scope_entity_id: 'object-2',
                    base_layout_id: 'layout-global-inactive',
                    template_key: 'dashboard',
                    name: { en: 'Object inactive' },
                    description: null,
                    config: { showHeader: true },
                    is_active: false,
                    is_default: false,
                    sort_order: 1
                }
            ]
        }

        if (sql.includes('information_schema.tables') && params[1] === '_mhb_widgets') {
            return [{ exists: true }]
        }

        if (sql.includes('_mhb_widgets')) {
            return [
                {
                    id: 'widget-global-active',
                    layout_id: 'layout-global-active',
                    zone: 'left',
                    widget_key: 'menuWidget',
                    sort_order: 1,
                    config: { showTitle: true },
                    is_active: true
                },
                {
                    id: 'widget-global-inactive',
                    layout_id: 'layout-global-inactive',
                    zone: 'right',
                    widget_key: 'detailsTable',
                    sort_order: 1,
                    config: {},
                    is_active: true
                },
                {
                    id: 'widget-object-active',
                    layout_id: 'layout-object-active',
                    zone: 'top',
                    widget_key: 'statsOverview',
                    sort_order: 1,
                    config: {},
                    is_active: true
                },
                {
                    id: 'widget-object-inactive',
                    layout_id: 'layout-object-inactive',
                    zone: 'bottom',
                    widget_key: 'infoCard',
                    sort_order: 2,
                    config: {},
                    is_active: false
                }
            ]
        }

        if (sql.includes('information_schema.tables') && params[1] === '_mhb_layout_widget_overrides') {
            return [{ exists: true }]
        }

        if (sql.includes('_mhb_layout_widget_overrides')) {
            return [
                {
                    id: 'override-active',
                    layout_id: 'layout-object-active',
                    base_widget_id: 'widget-global-active',
                    zone: 'center',
                    sort_order: 2,
                    config: { ignored: true },
                    is_active: true,
                    is_deleted_override: false
                },
                {
                    id: 'override-inactive',
                    layout_id: 'layout-object-inactive',
                    base_widget_id: 'widget-global-inactive',
                    zone: 'left',
                    sort_order: 1,
                    config: null,
                    is_active: false,
                    is_deleted_override: false
                },
                {
                    id: 'override-orphan',
                    layout_id: 'layout-missing',
                    base_widget_id: 'widget-global-active',
                    zone: 'right',
                    sort_order: 9,
                    config: null,
                    is_active: true,
                    is_deleted_override: false
                }
            ]
        }

        throw new Error(`Unexpected query: ${sql}`)
    })
})

describe('attachLayoutsToSnapshot', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('exports the full design-time layout set and keeps override rows scoped to exported entity layouts', async () => {
        const poolExecutor = createPoolExecutor()
        mockGetPoolExecutor.mockReturnValue(poolExecutor)

        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_018f8a787b8f7c1da111222233334444_b1')
        }

        const snapshot = {} as MetahubSnapshot

        await attachLayoutsToSnapshot({
            schemaService: schemaService as any,
            snapshot,
            metahubId: 'metahub-1',
            userId: 'user-1'
        })

        expect(schemaService.ensureSchema).toHaveBeenCalledWith('metahub-1', 'user-1')

        expect(snapshot.layouts).toEqual([
            expect.objectContaining({ id: 'layout-global-active', isActive: true, isDefault: true }),
            expect.objectContaining({ id: 'layout-global-inactive', isActive: false, isDefault: false })
        ])

        expect(snapshot.scopedLayouts).toEqual([
            expect.objectContaining({ id: 'layout-object-active', scopeEntityId: 'object-1', baseLayoutId: 'layout-global-active' }),
            expect.objectContaining({
                id: 'layout-object-inactive',
                scopeEntityId: 'object-2',
                baseLayoutId: 'layout-global-inactive'
            })
        ])

        expect(snapshot.defaultLayoutId).toBe('layout-global-active')
        expect(snapshot.layoutConfig).toEqual({ showHeader: true })

        expect(snapshot.layoutZoneWidgets).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 'widget-global-active', layoutId: 'layout-global-active' }),
                expect.objectContaining({ id: 'widget-global-inactive', layoutId: 'layout-global-inactive' }),
                expect.objectContaining({ id: 'widget-object-active', layoutId: 'layout-object-active' }),
                expect.objectContaining({ id: 'widget-object-inactive', layoutId: 'layout-object-inactive', isActive: false })
            ])
        )

        expect(snapshot.layoutWidgetOverrides).toEqual([
            expect.objectContaining({
                id: 'override-active',
                layoutId: 'layout-object-active',
                baseWidgetId: 'widget-global-active',
                config: null
            }),
            expect.objectContaining({
                id: 'override-inactive',
                layoutId: 'layout-object-inactive',
                baseWidgetId: 'widget-global-inactive',
                isActive: false
            })
        ])
    })
})
