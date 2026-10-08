export type { EntityDefinition } from '@universo-react/schema-ddl'
export {
    buildSingleTargetWidgetBinding,
    decodeWidgetConfigEnvelope,
    encodeWidgetConfigEnvelope,
    getDashboardWidgetDefinition,
    getLayoutWidgetDefinition
} from '@universo-react/types'
export { buildMergedDashboardLayoutConfig, remapSnapshotLayoutScopeEntityIds } from '../../routes/sync/syncHelpers'
import {
    materializeSnapshotLayoutsAndWidgets as materialize,
    normalizeSnapshotLayoutZoneWidgets as normalizeWidgets,
    normalizeSnapshotLayouts as normalizeLayouts,
    withWorkspaceRuntimeLayoutWidgets as withWorkspaceWidgets
} from '../../routes/sync/syncHelpers'
import { buildRuntimeSnapshotForApplicationSync as buildRuntimeSnapshot } from '../../routes/sync/syncEngine'
export type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
export { stableLineageUuidV7 } from '../../shared/applicationLayoutWidgetLineage'

import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'

const withFixturePlacementFields = (snapshot: PublishedApplicationSnapshot): PublishedApplicationSnapshot => {
    const withWidgetPlacement = (value: unknown, keyField: 'id' | 'baseWidgetId') => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return value
        const row = value as Record<string, unknown>
        const identity = row[keyField]
        return {
            ...row,
            ...(!Object.prototype.hasOwnProperty.call(row, 'instanceKey')
                ? { instanceKey: `placement.${typeof identity === 'string' ? identity : 'test'}` }
                : {}),
            ...(!Object.prototype.hasOwnProperty.call(row, 'parentWidgetId') ? { parentWidgetId: null } : {}),
            ...(!Object.prototype.hasOwnProperty.call(row, 'slotKey') ? { slotKey: null } : {})
        }
    }
    const layoutZoneWidgets = Array.isArray(snapshot.layoutZoneWidgets)
        ? snapshot.layoutZoneWidgets.map((widget) => withWidgetPlacement(widget, 'id'))
        : undefined
    const baseWidgetsById = new Map(
        (layoutZoneWidgets ?? []).map((widget) => [String((widget as Record<string, unknown>).id), widget as Record<string, unknown>])
    )
    const layoutWidgetOverrides = Array.isArray(snapshot.layoutWidgetOverrides)
        ? snapshot.layoutWidgetOverrides.map((widget) => {
              const row = widget as Record<string, unknown>
              const base = baseWidgetsById.get(String(row.baseWidgetId))
              return {
                  ...(base
                      ? {
                            instanceKey: base.instanceKey,
                            parentWidgetId: base.parentWidgetId,
                            slotKey: base.slotKey
                        }
                      : {}),
                  ...row
              }
          })
        : undefined
    return {
        ...snapshot,
        ...(layoutZoneWidgets ? { layoutZoneWidgets } : {}),
        ...(layoutWidgetOverrides ? { layoutWidgetOverrides } : {})
    }
}

/** Legacy behavioral fixtures get explicit placement defaults; production parsers remain strict. */
export const materializeSnapshotLayoutsAndWidgets = (snapshot: PublishedApplicationSnapshot) =>
    materialize(withFixturePlacementFields(snapshot))
export const normalizeSnapshotLayoutZoneWidgets = (snapshot: PublishedApplicationSnapshot) =>
    normalizeWidgets(withFixturePlacementFields(snapshot))
export const normalizeSnapshotLayouts = (snapshot: PublishedApplicationSnapshot) => normalizeLayouts(withFixturePlacementFields(snapshot))
export const withWorkspaceRuntimeLayoutWidgets = (snapshot: PublishedApplicationSnapshot, enabled: boolean) =>
    withWorkspaceWidgets(withFixturePlacementFields(snapshot), enabled)
export const buildRuntimeSnapshotForApplicationSync = (snapshot: PublishedApplicationSnapshot, entities: unknown[]) =>
    buildRuntimeSnapshot(withFixturePlacementFields(snapshot), entities as never)

export const createGlobalDashboardLayout = () => ({
    id: 'global-layout-1',
    templateKey: 'dashboard',
    compositionMode: 'independent',
    baseLayoutId: null,
    name: { en: 'Global default' },
    description: null,
    config: {},
    isActive: true,
    isDefault: true,
    sortOrder: 0
})
