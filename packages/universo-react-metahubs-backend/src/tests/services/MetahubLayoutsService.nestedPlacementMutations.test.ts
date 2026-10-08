jest.mock('../../domains/layouts/widgetBindingSourceProvisioner', () => ({
    createWidgetBindingSourceProvisioner: jest.fn(() => jest.fn())
}))

import { buildSingleTargetWidgetBinding, encodeWidgetConfigEnvelope, getLayoutWidgetDefinition } from '@universo-react/types'
import { createMetahubLayoutsServiceTestHarness } from './MetahubLayoutsService.testSupport'

const buildOccupiedDetailsTitleConfig = () => {
    const definition = getLayoutWidgetDefinition('detailsTitle')
    if (!definition) throw new Error('Dashboard detailsTitle binding contract is missing')
    const bindings = buildSingleTargetWidgetBinding(definition, 'content', {
        entityKind: 'object',
        entityCodename: 'Main',
        semanticKey: 'occupied-container-title'
    })
    return encodeWidgetConfigEnvelope(
        { rendererConfig: {}, neutral: { bindings } },
        { templateKey: 'dashboard', widgetKey: 'detailsTitle', zone: 'center' }
    )
}

describe('MetahubLayoutsService nested placement mutations', () => {
    it('rejects a container slot removal while a child placement still occupies that slot', async () => {
        const schemaName = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'
        const layoutId = '0190a9b5-3cde-7abc-8def-0123456789d0'
        const parentId = '0190a9b5-3cde-7abc-8def-0123456789d1'
        const childId = '0190a9b5-3cde-7abc-8def-0123456789d2'
        const parentConfig = {
            columns: [
                { slotKey: 'column:primary', width: 6 },
                { slotKey: 'column:secondary', width: 6 }
            ]
        }
        const rows = [
            {
                id: parentId,
                layout_id: layoutId,
                instance_key: 'dashboard-root',
                parent_widget_id: null,
                slot_key: null,
                zone: 'center',
                widget_key: 'columnsContainer',
                sort_order: 1,
                config: parentConfig,
                is_active: true,
                _upl_version: 1,
                _upl_created_at: '2026-10-02T00:00:00.000Z',
                _upl_updated_at: '2026-10-02T00:00:00.000Z'
            },
            {
                id: childId,
                layout_id: layoutId,
                instance_key: 'details-title-child',
                parent_widget_id: parentId,
                slot_key: 'column:secondary',
                zone: 'center',
                widget_key: 'detailsTitle',
                sort_order: 1,
                config: buildOccupiedDetailsTitleConfig(),
                is_active: true,
                _upl_version: 1,
                _upl_created_at: '2026-10-02T00:00:01.000Z',
                _upl_updated_at: '2026-10-02T00:00:01.000Z'
            }
        ]
        const layoutRow = {
            id: layoutId,
            scope_entity_id: null,
            base_layout_id: null,
            template_key: 'dashboard',
            config: {},
            version: 1
        }
        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))')) return []
            if (sql.includes('SELECT id, scope_entity_id, base_layout_id') && sql.includes('_mhb_layouts')) return [layoutRow]
            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets') && sql.includes('ORDER BY zone ASC')) return rows
            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets') && sql.includes('id = $1 AND layout_id = $2')) {
                return rows.filter((row) => row.id === params?.[0])
            }
            throw new Error(`Unexpected SQL in occupied container slot test: ${sql}`)
        })
        const { service } = createMetahubLayoutsServiceTestHarness(query, schemaName)

        await expect(
            service.updateLayoutZoneWidgetConfig(
                'metahub-1',
                layoutId,
                parentId,
                { columns: [{ slotKey: 'column:primary', width: 12 }] },
                'user-1',
                1
            )
        ).rejects.toThrow('Layout widget placement graph is invalid')

        expect(rows[0]?.config).toEqual(parentConfig)
        expect(rows[1]?.parent_widget_id).toBe(parentId)
        expect(rows[1]?.slot_key).toBe('column:secondary')
        expect(query.mock.calls.some(([sql]) => String(sql).includes('UPDATE') && String(sql).includes('_mhb_widgets'))).toBe(false)
    })

    it('allows changing container presentation while retaining every occupied slot', async () => {
        const schemaName = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'
        const layoutId = '0190a9b5-3cde-7abc-8def-0123456789d0'
        const parentId = '0190a9b5-3cde-7abc-8def-0123456789d1'
        const parentConfig = {
            columns: [
                { slotKey: 'column:primary', width: 6 },
                { slotKey: 'column:secondary', width: 6 }
            ]
        }
        const rows = [
            {
                id: parentId,
                layout_id: layoutId,
                instance_key: 'dashboard-root',
                parent_widget_id: null,
                slot_key: null,
                zone: 'center',
                widget_key: 'columnsContainer',
                sort_order: 1,
                config: parentConfig,
                is_active: true,
                _upl_version: 1,
                _upl_created_at: '2026-10-02T00:00:00.000Z',
                _upl_updated_at: '2026-10-02T00:00:00.000Z'
            },
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789d2',
                layout_id: layoutId,
                instance_key: 'details-title-child',
                parent_widget_id: parentId,
                slot_key: 'column:secondary',
                zone: 'center',
                widget_key: 'detailsTitle',
                sort_order: 1,
                config: buildOccupiedDetailsTitleConfig(),
                is_active: true,
                _upl_version: 1,
                _upl_created_at: '2026-10-02T00:00:01.000Z',
                _upl_updated_at: '2026-10-02T00:00:01.000Z'
            }
        ]
        const layoutRow = {
            id: layoutId,
            scope_entity_id: null,
            base_layout_id: null,
            template_key: 'dashboard',
            config: {},
            version: 1
        }
        let persistedConfig = parentConfig
        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))')) return []
            if (sql.includes('SELECT id, scope_entity_id, base_layout_id') && sql.includes('_mhb_layouts')) return [layoutRow]
            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets') && sql.includes('ORDER BY zone ASC')) {
                return rows.map((row, index) => (index === 0 ? { ...row, config: persistedConfig } : row))
            }
            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets') && sql.includes('id = $1 AND layout_id = $2')) {
                return rows.filter((row) => row.id === params?.[0]).map((row) => ({ ...row, config: persistedConfig }))
            }
            if (sql.includes('UPDATE') && sql.includes('_mhb_widgets') && sql.includes('SET config =')) {
                persistedConfig = JSON.parse(String(params?.[0])) as typeof parentConfig
                return [{ ...rows[0], config: persistedConfig, _upl_version: 2 }]
            }
            throw new Error(`Unexpected SQL in retained container slot test: ${sql}`)
        })
        const { service } = createMetahubLayoutsServiceTestHarness(query, schemaName)
        const nextConfig = {
            columns: [
                { slotKey: 'column:primary', width: 8 },
                { slotKey: 'column:secondary', width: 4 }
            ]
        }

        const result = await service.updateLayoutZoneWidgetConfig('metahub-1', layoutId, parentId, nextConfig, 'user-1', 1)

        expect(result.config).toEqual(nextConfig)
        expect(persistedConfig).toEqual(nextConfig)
        expect(query.mock.calls.filter(([sql]) => String(sql).includes('UPDATE') && String(sql).includes('_mhb_widgets'))).toHaveLength(1)
    })

    it('removes a source placement and its complete nested subtree atomically', async () => {
        const schemaName = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'
        const layoutId = '0190a9b5-3cde-7abc-8def-0123456789d0'
        const rootId = '0190a9b5-3cde-7abc-8def-0123456789d1'
        const childId = '0190a9b5-3cde-7abc-8def-0123456789d2'
        const layoutRow = {
            id: layoutId,
            scope_entity_id: null,
            base_layout_id: null,
            template_key: 'dashboard',
            config: {},
            version: 1
        }
        const widgetRows = [
            {
                id: rootId,
                layout_id: layoutId,
                instance_key: 'dashboard-root',
                parent_widget_id: null,
                slot_key: null,
                zone: 'center',
                widget_key: 'columnsContainer',
                sort_order: 1,
                config: { columns: [{ slotKey: 'column:main', width: 12 }] },
                is_active: true,
                _upl_version: 1,
                _upl_created_at: '2026-10-02T00:00:00.000Z',
                _upl_updated_at: '2026-10-02T00:00:00.000Z'
            },
            {
                id: childId,
                layout_id: layoutId,
                instance_key: 'quiz-child',
                parent_widget_id: rootId,
                slot_key: 'column:main',
                zone: 'center',
                widget_key: 'quizWidget',
                sort_order: 1,
                config: {},
                is_active: true,
                _upl_version: 1,
                _upl_created_at: '2026-10-02T00:00:01.000Z',
                _upl_updated_at: '2026-10-02T00:00:01.000Z'
            }
        ]
        const deletedIds = new Set<string>()
        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('ORDER BY id ASC FOR UPDATE') && sql.includes('_mhb_widgets')) return []
            if (sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))')) return []
            if (sql.includes('dependent_layout.base_layout_id')) return []
            if (sql.includes('SELECT id, scope_entity_id, base_layout_id') && sql.includes('_mhb_layouts')) return [layoutRow]
            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets') && sql.includes('FOR UPDATE')) {
                return widgetRows.filter(({ id }) => !deletedIds.has(id))
            }
            if (sql.includes('UPDATE') && sql.includes('_mhb_widgets') && sql.includes('_mhb_deleted = true')) {
                const id = String(params?.[2])
                deletedIds.add(id)
                return [{ id }]
            }
            if (sql.includes('SELECT id, sort_order') && sql.includes('_mhb_widgets')) return []
            if (sql.includes('SELECT widget_key, zone, is_active') && sql.includes('_mhb_widgets')) return []
            if (sql.includes('UPDATE') && sql.includes('_mhb_layouts') && sql.includes('SET config =')) return [{ id: layoutId }]
            throw new Error(`Unexpected SQL in nested placement removal test: ${sql}`)
        })
        const { service, executor } = createMetahubLayoutsServiceTestHarness(query, schemaName)

        await service.removeLayoutZoneWidget('metahub-1', layoutId, rootId, 'user-1', 1)

        expect(deletedIds).toEqual(new Set([rootId, childId]))
        const deleteCalls = query.mock.calls.filter(([sql]) => String(sql).includes('_mhb_deleted = true'))
        expect(deleteCalls).toHaveLength(2)
        for (const [sql, params] of deleteCalls) {
            expect(String(sql)).toContain('COALESCE(_upl_version, 1) = $5')
            expect(String(sql)).toContain('RETURNING id')
            expect(params?.[2]).toBeDefined()
        }
        expect(executor.transaction).toHaveBeenCalledTimes(1)
    })

    it('blocks deleting a base placement while a dependent layout has a child attached to it', async () => {
        const schemaName = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'
        const layoutId = '0190a9b5-3cde-7abc-8def-0123456789e0'
        const rootId = '0190a9b5-3cde-7abc-8def-0123456789e1'
        const dependentChildId = '0190a9b5-3cde-7abc-8def-0123456789e2'
        const layoutRow = {
            id: layoutId,
            scope_entity_id: null,
            base_layout_id: null,
            template_key: 'dashboard',
            config: {},
            version: 1
        }
        const widgetRows = [
            {
                id: rootId,
                layout_id: layoutId,
                instance_key: 'dashboard-root',
                parent_widget_id: null,
                slot_key: null,
                zone: 'center',
                widget_key: 'columnsContainer',
                sort_order: 1,
                config: { columns: [{ slotKey: 'column:main', width: 12 }] },
                is_active: true,
                _upl_version: 1
            }
        ]
        const query = jest.fn(async (sql: string) => {
            if (sql.includes('ORDER BY id ASC FOR UPDATE') && sql.includes('_mhb_widgets')) return []
            if (sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))')) return []
            if (sql.includes('SELECT id, scope_entity_id, base_layout_id') && sql.includes('_mhb_layouts')) return [layoutRow]
            if (sql.includes('dependent_layout.base_layout_id')) return [{ id: dependentChildId }]
            if (sql.includes('SELECT * FROM') && sql.includes('_mhb_widgets') && sql.includes('FOR UPDATE')) return widgetRows
            throw new Error(`Unexpected SQL in dependent layout deletion test: ${sql}`)
        })
        const { service } = createMetahubLayoutsServiceTestHarness(query, schemaName)

        await expect(service.removeLayoutZoneWidget('metahub-1', layoutId, rootId, 'user-1', 1)).rejects.toMatchObject({
            statusCode: 409,
            code: 'CONFLICT'
        })

        expect(query.mock.calls.some(([sql]) => String(sql).includes('UPDATE') && String(sql).includes('_mhb_deleted = true'))).toBe(false)
    })
})
