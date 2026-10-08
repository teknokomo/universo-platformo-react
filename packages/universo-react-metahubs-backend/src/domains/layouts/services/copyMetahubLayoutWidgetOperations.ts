import { layoutInstanceKeySchema, type ApplicationTemplateKey } from '@universo-react/types'
import type { SqlQueryable } from '@universo-react/utils/database'
import { generateUuidV7, isUuidV7 } from '@universo-react/utils'
import { MetahubDomainError } from '../../shared/domainErrors'
import { requireLayoutWidgetOwnership } from '../widgetOwnership'
import { validateLayoutWidgetPlacementGraph } from '../widgetPlacementGraph'
import { resolveLayoutCopyBindings } from './layoutCopyBindings'
import { assertNoDuplicateActiveSingleInstanceWidgets, prepareCopiedWidgetConfig } from './copyMetahubLayoutValidation'
import type {
    CopyMetahubLayoutInput,
    PreparedWidgetCopy,
    PreparedWidgetCopyGraph,
    SourceBaseWidgetRow,
    SourceLayoutWidgetOverrideRow,
    SourceWidgetRow
} from './copyMetahubLayoutTypes'

const orderPlacementTree = (widgets: readonly SourceWidgetRow[], externalParentIds: ReadonlySet<string>): SourceWidgetRow[] => {
    const byId = new Map<string, SourceWidgetRow>()
    for (const widget of widgets) {
        if (!widget.id || !isUuidV7(widget.id) || byId.has(widget.id)) {
            throw new MetahubDomainError({
                message: 'Layout widget placement identity is invalid',
                statusCode: 409,
                code: 'VALIDATION_ERROR',
                details: { operation: 'copy-layout' }
            })
        }
        if ((widget.parent_widget_id == null) !== (widget.slot_key == null)) {
            throw new MetahubDomainError({
                message: 'Layout widget parent and slot must be provided together',
                statusCode: 409,
                code: 'VALIDATION_ERROR',
                details: { operation: 'copy-layout' }
            })
        }
        byId.set(widget.id, widget)
    }

    const ordered: SourceWidgetRow[] = []
    const visiting = new Set<string>()
    const visited = new Set<string>()
    const visit = (widget: SourceWidgetRow): void => {
        const id = widget.id as string
        if (visited.has(id)) return
        if (visiting.has(id)) {
            throw new MetahubDomainError({
                message: 'Layout widget placement graph contains a cycle',
                statusCode: 409,
                code: 'VALIDATION_ERROR',
                details: { operation: 'copy-layout' }
            })
        }
        visiting.add(id)
        if (widget.parent_widget_id) {
            const parent = byId.get(widget.parent_widget_id)
            if (parent) {
                visit(parent)
            } else if (!externalParentIds.has(widget.parent_widget_id)) {
                throw new MetahubDomainError({
                    message: 'Layout widget placement graph has a missing parent',
                    statusCode: 409,
                    code: 'VALIDATION_ERROR',
                    details: { operation: 'copy-layout' }
                })
            }
        }
        visiting.delete(id)
        visited.add(id)
        ordered.push(widget)
    }
    widgets.forEach(visit)
    return ordered
}

