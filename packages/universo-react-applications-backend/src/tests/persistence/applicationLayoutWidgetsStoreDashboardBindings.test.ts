import { beforeEach, describe, expect, it } from '@jest/globals'
import { encodeLayoutWidgetConfigEnvelope } from '@universo-react/types'
import * as layoutSupport from '../../persistence/applicationLayoutStoreSupport'
import {
    deleteApplicationLayoutWidget,
    moveApplicationLayoutWidget,
    resetApplicationLayoutWidgetConfigsBatch,
    updateApplicationLayoutWidgetConfig,
    updateApplicationLayoutWidgetConfigsBatch
} from '../../persistence/applicationLayoutWidgetsStore'
import { createApplicationLayoutWidgetSourceState } from '../../services/applicationLayoutWidgetSourceState'
import { createApplicationLayoutWidgetsStoreBindingsHarness } from './applicationLayoutWidgetsStoreBindings.test-utils'

const layoutId = '0190a9b5-3cde-7abc-8def-012345678901'
const heroId = '0190a9b5-3cde-7abc-8def-012345678902'
const secondHeroId = '0190a9b5-3cde-7abc-8def-012345678903'
const schemaName = 'app_018f8a787b8f7c1da111222233334444'

const dashboardWorkspaceBaseConfig = {
    moduleCodename: 'interpretation-network',
    splitPane: { enabled: false },
    allowedMatrixViews: ['table']
}

const dashboardWorkspaceEnvelope = (config: Record<string, unknown>) =>
    encodeLayoutWidgetConfigEnvelope(
        { rendererConfig: config },
        { templateKey: 'dashboard', widgetKey: 'interpretationNetworkWorkspace', zone: 'center' }
    )

const dashboardWorkspaceRow = (config = dashboardWorkspaceBaseConfig, isCustomized = false) => {
    const sourceConfig = dashboardWorkspaceEnvelope(dashboardWorkspaceBaseConfig)
    return {
        id: heroId,
        layout_id: layoutId,
        zone: 'center',
        widget_key: 'interpretationNetworkWorkspace',
        instance_key: 'workspace-main',
        parent_widget_id: null,
        slot_key: null,
        sort_order: 1,
        config: dashboardWorkspaceEnvelope(config),
        source_config: sourceConfig,
        source_state: createApplicationLayoutWidgetSourceState('dashboard', 'interpretationNetworkWorkspace', {
            zone: 'center',
            sortOrder: 1,
            isActive: true,
            config: sourceConfig,
            instanceKey: 'workspace-main',
            parentWidgetId: null,
            slotKey: null
        }),
        source_widget_id: secondHeroId,
        source_base_widget_id: null,
        is_customized: isCustomized,
        is_active: true,
        version: isCustomized ? 3 : 2
    }
}

const mapDashboardWorkspace = (config = dashboardWorkspaceBaseConfig, isCustomized = false) =>
    layoutSupport.mapWidget(dashboardWorkspaceRow(config, isCustomized), 'dashboard')

const dashboardLayoutDetail = (widgets: ReturnType<typeof mapDashboardWorkspace>[]) =>
    ({
        item: { id: layoutId, templateKey: 'dashboard', isActive: true, version: 3 },
        widgets
    } as never)

const applicationLayoutWidgetsStoreHarness = createApplicationLayoutWidgetsStoreBindingsHarness(() =>
    dashboardLayoutDetail([mapDashboardWorkspace()])
)
const { executor, txExecutor, lockLayout, reset } = applicationLayoutWidgetsStoreHarness

beforeEach(reset)

