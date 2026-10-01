export type { EntityDefinition } from '@universo-react/schema-ddl'
export {
    buildSingleTargetWidgetBinding,
    decodeWidgetConfigEnvelope,
    encodeWidgetConfigEnvelope,
    getLayoutWidgetDefinition
} from '@universo-react/types'
export {
    buildMergedDashboardLayoutConfig,
    materializeSnapshotLayoutsAndWidgets,
    normalizeSnapshotLayoutZoneWidgets,
    normalizeSnapshotLayouts,
    remapSnapshotLayoutScopeEntityIds,
    remapSnapshotMenuWidgetTargets,
    withWorkspaceRuntimeLayoutWidgets
} from '../../routes/sync/syncHelpers'
export { buildRuntimeSnapshotForApplicationSync } from '../../routes/sync/syncEngine'
export type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
export { stableLineageUuidV7 } from '../../shared/applicationLayoutWidgetLineage'

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
