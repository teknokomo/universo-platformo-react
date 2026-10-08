import {
    request,
    mockEnsureMetahubAccess,
    mockEnsureSchema,
    mockGetLayoutById,
    mockReadWidgetBindings,
    mockUpdateWidgetBinding,
    mockListWidgetBindingSources,
    mockListWidgetBindingRecords,
    mockDiscoverWidgetBindingSources,
    mockDiscoverWidgetBindingRecords,
    mockProvisionWidgetBindingSource,
    mockGetWidgetBindingUsage,
    mockMetahubLayoutsServiceConstructor,
    layoutIdV7,
    baseLayoutIdV7,
    baseWidgetOneIdV7,
    createLayoutCopyTransactionTrx,
    findLayoutCopyQueryCalls,
    mockExec,
    buildApp,
    resetLayoutsRouteMocks
} from './layoutsRoutes.testSupport'
import {
    buildSingleTargetWidgetBinding,
    decodeWidgetConfigEnvelope,
    encodeWidgetConfigEnvelope,
    LAYOUT_WIDGET_DEFINITIONS,
    layoutWidgetMetadataResponseSchema
} from '@universo-react/types'

describe('Marketing widget binding and authoring routes', () => {
    beforeEach(resetLayoutsRouteMocks)

    describe('Marketing widget source discovery routes', () => {
        it('supports Add discovery for Marketing placements without an existing widget', async () => {
            mockGetLayoutById.mockResolvedValueOnce({ id: layoutIdV7, templateKey: 'marketing-page' })
            const sourceResponse = await request(buildApp())
                .get(`/metahub/metahub-1/layout/${layoutIdV7}/widget-binding-sources/marketing.collection/items`)
                .query({ locale: 'ru', offset: 25, search: ' logos ', variant: 'logos' })
                .expect(200)

            expect(sourceResponse.body).toMatchObject({ widgetKey: 'marketing.collection', slot: 'items', sources: [] })
            expect(mockDiscoverWidgetBindingSources).toHaveBeenCalledWith(
                'metahub-1',
                layoutIdV7,
                {
                    widgetKey: 'marketing.collection',
                    slot: 'items',
                    variant: 'logos',
                    locale: 'ru',
                    offset: 25,
                    search: 'logos'
                },
                'test-user-id'
            )
            expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(expect.anything(), 'test-user-id', 'metahub-1', 'manageMetahub', undefined)
            expect(mockMetahubLayoutsServiceConstructor).toHaveBeenCalledWith(mockExec, expect.anything())

            mockGetLayoutById.mockResolvedValueOnce({ id: layoutIdV7, templateKey: 'marketing-page' })
            const recordResponse = await request(buildApp())
                .get(`/metahub/metahub-1/layout/${layoutIdV7}/widget-binding-records/marketing.hero/content`)
                .query({ sourceKey: 'MarketingPageHero', search: 'launch', selectedSemanticKey: 'hero-main' })
                .expect(200)
            expect(recordResponse.body).toMatchObject({
                widgetKey: 'marketing.hero',
                slot: 'content',
                selectedRecord: null,
                records: []
            })
            expect(mockDiscoverWidgetBindingRecords).toHaveBeenCalledWith(
                'metahub-1',
                layoutIdV7,
                {
                    widgetKey: 'marketing.hero',
                    slot: 'content',
                    variant: undefined,
                    sourceKey: 'MarketingPageHero',
                    locale: 'en',
                    offset: 0,
                    search: 'launch',
                    selectedSemanticKey: 'hero-main'
                },
                'test-user-id'
            )
            expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(expect.anything(), 'test-user-id', 'metahub-1', 'manageMetahub', undefined)
            expect(JSON.stringify(recordResponse.body)).not.toContain(baseWidgetOneIdV7)
            expect(JSON.stringify(recordResponse.body)).not.toContain('"_mhb_')
        })

        it('discovers Dashboard manual-menu sources and records without a placement ID', async () => {
            mockDiscoverWidgetBindingSources.mockResolvedValueOnce({
                widgetKey: 'menuWidget',
                slot: 'items',
                selectorKinds: ['record-set'],
                sources: [],
                nextOffset: null,
                truncated: false
            })
            const sources = await request(buildApp())
                .get(`/metahub/metahub-1/layout/${layoutIdV7}/widget-binding-sources/menuWidget/items`)
                .query({ variant: 'manual' })
                .expect(200)
            expect(sources.body).toMatchObject({ widgetKey: 'menuWidget', slot: 'items', sources: [] })
            expect(mockDiscoverWidgetBindingSources).toHaveBeenCalledWith(
                'metahub-1',
                layoutIdV7,
                {
                    widgetKey: 'menuWidget',
                    slot: 'items',
                    variant: 'manual',
                    locale: 'en',
                    offset: 0
                },
                'test-user-id'
            )

            mockDiscoverWidgetBindingRecords.mockResolvedValueOnce({
                widgetKey: 'menuWidget',
                slot: 'items',
                sourceKey: 'ManualDashboardMenu',
                records: [],
                selectedRecord: null,
                nextOffset: null,
                truncated: false
            })
            const records = await request(buildApp())
                .get(`/metahub/metahub-1/layout/${layoutIdV7}/widget-binding-records/menuWidget/items`)
                .query({ variant: 'manual', sourceKey: 'ManualDashboardMenu' })
                .expect(200)
            expect(records.body).toMatchObject({ widgetKey: 'menuWidget', slot: 'items', sourceKey: 'ManualDashboardMenu', records: [] })
            expect(mockDiscoverWidgetBindingRecords).toHaveBeenCalledWith(
                'metahub-1',
                layoutIdV7,
                {
                    widgetKey: 'menuWidget',
                    slot: 'items',
                    variant: 'manual',
                    sourceKey: 'ManualDashboardMenu',
                    locale: 'en',
                    offset: 0
                },
                'test-user-id'
            )
            expect(mockGetLayoutById).not.toHaveBeenCalled()
        })

        it('rejects unbounded search, malformed variants, and invalid selected keys before discovery', async () => {
            await request(buildApp())
                .get(`/metahub/metahub-1/layout/${layoutIdV7}/widget-binding-sources/marketing.collection/items`)
                .query({ search: 'x'.repeat(129), variant: 'logos' })
                .expect(400)
            await request(buildApp())
                .get(`/metahub/metahub-1/layout/${layoutIdV7}/widget-binding-sources/marketing.collection/items`)
                .query({ variant: 'not a valid variant' })
                .expect(400)
            await request(buildApp())
                .get(`/metahub/metahub-1/layout/${layoutIdV7}/widget-binding-records/marketing.hero/content`)
                .query({ sourceKey: 'MarketingPageHero', selectedSemanticKey: 'x'.repeat(129) })
                .expect(400)
            expect(mockDiscoverWidgetBindingSources).not.toHaveBeenCalled()
        })
    })

    describe('POST /metahub/:metahubId/layout/:layoutId/copy', () => {
        const createBoundHeroMarketingLayoutTrx = () => {
            const heroDefinition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')
            if (!heroDefinition) throw new Error('Expected marketing.hero to be registered')
            const heroInstanceKey = '0190a9b5-3cde-7abc-8def-0123456789d1'
            const heroBindings = buildSingleTargetWidgetBinding(heroDefinition, 'content', {
                entityKind: 'object',
                entityCodename: 'MarketingPageHero',
                semanticKey: 'hero-featured'
            })
            const widgetContext = { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
            const sourceWidgetConfig = encodeWidgetConfigEnvelope(
                { rendererConfig: {}, neutral: { bindings: heroBindings } },
                widgetContext
            )
            const trx = createLayoutCopyTransactionTrx({
                sourceLayout: {
                    id: layoutIdV7,
                    scope_entity_id: null,
                    base_layout_id: null,
                    template_key: 'marketing-page',
                    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Marketing page' } } },
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
                        zone: 'marketing-main',
                        widget_key: 'marketing.hero',
                        sort_order: 1,
                        config: sourceWidgetConfig,
                        is_active: true
                    }
                ]
            })
            return { trx, widgetContext, heroBindings, heroInstanceKey }
        }

        const createOverlayWithInheritedBoundHeroTrx = (
            includeSourceOverride = false,
            copyWidgetsRequested = true,
            ownershipRows: { scopeOwnerRow?: Record<string, unknown> | null; baseLayoutRow?: Record<string, unknown> | null } = {},
            sourceOverrideIsDeleted = false,
            sourceOverrideContainsBindings = false,
            includeDirectBoundWidget = false
        ) => {
            const heroDefinition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')
            if (!heroDefinition) throw new Error('Expected marketing.hero to be registered')
            const heroInstanceKey = '0190a9b5-3cde-7abc-8def-0123456789d2'
            const heroBindings = buildSingleTargetWidgetBinding(heroDefinition, 'content', {
                entityKind: 'object',
                entityCodename: 'MarketingPageHero',
                semanticKey: 'hero-inherited'
            })
            const widgetContext = { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
            const baseWidgetConfig = encodeWidgetConfigEnvelope({ rendererConfig: {}, neutral: { bindings: heroBindings } }, widgetContext)
            const sourceOverrideConfig = encodeWidgetConfigEnvelope(
                {
                    rendererConfig: {},
                    ...(sourceOverrideContainsBindings ? { neutral: { bindings: heroBindings } } : {})
                },
                widgetContext
            )
            const trx = createLayoutCopyTransactionTrx({
                sourceLayout: {
                    id: layoutIdV7,
                    scope_entity_id: '0190a9b5-3cde-7abc-8def-0123456789c1',
                    base_layout_id: baseLayoutIdV7,
                    template_key: 'marketing-page',
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
                    template_key: 'marketing-page',
                    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Entity overlay (copy)' } } },
                    description: null,
                    config: {},
                    is_active: true,
                    is_default: false,
                    sort_order: 0,
                    _upl_version: 1
                },
                sourceWidgets: includeDirectBoundWidget
                    ? [
                          {
                              id: '0190a9b5-3cde-7abc-8def-0123456789d3',
                              zone: 'marketing-main',
                              widget_key: 'marketing.hero',
                              sort_order: 1,
                              config: baseWidgetConfig,
                              is_active: true
                          }
                      ]
                    : [],
                copyWidgetsRequested,
                ...ownershipRows,
                sourceOverrides: includeSourceOverride
                    ? [
                          {
                              base_widget_id: baseWidgetOneIdV7,
                              zone: null,
                              sort_order: null,
                              config: sourceOverrideConfig,
                              is_active: true,
                              is_deleted_override: sourceOverrideIsDeleted
                          }
                      ]
                    : [],
                baseWidgets: [
                    {
                        id: baseWidgetOneIdV7,
                        widget_key: 'marketing.hero',
                        zone: 'marketing-main',
                        sort_order: 1,
                        config: baseWidgetConfig,
                        is_active: true
                    }
                ]
            })
            return { trx, widgetContext, heroBindings, heroInstanceKey }
        }

        it('omits a shell-owned language switcher when its registry copy policy forbids placement copying', async () => {
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
                    config: {},
                    is_active: true,
                    is_default: false,
                    sort_order: 0,
                    _upl_version: 1
                },
                copiedLayout: {
                    id: 'layout-copy-id',
                    scope_entity_id: null,
                    base_layout_id: null,
                    template_key: 'marketing-page',
                    name: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: { en: { content: 'Marketing page (copy)' } }
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
                        zone: 'marketing-header',
                        widget_key: 'languageSwitcher',
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
                .send({ copyWidgets: true, name: { en: 'Marketing page (copy)' } })
                .expect(201)

            expect(findLayoutCopyQueryCalls(trx, 'INSERT', '_mhb_widgets')).toHaveLength(0)
        })

        it('requires an explicit choice before copying an Entity-bound placement', async () => {
            const { trx } = createBoundHeroMarketingLayoutTrx()
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const app = buildApp()
            const response = await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ name: { en: 'Marketing page (copy)' } })
                .expect(409)

            expect(response.body.code).toBe('ENTITY_BINDING_COPY_MODE_REQUIRED')
            expect((trx.query as jest.Mock).mock.calls.some(([sql]) => /^\s*INSERT\b/iu.test(String(sql)))).toBe(false)
        })

        it('rejects a request that attempts to change the source layout owner during copy', async () => {
            const response = await request(buildApp())
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ scopeEntityId: '0190a9b5-3cde-7abc-8def-0123456789c1', name: { en: 'Cross-owner copy' } })
                .expect(400)

            expect(response.body.error).toBe('Invalid input')
            expect(mockEnsureSchema).not.toHaveBeenCalled()
        })

        it('rejects copying when the persisted scope owner no longer supports layouts', async () => {
            const { trx } = createOverlayWithInheritedBoundHeroTrx(false, true, { scopeOwnerRow: null })
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const response = await request(buildApp())
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ copyWidgets: true, entityBindingCopyMode: 'reuse', name: { en: 'Owner unavailable' } })
                .expect(409)

            expect(response.body.code).toBe('CONFLICT')
            expect((trx.query as jest.Mock).mock.calls.some(([sql]) => /^\s*INSERT\b/iu.test(String(sql)))).toBe(false)
        })

        it('rejects a scoped base ownership transition before copying its inherited bindings', async () => {
            const { trx } = createOverlayWithInheritedBoundHeroTrx(false, true, {
                baseLayoutRow: {
                    id: baseLayoutIdV7,
                    scope_entity_id: '0190a9b5-3cde-7abc-8def-0123456789c2',
                    base_layout_id: null,
                    template_key: 'marketing-page',
                    config: {
                        __layout: { composition: { mode: 'independent', baseLayoutId: null } }
                    }
                }
            })
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const response = await request(buildApp())
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ copyWidgets: true, entityBindingCopyMode: 'reuse', name: { en: 'Invalid base owner' } })
                .expect(409)

            expect(response.body.code).toBe('CONFLICT')
            expect((trx.query as jest.Mock).mock.calls.some(([sql]) => /^\s*INSERT\b/iu.test(String(sql)))).toBe(false)
        })

        it('requires an explicit choice when a scoped overlay inherits a bound placement from its base layout', async () => {
            const { trx } = createOverlayWithInheritedBoundHeroTrx()
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const response = await request(buildApp())
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ copyWidgets: true, name: { en: 'Entity overlay copy' } })
                .expect(409)

            expect(response.body.code).toBe('ENTITY_BINDING_COPY_MODE_REQUIRED')
            expect((trx.query as jest.Mock).mock.calls.some(([sql]) => /^\s*INSERT\b/iu.test(String(sql)))).toBe(false)
        })

        it('writes a tombstone when omitting a bound placement inherited by a scoped overlay copy', async () => {
            const { trx } = createOverlayWithInheritedBoundHeroTrx()
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            await request(buildApp())
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ copyWidgets: true, entityBindingCopyMode: 'omit', name: { en: 'Entity overlay without Hero' } })
                .expect(201)

            const overrideInsert = (trx.query as jest.Mock).mock.calls.find(
                ([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('_mhb_layout_widget_overrides')
            )
            expect(overrideInsert).toBeDefined()
            const insertedOverrideParams = overrideInsert?.[1] as unknown[] | undefined
            expect(insertedOverrideParams?.slice(0, 7)).toEqual(['layout-overlay-copy-id', baseWidgetOneIdV7, null, null, null, null, true])
        })

        it('requires a choice for a base binding even when an uncopied source override tombstones it', async () => {
            const { trx } = createOverlayWithInheritedBoundHeroTrx(true, false, {}, true)
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const response = await request(buildApp())
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ copyWidgets: false, name: { en: 'Entity overlay copy without local widgets' } })
                .expect(409)

            expect(response.body.code).toBe('ENTITY_BINDING_COPY_MODE_REQUIRED')
            expect((trx.query as jest.Mock).mock.calls.some(([sql]) => /^\s*INSERT\b/iu.test(String(sql)))).toBe(false)
        })

        it('writes a destination tombstone when overrides are not copied and omission is explicit', async () => {
            const { trx } = createOverlayWithInheritedBoundHeroTrx(true, false, {}, true)
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            await request(buildApp())
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({
                    copyWidgets: false,
                    entityBindingCopyMode: 'omit',
                    name: { en: 'Entity overlay without inherited Hero' }
                })
                .expect(201)

            expect(
                (trx.query as jest.Mock).mock.calls.some(
                    ([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('_mhb_widgets')
                )
            ).toBe(false)
            const overrideInsert = (trx.query as jest.Mock).mock.calls.find(
                ([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('_mhb_layout_widget_overrides')
            )
            expect(overrideInsert).toBeDefined()
            const insertedOverrideParams = overrideInsert?.[1] as unknown[] | undefined
            expect(insertedOverrideParams?.slice(0, 7)).toEqual(['layout-overlay-copy-id', baseWidgetOneIdV7, null, null, null, null, true])
        })

        it('rejects a Marketing overlay override that attempts to shadow inherited Entity bindings', async () => {
            const { trx } = createOverlayWithInheritedBoundHeroTrx(true, true, {}, false, true)
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const response = await request(buildApp())
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ copyWidgets: true, entityBindingCopyMode: 'reuse', name: { en: 'Forged overlay copy' } })
                .expect(409)

            expect(response.body.code).toBe('VALIDATION_ERROR')
            expect((trx.query as jest.Mock).mock.calls.some(([sql]) => /^\s*INSERT\b/iu.test(String(sql)))).toBe(false)
        })

        it('rejects reusing a direct bound widget row owned by a Marketing overlay', async () => {
            const { trx } = createOverlayWithInheritedBoundHeroTrx(false, true, {}, false, false, true)
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const response = await request(buildApp())
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ copyWidgets: true, entityBindingCopyMode: 'reuse', name: { en: 'Forged direct overlay binding' } })
                .expect(409)

            expect(response.body.code).toBe('VALIDATION_ERROR')
            expect((trx.query as jest.Mock).mock.calls.some(([sql]) => /^\s*INSERT\b/iu.test(String(sql)))).toBe(false)
        })

        it('rolls back an inherited binding tombstone copy when the override insert fails', async () => {
            const { trx } = createOverlayWithInheritedBoundHeroTrx()
            const persistedCopyState = { layouts: [] as unknown[][], overrides: [] as unknown[][] }
            const query = trx.query
            trx.query = jest.fn(async (sql: string, queryParams?: unknown[]) => {
                if (sql.includes('_mhb_layout_widget_overrides') && /^\s*INSERT\b/iu.test(sql)) {
                    await query(sql, queryParams)
                    return []
                }

                const result = await query(sql, queryParams)
                if (sql.includes('_mhb_layouts') && /^\s*INSERT\b/iu.test(sql)) {
                    persistedCopyState.layouts.push(queryParams ?? [])
                }
                return result
            })
            trx.transaction = jest.fn(async (callback: (transaction: unknown) => Promise<unknown>) => {
                const layoutCheckpoint = persistedCopyState.layouts.length
                const overrideCheckpoint = persistedCopyState.overrides.length
                try {
                    return await callback(trx)
                } catch (error) {
                    persistedCopyState.layouts.length = layoutCheckpoint
                    persistedCopyState.overrides.length = overrideCheckpoint
                    throw error
                }
            })
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const response = await request(buildApp())
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({
                    copyWidgets: true,
                    entityBindingCopyMode: 'omit',
                    name: { en: 'Entity overlay without Hero (copy)' }
                })
                .expect(500)

            expect(response.body.code).toBe('SCHEMA_SYNC_FAILED')
            expect(trx.transaction).toHaveBeenCalledTimes(1)
            expect(persistedCopyState).toEqual({ layouts: [], overrides: [] })
            expect(
                (trx.query as jest.Mock).mock.calls.some(
                    ([sql]) => String(sql).includes('_mhb_layout_widget_overrides') && /^\s*INSERT\b/iu.test(String(sql))
                )
            ).toBe(true)
        })

        it('copies a sparse override while the scoped overlay inherits its Entity binding from the base', async () => {
            const { trx, widgetContext } = createOverlayWithInheritedBoundHeroTrx(true)
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            await request(buildApp())
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ copyWidgets: true, entityBindingCopyMode: 'reuse', name: { en: 'Entity overlay reuse copy' } })
                .expect(201)

            const overrideInsert = (trx.query as jest.Mock).mock.calls.find(
                ([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('_mhb_layout_widget_overrides')
            )
            expect(overrideInsert).toBeDefined()
            const insertedOverrideParams = overrideInsert?.[1] as unknown[] | undefined
            expect(insertedOverrideParams?.slice(0, 2)).toEqual(['layout-overlay-copy-id', baseWidgetOneIdV7])
            expect(insertedOverrideParams?.[6]).toBe(false)

            const copiedOverrideConfig = JSON.parse(String(insertedOverrideParams?.[4])) as Record<string, unknown>
            const copiedOverride = decodeWidgetConfigEnvelope(copiedOverrideConfig, widgetContext)
            expect(copiedOverride.rendererConfig).not.toHaveProperty('instanceKey')
            expect(copiedOverride.neutral.bindings).toBeUndefined()
        })

        it('rejects generic copying for a Marketing binding whose registry policy requires record cloning', async () => {
            const { trx } = createBoundHeroMarketingLayoutTrx()
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const app = buildApp()
            const response = await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ name: { en: 'Marketing page (copy)' }, entityBindingCopyMode: 'reuse' })
                .expect(409)

            expect(response.body.code).toBe('VALIDATION_ERROR')
            expect(mockEnsureSchema).toHaveBeenCalledWith('metahub-1', 'test-user-id')
            expect((trx.query as jest.Mock).mock.calls.some(([sql]) => /^\s*INSERT\b/iu.test(String(sql)))).toBe(false)
        })

        it('rejects the obsolete Hero-only copy field before opening the database transaction', async () => {
            const app = buildApp()
            await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({
                    name: { en: 'Marketing page (copy)' },
                    heroBindingCopyMode: 'reuse'
                })
                .expect(400)

            expect(mockExec.transaction).not.toHaveBeenCalled()
        })

        it('omits Entity-bound placements when the copy choice requests it', async () => {
            const { trx } = createBoundHeroMarketingLayoutTrx()
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const app = buildApp()
            await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ name: { en: 'Marketing page (copy)' }, entityBindingCopyMode: 'omit' })
                .expect(201)

            expect(
                (trx.query as jest.Mock).mock.calls.some(
                    ([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('_mhb_widgets')
                )
            ).toBe(false)
        })

        it('rejects malformed widget binding metadata before writing the copied layout', async () => {
            const trx = createLayoutCopyTransactionTrx({
                sourceLayout: {
                    id: layoutIdV7,
                    scope_entity_id: null,
                    base_layout_id: null,
                    template_key: 'marketing-page',
                    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Marketing page' } } },
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
                        zone: 'marketing-main',
                        widget_key: 'marketing.hero',
                        sort_order: 1,
                        config: {
                            instanceKey: 'hero-source-instance',
                            __layout: {
                                bindings: {
                                    version: 1,
                                    slots: [
                                        {
                                            slot: 'content',
                                            targets: [
                                                {
                                                    entityKind: 'object',
                                                    entityCodename: 'MarketingPageHero',
                                                    selector: { kind: 'semantic-key', field: 'key', value: 'default' },
                                                    projection: []
                                                }
                                            ]
                                        }
                                    ]
                                }
                            }
                        },
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
                .send({ name: { en: 'Invalid Hero copy' } })
                .expect(409)

            expect(response.body.error).toBe('Layout widget configuration is invalid')
            expect((trx.query as jest.Mock).mock.calls.some(([sql]) => /^\s*INSERT\b/iu.test(String(sql)))).toBe(false)
        })
    })

    describe('GET /metahub/:metahubId/layout/:layoutId/zone-widgets/object', () => {
        it('returns 400 for a non-v7 layout path', async () => {
            const app = buildApp()

            const response = await request(app).get('/metahub/metahub-1/layout/layout-1/zone-widgets/object').expect(400)

            expect(response.body.error).toBe('Invalid layout ID')
        })

        it('returns the canonical widget and zone metadata for the layout editor', async () => {
            const app = buildApp()

            const response = await request(app).get(`/metahub/metahub-1/layout/${layoutIdV7}/zone-widgets/object`).expect(200)

            expect(layoutWidgetMetadataResponseSchema.safeParse(response.body).success).toBe(true)
            expect(response.body.items).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        key: 'marketing.hero',
                        templateKey: 'marketing-page',
                        supportedTemplates: ['marketing-page'],
                        allowedZonesByTemplate: { 'marketing-page': ['marketing-main'] },
                        requiredHostCapabilities: [],
                        shared: false,
                        labelKey: 'layouts.widgets.marketing.hero',
                        defaultLabel: 'Hero'
                    }),
                    expect.objectContaining({
                        key: 'marketing.collection',
                        templateKey: 'marketing-page',
                        supportedTemplates: ['marketing-page'],
                        allowedZonesByTemplate: { 'marketing-page': ['marketing-main'] },
                        requiredHostCapabilities: [],
                        shared: false,
                        labelKey: 'layouts.widgets.marketing.collection',
                        defaultLabel: 'Collection'
                    })
                ])
            )

            const marketingTemplate = response.body.templates.find((template: { key?: string }) => template.key === 'marketing-page')
            expect(marketingTemplate).toEqual(
                expect.objectContaining({
                    key: 'marketing-page',
                    zones: expect.arrayContaining([
                        expect.objectContaining({
                            key: 'marketing-header',
                            labelKey: 'layouts.zones.marketingHeader'
                        }),
                        expect.objectContaining({
                            key: 'marketing-main',
                            labelKey: 'layouts.zones.marketingMain'
                        }),
                        expect.objectContaining({
                            key: 'marketing-footer',
                            labelKey: 'layouts.zones.marketingFooter'
                        })
                    ])
                })
            )
            expect(marketingTemplate.widgets).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        key: 'languageSwitcher',
                        templateKey: 'dashboard',
                        supportedTemplates: ['dashboard', 'marketing-page'],
                        allowedZonesByTemplate: {
                            dashboard: ['top'],
                            'marketing-page': ['marketing-header']
                        },
                        shared: true
                    })
                ])
            )
            expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(expect.anything(), 'test-user-id', 'metahub-1', undefined, undefined)
        })
    })

    describe('Entity binding routes', () => {
        it('creates an empty compatible source model through the authorized marketing layout route', async () => {
            const response = await request(buildApp())
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/widget-binding-sources/marketing.hero/content`)
                .send({ locale: 'ru', templateSourceKey: 'MarketingPageHero', name: 'Alternative source' })
                .expect(201)

            expect(response.body.source).toMatchObject({ label: 'Alternative source', recordsCount: 0 })
            expect(mockProvisionWidgetBindingSource).toHaveBeenCalledWith(
                'metahub-1',
                layoutIdV7,
                {
                    locale: 'ru',
                    templateSourceKey: 'MarketingPageHero',
                    name: 'Alternative source',
                    widgetKey: 'marketing.hero',
                    slot: 'content'
                },
                'test-user-id'
            )
            expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(expect.anything(), 'test-user-id', 'metahub-1', 'manageMetahub', undefined)

            await request(buildApp())
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/widget-binding-sources/marketing.hero/content`)
                .send({ templateSourceKey: 'MarketingPageHero', name: '   ' })
                .expect(400)
            expect(mockProvisionWidgetBindingSource).toHaveBeenCalledTimes(1)
        })

        it('lists compatible sources and semantic records for a widget slot', async () => {
            const sourceResponse = await request(buildApp())
                .get(`/metahub/metahub-1/layout/${layoutIdV7}/widget-binding-sources/marketing.hero/content`)
                .query({ widgetId: baseWidgetOneIdV7, locale: 'ru', offset: 20, search: 'launch' })
                .expect(200)
            expect(sourceResponse.body).toMatchObject({ widgetKey: 'marketing.hero', slot: 'content', sources: [] })
            expect(mockListWidgetBindingSources).toHaveBeenCalledWith(
                'metahub-1',
                layoutIdV7,
                baseWidgetOneIdV7,
                {
                    widgetKey: 'marketing.hero',
                    slot: 'content',
                    variant: undefined,
                    locale: 'ru',
                    offset: 20,
                    search: 'launch',
                    parentSourceKey: undefined,
                    selectedSourceKey: undefined
                },
                'test-user-id'
            )
            await request(buildApp())
                .get(`/metahub/metahub-1/layout/${layoutIdV7}/widget-binding-sources/marketing.hero/content`)
                .query({ widgetId: 'not-a-uuid' })
                .expect(400)

            const recordsResponse = await request(buildApp())
                .get(`/metahub/metahub-1/layout/${layoutIdV7}/zone-widget/${baseWidgetOneIdV7}/binding-records/content`)
                .query({ sourceKey: 'MarketingPageHero', locale: 'ru', offset: 0, search: 'Product', selectedSemanticKey: 'hero-main' })
                .expect(200)
            expect(recordsResponse.body).toMatchObject({
                widgetKey: 'marketing.hero',
                slot: 'content',
                sourceKey: 'MarketingPageHero',
                records: []
            })
            expect(mockListWidgetBindingRecords).toHaveBeenCalledWith(
                'metahub-1',
                layoutIdV7,
                baseWidgetOneIdV7,
                {
                    slot: 'content',
                    sourceKey: 'MarketingPageHero',
                    variant: undefined,
                    locale: 'ru',
                    offset: 0,
                    search: 'Product',
                    selectedSemanticKey: 'hero-main'
                },
                'test-user-id'
            )
            expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(expect.anything(), 'test-user-id', 'metahub-1', 'manageMetahub', undefined)
        })

        it('returns localized binding summaries without exposing record identifiers', async () => {
            mockReadWidgetBindings.mockResolvedValueOnce({
                widgetKey: 'marketing.hero',
                version: 4,
                bindings: [
                    {
                        slot: 'content',
                        sourceKey: 'MarketingPageHero',
                        sourceName: 'Marketing Hero',
                        selectorKind: 'semantic-key',
                        selectionLabel: 'Product Hero'
                    }
                ]
            })
            const response = await request(buildApp())
                .get(`/metahub/metahub-1/layout/${layoutIdV7}/zone-widget/${baseWidgetOneIdV7}/binding`)
                .query({ locale: 'ru' })
                .expect(200)
            expect(response.body.bindings[0]).toMatchObject({ slot: 'content', selectionLabel: 'Product Hero' })
            expect(response.body).not.toHaveProperty('recordId')
            expect(response.body.bindings[0]).not.toHaveProperty('recordId')
            expect(mockReadWidgetBindings).toHaveBeenCalledWith('metahub-1', layoutIdV7, baseWidgetOneIdV7, 'ru', 'test-user-id')
            expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(expect.anything(), 'test-user-id', 'metahub-1', 'editContent', undefined)
        })

        it('reports whether a semantic target is used by another placement', async () => {
            const response = await request(buildApp())
                .get(`/metahub/metahub-1/layout/${layoutIdV7}/widget-binding-usage`)
                .query({ widgetId: baseWidgetOneIdV7, slot: 'content', sourceKey: 'MarketingPageHero', semanticKey: 'hero-featured' })
                .expect(200)
            expect(response.body).toEqual({ inUse: true })
            expect(mockGetWidgetBindingUsage).toHaveBeenCalledWith(
                'metahub-1',
                layoutIdV7,
                { widgetId: baseWidgetOneIdV7, slot: 'content', sourceKey: 'MarketingPageHero', semanticKey: 'hero-featured' },
                'test-user-id'
            )
        })

        it('rejects repeated semantic target query parameters instead of broadening the usage scan', async () => {
            await request(buildApp())
                .get(
                    `/metahub/metahub-1/layout/${layoutIdV7}/widget-binding-usage?widgetId=${baseWidgetOneIdV7}&slot=content&sourceKey=MarketingPageHero&semanticKey=hero-one&semanticKey=hero-two`
                )
                .expect(400)

            expect(mockGetWidgetBindingUsage).not.toHaveBeenCalled()
        })

        it('validates complete binding replacement and passes optimistic version to the service', async () => {
            const body = {
                bindings: [
                    {
                        slot: 'content',
                        sourceKey: 'MarketingPageHero',
                        selector: { kind: 'semantic-key', value: 'hero-featured' }
                    }
                ],
                expectedVersion: 3,
                locale: 'ru'
            }
            const response = await request(buildApp())
                .patch(`/metahub/metahub-1/layout/${layoutIdV7}/zone-widget/${baseWidgetOneIdV7}/binding`)
                .send(body)
                .expect(200)
            expect(response.body).toEqual({ widgetKey: 'marketing.hero', version: 5 })
            expect(mockUpdateWidgetBinding).toHaveBeenCalledWith('metahub-1', layoutIdV7, baseWidgetOneIdV7, body, 'test-user-id')
            expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(expect.anything(), 'test-user-id', 'metahub-1', 'manageMetahub', undefined)

            await request(buildApp())
                .patch(`/metahub/metahub-1/layout/${layoutIdV7}/zone-widget/${baseWidgetOneIdV7}/binding`)
                .send({ bindings: [{ slot: 'content', sourceKey: 'MarketingPageHero', selector: { kind: 'semantic-key', value: 'x' } }] })
                .expect(400)
        })
    })
})
