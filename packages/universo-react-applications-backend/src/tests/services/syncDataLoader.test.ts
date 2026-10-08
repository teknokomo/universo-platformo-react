import { loadApplicationRuntimeLayouts } from '../../routes/sync/syncDataLoader'
import {
    buildSingleTargetWidgetBinding,
    decodeLayoutWidgetConfigEnvelope,
    encodeLayoutWidgetConfigEnvelope,
    LAYOUT_WIDGET_DEFINITIONS
} from '@universo-react/types'

const ids = {
    globalLayout: '019f3100-0000-7000-8000-000000000001',
    scopedLayout: '019f3100-0000-7000-8000-000000000002',
    scopeEntity: '019f3100-0000-7000-8000-000000000010',
    globalWidget: '019f3100-0000-7000-8000-000000000020',
    sourceWidget: '019f3100-0000-7000-8000-000000000021',
    scopedWidget: '019f3100-0000-7000-8000-000000000030',
    authGlobalWidget: '019f3100-0000-7000-8000-000000000022',
    authSourceWidget: '019f3100-0000-7000-8000-000000000023',
    authScopedWidget: '019f3100-0000-7000-8000-000000000031'
}

const globalLayout = {
    id: ids.globalLayout,
    scope_entity_id: null,
    template_key: 'dashboard',
    name: { en: 'Dashboard' },
    description: null,
    config: { __layout: { composition: { mode: 'independent', baseLayoutId: null } } },
    is_active: true,
    is_default: true,
    sort_order: 0
}

const scopedLayout = {
    id: ids.scopedLayout,
    scope_entity_id: ids.scopeEntity,
    template_key: 'dashboard',
    name: { en: 'Products' },
    description: null,
    config: { __layout: { composition: { mode: 'overlay', baseLayoutId: ids.globalLayout } } },
    is_active: true,
    is_default: true,
    sort_order: 0
}

const createExecutor = (options: { rejectWidgets?: boolean; layouts?: unknown[]; widgets?: unknown[] } = {}) => ({
    query: jest.fn(async (sql: string) => {
        if (sql.includes('._app_layouts')) return options.layouts ?? [globalLayout, scopedLayout]
        if (sql.includes('._app_widgets')) {
            if (options.rejectWidgets) throw new Error('widgets query failed')
            const rows = (options.widgets ?? [
                {
                    id: ids.globalWidget,
                    layout_id: ids.globalLayout,
                    zone: 'top',
                    widget_key: 'header',
                    sort_order: 0,
                    config: {},
                    is_active: true,
                    source_widget_id: ids.sourceWidget,
                    source_base_widget_id: null
                },
                {
                    id: ids.scopedWidget,
                    layout_id: ids.scopedLayout,
                    zone: 'top',
                    widget_key: 'header',
                    sort_order: 1,
                    config: {},
                    is_active: true,
                    source_widget_id: ids.sourceWidget,
                    source_base_widget_id: ids.sourceWidget
                }
            ]) as Array<Record<string, unknown>>
            return rows.map((row) => ({
                instance_key: Object.prototype.hasOwnProperty.call(row, 'instance_key') ? row.instance_key : row.widget_key,
                parent_widget_id: Object.prototype.hasOwnProperty.call(row, 'parent_widget_id') ? row.parent_widget_id : null,
                slot_key: Object.prototype.hasOwnProperty.call(row, 'slot_key') ? row.slot_key : null,
                ...row
            }))
        }
        return []
    })
})

