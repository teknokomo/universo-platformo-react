import { loadApplicationRuntimeLayouts } from '../../routes/sync/syncDataLoader'

const ids = {
    globalLayout: '019f3100-0000-7000-8000-000000000001',
    scopedLayout: '019f3100-0000-7000-8000-000000000002',
    scopeEntity: '019f3100-0000-7000-8000-000000000010',
    globalWidget: '019f3100-0000-7000-8000-000000000020',
    sourceWidget: '019f3100-0000-7000-8000-000000000021',
    scopedWidget: '019f3100-0000-7000-8000-000000000030'
}

const globalLayout = {
    id: ids.globalLayout,
    scope_entity_id: null,
    template_key: 'dashboard',
    name: { en: 'Dashboard' },
    description: null,
    config: {
        showHeader: true,
        __layout: { composition: { mode: 'independent', baseLayoutId: null } }
    },
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
    config: {
        showHeader: false,
        __layout: { composition: { mode: 'overlay', baseLayoutId: ids.globalLayout } }
    },
    is_active: true,
    is_default: true,
    sort_order: 0
}

const createExecutor = (options: { rejectWidgets?: boolean } = {}) => ({
    query: jest.fn(async (sql: string) => {
        if (sql.includes('._app_layouts')) return [globalLayout, scopedLayout]
        if (sql.includes('._app_widgets')) {
            if (options.rejectWidgets) throw new Error('widgets query failed')
            return [
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
            ]
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
                config: { showHeader: true }
            })
        ])
        expect(result.scopedLayouts).toEqual([
            expect.objectContaining({
                id: ids.scopedLayout,
                scopeEntityId: ids.scopeEntity,
                compositionMode: 'overlay',
                baseLayoutId: ids.globalLayout,
                config: { showHeader: false }
            })
        ])
        expect(result.layoutZoneWidgets).toEqual([
            expect.objectContaining({ id: ids.globalWidget, layoutId: ids.globalLayout, widgetKey: 'header' })
        ])
        expect(result.layoutWidgetOverrides).toEqual([
            expect.objectContaining({
                id: ids.scopedWidget,
                layoutId: ids.scopedLayout,
                baseWidgetId: ids.globalWidget,
                isDeletedOverride: false
            })
        ])
        expect(result.layoutConfig).toEqual({ showHeader: true })
    })

    it('fails closed when the widget query cannot be completed', async () => {
        await expect(
            loadApplicationRuntimeLayouts(createExecutor({ rejectWidgets: true }) as never, 'app_019f3100000070008000000000000001')
        ).rejects.toThrow('widgets query failed')
    })

    it('fails closed when persisted composition metadata is missing', async () => {
        const executor = createExecutor()
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('._app_layouts')) return [{ ...globalLayout, config: { showHeader: true } }]
            return []
        })

        await expect(loadApplicationRuntimeLayouts(executor as never, 'app_019f3100000070008000000000000001')).rejects.toThrow(
            'missing canonical composition metadata'
        )
    })
})
