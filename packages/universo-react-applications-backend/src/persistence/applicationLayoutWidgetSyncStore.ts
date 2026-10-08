import { qSchemaTable } from '@universo-react/database'
import { applicationTemplateKeySchema, type ApplicationTemplateKey } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import { orderApplicationWidgetGraph } from './applicationWidgetGraphOrder'
import {
    assertInterpretationNetworkSingleSystemTransitionAllowed,
    lockInterpretationNetworkStructureMode
} from '../shared/interpretationNetworkStructureModeGuard'
import {
    assertApplicationLayoutWidgetMultiplicity,
    isRecord,
    readWidgetConfigEnvelope,
    runApplicationLayoutTransaction
} from './applicationLayoutStoreSupport'
import { containsPersistedRequiredEntityBackedWidget } from './applicationLayoutEntityBindingPolicy'
import {
    allocatePhysicalUuid,
    insertApplicationLayoutSyncWidget,
    listApplicationLayoutSyncRows,
    listApplicationLayoutSyncWidgets,
    lockApplicationLayoutSyncHierarchy,
    sourceLayoutIdentity,
    tombstoneApplicationLayoutWidgetsForSourceRemoval,
    widgetSourceId,
    type ApplicationLayoutSyncLayoutRow,
    type ApplicationLayoutSyncWidgetRow,
    type SyncWidgetInput
} from './applicationLayoutSyncStore'
import { resolveSyncedApplicationLayoutWidgetState } from '../services/applicationLayoutWidgetSourceState'
import { resolvePlacementRegistryDefinition, validatePlacementGraph, type PlacementGraphNode } from './applicationLayoutWidgetPlacement'

type JsonRecord = Record<string, unknown>

const json = (value: unknown): string => JSON.stringify(value ?? null)

const widgetLineageKey = (layoutId: string, row: SyncWidgetInput): string => {
    if (row.sourceBaseWidgetId) return `${layoutId}:base:${row.sourceBaseWidgetId}`
    if (row.sourceLineageKey) return `${layoutId}:lineage:${row.sourceLineageKey}`
    return `${layoutId}:source:${row.id}`
}

const updateWidget = async (
    executor: DbExecutor,
    table: string,
    physicalWidgetId: string,
    physicalLayoutId: string,
    row: SyncWidgetInput,
    state: ReturnType<typeof resolveSyncedApplicationLayoutWidgetState>,
    sourceContentHash: string | null,
    userId: string | null
): Promise<void> => {
    const result = await executor.query<{ id: string }>(
        `
        UPDATE ${table}
        SET layout_id = $2,
            zone = $3,
            widget_key = $4,
            sort_order = $5,
            config = $6::jsonb,
            source_config = $7::jsonb,
            source_state = $8::jsonb,
            is_active = $9,
            source_widget_id = $10,
            source_base_widget_id = $11,
            source_content_hash = $12,
            local_content_hash = $12,
            instance_key = $14,
            parent_widget_id = $15,
            slot_key = $16,
            _upl_updated_at = NOW(),
            _upl_updated_by = $13,
            _upl_version = COALESCE(_upl_version, 1) + 1,
            _upl_deleted = false,
            _upl_deleted_at = NULL,
            _upl_deleted_by = NULL,
            _app_deleted = false,
            _app_deleted_at = NULL,
            _app_deleted_by = NULL
        WHERE id = $1
          AND _app_deleted = false
          AND (
              _upl_deleted = false
              OR (
                  source_widget_id IS NOT DISTINCT FROM $10
                  AND source_base_widget_id IS NOT DISTINCT FROM $11
              )
          )
        RETURNING id
        `,
        [
            physicalWidgetId,
            physicalLayoutId,
            state.zone,
            row.widgetKey,
            state.sortOrder,
            json(state.config),
            json(row.config),
            json(state.sourceState),
            state.isActive,
            widgetSourceId(row),
            row.sourceBaseWidgetId ?? null,
            sourceContentHash,
            userId,
            row.instanceKey,
            row.parentWidgetId,
            row.slotKey
        ]
    )
    if (result.length !== 1) throw new Error('[SchemaSync] Widget update lost its target row')
}

