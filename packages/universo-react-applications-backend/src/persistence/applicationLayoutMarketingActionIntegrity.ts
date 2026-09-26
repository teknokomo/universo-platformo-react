import { qColumn, qSchemaTable } from '@universo-react/database'
import {
    getLayoutWidgetDefinition,
    getMarketingActionSectionTargets,
    getMarketingSectionAnchorEntries,
    marketingActionSchema,
    validateWidgetBindings,
    type ApplicationLayoutDetailResponse
} from '@universo-react/types'
import { isUuidV7, type DbExecutor } from '@universo-react/utils'
import { getApplicationLayoutWidgetSourceBindingState } from './applicationLayoutStoreSupport'
import { resolveRuntimeCodenameText, runtimeCodenameTextSql, runtimeObjectFilterSql } from '../shared/runtimeHelpers'
import { isCompatibleMarketingHeroObject } from '../services/marketingHeroEntityBinding'

const HERO_WIDGET_KEY = 'marketing.hero'
const MAX_BOUND_HERO_RECORDS = 1000
export const APPLICATION_LAYOUT_MARKETING_HERO_ACTION_INTEGRITY_CONFLICT = 'APPLICATION_LAYOUT_MARKETING_HERO_ACTION_INTEGRITY_CONFLICT'

type RuntimeObjectRow = { id: unknown; tableName: unknown; codename: unknown; kind: unknown; config: unknown }
type RuntimeComponentRow = { codename: unknown; columnName: unknown; dataType: unknown; is_required: unknown; validation_rules: unknown }
type RuntimeHeroRow = Record<string, unknown>
type HeroTargetProjection = {
    entityCodename: string
    semanticKey: string
    selectorComponent: string
    primaryActionComponent: string
    termsActionComponent: string | null
}

const failIntegrity = (): never => {
    throw new Error(APPLICATION_LAYOUT_MARKETING_HERO_ACTION_INTEGRITY_CONFLICT)
}

const getHeroTargetProjections = (layout: ApplicationLayoutDetailResponse): HeroTargetProjection[] => {
    const definition = getLayoutWidgetDefinition(HERO_WIDGET_KEY)
    const contentSlot = definition?.bindingSlots?.find(({ key }) => key === 'content')
    const semanticKeyRequirement = contentSlot?.requirements.components.find(({ semanticKey }) => semanticKey === true)
    const primaryActionRequirement = contentSlot?.requirements.components.find(({ field }) => field === 'primaryAction')
    const termsActionRequirement = contentSlot?.requirements.components.find(({ field }) => field === 'termsAction')
    if (!definition || !contentSlot || !semanticKeyRequirement || !primaryActionRequirement) return failIntegrity()

    const result: HeroTargetProjection[] = []
    for (const widget of layout.widgets) {
        if (!widget.isActive || widget.widgetKey !== HERO_WIDGET_KEY) continue

        const rawBindings = getApplicationLayoutWidgetSourceBindingState(widget)?.bindings
        if (rawBindings === undefined) return failIntegrity()

        let bindings: ReturnType<typeof validateWidgetBindings>
        try {
            bindings = validateWidgetBindings(definition, rawBindings)
        } catch {
            return failIntegrity()
        }
        const contentBinding = bindings.slots.find(({ slot }) => slot === contentSlot.key)
        if (!contentBinding) return failIntegrity()

        for (const target of contentBinding.targets) {
            if (
                target.entityKind !== 'object' ||
                target.selector.kind !== 'semantic-key' ||
                target.selector.field !== semanticKeyRequirement.field
            ) {
                return failIntegrity()
            }
            const selector = target.projection.find(({ field }) => field === semanticKeyRequirement.field)
            const primaryAction = target.projection.find(({ field }) => field === 'primaryAction')
            const termsAction = target.projection.find(({ field }) => field === 'termsAction')
            if (
                !selector ||
                selector.componentCodename !== semanticKeyRequirement.componentCodename ||
                !primaryAction ||
                primaryAction.componentCodename !== primaryActionRequirement.componentCodename ||
                (termsActionRequirement && termsAction && termsAction.componentCodename !== termsActionRequirement.componentCodename)
            ) {
                return failIntegrity()
            }
            result.push({
                entityCodename: target.entityCodename,
                semanticKey: target.selector.value,
                selectorComponent: selector.componentCodename,
                primaryActionComponent: primaryAction.componentCodename,
                termsActionComponent: termsAction ? termsAction.componentCodename : null
            })
        }
    }
    return result
}

