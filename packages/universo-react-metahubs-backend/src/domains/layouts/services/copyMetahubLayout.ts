import { qSchemaTable } from '@universo-react/database'
import { queryMany, queryOne, withTransactionSavepoint, type SqlQueryable } from '@universo-react/utils/database'
import { validation } from '@universo-react/utils'
import { MetahubDomainError } from '../../shared/domainErrors'
import { acquireMetahubLayoutGraphLock } from '../layoutGraphLocks'
import {
    assertCopyScopeOwnerSupportsLayout,
    assertExpectedLayoutVersion,
    lockAndValidateLayoutBase,
    resolveLayoutCopyOwnership
} from './copyMetahubLayoutOwnership'
import { prepareLayoutCopy } from './copyMetahubLayoutPreparation'
import { insertCopiedLayout } from './copyMetahubLayoutPersistence'
import { insertCopiedWidgets, prepareWidgetCopyGraph } from './copyMetahubLayoutWidgetOperations'
import { insertCopiedOverrides, prepareOverrideCopies } from './copyMetahubLayoutOverrideOperations'
import type { CopyMetahubLayoutParams, SourceBaseWidgetRow, SourceLayoutWidgetOverrideRow, SourceWidgetRow } from './copyMetahubLayoutTypes'

const { normalizeLayoutCopyOptions } = validation

/** Copy one layout and its owned widget graph atomically within a metahub schema. */
export const copyMetahubLayout = async ({ executor, schemaName, layoutId, userId, input }: CopyMetahubLayoutParams) => {
    const layoutsQt = qSchemaTable(schemaName, '_mhb_layouts')
    const widgetsQt = qSchemaTable(schemaName, '_mhb_widgets')
    const overridesQt = qSchemaTable(schemaName, '_mhb_layout_widget_overrides')
    const copyOptions = normalizeLayoutCopyOptions({
        copyWidgets: input.copyWidgets,
        deactivateAllWidgets: input.deactivateAllWidgets
    })
    const shouldDeactivateWidgets = copyOptions.copyWidgets && (input.deactivateAllWidgets ?? copyOptions.deactivateAllWidgets)

    return withTransactionSavepoint(executor, async (trx: SqlQueryable) => {
        await acquireMetahubLayoutGraphLock(trx, schemaName)
        const sourceLayout = await queryOne<Record<string, unknown>>(
            trx,
            `SELECT * FROM ${layoutsQt}
                 WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false
                 FOR UPDATE`,
            [layoutId]
        )
        if (!sourceLayout) {
            throw new MetahubDomainError({
                message: 'Layout not found',
                statusCode: 404,
                code: 'NOT_FOUND',
                details: { operation: 'copy-layout' }
            })
        }

        assertExpectedLayoutVersion(sourceLayout, input.expectedVersion)
        const ownership = resolveLayoutCopyOwnership(sourceLayout)
        if (ownership.scopeEntityId !== null) {
            await assertCopyScopeOwnerSupportsLayout(trx, schemaName, ownership.scopeEntityId)
        }
        if (ownership.baseLayoutId !== null) {
            await lockAndValidateLayoutBase(trx, layoutsQt, ownership.baseLayoutId, ownership.templateKey)
        }

        const sourceWidgets = copyOptions.copyWidgets
            ? await queryMany<SourceWidgetRow>(
                  trx,
                  `SELECT id, zone, widget_key, sort_order, config, is_active
                         FROM ${widgetsQt}
                        WHERE layout_id = $1 AND _upl_deleted = false AND _mhb_deleted = false
                        ORDER BY zone ASC, sort_order ASC, _upl_created_at ASC
                        FOR UPDATE`,
                  [layoutId]
              )
            : []
        const sourceOverrides =
            ownership.isOverlayLayout && copyOptions.copyWidgets
                ? await queryMany<SourceLayoutWidgetOverrideRow>(
                      trx,
                      `SELECT base_widget_id, zone, sort_order, config, is_active, is_deleted_override
                         FROM ${overridesQt}
                         WHERE layout_id = $1 AND _upl_deleted = false AND _mhb_deleted = false
                         ORDER BY _upl_created_at ASC
                         FOR UPDATE`,
                      [layoutId]
                  )
                : []
        const baseWidgets = ownership.isOverlayLayout
            ? await queryMany<SourceBaseWidgetRow>(
                  trx,
                  `SELECT id, widget_key, zone, sort_order, config, is_active FROM ${widgetsQt}
                         WHERE layout_id = $1 AND _upl_deleted = false AND _mhb_deleted = false
                         ORDER BY zone ASC, sort_order ASC, _upl_created_at ASC
                         FOR UPDATE`,
                  [ownership.baseLayoutId]
              )
            : []

        const widgetGraph = prepareWidgetCopyGraph({
            templateKey: ownership.templateKey,
            sourceWidgets,
            baseWidgets,
            sourceOverrides,
            copyWidgets: copyOptions.copyWidgets,
            shouldDeactivateWidgets,
            input,
            isOverlayLayout: ownership.isOverlayLayout
        })
        const preparedLayout = prepareLayoutCopy(sourceLayout, input, ownership, copyOptions.copyWidgets, shouldDeactivateWidgets)
        const now = new Date()
        const createdLayout = await insertCopiedLayout({
            trx,
            layoutsQt,
            sourceLayoutId: layoutId,
            ownership,
            preparedLayout,
            now,
            userId
        })

        if (copyOptions.copyWidgets) {
            await insertCopiedWidgets({
                trx,
                widgetsQt,
                layoutId: createdLayout.id,
                userId,
                now,
                preparedWidgets: widgetGraph.preparedWidgets
            })
        }

        if (ownership.isOverlayLayout) {
            const overrides = prepareOverrideCopies({
                templateKey: ownership.templateKey,
                copyWidgets: copyOptions.copyWidgets,
                shouldDeactivateWidgets,
                sourceOverrides,
                baseWidgets,
                sourceOverrideByWidgetId: widgetGraph.sourceOverrideByWidgetId,
                boundInheritedWidgets: widgetGraph.boundInheritedWidgets,
                entityBindingCopyMode: input.entityBindingCopyMode,
                copiedWidgetRows: widgetGraph.copiedWidgetRows
            })
            await insertCopiedOverrides({
                trx,
                overridesQt,
                layoutId: createdLayout.id,
                userId,
                now,
                overrides
            })
        }

        return createdLayout
    })
}
