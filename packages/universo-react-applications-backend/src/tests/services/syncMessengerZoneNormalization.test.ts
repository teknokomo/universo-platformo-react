import { normalizeLayoutZone } from '../../routes/sync/syncLayoutSnapshot'
import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
import {
    configureSyncLayoutPersistenceKnexAccessor,
    createMockSyncKnex,
    hasPublishedWidgetsChanges,
    mockSyncExecutor,
    resetSyncLayoutPersistenceMocks,
    type MockSyncKnex
} from './syncLayoutPersistenceHarness'
import { createSnapshot, dashboardIds } from './syncLayoutPersistenceFixtures'

const schemaName = 'app_018f8a787b8f7c1da111222233334444'

let currentKnex: MockSyncKnex
configureSyncLayoutPersistenceKnexAccessor(() => currentKnex)

const createMessengerHeaderSnapshot = (): PublishedApplicationSnapshot => {
    const snapshot = createSnapshot()
    Object.assign(snapshot.layouts?.[0], { templateKey: 'messenger-app' })
    Object.assign(snapshot.layoutZoneWidgets?.[0], {
        zone: 'top',
        widgetKey: 'header',
        instanceKey: 'messenger-header',
        sourceWidgetId: null,
        sourceBaseWidgetId: null,
        config: {}
    })
    return snapshot
}

describe('Messenger layout zone sync normalization', () => {
    beforeEach(() => {
        resetSyncLayoutPersistenceMocks()
        currentKnex = createMockSyncKnex()
    })

    it.each(['top', 'center', 'bottom'] as const)('accepts Messenger zone %s in snapshot normalization', (zone) => {
        expect(normalizeLayoutZone(zone, 'messenger-app')).toBe(zone)
    })

    it('rejects zones owned by other templates during Messenger snapshot normalization', () => {
        expect(() => normalizeLayoutZone('marketing-main', 'messenger-app')).toThrow('Invalid messenger-app layout widget zone')
        expect(() => normalizeLayoutZone('left', 'messenger-app')).toThrow('Invalid messenger-app layout widget zone')
    })

    it('compares a persisted Messenger top-zone widget against the same publication snapshot without drift', async () => {
        const snapshot = createMessengerHeaderSnapshot()
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: dashboardIds.layout,
                    source_layout_id: dashboardIds.layout,
                    scope_entity_id: null,
                    template_key: 'messenger-app',
                    name: { en: 'Main' },
                    description: null,
                    config: { __layout: { composition: { mode: 'independent', baseLayoutId: null } } },
                    is_active: true,
                    is_default: true,
                    sort_order: 0,
                    source_kind: 'metahub',
                    source_content_hash: 'a'.repeat(64),
                    local_content_hash: 'a'.repeat(64),
                    sync_state: 'clean',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ],
            widgetRows: [
                {
                    id: dashboardIds.widget,
                    layout_id: dashboardIds.layout,
                    source_widget_id: null,
                    source_base_widget_id: null,
                    zone: 'top',
                    widget_key: 'header',
                    instance_key: 'messenger-header',
                    parent_widget_id: null,
                    slot_key: null,
                    sort_order: 1,
                    config: {},
                    is_active: true,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })

        await expect(hasPublishedWidgetsChanges({ schemaName, snapshot, executor: mockSyncExecutor })).resolves.toBe(false)
    })
})
