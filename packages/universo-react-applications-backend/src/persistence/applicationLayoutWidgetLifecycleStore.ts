import { qSchemaTable } from '@universo-react/database'
import {
    applicationTemplateKeySchema,
    getLayoutWidgetDefinition,
    type ApplicationLayoutWidget,
    type ApplicationLayoutWidgetToggleMutation
} from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import { softDeleteSetClause } from '@universo-react/utils/database'
import {
    assertInterpretationNetworkSingleSystemTransitionAllowed,
    lockInterpretationNetworkStructureMode
} from '../shared/interpretationNetworkStructureModeGuard'
import { strictApplicationLayoutWidgetToggleMutationSchema } from '../validation/applicationLayoutMutationSchemas'
import { classifyPlacementLineage } from './applicationLayoutWidgetPlacement'
import { assertMarketingHeroActionsRemainValidAfterToggle } from './applicationLayoutMarketingActionIntegrity'
import { mapWidgetWithCanonicalSourceState, refreshLayoutLocalContentHash } from './applicationLayoutWidgetMutationSupport'
import {
    applicationLayoutWidgetPredicate,
    lockApplicationLayoutMutation,
    validateApplicationLayoutWidgetGraph,
    type WidgetRow
} from './applicationLayoutStoreSupport'

const isSourceOwnedPlacement = (sourceKind: 'metahub' | 'application', widget: ApplicationLayoutWidget): boolean => {
    if (classifyPlacementLineage(widget.sourceWidgetId, widget.sourceBaseWidgetId).kind === 'source-linked') return true
    if (sourceKind !== 'metahub' || (widget.isCustomized && widget.sourceConfig === null)) return false

    const definition = getLayoutWidgetDefinition(widget.widgetKey, widget.config)
    const sourceAuthority = definition?.sourcePolicy?.authority
    const presentationOnly = definition?.authoring?.application?.presentationOnly
    return sourceAuthority === 'metahub-source' || presentationOnly === true || (sourceAuthority == null && presentationOnly == null)
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
        const templateKey = applicationTemplateKeySchema.safeParse(currentLayout.item.templateKey)
        if (!templateKey.success) throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
        if (
            data.isActive !== current.isActive &&
            classifyPlacementLineage(current.sourceWidgetId, current.sourceBaseWidgetId).kind === 'source-linked'
        ) {
            const activeOverrideAllowed = getLayoutWidgetDefinition(current.widgetKey, current.config)?.applicationPlacementOverrides
                ?.active
            if (activeOverrideAllowed !== true) throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
        }
        const candidateWidgets = currentLayout.widgets.map((widget) =>
            widget.id === current.id ? { ...widget, isActive: data.isActive } : widget
        )
        validateApplicationLayoutWidgetGraph(
            templateKey.data,
            candidateWidgets.filter((widget) => widget.isActive),
            { effectiveGraph: true }
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
        return mapWidgetWithCanonicalSourceState(rows[0], currentLayout.item.templateKey)
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
        if (!currentLayout || !currentLayout.item.isActive) {
            throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        }
        const widgetToDelete = currentLayout.widgets.find((widget) => widget.id === widgetId)
        if (!widgetToDelete || widgetToDelete.version !== expectedVersion) throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        const templateKey = applicationTemplateKeySchema.safeParse(currentLayout.item.templateKey)
        if (!templateKey.success) throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
        const canExcludeOverlayPlacement =
            currentLayout.item.sourceKind === 'application' &&
            currentLayout.item.compositionMode === 'overlay' &&
            typeof currentLayout.item.baseLayoutId === 'string' &&
            widgetToDelete.sourceBaseWidgetId != null
        // Removing a base-linked overlay row records the overlay's local exclusion; it does not delete the base placement.
        if (isSourceOwnedPlacement(currentLayout.item.sourceKind, widgetToDelete) && !canExcludeOverlayPlacement) {
            throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
        }

        const childrenByParent = new Map<string, ApplicationLayoutWidget[]>()
        for (const widget of currentLayout.widgets) {
            if (widget.parentWidgetId === null) continue
            const children = childrenByParent.get(widget.parentWidgetId) ?? []
            children.push(widget)
            childrenByParent.set(widget.parentWidgetId, children)
        }

        const widgetsToDelete = [widgetToDelete]
        const widgetIdsToDelete = new Set([widgetToDelete.id])
        for (let index = 0; index < widgetsToDelete.length; index += 1) {
            for (const child of childrenByParent.get(widgetsToDelete[index]!.id) ?? []) {
                if (widgetIdsToDelete.has(child.id)) throw new Error('APPLICATION_LAYOUT_WIDGET_GRAPH_INVALID')
                widgetIdsToDelete.add(child.id)
                widgetsToDelete.push(child)
            }
        }
        if (widgetsToDelete.some((widget) => widget.layoutId !== layoutId)) {
            throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
        }

        const remainingWidgets = currentLayout.widgets.filter((widget) => !widgetIdsToDelete.has(widget.id))
        validateApplicationLayoutWidgetGraph(templateKey.data, remainingWidgets)
        validateApplicationLayoutWidgetGraph(
            templateKey.data,
            remainingWidgets.filter((widget) => widget.isActive),
            { effectiveGraph: true }
        )

        const rows = await tx.query<{ id: string; layout_id: string }>(
            `UPDATE ${widgetsTable} AS w SET ${softDeleteSetClause('$1')}, _upl_version = COALESCE(w._upl_version, 1) + 1
              FROM unnest($3::uuid[], $4::int[]) AS deletion_target(id, version)
              WHERE w.id = deletion_target.id AND w.layout_id = $2
                AND w._upl_deleted = false AND w._app_deleted = false
                AND COALESCE(w._upl_version, 1) = deletion_target.version
                AND ${applicationLayoutWidgetPredicate(layoutsTable, 'w.layout_id')}
              RETURNING w.id, w.layout_id`,
            [userId, layoutId, widgetsToDelete.map((widget) => widget.id), widgetsToDelete.map((widget) => widget.version)]
        )
        const deletedIds = new Set(rows.map((row) => row.id))
        if (
            rows.length !== widgetsToDelete.length ||
            deletedIds.size !== widgetsToDelete.length ||
            widgetsToDelete.some((widget) => !deletedIds.has(widget.id)) ||
            rows.some((row) => row.layout_id !== layoutId)
        ) {
            throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        }
        await refreshLayoutLocalContentHash(tx, schemaName, layoutId, userId)
        return true
    })
}
