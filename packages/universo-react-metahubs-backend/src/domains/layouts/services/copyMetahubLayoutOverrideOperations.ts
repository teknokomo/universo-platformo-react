import type { ApplicationTemplateKey } from '@universo-react/types'
import type { SqlQueryable } from '@universo-react/utils/database'
import { MetahubDomainError } from '../../shared/domainErrors'
import { assertNoDuplicateActiveSingleInstanceWidgets, prepareCopiedOverrideConfig } from './copyMetahubLayoutValidation'
import type {
    CopyMetahubLayoutInput,
    PreparedOverrideCopy,
    PreparedWidgetCopyGraph,
    SourceBaseWidgetRow,
    SourceLayoutWidgetOverrideRow
} from './copyMetahubLayoutTypes'

export const prepareOverrideCopies = ({
    templateKey,
    copyWidgets,
    shouldDeactivateWidgets,
    sourceOverrides,
    baseWidgets,
    sourceOverrideByWidgetId,
    boundInheritedWidgets,
    entityBindingCopyMode,
    copiedWidgetRows
}: {
    templateKey: ApplicationTemplateKey
    copyWidgets: boolean
    shouldDeactivateWidgets: boolean
    sourceOverrides: SourceLayoutWidgetOverrideRow[]
    baseWidgets: SourceBaseWidgetRow[]
    sourceOverrideByWidgetId: Map<string, SourceLayoutWidgetOverrideRow>
    boundInheritedWidgets: Set<string>
    entityBindingCopyMode: CopyMetahubLayoutInput['entityBindingCopyMode']
    copiedWidgetRows: PreparedWidgetCopyGraph['copiedWidgetRows']
}): PreparedOverrideCopy[] => {
    let overridesToCopy = !copyWidgets
        ? []
        : shouldDeactivateWidgets
        ? baseWidgets.map((baseWidget) => {
              const sourceOverride = sourceOverrideByWidgetId.get(baseWidget.id)
              if (sourceOverride?.is_deleted_override === true) {
                  return {
                      baseWidgetId: baseWidget.id,
                      zone: sourceOverride.zone ?? null,
                      sortOrder: sourceOverride.sort_order ?? null,
                      config: prepareCopiedOverrideConfig(
                          templateKey,
                          baseWidget.widget_key,
                          sourceOverride.zone ?? baseWidget.zone,
                          sourceOverride.config
                      ),
                      isActive: null,
                      isDeletedOverride: true
                  }
              }

              return {
                  baseWidgetId: baseWidget.id,
                  zone: sourceOverride?.zone ?? null,
                  sortOrder: sourceOverride?.sort_order ?? null,
                  config: prepareCopiedOverrideConfig(
                      templateKey,
                      baseWidget.widget_key,
                      sourceOverride?.zone ?? baseWidget.zone,
                      sourceOverride?.config
                  ),
                  isActive: false,
                  isDeletedOverride: false
              }
          })
        : sourceOverrides
              .filter((row) => typeof row.base_widget_id === 'string' && row.base_widget_id.length > 0)
              .map((row) => {
                  const baseWidget = baseWidgets.find((widget) => widget.id === String(row.base_widget_id))
                  return {
                      baseWidgetId: String(row.base_widget_id),
                      zone: row.zone ?? null,
                      sortOrder: row.sort_order ?? null,
                      config: prepareCopiedOverrideConfig(templateKey, baseWidget?.widget_key, row.zone ?? baseWidget?.zone, row.config),
                      isActive: typeof row.is_active === 'boolean' ? row.is_active : null,
                      isDeletedOverride: row.is_deleted_override === true
                  }
              })

    assertNoDuplicateActiveSingleInstanceWidgets([
        ...copiedWidgetRows,
        ...baseWidgets.map((baseWidget) => {
            const sourceOverride = sourceOverrideByWidgetId.get(baseWidget.id)
            return {
                widgetKey: baseWidget.widget_key,
                isActive: shouldDeactivateWidgets
                    ? false
                    : sourceOverride?.is_deleted_override === true
                    ? false
                    : typeof sourceOverride?.is_active === 'boolean'
                    ? sourceOverride.is_active
                    : baseWidget.is_active !== false
            }
        })
    ])

    if (entityBindingCopyMode === 'omit' && boundInheritedWidgets.size > 0) {
        const copiedOverridesByWidgetId = new Map(overridesToCopy.map((override) => [override.baseWidgetId, override]))
        for (const baseWidget of baseWidgets) {
            if (!boundInheritedWidgets.has(baseWidget.id)) continue
            copiedOverridesByWidgetId.set(baseWidget.id, {
                baseWidgetId: baseWidget.id,
                zone: null,
                sortOrder: null,
                config: null,
                isActive: null,
                isDeletedOverride: true
            })
        }
        overridesToCopy = [...copiedOverridesByWidgetId.values()]
    }

    return overridesToCopy
}

export const insertCopiedOverrides = async ({
    trx,
    overridesQt,
    layoutId,
    userId,
    now,
    overrides
}: {
    trx: SqlQueryable
    overridesQt: string
    layoutId: unknown
    userId: string | null
    now: Date
    overrides: PreparedOverrideCopy[]
}): Promise<void> => {
    if (overrides.length === 0) return

    const placeholders: string[] = []
    const params: unknown[] = []
    let idx = 1
    for (const override of overrides) {
        placeholders.push(
            `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7}, $${idx + 8}, $${
                idx + 7
            }, $${idx + 8}, $${idx + 9}, $${idx + 10}, $${idx + 10}, $${idx + 10}, $${idx + 11}, $${idx + 10}, $${idx + 10})`
        )
        params.push(
            layoutId,
            override.baseWidgetId,
            override.zone,
            override.sortOrder,
            override.config ? JSON.stringify(override.config) : null,
            override.isActive,
            override.isDeletedOverride,
            now,
            userId ?? null,
            1,
            false,
            true
        )
        idx += 12
    }

    const insertedRows = await trx.query<{ id: string }>(
        `INSERT INTO ${overridesQt} (
            layout_id, base_widget_id, zone, sort_order, config, is_active, is_deleted_override,
            _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by, _upl_version,
            _upl_archived, _upl_deleted, _upl_locked,
            _mhb_published, _mhb_archived, _mhb_deleted
        ) VALUES ${placeholders.join(', ')}
        RETURNING id`,
        params
    )
    if (insertedRows.length !== overrides.length) {
        throw new MetahubDomainError({
            message: 'Failed to create copied layout overrides',
            statusCode: 500,
            code: 'SCHEMA_SYNC_FAILED',
            details: { operation: 'copy-layout' }
        })
    }
}
