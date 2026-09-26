import { qSchemaTable } from '@universo-react/database'
import {
    LAYOUT_WIDGET_DEFINITIONS,
    MARKETING_LAYOUT_ZONES,
    applicationTemplateKeySchema,
    type ApplicationLayoutWidget,
    type ApplicationLayoutWidgetConfigBatchMutation,
    type ApplicationLayoutWidgetConfigMutation,
    type ApplicationLayoutWidgetMutation,
    type ApplicationLayoutWidgetResetBatchMutation,
    type ApplicationLayoutWidgetToggleMutation,
    type LayoutWidgetDefinition
} from '@universo-react/types'
import { type DbExecutor } from '@universo-react/utils'
import { softDeleteSetClause } from '@universo-react/utils/database'
import {
    assertInterpretationNetworkSingleSystemTransitionAllowed,
    lockInterpretationNetworkStructureMode
} from '../shared/interpretationNetworkStructureModeGuard'
import { hashApplicationLayoutContent } from '../utils/applicationLayoutHash'
import {
    strictApplicationLayoutWidgetConfigBatchMutationSchema,
    strictApplicationLayoutWidgetConfigMutationSchema,
    strictApplicationLayoutWidgetMoveMutationSchema,
    strictApplicationLayoutWidgetMutationSchema,
    strictApplicationLayoutWidgetResetBatchMutationSchema,
    strictApplicationLayoutWidgetToggleMutationSchema
} from '../validation/applicationLayoutMutationSchemas'
import type { StrictApplicationLayoutWidgetMoveMutation } from '../validation/applicationLayoutMutationSchemas'
import { assertMarketingHeroActionsRemainValidAfterToggle } from './applicationLayoutMarketingActionIntegrity'
import {
    applicationLayoutWidgetPredicate,
    assertApplicationLayoutWidgetConfig,
    assertApplicationLayoutWidgetMultiplicity,
    assertRendererConfigInput,
    assertWidgetPlacementForTemplate,
    copyApplicationLayoutWidgetSourceBindingState,
    encodeLayoutConfigForStorage,
    encodeWidgetConfigForStorage,
    getApplicationLayoutDetail,
    getApplicationLayoutRawConfig,
    getWidgetPlacement,
    isRecord,
    isMarketingWidgetKey,
    layoutCompositionToNeutral,
    lockApplicationLayoutMutation,
    mapWidget,
    readLayoutConfigEnvelope,
    readWidgetConfigEnvelope,
    resolveExistingLayoutComposition,
    runApplicationLayoutTransaction,
    type ApplicationLayoutWidgetWithPlacement,
    type WidgetRow,
    widgetSelect
} from './applicationLayoutStoreSupport'

const ORDERED_LAYOUT_ZONES: Array<ApplicationLayoutWidget['zone']> = ['left', 'top', 'right', 'bottom', 'center', ...MARKETING_LAYOUT_ZONES]

const buildDashboardWidgetVisibilityConfig = (widgets: readonly Pick<ApplicationLayoutWidget, 'widgetKey' | 'zone' | 'isActive'>[]) => {
    const active = new Set(widgets.filter((widget) => widget.isActive).map((widget) => widget.widgetKey))
    const activeCenter = new Set(widgets.filter((widget) => widget.isActive && widget.zone === 'center').map((widget) => widget.widgetKey))
    return {
        showSideMenu: widgets.some((widget) => widget.isActive && widget.zone === 'left'),
        showRightSideMenu: widgets.some((widget) => widget.isActive && widget.zone === 'right'),
        showAppNavbar: active.has('appNavbar'),
        showHeader: active.has('header'),
        showBreadcrumbs: active.has('breadcrumbs'),
        showSearch: active.has('search'),
        showDatePicker: active.has('datePicker'),
        showOptionsMenu: active.has('optionsMenu'),
        showLanguageSwitcher: active.has('languageSwitcher'),
        showOverviewTitle: activeCenter.has('overviewTitle'),
        showOverviewCards: activeCenter.has('overviewCards'),
        showSessionsChart: activeCenter.has('sessionsChart'),
        showPageViewsChart: activeCenter.has('pageViewsChart'),
        showDetailsTitle: activeCenter.has('detailsTitle'),
        showDetailsTable: activeCenter.has('detailsTable'),
        showColumnsContainer: activeCenter.has('columnsContainer'),
        showProductTree: activeCenter.has('productTree'),
        showUsersByCountryChart: activeCenter.has('usersByCountryChart'),
        showFooter: active.has('footer')
    }
}

