import type { ApplicationTemplateKey } from '@universo-react/types'
import type { SqlQueryable } from '@universo-react/utils/database'
import { MetahubDomainError } from '../../shared/domainErrors'
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
    const preparedSourceWidgetsWithBindings = sourceWidgets.map((widget) => ({
        widget,
        config: prepareCopiedWidgetConfig(templateKey, widget.widget_key, widget.zone, widget.config),
        isActive: shouldDeactivateWidgets ? false : widget.is_active !== false
    }))
    const resolvedBindings = resolveLayoutCopyBindings({
        templateKey,
        preparedWidgets: preparedSourceWidgetsWithBindings,
        baseWidgets,
        sourceOverrides,
        copyOverrides: copyWidgets,
        copyMode: input.entityBindingCopyMode,
        isMarketingOverlay: isOverlayLayout
    })
    const preparedWidgets: PreparedWidgetCopy[] = resolvedBindings.preparedWidgets.map(({ widget, config, isActive }) => ({
        widget,
        config: config as Record<string, unknown>,
        isActive
    }))
    const copiedWidgetRows = preparedWidgets.map(({ widget, isActive }) => ({
        widgetKey: widget.widget_key,
        isActive
    }))
    assertNoDuplicateActiveSingleInstanceWidgets(copiedWidgetRows)

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

    const placeholders: string[] = []
    const params: unknown[] = []
    let idx = 1
    for (const { widget, config, isActive } of preparedWidgets) {
        placeholders.push(
            `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7}, $${idx + 6}, $${
                idx + 7
            }, $${idx + 8}, $${idx + 9}, $${idx + 9}, $${idx + 9}, $${idx + 10}, $${idx + 9}, $${idx + 9})`
        )
        params.push(
            layoutId,
            widget.zone,
            widget.widget_key,
            widget.sort_order ?? 1,
            JSON.stringify(config),
            isActive,
            now,
            userId ?? null,
            1,
            false,
            true
        )
        idx += 11
    }

    const insertedRows = await trx.query<{ id: string }>(
        `INSERT INTO ${widgetsQt} (
            layout_id, zone, widget_key, sort_order, config, is_active,
            _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by, _upl_version,
            _upl_archived, _upl_deleted, _upl_locked,
            _mhb_published, _mhb_archived, _mhb_deleted
        ) VALUES ${placeholders.join(', ')}
        RETURNING id`,
        params
    )
    if (insertedRows.length !== preparedWidgets.length) {
        throw new MetahubDomainError({
            message: 'Failed to create copied layout widgets',
            statusCode: 500,
            code: 'SCHEMA_SYNC_FAILED',
            details: { operation: 'copy-layout' }
        })
    }
}
