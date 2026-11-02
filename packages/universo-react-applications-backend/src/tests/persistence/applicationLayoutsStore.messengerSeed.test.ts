import { decodeWidgetConfigEnvelope } from '@universo-react/types'
import { isUuidV7 } from '@universo-react/utils'
import { createApplicationLayout } from '../../persistence/applicationLayoutsStore'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('createApplicationLayout Messenger starter composition', () => {
    it('atomically persists the header, localized Overview tab, and generated navigation child on the first global layout', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const layoutId = '0190a9b5-3cde-7abc-8def-2123456789d1'
        txExecutor.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
            const statement = String(sql)
            if (statement.includes('COUNT(*)::text AS count')) return [{ count: '0' }]
            if (statement.includes('INSERT INTO') && statement.includes('"_app_layouts"')) {
                return [
                    {
                        id: layoutId,
                        scope_entity_id: null,
                        template_key: params[1],
                        name: JSON.parse(String(params[2])),
                        description: null,
                        config: JSON.parse(String(params[4])),
                        is_active: params[5],
                        is_default: params[6],
                        sort_order: params[7],
                        source_kind: 'application',
                        source_layout_id: null,
                        source_snapshot_hash: null,
                        source_content_hash: null,
                        local_content_hash: params[9],
                        sync_state: 'clean',
                        is_source_excluded: false,
                        source_deleted_at: null,
                        source_deleted_by: null,
                        version: 1
                    }
                ]
            }
            if (statement.includes('INSERT INTO') && statement.includes('"_app_widgets"')) {
                return [{ id: params[0], instance_key: params[4] }]
            }
            return []
        })

        const created = await createApplicationLayout(
            executor,
            'app_018f8a787b8f7c1da111222233334444',
            { name: { en: 'Messenger home' }, templateKey: 'messenger-app', isActive: true, isDefault: false, config: {} },
            null
        )

        expect(created.templateKey).toBe('messenger-app')
        expect(created.localContentHash).toMatch(/^[a-f0-9]{64}$/u)
        const insertCalls = txExecutor.query.mock.calls.filter(
            ([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('"_app_widgets"')
        )
        expect(insertCalls).toHaveLength(3)
        const insertedPlacements = insertCalls.map(([sql, params]) => ({
            sql: String(sql),
            id: params[0],
            layoutId: params[1],
            zone: params[2],
            widgetKey: params[3],
            instanceKey: params[4],
            parentId: params[5],
            slotKey: params[6],
            config: JSON.parse(String(params[8])) as Record<string, unknown>,
            isActive: params[9]
        }))
        expect(insertedPlacements).toEqual([
            expect.objectContaining({
                id: expect.stringMatching(/^[0-9a-f-]{36}$/u),
                layoutId,
                zone: 'top',
                widgetKey: 'header',
                instanceKey: expect.stringMatching(/^[0-9a-f-]{36}$/u),
                parentId: null,
                slotKey: null,
                isActive: true
            }),
            expect.objectContaining({
                id: expect.stringMatching(/^[0-9a-f-]{36}$/u),
                layoutId,
                zone: 'center',
                widgetKey: 'detailsTabs',
                instanceKey: expect.stringMatching(/^[0-9a-f-]{36}$/u),
                parentId: null,
                slotKey: null,
                config: expect.objectContaining({
                    tabs: [{ slotKey: 'tab:overview', label: { en: 'Overview', ru: 'Обзор' }, isDefault: true }]
                }),
                isActive: true
            }),
            expect.objectContaining({
                id: expect.stringMatching(/^[0-9a-f-]{36}$/u),
                layoutId,
                zone: 'center',
                widgetKey: 'menuWidget',
                instanceKey: expect.stringMatching(/^[0-9a-f-]{36}$/u),
                parentId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
                slotKey: 'tab:overview',
                isActive: true
            })
        ])
        expect(insertedPlacements[2]?.parentId).toBe(insertedPlacements[1]?.id)
        for (const [, params] of insertCalls) {
            expect(isUuidV7(String(params[0]))).toBe(true)
            expect(isUuidV7(String(params[4]))).toBe(true)
        }
        const tabConfig = JSON.parse(String(insertCalls[1]?.[1][8])) as Record<string, unknown>
        expect(
            decodeWidgetConfigEnvelope(tabConfig, {
                templateKey: 'messenger-app',
                widgetKey: 'detailsTabs',
                zone: 'center'
            }).rendererConfig
        ).toEqual({ tabs: [{ slotKey: 'tab:overview', label: { en: 'Overview', ru: 'Обзор' }, isDefault: true }] })
        const menuConfig = JSON.parse(String(insertCalls[2]?.[1][8])) as Record<string, unknown>
        expect(
            decodeWidgetConfigEnvelope(menuConfig, {
                templateKey: 'messenger-app',
                widgetKey: 'menuWidget',
                zone: 'center'
            }).rendererConfig
        ).toEqual({ variant: 'generated' })
    })
})