const refreshLayoutLocalContentHash = async (
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    userId: string | null
): Promise<void> => {
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const current = await getApplicationLayoutDetail(executor, schemaName, layoutId)
    if (!current) return
    const currentEnvelope = readLayoutConfigEnvelope(current.item.templateKey, getApplicationLayoutRawConfig(current))
    const composition = resolveExistingLayoutComposition(current.item)
    const rendererConfig =
        current.item.templateKey === 'dashboard'
            ? { ...current.item.config, ...buildDashboardWidgetVisibilityConfig(current.widgets) }
            : current.item.config
    const config = encodeLayoutConfigForStorage(current.item.templateKey, rendererConfig, {
        ...currentEnvelope.neutral,
        composition: layoutCompositionToNeutral(composition)
    })
    const layout = { ...current.item, config }
    const localHash = hashApplicationLayoutContent({ layout, widgets: current.widgets })
    const syncState = current.item.sourceKind === 'metahub' && localHash !== current.item.sourceContentHash ? 'local_modified' : 'clean'
    const rows = await executor.query<{ id: string }>(
        `
        UPDATE ${layoutsTable}
        SET config = $2::jsonb,
            local_content_hash = $3,
            sync_state = $4,
            _upl_updated_at = NOW(),
            _upl_updated_by = $5,
            _upl_version = COALESCE(_upl_version, 1) + 1
        WHERE id = $1
          AND _upl_deleted = false
          AND _app_deleted = false
          AND COALESCE(_upl_version, 1) = $6
        RETURNING id
        `,
        [layoutId, JSON.stringify(config), localHash, syncState, userId, current.item.version]
    )
    if (!rows[0]) throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
}

export const listApplicationLayoutWidgetObject = (): LayoutWidgetDefinition[] => LAYOUT_WIDGET_DEFINITIONS.map((widget) => ({ ...widget }))

export async function listApplicationLayoutWidgets(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string
): Promise<ApplicationLayoutWidget[]> {
    return (await getApplicationLayoutDetail(executor, schemaName, layoutId))?.widgets ?? []
}