export const prepareWidgetCopyGraph = ({
    templateKey,
    sourceWidgets,
    baseWidgets,
    sourceOverrides,
    copyWidgets,
    shouldDeactivateWidgets,
    input,
    isOverlayLayout
}: {
    templateKey: ApplicationTemplateKey
    sourceWidgets: SourceWidgetRow[]
    baseWidgets: SourceBaseWidgetRow[]
    sourceOverrides: SourceLayoutWidgetOverrideRow[]
    copyWidgets: boolean
    shouldDeactivateWidgets: boolean
    input: CopyMetahubLayoutInput
    isOverlayLayout: boolean
}): PreparedWidgetCopyGraph => {
    const sourceOverrideByWidgetId = new Map(
        sourceOverrides
            .filter(
                (override): override is SourceLayoutWidgetOverrideRow & { base_widget_id: string } =>
                    typeof override.base_widget_id === 'string' && override.base_widget_id.length > 0
            )
            .map((override) => [override.base_widget_id, override])
    )
    const effectiveBaseWidgets = isOverlayLayout
        ? baseWidgets.flatMap((widget) => {
              const override = sourceOverrideByWidgetId.get(widget.id)
              if (override?.is_deleted_override === true) return []
              return [{ ...widget, zone: override?.zone ?? widget.zone, config: override?.config ?? widget.config }]
          })
        : []
    validateLayoutWidgetPlacementGraph(templateKey, [...effectiveBaseWidgets, ...sourceWidgets])
    const externalParentIds = new Set(effectiveBaseWidgets.map(({ id }) => id))
    const orderedSourceWidgets = orderPlacementTree(sourceWidgets, externalParentIds).filter((widget) => {
        if (typeof widget.widget_key !== 'string' || typeof widget.zone !== 'string') {
            throw new MetahubDomainError({
                message: 'Layout widget placement definition is invalid',
                statusCode: 409,
                code: 'VALIDATION_ERROR',
                details: { operation: 'copy-layout' }
            })
        }
        return requireLayoutWidgetOwnership(templateKey, widget.widget_key).copyPolicy.placement === 'copy'
    })
    const copiedIds = new Map(orderedSourceWidgets.map((widget) => [widget.id as string, generateUuidV7()]))
    const preparedSourceWidgetsWithBindings = orderedSourceWidgets.map((widget) => {
        const sourceParentId = widget.parent_widget_id ?? null
        const parentWidgetId = sourceParentId
            ? copiedIds.get(sourceParentId) ?? (externalParentIds.has(sourceParentId) ? sourceParentId : undefined)
            : null
        if (sourceParentId && !parentWidgetId) {
            throw new MetahubDomainError({
                message: 'Layout widget parent could not be remapped',
                statusCode: 409,
                code: 'VALIDATION_ERROR',
                details: { operation: 'copy-layout' }
            })
        }
        if (!layoutInstanceKeySchema.safeParse(widget.instance_key).success) {
            throw new MetahubDomainError({
                message: 'Layout widget instance identity is missing',
                statusCode: 409,
                code: 'VALIDATION_ERROR',
                details: { operation: 'copy-layout' }
            })
        }
        return {
            widget,
            id: copiedIds.get(widget.id as string) as string,
            instanceKey: generateUuidV7(),
            parentWidgetId: parentWidgetId ?? null,
            slotKey: widget.slot_key ?? null,
            config: prepareCopiedWidgetConfig(templateKey, widget.widget_key, widget.zone, widget.config),
            isActive: shouldDeactivateWidgets ? false : widget.is_active !== false
        }
    })
    const resolvedBindings = resolveLayoutCopyBindings({
        templateKey,
        preparedWidgets: preparedSourceWidgetsWithBindings,
        baseWidgets,
        sourceOverrides,
        copyOverrides: copyWidgets,
        copyMode: input.entityBindingCopyMode,
        isOverlayLayout
    })
    const preparedWidgets: PreparedWidgetCopy[] = resolvedBindings.preparedWidgets.map((item) => {
        const { widget, id, instanceKey, parentWidgetId, slotKey, config, isActive } = item
        if (!id || !instanceKey || parentWidgetId === undefined || slotKey === undefined) {
            throw new MetahubDomainError({
                message: 'Prepared layout placement identity is incomplete',
                statusCode: 409,
                code: 'VALIDATION_ERROR',
                details: { operation: 'copy-layout' }
            })
        }
        return { widget, id, instanceKey, parentWidgetId, slotKey, config: config as Record<string, unknown>, isActive }
    })
    const retainedSourceIds = new Set(preparedWidgets.map(({ widget }) => widget.id))
    if (
        preparedWidgets.some(
            ({ widget }) =>
                widget.parent_widget_id !== null &&
                widget.parent_widget_id !== undefined &&
                !retainedSourceIds.has(widget.parent_widget_id) &&
                !externalParentIds.has(widget.parent_widget_id)
        )
    ) {
        throw new MetahubDomainError({
            message: 'A copied child placement cannot outlive its parent placement',
            statusCode: 409,
            code: 'VALIDATION_ERROR',
            details: { operation: 'copy-layout' }
        })
    }
    const copiedWidgetRows = preparedWidgets.map(({ widget, isActive }) => ({
        widgetKey: widget.widget_key,
        isActive
    }))
    assertNoDuplicateActiveSingleInstanceWidgets(copiedWidgetRows)
    validateLayoutWidgetPlacementGraph(templateKey, [
        ...effectiveBaseWidgets,
        ...preparedWidgets.map(({ widget, id, instanceKey, parentWidgetId, slotKey, config }) => ({
            id,
            instanceKey,
            parentWidgetId,
            slotKey,
            widget_key: widget.widget_key,
            zone: widget.zone,
            config
        }))
    ])

    return {
        preparedWidgets,
        copiedWidgetRows,
        sourceOverrideByWidgetId: resolvedBindings.sourceOverrideByWidgetId,
        boundInheritedWidgets: resolvedBindings.boundInheritedWidgets
    }
}

export const insertCopiedWidgets = async ({
    trx,
    widgetsQt,
    layoutId,
    userId,
    now,
    preparedWidgets
}: {
    trx: SqlQueryable
    widgetsQt: string
    layoutId: unknown
    userId: string | null
    now: Date
    preparedWidgets: PreparedWidgetCopy[]
}): Promise<void> => {
    if (preparedWidgets.length === 0) return

    for (const { widget, id, instanceKey, parentWidgetId, slotKey, config, isActive } of preparedWidgets) {
        const inserted = await trx.query<{ id: string; instance_key: string }>(
            `INSERT INTO ${widgetsQt} (
                id, layout_id, instance_key, parent_widget_id, slot_key, zone, widget_key, sort_order, config, is_active,
                _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by, _upl_version,
                _upl_archived, _upl_deleted, _upl_locked, _mhb_published, _mhb_archived, _mhb_deleted
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $11, $12, 1, false, false, false, true, false, false)
            RETURNING id, instance_key`,
            [
                id,
                layoutId,
                instanceKey,
                parentWidgetId,
                slotKey,
                widget.zone,
                widget.widget_key,
                widget.sort_order ?? 1,
                JSON.stringify(config),
                isActive,
                now,
                userId ?? null
            ]
        )
        if (inserted.length !== 1 || inserted[0]?.id !== id || inserted[0]?.instance_key !== instanceKey) {
            throw new MetahubDomainError({
                message: 'Failed to create copied layout widget',
                statusCode: 500,
                code: 'SCHEMA_SYNC_FAILED',
                details: { operation: 'copy-layout' }
            })
        }
    }
}
