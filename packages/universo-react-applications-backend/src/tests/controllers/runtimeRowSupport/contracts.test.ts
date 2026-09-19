import {
    createEmptyRuntimeZoneWidgets,
    isRuntimeDashboardZone,
    isRuntimeEnumerationKind,
    isRuntimeHubKind,
    isRuntimeObjectTargetKind,
    isRuntimeServerOwnedAttr,
    isRuntimeSetKind,
    mapRuntimeZoneWidgets,
    partitionRuntimeMenuItems,
    readRuntimeRecordAccessConfig,
    resolveRuntimeStandardKind,
    type RuntimeZoneWidgetRow
} from '../../../controllers/runtimeRowSupport/contracts'
import { UpdateFailure } from '../../../shared/runtimeHelpers'

const zoneRow = (overrides: Partial<RuntimeZoneWidgetRow> = {}): RuntimeZoneWidgetRow => ({
    id: 'widget-1',
    layout_id: 'layout-1',
    widget_key: 'menu-widget',
    sort_order: 2,
    config: { title: 'Menu' },
    zone: 'left',
    ...overrides
})

describe('mapRuntimeZoneWidgets', () => {
    it('returns empty arrays for every dashboard zone when there are no rows', () => {
        expect(mapRuntimeZoneWidgets([])).toEqual(createEmptyRuntimeZoneWidgets())
    })

    it('groups rows by zone and maps row fields to camelCase widgets', () => {
        const result = mapRuntimeZoneWidgets([
            zoneRow(),
            zoneRow({ id: 'widget-2', zone: 'top' }),
            zoneRow({ id: 'widget-3', zone: 'right' }),
            zoneRow({ id: 'widget-4', zone: 'bottom' }),
            zoneRow({ id: 'widget-5', zone: 'center' })
        ])
        expect(result.left).toEqual([
            { id: 'widget-1', layoutId: 'layout-1', widgetKey: 'menu-widget', sortOrder: 2, config: { title: 'Menu' } }
        ])
        expect(result.top.map((widget) => widget.id)).toEqual(['widget-2'])
        expect(result.right.map((widget) => widget.id)).toEqual(['widget-3'])
        expect(result.bottom.map((widget) => widget.id)).toEqual(['widget-4'])
        expect(result.center.map((widget) => widget.id)).toEqual(['widget-5'])
    })

    it('falls back to an empty config object and zero sort order', () => {
        const malformed = zoneRow({ config: null, sort_order: 'not-a-number' as unknown as number })
        const [widget] = mapRuntimeZoneWidgets([malformed]).left
        expect(widget.config).toEqual({})
        expect(widget.sortOrder).toBe(0)
    })

    it('fails closed on an unsupported persisted zone', () => {
        let captured: unknown
        try {
            mapRuntimeZoneWidgets([zoneRow({ zone: 'sidebar' })])
        } catch (error) {
            captured = error
        }
        expect(captured).toBeInstanceOf(UpdateFailure)
        expect((captured as UpdateFailure).statusCode).toBe(409)
        expect((captured as UpdateFailure).body).toEqual({
            error: 'Runtime layout contains an unsupported zone',
            code: 'LAYOUT_PERSISTED_INVALID'
        })
    })
})

describe('isRuntimeDashboardZone', () => {
    it('accepts exactly the five dashboard zones', () => {
        expect(['left', 'top', 'right', 'bottom', 'center'].every((zone) => isRuntimeDashboardZone(zone))).toBe(true)
        expect(isRuntimeDashboardZone('sidebar')).toBe(false)
        expect(isRuntimeDashboardZone(7)).toBe(false)
    })
})

describe('partitionRuntimeMenuItems', () => {
    it('keeps every item in primary when there is no limit', () => {
        expect(partitionRuntimeMenuItems(['a', 'b'], null, null, 'overflow')).toEqual({
            primaryItems: ['a', 'b'],
            overflowItems: []
        })
        expect(partitionRuntimeMenuItems(['a'], null, 'workspace', 'overflow')).toEqual({
            primaryItems: ['a'],
            overflowItems: ['workspace']
        })
    })

    it('splits items at the primary limit and appends the workspace to overflow', () => {
        expect(partitionRuntimeMenuItems(['a', 'b', 'c'], 2, 'workspace', 'overflow')).toEqual({
            primaryItems: ['a', 'b'],
            overflowItems: ['c', 'workspace']
        })
    })

    it('reserves one primary slot for the workspace item', () => {
        expect(partitionRuntimeMenuItems(['a', 'b'], 2, 'workspace', 'primary')).toEqual({
            primaryItems: ['a', 'workspace'],
            overflowItems: ['b']
        })
    })

    it('drops the workspace item when its placement is hidden', () => {
        expect(partitionRuntimeMenuItems(['a'], 1, 'workspace', 'hidden')).toEqual({ primaryItems: ['a'], overflowItems: [] })
    })

    it('moves every item to overflow at a zero limit', () => {
        expect(partitionRuntimeMenuItems(['a', 'b'], 0, null, 'primary')).toEqual({ primaryItems: [], overflowItems: ['a', 'b'] })
        expect(partitionRuntimeMenuItems(['a', 'b'], 0, 'workspace', 'primary')).toEqual({
            primaryItems: ['workspace'],
            overflowItems: ['a', 'b']
        })
    })
})