export async function upsertApplicationLayoutWidget(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    input: ApplicationLayoutWidgetMutation,
    userId: string | null
): Promise<ApplicationLayoutWidget> {
    if (isRecord(input)) assertRendererConfigInput(input.config)
    const data = strictApplicationLayoutWidgetMutationSchema.parse(input)
    if (LAYOUT_WIDGET_DEFINITIONS.find((definition) => definition.key === data.widgetKey)?.bindingSlots?.length) {
        throw new Error('APPLICATION_LAYOUT_ENTITY_BACKED_WIDGET_COPY_CONFLICT')
    }
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const config = assertApplicationLayoutWidgetConfig(data.widgetKey, data.config ?? {}, { generateInstanceKey: true })
    return runApplicationLayoutTransaction(executor, async (tx) => {
        await lockInterpretationNetworkStructureMode(tx, schemaName)
        const current = await lockApplicationLayoutMutation(tx, schemaName, layoutId)
        if (!current || !current.item.isActive) throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
        const templateKey = applicationTemplateKeySchema.safeParse(current.item.templateKey)
        if (!templateKey.success) throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
        if (current.item.version !== data.expectedVersion) {
            throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        }
        assertWidgetPlacementForTemplate(templateKey.data, data.widgetKey, data.zone)
        const placement = getWidgetPlacement(templateKey.data, data.widgetKey, data.zone, config)
        const storedConfig = encodeWidgetConfigForStorage(templateKey.data, data.widgetKey, data.zone, config, placement)
        assertApplicationLayoutWidgetMultiplicity(templateKey.data, [...current.widgets, { widgetKey: data.widgetKey }])
        if (isMarketingWidgetKey(data.widgetKey)) {
            const duplicate = current.widgets.find((widget) => String(widget.instanceKey) === String(config.instanceKey))
            if (duplicate) throw new Error('APPLICATION_LAYOUT_WIDGET_DUPLICATE_INSTANCE')
        }
        await assertInterpretationNetworkSingleSystemTransitionAllowed(
            tx,
            schemaName,
            [
                {
                    current: null,
                    next: { widgetKey: data.widgetKey, config, isActive: true }
                }
            ],
            { lockAlreadyHeld: true }
        )
        const rows = await tx.query<WidgetRow>(
            `
            INSERT INTO ${widgetsTable} (layout_id, zone, widget_key, sort_order, config, is_active, _upl_created_by, _upl_updated_by)
            SELECT $1, $2, $3, COALESCE($4, 1), $5::jsonb, true, $6, $6
            WHERE ${applicationLayoutWidgetPredicate(layoutsTable, '$1')}
            RETURNING *,
                      (source_config IS NOT NULL AND config IS DISTINCT FROM source_config) AS is_customized,
                      COALESCE(_upl_version, 1)::int AS version
            `,
            [layoutId, data.zone, data.widgetKey, data.sortOrder ?? null, JSON.stringify(storedConfig), userId]
        )
        if (!rows[0]) throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
        await refreshLayoutLocalContentHash(tx, schemaName, layoutId, userId)
        return mapWidget(rows[0], current.item.templateKey)
    })
}

export async function updateApplicationLayoutWidgetConfig(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    widgetId: string,
    input: ApplicationLayoutWidgetConfigMutation,
    userId: string | null
): Promise<ApplicationLayoutWidget | null> {
    if (isRecord(input)) assertRendererConfigInput(input.config)
    const data = strictApplicationLayoutWidgetConfigMutationSchema.parse(input)
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    return runApplicationLayoutTransaction(executor, async (tx) => {
        await lockInterpretationNetworkStructureMode(tx, schemaName)
        const currentLayout = await lockApplicationLayoutMutation(tx, schemaName, layoutId)
        const current = currentLayout?.widgets.find((widget) => widget.id === widgetId)
        if (!currentLayout || !currentLayout.item.isActive || !current) return null
        const config = assertApplicationLayoutWidgetConfig(current.widgetKey, data.config)
        if (isMarketingWidgetKey(current.widgetKey)) {
            const currentInstanceKey = current.instanceKey
            if (String(config.instanceKey) !== String(currentInstanceKey)) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_INSTANCE_IMMUTABLE')
            }
        }
        const placement =
            (current as ApplicationLayoutWidgetWithPlacement).placement ??
            getWidgetPlacement(currentLayout.item.templateKey, current.widgetKey, current.zone, current.config)
        const storedConfig = encodeWidgetConfigForStorage(
            currentLayout.item.templateKey,
            current.widgetKey,
            current.zone,
            config,
            placement
        )
        await assertInterpretationNetworkSingleSystemTransitionAllowed(
            tx,
            schemaName,
            [
                {
                    current: {
                        widgetKey: current.widgetKey,
                        config: current.config,
                        isActive: current.isActive
                    },
                    next: { widgetKey: current.widgetKey, config, isActive: current.isActive }
                }
            ],
            { lockAlreadyHeld: true }
        )
        const rows = await tx.query<WidgetRow>(
            `
            UPDATE ${widgetsTable}
            SET config = $2::jsonb, _upl_updated_at = NOW(), _upl_updated_by = $3, _upl_version = COALESCE(_upl_version, 1) + 1
            WHERE id = $1
              AND layout_id = $4
              AND COALESCE(_upl_version, 1) = $5
              AND _upl_deleted = false
              AND _app_deleted = false
              AND ${applicationLayoutWidgetPredicate(layoutsTable, 'layout_id')}
            RETURNING *,
                      (source_config IS NOT NULL AND config IS DISTINCT FROM source_config) AS is_customized,
                      COALESCE(_upl_version, 1)::int AS version
            `,
            [widgetId, JSON.stringify(storedConfig), userId, layoutId, data.expectedVersion]
        )
        if (!rows[0]) throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        await refreshLayoutLocalContentHash(tx, schemaName, String(rows[0].layout_id), userId)
        return mapWidget(rows[0], currentLayout.item.templateKey)
    })
}

