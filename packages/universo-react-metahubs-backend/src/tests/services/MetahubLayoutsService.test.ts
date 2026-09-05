import { LAYOUT_CONFIG_SKIP_DEFAULT_WIDGET_SEED_KEY, MetahubLayoutsService } from '../../domains/layouts/services/MetahubLayoutsService'

describe('MetahubLayoutsService', () => {
    it('reuses the active transaction runner for optimistic-lock layout updates', async () => {
        const tx = {
            query: jest.fn(async (sql: string, _params?: unknown[]) => {
                if (sql.includes('SELECT * FROM') && sql.includes('_mhb_layouts') && sql.includes('FOR UPDATE')) {
                    return [
                        {
                            id: 'layout-1',
                            scope_entity_id: null,
                            template_key: 'dashboard',
                            name: { en: 'Current layout' },
                            description: null,
                            config: {},
                            sort_order: 1,
                            is_active: true,
                            is_default: false,
                            _upl_version: 3,
                            _upl_created_at: '2026-04-04T00:00:00.000Z',
                            _upl_updated_at: '2026-04-04T00:00:00.000Z'
                        }
                    ]
                }

                if (sql.includes('UPDATE') && sql.includes('_mhb_layouts') && sql.includes('RETURNING *')) {
                    return [
                        {
                            id: 'layout-1',
                            scope_entity_id: null,
                            template_key: 'dashboard',
                            name: { en: 'Updated layout' },
                            description: null,
                            config: {},
                            sort_order: 1,
                            is_active: true,
                            is_default: false,
                            _upl_version: 4,
                            _upl_created_at: '2026-04-04T00:00:00.000Z',
                            _upl_updated_at: '2026-04-04T01:00:00.000Z'
                        }
                    ]
                }

                throw new Error(`Unexpected SQL in updateLayout regression test: ${sql}`)
            }),
            transaction: jest.fn(async () => {
                throw new Error('Nested transactions should not be opened from updateLayout optimistic locking')
            }),
            isReleased: () => false
        }

        const exec = {
            query: jest.fn(),
            transaction: jest.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx)),
            isReleased: () => false
        }
        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_1234567890abcdef1234567890abcdef_b1')
        } as unknown as ConstructorParameters<typeof MetahubLayoutsService>[1]
        const service = new MetahubLayoutsService(exec as any, schemaService)

        const result = await service.updateLayout(
            'metahub-1',
            'layout-1',
            {
                name: { en: 'Updated layout' },
                expectedVersion: 3
            },
            'user-1'
        )

        expect(result.id).toBe('layout-1')
        expect(tx.transaction).not.toHaveBeenCalled()
        expect(exec.transaction).toHaveBeenCalledTimes(1)
    })

    it('persists the requested marketing widget order instead of restoring a creation-time tie', async () => {
        const layoutId = 'marketing-layout-1'
        const layoutRow = {
            id: layoutId,
            scope_entity_id: null,
            base_layout_id: null,
            template_key: 'marketing-page',
            config: {}
        }
        const source = (entityCodename: string) => ({ entityCodename, entityKind: 'object' })
        const collectionConfig = (instanceKey: string, variant: string, entityCodename: string) => ({
            instanceKey,
            variant,
            source: source(entityCodename),
            maxItems: 24,
            showTitle: true,
            showDescription: true
        })
        const initialRows = [
            {
                id: 'hero-widget',
                layout_id: layoutId,
                zone: 'marketing-main',
                widget_key: 'marketing.hero',
                sort_order: 1,
                config: { instanceKey: 'hero', source: source('MarketingPageSiteSettings'), showLeadForm: true },
                is_active: true,
                _upl_version: 1,
                _upl_created_at: '2026-04-01T00:00:00.000Z',
                _upl_updated_at: '2026-04-01T00:00:00.000Z'
            },
            {
                id: 'logos-widget',
                layout_id: layoutId,
                zone: 'marketing-main',
                widget_key: 'marketing.collection',
                sort_order: 2,
                config: collectionConfig('logos', 'logos', 'MarketingPageLogo'),
                is_active: true,
                _upl_version: 1,
                _upl_created_at: '2026-04-01T00:00:01.000Z',
                _upl_updated_at: '2026-04-01T00:00:01.000Z'
            },
            {
                id: 'features-widget',
                layout_id: layoutId,
                zone: 'marketing-main',
                widget_key: 'marketing.collection',
                sort_order: 3,
                config: collectionConfig('features', 'features', 'MarketingPageFeature'),
                is_active: true,
                _upl_version: 1,
                _upl_created_at: '2026-04-01T00:00:02.000Z',
                _upl_updated_at: '2026-04-01T00:00:02.000Z'
            },
            {
                id: 'testimonials-widget',
                layout_id: layoutId,
                zone: 'marketing-main',
                widget_key: 'marketing.collection',
                sort_order: 4,
                config: collectionConfig('testimonials', 'testimonials', 'MarketingPageTestimonial'),
                is_active: true,
                _upl_version: 1,
                _upl_created_at: '2026-04-01T00:00:03.000Z',
                _upl_updated_at: '2026-04-01T00:00:03.000Z'
            },
            {
                id: 'highlights-widget',
                layout_id: layoutId,
                zone: 'marketing-main',
                widget_key: 'marketing.collection',
                sort_order: 5,
                config: collectionConfig('highlights', 'highlights', 'MarketingPageHighlight'),
                is_active: true,
                _upl_version: 1,
                _upl_created_at: '2026-04-01T00:00:04.000Z',
                _upl_updated_at: '2026-04-01T00:00:04.000Z'
            },
            {
                id: 'pricing-widget',
                layout_id: layoutId,
                zone: 'marketing-main',
                widget_key: 'marketing.pricing',
                sort_order: 6,
                config: {
                    instanceKey: 'pricing',
                    source: source('MarketingPagePricing'),
                    maxItems: 24,
                    showBenefits: true
                },
                is_active: true,
                _upl_version: 3,
                _upl_created_at: '2026-04-01T00:00:05.000Z',
                _upl_updated_at: '2026-04-01T00:00:05.000Z'
            },
            {
                id: 'faq-widget',
                layout_id: layoutId,
                zone: 'marketing-main',
                widget_key: 'marketing.collection',
                sort_order: 7,
                config: collectionConfig('faq', 'faq', 'MarketingPageFaq'),
                is_active: true,
                _upl_version: 1,
                _upl_created_at: '2026-04-01T00:00:06.000Z',
                _upl_updated_at: '2026-04-01T00:00:06.000Z'
            }
        ]
        let persistedRows = initialRows.map((row) => ({ ...row }))
        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('_mhb_layouts')) return [layoutRow]

            if (sql.includes('sort_order = sort_order +')) {
                const layoutParam = params?.[3]
                const zones = Array.isArray(params?.[4]) ? params?.[4] : []
                expect(layoutParam).toBe(layoutId)
                persistedRows = persistedRows.map((row) =>
                    row.layout_id === layoutId && zones.includes(row.zone)
                        ? { ...row, sort_order: row.sort_order + Number(params?.[0] ?? 0) }
                        : row
                )
                return []
            }

            if (sql.includes('WITH incoming') && sql.includes('RETURNING widget.id')) {
                const ids = Array.isArray(params?.[1]) ? params?.[1].map(String) : []
                const zones = Array.isArray(params?.[2]) ? params?.[2].map(String) : []
                const sortOrders = Array.isArray(params?.[3]) ? params?.[3].map(Number) : []
                persistedRows = persistedRows.map((row) => {
                    const index = ids.indexOf(row.id)
                    return index >= 0
                        ? { ...row, zone: zones[index], sort_order: sortOrders[index], _upl_version: (row._upl_version ?? 1) + 1 }
                        : row
                })
                return ids.map((id) => ({ id }))
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets') && sql.includes('ORDER BY zone ASC')) {
                return persistedRows.map((row) => ({ ...row }))
            }

            throw new Error(`Unexpected SQL in marketing reorder test: ${sql}`)
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
        const result = await service.moveLayoutZoneWidget(
            'metahub-1',
            layoutId,
            { widgetId: 'pricing-widget', targetZone: 'marketing-main', targetIndex: 4, expectedVersion: 3 },
            'user-1'
        )

        expect(
            result
                .filter((widget) => widget.zone === 'marketing-main')
                .sort((left, right) => left.sortOrder - right.sortOrder)
                .map((widget) => widget.instanceKey)
        ).toEqual(['hero', 'logos', 'features', 'testimonials', 'pricing', 'highlights', 'faq'])
        const finalUpdate = query.mock.calls.find(([sql]) => String(sql).includes('WITH incoming'))
        expect(finalUpdate?.[1]?.[3]).toEqual([1, 2, 3, 4, 5, 6, 7])
    })

    it('preserves authored runtime config keys when zone-widget sync rewrites layout widget flags', async () => {
        const layoutId = 'layout-1'
        const widgetId = 'widget-1'
        let persistedLayoutConfig: Record<string, unknown> | null = null

        const baseLayoutScopeRow = {
            id: layoutId,
            scope_entity_id: null,
            base_layout_id: null,
            template_key: 'dashboard',
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
            if (sql.includes('SELECT id, scope_entity_id, base_layout_id') && sql.includes('_mhb_layouts')) {
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
                            autoShowAllSections: true,
                            showTitle: true,
                            title: {
                                _schema: '1',
                                _primary: 'en',
                                locales: {
                                    en: { content: 'Objects', version: 1, isActive: true }
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
                return [{ id: layoutId }]
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
                            autoShowAllSections: true,
                            showTitle: true,
                            title: {
                                _schema: '1',
                                _primary: 'en',
                                locales: {
                                    en: { content: 'Objects', version: 1, isActive: true }
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
                    autoShowAllSections: true,
                    showTitle: true,
                    title: {
                        en: 'Objects',
                        ru: 'Каталоги'
                    }
                },
                expectedVersion: 1
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

    it('creates entity-scoped layouts against the active global base layout without seeding default widgets', async () => {
        const layoutId = 'object-layout-1'
        const scopeEntityId = 'object-1'
        const baseLayoutConfig = {
            showHeader: false,
            showFooter: true,
            showViewToggle: false,
            defaultViewMode: 'card',
            objectBehavior: {
                showCreateButton: false,
                searchMode: 'server'
            }
        }
        const createdRow = {
            id: layoutId,
            scope_entity_id: scopeEntityId,
            base_layout_id: 'global-layout-1',
            template_key: 'dashboard',
            name: {
                _schema: '1',
                _primary: 'en',
                locales: {
                    en: { content: 'Object layout', version: 1, isActive: true }
                }
            },
            description: null,
            config: {
                showViewToggle: true,
                defaultViewMode: 'card',
                objectBehavior: {
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
            if (sql.includes('_mhb_objects') && sql.includes('_mhb_entity_type_definitions')) {
                expect(params).toEqual([scopeEntityId])
                expect(sql).not.toContain('t.is_active')
                return [{ id: scopeEntityId, kind: 'object', capabilities: { layoutConfig: { enabled: true } } }]
            }

            if (sql.includes('scope_entity_id IS NULL') && sql.includes('is_active = true') && sql.includes('_mhb_layouts')) {
                return [
                    {
                        id: 'global-layout-1',
                        scope_entity_id: null,
                        base_layout_id: null,
                        template_key: 'dashboard',
                        config: baseLayoutConfig
                    }
                ]
            }

            if (sql.includes('INSERT INTO') && sql.includes('_mhb_layouts') && sql.includes('RETURNING *')) {
                expect(params?.[0]).toBe(scopeEntityId)
                expect(params?.[1]).toBe('global-layout-1')
                expect(JSON.parse(String(params?.[5] ?? '{}'))).toEqual({
                    showViewToggle: true,
                    defaultViewMode: 'card',
                    showHeader: true,
                    objectBehavior: {
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

            throw new Error(`Unexpected SQL in create scoped layout test: ${sql}`)
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
                scopeEntityId,
                templateKey: 'dashboard',
                name: {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'Object layout', version: 1, isActive: true }
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

        expect(created.scopeEntityId).toBe(scopeEntityId)
        expect(created.baseLayoutId).toBe('global-layout-1')
        expect(created.config).toEqual({
            showViewToggle: true,
            defaultViewMode: 'card',
            objectBehavior: {
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
            scope_entity_id: null,
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

        expect(created.scopeEntityId).toBeNull()
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

    it('rejects scoped layout creation when scopeEntityId points to an entity without layoutConfig support', async () => {
        const query = jest.fn(async (sql: string) => {
            if (sql.includes('_mhb_objects') && sql.includes('_mhb_entity_type_definitions')) {
                return [{ id: 'object-1', kind: 'set', capabilities: { layoutConfig: false } }]
            }

            throw new Error(`Unexpected SQL in scoped layout validation test: ${sql}`)
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
                    scopeEntityId: 'object-1',
                    templateKey: 'dashboard',
                    name: {
                        _schema: '1',
                        _primary: 'en',
                        locales: {
                            en: { content: 'Object layout', version: 1, isActive: true }
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
            message: 'Entity "set" does not support custom layouts',
            statusCode: 400
        })
    })

    it('ignores stale inherited widget overrides when the base sharedBehavior forbids them', async () => {
        const layoutId = 'object-layout-1'
        const baseLayoutId = 'global-layout-1'
        const baseWidgetId = 'base-widget-1'

        const baseWidgetRow = {
            id: baseWidgetId,
            layout_id: baseLayoutId,
            zone: 'left',
            widget_key: 'menuWidget',
            sort_order: 1,
            config: {
                title: 'Base menu',
                sharedBehavior: {
                    canDeactivate: false,
                    canExclude: false,
                    positionLocked: true
                }
            },
            is_active: true,
            _upl_created_at: '2026-04-06T00:00:00.000Z',
            _upl_updated_at: '2026-04-06T00:00:00.000Z'
        }

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (
                sql.includes('_mhb_layouts') &&
                (sql.includes('SELECT id, scope_entity_id, base_layout_id') || sql.includes('SELECT * FROM'))
            ) {
                return [
                    {
                        id: layoutId,
                        scope_entity_id: 'object-1',
                        base_layout_id: baseLayoutId,
                        template_key: 'dashboard',
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

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_layout_widget_overrides') && sql.includes('layout_id = $1')) {
                return [
                    {
                        id: 'override-1',
                        layout_id: layoutId,
                        base_widget_id: baseWidgetId,
                        zone: 'right',
                        sort_order: 9,
                        is_active: false,
                        is_deleted_override: true,
                        _upl_updated_at: '2026-04-06T01:00:00.000Z'
                    }
                ]
            }

            if (sql.includes('UPDATE') && sql.includes('_mhb_layouts') && sql.includes('config = $1')) {
                return [{ id: layoutId }]
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
                    zone: 'left',
                    sortOrder: 1,
                    isActive: true,
                    config: expect.objectContaining({ title: 'Base menu' })
                })
            ])
        )
    })

    it('rejects inherited object widget config edits', async () => {
        const layoutId = 'object-layout-1'
        const baseLayoutId = 'global-layout-1'
        const baseWidgetId = 'base-widget-1'

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (
                sql.includes('_mhb_layouts') &&
                (sql.includes('SELECT id, scope_entity_id, base_layout_id') || sql.includes('SELECT * FROM'))
            ) {
                return [
                    {
                        id: layoutId,
                        scope_entity_id: 'object-1',
                        base_layout_id: baseLayoutId,
                        template_key: 'dashboard',
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

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_layout_widget_overrides') && sql.includes('layout_id = $1')) {
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
            query.mock.calls.some(([sql]) => String(sql).includes('UPDATE') && String(sql).includes('_mhb_layout_widget_overrides'))
        ).toBe(false)
    })

    it('rejects inherited widget exclusion when the base layout disables it', async () => {
        const layoutId = 'object-layout-1'
        const baseLayoutId = 'global-layout-1'
        const baseWidgetId = 'base-widget-1'

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (
                sql.includes('_mhb_layouts') &&
                (sql.includes('SELECT id, scope_entity_id, base_layout_id') || sql.includes('SELECT * FROM'))
            ) {
                return [
                    {
                        id: layoutId,
                        scope_entity_id: 'object-1',
                        base_layout_id: baseLayoutId,
                        template_key: 'dashboard',
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
                            config: { title: 'Base menu', sharedBehavior: { canExclude: false } },
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

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_layout_widget_overrides') && sql.includes('layout_id = $1')) {
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
            message: 'Inherited widget exclusion is disabled by the base layout and cannot be changed.',
            statusCode: 400
        })
        expect(
            query.mock.calls.some(
                ([sql]) =>
                    String(sql).includes('UPDATE') && String(sql).includes('_mhb_widgets') && String(sql).includes('_mhb_deleted = true')
            )
        ).toBe(false)
    })

    it('stores inherited widget exclusion through object override rows when allowed', async () => {
        const layoutId = 'object-layout-1'
        const baseLayoutId = 'global-layout-1'
        const baseWidgetId = 'base-widget-1'
        const overrideRows: Array<Record<string, unknown>> = []

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (
                sql.includes('_mhb_layouts') &&
                (sql.includes('SELECT id, scope_entity_id, base_layout_id') || sql.includes('SELECT * FROM'))
            ) {
                return [
                    {
                        id: layoutId,
                        scope_entity_id: 'object-1',
                        base_layout_id: baseLayoutId,
                        template_key: 'dashboard',
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
                            config: { title: 'Base menu', sharedBehavior: { canExclude: true } },
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

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_layout_widget_overrides') && sql.includes('layout_id = $1')) {
                return overrideRows
            }

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_layout_widget_overrides') && sql.includes('base_widget_id = $2')) {
                return overrideRows.filter((row) => row.base_widget_id === params?.[1])
            }

            if (sql.includes('INSERT INTO') && sql.includes('_mhb_layout_widget_overrides')) {
                overrideRows.push({
                    id: 'override-1',
                    layout_id: params?.[0],
                    base_widget_id: params?.[1],
                    zone: params?.[2],
                    sort_order: params?.[3],
                    is_active: params?.[5],
                    is_deleted_override: params?.[6],
                    _upl_updated_at: params?.[7]
                })
                return []
            }

            if (sql.includes('UPDATE') && sql.includes('_mhb_layouts') && sql.includes('config = $1')) {
                return [{ id: 'page-layout-1' }]
            }

            throw new Error(`Unexpected SQL in inherited exclusion override test: ${sql}`)
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

        await service.removeLayoutZoneWidget('metahub-1', layoutId, baseWidgetId, 'user-1')

        expect(overrideRows).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    base_widget_id: baseWidgetId,
                    is_deleted_override: true
                })
            ])
        )
        expect(
            query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('_mhb_layout_widget_overrides'))
        ).toBe(true)
    })

    it('rejects inherited widget moves when the base layout locks position', async () => {
        const layoutId = 'object-layout-1'
        const baseLayoutId = 'global-layout-1'
        const baseWidgetId = 'base-widget-1'

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('SELECT id, scope_entity_id, base_layout_id') && sql.includes('_mhb_layouts')) {
                return [
                    {
                        id: layoutId,
                        scope_entity_id: 'object-1',
                        base_layout_id: baseLayoutId,
                        template_key: 'dashboard',
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
                            config: { title: 'Base menu', sharedBehavior: { positionLocked: true } },
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

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_layout_widget_overrides') && sql.includes('layout_id = $1')) {
                return []
            }

            throw new Error(`Unexpected SQL in inherited move rejection test: ${sql}`)
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
            service.moveLayoutZoneWidget('metahub-1', layoutId, { widgetId: baseWidgetId, targetZone: 'right', targetIndex: 0 }, 'user-1')
        ).rejects.toMatchObject({
            message: 'Inherited widget position is locked by the base layout and cannot be moved.',
            statusCode: 400
        })
    })

    it('rejects inherited widget activation changes when the base layout disables deactivation', async () => {
        const layoutId = 'object-layout-1'
        const baseLayoutId = 'global-layout-1'
        const baseWidgetId = 'base-widget-1'

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (
                sql.includes('_mhb_layouts') &&
                (sql.includes('SELECT id, scope_entity_id, base_layout_id') || sql.includes('SELECT * FROM'))
            ) {
                return [
                    {
                        id: layoutId,
                        scope_entity_id: 'object-1',
                        base_layout_id: baseLayoutId,
                        template_key: 'dashboard',
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
                            config: { title: 'Base menu', sharedBehavior: { canDeactivate: false } },
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

            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_layout_widget_overrides') && sql.includes('layout_id = $1')) {
                return []
            }

            throw new Error(`Unexpected SQL in inherited toggle rejection test: ${sql}`)
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

        await expect(service.toggleLayoutZoneWidgetActive('metahub-1', layoutId, baseWidgetId, false, 'user-1')).rejects.toMatchObject({
            message: 'Inherited widget activation is locked by the base layout and cannot be changed.',
            statusCode: 400
        })
    })

    it('blocks deletion of a global layout that is still referenced by scoped layouts', async () => {
        const layoutId = 'global-layout-1'

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_layouts') && sql.includes('FOR UPDATE')) {
                return [
                    {
                        id: layoutId,
                        scope_entity_id: null,
                        base_layout_id: null,
                        template_key: 'dashboard',
                        is_default: false,
                        is_active: true
                    }
                ]
            }

            if (sql.includes('SELECT id FROM') && sql.includes('base_layout_id = $1')) {
                expect(params).toEqual([layoutId])
                return [{ id: 'object-layout-1' }]
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

        await expect(service.deleteLayout('metahub-1', layoutId, 1, 'user-1')).rejects.toMatchObject({
            message: 'Cannot delete a global layout that is used by scoped layouts',
            statusCode: 409
        })
    })

    it('lists global widget visibility for every layout-capable entity scope', async () => {
        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (
                sql.includes('FROM') &&
                sql.includes('_mhb_layouts') &&
                sql.includes('_mhb_widgets') &&
                sql.includes('l.scope_entity_id IS NULL')
            ) {
                expect(params).toEqual(['global-layout-1', 'base-widget-1'])
                return [{ layout_id: 'global-layout-1', widget_id: 'base-widget-1', widget_is_active: true }]
            }

            if (sql.includes('_mhb_objects') && sql.includes('_mhb_entity_type_definitions')) {
                return [
                    {
                        id: 'object-1',
                        kind: 'object',
                        codename: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: { en: { content: 'Courses' }, ru: { content: 'Курсы' } }
                        },
                        presentation: {
                            name: {
                                _schema: 'v1',
                                _primary: 'en',
                                locales: { en: { content: 'Courses' }, ru: { content: 'Курсы' } }
                            }
                        },
                        capabilities: { layoutConfig: { enabled: true } }
                    },
                    {
                        id: 'set-1',
                        kind: 'set',
                        codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Settings' } } },
                        presentation: {},
                        capabilities: { layoutConfig: false }
                    },
                    {
                        id: 'page-1',
                        kind: 'page',
                        codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Home' } } },
                        presentation: {
                            name: {
                                _schema: 'v1',
                                _primary: 'en',
                                locales: { en: { content: 'Home' } }
                            }
                        },
                        capabilities: { layoutConfig: { enabled: true } }
                    }
                ]
            }

            if (sql.includes('FROM') && sql.includes('_mhb_layouts') && sql.includes('base_layout_id = $1')) {
                expect(params).toEqual(['global-layout-1', ['object-1', 'page-1']])
                return [
                    {
                        id: 'object-layout-1',
                        scope_entity_id: 'object-1',
                        name: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: { en: { content: 'Courses layout' } }
                        },
                        is_default: true,
                        is_active: true,
                        sort_order: 0
                    }
                ]
            }

            if (sql.includes('FROM') && sql.includes('_mhb_layout_widget_overrides') && sql.includes('base_widget_id = $1')) {
                expect(params).toEqual(['base-widget-1', ['object-layout-1']])
                return [{ layout_id: 'object-layout-1', is_active: false, is_deleted_override: false }]
            }

            throw new Error(`Unexpected SQL in scope visibility list test: ${sql}`)
        })

        const exec = { query, transaction: jest.fn(), isReleased: () => false }
        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        }

        const service = new MetahubLayoutsService(exec as never, schemaService as never)
        const result = await service.listLayoutWidgetScopeVisibility('metahub-1', 'global-layout-1', 'base-widget-1', 'user-1')

        expect(result).toEqual([
            expect.objectContaining({
                scopeEntityId: 'object-1',
                kind: 'object',
                layoutId: 'object-layout-1',
                isVisible: false,
                isOverridden: true
            }),
            expect.objectContaining({
                scopeEntityId: 'page-1',
                kind: 'page',
                layoutId: null,
                isVisible: true,
                isOverridden: false
            })
        ])
    })

    it('resets a scoped widget override only when the override version is current', async () => {
        const layoutScope = {
            id: 'scoped-layout',
            scope_entity_id: 'object-1',
            base_layout_id: 'global-layout',
            template_key: 'dashboard',
            config: {},
            version: 2
        }
        const baseWidget = {
            id: 'base-widget',
            layout_id: 'global-layout',
            zone: 'left',
            widget_key: 'menuWidget',
            sort_order: 1,
            config: {},
            is_active: true,
            _upl_version: 3,
            _upl_created_at: '2026-04-04T00:00:00.000Z',
            _upl_updated_at: '2026-04-04T00:00:00.000Z'
        }
        const override = {
            id: 'override-1',
            layout_id: 'scoped-layout',
            base_widget_id: 'base-widget',
            zone: 'right',
            sort_order: 1,
            config: {},
            is_active: true,
            is_deleted_override: false,
            _upl_version: 4,
            _upl_created_at: '2026-04-04T00:00:00.000Z',
            _upl_updated_at: '2026-04-04T00:00:00.000Z'
        }
        let overrideActive = true
        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('_mhb_layouts') && sql.includes('FOR UPDATE')) return [layoutScope]
            if (sql.includes('_mhb_widgets') && sql.includes('WHERE id = $1')) return [baseWidget]
            if (sql.includes('_mhb_layout_widget_overrides') && sql.includes('base_widget_id = $2')) return overrideActive ? [override] : []
            if (sql.includes('UPDATE') && sql.includes('_mhb_layout_widget_overrides')) {
                overrideActive = false
                return [{ id: 'override-1' }]
            }
            if (sql.includes('_mhb_widgets') && sql.includes('WHERE layout_id = $1')) {
                return params?.[0] === 'global-layout' ? [baseWidget] : []
            }
            if (sql.includes('_mhb_layout_widget_overrides') && sql.includes('WHERE layout_id = $1')) return []
            if (sql.includes('_mhb_layouts')) return [layoutScope]
            throw new Error(`Unexpected SQL in scoped override reset test: ${sql}`)
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

        await expect(service.resetLayoutZoneWidgetOverride('metahub-1', 'scoped-layout', 'base-widget', 'user-1', 3)).rejects.toThrow(
            'Layout widget was modified by another request'
        )

        await service.resetLayoutZoneWidgetOverride('metahub-1', 'scoped-layout', 'base-widget', 'user-1', 4)

        const resetMutation = query.mock.calls.find(
            ([sql]) => String(sql).includes('_mhb_layout_widget_overrides') && String(sql).includes('RETURNING id')
        )
        expect(resetMutation?.[0]).toContain('COALESCE(_upl_version, 1) = $4')
        expect(resetMutation?.[1]).toEqual([expect.any(Date), 'user-1', 'override-1', 4])

        expect(
            query.mock.calls.filter(([sql]) => String(sql).includes('UPDATE') && String(sql).includes('_mhb_layout_widget_overrides'))
        ).toHaveLength(1)
    })

    it('auto-creates a scoped layout when saving global widget visibility for a layout-capable scope', async () => {
        let insertedScopedLayout = false
        let insertedOverride = false

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('_mhb_objects') && sql.includes('_mhb_entity_type_definitions') && sql.includes('WHERE o.id = $1')) {
                expect(params).toEqual(['page-1'])
                return [{ id: 'page-1', kind: 'page', capabilities: { layoutConfig: { enabled: true } } }]
            }

            if (sql.includes('pg_advisory_xact_lock(hashtext($1))')) {
                expect(params).toEqual(['mhb-layout-scope:mhb_a1b2c3d4e5f67890abcdef1234567890_b1:global-layout-1:page-1'])
                return []
            }

            if (sql.includes('SELECT id, scope_entity_id, base_layout_id') && sql.includes('_mhb_layouts') && sql.includes('FOR UPDATE')) {
                if (sql.includes('scope_entity_id IS NULL')) {
                    return [
                        {
                            id: 'global-layout-1',
                            scope_entity_id: null,
                            base_layout_id: null,
                            template_key: 'dashboard',
                            config: { showDetailsTable: true }
                        }
                    ]
                }
                if (sql.includes('scope_entity_id = $1') && sql.includes('base_layout_id = $2')) {
                    return []
                }
            }

            if (sql.includes('SELECT *') && sql.includes('_mhb_widgets') && sql.includes('FOR UPDATE')) {
                expect(params).toEqual(['base-widget-1', 'global-layout-1'])
                return [
                    {
                        id: 'base-widget-1',
                        layout_id: 'global-layout-1',
                        zone: 'left',
                        widget_key: 'menuWidget',
                        is_active: true,
                        config: {}
                    }
                ]
            }

            if (sql.includes('SELECT presentation, codename') && sql.includes('_mhb_objects')) {
                expect(params).toEqual(['page-1'])
                return [
                    {
                        presentation: {
                            name: {
                                _schema: 'v1',
                                _primary: 'en',
                                locales: { en: { content: 'Home' }, ru: { content: 'Главная' } }
                            }
                        },
                        codename: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: { en: { content: 'Home' }, ru: { content: 'Главная' } }
                        }
                    }
                ]
            }

            if (sql.includes('INSERT INTO') && sql.includes('_mhb_layouts')) {
                insertedScopedLayout = true
                expect(params?.[0]).toBe('page-1')
                expect(params?.[1]).toBe('global-layout-1')
                return [
                    {
                        id: 'page-layout-1',
                        scope_entity_id: 'page-1',
                        base_layout_id: 'global-layout-1',
                        template_key: 'dashboard',
                        config: {}
                    }
                ]
            }

            if (sql.includes('SELECT *') && sql.includes('_mhb_layout_widget_overrides')) {
                return []
            }

            if (sql.includes('INSERT INTO') && sql.includes('_mhb_layout_widget_overrides')) {
                insertedOverride = true
                expect(params?.[0]).toBe('page-layout-1')
                expect(params?.[1]).toBe('base-widget-1')
                expect(params?.[5]).toBe(false)
                return []
            }

            if (sql.includes('SELECT id, scope_entity_id, base_layout_id') && sql.includes('_mhb_layouts')) {
                return [
                    {
                        id: 'page-layout-1',
                        scope_entity_id: 'page-1',
                        base_layout_id: 'global-layout-1',
                        template_key: 'dashboard',
                        config: {}
                    }
                ]
            }

            if (sql.includes('UPDATE') && sql.includes('_mhb_layouts') && sql.includes('config = $1')) {
                return [{ id: 'page-layout-1' }]
            }

            if (sql.includes('_mhb_layouts') && sql.includes('_mhb_widgets') && sql.includes('l.scope_entity_id IS NULL')) {
                return [{ layout_id: 'global-layout-1', widget_id: 'base-widget-1', widget_is_active: true }]
            }

            if (sql.includes('_mhb_objects') && sql.includes('_mhb_entity_type_definitions')) {
                return [
                    {
                        id: 'page-1',
                        kind: 'page',
                        codename: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: { en: { content: 'Home' } }
                        },
                        presentation: {
                            name: {
                                _schema: 'v1',
                                _primary: 'en',
                                locales: { en: { content: 'Home' } }
                            }
                        },
                        capabilities: { layoutConfig: { enabled: true } }
                    }
                ]
            }

            if (sql.includes('FROM') && sql.includes('_mhb_layouts') && sql.includes('base_layout_id = $1')) {
                return [{ id: 'page-layout-1', scope_entity_id: 'page-1', name: {}, is_default: true, is_active: true, sort_order: 0 }]
            }

            if (sql.includes('FROM') && sql.includes('_mhb_layout_widget_overrides') && sql.includes('base_widget_id = $1')) {
                return [{ layout_id: 'page-layout-1', is_active: false, is_deleted_override: false }]
            }

            throw new Error(`Unexpected SQL in scope visibility update test: ${sql}`)
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
        const result = await service.setLayoutWidgetScopeVisibility(
            'metahub-1',
            'global-layout-1',
            'base-widget-1',
            'page-1',
            false,
            'user-1'
        )

        expect(insertedScopedLayout).toBe(true)
        expect(insertedOverride).toBe(true)
        expect(result).toEqual([
            expect.objectContaining({
                scopeEntityId: 'page-1',
                layoutId: 'page-layout-1',
                isVisible: false,
                isOverridden: true
            })
        ])
    })

    it('reuses the same scoped layout on repeated resolution', async () => {
        const schemaName = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'
        const baseLayoutId = 'global-layout-1'
        const scopeEntityId = 'page-1'
        let persistedLayout: {
            id: string
            scope_entity_id: string
            base_layout_id: string
            template_key: string
            config: Record<string, unknown>
        } | null = null
        let insertCount = 0

        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock(hashtext($1))')) {
                expect(params).toEqual([`mhb-layout-scope:${schemaName}:${baseLayoutId}:${scopeEntityId}`])
                return []
            }

            if (sql.includes('scope_entity_id = $1') && sql.includes('base_layout_id = $2')) {
                expect(params).toEqual([scopeEntityId, baseLayoutId])
                return persistedLayout ? [persistedLayout] : []
            }

            if (sql.includes('SELECT presentation, codename')) {
                return [{ presentation: {}, codename: 'Home' }]
            }

            if (sql.includes('INSERT INTO') && sql.includes('_mhb_layouts')) {
                insertCount += 1
                persistedLayout = {
                    id: 'page-layout-1',
                    scope_entity_id: scopeEntityId,
                    base_layout_id: baseLayoutId,
                    template_key: 'dashboard',
                    config: {}
                }
                return [persistedLayout]
            }

            throw new Error(`Unexpected SQL in repeated scoped layout resolution test: ${sql}`)
        })

        const service = new MetahubLayoutsService({ query } as never, {} as never)
        const resolveScopedLayout = (
            service as unknown as {
                findOrCreateScopedLayout: (tx: unknown, schema: string, params: unknown) => Promise<{ id: string }>
            }
        ).findOrCreateScopedLayout.bind(service)
        const params = {
            baseLayout: {
                id: baseLayoutId,
                scope_entity_id: null,
                base_layout_id: null,
                template_key: 'dashboard',
                config: {}
            },
            baseLayoutId,
            scopeEntityId,
            userId: 'user-1'
        }

        const first = await resolveScopedLayout({ query }, schemaName, params)
        const second = await resolveScopedLayout({ query }, schemaName, params)

        expect(first.id).toBe('page-layout-1')
        expect(second.id).toBe(first.id)
        expect(insertCount).toBe(1)
        expect(query.mock.calls.filter(([sql]) => sql.includes('pg_advisory_xact_lock(hashtext($1))'))).toHaveLength(2)
    })

    it('serializes concurrent scoped resolution and creates no duplicate logical layout', async () => {
        const schemaName = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'
        const baseLayoutId = 'global-layout-1'
        const scopeEntityId = 'page-1'
        const lockTails = new Map<string, Promise<void>>()
        const queryCalls: Array<[string, unknown[] | undefined]> = []
        const persistedLayouts: Array<{
            id: string
            scope_entity_id: string
            base_layout_id: string
            template_key: string
            config: Record<string, unknown>
        }> = []
        let insertCount = 0

        const createTransaction = () => {
            const releases: Array<() => void> = []
            const query = jest.fn(async (sql: string, params?: unknown[]) => {
                queryCalls.push([sql, params])

                if (sql.includes('pg_advisory_xact_lock(hashtext($1))')) {
                    const lockKey = String(params?.[0])
                    const previous = lockTails.get(lockKey) ?? Promise.resolve()
                    let releaseCurrent = () => undefined
                    const current = new Promise<void>((resolve) => {
                        releaseCurrent = resolve
                    })
                    const tail = previous.then(() => current)
                    lockTails.set(lockKey, tail)
                    await previous
                    releases.push(() => {
                        releaseCurrent()
                        if (lockTails.get(lockKey) === tail) {
                            lockTails.delete(lockKey)
                        }
                    })
                    return []
                }

                if (sql.includes('scope_entity_id = $1') && sql.includes('base_layout_id = $2')) {
                    return persistedLayouts.slice(0, 1)
                }

                if (sql.includes('SELECT presentation, codename')) {
                    return [{ presentation: {}, codename: 'Home' }]
                }

                if (sql.includes('INSERT INTO') && sql.includes('_mhb_layouts')) {
                    insertCount += 1
                    const created = {
                        id: 'page-layout-1',
                        scope_entity_id: scopeEntityId,
                        base_layout_id: baseLayoutId,
                        template_key: 'dashboard',
                        config: {}
                    }
                    persistedLayouts.push(created)
                    return [created]
                }

                throw new Error(`Unexpected SQL in concurrent scoped layout resolution test: ${sql}`)
            })

            return {
                query,
                release: () => releases.forEach((release) => release())
            }
        }

        const exec = {
            query: jest.fn(),
            transaction: jest.fn(async (callback: (tx: { query: typeof query }) => Promise<unknown>) => {
                const transaction = createTransaction()
                try {
                    return await callback(transaction)
                } finally {
                    transaction.release()
                }
            }),
            isReleased: () => false
        }
        const service = new MetahubLayoutsService(exec as never, {} as never)
        const resolveScopedLayout = (
            service as unknown as {
                findOrCreateScopedLayout: (tx: unknown, schema: string, params: unknown) => Promise<{ id: string }>
            }
        ).findOrCreateScopedLayout.bind(service)
        const params = {
            baseLayout: {
                id: baseLayoutId,
                scope_entity_id: null,
                base_layout_id: null,
                template_key: 'dashboard',
                config: {}
            },
            baseLayoutId,
            scopeEntityId,
            userId: 'user-1'
        }

        const [first, second] = await Promise.all([
            exec.transaction((tx) => resolveScopedLayout(tx, schemaName, params)),
            exec.transaction((tx) => resolveScopedLayout(tx, schemaName, params))
        ])

        expect(first.id).toBe('page-layout-1')
        expect(second.id).toBe(first.id)
        expect(insertCount).toBe(1)
        expect(persistedLayouts).toHaveLength(1)
        expect(queryCalls.filter(([sql]) => sql.includes('pg_advisory_xact_lock(hashtext($1))'))).toHaveLength(2)
        expect(queryCalls[0]?.[0]).toContain('pg_advisory_xact_lock(hashtext($1))')
        expect(queryCalls[0]?.[1]).toEqual([`mhb-layout-scope:${schemaName}:${baseLayoutId}:${scopeEntityId}`])
    })
})
