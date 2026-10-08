import { qSchemaTable } from '@universo-react/database'
import {
    MARKETING_LAYOUT_ZONES,
    applicationTemplateKeySchema,
    canAddApplicationLayoutWidget,
    getLayoutWidgetDefinition,
    type ApplicationLayoutWidget,
    type ApplicationLayoutWidgetMutation
} from '@universo-react/types'
import { generateUuidV7, type DbExecutor } from '@universo-react/utils'
import {
    assertInterpretationNetworkSingleSystemTransitionAllowed,
    lockInterpretationNetworkStructureMode
} from '../shared/interpretationNetworkStructureModeGuard'
import {
    strictApplicationLayoutWidgetMoveMutationSchema,
    strictApplicationLayoutWidgetMutationSchema
} from '../validation/applicationLayoutMutationSchemas'
import type { StrictApplicationLayoutWidgetMoveMutation } from '../validation/applicationLayoutMutationSchemas'
import { classifyPlacementLineage } from './applicationLayoutWidgetPlacement'
import { mapWidgetWithCanonicalSourceState, refreshLayoutLocalContentHash } from './applicationLayoutWidgetMutationSupport'
import {
    applicationLayoutWidgetPredicate,
    assertApplicationLayoutWidgetConfig,
    assertApplicationLayoutWidgetMultiplicity,
    assertRendererConfigInput,
    assertWidgetPlacementForTemplate,
    copyApplicationLayoutWidgetSourceBindingState,
    encodeWidgetConfigForStorage,
    getWidgetPlacement,
    isRecord,
    lockApplicationLayoutMutation,
    mapWidget,
    runApplicationLayoutTransaction,
    validateApplicationLayoutWidgetGraph,
    type ApplicationLayoutWidgetWithPlacement,
    type WidgetRow
} from './applicationLayoutStoreSupport'

const ORDERED_LAYOUT_ZONES: Array<ApplicationLayoutWidget['zone']> = ['left', 'top', 'right', 'bottom', 'center', ...MARKETING_LAYOUT_ZONES]