export async function updateApplicationLayoutWidgetConfigsBatch(
    executor: DbExecutor,
    schemaName: string,
    input: ApplicationLayoutWidgetConfigBatchMutation,
    userId: string | null
): Promise<ApplicationLayoutWidget[]> {
    if (isRecord(input) && Array.isArray(input.updates)) {
        for (const update of input.updates) {
            if (isRecord(update)) assertRendererConfigInput(update.config)
        }
    }
    const data = strictApplicationLayoutWidgetConfigBatchMutationSchema.parse(input)
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const updates = [...data.updates].sort((left, right) => left.widgetId.localeCompare(right.widgetId))

    return executor.transaction(async (tx) => {
        await lockInterpretationNetworkStructureMode(tx, schemaName)
        const layoutIds = [...new Set(updates.map((update) => update.layoutId))].sort((left, right) => left.localeCompare(right))
        const layoutById = new Map<string, Awaited<ReturnType<typeof lockApplicationLayoutMutation>>>()
        for (const layoutId of layoutIds) {
            const currentLayout = await lockApplicationLayoutMutation(tx, schemaName, layoutId)
            if (!currentLayout || !currentLayout.item.isActive) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')
            }
            layoutById.set(layoutId, currentLayout)
        }

        const currentRows = await tx.query<WidgetRow>(
            `${widgetSelect(widgetsTable)}
             WHERE (layout_id, id) IN (
                   SELECT requested.layout_id, requested.widget_id
                   FROM UNNEST($1::uuid[], $2::uuid[]) AS requested(layout_id, widget_id)
             )
               AND _upl_deleted = false
               AND _app_deleted = false
               AND ${applicationLayoutWidgetPredicate(layoutsTable, 'layout_id')}
             ORDER BY id
             FOR UPDATE`,
            [updates.map((update) => update.layoutId), updates.map((update) => update.widgetId)]
        )
        const currentByScopedId = new Map(currentRows.map((row) => [`${row.layout_id}:${row.id}`, row]))
        const validatedConfigs = new Map<string, Record<string, unknown>>()

        for (const update of updates) {
            const current = currentByScopedId.get(`${update.layoutId}:${update.widgetId}`)
            if (!current || current.version !== update.expectedVersion) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')
            }
            const validatedConfig = assertApplicationLayoutWidgetConfig(current.widget_key, update.config)
            if (isMarketingWidgetKey(current.widget_key)) {
                const currentInstanceKey = isRecord(current.config) ? current.config.instanceKey : undefined
                if (String(validatedConfig.instanceKey) !== String(currentInstanceKey)) {
                    throw new Error('APPLICATION_LAYOUT_WIDGET_INSTANCE_IMMUTABLE')
                }
            }
            validatedConfigs.set(update.widgetId, validatedConfig)
        }

        await assertInterpretationNetworkSingleSystemTransitionAllowed(
            tx,
            schemaName,
            updates.map((update) => ({
                current: {
                    widgetKey: currentByScopedId.get(`${update.layoutId}:${update.widgetId}`)!.widget_key,
                    config: currentByScopedId.get(`${update.layoutId}:${update.widgetId}`)!.config,
                    isActive: currentByScopedId.get(`${update.layoutId}:${update.widgetId}`)!.is_active
                },
                next: {
                    widgetKey: currentByScopedId.get(`${update.layoutId}:${update.widgetId}`)!.widget_key,
                    config: validatedConfigs.get(update.widgetId)!,
                    isActive: currentByScopedId.get(`${update.layoutId}:${update.widgetId}`)!.is_active
                }
            })),
            { lockAlreadyHeld: true }
        )

        const saved: ApplicationLayoutWidget[] = []
        const touchedLayoutIds = new Set<string>()
        for (const update of updates) {
            const current = currentByScopedId.get(`${update.layoutId}:${update.widgetId}`)!
            const currentLayout = layoutById.get(update.layoutId)!
            const placement = getWidgetPlacement(currentLayout.item.templateKey, current.widget_key, current.zone, current.config)
            const storedConfig = encodeWidgetConfigForStorage(
                currentLayout.item.templateKey,
                current.widget_key,
                current.zone,
                validatedConfigs.get(update.widgetId)!,
                placement
            )
            const rows = await tx.query<WidgetRow>(
                `
                UPDATE ${widgetsTable}
                SET config = $2::jsonb, _upl_updated_at = NOW(), _upl_updated_by = $3, _upl_version = COALESCE(_upl_version, 1) + 1
                WHERE id = $1
                  AND layout_id = $4
                  AND _upl_deleted = false
                  AND _app_deleted = false
                  AND COALESCE(_upl_version, 1) = $5
                  AND ${applicationLayoutWidgetPredicate(layoutsTable, 'layout_id')}
                RETURNING *,
                          (source_config IS NOT NULL AND config IS DISTINCT FROM source_config) AS is_customized,
                          COALESCE(_upl_version, 1)::int AS version
                `,
                [update.widgetId, JSON.stringify(storedConfig), userId, update.layoutId, update.expectedVersion]
            )
            if (!rows[0]) throw new Error('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')
            saved.push(mapWidget(rows[0], currentLayout.item.templateKey))
            touchedLayoutIds.add(String(rows[0].layout_id))
        }

        for (const layoutId of touchedLayoutIds) {
            await refreshLayoutLocalContentHash(tx, schemaName, layoutId, userId)
        }
        return saved
    })
}

