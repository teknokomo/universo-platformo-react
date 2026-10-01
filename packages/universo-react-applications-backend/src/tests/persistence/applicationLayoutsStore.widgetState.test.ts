import {
    resetApplicationLayoutWidgetConfigsBatch,
    toggleApplicationLayoutWidget,
    updateApplicationLayoutWidgetConfig,
    updateApplicationLayoutWidgetConfigsBatch
} from '../../persistence/applicationLayoutsStore'
import { createApplicationLayoutWidgetSourceState } from '../../services/applicationLayoutWidgetSourceState'
import { createMockDbExecutor } from '../utils/dbMocks'
import { scopedBatchLayoutIdA, primeLockedLayout } from './applicationLayoutsStore.test-utils'

describe('applicationLayoutsStore widget activation and reset', () => {
    it('atomically blocks a single-system transition while ordinary Structures exist', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const widgetId = '018f8a78-7b8f-7c1d-a111-2222333344a1'

        primeLockedLayout(txExecutor, { layoutId: scopedBatchLayoutIdA, templateKey: 'dashboard' })
        txExecutor.query
            .mockResolvedValueOnce([
                {
                    id: widgetId,
                    layout_id: scopedBatchLayoutIdA,
                    zone: 'main',
                    widget_key: 'interpretationNetworkWorkspace',
                    sort_order: 0,
                    config: { structureMode: 'multiple', conceptCodename: 'Structure' },
                    is_active: true,
                    version: 7
                }
            ])
            .mockResolvedValueOnce([{ objectId: 'structure-object', tableName: 'structure' }])
            .mockResolvedValueOnce([{ columnName: 'system_key' }])
            .mockResolvedValueOnce([{ count: 2 }])

        await expect(
            updateApplicationLayoutWidgetConfigsBatch(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                {
                    updates: [
                        {
                            layoutId: scopedBatchLayoutIdA,
                            widgetId,
                            expectedVersion: 7,
                            config: { structureMode: 'singleSystem', conceptCodename: 'Structure' }
                        }
                    ]
                },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST')

        expect(txExecutor.query.mock.calls[0]?.[0]).toContain('pg_advisory_xact_lock')
        expect(txExecutor.query.mock.calls[11]?.[0]).toContain('COUNT(*)::int AS count')
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('SET config = $2::jsonb'))).toBe(false)
    })

    it('blocks a direct widget-config transition before updating the widget', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const widgetId = '018f8a78-7b8f-7c1d-a111-2222333344a1'
        primeLockedLayout(txExecutor, {
            layoutId: scopedBatchLayoutIdA,
            templateKey: 'dashboard',
            widgets: [
                {
                    id: widgetId,
                    layout_id: scopedBatchLayoutIdA,
                    zone: 'center',
                    widget_key: 'interpretationNetworkWorkspace',
                    sort_order: 0,
                    config: { structureMode: 'multiple' },
                    is_active: true,
                    version: 7
                }
            ]
        })
        txExecutor.query
            .mockResolvedValueOnce([{ objectId: 'structure-object', tableName: 'structure' }])
            .mockResolvedValueOnce([{ columnName: 'system_key' }])
            .mockResolvedValueOnce([{ count: 1 }])

        await expect(
            updateApplicationLayoutWidgetConfig(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                scopedBatchLayoutIdA,
                widgetId,
                { expectedVersion: 7, config: { structureMode: 'singleSystem' } },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST')

        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('SET config = $2::jsonb'))).toBe(false)
    })

    it('guards activation of a preconfigured single-system widget', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const widgetId = '018f8a78-7b8f-7c1d-a111-2222333344a1'
        primeLockedLayout(txExecutor, {
            layoutId: scopedBatchLayoutIdA,
            templateKey: 'dashboard',
            widgets: [
                {
                    id: widgetId,
                    layout_id: scopedBatchLayoutIdA,
                    zone: 'center',
                    widget_key: 'interpretationNetworkWorkspace',
                    sort_order: 0,
                    config: { structureMode: 'singleSystem' },
                    is_active: false,
                    version: 7
                }
            ]
        })
        txExecutor.query
            .mockResolvedValueOnce([{ objectId: 'structure-object', tableName: 'structure' }])
            .mockResolvedValueOnce([{ columnName: 'system_key' }])
            .mockResolvedValueOnce([{ count: 1 }])

        await expect(
            toggleApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                scopedBatchLayoutIdA,
                widgetId,
                { expectedVersion: 7, isActive: true },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST')

        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('SET is_active = $2'))).toBe(false)
    })

    it('atomically restores the current metahub widget config with optimistic concurrency', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const widgetId = '018f8a78-7b8f-7c1d-a111-2222333344a1'
        const sourceConfig = { structureMode: 'multiple', templatePanel: { showInStructureList: true, showInMatrix: true } }

        primeLockedLayout(txExecutor, { layoutId: scopedBatchLayoutIdA, templateKey: 'dashboard' })
        txExecutor.query
            .mockResolvedValueOnce([
                {
                    id: widgetId,
                    layout_id: scopedBatchLayoutIdA,
                    zone: 'center',
                    widget_key: 'interpretationNetworkWorkspace',
                    sort_order: 1,
                    config: { structureMode: 'singleSystem' },
                    source_config: sourceConfig,
                    source_state: createApplicationLayoutWidgetSourceState('dashboard', 'interpretationNetworkWorkspace', {
                        zone: 'center',
                        sortOrder: 1,
                        isActive: true,
                        config: sourceConfig
                    }),
                    is_customized: true,
                    is_active: true,
                    version: 7
                }
            ])
            .mockResolvedValueOnce([
                {
                    id: widgetId,
                    layout_id: scopedBatchLayoutIdA,
                    zone: 'center',
                    widget_key: 'interpretationNetworkWorkspace',
                    sort_order: 1,
                    config: sourceConfig,
                    source_config: sourceConfig,
                    source_state: createApplicationLayoutWidgetSourceState('dashboard', 'interpretationNetworkWorkspace', {
                        zone: 'center',
                        sortOrder: 1,
                        isActive: true,
                        config: sourceConfig
                    }),
                    is_customized: false,
                    is_active: true,
                    version: 8
                }
            ])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])

        const saved = await resetApplicationLayoutWidgetConfigsBatch(
            executor,
            'app_018f8a787b8f7c1da111222233334444',
            { updates: [{ layoutId: scopedBatchLayoutIdA, widgetId, expectedVersion: 7 }] },
            'user-1'
        )

        expect(saved[0]).toEqual(expect.objectContaining({ id: widgetId, config: sourceConfig, isCustomized: false, version: 8 }))
        expect(txExecutor.query.mock.calls[9]?.[0]).toContain('SET config = $3::jsonb')
        expect(txExecutor.query.mock.calls[9]?.[0]).toContain('AND source_state IS NOT NULL')
        expect(txExecutor.query.mock.calls[9]?.[0]).not.toMatch(/SET[^;]*source_config\s*=/isu)
    })

    it('blocks a reset that would enter single-system mode while ordinary Structures exist', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const widgetId = '018f8a78-7b8f-7c1d-a111-2222333344a1'
        primeLockedLayout(txExecutor, { layoutId: scopedBatchLayoutIdA, templateKey: 'dashboard' })
        txExecutor.query
            .mockResolvedValueOnce([
                {
                    id: widgetId,
                    layout_id: scopedBatchLayoutIdA,
                    zone: 'center',
                    widget_key: 'interpretationNetworkWorkspace',
                    sort_order: 1,
                    config: { structureMode: 'multiple', conceptCodename: 'Structure' },
                    source_config: { structureMode: 'singleSystem', conceptCodename: 'Structure' },
                    source_state: createApplicationLayoutWidgetSourceState('dashboard', 'interpretationNetworkWorkspace', {
                        zone: 'center',
                        sortOrder: 1,
                        isActive: true,
                        config: { structureMode: 'singleSystem', conceptCodename: 'Structure' }
                    }),
                    is_customized: true,
                    is_active: true,
                    version: 7
                }
            ])
            .mockResolvedValueOnce([{ objectId: 'structure-object', tableName: 'structure' }])
            .mockResolvedValueOnce([{ columnName: 'system_key' }])
            .mockResolvedValueOnce([{ count: 1 }])

        await expect(
            resetApplicationLayoutWidgetConfigsBatch(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                { updates: [{ layoutId: scopedBatchLayoutIdA, widgetId, expectedVersion: 7 }] },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST')

        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('SET config = source_config'))).toBe(false)
    })

    it('rejects a stale metahub widget reset before applying changes', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const widgetId = '018f8a78-7b8f-7c1d-a111-2222333344a1'
        primeLockedLayout(txExecutor, { layoutId: scopedBatchLayoutIdA, templateKey: 'dashboard' })
        txExecutor.query.mockResolvedValueOnce([
            {
                id: widgetId,
                layout_id: scopedBatchLayoutIdA,
                zone: 'center',
                widget_key: 'interpretationNetworkWorkspace',
                sort_order: 1,
                config: { structureMode: 'singleSystem' },
                source_config: { structureMode: 'multiple' },
                is_customized: true,
                is_active: true,
                version: 8
            }
        ])

        await expect(
            resetApplicationLayoutWidgetConfigsBatch(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                { updates: [{ layoutId: scopedBatchLayoutIdA, widgetId, expectedVersion: 7 }] },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')

        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('SET config = source_config'))).toBe(false)
    })
})
