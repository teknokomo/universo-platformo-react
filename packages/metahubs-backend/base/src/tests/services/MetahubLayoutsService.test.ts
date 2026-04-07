import { LAYOUT_CONFIG_SKIP_DEFAULT_WIDGET_SEED_KEY, MetahubLayoutsService } from '../../domains/layouts/services/MetahubLayoutsService'

describe('MetahubLayoutsService', () => {
    it('preserves authored runtime config keys when zone-widget sync rewrites layout widget flags', async () => {
        const layoutId = 'layout-1'
        const widgetId = 'widget-1'
        let persistedLayoutConfig: Record<string, unknown> | null = null

        const baseLayoutScopeRow = {
            id: layoutId,
            catalog_id: null,
            base_layout_id: null,
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

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('SELECT id, catalog_id, base_layout_id, config') && sql.includes('_mhb_layouts')) {
                return [baseLayoutScopeRow]
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

    it('creates catalog layouts against the active global base layout without seeding default widgets', async () => {
        const layoutId = 'catalog-layout-1'
        const catalogId = 'catalog-1'
        const baseLayoutConfig = {
            showHeader: false,
            showFooter: true,
            showViewToggle: false,
            defaultViewMode: 'card',
            catalogBehavior: {
                showCreateButton: false,
                searchMode: 'server'
            }
        }
        const createdRow = {
            id: layoutId,
            catalog_id: catalogId,
            base_layout_id: 'global-layout-1',
            template_key: 'dashboard',
            name: {
                _schema: '1',
                _primary: 'en',
                locales: {
                    en: { content: 'Catalog layout', version: 1, isActive: true }
                }
            },
            description: null,
            config: {
                showViewToggle: true,
                defaultViewMode: 'card',
                catalogBehavior: {
                    showCreateButton: false,
                    searchMode: 'server'
                },
                rowHeight: 'auto'
            },
            is_active: true,
            is_default: false,
            sort_order: 0,
            _upl_version: 1,
            _upl_created_at: '2026-04-06T00:00:00.000Z',
            _upl_updated_at: '2026-04-06T00:00:00.000Z'
        }

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('SELECT id FROM') && sql.includes("kind = 'catalog'") && sql.includes('_mhb_objects')) {
                expect(params).toEqual([catalogId])
                return [{ id: catalogId }]
            }

            if (sql.includes('catalog_id IS NULL') && sql.includes('is_active = true') && sql.includes('_mhb_layouts')) {
                return [
                    {
                        id: 'global-layout-1',
                        catalog_id: null,
                        base_layout_id: null,
                        config: baseLayoutConfig
                    }
                ]
            }

            if (sql.includes('INSERT INTO') && sql.includes('_mhb_layouts') && sql.includes('RETURNING *')) {
                expect(params?.[0]).toBe(catalogId)
                expect(params?.[1]).toBe('global-layout-1')
                expect(JSON.parse(String(params?.[5] ?? '{}'))).toEqual({
                    showViewToggle: true,
                    defaultViewMode: 'card',
                    catalogBehavior: {
                        showCreateButton: false,
                        searchMode: 'server'
                    },
                    rowHeight: 'auto'
                })
                return [createdRow]
            }

            if (sql.includes('UPDATE') && sql.includes('_mhb_layouts') && sql.includes('is_default = false')) {
                return []
            }

            throw new Error(`Unexpected SQL in create catalog layout test: ${sql}`)
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

        const created = await service.createLayout(
            'metahub-1',
            {
                catalogId,
                templateKey: 'dashboard',
                name: {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'Catalog layout', version: 1, isActive: true }
                    }
                },
                description: null,
                config: { showHeader: true, showViewToggle: true, rowHeight: 'auto' },
                isActive: true,
                isDefault: false,
                sortOrder: 0
            },
            'user-1'
        )

        expect(created.catalogId).toBe(catalogId)
        expect(created.baseLayoutId).toBe('global-layout-1')
        expect(created.config).toEqual({
            showViewToggle: true,
            defaultViewMode: 'card',
            catalogBehavior: {
                showCreateButton: false,
                searchMode: 'server'
            },
            rowHeight: 'auto'
        })
        expect(query).toHaveBeenCalledTimes(3)
        expect(query.mock.calls.some(([sql]) => String(sql).includes('_mhb_widgets'))).toBe(false)
    })

    it('creates global layouts empty by default without seeding default widgets', async () => {
        const layoutId = 'global-layout-1'
        const createdRow = {
            id: layoutId,
            catalog_id: null,
            base_layout_id: null,
            template_key: 'dashboard',
            name: {
                _schema: '1',
                _primary: 'en',
                locales: {
                    en: { content: 'Blank layout', version: 1, isActive: true }
                }
            },
            description: null,
            config: {
                showSideMenu: false,
                showRightSideMenu: false,
                showAppNavbar: false,
                showHeader: false,
                showBreadcrumbs: false,
                showSearch: false,
                showDatePicker: false,
                showOptionsMenu: false,
                showLanguageSwitcher: false,
                showOverviewTitle: false,
                showOverviewCards: false,
                showSessionsChart: false,
                showPageViewsChart: false,
                showDetailsTitle: false,
                showDetailsTable: false,
                showColumnsContainer: false,
                showProductTree: false,
                showUsersByCountryChart: false,
                showFooter: false,
                [LAYOUT_CONFIG_SKIP_DEFAULT_WIDGET_SEED_KEY]: true
            },
            is_active: true,
            is_default: false,
            sort_order: 0,
            _upl_version: 1,
            _upl_created_at: '2026-04-06T00:00:00.000Z',
            _upl_updated_at: '2026-04-06T00:00:00.000Z'
        }

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('INSERT INTO') && sql.includes('_mhb_layouts') && sql.includes('RETURNING *')) {
                const config = JSON.parse(String(params?.[5] ?? '{}'))
                expect(params?.[0]).toBeNull()
                expect(params?.[1]).toBeNull()
                expect(config).toMatchObject({
                    showSideMenu: false,
                    showHeader: false,
                    showDetailsTitle: false,
                    showDetailsTable: false,
                    showFooter: false,
                    [LAYOUT_CONFIG_SKIP_DEFAULT_WIDGET_SEED_KEY]: true
                })
                return [createdRow]
            }

            throw new Error(`Unexpected SQL in create global layout test: ${sql}`)
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

        const created = await service.createLayout(
            'metahub-1',
            {
                templateKey: 'dashboard',
                name: {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'Blank layout', version: 1, isActive: true }
                    }
                },
                description: null,
                isActive: true,
                isDefault: false,
                sortOrder: 0
            },
            'user-1'
        )

        expect(created.catalogId).toBeNull()
        expect(created.baseLayoutId).toBeNull()
        expect(created.config).toMatchObject({
            showSideMenu: false,
            showHeader: false,
            showDetailsTitle: false,
            showDetailsTable: false,
            [LAYOUT_CONFIG_SKIP_DEFAULT_WIDGET_SEED_KEY]: true
        })
        expect(query).toHaveBeenCalledTimes(1)
        expect(query.mock.calls.some(([sql]) => String(sql).includes('_mhb_widgets'))).toBe(false)
    })

    it('rejects catalog layout creation when catalogId points to a non-catalog object', async () => {
        const query = jest.fn(async (sql: string) => {
            if (sql.includes('SELECT id FROM') && sql.includes("kind = 'catalog'") && sql.includes('_mhb_objects')) {
                return []
            }

            throw new Error(`Unexpected SQL in catalog validation test: ${sql}`)
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

        await expect(
            service.createLayout(
                'metahub-1',
                {
                    catalogId: 'catalog-1',
                    templateKey: 'dashboard',
                    name: {
                        _schema: '1',
                        _primary: 'en',
                        locales: {
                            en: { content: 'Catalog layout', version: 1, isActive: true }
                        }
                    },
                    description: null,
                    config: {},
                    isActive: true,
                    isDefault: false,
                    sortOrder: 0
                },
                'user-1'
            )
        ).rejects.toMatchObject({
            message: 'Catalog not found',
            statusCode: 404
        })
    })

    it('exposes inherited metadata for catalog layout widgets', async () => {
        const layoutId = 'catalog-layout-1'
        const baseLayoutId = 'global-layout-1'
        const baseWidgetId = 'base-widget-1'

        const baseWidgetRow = {
            id: baseWidgetId,
            layout_id: baseLayoutId,
            zone: 'left',
            widget_key: 'menuWidget',
            sort_order: 1,
            config: { title: 'Base menu' },
            is_active: true,
            _upl_created_at: '2026-04-06T00:00:00.000Z',
            _upl_updated_at: '2026-04-06T00:00:00.000Z'
        }

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (
                sql.includes('_mhb_layouts') &&
                (sql.includes('SELECT id, catalog_id, base_layout_id, config') || sql.includes('SELECT * FROM'))
            ) {
                return [
                    {
                        id: layoutId,
                        catalog_id: 'catalog-1',
                        base_layout_id: baseLayoutId,
                        config: {}
                    }
                ]
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets') && sql.includes('layout_id = $1')) {
                if (params?.[0] === baseLayoutId) {
                    return [baseWidgetRow]
                }

                if (params?.[0] === layoutId) {
                    return []
                }
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_catalog_widget_overrides') && sql.includes('catalog_layout_id = $1')) {
                return []
            }

            if (sql.includes('UPDATE') && sql.includes('_mhb_layouts') && sql.includes('config = $1')) {
                return []
            }

            throw new Error(`Unexpected SQL in inherited widget metadata test: ${sql}`)
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

        const widgets = await service.listLayoutZoneWidgets('metahub-1', layoutId, 'user-1')

        expect(widgets).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: baseWidgetId,
                    widgetKey: 'menuWidget',
                    isInherited: true,
                    config: { title: 'Base menu' }
                })
            ])
        )
    })

    it('rejects inherited catalog widget config edits', async () => {
        const layoutId = 'catalog-layout-1'
        const baseLayoutId = 'global-layout-1'
        const baseWidgetId = 'base-widget-1'

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (
                sql.includes('_mhb_layouts') &&
                (sql.includes('SELECT id, catalog_id, base_layout_id, config') || sql.includes('SELECT * FROM'))
            ) {
                return [
                    {
                        id: layoutId,
                        catalog_id: 'catalog-1',
                        base_layout_id: baseLayoutId,
                        config: {}
                    }
                ]
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets') && sql.includes('layout_id = $1')) {
                if (params?.[0] === baseLayoutId) {
                    return [
                        {
                            id: baseWidgetId,
                            layout_id: baseLayoutId,
                            zone: 'left',
                            widget_key: 'menuWidget',
                            sort_order: 1,
                            config: { title: 'Base menu' },
                            is_active: true,
                            _upl_created_at: '2026-04-06T00:00:00.000Z',
                            _upl_updated_at: '2026-04-06T00:00:00.000Z'
                        }
                    ]
                }

                if (params?.[0] === layoutId) {
                    return []
                }
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_catalog_widget_overrides') && sql.includes('catalog_layout_id = $1')) {
                return []
            }

            throw new Error(`Unexpected SQL in inherited config rejection test: ${sql}`)
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

        await expect(
            service.updateLayoutZoneWidgetConfig('metahub-1', layoutId, baseWidgetId, { title: 'Custom menu' }, 'user-1')
        ).rejects.toMatchObject({
            message: 'Inherited widgets inherit config from the base layout and cannot be edited.',
            statusCode: 400
        })
        expect(
            query.mock.calls.some(
                ([sql]) => String(sql).includes('UPDATE') && String(sql).includes('_mhb_catalog_widget_overrides')
            )
        ).toBe(false)
    })

    it('rejects removal of inherited catalog widgets', async () => {
        const layoutId = 'catalog-layout-1'
        const baseLayoutId = 'global-layout-1'
        const baseWidgetId = 'base-widget-1'

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (
                sql.includes('_mhb_layouts') &&
                (sql.includes('SELECT id, catalog_id, base_layout_id, config') || sql.includes('SELECT * FROM'))
            ) {
                return [
                    {
                        id: layoutId,
                        catalog_id: 'catalog-1',
                        base_layout_id: baseLayoutId,
                        config: {}
                    }
                ]
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets') && sql.includes('layout_id = $1')) {
                if (params?.[0] === baseLayoutId) {
                    return [
                        {
                            id: baseWidgetId,
                            layout_id: baseLayoutId,
                            zone: 'left',
                            widget_key: 'menuWidget',
                            sort_order: 1,
                            config: { title: 'Base menu' },
                            is_active: true,
                            _upl_created_at: '2026-04-06T00:00:00.000Z',
                            _upl_updated_at: '2026-04-06T00:00:00.000Z'
                        }
                    ]
                }

                if (params?.[0] === layoutId) {
                    return []
                }
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_catalog_widget_overrides') && sql.includes('catalog_layout_id = $1')) {
                return []
            }

            throw new Error(`Unexpected SQL in inherited removal rejection test: ${sql}`)
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

        await expect(service.removeLayoutZoneWidget('metahub-1', layoutId, baseWidgetId, 'user-1')).rejects.toMatchObject({
            message: 'Inherited widgets cannot be removed. Move or toggle the inherited widget instead.',
            statusCode: 400
        })
        expect(
            query.mock.calls.some(
                ([sql]) =>
                    String(sql).includes('UPDATE') &&
                    String(sql).includes('_mhb_widgets') &&
                    String(sql).includes('_mhb_deleted = true')
            )
        ).toBe(false)
    })

    it('blocks deletion of a global layout that is still referenced by catalog layouts', async () => {
        const layoutId = 'global-layout-1'

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_layouts') && sql.includes('FOR UPDATE')) {
                return [
                    {
                        id: layoutId,
                        catalog_id: null,
                        base_layout_id: null,
                        is_default: false,
                        is_active: true
                    }
                ]
            }

            if (sql.includes('SELECT id FROM') && sql.includes('base_layout_id = $1')) {
                expect(params).toEqual([layoutId])
                return [{ id: 'catalog-layout-1' }]
            }

            throw new Error(`Unexpected SQL in delete guard test: ${sql}`)
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

        await expect(service.deleteLayout('metahub-1', layoutId, 'user-1')).rejects.toMatchObject({
            message: 'Cannot delete a global layout that is used by catalog layouts',
            statusCode: 409
        })
    })
})