export async function resetApplicationLayoutWidgetConfigsBatch(
    executor: DbExecutor,
    schemaName: string,
    input: ApplicationLayoutWidgetResetBatchMutation,
    userId: string | null
): Promise<ApplicationLayoutWidget[]> {
    const data = strictApplicationLayoutWidgetResetBatchMutationSchema.parse(input)
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const updates = [...data.updates].sort((left, right) => left.widgetId.localeCompare(right.widgetId))

    return executor.transaction(async (tx) => {
        await lockInterpretationNetworkStructureMode(tx, schemaName)
        const layoutIds = [...new Set(updates.map((update) => update.layoutId))].sort((left, right) => left.localeCompare(right))
        const layoutById = new Map<string, Awaited<ReturnType<typeof lockApplicationLayoutMutation>>>()
        for (const layoutId of layoutIds) {
            const currentLayout = await lockApplicationLayoutMutation(tx, schemaName, layoutId)
            if (!currentLayout || !currentLayout.item.isActive) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')
            }
            layoutById.set(layoutId, currentLayout)
        }

        const currentRows = await tx.query<WidgetRow>(
            `${widgetSelect(widgetsTable)}
             WHERE (layout_id, id) IN (
                   SELECT requested.layout_id, requested.widget_id
                   FROM UNNEST($1::uuid[], $2::uuid[]) AS requested(layout_id, widget_id)
             )
               AND source_config IS NOT NULL
               AND _upl_deleted = false
               AND _app_deleted = false
               AND ${applicationLayoutWidgetPredicate(layoutsTable, 'layout_id')}
             ORDER BY id
             FOR UPDATE`,
            [updates.map((update) => update.layoutId), updates.map((update) => update.widgetId)]
        )
        const currentByScopedId = new Map(currentRows.map((row) => [`${row.layout_id}:${row.id}`, row]))
        for (const update of updates) {
            const current = currentByScopedId.get(`${update.layoutId}:${update.widgetId}`)
            if (!current || current.version !== update.expectedVersion) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')
            }
            const currentLayout = layoutById.get(update.layoutId)!
            try {
                readWidgetConfigEnvelope(currentLayout.item.templateKey, current.widget_key, current.zone, current.source_config, {
                    requireBindings: true
                })
            } catch {
                throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
            }
        }

        await assertInterpretationNetworkSingleSystemTransitionAllowed(
            tx,
            schemaName,
            updates.map((update) => {
                const current = currentByScopedId.get(`${update.layoutId}:${update.widgetId}`)!
                const currentLayout = layoutById.get(update.layoutId)!
                const sourceRendererConfig = readWidgetConfigEnvelope(
                    currentLayout.item.templateKey,
                    current.widget_key,
                    current.zone,
                    current.source_config,
                    { requireBindings: true }
                ).rendererConfig
                return {
                    current: { widgetKey: current.widget_key, config: current.config, isActive: current.is_active },
                    next: { widgetKey: current.widget_key, config: sourceRendererConfig, isActive: current.is_active }
                }
            }),
            { lockAlreadyHeld: true }
        )

        const saved: ApplicationLayoutWidget[] = []
        const touchedLayoutIds = new Set<string>()
        for (const update of updates) {
            const rows = await tx.query<WidgetRow>(
                `
                UPDATE ${widgetsTable}
                SET config = source_config,
                    _upl_updated_at = NOW(),
                    _upl_updated_by = $3,
                    _upl_version = COALESCE(_upl_version, 1) + 1
                WHERE id = $1
                  AND layout_id = $2
                  AND source_config IS NOT NULL
                  AND _upl_deleted = false
                  AND _app_deleted = false
                  AND COALESCE(_upl_version, 1) = $4
                  AND ${applicationLayoutWidgetPredicate(layoutsTable, 'layout_id')}
                RETURNING *,
                          false AS is_customized,
                          COALESCE(_upl_version, 1)::int AS version
                `,
                [update.widgetId, update.layoutId, userId, update.expectedVersion]
            )
            if (!rows[0]) throw new Error('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')
            saved.push(mapWidget(rows[0], layoutById.get(update.layoutId)!.item.templateKey))
            touchedLayoutIds.add(update.layoutId)
        }

        for (const layoutId of touchedLayoutIds) {
            await refreshLayoutLocalContentHash(tx, schemaName, layoutId, userId)
        }
        return saved
    })
}

