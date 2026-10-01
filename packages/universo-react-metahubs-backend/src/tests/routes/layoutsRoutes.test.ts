import {
    request,
    mockEnsureMetahubAccess,
    mockEnsureSchema,
    mockGetLayoutById,
    mockDeleteLayout,
    mockUpdateLayoutZoneSetting,
    mockResetLayoutZoneSetting,
    layoutIdV7,
    baseLayoutIdV7,
    baseWidgetOneIdV7,
    baseWidgetTwoIdV7,
    createLayoutCopyTransactionTrx,
    findLayoutCopyQueryCalls,
    mockExec,
    buildApp,
    resetLayoutsRouteMocks
} from './layoutsRoutes.testSupport'

describe('Layouts Routes', () => {
    beforeEach(resetLayoutsRouteMocks)

    describe('zone setting routes', () => {
        it('updates a sparse zone setting through the dedicated controller', async () => {
            const app = buildApp()
            const response = await request(app)
                .patch(`/metahub/metahub-1/layout/${layoutIdV7}/zone-settings/marketing-header/position`)
                .send({ value: 'flow', expectedVersion: 4 })
                .expect(200)

            expect(response.body).toMatchObject({ item: { id: layoutIdV7, version: 5 } })
            expect(mockUpdateLayoutZoneSetting).toHaveBeenCalledWith(
                'metahub-1',
                layoutIdV7,
                'marketing-header',
                'position',
                'flow',
                'test-user-id',
                4
            )
        })

        it('resets a sparse zone setting through the dedicated controller', async () => {
            const app = buildApp()
            await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/zone-settings/marketing-header/position/reset`)
                .send({ expectedVersion: 5 })
                .expect(200)

            expect(mockResetLayoutZoneSetting).toHaveBeenCalledWith(
                'metahub-1',
                layoutIdV7,
                'marketing-header',
                'position',
                'test-user-id',
                5
            )
        })

        it('rejects reserved layout metadata in renderer mutation payloads', async () => {
            const app = buildApp()
            await request(app)
                .patch(`/metahub/metahub-1/layout/${layoutIdV7}`)
                .send({ config: { __layout: { composition: { mode: 'independent', baseLayoutId: null } } }, expectedVersion: 1 })
                .expect(400)

            expect(mockGetLayoutById).not.toHaveBeenCalled()
        })
    })

    describe('POST /metahub/:metahubId/layout/:layoutId/copy', () => {
        it('returns 403 when metahub does not exist (access denied)', async () => {
            const forbidden = Object.assign(new Error('Access denied to this metahub'), { status: 403 })
            mockEnsureMetahubAccess.mockRejectedValueOnce(forbidden)

            const app = buildApp()
            const response = await request(app)
                .post(`/metahub/missing/layout/${layoutIdV7}/copy`)
                .send({ name: { en: 'Copy' } })
                .expect(403)

            expect(response.body.error).toBe('Access denied to this metahub')
        })

        it('returns 403 when metahub access check fails', async () => {
            const forbidden = Object.assign(new Error('Access denied to this metahub'), { status: 403 })
            mockEnsureMetahubAccess.mockRejectedValueOnce(forbidden)

            const app = buildApp()
            const response = await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ name: { en: 'Copy' } })
                .expect(403)

            expect(response.body.error).toBe('Access denied to this metahub')
        })

        it('returns 400 for invalid copy payload', async () => {
            const app = buildApp()
            const response = await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ copyWidgets: 'yes' })
                .expect(400)

            expect(response.body.error).toBe('Invalid input')
        })

        it('returns 400 for a non-positive copy expectedVersion', async () => {
            const app = buildApp()
            const response = await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ expectedVersion: 0 })
                .expect(400)

            expect(response.body.error).toBe('Invalid input')
        })

        it('returns 400 for a non-v7 layout path before loading the layout', async () => {
            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/layout/550e8400-e29b-41d4-a716-446655440000/copy')
                .send({ name: { en: 'Copy' } })
                .expect(400)

            expect(response.body.error).toBe('Invalid layout ID')
            expect(mockGetLayoutById).not.toHaveBeenCalled()
        })

        it('returns 400 for a malformed layout path before loading the layout', async () => {
            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/layout/layout-1/copy')
                .send({ name: { en: 'Copy' } })
                .expect(400)

            expect(response.body.error).toBe('Invalid layout ID')
            expect(mockGetLayoutById).not.toHaveBeenCalled()
        })

        it('fails closed when the source layout contains application-only source zone settings', async () => {
            const trx = createLayoutCopyTransactionTrx({
                sourceLayout: {
                    id: layoutIdV7,
                    scope_entity_id: null,
                    base_layout_id: null,
                    template_key: 'marketing-page',
                    name: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: { en: { content: 'Marketing page' } }
                    },
                    description: null,
                    config: {
                        __layout: {
                            sourceZoneSettings: { 'marketing-header': { position: 'flow' } }
                        }
                    },
                    is_active: true,
                    is_default: false,
                    sort_order: 0,
                    _upl_version: 1
                }
            })
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const app = buildApp()
            const response = await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ copyWidgets: false, name: { en: 'Invalid copy' } })
                .expect(409)

            expect(response.body.error).toBe('Layout configuration metadata is invalid')
            expect(findLayoutCopyQueryCalls(trx, 'INSERT', '_mhb_layouts')).toHaveLength(0)
            expect(findLayoutCopyQueryCalls(trx, 'SELECT', '_mhb_widgets')).toHaveLength(0)
        })

        it('copies layout successfully without widgets when copyWidgets is disabled', async () => {
            const trx = createLayoutCopyTransactionTrx()
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const app = buildApp()
            const response = await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({
                    copyWidgets: false,
                    name: { en: 'Main dashboard (copy)' }
                })
                .expect(201)

            expect(mockEnsureSchema).toHaveBeenCalledWith('metahub-1', 'test-user-id')
            expect(response.body.id).toBe('layout-copy-id')
            expect(response.body.templateKey).toBe('dashboard')
            expect(response.body.isDefault).toBe(false)
            expect(findLayoutCopyQueryCalls(trx, 'SELECT', '_mhb_widgets')).toHaveLength(0)
            expect(findLayoutCopyQueryCalls(trx, 'INSERT', '_mhb_widgets')).toHaveLength(0)
            const insertParams = findLayoutCopyQueryCalls(trx, 'INSERT', '_mhb_layouts')[0]?.[1]
            const config = JSON.parse(insertParams?.[5] as string)
            expect(config.__skipDefaultZoneWidgetSeed).toBe(true)
        })

        it('rolls back a failed overlay copy after layout, widget, and override inserts', async () => {
            const trx = createLayoutCopyTransactionTrx({
                sourceLayout: {
                    id: layoutIdV7,
                    scope_entity_id: '0190a9b5-3cde-7abc-8def-0123456789c1',
                    base_layout_id: baseLayoutIdV7,
                    template_key: 'dashboard',
                    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Entity overlay' } } },
                    description: null,
                    config: {},
                    is_active: true,
                    is_default: false,
                    sort_order: 0,
                    _upl_version: 1
                },
                copiedLayout: {
                    id: 'layout-overlay-copy-id',
                    scope_entity_id: '0190a9b5-3cde-7abc-8def-0123456789c1',
                    base_layout_id: baseLayoutIdV7,
                    template_key: 'dashboard',
                    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Entity overlay (copy)' } } },
                    description: null,
                    config: {},
                    is_active: true,
                    is_default: false,
                    sort_order: 0,
                    _upl_version: 1
                },
                sourceWidgets: [
                    {
                        id: baseWidgetOneIdV7,
                        zone: 'left',
                        widget_key: 'menuWidget',
                        sort_order: 1,
                        config: {},
                        is_active: true
                    }
                ],
                sourceOverrides: [
                    {
                        base_widget_id: baseWidgetTwoIdV7,
                        zone: 'right',
                        sort_order: 2,
                        config: {},
                        is_active: true,
                        is_deleted_override: false
                    }
                ],
                baseWidgets: [
                    {
                        id: baseWidgetTwoIdV7,
                        zone: 'right',
                        widget_key: 'resourcePreview',
                        sort_order: 2,
                        config: {},
                        is_active: true
                    }
                ],
                overrideInsertReturnCount: 0
            })
            const persistedCopyState = { layouts: [] as unknown[][], widgets: [] as unknown[][], overrides: [] as unknown[][] }
            const query = trx.query
            trx.query = jest.fn(async (sql: string, queryParams?: unknown[]) => {
                const result = await query(sql, queryParams)
                const targetRows = sql.includes('_mhb_layout_widget_overrides')
                    ? persistedCopyState.overrides
                    : sql.includes('_mhb_widgets')
                    ? persistedCopyState.widgets
                    : sql.includes('_mhb_layouts')
                    ? persistedCopyState.layouts
                    : null
                if (targetRows && sql.includes('INSERT INTO')) targetRows.push(queryParams ?? [])
                return result
            })
            trx.transaction = jest.fn(async (callback: (transaction: unknown) => Promise<unknown>) => {
                const checkpoint = {
                    layouts: persistedCopyState.layouts.length,
                    widgets: persistedCopyState.widgets.length,
                    overrides: persistedCopyState.overrides.length
                }
                try {
                    return await callback(trx)
                } catch (error) {
                    persistedCopyState.layouts.length = checkpoint.layouts
                    persistedCopyState.widgets.length = checkpoint.widgets
                    persistedCopyState.overrides.length = checkpoint.overrides
                    throw error
                }
            })
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const app = buildApp()
            const response = await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ copyWidgets: true, name: { en: 'Main dashboard (copy)' } })
                .expect(500)

            expect(response.body.code).toBe('SCHEMA_SYNC_FAILED')
            expect(trx.transaction).toHaveBeenCalledTimes(1)
            expect(persistedCopyState).toEqual({ layouts: [], widgets: [], overrides: [] })
            expect(findLayoutCopyQueryCalls(trx, 'INSERT', '_mhb_layouts')).toHaveLength(1)
            expect(findLayoutCopyQueryCalls(trx, 'INSERT', '_mhb_widgets')).toHaveLength(1)
            expect(findLayoutCopyQueryCalls(trx, 'INSERT', '_mhb_layout_widget_overrides')).toHaveLength(1)
        })

        it('copies widgets as deactivated when deactivateAllWidgets is enabled', async () => {
            const trx = createLayoutCopyTransactionTrx({
                sourceWidgets: [
                    {
                        zone: 'left',
                        widget_key: 'menuWidget',
                        sort_order: 1,
                        config: {},
                        is_active: true
                    }
                ]
            })
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const app = buildApp()
            await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({
                    copyWidgets: true,
                    deactivateAllWidgets: true,
                    name: { en: 'Main dashboard (copy)' }
                })
                .expect(201)

            const widgetInsertParams = findLayoutCopyQueryCalls(trx, 'INSERT', '_mhb_widgets')[0]?.[1] as unknown[]
            // is_active is the 6th param per widget (index 5)
            expect(widgetInsertParams?.[5]).toBe(false)
        })

        it('copies scoped layout entity scope and inherited overrides when deactivating copied widgets', async () => {
            const trx = createLayoutCopyTransactionTrx({
                sourceLayout: {
                    id: layoutIdV7,
                    scope_entity_id: '0190a9b5-3cde-7abc-8def-0123456789c1',
                    base_layout_id: baseLayoutIdV7,
                    template_key: 'dashboard',
                    name: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: { en: { content: 'Entity dashboard' } }
                    },
                    description: null,
                    config: {
                        dashboardBehavior: {
                            showCreateButton: false,
                            searchMode: 'server'
                        }
                    },
                    is_active: true,
                    is_default: false,
                    sort_order: 0,
                    _upl_version: 1
                },
                copiedLayout: {
                    id: 'layout-copy-id',
                    scope_entity_id: '0190a9b5-3cde-7abc-8def-0123456789c1',
                    base_layout_id: baseLayoutIdV7,
                    template_key: 'dashboard',
                    name: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: {
                            en: { content: 'Entity dashboard (copy)' }
                        }
                    },
                    description: null,
                    config: {
                        dashboardBehavior: {
                            showCreateButton: false,
                            searchMode: 'server'
                        }
                    },
                    is_active: true,
                    is_default: false,
                    sort_order: 0,
                    _upl_version: 1,
                    _upl_created_at: '2026-02-26T00:00:00.000Z',
                    _upl_updated_at: '2026-02-26T00:00:00.000Z'
                },
                sourceWidgets: [
                    {
                        id: 'owned-widget-1',
                        zone: 'left',
                        widget_key: 'menuWidget',
                        sort_order: 1,
                        config: { title: 'Owned menu' },
                        is_active: true
                    }
                ],
                sourceOverrides: [
                    {
                        base_widget_id: baseWidgetOneIdV7,
                        zone: 'right',
                        sort_order: 2,
                        config: { title: 'Entity override' },
                        is_active: true,
                        is_deleted_override: false
                    }
                ],
                baseWidgets: [
                    { id: baseWidgetOneIdV7, widget_key: 'resourcePreview', zone: 'right', is_active: true },
                    { id: baseWidgetTwoIdV7, widget_key: 'detailsTable', zone: 'center', is_active: true }
                ]
            })
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const app = buildApp()
            const response = await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({
                    copyWidgets: true,
                    deactivateAllWidgets: true,
                    name: { en: 'Entity dashboard (copy)' }
                })
                .expect(201)

            expect(response.body.scopeEntityId).toBe('0190a9b5-3cde-7abc-8def-0123456789c1')
            expect(response.body.baseLayoutId).toBe(baseLayoutIdV7)

            const layoutInsertCall = (trx.query as jest.Mock).mock.calls.find(
                ([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('_mhb_layouts')
            )
            const layoutInsertParams = layoutInsertCall?.[1] as unknown[]
            expect(layoutInsertParams?.[0]).toBe('0190a9b5-3cde-7abc-8def-0123456789c1')
            expect(layoutInsertParams?.[1]).toBe(baseLayoutIdV7)

            const overrideInsertCall = (trx.query as jest.Mock).mock.calls.find(
                ([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('_mhb_layout_widget_overrides')
            )
            const overrideInsertParams = overrideInsertCall?.[1] as unknown[]
            expect(overrideInsertParams?.[0]).toBe('layout-copy-id')
            expect(overrideInsertParams?.[1]).toBe(baseWidgetOneIdV7)
            expect(overrideInsertParams?.[5]).toBe(false)
            expect(overrideInsertParams?.[6]).toBe(false)
            expect(overrideInsertParams?.[12]).toBe('layout-copy-id')
            expect(overrideInsertParams?.[13]).toBe(baseWidgetTwoIdV7)
            expect(overrideInsertParams?.[17]).toBe(false)
            expect(overrideInsertParams?.[18]).toBe(false)
            expect(overrideInsertParams?.[23]).toBe(true)
        })

        it('preserves an independent entity scope when the source has no base layout', async () => {
            const trx = createLayoutCopyTransactionTrx({
                sourceLayout: {
                    id: layoutIdV7,
                    scope_entity_id: '0190a9b5-3cde-7abc-8def-0123456789c1',
                    base_layout_id: null,
                    template_key: 'dashboard',
                    name: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: { en: { content: 'Entity dashboard' } }
                    },
                    description: null,
                    config: {},
                    is_active: true,
                    is_default: false,
                    sort_order: 0,
                    _upl_version: 1
                },
                copiedLayout: {
                    id: 'layout-copy-id',
                    scope_entity_id: '0190a9b5-3cde-7abc-8def-0123456789c1',
                    base_layout_id: null,
                    template_key: 'dashboard',
                    name: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: { en: { content: 'Entity dashboard (copy)' } }
                    },
                    description: null,
                    config: {},
                    is_active: true,
                    is_default: false,
                    sort_order: 0,
                    _upl_version: 1,
                    _upl_created_at: '2026-02-26T00:00:00.000Z',
                    _upl_updated_at: '2026-02-26T00:00:00.000Z'
                },
                sourceWidgets: [
                    {
                        zone: 'left',
                        widget_key: 'menuWidget',
                        sort_order: 1,
                        config: {},
                        is_active: true
                    }
                ]
            })
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const app = buildApp()
            const response = await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ copyWidgets: true, name: { en: 'Entity dashboard (copy)' } })
                .expect(201)

            expect(response.body.scopeEntityId).toBe('0190a9b5-3cde-7abc-8def-0123456789c1')
            expect(response.body.baseLayoutId).toBeNull()

            const layoutInsertParams = findLayoutCopyQueryCalls(trx, 'INSERT', '_mhb_layouts')[0]?.[1] as unknown[]
            expect(layoutInsertParams?.[0]).toBe('0190a9b5-3cde-7abc-8def-0123456789c1')
            expect(layoutInsertParams?.[1]).toBeNull()
        })
    })

    describe('DELETE /metahub/:metahubId/layout/:layoutId', () => {
        it('deletes layout successfully', async () => {
            const app = buildApp()

            await request(app).delete(`/metahub/metahub-1/layout/${layoutIdV7}`).query({ expectedVersion: 1 }).expect(204)

            expect(mockDeleteLayout).toHaveBeenCalledWith('metahub-1', layoutIdV7, 1, 'test-user-id')
        })

        it('returns 409 when service reports deletion conflict', async () => {
            mockDeleteLayout.mockRejectedValueOnce(
                Object.assign(new Error('At least one active layout is required'), {
                    statusCode: 409
                })
            )

            const app = buildApp()
            const response = await request(app).delete(`/metahub/metahub-1/layout/${layoutIdV7}`).query({ expectedVersion: 1 }).expect(409)

            expect(response.body.error).toBe('At least one active layout is required')
        })
    })

    describe('UUID v7 ingress guards', () => {
        it('rejects non-v7 scope and base identities before create service access', async () => {
            const app = buildApp()

            await request(app)
                .post('/metahub/metahub-1/layouts')
                .send({
                    scopeEntityId: 'scope-1',
                    baseLayoutId: 'base-1',
                    name: { en: 'Scoped layout' }
                })
                .expect(400)
        })

        it('rejects a non-v7 widget path before widget deletion', async () => {
            const app = buildApp()

            const response = await request(app)
                .delete(`/metahub/metahub-1/layout/${layoutIdV7}/zone-widget/widget-1`)
                .query({ expectedVersion: 1 })
                .expect(400)

            expect(response.body.error).toBe('Invalid widget ID')
        })

        it('rejects a non-v7 scope path before scope visibility mutation', async () => {
            const app = buildApp()

            const response = await request(app)
                .patch(`/metahub/metahub-1/layout/${layoutIdV7}/zone-widget/${layoutIdV7}/scope-visibility/scope-1`)
                .send({ isVisible: true, expectedVersion: 1 })
                .expect(400)

            expect(response.body.error).toBe('Invalid scope entity ID')
        })

        it('rejects a non-v7 widget identity in the move body before the service', async () => {
            const app = buildApp()

            const response = await request(app)
                .patch(`/metahub/metahub-1/layout/${layoutIdV7}/zone-widgets/move`)
                .send({ widgetId: 'widget-1', expectedVersion: 1 })
                .expect(400)

            expect(response.body.error).toBe('Invalid input')
        })
    })
})
