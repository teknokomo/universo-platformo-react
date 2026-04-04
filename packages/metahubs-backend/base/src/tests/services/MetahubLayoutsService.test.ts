import { MetahubLayoutsService } from '../../domains/layouts/services/MetahubLayoutsService'

describe('MetahubLayoutsService', () => {
    it('preserves authored runtime config keys when zone-widget sync rewrites layout widget flags', async () => {
        const layoutId = 'layout-1'
        const widgetId = 'widget-1'
        let persistedLayoutConfig: Record<string, unknown> | null = null

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('SELECT config FROM') && sql.includes('_mhb_layouts')) {
                return [
                    {
                        config: {
                            showViewToggle: true,
                            defaultViewMode: 'card',
                            showFilterBar: true,
                            enableRowReordering: true,
                            cardColumns: 3,
                            rowHeight: 'auto',
                            showOverviewTitle: false,
                            showOverviewCards: false,
                            showSessionsChart: false,
                            showPageViewsChart: false,
                            showDetailsTitle: true,
                            showDetailsTable: true,
                            showFooter: false
                        }
                    }
                ]
            }

            if (sql.includes('SELECT COUNT(*)::int AS count FROM') && sql.includes('_mhb_widgets')) {
                return [{ count: 1 }]
            }

            if (sql.includes('SELECT id FROM') && sql.includes('_mhb_widgets') && sql.includes('zone = $2')) {
                return []
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets') && sql.includes('widget_key = $2')) {
                return [
                    {
                        id: widgetId,
                        layout_id: layoutId,
                        zone: 'left',
                        widget_key: 'menuWidget',
                        sort_order: 1,
                        config: {},
                        is_active: true,
                        _upl_created_at: '2026-04-04T00:00:00.000Z',
                        _upl_updated_at: '2026-04-04T00:00:00.000Z'
                    }
                ]
            }

            if (sql.includes('SELECT id, sort_order FROM') && sql.includes('_mhb_widgets')) {
                return [{ id: widgetId, sort_order: 1 }]
            }

            if (sql.includes('SELECT widget_key, zone, is_active FROM') && sql.includes('_mhb_widgets')) {
                return [
                    { widget_key: 'menuWidget', zone: 'left', is_active: true },
                    { widget_key: 'header', zone: 'top', is_active: true },
                    { widget_key: 'detailsTitle', zone: 'center', is_active: true },
                    { widget_key: 'detailsTable', zone: 'center', is_active: true }
                ]
            }

            if (sql.includes('UPDATE') && sql.includes('_mhb_widgets')) {
                return []
            }

            if (sql.includes('INSERT INTO') && sql.includes('_mhb_widgets') && sql.includes('RETURNING *')) {
                return [
                    {
                        id: widgetId,
                        layout_id: layoutId,
                        zone: 'left',
                        widget_key: 'menuWidget',
                        sort_order: 1,
                        config: {
                            autoShowAllCatalogs: true,
                            showTitle: true,
                            title: {
                                _schema: '1',
                                _primary: 'en',
                                locales: {
                                    en: { content: 'Catalogs', version: 1, isActive: true }
                                }
                            }
                        },
                        is_active: true,
                        _upl_created_at: '2026-04-04T00:00:00.000Z',
                        _upl_updated_at: '2026-04-04T00:00:00.000Z'
                    }
                ]
            }

            if (sql.includes('UPDATE') && sql.includes('_mhb_layouts') && sql.includes('config = $1')) {
                persistedLayoutConfig = JSON.parse(String(params?.[0] ?? '{}'))
                return []
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets') && sql.includes('WHERE id = $1')) {
                return [
                    {
                        id: widgetId,
                        layout_id: layoutId,
                        zone: 'left',
                        widget_key: 'menuWidget',
                        sort_order: 1,
                        config: {
                            autoShowAllCatalogs: true,
                            showTitle: true,
                            title: {
                                _schema: '1',
                                _primary: 'en',
                                locales: {
                                    en: { content: 'Catalogs', version: 1, isActive: true }
                                }
                            }
                        },
                        is_active: true,
                        _upl_created_at: '2026-04-04T00:00:00.000Z',
                        _upl_updated_at: '2026-04-04T00:00:00.000Z'
                    }
                ]
            }

            throw new Error(`Unexpected SQL in MetahubLayoutsService test: ${sql}`)
        })

        const tx = { query }
        const exec = {
            query,
            transaction: jest.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx)),
            isReleased: () => false
        }
        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        }

        const service = new MetahubLayoutsService(exec as never, schemaService as never)

        await service.assignLayoutZoneWidget(
            'metahub-1',
            layoutId,
            {
                zone: 'left',
                widgetKey: 'menuWidget',
                sortOrder: 1,
                config: {
                    autoShowAllCatalogs: true,
                    showTitle: true,
                    title: {
                        en: 'Catalogs',
                        ru: 'Каталоги'
                    }
                }
            },
            'user-1'
        )

        expect(persistedLayoutConfig).toMatchObject({
            showSideMenu: true,
            showHeader: true,
            showDetailsTitle: true,
            showDetailsTable: true,
            showViewToggle: true,
            defaultViewMode: 'card',
            showFilterBar: true,
            enableRowReordering: true,
            cardColumns: 3,
            rowHeight: 'auto',
            showFooter: false,
            showOverviewTitle: false,
            showOverviewCards: false,
            showSessionsChart: false,
            showPageViewsChart: false
        })
    })
})