export async function moveApplicationLayoutWidget(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    input: StrictApplicationLayoutWidgetMoveMutation,
    userId: string | null
): Promise<ApplicationLayoutWidget | null> {
    const data = strictApplicationLayoutWidgetMoveMutationSchema.parse(input)
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')

    return runApplicationLayoutTransaction(executor, async (tx) => {
        await lockInterpretationNetworkStructureMode(tx, schemaName)
        const currentLayout = await lockApplicationLayoutMutation(tx, schemaName, layoutId)
        if (!currentLayout || !currentLayout.item.isActive) return null
        const templateKey = applicationTemplateKeySchema.safeParse(currentLayout.item.templateKey)
        if (!templateKey.success) throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')

        const widgets = currentLayout.widgets
        const moved = widgets.find((widget) => widget.id === data.widgetId)
        if (!moved) return null
        if (moved.version !== data.expectedVersion) {
            throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        }
        assertWidgetPlacementForTemplate(templateKey.data, moved.widgetKey, data.targetZone)
        const currentPlacement =
            (moved as ApplicationLayoutWidgetWithPlacement).placement ??
            getWidgetPlacement(templateKey.data, moved.widgetKey, moved.zone, moved.config)
        const nextPlacement = data.targetPlacement ?? currentPlacement
        const movedStoredConfig =
            data.targetPlacement !== undefined || moved.zone !== data.targetZone
                ? encodeWidgetConfigForStorage(templateKey.data, moved.widgetKey, data.targetZone, moved.config, nextPlacement)
                : null

        const buckets = new Map<ApplicationLayoutWidget['zone'], ApplicationLayoutWidget[]>()
        for (const zone of ORDERED_LAYOUT_ZONES) buckets.set(zone, [])
        for (const widget of widgets) {
            if (widget.id === moved.id) continue
            const bucket = buckets.get(widget.zone) ?? []
            bucket.push(widget)
            buckets.set(widget.zone, bucket)
        }

        const targetBucket = buckets.get(data.targetZone) ?? []
        const targetIndex = Math.max(0, Math.min(data.targetIndex, targetBucket.length))
        targetBucket.splice(targetIndex, 0, copyApplicationLayoutWidgetSourceBindingState(moved, { ...moved, zone: data.targetZone }))
        buckets.set(data.targetZone, targetBucket)

        let movedResult: ApplicationLayoutWidget | null = null
        const pendingUpdates: Array<Pick<ApplicationLayoutWidget, 'id' | 'zone' | 'sortOrder'>> = []
        for (const zone of ORDERED_LAYOUT_ZONES) {
            const zoneWidgets = buckets.get(zone) ?? []
            for (const [index, widget] of zoneWidgets.entries()) {
                const nextSortOrder = index + 1
                if (widget.zone === zone && widget.sortOrder === nextSortOrder) {
                    if (widget.id === moved.id) {
                        movedResult = copyApplicationLayoutWidgetSourceBindingState(moved, {
                            ...widget,
                            zone,
                            sortOrder: nextSortOrder
                        })
                    }
                    continue
                }
                pendingUpdates.push({
                    id: widget.id,
                    zone,
                    sortOrder: nextSortOrder
                })
            }
        }

        if (pendingUpdates.length > 0) {
            const updatedRows = await tx.query<WidgetRow>(
                `
                WITH updates AS (
                    SELECT *
                    FROM unnest($3::uuid[], $4::text[], $5::int[]) AS incoming(id, zone, sort_order)
                )
                UPDATE ${widgetsTable} AS w
                SET zone = updates.zone,
                    sort_order = updates.sort_order,
                    _upl_updated_at = NOW(),
                    _upl_updated_by = $2,
                    _upl_version = COALESCE(w._upl_version, 1) + 1
                FROM updates
                WHERE w.id = updates.id
                  AND w.layout_id = $1
                  AND w._upl_deleted = false
                  AND w._app_deleted = false
                  AND ${applicationLayoutWidgetPredicate(layoutsTable, 'w.layout_id')}
                RETURNING w.*,
                          (w.source_config IS NOT NULL AND w.config IS DISTINCT FROM w.source_config) AS is_customized,
                          COALESCE(w._upl_version, 1)::int AS version
                `,
                [
                    layoutId,
                    userId,
                    pendingUpdates.map((update) => update.id),
                    pendingUpdates.map((update) => update.zone),
                    pendingUpdates.map((update) => update.sortOrder)
                ]
            )
            const updatedById = new Map(updatedRows.map((row) => [row.id, mapWidget(row, currentLayout.item.templateKey)]))

            if (updatedRows.length !== pendingUpdates.length) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')
            }

            for (const update of pendingUpdates) {
                if (update.id !== moved.id) {
                    continue
                }
                movedResult =
                    updatedById.get(update.id) ??
                    copyApplicationLayoutWidgetSourceBindingState(moved, {
                        ...moved,
                        zone: update.zone,
                        sortOrder: update.sortOrder
                    })
                break
            }
        }

        if (movedStoredConfig !== null) {
            const movedRows = await tx.query<WidgetRow>(
                `
                UPDATE ${widgetsTable}
                SET config = $2::jsonb,
                    _upl_updated_at = NOW(),
                    _upl_updated_by = $3,
                    _upl_version = COALESCE(_upl_version, 1) + 1
                WHERE id = $1
                  AND layout_id = $4
                  AND _upl_deleted = false
                  AND _app_deleted = false
                RETURNING *,
                          (source_config IS NOT NULL AND config IS DISTINCT FROM source_config) AS is_customized,
                          COALESCE(_upl_version, 1)::int AS version
                `,
                [moved.id, JSON.stringify(movedStoredConfig), userId, layoutId]
            )
            if (!movedRows[0]) throw new Error('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')
            movedResult = mapWidget(movedRows[0], currentLayout.item.templateKey)
        }

        await refreshLayoutLocalContentHash(tx, schemaName, layoutId, userId)
        return (
            movedResult ??
            copyApplicationLayoutWidgetSourceBindingState(moved, {
                ...moved,
                zone: data.targetZone,
                sortOrder: targetIndex + 1
            })
        )
    })
}