const touchApplicationLayoutVersions = async (
    executor: DbExecutor,
    layoutsTable: string,
    layoutIds: ReadonlySet<string>,
    userId: string | null
): Promise<void> => {
    const orderedLayoutIds = [...layoutIds].sort((left, right) => left.localeCompare(right))
    if (orderedLayoutIds.length === 0) return
    const rows = await executor.query<{ id: string }>(
        `
        UPDATE ${layoutsTable}
        SET _upl_updated_at = NOW(),
            _upl_updated_by = $2,
            _upl_version = COALESCE(_upl_version, 1) + 1
        WHERE id = ANY($1::uuid[])
          AND _upl_deleted = false
          AND _app_deleted = false
        RETURNING id
        `,
        [orderedLayoutIds, userId]
    )
    if (rows.length !== orderedLayoutIds.length) {
        throw new Error('[SchemaSync] Parent layout version refresh lost a touched layout')
    }
}

const getLayoutSourceMaps = (rows: readonly ApplicationLayoutSyncLayoutRow[]) => {
    const sourceToPhysical = new Map<string, string>()
    const physicalToSource = new Map<string, string>()
    for (const row of rows) {
        const source = sourceLayoutIdentity(row)
        if (!source) continue
        if (sourceToPhysical.has(source) && sourceToPhysical.get(source) !== row.id) {
            throw new Error('[SchemaSync] Existing application layouts contain duplicate source lineage')
        }
        sourceToPhysical.set(source, row.id)
        physicalToSource.set(row.id, source)
    }
    return { sourceToPhysical, physicalToSource }
}