export async function upsertApplicationLayoutWidget(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    input: ApplicationLayoutWidgetMutation,
    userId: string | null
): Promise<ApplicationLayoutWidget> {
    if (isRecord(input)) assertRendererConfigInput(input.config)
    const data = strictApplicationLayoutWidgetMutationSchema.parse(input)
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const config = assertApplicationLayoutWidgetConfig(data.widgetKey, data.config ?? {})
    const instanceKey = generateUuidV7()
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
        assertApplicationLayoutWidgetMultiplicity(templateKey.data, [...current.widgets, { widgetKey: data.widgetKey }])
        const placement = getWidgetPlacement(templateKey.data, data.widgetKey, data.zone, config)
        const storedConfig = encodeWidgetConfigForStorage(templateKey.data, data.widgetKey, data.zone, config, placement)
        const candidateWidget = mapWidget(
            {
                id: generateUuidV7(),
                layout_id: layoutId,
                zone: data.zone,
                widget_key: data.widgetKey,
                instance_key: instanceKey,
                parent_widget_id: data.parentWidgetId,
                slot_key: data.slotKey,
                sort_order: data.sortOrder ?? 1,
                config: storedConfig,
                source_config: null,
                source_widget_id: null,
                source_base_widget_id: null,
                is_customized: false,
                is_active: true,
                version: 1
            },
            templateKey.data
        )
        const candidateWidgets = [...current.widgets, candidateWidget]
        validateApplicationLayoutWidgetGraph(templateKey.data, candidateWidgets)
        validateApplicationLayoutWidgetGraph(
            templateKey.data,
            candidateWidgets.filter((widget) => widget.isActive),
            { effectiveGraph: true }
        )
        if (!canAddApplicationLayoutWidget(getLayoutWidgetDefinition(data.widgetKey, data.config ?? {}), current.item.sourceKind)) {
            throw new Error('APPLICATION_LAYOUT_ENTITY_BACKED_WIDGET_COPY_CONFLICT')
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
            INSERT INTO ${widgetsTable} (
              layout_id, zone, widget_key, instance_key, parent_widget_id, slot_key,
              sort_order, config, is_active, _upl_created_by, _upl_updated_by
            )
            SELECT $1, $2, $3, $4, $5, $6, COALESCE($7, 1), $8::jsonb, true, $9, $9
            WHERE ${applicationLayoutWidgetPredicate(layoutsTable, '$1')}
            RETURNING *,
                      (source_config IS NOT NULL AND config IS DISTINCT FROM source_config) AS is_customized,
                      COALESCE(_upl_version, 1)::int AS version
            `,
            [
                layoutId,
                data.zone,
                data.widgetKey,
                instanceKey,
                data.parentWidgetId,
                data.slotKey,
                data.sortOrder ?? null,
                JSON.stringify(storedConfig),
                userId
            ]
        )
        if (!rows[0]) throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
        await refreshLayoutLocalContentHash(tx, schemaName, layoutId, userId)
        return mapWidgetWithCanonicalSourceState(rows[0], current.item.templateKey)
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
        const nextParentWidgetId = data.parentWidgetId === undefined ? moved.parentWidgetId : data.parentWidgetId
        const nextSlotKey = data.slotKey === undefined ? moved.slotKey : data.slotKey
        const parentageChanged = nextParentWidgetId !== moved.parentWidgetId || nextSlotKey !== moved.slotKey
        assertWidgetPlacementForTemplate(templateKey.data, moved.widgetKey, data.targetZone)
        const currentPlacement =
            (moved as ApplicationLayoutWidgetWithPlacement).placement ??
            getWidgetPlacement(templateKey.data, moved.widgetKey, moved.zone, moved.config)
        const nextPlacement = data.targetPlacement ?? currentPlacement
        const zoneChanged = data.targetZone !== moved.zone
        const semanticPlacementChanged =
            data.targetPlacement !== undefined && JSON.stringify(data.targetPlacement) !== JSON.stringify(currentPlacement)
        const isSourceLinked = classifyPlacementLineage(moved.sourceWidgetId, moved.sourceBaseWidgetId).kind === 'source-linked'
        const sourcePlacementPolicy = isSourceLinked
            ? getLayoutWidgetDefinition(moved.widgetKey, moved.config)?.applicationPlacementOverrides
            : undefined
        let sourceLinkedOrderChanged = false
        if (isSourceLinked) {
            if (!sourcePlacementPolicy) throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
            const policy = sourcePlacementPolicy
            const currentOrderGroup = widgets
                .filter(
                    (widget) =>
                        widget.zone === moved.zone && widget.parentWidgetId === moved.parentWidgetId && widget.slotKey === moved.slotKey
                )
                .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
            const currentOrderIndex = currentOrderGroup.findIndex((widget) => widget.id === moved.id)
            if (currentOrderIndex < 0) throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
            sourceLinkedOrderChanged = data.targetIndex !== currentOrderIndex
            const unsupportedSemanticPlacementChange =
                semanticPlacementChanged && (policy.order === 'none' || moved.parentWidgetId !== null || zoneChanged)
            if (
                (zoneChanged && !policy.zone) ||
                (parentageChanged && !policy.parentSlot) ||
                unsupportedSemanticPlacementChange ||
                (sourceLinkedOrderChanged && policy.order === 'none') ||
                (sourceLinkedOrderChanged &&
                    policy.order === 'root-only' &&
                    (moved.parentWidgetId !== null || nextParentWidgetId !== null || nextSlotKey !== null))
            ) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
            }
            if (!zoneChanged && !parentageChanged && !semanticPlacementChanged && !sourceLinkedOrderChanged) {
                return copyApplicationLayoutWidgetSourceBindingState(moved, { ...moved })
            }
        }
        const movedStoredConfig =
            data.targetPlacement !== undefined || moved.zone !== data.targetZone
                ? encodeWidgetConfigForStorage(templateKey.data, moved.widgetKey, data.targetZone, moved.config, nextPlacement)
                : null

        const persistMovedStoredConfig = async (): Promise<ApplicationLayoutWidget | null> => {
            if (movedStoredConfig === null) return null
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
            return mapWidgetWithCanonicalSourceState(movedRows[0], currentLayout.item.templateKey)
        }

        if (isSourceLinked && semanticPlacementChanged && !sourceLinkedOrderChanged && !zoneChanged && !parentageChanged) {
            const movedResult = await persistMovedStoredConfig()
            if (!movedResult) throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
            await refreshLayoutLocalContentHash(tx, schemaName, layoutId, userId)
            return movedResult
        }

        const getOrderGroupKey = (widget: Pick<ApplicationLayoutWidget, 'zone' | 'parentWidgetId' | 'slotKey'>): string =>
            JSON.stringify([widget.zone, widget.parentWidgetId, widget.slotKey])
        const movedOrderGroupKey = getOrderGroupKey(moved)
        const targetOrderGroupPlacement = {
            zone: data.targetZone,
            parentWidgetId: nextParentWidgetId,
            slotKey: nextSlotKey
        }
        const targetOrderGroupKey = getOrderGroupKey(targetOrderGroupPlacement)
        const orderGroups = new Map<string, { zone: ApplicationLayoutWidget['zone']; widgets: ApplicationLayoutWidget[] }>()
        orderGroups.set(movedOrderGroupKey, { zone: moved.zone, widgets: [] })
        if (!orderGroups.has(targetOrderGroupKey)) {
            orderGroups.set(targetOrderGroupKey, { zone: data.targetZone, widgets: [] })
        }
        for (const widget of widgets) {
            if (widget.id === moved.id) continue
            orderGroups.get(getOrderGroupKey(widget))?.widgets.push(widget)
        }
        for (const group of orderGroups.values()) {
            group.widgets.sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
        }

        const targetBucket = orderGroups.get(targetOrderGroupKey)?.widgets
        if (!targetBucket) throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
        const targetIndex = Math.max(0, Math.min(data.targetIndex, targetBucket.length))
        targetBucket.splice(
            targetIndex,
            0,
            copyApplicationLayoutWidgetSourceBindingState(moved, {
                ...moved,
                zone: data.targetZone,
                parentWidgetId: nextParentWidgetId,
                slotKey: nextSlotKey
            })
        )

        const candidateWidgets = widgets.map((widget) =>
            widget.id === moved.id
                ? copyApplicationLayoutWidgetSourceBindingState(moved, {
                      ...moved,
                      zone: data.targetZone,
                      parentWidgetId: nextParentWidgetId,
                      slotKey: nextSlotKey
                  })
                : widget
        )
        validateApplicationLayoutWidgetGraph(templateKey.data, candidateWidgets, { effectiveGraph: true })

        let movedResult: ApplicationLayoutWidget | null = null
        const pendingUpdates: Array<
            Pick<ApplicationLayoutWidgetWithPlacement, 'id' | 'zone' | 'sortOrder' | 'parentWidgetId' | 'slotKey'>
        > = []
        const orderedGroups = [...orderGroups.values()].sort(
            (left, right) => ORDERED_LAYOUT_ZONES.indexOf(left.zone) - ORDERED_LAYOUT_ZONES.indexOf(right.zone)
        )
        for (const group of orderedGroups) {
            for (const [index, widget] of group.widgets.entries()) {
                const nextSortOrder = index + 1
                const movedParentageChanged = widget.id === moved.id && parentageChanged
                if (widget.zone === group.zone && widget.sortOrder === nextSortOrder && !movedParentageChanged) {
                    if (widget.id === moved.id) {
                        movedResult = copyApplicationLayoutWidgetSourceBindingState(moved, {
                            ...widget,
                            zone: group.zone,
                            sortOrder: nextSortOrder,
                            parentWidgetId: nextParentWidgetId,
                            slotKey: nextSlotKey
                        })
                    }
                    continue
                }
                pendingUpdates.push({
                    id: widget.id,
                    zone: group.zone,
                    sortOrder: nextSortOrder,
                    parentWidgetId: widget.parentWidgetId,
                    slotKey: widget.slotKey
                })
            }
        }

        for (const update of pendingUpdates) {
            const currentWidget = widgets.find((widget) => widget.id === update.id)
            if (
                !currentWidget ||
                classifyPlacementLineage(currentWidget.sourceWidgetId, currentWidget.sourceBaseWidgetId).kind !== 'source-linked'
            ) {
                continue
            }
            const policy = getLayoutWidgetDefinition(currentWidget.widgetKey, currentWidget.config)?.applicationPlacementOverrides
            if (!policy) throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
            const orderChanged = update.sortOrder !== currentWidget.sortOrder
            const zoneChanged = update.zone !== currentWidget.zone
            const parentageChangedForNeighbor =
                update.parentWidgetId !== currentWidget.parentWidgetId || update.slotKey !== currentWidget.slotKey
            if (
                (orderChanged &&
                    (policy.order === 'none' ||
                        (policy.order === 'root-only' &&
                            (currentWidget.parentWidgetId !== null || update.parentWidgetId !== null || update.slotKey !== null)))) ||
                (zoneChanged && !policy.zone) ||
                (parentageChangedForNeighbor && !policy.parentSlot)
            ) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
            }
        }

        if (pendingUpdates.length > 0) {
            const updatedRows = await tx.query<WidgetRow>(
                `
                WITH updates AS (
                    SELECT *
                    FROM unnest($3::uuid[], $4::text[], $5::int[], $6::uuid[], $7::text[]) AS incoming(id, zone, sort_order, parent_widget_id, slot_key)
                )
                UPDATE ${widgetsTable} AS w
                SET zone = updates.zone,
                    sort_order = updates.sort_order,
                    parent_widget_id = updates.parent_widget_id,
                    slot_key = updates.slot_key,
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
                    pendingUpdates.map((update) => update.sortOrder),
                    pendingUpdates.map((update) => update.parentWidgetId),
                    pendingUpdates.map((update) => update.slotKey)
                ]
            )
            const updatedById = new Map(
                updatedRows.map((row) => [row.id, mapWidgetWithCanonicalSourceState(row, currentLayout.item.templateKey)])
            )

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

        const movedConfigResult = await persistMovedStoredConfig()
        if (movedConfigResult) movedResult = movedConfigResult

        await refreshLayoutLocalContentHash(tx, schemaName, layoutId, userId)
        return (
            movedResult ??
            copyApplicationLayoutWidgetSourceBindingState(moved, {
                ...moved,
                zone: data.targetZone,
                sortOrder: targetIndex + 1,
                parentWidgetId: nextParentWidgetId,
                slotKey: nextSlotKey
            })
        )
    })
}