export async function toggleApplicationLayoutWidget(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    widgetId: string,
    input: ApplicationLayoutWidgetToggleMutation,
    userId: string | null
): Promise<ApplicationLayoutWidget | null> {
    const data = strictApplicationLayoutWidgetToggleMutationSchema.parse(input)
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    return executor.transaction(async (tx) => {
        await lockInterpretationNetworkStructureMode(tx, schemaName)
        const currentLayout = await lockApplicationLayoutMutation(tx, schemaName, layoutId)
        const current = currentLayout?.widgets.find((widget) => widget.id === widgetId)
        if (!currentLayout || !currentLayout.item.isActive || !current) return null
        await assertInterpretationNetworkSingleSystemTransitionAllowed(
            tx,
            schemaName,
            [
                {
                    current: {
                        widgetKey: current.widgetKey,
                        config: current.config,
                        isActive: current.isActive
                    },
                    next: { widgetKey: current.widgetKey, config: current.config, isActive: data.isActive }
                }
            ],
            { lockAlreadyHeld: true }
        )
        if (data.isActive !== current.isActive) {
            await assertMarketingHeroActionsRemainValidAfterToggle(tx, schemaName, currentLayout, widgetId, data.isActive)
        }
        const rows = await tx.query<WidgetRow>(
            `
            UPDATE ${widgetsTable}
            SET is_active = $2, _upl_updated_at = NOW(), _upl_updated_by = $3, _upl_version = COALESCE(_upl_version, 1) + 1
            WHERE id = $1
              AND layout_id = $4
              AND COALESCE(_upl_version, 1) = $5
              AND _upl_deleted = false
              AND _app_deleted = false
              AND ${applicationLayoutWidgetPredicate(layoutsTable, 'layout_id')}
            RETURNING *,
                      (source_config IS NOT NULL AND config IS DISTINCT FROM source_config) AS is_customized,
                      COALESCE(_upl_version, 1)::int AS version
            `,
            [widgetId, data.isActive, userId, layoutId, data.expectedVersion]
        )
        if (!rows[0]) throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        await refreshLayoutLocalContentHash(tx, schemaName, String(rows[0].layout_id), userId)
        return mapWidget(rows[0], currentLayout.item.templateKey)
    })
}

export async function deleteApplicationLayoutWidget(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    widgetId: string,
    userId: string | null,
    expectedVersion: number
): Promise<boolean> {
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    return executor.transaction(async (tx) => {
        await lockInterpretationNetworkStructureMode(tx, schemaName)
        const currentLayout = await lockApplicationLayoutMutation(tx, schemaName, layoutId)
        if (!currentLayout || !currentLayout.item.isActive || !currentLayout.widgets.some((widget) => widget.id === widgetId)) {
            throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        }
        const rows = await tx.query<{ id: string; layout_id: string }>(
            `UPDATE ${widgetsTable} SET ${softDeleteSetClause(
                '$2'
            )}, _upl_version = COALESCE(_upl_version, 1) + 1 WHERE id = $1 AND layout_id = $3
              AND _upl_deleted = false AND _app_deleted = false
              AND COALESCE(_upl_version, 1) = $4
              AND ${applicationLayoutWidgetPredicate(layoutsTable, 'layout_id')} RETURNING id, layout_id`,
            [widgetId, userId, layoutId, expectedVersion]
        )
        if (!rows[0]) {
            throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        }
        await refreshLayoutLocalContentHash(tx, schemaName, String(rows[0].layout_id), userId)
        return true
    })
}
