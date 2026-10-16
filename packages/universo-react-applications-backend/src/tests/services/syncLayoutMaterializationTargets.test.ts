import { materializeSnapshotLayoutsAndWidgets } from '../../routes/sync/syncHelpers'
import { buildRuntimeSnapshotForApplicationSync, createGlobalDashboardLayout } from './syncLayoutMaterializationHarness'
import type { EntityDefinition, PublishedApplicationSnapshot } from './syncLayoutMaterializationHarness'

type SnapshotVlc = {
    _schema: '1'
    _primary: string
    locales: Record<string, { version: number; content: string; createdAt: string; updatedAt: string; isActive: boolean }>
}

const vlcOne = (content: string, primary = 'en'): SnapshotVlc => ({
    _schema: '1',
    _primary: primary,
    locales: {
        [primary]: { content, version: 1, isActive: true, createdAt: '1970-01-01T00:00:00.000Z', updatedAt: '1970-01-01T00:00:00.000Z' }
    }
})

describe('sync layout Entity scope and renderer config boundary', () => {
    it('remaps scoped layout Entity ids by codename without putting physical ids into widget config', () => {
        const snapshot: PublishedApplicationSnapshot = {
            entities: {
                '019f3100-0000-7000-8000-000000000101': {
                    id: '019f3100-0000-7000-8000-000000000101',
                    kind: 'object',
                    codename: vlcOne('Products'),
                    presentation: { name: vlcOne('Products') },
                    fields: []
                }
            },
            layouts: [createGlobalDashboardLayout()],
            scopedLayouts: [
                {
                    id: 'scoped-layout-1',
                    scopeEntityId: '019f3100-0000-7000-8000-000000000101',
                    baseLayoutId: 'global-layout-1',
                    compositionMode: 'overlay',
                    templateKey: 'dashboard',
                    name: { en: 'Products' },
                    description: null,
                    config: {},
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            layoutZoneWidgets: [
                {
                    id: 'dashboard-menu',
                    layoutId: 'global-layout-1',
                    instanceKey: 'main-menu',
                    parentWidgetId: null,
                    slotKey: null,
                    zone: 'left',
                    widgetKey: 'menuWidget',
                    sortOrder: 0,
                    config: { variant: 'generated' },
                    isActive: true
                }
            ]
        }
        const runtimeEntities = [
            {
                id: '019f3100-0000-7000-8000-000000000102',
                kind: 'object',
                codename: vlcOne('Products'),
                fields: [],
                presentation: { name: vlcOne('Products') }
            }
        ] as unknown as EntityDefinition[]

        const runtimeSnapshot = buildRuntimeSnapshotForApplicationSync(snapshot, runtimeEntities)
        const materialized = materializeSnapshotLayoutsAndWidgets(runtimeSnapshot)
        const menu = materialized.widgets.find((widget) => widget.instanceKey === 'main-menu')

        type ScopedLayoutFixture = { scopeEntityId?: string | null }
        expect((runtimeSnapshot.scopedLayouts as ScopedLayoutFixture[] | undefined)?.[0]?.scopeEntityId).toBe(
            '019f3100-0000-7000-8000-000000000102'
        )
        expect(menu?.config).toEqual({ variant: 'generated' })
        expect(JSON.stringify(menu?.config)).not.toContain('019f3100-0000-7000-8000-000000000102')
    })

    it('rejects legacy renderer config that embeds an Entity id', () => {
        const physicalEntityId = '019f3100-0000-7000-8000-000000000103'
        const snapshot: PublishedApplicationSnapshot = {
            entities: {},
            layouts: [createGlobalDashboardLayout()],
            layoutZoneWidgets: [
                {
                    id: 'legacy-table',
                    layoutId: 'global-layout-1',
                    instanceKey: 'legacy-table',
                    parentWidgetId: null,
                    slotKey: null,
                    zone: 'center',
                    widgetKey: 'detailsTable',
                    sortOrder: 0,
                    config: { targetEntityId: physicalEntityId },
                    isActive: true
                }
            ]
        }

        expect(() => materializeSnapshotLayoutsAndWidgets(snapshot)).toThrow('invalid dashboard widget configuration')
    })
})