describe('loadApplicationRuntimeLayouts', () => {
    it('exports canonical global/scoped composition and sparse widget overrides', async () => {
        const result = await loadApplicationRuntimeLayouts(createExecutor() as never, 'app_019f3100000070008000000000000001')

        expect(result.layouts).toEqual([
            expect.objectContaining({
                id: ids.globalLayout,
                compositionMode: 'independent',
                baseLayoutId: null,
                config: {}
            })
        ])
        expect(result.scopedLayouts).toEqual([
            expect.objectContaining({
                id: ids.scopedLayout,
                scopeEntityId: ids.scopeEntity,
                compositionMode: 'overlay',
                baseLayoutId: ids.globalLayout,
                config: {}
            })
        ])
        expect(result.layoutZoneWidgets).toEqual([
            expect.objectContaining({
                id: ids.globalWidget,
                layoutId: ids.globalLayout,
                instanceKey: 'header',
                parentWidgetId: null,
                slotKey: null,
                widgetKey: 'header',
                config: expect.not.objectContaining({ instanceKey: expect.anything() })
            })
        ])
        expect(result.layoutWidgetOverrides).toEqual([
            expect.objectContaining({
                id: ids.scopedWidget,
                layoutId: ids.scopedLayout,
                baseWidgetId: ids.globalWidget,
                instanceKey: 'header',
                parentWidgetId: null,
                slotKey: null,
                isDeletedOverride: false
            })
        ])
        expect(result.layoutConfig).toEqual({})
    })

    it('fails closed when the widget query cannot be completed', async () => {
        await expect(
            loadApplicationRuntimeLayouts(createExecutor({ rejectWidgets: true }) as never, 'app_019f3100000070008000000000000001')
        ).rejects.toThrow('widgets query failed')
    })

    it('fails closed when persisted composition metadata is missing', async () => {
        const executor = createExecutor()
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('._app_layouts')) return [{ ...globalLayout, config: {} }]
            return []
        })

        await expect(loadApplicationRuntimeLayouts(executor as never, 'app_019f3100000070008000000000000001')).rejects.toThrow(
            'missing canonical composition metadata'
        )
    })

    it('exports Marketing overlay renderer and placement deltas without inherited bindings', async () => {
        const heroDefinition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')
        if (!heroDefinition) throw new Error('Expected marketing.hero to be registered')
        const binding = buildSingleTargetWidgetBinding(heroDefinition, 'content', {
            entityKind: 'object',
            entityCodename: 'MarketingPageHero',
            semanticKey: 'hero-default'
        })
        const widgetContext = { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' } as const
        const globalConfig = encodeLayoutWidgetConfigEnvelope(
            { rendererConfig: { showLeadForm: true }, neutral: { bindings: binding } },
            widgetContext
        )
        const overlayConfig = encodeLayoutWidgetConfigEnvelope({ rendererConfig: { showLeadForm: false } }, widgetContext)
        const authContext = { templateKey: 'marketing-page', widgetKey: 'marketing.auth', zone: 'marketing-header' } as const
        const baseAuthConfig = encodeLayoutWidgetConfigEnvelope(
            { rendererConfig: { showAuthActions: true }, neutral: { placement: 'end' } },
            authContext
        )
        const overlayAuthConfig = encodeLayoutWidgetConfigEnvelope(
            { rendererConfig: { showAuthActions: false }, neutral: { placement: 'start' } },
            authContext
        )
        const globalMarketingLayout = {
            ...globalLayout,
            template_key: 'marketing-page',
            config: { __layout: { composition: { mode: 'independent', baseLayoutId: null } } }
        }
        const scopedMarketingLayout = {
            ...scopedLayout,
            template_key: 'marketing-page',
            config: { __layout: { composition: { mode: 'overlay', baseLayoutId: ids.globalLayout } } }
        }

        const result = await loadApplicationRuntimeLayouts(
            createExecutor({
                layouts: [globalMarketingLayout, scopedMarketingLayout],
                widgets: [
                    {
                        id: ids.globalWidget,
                        layout_id: ids.globalLayout,
                        zone: 'marketing-main',
                        widget_key: 'marketing.hero',
                        sort_order: 0,
                        config: { showLeadForm: true },
                        instance_key: 'hero',
                        source_config: globalConfig,
                        is_active: true,
                        source_widget_id: ids.sourceWidget,
                        source_base_widget_id: null
                    },
                    {
                        id: ids.scopedWidget,
                        layout_id: ids.scopedLayout,
                        instance_key: 'hero',
                        zone: 'marketing-main',
                        widget_key: 'marketing.hero',
                        sort_order: 0,
                        config: overlayConfig,
                        source_config: overlayConfig,
                        is_active: true,
                        source_widget_id: ids.sourceWidget,
                        source_base_widget_id: ids.sourceWidget
                    },
                    {
                        id: ids.authGlobalWidget,
                        layout_id: ids.globalLayout,
                        zone: 'marketing-header',
                        widget_key: 'marketing.auth',
                        sort_order: 1,
                        config: baseAuthConfig,
                        is_active: true,
                        source_widget_id: ids.authSourceWidget,
                        source_base_widget_id: null
                    },
                    {
                        id: ids.authScopedWidget,
                        layout_id: ids.scopedLayout,
                        zone: 'marketing-header',
                        widget_key: 'marketing.auth',
                        sort_order: 1,
                        config: overlayAuthConfig,
                        is_active: true,
                        source_widget_id: ids.authSourceWidget,
                        source_base_widget_id: ids.authSourceWidget
                    }
                ]
            }) as never,
            'app_019f3100000070008000000000000001'
        )
        const heroOverride = result.layoutWidgetOverrides?.find(({ baseWidgetId }) => baseWidgetId === ids.globalWidget)
        const decodedHeroOverride = decodeLayoutWidgetConfigEnvelope(heroOverride?.config, { ...widgetContext, requireBindings: false })
        const authOverride = result.layoutWidgetOverrides?.find(({ baseWidgetId }) => baseWidgetId === ids.authGlobalWidget)
        const decodedAuthOverride = decodeLayoutWidgetConfigEnvelope(authOverride?.config, { ...authContext, requireBindings: false })
        const decodedBaseHero = decodeLayoutWidgetConfigEnvelope(
            result.layoutZoneWidgets?.find(({ id }) => id === ids.globalWidget)?.config,
            widgetContext
        )

        expect(result.layoutWidgetOverrides).toHaveLength(2)
        expect(heroOverride).toMatchObject({ baseWidgetId: ids.globalWidget, zone: 'marketing-main' })
        expect(decodedHeroOverride.rendererConfig).toEqual({ showLeadForm: false })
        expect(decodedHeroOverride.neutral.bindings).toBeUndefined()
        expect(decodedBaseHero.neutral.bindings).toEqual(binding)
        expect(authOverride).toMatchObject({ baseWidgetId: ids.authGlobalWidget, zone: 'marketing-header' })
        expect(decodedAuthOverride.rendererConfig).toEqual({ showAuthActions: false })
        expect(decodedAuthOverride.neutral).toEqual({ placement: 'start' })
    })

    it('rejects bindings persisted inside a Marketing overlay widget config', async () => {
        const heroDefinition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')
        if (!heroDefinition) throw new Error('Expected marketing.hero to be registered')
        const binding = buildSingleTargetWidgetBinding(heroDefinition, 'content', {
            entityKind: 'object',
            entityCodename: 'MarketingPageHero',
            semanticKey: 'hero-default'
        })
        const widgetConfig = encodeLayoutWidgetConfigEnvelope(
            { rendererConfig: {}, neutral: { bindings: binding } },
            { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
        )

        await expect(
            loadApplicationRuntimeLayouts(
                createExecutor({
                    layouts: [
                        {
                            ...globalLayout,
                            template_key: 'marketing-page',
                            config: { __layout: { composition: { mode: 'independent', baseLayoutId: null } } }
                        },
                        {
                            ...scopedLayout,
                            template_key: 'marketing-page',
                            config: { __layout: { composition: { mode: 'overlay', baseLayoutId: ids.globalLayout } } }
                        }
                    ],
                    widgets: [
                        {
                            id: ids.globalWidget,
                            layout_id: ids.globalLayout,
                            zone: 'marketing-main',
                            widget_key: 'marketing.hero',
                            sort_order: 0,
                            config: widgetConfig,
                            is_active: true,
                            source_widget_id: ids.sourceWidget,
                            source_base_widget_id: null
                        },
                        {
                            id: ids.scopedWidget,
                            layout_id: ids.scopedLayout,
                            zone: 'marketing-main',
                            widget_key: 'marketing.hero',
                            sort_order: 0,
                            config: widgetConfig,
                            is_active: true,
                            source_widget_id: ids.sourceWidget,
                            source_base_widget_id: ids.sourceWidget
                        }
                    ]
                }) as never,
                'app_019f3100000070008000000000000001'
            )
        ).rejects.toThrow('registered source policy')
    })

    it('reconstructs direct Marketing bindings from source_config in a release bundle', async () => {
        const heroDefinition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')
        if (!heroDefinition) throw new Error('Expected marketing.hero to be registered')
        const sourceBinding = buildSingleTargetWidgetBinding(heroDefinition, 'content', {
            entityKind: 'object',
            entityCodename: 'MarketingPageHero',
            semanticKey: 'hero-default'
        })
        const forgedBinding = buildSingleTargetWidgetBinding(heroDefinition, 'content', {
            entityKind: 'object',
            entityCodename: 'MarketingPageHero',
            semanticKey: 'forged'
        })
        const widgetContext = { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' } as const
        const sourceConfig = encodeLayoutWidgetConfigEnvelope(
            { rendererConfig: { showLeadForm: true }, neutral: { bindings: sourceBinding } },
            widgetContext
        )
        const executor = createExecutor({
            layouts: [
                {
                    ...globalLayout,
                    template_key: 'marketing-page',
                    config: { __layout: { composition: { mode: 'independent', baseLayoutId: null } } }
                }
            ],
            widgets: [
                {
                    id: ids.globalWidget,
                    layout_id: ids.globalLayout,
                    zone: 'marketing-main',
                    widget_key: 'marketing.hero',
                    sort_order: 0,
                    config: { showLeadForm: false },
                    instance_key: 'hero',
                    source_config: sourceConfig,
                    is_active: true,
                    source_widget_id: ids.sourceWidget,
                    source_base_widget_id: null
                }
            ]
        })

        const result = await loadApplicationRuntimeLayouts(executor as never, 'app_019f3100000070008000000000000001')
        const exported = result.layoutZoneWidgets[0]?.config
        const decoded = decodeLayoutWidgetConfigEnvelope(exported, widgetContext)
        expect(decoded.rendererConfig).toEqual({ showLeadForm: false })
        expect(decoded.neutral.bindings).toEqual(sourceBinding)
        expect((executor.query as jest.Mock).mock.calls.find(([sql]) => String(sql).includes('._app_widgets'))?.[0]).toContain(
            'source_config'
        )

        const forgedExecutor = createExecutor({
            layouts: [
                {
                    ...globalLayout,
                    template_key: 'marketing-page',
                    config: { __layout: { composition: { mode: 'independent', baseLayoutId: null } } }
                }
            ],
            widgets: [
                {
                    id: ids.globalWidget,
                    layout_id: ids.globalLayout,
                    zone: 'marketing-main',
                    widget_key: 'marketing.hero',
                    sort_order: 0,
                    config: encodeLayoutWidgetConfigEnvelope({ rendererConfig: {}, neutral: { bindings: forgedBinding } }, widgetContext),
                    source_config: sourceConfig,
                    is_active: true,
                    source_widget_id: ids.sourceWidget,
                    source_base_widget_id: null
                }
            ]
        })
        await expect(loadApplicationRuntimeLayouts(forgedExecutor as never, 'app_019f3100000070008000000000000001')).rejects.toThrow(
            'do not match its source config'
        )
    })
})