const loadBoundHeroRows = async (
    executor: DbExecutor,
    schemaName: string,
    target: HeroTargetProjection
): Promise<{ rows: RuntimeHeroRow[]; columns: Map<string, string> }> => {
    const objectRows = await executor.query<RuntimeObjectRow>(
        `
        SELECT o.id, o.table_name AS "tableName", o.codename, o.kind, o.config
        FROM ${qSchemaTable(schemaName, '_app_objects')} o
        WHERE COALESCE(o.kind, '') = 'object'
          AND ${runtimeObjectFilterSql('o.kind', 'o.config')}
          AND ${runtimeCodenameTextSql('o.codename')} = $1::text
          AND o._upl_deleted = false
          AND o._app_deleted = false
        ORDER BY o.id ASC
        LIMIT 2
        FOR SHARE
        `,
        [target.entityCodename]
    )
    const object = objectRows[0]
    if (objectRows.length !== 1 || !object || !isUuidV7(object.id) || typeof object.tableName !== 'string') return failIntegrity()

    let heroTable: string
    try {
        heroTable = qSchemaTable(schemaName, object.tableName)
    } catch {
        return failIntegrity()
    }

    const logicalComponents = [
        target.selectorComponent,
        target.primaryActionComponent,
        ...(target.termsActionComponent ? [target.termsActionComponent] : [])
    ]
    const componentRows = await executor.query<RuntimeComponentRow>(
        `
        SELECT c.codename, c.column_name AS "columnName", c.data_type AS "dataType", c.is_required, c.validation_rules
        FROM ${qSchemaTable(schemaName, '_app_components')} c
        WHERE c.object_id = $1
          AND c.parent_component_id IS NULL
          AND c._upl_deleted = false
          AND c._app_deleted = false
        ORDER BY c.id ASC
        FOR SHARE
        `,
        [object.id]
    )

    if (
        !isCompatibleMarketingHeroObject(
            { kind: object.kind, config: object.config },
            componentRows.map((row) => ({ ...row, codename: resolveRuntimeCodenameText(row.codename) }))
        )
    )
        return failIntegrity()
    const columns = new Map<string, string>()
    const physicalColumns = new Set<string>()
    for (const row of componentRows) {
        const codename = resolveRuntimeCodenameText(row.codename)
        if (!logicalComponents.includes(codename)) continue
        if (columns.has(codename) || typeof row.columnName !== 'string') return failIntegrity()
        try {
            qColumn(row.columnName)
        } catch {
            return failIntegrity()
        }
        if (physicalColumns.has(row.columnName)) return failIntegrity()
        columns.set(codename, row.columnName)
        physicalColumns.add(row.columnName)
    }
    if (logicalComponents.some((codename) => !columns.has(codename))) return failIntegrity()

    const selectorCodename = target.selectorComponent
    const selectorColumn = columns.get(selectorCodename)
    if (!selectorColumn) return failIntegrity()
    const selectedColumns = [...new Set(logicalComponents.map((codename) => columns.get(codename)!))]
    const rowLimit = MAX_BOUND_HERO_RECORDS + 1
    const rows = await executor.query<RuntimeHeroRow>(
        `
        SELECT ${[qColumn('id'), ...selectedColumns.map(qColumn)].join(', ')}
        FROM ${heroTable}
        WHERE _upl_deleted = false
          AND _app_deleted = false
          AND ${qColumn(selectorColumn)}::text = ANY($1::text[])
        ORDER BY id ASC
        LIMIT $2
        FOR SHARE
        `,
        [[target.semanticKey], rowLimit]
    )
    if (rows.length > MAX_BOUND_HERO_RECORDS) return failIntegrity()
    return { rows, columns }
}

/**
 * Reject a widget toggle when it would leave an active bound Hero action
 * without a matching section anchor. The layout snapshot and Entity records
 * are read under the caller's existing layout mutation transaction and locks.
 */
export const assertMarketingHeroActionsRemainValidAfterToggle = async (
    executor: DbExecutor,
    schemaName: string,
    layout: ApplicationLayoutDetailResponse,
    widgetId: string,
    isActive: boolean
): Promise<void> => {
    if (layout.item.templateKey !== 'marketing-page') return
    const current = layout.widgets.find(({ id }) => id === widgetId)
    if (!current || current.isActive === isActive) return

    const nextWidgets = layout.widgets.map((widget) => (widget.id === widgetId ? { ...widget, isActive } : widget))
    const currentTargets = new Set(getMarketingActionSectionTargets(layout.widgets).map(({ href }) => href))
    const nextTargets = new Set(getMarketingActionSectionTargets(nextWidgets).map(({ href }) => href))
    const removedTargets = new Set([...currentTargets].filter((href) => !nextTargets.has(href)))
    const activatingHero = current.widgetKey === 'marketing.hero' && isActive
    if (removedTargets.size === 0 && !activatingHero) return

    const heroTargets = getHeroTargetProjections({ ...layout, widgets: nextWidgets })
    if (heroTargets.length === 0) return

    const validTargets = new Set(getMarketingSectionAnchorEntries(nextWidgets).map(([key]) => `#${key}`))
    for (const target of heroTargets) {
        const { rows, columns } = await loadBoundHeroRows(executor, schemaName, target)
        const selectorColumn = columns.get(target.selectorComponent)
        if (!selectorColumn) return failIntegrity()
        const matches = rows.filter((row) => isUuidV7(row.id) && row[selectorColumn] === target.semanticKey)
        if (matches.length !== rows.length) return failIntegrity()
        if (matches.length === 0) return failIntegrity()
        const primaryActionColumn = columns.get(target.primaryActionComponent)
        const termsActionColumn = target.termsActionComponent ? columns.get(target.termsActionComponent) : null
        if (!primaryActionColumn || (target.termsActionComponent && !termsActionColumn)) return failIntegrity()

        for (const row of matches) {
            const primaryAction = marketingActionSchema.safeParse(row[primaryActionColumn])
            if (!primaryAction.success) return failIntegrity()
            if (primaryAction.data.kind === 'anchor' && !validTargets.has(primaryAction.data.href)) return failIntegrity()

            const rawTermsAction = termsActionColumn ? row[termsActionColumn] : undefined
            if (rawTermsAction === undefined || rawTermsAction === null) continue
            const termsAction = marketingActionSchema.safeParse(rawTermsAction)
            if (!termsAction.success) return failIntegrity()
            if (termsAction.data.kind === 'anchor' && !validTargets.has(termsAction.data.href)) return failIntegrity()
        }
    }
}