export async function syncApplicationWidgets(
    executor: DbExecutor,
    schemaName: string,
    input: { widgets: readonly SyncWidgetInput[]; userId: string | null }
): Promise<void> {
    const run = async (tx: DbExecutor): Promise<void> => {
        const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
        const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
        await lockInterpretationNetworkStructureMode(tx, schemaName)
        await lockApplicationLayoutSyncHierarchy(tx, schemaName)
        const layoutRows = await listApplicationLayoutSyncRows(tx, schemaName)
        const { sourceToPhysical } = getLayoutSourceMaps(layoutRows)
        for (const widget of input.widgets) {
            if (!sourceToPhysical.has(widget.layoutId)) {
                throw new Error(`[SchemaSync] Snapshot widget references a layout missing source lineage ${widget.layoutId}`)
            }
        }
        const templateByLayoutId = new Map<string, ApplicationTemplateKey>()
        for (const layout of layoutRows) {
            if (layout._app_deleted) continue
            const templateKey = applicationTemplateKeySchema.safeParse(layout.template_key)
            if (!templateKey.success) throw new Error(`[SchemaSync] Persisted layout ${layout.id} template key is invalid`)
            templateByLayoutId.set(layout.id, templateKey.data)
        }
        const validateWidgetGroups = (
            rows: readonly { layoutId: string; widgetKey: string }[],
            resolveLayoutId: (row: { layoutId: string }) => string | null
        ): void => {
            const grouped = new Map<string, { widgetKey: string }[]>()
            for (const row of rows) {
                const physicalLayoutId = resolveLayoutId(row)
                if (!physicalLayoutId) continue
                const group = grouped.get(physicalLayoutId) ?? []
                group.push({ widgetKey: row.widgetKey })
                grouped.set(physicalLayoutId, group)
            }
            for (const [physicalLayoutId, widgets] of grouped) {
                const templateKey = templateByLayoutId.get(physicalLayoutId)
                if (templateKey) assertApplicationLayoutWidgetMultiplicity(templateKey, widgets)
            }
        }
        validateWidgetGroups(input.widgets, (row) => sourceToPhysical.get(row.layoutId) ?? null)
        const inheritedLayouts = layoutRows.filter(
            (row) =>
                row.source_kind === 'metahub' &&
                row.is_active !== false &&
                !row.is_source_excluded &&
                !row._upl_deleted &&
                !row._app_deleted
        )
        const cleanLayoutIds = new Set(inheritedLayouts.filter((row) => row.sync_state === 'clean').map((row) => row.id))
        const candidateSyncableRows = input.widgets
            .map((row) => ({ row, physicalLayoutId: sourceToPhysical.get(row.layoutId) }))
            .filter((item): item is { row: SyncWidgetInput; physicalLayoutId: string } => item.physicalLayoutId !== undefined)
            .filter((item) => inheritedLayouts.some((layout) => layout.id === item.physicalLayoutId))
        const existingRows = await listApplicationLayoutSyncWidgets(tx, schemaName)
        const applicationDeletedLineage = new Set<string>()
        for (const row of existingRows) {
            if (!row._app_deleted) continue
            const lineage =
                row.source_base_widget_id !== null
                    ? `${row.layout_id}:base:${row.source_base_widget_id}`
                    : row.source_widget_id === null
                    ? null
                    : `${row.layout_id}:source:${row.source_widget_id}`
            if (lineage) applicationDeletedLineage.add(lineage)
        }
        // Application tombstones retain source lineage and instance_key; matching source rows stay excluded
        // instead of being allocated a second physical row that violates the per-layout key constraint.
        const syncableRows = candidateSyncableRows.filter(({ row, physicalLayoutId }) => {
            const lineage = row.sourceBaseWidgetId
                ? `${physicalLayoutId}:base:${row.sourceBaseWidgetId}`
                : `${physicalLayoutId}:source:${widgetSourceId(row)}`
            return !applicationDeletedLineage.has(lineage)
        })
        const canonicalCurrentConfigById = new Map<string, JsonRecord>()
        for (const row of existingRows) {
            if (row._app_deleted) continue
            const templateKey = templateByLayoutId.get(row.layout_id)
            if (!templateKey) throw new Error(`[SchemaSync] Persisted widget ${row.id} references an invalid layout`)
            if (!isRecord(row.config)) throw new Error(`[SchemaSync] Persisted widget ${row.id} config is invalid`)
            readWidgetConfigEnvelope(templateKey, row.widget_key, row.zone, row.config)
            canonicalCurrentConfigById.set(row.id, row.config)
        }
        validateWidgetGroups(
            existingRows
                .filter((row) => !row._upl_deleted && !row._app_deleted)
                .map((row) => ({ layoutId: row.layout_id, widgetKey: row.widget_key })),
            (row) => row.layoutId
        )
        const existingById = new Map(existingRows.filter((row) => !row._app_deleted).map((row) => [row.id, row]))
        const existingByLineage = new Map<string, string>()
        const tombstonedByLineage = new Map<string, string>()
        for (const row of existingRows) {
            if (row._app_deleted) continue
            const lineage =
                row.source_base_widget_id !== null
                    ? `${row.layout_id}:base:${row.source_base_widget_id}`
                    : row.source_widget_id === null
                    ? null
                    : `${row.layout_id}:source:${row.source_widget_id}`
            if (!lineage) continue
            const target = row._upl_deleted ? tombstonedByLineage : existingByLineage
            if (target.has(lineage) && target.get(lineage) !== row.id) {
                throw new Error('[SchemaSync] Existing application widgets contain duplicate source lineage')
            }
            target.set(lineage, row.id)
        }
        for (const lineage of existingByLineage.keys()) {
            if (tombstonedByLineage.has(lineage)) {
                throw new Error('[SchemaSync] Existing application widgets contain active and tombstoned duplicate lineage')
            }
        }

        const sourceRemovedLayoutIds = layoutRows
            .filter(
                (row) =>
                    row.source_kind === 'metahub' &&
                    !row._app_deleted &&
                    (row.is_source_excluded || (row.sync_state === 'source_removed' && row.is_active === false))
            )
            .map((row) => row.id)
        for (const sourceRemovedLayoutId of sourceRemovedLayoutIds) {
            await tombstoneApplicationLayoutWidgetsForSourceRemoval(tx, schemaName, sourceRemovedLayoutId, input.userId)
        }

        const pending: Array<{
            physicalId: string
            physicalLayoutId: string
            row: SyncWidgetInput
            current: ApplicationLayoutSyncWidgetRow | undefined
            state: ReturnType<typeof resolveSyncedApplicationLayoutWidgetState>
        }> = []
        const nextPhysicalIds = new Set<string>()
        const usedPhysicalIds = new Set(existingRows.filter((row) => !row._app_deleted).map((row) => row.id))
        const nextLineageKeys = new Set<string>()
        const touchedLayoutIds = new Set<string>()
        const prepared: Array<{
            physicalId: string
            physicalLayoutId: string
            row: SyncWidgetInput
            current: ApplicationLayoutSyncWidgetRow | undefined
        }> = []
        const physicalIdBySnapshotWidgetId = new Map<string, string>()

        for (const { row, physicalLayoutId } of syncableRows) {
            const key = widgetLineageKey(physicalLayoutId, row)
            if (nextLineageKeys.has(key)) throw new Error('[SchemaSync] Snapshot contains duplicate application widget lineage')
            nextLineageKeys.add(key)
            const lineage = row.sourceBaseWidgetId
                ? `${physicalLayoutId}:base:${row.sourceBaseWidgetId}`
                : `${physicalLayoutId}:source:${widgetSourceId(row)}`
            let physicalId = existingByLineage.get(lineage) ?? tombstonedByLineage.get(lineage)

            if (!physicalId && row.sourceLineageKey) {
                const generatedCandidates = existingRows.filter(
                    (candidate) =>
                        !candidate._app_deleted &&
                        !candidate._upl_deleted &&
                        candidate.layout_id === physicalLayoutId &&
                        candidate.source_base_widget_id === null &&
                        candidate.widget_key === row.widgetKey &&
                        candidate.zone === row.zone
                )
                if (generatedCandidates.length > 1) throw new Error('[SchemaSync] Generated widget lineage is ambiguous')
                physicalId = generatedCandidates[0]?.id
            }
            if (!physicalId) physicalId = allocatePhysicalUuid(usedPhysicalIds)
            if (nextPhysicalIds.has(physicalId)) throw new Error('[SchemaSync] Snapshot resolves multiple widgets to one physical identity')
            nextPhysicalIds.add(physicalId)
            const current = existingById.get(physicalId)
            if (current && current.layout_id !== physicalLayoutId) {
                throw new Error('[SchemaSync] Snapshot widget identity collides with an unrelated application widget')
            }
            if (physicalIdBySnapshotWidgetId.has(row.id)) throw new Error('[SchemaSync] Snapshot widget identity is duplicated')
            physicalIdBySnapshotWidgetId.set(row.id, physicalId)
            prepared.push({
                physicalId,
                physicalLayoutId,
                row,
                current
            })
        }

        for (const item of prepared) {
            const parentWidgetId =
                item.row.parentWidgetId === null
                    ? null
                    : physicalIdBySnapshotWidgetId.get(item.row.parentWidgetId) ??
                      (() => {
                          throw new Error('[SchemaSync] Snapshot widget parent cannot be remapped')
                      })()
            const row = { ...item.row, parentWidgetId }
            const templateKey = templateByLayoutId.get(item.physicalLayoutId)
            if (!templateKey) throw new Error(`[SchemaSync] Persisted widget ${row.id} references an invalid layout`)
            const state = resolveSyncedApplicationLayoutWidgetState(templateKey, row, item.current)
            touchedLayoutIds.add(item.physicalLayoutId)
            pending.push({ ...item, row, state })
        }

        const transitions: Parameters<typeof assertInterpretationNetworkSingleSystemTransitionAllowed>[2] = pending.map((item) => ({
            current: item.current
                ? {
                      widgetKey: item.current.widget_key,
                      config: canonicalCurrentConfigById.get(item.current.id) as JsonRecord,
                      isActive: item.current.is_active
                  }
                : null,
            next: { widgetKey: item.row.widgetKey, config: item.state.config, isActive: item.state.isActive }
        }))
        if (transitions.length > 0) {
            await assertInterpretationNetworkSingleSystemTransitionAllowed(tx, schemaName, transitions, { lockAlreadyHeld: true })
        }

        const orderedPending = orderApplicationWidgetGraph(pending, (item) => ({
            id: item.physicalId,
            layoutId: item.physicalLayoutId,
            parentWidgetId: item.row.parentWidgetId
        }))
        for (const item of orderedPending) {
            if (item.current) {
                await updateWidget(
                    tx,
                    widgetsTable,
                    item.physicalId,
                    item.physicalLayoutId,
                    item.row,
                    item.state,
                    item.row.sourceContentHash,
                    input.userId
                )
            } else {
                await insertApplicationLayoutSyncWidget(
                    tx,
                    widgetsTable,
                    item.physicalId,
                    item.physicalLayoutId,
                    item.row,
                    item.row.sourceContentHash,
                    input.userId,
                    { sourceState: item.state.sourceState }
                )
            }
        }

        const nextIds = [...nextPhysicalIds]
        const locallyModifiedLayoutIds = inheritedLayouts.filter((row) => row.sync_state !== 'clean').map((row) => row.id)
        if (locallyModifiedLayoutIds.length > 0) {
            const locallyModifiedLayoutIdSet = new Set(locallyModifiedLayoutIds)
            const removedSourceWidgetIdsToDeactivate = new Set<string>()
            const removedSourceWidgetIdsToDetach = new Set<string>()
            for (const row of existingRows) {
                if (
                    !locallyModifiedLayoutIdSet.has(row.layout_id) ||
                    row.source_widget_id === null ||
                    row.source_widget_id === undefined ||
                    nextPhysicalIds.has(row.id) ||
                    row._upl_deleted ||
                    row._app_deleted
                ) {
                    continue
                }
                if (row.source_base_widget_id !== null && row.source_base_widget_id !== undefined) {
                    if (row.is_active !== false) removedSourceWidgetIdsToDeactivate.add(row.id)
                    continue
                }
                const templateKey = templateByLayoutId.get(row.layout_id)
                if (!templateKey) throw new Error(`[SchemaSync] Persisted widget ${row.id} references an invalid layout`)
                if (containsPersistedRequiredEntityBackedWidget(templateKey, [row])) {
                    if (row.is_active !== false) removedSourceWidgetIdsToDeactivate.add(row.id)
                } else {
                    removedSourceWidgetIdsToDetach.add(row.id)
                }
            }
            const rows = await tx.query<{ id: string; layout_id: string }>(
                `
                UPDATE ${widgetsTable}
                SET source_config = CASE WHEN id = ANY($5::uuid[]) THEN NULL ELSE source_config END,
                    source_state = CASE WHEN id = ANY($5::uuid[]) THEN NULL ELSE source_state END,
                    source_widget_id = CASE WHEN id = ANY($5::uuid[]) THEN NULL ELSE source_widget_id END,
                    source_base_widget_id = CASE WHEN id = ANY($5::uuid[]) THEN NULL ELSE source_base_widget_id END,
                    source_content_hash = CASE WHEN id = ANY($5::uuid[]) THEN NULL ELSE source_content_hash END,
                    local_content_hash = CASE WHEN id = ANY($5::uuid[]) THEN NULL ELSE local_content_hash END,
                    is_active = CASE
                        WHEN id = ANY($4::uuid[]) THEN false
                        WHEN source_base_widget_id IS NULL THEN is_active
                        ELSE false
                    END,
                    _upl_deleted = CASE WHEN id = ANY($4::uuid[]) THEN true ELSE _upl_deleted END,
                    _upl_deleted_at = CASE WHEN id = ANY($4::uuid[]) THEN NOW() ELSE _upl_deleted_at END,
                    _upl_deleted_by = CASE WHEN id = ANY($4::uuid[]) THEN $3 ELSE _upl_deleted_by END,
                    _upl_updated_at = NOW(), _upl_updated_by = $3,
                    _upl_version = COALESCE(_upl_version, 1) + 1
                WHERE layout_id = ANY($1::uuid[])
                  AND source_widget_id IS NOT NULL
                  AND NOT (id = ANY($2::uuid[]))
                  AND _upl_deleted = false
                  AND _app_deleted = false
                RETURNING id, layout_id
                `,
                [
                    locallyModifiedLayoutIds,
                    nextIds,
                    input.userId,
                    [...removedSourceWidgetIdsToDeactivate],
                    [...removedSourceWidgetIdsToDetach]
                ]
            )
            for (const row of rows) {
                if (row.layout_id) touchedLayoutIds.add(row.layout_id)
            }
        }

        const cleanLayoutIdList = [...cleanLayoutIds]
        if (cleanLayoutIdList.length > 0) {
            const rows = await tx.query<{ id: string; layout_id: string }>(
                `
                UPDATE ${widgetsTable}
                SET is_active = false,
                    _upl_deleted = true,
                    _upl_deleted_at = NOW(),
                    _upl_deleted_by = $3,
                    _upl_updated_at = NOW(),
                    _upl_updated_by = $3,
                    _upl_version = COALESCE(_upl_version, 1) + 1,
                    _app_deleted = false,
                    _app_deleted_at = NULL,
                    _app_deleted_by = NULL
                WHERE layout_id = ANY($1::uuid[])
                  AND source_widget_id IS NOT NULL
                  AND NOT (id = ANY($2::uuid[]))
                  AND _upl_deleted = false
                  AND _app_deleted = false
                RETURNING id, layout_id
                `,
                [cleanLayoutIdList, nextIds, input.userId]
            )
            for (const row of rows) {
                if (row.layout_id) touchedLayoutIds.add(row.layout_id)
            }
        }

        const verifiedRows = await listApplicationLayoutSyncWidgets(tx, schemaName)
        const effectiveNodesByLayout = new Map<string, PlacementGraphNode[]>()
        for (const row of verifiedRows) {
            if (row._upl_deleted || row._app_deleted || !row.is_active) continue
            const templateKey = templateByLayoutId.get(row.layout_id)
            if (!templateKey || !isRecord(row.config)) throw new Error('[SchemaSync] Synced widget row is invalid')
            const decoded = readWidgetConfigEnvelope(templateKey, row.widget_key, row.zone, row.config)
            const nodes = effectiveNodesByLayout.get(row.layout_id) ?? []
            nodes.push({
                id: row.id,
                layoutId: row.layout_id,
                templateKey,
                widgetKey: row.widget_key,
                zone: row.zone,
                rendererConfig: decoded.rendererConfig,
                instanceKey: row.instance_key,
                parentWidgetId: row.parent_widget_id,
                slotKey: row.slot_key
            })
            effectiveNodesByLayout.set(row.layout_id, nodes)
        }
        for (const nodes of effectiveNodesByLayout.values()) {
            validatePlacementGraph(nodes, { effectiveGraph: true, resolveRegistryDefinition: resolvePlacementRegistryDefinition })
        }

        await touchApplicationLayoutVersions(tx, layoutsTable, touchedLayoutIds, input.userId)
    }

    await runApplicationLayoutTransaction(executor, run)
}
