import {
    createEmptyRuntimeZoneWidgets,
    isRuntimeDashboardZone,
    isRuntimeEnumerationKind,
    isRuntimeHubKind,
    isRuntimeObjectTargetKind,
    isRuntimeServerOwnedAttr,
    isRuntimeSetKind,
    mapRuntimeZoneWidgets,
    readRuntimeRecordAccessConfig,
    runtimeRelationScopeSchema,
    runtimeReorderBodySchema,
    resolveRuntimeStandardKind,
    type RuntimeZoneWidgetRow
} from '../../../services/runtimeRowSupport/contracts'
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

describe('runtimeRelationScopeSchema', () => {
    it('accepts only strict semantic scopes with UUID v7 parent identities', () => {
        expect(
            runtimeRelationScopeSchema.safeParse({
                fieldCodename: 'CourseId',
                parentRecordId: '0190a9b5-3cde-7abc-8def-0123456789d2'
            }).success
        ).toBe(true)
        expect(
            runtimeRelationScopeSchema.safeParse({
                fieldCodename: 'CourseId',
                parentRecordId: '550e8400-e29b-41d4-a716-446655440000'
            }).success
        ).toBe(false)
        expect(
            runtimeRelationScopeSchema.safeParse({
                fieldCodename: 'CourseId',
                parentRecordId: '0190a9b5-3cde-7abc-8def-0123456789d2',
                layoutId: 'untrusted'
            }).success
        ).toBe(false)
    })
})

describe('runtimeReorderBodySchema', () => {
    const baseBody = {
        objectCollectionId: '018f8a78-7b8f-7c1d-a111-222233334401',
        orderedRowIds: ['018f8a78-7b8f-7c1d-a111-222233334402'],
        parentScope: {
            fieldCodename: 'CourseId',
            parentRecordId: '018f8a78-7b8f-7c1d-a111-222233334403'
        }
    }

    it('accepts an optional, semantic parent scope', () => {
        expect(runtimeReorderBodySchema.safeParse(baseBody).success).toBe(true)
        expect(
            runtimeReorderBodySchema.safeParse({ objectCollectionId: baseBody.objectCollectionId, orderedRowIds: baseBody.orderedRowIds })
                .success
        ).toBe(true)
    })

    it('rejects malformed scope fields and unknown scope properties', () => {
        expect(
            runtimeReorderBodySchema.safeParse({ ...baseBody, parentScope: { ...baseBody.parentScope, fieldCodename: 'Course Id' } })
                .success
        ).toBe(false)
        expect(
            runtimeReorderBodySchema.safeParse({ ...baseBody, parentScope: { ...baseBody.parentScope, unexpected: true } }).success
        ).toBe(false)
        expect(
            runtimeReorderBodySchema.safeParse({
                ...baseBody,
                parentScope: { ...baseBody.parentScope, parentRecordId: '550e8400-e29b-41d4-a716-446655440000' }
            }).success
        ).toBe(false)
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
