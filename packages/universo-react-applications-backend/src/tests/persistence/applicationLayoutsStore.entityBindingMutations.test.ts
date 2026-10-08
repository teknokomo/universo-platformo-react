import { upsertApplicationLayoutWidget } from '../../persistence/applicationLayoutsStore'
import { createMockDbExecutor } from '../utils/dbMocks'
import { primeLockedLayout, encodeBoundCollectionConfig } from './applicationLayoutsStore.test-utils'

describe('applicationLayoutsStore Entity-backed binding mutations', () => {
    it('rejects Entity-backed widget application mutations before duplicate-key handling', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        primeLockedLayout(txExecutor, {
            layoutId: '0190a9b5-3cde-7abc-8def-2123456789d8',
            templateKey: 'marketing-page',
            widgets: [
                {
                    id: '0190a9b5-3cde-7abc-8def-2123456789d6',
                    layout_id: '0190a9b5-3cde-7abc-8def-2123456789d8',
                    zone: 'marketing-main',
                    widget_key: 'marketing.collection',
                    sort_order: 0,
                    config: encodeBoundCollectionConfig('hero', 'features'),
                    source_config: encodeBoundCollectionConfig('hero', 'features'),
                    source_widget_id: '0190a9b5-3cde-7abc-8def-2123456789d7',
                    source_base_widget_id: null,
                    is_customized: false,
                    is_active: true,
                    version: 2
                }
            ]
        })

        await expect(
            upsertApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                '0190a9b5-3cde-7abc-8def-2123456789d8',
                {
                    zone: 'marketing-main',
                    widgetKey: 'marketing.collection',
                    expectedVersion: 1,
                    config: { variant: 'features' }
                },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_ENTITY_BACKED_WIDGET_COPY_CONFLICT')
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
    })

    it('rejects a new application-owned instance for an Entity-backed widget', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const existingWidget = {
            id: '0190a9b5-3cde-7abc-8def-2123456789d6',
            layout_id: '0190a9b5-3cde-7abc-8def-2123456789d8',
            zone: 'marketing-main',
            widget_key: 'marketing.collection',
            sort_order: 0,
            config: encodeBoundCollectionConfig('hero', 'features'),
            source_config: encodeBoundCollectionConfig('hero', 'features'),
            source_widget_id: '0190a9b5-3cde-7abc-8def-2123456789d7',
            source_base_widget_id: null,
            is_customized: false,
            is_active: true,
            version: 2
        }
        primeLockedLayout(txExecutor, {
            layoutId: '0190a9b5-3cde-7abc-8def-2123456789d8',
            templateKey: 'marketing-page',
            widgets: [existingWidget]
        })
        await expect(
            upsertApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                '0190a9b5-3cde-7abc-8def-2123456789d8',
                {
                    zone: 'marketing-main',
                    widgetKey: 'marketing.collection',
                    expectedVersion: 1,
                    config: { variant: 'features' }
                },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_ENTITY_BACKED_WIDGET_COPY_CONFLICT')
        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
    })

    it.each(['source', 'copySource'] as const)('rejects legacy marketing %s data at the Entity-backed widget boundary', async (field) => {
        const { executor } = createMockDbExecutor()

        await expect(
            upsertApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                '0190a9b5-3cde-7abc-8def-2123456789d8',
                {
                    zone: 'marketing-main',
                    widgetKey: 'marketing.collection',
                    expectedVersion: 1,
                    config: {
                        instanceKey: 'legacy',
                        variant: 'features',
                        [field]: { entityKind: 'object', entityCodename: 'MarketingPageFeature' }
                    }
                },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_INVALID')
        expect(executor.transaction).not.toHaveBeenCalled()
    })

    it('rejects Entity-backed widget changes before duplicate instance checks', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        primeLockedLayout(txExecutor, {
            layoutId: '0190a9b5-3cde-7abc-8def-2123456789d8',
            templateKey: 'marketing-page',
            widgets: [
                {
                    id: '0190a9b5-3cde-7abc-8def-2123456789dd',
                    layout_id: '0190a9b5-3cde-7abc-8def-2123456789d8',
                    zone: 'marketing-main',
                    widget_key: 'marketing.collection',
                    sort_order: 0,
                    config: encodeBoundCollectionConfig('features', 'features'),
                    source_config: encodeBoundCollectionConfig('features', 'features'),
                    source_widget_id: '0190a9b5-3cde-7abc-8def-2123456789de',
                    source_base_widget_id: null,
                    is_customized: false,
                    is_active: true,
                    version: 1
                }
            ]
        })

        await expect(
            upsertApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                '0190a9b5-3cde-7abc-8def-2123456789d8',
                {
                    zone: 'marketing-main',
                    widgetKey: 'marketing.collection',
                    expectedVersion: 1,
                    config: { variant: 'features' }
                },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_ENTITY_BACKED_WIDGET_COPY_CONFLICT')
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
    })
})