describe('application layout widget Dashboard binding mutations', () => {
    it('allows single updates to nested presentation fields owned by the Dashboard workspace registry', async () => {
        const currentConfig = mapDashboardWorkspace()
        lockLayout.mockResolvedValue({
            item: { id: layoutId, templateKey: 'dashboard', isActive: true, version: 3 },
            widgets: [currentConfig]
        } as never)
        const nextConfig = { ...dashboardWorkspaceBaseConfig, splitPane: { enabled: true } }
        txExecutor.query.mockResolvedValueOnce([dashboardWorkspaceRow(nextConfig, true)])

        const saved = await updateApplicationLayoutWidgetConfig(
            executor,
            schemaName,
            layoutId,
            heroId,
            { expectedVersion: 2, config: nextConfig } as never,
            'user-1'
        )

        expect(saved?.config).toEqual(nextConfig)
        expect(txExecutor.query.mock.calls[0]?.[0]).toContain('SET config = $2::jsonb')
        expect(JSON.parse(String(txExecutor.query.mock.calls[0]?.[1]?.[1]))).toEqual(dashboardWorkspaceEnvelope(nextConfig))
    })

    it('allows batch updates to individual array items owned by the Dashboard workspace registry', async () => {
        const currentRow = dashboardWorkspaceRow()
        lockLayout.mockResolvedValue({
            item: { id: layoutId, templateKey: 'dashboard', isActive: true, version: 3 },
            widgets: [layoutSupport.mapWidget(currentRow, 'dashboard')]
        } as never)
        const nextConfig = { ...dashboardWorkspaceBaseConfig, allowedMatrixViews: ['horizontalRows'] }
        const updatedRow = dashboardWorkspaceRow(nextConfig, true)
        txExecutor.query.mockResolvedValueOnce([currentRow]).mockResolvedValueOnce([updatedRow])

        const saved = await updateApplicationLayoutWidgetConfigsBatch(
            executor,
            schemaName,
            { updates: [{ layoutId, widgetId: heroId, expectedVersion: 2, config: nextConfig }] } as never,
            'user-1'
        )

        expect(saved[0]?.config).toEqual(nextConfig)
        expect(txExecutor.query.mock.calls[1]?.[0]).toContain('SET config = $2::jsonb')
        expect(JSON.parse(String(txExecutor.query.mock.calls[1]?.[1]?.[1]))).toEqual(dashboardWorkspaceEnvelope(nextConfig))
    })

    it('continues to reject source-linked changes to runtime-owned Dashboard workspace fields', async () => {
        const currentConfig = mapDashboardWorkspace()
        lockLayout.mockResolvedValue({
            item: { id: layoutId, templateKey: 'dashboard', isActive: true, version: 3 },
            widgets: [currentConfig]
        } as never)
        const nextConfig = { ...dashboardWorkspaceBaseConfig, moduleCodename: 'forged-runtime-module' }

        await expect(
            updateApplicationLayoutWidgetConfig(
                executor,
                schemaName,
                layoutId,
                heroId,
                { expectedVersion: 2, config: nextConfig } as never,
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_INVALID')
        expect(txExecutor.query).not.toHaveBeenCalled()

        const currentRow = dashboardWorkspaceRow()
        txExecutor.query.mockResolvedValueOnce([currentRow])
        await expect(
            updateApplicationLayoutWidgetConfigsBatch(
                executor,
                schemaName,
                { updates: [{ layoutId, widgetId: heroId, expectedVersion: 2, config: nextConfig }] } as never,
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_INVALID')
        expect(txExecutor.query.mock.calls.some(([sql]) => /SET\s+config\s*=/iu.test(String(sql)))).toBe(false)
    })

    it('rejects a source reset batch that would invalidate a child placement before writing', async () => {
        const containerId = '0190a9b5-3cde-7abc-8def-012345678904'
        const tableId = '0190a9b5-3cde-7abc-8def-012345678905'
        const sourceConfig = encodeLayoutWidgetConfigEnvelope(
            { rendererConfig: { columns: [{ slotKey: 'column:secondary', width: 12 }] } },
            { templateKey: 'dashboard', widgetKey: 'columnsContainer', zone: 'center' }
        )
        const currentConfig = encodeLayoutWidgetConfigEnvelope(
            { rendererConfig: { columns: [{ slotKey: 'column:main', width: 12 }] } },
            { templateKey: 'dashboard', widgetKey: 'columnsContainer', zone: 'center' }
        )
        const baseline = createApplicationLayoutWidgetSourceState('dashboard', 'columnsContainer', {
            zone: 'center',
            sortOrder: 1,
            isActive: true,
            config: sourceConfig,
            instanceKey: 'source-columns',
            parentWidgetId: null,
            slotKey: null
        })
        const container = {
            id: containerId,
            layoutId,
            zone: 'center',
            widgetKey: 'columnsContainer',
            instanceKey: 'source-columns',
            parentWidgetId: null,
            slotKey: null,
            sortOrder: 1,
            config: { columns: [{ slotKey: 'column:main', width: 12 }] },
            sourceConfig: { columns: [{ slotKey: 'column:secondary', width: 12 }] },
            sourceWidgetId: containerId,
            sourceBaseWidgetId: null,
            isCustomized: true,
            isActive: true,
            version: 2
        }
        lockLayout.mockResolvedValue({
            item: { id: layoutId, templateKey: 'dashboard', isActive: true, version: 3 },
            widgets: [
                container,
                {
                    id: tableId,
                    layoutId,
                    zone: 'center',
                    widgetKey: 'detailsTable',
                    instanceKey: 'source-table',
                    parentWidgetId: containerId,
                    slotKey: 'column:main',
                    sortOrder: 1,
                    config: {},
                    sourceConfig: null,
                    sourceWidgetId: null,
                    sourceBaseWidgetId: null,
                    isCustomized: false,
                    isActive: true,
                    version: 2
                }
            ]
        } as never)
        txExecutor.query.mockResolvedValueOnce([
            {
                id: containerId,
                layout_id: layoutId,
                zone: 'center',
                widget_key: 'columnsContainer',
                instance_key: 'source-columns',
                parent_widget_id: null,
                slot_key: null,
                sort_order: 1,
                config: currentConfig,
                source_config: sourceConfig,
                source_state: baseline,
                source_widget_id: containerId,
                source_base_widget_id: null,
                is_customized: true,
                is_active: true,
                version: 2
            }
        ])

        await expect(
            resetApplicationLayoutWidgetConfigsBatch(
                executor,
                schemaName,
                { updates: [{ layoutId, widgetId: containerId, expectedVersion: 2 }] } as never,
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_SLOT_INVALID')

        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expect(txExecutor.query.mock.calls.every(([sql]) => !/^\s*(?:INSERT|UPDATE|DELETE)\b/iu.test(String(sql)))).toBe(true)
    })

    it('rejects zone and parent changes for a source-managed Dashboard placement before writing', async () => {
        const inheritedWidget = {
            id: heroId,
            layoutId,
            zone: 'left',
            widgetKey: 'divider',
            instanceKey: 'source-spacer',
            parentWidgetId: null,
            slotKey: null,
            sortOrder: 1,
            config: {},
            sourceConfig: {},
            sourceWidgetId: secondHeroId,
            sourceBaseWidgetId: secondHeroId,
            isCustomized: false,
            isActive: true,
            version: 2
        }
        lockLayout.mockResolvedValue({
            item: { id: layoutId, templateKey: 'dashboard', isActive: true, version: 3 },
            widgets: [inheritedWidget]
        } as never)

        await expect(
            moveApplicationLayoutWidget(
                executor,
                schemaName,
                layoutId,
                { expectedVersion: 2, widgetId: heroId, targetZone: 'right', targetIndex: 0 } as never,
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_INVALID')

        await expect(
            moveApplicationLayoutWidget(
                executor,
                schemaName,
                layoutId,
                {
                    expectedVersion: 2,
                    widgetId: heroId,
                    targetZone: 'left',
                    targetIndex: 0,
                    parentWidgetId: secondHeroId,
                    slotKey: 'column:main'
                } as never,
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_INVALID')

        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('WITH updates AS'))).toBe(false)
        expect(txExecutor.query.mock.calls.some(([sql]) => /UPDATE .*_app_widgets/isu.test(String(sql)))).toBe(false)
    })

    it('applies source-linked move restrictions to global source rows with no source base id', async () => {
        const globalSourceWidget = {
            id: heroId,
            layoutId,
            zone: 'left',
            widgetKey: 'divider',
            instanceKey: 'global-divider',
            parentWidgetId: null,
            slotKey: null,
            sortOrder: 1,
            config: {},
            sourceConfig: {},
            sourceWidgetId: secondHeroId,
            sourceBaseWidgetId: null,
            isCustomized: false,
            isActive: true,
            version: 2
        }
        lockLayout.mockResolvedValue({
            item: { id: layoutId, templateKey: 'dashboard', isActive: true, version: 3 },
            widgets: [globalSourceWidget]
        } as never)

        await expect(
            moveApplicationLayoutWidget(
                executor,
                schemaName,
                layoutId,
                { expectedVersion: 2, widgetId: heroId, targetZone: 'right', targetIndex: 0 } as never,
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_INVALID')

        expect(txExecutor.query).not.toHaveBeenCalled()
    })

    it('blocks parent-slot moves for source-managed structural hosts and Entity placements by base lineage', async () => {
        for (const [widgetKey, config] of [
            ['columnsContainer', { columns: [{ slotKey: 'column:main', width: 12 }] }],
            ['detailsTable', {}]
        ] as const) {
            lockLayout.mockResolvedValue({
                item: { id: layoutId, templateKey: 'dashboard', isActive: true, version: 3 },
                widgets: [
                    {
                        id: heroId,
                        layoutId,
                        zone: 'center',
                        widgetKey,
                        instanceKey: `source-${widgetKey}`,
                        parentWidgetId: null,
                        slotKey: null,
                        sortOrder: 1,
                        config,
                        sourceConfig: config,
                        sourceWidgetId: null,
                        sourceBaseWidgetId: secondHeroId,
                        isCustomized: false,
                        isActive: true,
                        version: 2
                    }
                ]
            } as never)

            await expect(
                moveApplicationLayoutWidget(
                    executor,
                    schemaName,
                    layoutId,
                    {
                        expectedVersion: 2,
                        widgetId: heroId,
                        targetZone: 'center',
                        targetIndex: 0,
                        parentWidgetId: secondHeroId,
                        slotKey: 'column:main'
                    } as never,
                    'user-1'
                )
            ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_INVALID')
        }

        expect(txExecutor.query).not.toHaveBeenCalled()
    })

    it('recursively soft-deletes a nested placement subtree with each locked row version', async () => {
        const grandchildId = '0190a9b5-3cde-7abc-8def-012345678904'
        const widgets = [
            {
                id: heroId,
                layoutId,
                zone: 'center',
                widgetKey: 'columnsContainer',
                instanceKey: 'source-host',
                parentWidgetId: null,
                slotKey: null,
                sortOrder: 1,
                config: { columns: [{ slotKey: 'column:main', width: 12 }] },
                sourceConfig: null,
                sourceWidgetId: null,
                sourceBaseWidgetId: null,
                isCustomized: false,
                isActive: true,
                version: 5
            },
            {
                id: secondHeroId,
                layoutId,
                zone: 'center',
                widgetKey: 'detailsTable',
                instanceKey: 'source-entity',
                parentWidgetId: heroId,
                slotKey: 'column:main',
                sortOrder: 1,
                config: {},
                sourceConfig: {},
                sourceWidgetId: null,
                sourceBaseWidgetId: null,
                isCustomized: false,
                isActive: true,
                version: 3
            },
            {
                id: grandchildId,
                layoutId,
                zone: 'center',
                widgetKey: 'divider',
                instanceKey: 'nested-host-child',
                parentWidgetId: secondHeroId,
                slotKey: 'column:main',
                sortOrder: 1,
                config: {},
                sourceConfig: null,
                sourceWidgetId: null,
                sourceBaseWidgetId: null,
                isCustomized: false,
                isActive: true,
                version: 4
            }
        ]
        lockLayout.mockResolvedValue({
            item: { id: layoutId, templateKey: 'dashboard', isActive: true, version: 3 },
            widgets
        } as never)
        txExecutor.query.mockResolvedValueOnce(widgets.map(({ id }) => ({ id, layout_id: layoutId })))

        await expect(deleteApplicationLayoutWidget(executor, schemaName, layoutId, heroId, 'user-1', 5)).resolves.toBe(true)

        const deleteQuery = txExecutor.query.mock.calls.find(([sql]) => String(sql).includes('FROM unnest($3::uuid[], $4::int[])'))
        expect(deleteQuery?.[1]).toEqual(['user-1', layoutId, [heroId, secondHeroId, grandchildId], [5, 3, 4]])
        expect(String(deleteQuery?.[0])).not.toMatch(/source_(?:widget|base_widget)_id\s*=/iu)
    })

    it.each([
        ['direct source lineage', secondHeroId, null],
        ['base source lineage', null, secondHeroId]
    ])(
        'deletes the local placement subtree when a descendant has %s without deleting its source',
        async (_label, sourceWidgetId, sourceBaseWidgetId) => {
            lockLayout.mockResolvedValue({
                item: { id: layoutId, templateKey: 'dashboard', isActive: true, version: 3 },
                widgets: [
                    {
                        id: heroId,
                        layoutId,
                        zone: 'center',
                        widgetKey: 'columnsContainer',
                        instanceKey: 'application-owned-host',
                        parentWidgetId: null,
                        slotKey: null,
                        sortOrder: 1,
                        config: { columns: [{ slotKey: 'column:main', width: 12 }] },
                        sourceConfig: null,
                        sourceWidgetId: null,
                        sourceBaseWidgetId: null,
                        isCustomized: false,
                        isActive: true,
                        version: 5
                    },
                    {
                        id: secondHeroId,
                        layoutId,
                        zone: 'center',
                        widgetKey: 'detailsTable',
                        instanceKey: 'source-managed-table',
                        parentWidgetId: heroId,
                        slotKey: 'column:main',
                        sortOrder: 1,
                        config: {},
                        sourceConfig: {},
                        sourceWidgetId,
                        sourceBaseWidgetId,
                        isCustomized: false,
                        isActive: true,
                        version: 3
                    }
                ]
            } as never)
            txExecutor.query.mockResolvedValueOnce([
                { id: heroId, layout_id: layoutId },
                { id: secondHeroId, layout_id: layoutId }
            ])

            await expect(deleteApplicationLayoutWidget(executor, schemaName, layoutId, heroId, 'user-1', 5)).resolves.toBe(true)
            const deletionQuery = txExecutor.query.mock.calls.find(([sql]) => String(sql).includes('FROM unnest($3::uuid[], $4::int[])'))
            const deletionSql = String(deletionQuery?.[0])
            expect(deletionSql).toContain('UPDATE')
            expect(deletionSql).toContain('"_app_widgets"')
            expect(deletionSql).toContain('_upl_deleted = true')
            expect(deletionSql).toContain('_app_deleted = true')
            expect(deletionSql).not.toMatch(/(?:DELETE\s+FROM|UPDATE)\s+.*(?:_app_objects|_mhb_objects)/iu)
            expect(deletionQuery?.[1]).toEqual(['user-1', layoutId, [heroId, secondHeroId], [5, 3]])
        }
    )
})
