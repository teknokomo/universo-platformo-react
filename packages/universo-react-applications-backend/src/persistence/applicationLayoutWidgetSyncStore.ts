import { qSchemaTable } from '@universo-react/database'
import { applicationTemplateKeySchema, type ApplicationTemplateKey } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import {
    assertInterpretationNetworkSingleSystemTransitionAllowed,
    lockInterpretationNetworkStructureMode
} from '../shared/interpretationNetworkStructureModeGuard'
import { assertApplicationLayoutWidgetMultiplicity, isRecord, runApplicationLayoutTransaction } from './applicationLayoutStoreSupport'
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
    config: JsonRecord,
    isActive: boolean,
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
            is_active = $8,
            source_widget_id = $9,
            source_base_widget_id = $10,
            source_content_hash = $11,
            local_content_hash = $11,
            _upl_updated_at = NOW(),
            _upl_updated_by = $12,
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
                  source_widget_id IS NOT DISTINCT FROM $9
                  AND source_base_widget_id IS NOT DISTINCT FROM $10
              )
          )
        RETURNING id
        `,
        [
            physicalWidgetId,
            physicalLayoutId,
            row.zone,
            row.widgetKey,
            row.sortOrder,
            json(config),
            json(row.config),
            isActive,
            widgetSourceId(row),
            row.sourceBaseWidgetId ?? null,
            sourceContentHash,
            userId
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
            if (sourceToPhysical.has(widget.layoutId)) continue
            const legacyLayout = layoutRows.find(
                (layout) =>
                    layout.source_kind === 'metahub' && !layout.source_layout_id && layout.id === widget.layoutId && !layout._app_deleted
            )
            if (legacyLayout) sourceToPhysical.set(widget.layoutId, legacyLayout.id)
        }
        const templateByLayoutId = new Map<string, ApplicationTemplateKey>()
        for (const layout of layoutRows) {
            const templateKey = applicationTemplateKeySchema.safeParse(layout.template_key)
            if (templateKey.success) templateByLayoutId.set(layout.id, templateKey.data)
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
        const syncableRows = input.widgets
            .map((row) => ({ row, physicalLayoutId: sourceToPhysical.get(row.layoutId) ?? null }))
            .filter((item): item is { row: SyncWidgetInput; physicalLayoutId: string } => item.physicalLayoutId !== null)
            .filter((item) => inheritedLayouts.some((layout) => layout.id === item.physicalLayoutId))
        const existingRows = await listApplicationLayoutSyncWidgets(tx, schemaName)
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
            preserveApplicationOverride: boolean
        }> = []
        const nextPhysicalIds = new Set<string>()
        const usedPhysicalIds = new Set(existingRows.filter((row) => !row._app_deleted).map((row) => row.id))
        const nextLineageKeys = new Set<string>()
        const touchedLayoutIds = new Set<string>()

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
            const layout = inheritedLayouts.find((candidate) => candidate.id === physicalLayoutId)
            touchedLayoutIds.add(physicalLayoutId)
            pending.push({
                physicalId,
                physicalLayoutId,
                row,
                current,
                preserveApplicationOverride: Boolean(current && layout && layout.sync_state !== 'clean')
            })
        }

        const transitions: Parameters<typeof assertInterpretationNetworkSingleSystemTransitionAllowed>[2] = pending.map((item) => ({
            current: item.current
                ? {
                      widgetKey: item.current.widget_key,
                      config: isRecord(item.current.config) ? item.current.config : {},
                      isActive: item.current.is_active
                  }
                : null,
            next:
                item.preserveApplicationOverride && item.current
                    ? {
                          widgetKey: item.current.widget_key,
                          config: isRecord(item.current.config) ? item.current.config : {},
                          isActive: item.current.is_active
                      }
                    : { widgetKey: item.row.widgetKey, config: item.row.config, isActive: item.row.isActive !== false }
        }))
        if (transitions.length > 0) {
            await assertInterpretationNetworkSingleSystemTransitionAllowed(tx, schemaName, transitions, { lockAlreadyHeld: true })
        }

        for (const item of pending) {
            const sourceConfig = item.row.config
            const config =
                item.preserveApplicationOverride && item.current && isRecord(item.current.config) ? item.current.config : sourceConfig
            const isActive = item.preserveApplicationOverride && item.current ? item.current.is_active : item.row.isActive !== false
            if (item.current) {
                await updateWidget(
                    tx,
                    widgetsTable,
                    item.physicalId,
                    item.physicalLayoutId,
                    item.row,
                    config,
                    isActive,
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
                    input.userId
                )
            }
        }

        const nextIds = [...nextPhysicalIds]
        const locallyModifiedLayoutIds = inheritedLayouts.filter((row) => row.sync_state !== 'clean').map((row) => row.id)
        if (locallyModifiedLayoutIds.length > 0) {
            const rows = await tx.query<{ id: string; layout_id: string }>(
                `
                UPDATE ${widgetsTable}
                SET source_config = NULL,
                    is_active = CASE WHEN source_base_widget_id IS NULL THEN is_active ELSE false END,
                    _upl_updated_at = NOW(), _upl_updated_by = $3,
                    _upl_version = COALESCE(_upl_version, 1) + 1
                WHERE layout_id = ANY($1::uuid[])
                  AND source_widget_id IS NOT NULL
                  AND NOT (id = ANY($2::uuid[]))
                  AND _upl_deleted = false
                  AND _app_deleted = false
                RETURNING id, layout_id
                `,
                [locallyModifiedLayoutIds, nextIds, input.userId]
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

        await touchApplicationLayoutVersions(tx, layoutsTable, touchedLayoutIds, input.userId)
    }

    await runApplicationLayoutTransaction(executor, run)
}