describe('runtime standard kind helpers', () => {
    it('resolves builtin kinds and rejects unknown or non-string values', () => {
        expect(resolveRuntimeStandardKind('hub')).toBe('hub')
        expect(resolveRuntimeStandardKind('object')).toBe('object')
        expect(resolveRuntimeStandardKind('catalog')).toBeNull()
        expect(resolveRuntimeStandardKind(12)).toBeNull()
    })

    it('classifies enumeration, set and hub kinds', () => {
        expect(isRuntimeEnumerationKind('enumeration')).toBe(true)
        expect(isRuntimeEnumerationKind('object')).toBe(false)
        expect(isRuntimeSetKind('set')).toBe(true)
        expect(isRuntimeHubKind('hub')).toBe(true)
        expect(isRuntimeHubKind('set')).toBe(false)
    })

    it('treats non-registry kinds as object targets and excludes the other standard kinds', () => {
        expect(isRuntimeObjectTargetKind('object')).toBe(true)
        expect(isRuntimeObjectTargetKind('catalog')).toBe(true)
        expect(isRuntimeObjectTargetKind('hub')).toBe(false)
        expect(isRuntimeObjectTargetKind('set')).toBe(false)
        expect(isRuntimeObjectTargetKind('enumeration')).toBe(false)
        expect(isRuntimeObjectTargetKind('page')).toBe(false)
        expect(isRuntimeObjectTargetKind('ledger')).toBe(false)
        expect(isRuntimeObjectTargetKind(null)).toBe(false)
    })
})

describe('readRuntimeRecordAccessConfig', () => {
    it('parses a codename owner config and defaults the shared relation key', () => {
        expect(readRuntimeRecordAccessConfig({ runtimeRecordAccess: { mode: 'ownerOrShared', ownerFieldCodename: 'owner' } })).toEqual({
            mode: 'ownerOrShared',
            ownerFieldCodename: 'owner',
            sharedRelationKey: 'shared'
        })
    })

    it('parses a column owner config', () => {
        expect(readRuntimeRecordAccessConfig({ runtimeRecordAccess: { mode: 'ownerOrShared', ownerColumnName: 'owner_id' } })).toEqual({
            mode: 'ownerOrShared',
            ownerColumnName: 'owner_id',
            sharedRelationKey: 'shared'
        })
    })

    it('returns null for missing, ownerless, wrong-mode and unknown-key configs', () => {
        expect(readRuntimeRecordAccessConfig(null)).toBeNull()
        expect(readRuntimeRecordAccessConfig({})).toBeNull()
        expect(readRuntimeRecordAccessConfig({ runtimeRecordAccess: { mode: 'ownerOrShared' } })).toBeNull()
        expect(readRuntimeRecordAccessConfig({ runtimeRecordAccess: { mode: 'parentRecord', ownerColumnName: 'owner_id' } })).toBeNull()
        expect(
            readRuntimeRecordAccessConfig({ runtimeRecordAccess: { mode: 'ownerOrShared', ownerColumnName: 'owner_id', extra: 1 } })
        ).toBeNull()
    })
})

describe('isRuntimeServerOwnedAttr', () => {
    it('is true only for an explicit boolean serverOwned flag', () => {
        expect(isRuntimeServerOwnedAttr({ ui_config: { serverOwned: true } })).toBe(true)
        expect(isRuntimeServerOwnedAttr({ ui_config: { serverOwned: 'true' } })).toBe(false)
        expect(isRuntimeServerOwnedAttr({ ui_config: {} })).toBe(false)
        expect(isRuntimeServerOwnedAttr({})).toBe(false)
        expect(isRuntimeServerOwnedAttr({ ui_config: null })).toBe(false)
    })
})
