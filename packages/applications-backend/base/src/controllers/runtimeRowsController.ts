import type { Request, Response } from 'express'
import { z } from 'zod'
import type { DbExecutor } from '@universo/utils'
import {
  normalizeCatalogRuntimeViewConfig,
  resolveCatalogRuntimeDashboardLayoutConfig,
  resolveApplicationLifecycleContractFromConfig
} from '@universo/utils'
import { generateChildTableName } from '@universo/schema-ddl'
import {
  getCatalogWorkspaceLimit,
  getCatalogWorkspaceUsage,
  enforceCatalogWorkspaceLimit
} from '../services/applicationWorkspaces'
import { getRequestDbExecutor } from '../utils'
import {
  UpdateFailure,
  IDENTIFIER_REGEX,
  UUID_REGEX,
  quoteIdentifier,
  normalizeLocale,
  runtimeCodenameTextSql,
  resolveRuntimeCodenameText,
  resolvePresentationName,
  resolveLocalizedContent,
  formatRuntimeFieldLabel,
  formatRuntimeFieldPath,
  getRuntimeInputValue,
  pgNumericToNumber,
  resolveRuntimeValue,
  isSoftDeleteLifecycle,
  buildRuntimeActiveRowCondition,
  buildRuntimeSoftDeleteSetClause,
  RUNTIME_WRITABLE_TYPES,
  coerceRuntimeValue,
  parseRowLimit,
  getTableRowLimits,
  getTableRowCountError,
  getEnumPresentationMode,
  getDefaultEnumValueId,
  getSetConstantConfig,
  resolveSetConstantLabel,
  resolveRefId,
  ensureEnumerationValueBelongsToTarget,
  createQueryHelper,
  resolveRuntimeSchema,
  ensureRuntimePermission,
  type RuntimeDataType,
  type RuntimeRefOption,
  type SetConstantUiConfig
} from '../shared/runtimeHelpers'

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const runtimeQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(10000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  locale: z.string().optional(),
  catalogId: z.string().uuid().optional()
})

const runtimeUpdateBodySchema = z.object({
  field: z.string().min(1),
  value: z.unknown(),
  catalogId: z.string().uuid().optional(),
  expectedVersion: z.number().int().positive().optional()
})

const runtimeBulkUpdateBodySchema = z.object({
  catalogId: z.string().uuid().optional(),
  data: z.record(z.unknown()),
  expectedVersion: z.number().int().positive().optional()
})

const runtimeCreateBodySchema = z.object({
  catalogId: z.string().uuid().optional(),
  data: z.record(z.unknown())
})

const runtimeCopyBodySchema = z.object({
  catalogId: z.string().uuid().optional(),
  copyChildTables: z.boolean().optional()
})

const runtimeReorderBodySchema = z.object({
  catalogId: z.string().uuid().optional(),
  orderedRowIds: z.array(z.string().uuid()).min(1).max(1000)
})

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve catalog and load its attributes from a runtime schema.
 */
const resolveRuntimeCatalog = async (
  manager: DbExecutor,
  schemaIdent: string,
  requestedCatalogId?: string
) => {
  const catalogs = (await manager.query(
    `
      SELECT id, codename, table_name, config
      FROM ${schemaIdent}._app_objects
      WHERE kind = 'catalog'
        AND _upl_deleted = false
        AND _app_deleted = false
      ORDER BY ${runtimeCodenameTextSql('codename')} ASC, id ASC
    `
  )) as Array<{
    id: string
    codename: unknown
    table_name: string
    config?: Record<string, unknown> | null
  }>

  if (catalogs.length === 0)
    return { catalog: null, attrs: [], error: 'No catalogs available' } as const

  const selectedCatalog =
    (requestedCatalogId
      ? catalogs.find((c) => c.id === requestedCatalogId)
      : undefined) ?? catalogs[0]
  const catalog = selectedCatalog
    ? {
        ...selectedCatalog,
        lifecycleContract: resolveApplicationLifecycleContractFromConfig(selectedCatalog.config)
      }
    : null
  if (!catalog) return { catalog: null, attrs: [], error: 'Catalog not found' } as const
  if (!IDENTIFIER_REGEX.test(catalog.table_name))
    return { catalog: null, attrs: [], error: 'Invalid table name' } as const

  const attrs = (await manager.query(
    `
      SELECT id, codename, column_name, data_type, is_required, validation_rules
             , target_object_id, target_object_kind, ui_config
      FROM ${schemaIdent}._app_attributes
      WHERE object_id = $1
        AND parent_attribute_id IS NULL
        AND _upl_deleted = false
        AND _app_deleted = false
    `,
    [catalog.id]
  )) as Array<{
    id: string
    codename: unknown
    column_name: string
    data_type: string
    is_required: boolean
    validation_rules?: Record<string, unknown>
    target_object_id?: string | null
    target_object_kind?: string | null
    ui_config?: Record<string, unknown>
  }>

  return { catalog, attrs, error: null } as const
}

const resolveRuntimeReorderField = (
  attrs: Array<{ codename: unknown; column_name: string; data_type: string }>,
  reorderPersistenceField: string | null
) => {
  if (!reorderPersistenceField) return null

  const target = reorderPersistenceField.trim().toLowerCase()
  if (!target) return null

  return (
    attrs.find(
      (attr) =>
        attr.data_type === 'NUMBER' &&
        IDENTIFIER_REGEX.test(attr.column_name) &&
        (attr.column_name.toLowerCase() === target || String(attr.codename ?? '').trim().toLowerCase() === target)
    ) ?? null
  )
}

const buildRuntimeRowsOrderBy = (reorderColumnName: string | null) => {
  if (!reorderColumnName || !IDENTIFIER_REGEX.test(reorderColumnName)) {
    return '_upl_created_at ASC NULLS LAST, id ASC'
  }

  return `${quoteIdentifier(reorderColumnName)} ASC NULLS LAST, _upl_created_at ASC NULLS LAST, id ASC`
}

const getNextRuntimeSortValue = async (params: {
  manager: DbExecutor
  dataTableIdent: string
  runtimeRowCondition: string
  reorderColumnName: string
}) => {
  const { manager, dataTableIdent, runtimeRowCondition, reorderColumnName } = params
  const [row] = (await manager.query(
    `
      SELECT COALESCE(MAX(${quoteIdentifier(reorderColumnName)}), -1) AS value
      FROM ${dataTableIdent}
      WHERE ${runtimeRowCondition}
    `
  )) as Array<{ value: unknown }>

  const maxValue = pgNumericToNumber(row?.value)
  return typeof maxValue === 'number' && Number.isFinite(maxValue) ? maxValue + 1 : 0
}

// ---------------------------------------------------------------------------
// Controller factory
// ---------------------------------------------------------------------------

export function createRuntimeRowsController(getDbExecutor: () => DbExecutor) {
  const query = createQueryHelper(getDbExecutor)

  // ============ GET RUNTIME TABLE ============
  const getRuntime = async (req: Request, res: Response) => {
    const { applicationId } = req.params

    const parsedQuery = runtimeQuerySchema.safeParse(req.query)
    if (!parsedQuery.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsedQuery.error.flatten() })
    }

    const { limit, offset, locale } = parsedQuery.data
    const requestedLocale = normalizeLocale(locale)
    const requestedCatalogId = parsedQuery.data.catalogId ?? null
    const runtimeContext = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
    if (!runtimeContext) return

    const { schemaName, schemaIdent } = runtimeContext
    const manager = runtimeContext.manager
    const currentWorkspaceId = runtimeContext.currentWorkspaceId

    const catalogs = await manager.query(
      `
        SELECT id, codename, table_name, presentation, config
        FROM ${schemaIdent}._app_objects
        WHERE kind = 'catalog'
          AND _upl_deleted = false
          AND _app_deleted = false
        ORDER BY ${runtimeCodenameTextSql('codename')} ASC, id ASC
      `
    )

    if (catalogs.length === 0) {
      return res
        .status(404)
        .json({ error: 'No catalogs available in application runtime schema' })
    }

    const typedCatalogs = catalogs as Array<{
      id: string
      codename: unknown
      table_name: string
      presentation?: unknown
      config?: Record<string, unknown> | null
    }>

    const runtimeCatalogs = typedCatalogs.map((catalogRow) => ({
      ...catalogRow,
      lifecycleContract: resolveApplicationLifecycleContractFromConfig(catalogRow.config)
    }))

    let preferredCatalogIdFromMenu: string | null = null
    if (!requestedCatalogId) {
      try {
        const [{ layoutsExists, widgetsExists }] = (await manager.query(
          `
            SELECT
              EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = $1 AND table_name = '_app_layouts'
              ) AS "layoutsExists",
              EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = $1 AND table_name = '_app_widgets'
              ) AS "widgetsExists"
          `,
          [schemaName]
        )) as Array<{ layoutsExists: boolean; widgetsExists: boolean }>

        if (layoutsExists && widgetsExists) {
          const defaultLayoutRows = (await manager.query(
            `
              SELECT id
              FROM ${schemaIdent}._app_layouts
              WHERE (is_default = true OR is_active = true)
                AND _upl_deleted = false
                AND _app_deleted = false
              ORDER BY is_default DESC, sort_order ASC, _upl_created_at ASC
              LIMIT 1
            `
          )) as Array<{ id: string }>
          const activeLayoutId = defaultLayoutRows[0]?.id

          if (activeLayoutId) {
            const menuWidgets = (await manager.query(
              `
                SELECT config
                FROM ${schemaIdent}._app_widgets
                WHERE layout_id = $1
                  AND zone = 'left'
                  AND widget_key = 'menuWidget'
                  AND _upl_deleted = false
                  AND _app_deleted = false
                ORDER BY sort_order ASC, _upl_created_at ASC
              `,
              [activeLayoutId]
            )) as Array<{ config?: unknown }>

            const boundMenuConfig = menuWidgets
              .map((row) =>
                row.config && typeof row.config === 'object'
                  ? (row.config as Record<string, unknown>)
                  : null
              )
              .find(
                (cfg) => Boolean(cfg?.bindToHub) && typeof cfg?.boundHubId === 'string'
              )

            const boundHubId =
              typeof boundMenuConfig?.boundHubId === 'string'
                ? boundMenuConfig.boundHubId
                : null
            if (boundHubId) {
              const preferredCatalogRows = (await manager.query(
                `
                  SELECT id
                  FROM ${schemaIdent}._app_objects
                  WHERE kind = 'catalog'
                    AND _upl_deleted = false
                    AND _app_deleted = false
                    AND config->'hubs' @> $1::jsonb
                  ORDER BY COALESCE((config->>'sortOrder')::int, 0) ASC, codename ASC
                  LIMIT 1
                `,
                [JSON.stringify([boundHubId])]
              )) as Array<{ id: string }>
              preferredCatalogIdFromMenu = preferredCatalogRows[0]?.id ?? null
            }
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(
          '[ApplicationsRuntime] Failed to resolve preferred startup catalog from menu binding (ignored)',
          e
        )
      }
    }

    const activeCatalog =
      (requestedCatalogId
        ? runtimeCatalogs.find((catalogRow) => catalogRow.id === requestedCatalogId)
        : undefined) ??
      (preferredCatalogIdFromMenu
        ? runtimeCatalogs.find(
            (catalogRow) => catalogRow.id === preferredCatalogIdFromMenu
          )
        : undefined) ??
      runtimeCatalogs[0]
    if (!activeCatalog) {
      return res.status(404).json({
        error: 'Requested catalog not found in runtime schema',
        details: { catalogId: requestedCatalogId }
      })
    }

    if (!IDENTIFIER_REGEX.test(activeCatalog.table_name)) {
      return res.status(400).json({ error: 'Invalid runtime table name' })
    }

    const attributes = (await manager.query(
      `
        SELECT id, codename, column_name, data_type, is_required, is_display_attribute,
               presentation, validation_rules, sort_order, ui_config,
               target_object_id, target_object_kind
        FROM ${schemaIdent}._app_attributes
        WHERE object_id = $1
          AND data_type IN ('BOOLEAN', 'STRING', 'NUMBER', 'DATE', 'REF', 'JSON', 'TABLE')
          AND parent_attribute_id IS NULL
          AND _upl_deleted = false
          AND _app_deleted = false
        ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST, codename ASC
      `,
      [activeCatalog.id]
    )) as Array<{
      id: string
      codename: string
      column_name: string
      data_type: RuntimeDataType
      is_required: boolean
      is_display_attribute?: boolean
      presentation?: unknown
      validation_rules?: Record<string, unknown>
      sort_order?: number
      ui_config?: Record<string, unknown>
      target_object_id?: string | null
      target_object_kind?: string | null
    }>

    const safeAttributes = attributes.filter((attr) =>
      IDENTIFIER_REGEX.test(attr.column_name)
    )

    // Separate physical (non-TABLE) attributes from virtual TABLE attributes
    const physicalAttributes = safeAttributes.filter((a) => a.data_type !== 'TABLE')

    // Fetch child attributes for TABLE-type attributes
    const tableAttrs = safeAttributes.filter((a) => a.data_type === 'TABLE')
    const childAttrsByTableId = new Map<string, typeof attributes>()
    if (tableAttrs.length > 0) {
      const tableAttrIds = tableAttrs.map((a) => a.id)
      const childAttrs = (await manager.query(
        `
          SELECT id, codename, column_name, data_type, is_required, is_display_attribute,
                 presentation, validation_rules, sort_order, ui_config,
                 target_object_id, target_object_kind, parent_attribute_id
          FROM ${schemaIdent}._app_attributes
          WHERE parent_attribute_id = ANY($1::uuid[])
            AND _upl_deleted = false
            AND _app_deleted = false
          ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST, codename ASC
        `,
        [tableAttrIds]
      )) as Array<(typeof attributes)[number] & { parent_attribute_id: string }>

      for (const child of childAttrs) {
        const list = childAttrsByTableId.get(child.parent_attribute_id) ?? []
        list.push(child)
        childAttrsByTableId.set(child.parent_attribute_id, list)
      }
    }

    // Collect all child attributes (across all TABLE attributes) for REF target resolution
    const allChildAttributes = Array.from(childAttrsByTableId.values()).flat()

    const enumTargetObjectIds = Array.from(
      new Set([
        ...safeAttributes
          .filter(
            (attr) =>
              attr.data_type === 'REF' &&
              attr.target_object_kind === 'enumeration' &&
              attr.target_object_id
          )
          .map((attr) => String(attr.target_object_id)),
        ...allChildAttributes
          .filter(
            (attr) =>
              attr.data_type === 'REF' &&
              attr.target_object_kind === 'enumeration' &&
              attr.target_object_id
          )
          .map((attr) => String(attr.target_object_id))
      ])
    )

    const enumOptionsMap = new Map<
      string,
      Array<{
        id: string
        label: string
        codename: string
        isDefault: boolean
        sortOrder: number
      }>
    >()
    if (enumTargetObjectIds.length > 0) {
      const enumRows = (await manager.query(
        `
          SELECT id, object_id, codename, presentation, sort_order, is_default
          FROM ${schemaIdent}._app_values
          WHERE object_id = ANY($1::uuid[])
            AND _upl_deleted = false
            AND _app_deleted = false
          ORDER BY object_id ASC, sort_order ASC, codename ASC
        `,
        [enumTargetObjectIds]
      )) as Array<{
        id: string
        object_id: string
        codename: string
        presentation?: unknown
        sort_order?: number
        is_default?: boolean
      }>

      for (const row of enumRows) {
        const list = enumOptionsMap.get(row.object_id) ?? []
        list.push({
          id: row.id,
          codename: row.codename,
          label: resolvePresentationName(
            row.presentation,
            requestedLocale,
            resolveRuntimeCodenameText(row.codename)
          ),
          isDefault: row.is_default === true,
          sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0
        })
        enumOptionsMap.set(row.object_id, list)
      }
    }

    const catalogTargetObjectIds = Array.from(
      new Set([
        ...safeAttributes
          .filter(
            (attr) =>
              attr.data_type === 'REF' &&
              attr.target_object_kind === 'catalog' &&
              attr.target_object_id
          )
          .map((attr) => String(attr.target_object_id)),
        ...allChildAttributes
          .filter(
            (attr) =>
              attr.data_type === 'REF' &&
              attr.target_object_kind === 'catalog' &&
              attr.target_object_id
          )
          .map((attr) => String(attr.target_object_id))
      ])
    )

    const catalogRefOptionsMap = new Map<string, RuntimeRefOption[]>()
    if (catalogTargetObjectIds.length > 0) {
      const targetCatalogs = (await manager.query(
        `
          SELECT id, codename, table_name, config
          FROM ${schemaIdent}._app_objects
          WHERE id = ANY($1::uuid[])
            AND kind = 'catalog'
            AND _upl_deleted = false
            AND _app_deleted = false
        `,
        [catalogTargetObjectIds]
      )) as Array<{
        id: string
        codename: unknown
        table_name: string
        config?: Record<string, unknown> | null
      }>

      const targetCatalogAttrs = (await manager.query(
        `
          SELECT object_id, column_name, codename, data_type, is_display_attribute, sort_order
          FROM ${schemaIdent}._app_attributes
          WHERE object_id = ANY($1::uuid[])
            AND parent_attribute_id IS NULL
            AND _upl_deleted = false
            AND _app_deleted = false
          ORDER BY object_id ASC, is_display_attribute DESC, sort_order ASC, codename ASC
        `,
        [catalogTargetObjectIds]
      )) as Array<{
        object_id: string
        column_name: string
        codename: unknown
        data_type: RuntimeDataType
        is_display_attribute: boolean
        sort_order?: number
      }>

      const attrsByCatalogId = new Map<string, typeof targetCatalogAttrs>()
      for (const row of targetCatalogAttrs) {
        const list = attrsByCatalogId.get(row.object_id) ?? []
        list.push(row)
        attrsByCatalogId.set(row.object_id, list)
      }

      for (const targetCatalog of targetCatalogs) {
        if (!IDENTIFIER_REGEX.test(targetCatalog.table_name)) {
          continue
        }

        const targetCatalogActiveRowCondition = buildRuntimeActiveRowCondition(
          resolveApplicationLifecycleContractFromConfig(targetCatalog.config),
          targetCatalog.config,
          undefined,
          currentWorkspaceId
        )

        const targetAttrs = attrsByCatalogId.get(targetCatalog.id) ?? []
        const preferredDisplayAttr =
          targetAttrs.find((attr) => attr.is_display_attribute) ??
          targetAttrs.find((attr) => attr.data_type === 'STRING') ??
          targetAttrs[0]

        const selectLabelSql =
          preferredDisplayAttr &&
          IDENTIFIER_REGEX.test(preferredDisplayAttr.column_name)
            ? `${quoteIdentifier(preferredDisplayAttr.column_name)} AS label_value`
            : 'NULL AS label_value'

        const targetRows = (await manager.query(
          `
            SELECT id, ${selectLabelSql}
            FROM ${schemaIdent}.${quoteIdentifier(targetCatalog.table_name)}
            WHERE ${targetCatalogActiveRowCondition}
            ORDER BY _upl_created_at ASC NULLS LAST, id ASC
            LIMIT 1000
          `
        )) as Array<{
          id: string
          label_value?: unknown
        }>

        const options: RuntimeRefOption[] = targetRows.map((row, index) => {
          const rawLabel = row.label_value
          const localizedLabel =
            preferredDisplayAttr?.data_type === 'STRING'
              ? resolveRuntimeValue(rawLabel, 'STRING', requestedLocale)
              : rawLabel
          const label =
            typeof localizedLabel === 'string' && localizedLabel.trim().length > 0
              ? localizedLabel
              : String(row.id)

          return {
            id: row.id,
            label,
            codename: targetCatalog.codename,
            isDefault: false,
            sortOrder: index
          }
        })

        catalogRefOptionsMap.set(targetCatalog.id, options)
      }
    }

    const dataTableIdent = `${schemaIdent}.${quoteIdentifier(activeCatalog.table_name)}`
    const activeCatalogRowCondition = buildRuntimeActiveRowCondition(
      activeCatalog.lifecycleContract,
      activeCatalog.config,
      undefined,
      currentWorkspaceId
    )
    // Use physicalAttributes for SQL — TABLE attrs have no physical column in parent table
    const selectColumns = [
      'id',
      ...physicalAttributes.map((attr) => quoteIdentifier(attr.column_name))
    ]

    // Add correlated subqueries for TABLE attributes to include child row counts
    for (const tAttr of tableAttrs) {
      const fallbackTabTableName = generateChildTableName(tAttr.id)
      const tabTableName =
        typeof tAttr.column_name === 'string' &&
        IDENTIFIER_REGEX.test(tAttr.column_name)
          ? tAttr.column_name
          : fallbackTabTableName
      if (!IDENTIFIER_REGEX.test(tabTableName)) continue
      const tabTableIdent = `${schemaIdent}.${quoteIdentifier(tabTableName)}`
      selectColumns.push(
        `(SELECT COUNT(*)::int FROM ${tabTableIdent} WHERE _tp_parent_id = ${dataTableIdent}.id AND ${activeCatalogRowCondition}) AS ${quoteIdentifier(
          tAttr.column_name
        )}`
      )
    }

    const activeCatalogRuntimeConfig = normalizeCatalogRuntimeViewConfig(
      (activeCatalog.config?.runtimeConfig ?? undefined) as Record<string, unknown> | undefined
    )
    const reorderFieldAttr = resolveRuntimeReorderField(
      safeAttributes,
      activeCatalogRuntimeConfig.enableRowReordering
        ? activeCatalogRuntimeConfig.reorderPersistenceField
        : null
    )

    const [{ total }] = (await manager.query(
      `
        SELECT COUNT(*)::int AS total
        FROM ${dataTableIdent}
        WHERE ${activeCatalogRowCondition}
      `
    )) as Array<{ total: number }>

    const rawRows = (await manager.query(
      `
        SELECT ${selectColumns.join(', ')}
        FROM ${dataTableIdent}
        WHERE ${activeCatalogRowCondition}
        ORDER BY ${buildRuntimeRowsOrderBy(reorderFieldAttr?.column_name ?? null)}
        LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    )) as Array<Record<string, unknown>>

    const canPersistRowReordering =
      activeCatalogRuntimeConfig.enableRowReordering &&
      Boolean(reorderFieldAttr) &&
      offset === 0 &&
      total <= limit

    const rows = rawRows.map((row) => {
      const mappedRow: Record<string, unknown> & { id: string } = {
        id: String(row.id)
      }

      for (const attribute of safeAttributes) {
        // TABLE attributes contain child row counts from subqueries
        if (attribute.data_type === 'TABLE') {
          mappedRow[attribute.column_name] =
            typeof row[attribute.column_name] === 'number'
              ? row[attribute.column_name]
              : 0
          continue
        }
        mappedRow[attribute.column_name] = resolveRuntimeValue(
          row[attribute.column_name],
          attribute.data_type,
          requestedLocale
        )
      }

      return mappedRow
    })

    let workspaceLimit:
      | { maxRows: number | null; currentRows: number; canCreate: boolean }
      | undefined
    if (runtimeContext.workspacesEnabled && currentWorkspaceId) {
      const maxRows = await getCatalogWorkspaceLimit(manager, {
        schemaName,
        objectId: activeCatalog.id
      })
      const currentRows = await getCatalogWorkspaceUsage(manager, {
        schemaName,
        tableName: activeCatalog.table_name,
        workspaceId: currentWorkspaceId,
        runtimeRowCondition: activeCatalogRowCondition
      })
      workspaceLimit = {
        maxRows,
        currentRows,
        canCreate: maxRows === null ? true : currentRows < maxRows
      }
    }

    // Optional layout config for runtime UI (Dashboard sections show/hide).
    let layoutConfig: Record<string, unknown> = {}
    try {
      const [{ layoutsExists }] = (await manager.query(
        `
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = $1 AND table_name = '_app_layouts'
          ) AS "layoutsExists"
        `,
        [schemaName]
      )) as Array<{ layoutsExists: boolean }>

      if (layoutsExists) {
        const layoutRows = (await manager.query(
          `
            SELECT config
            FROM ${schemaIdent}._app_layouts
            WHERE (is_default = true OR is_active = true)
              AND _upl_deleted = false
              AND _app_deleted = false
            ORDER BY is_default DESC, sort_order ASC, _upl_created_at ASC
            LIMIT 1
          `
        )) as Array<{ config: Record<string, unknown> | null }>

        layoutConfig = layoutRows?.[0]?.config ?? {}
      } else {
        // Backward compatibility for old schemas.
        const [{ settingsExists }] = (await manager.query(
          `
            SELECT EXISTS (
              SELECT 1
              FROM information_schema.tables
              WHERE table_schema = $1 AND table_name = '_app_settings'
            ) AS "settingsExists"
          `,
          [schemaName]
        )) as Array<{ settingsExists: boolean }>

        if (!settingsExists) {
          layoutConfig = {}
        } else {
          const uiRows = (await manager.query(
            `
              SELECT value
              FROM ${schemaIdent}._app_settings
              WHERE key = 'layout'
                AND _upl_deleted = false
                AND _app_deleted = false
              LIMIT 1
            `
          )) as Array<{ value: Record<string, unknown> | null }>
          layoutConfig = uiRows?.[0]?.value ?? {}
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        '[ApplicationsRuntime] Failed to load layout config (ignored)',
        e
      )
    }

    layoutConfig = resolveCatalogRuntimeDashboardLayoutConfig({
      layoutConfig,
      catalogRuntimeConfig: activeCatalogRuntimeConfig
    })
    layoutConfig = {
      ...layoutConfig,
      enableRowReordering: canPersistRowReordering
    }

    const catalogsForRuntime = runtimeCatalogs.map((catalogRow) => ({
      id: catalogRow.id,
      codename: catalogRow.codename,
      tableName: catalogRow.table_name,
      runtimeConfig: normalizeCatalogRuntimeViewConfig(
        (catalogRow.config?.runtimeConfig ?? undefined) as Record<string, unknown> | undefined
      ),
      name: resolvePresentationName(
        catalogRow.presentation,
        requestedLocale,
        resolveRuntimeCodenameText(catalogRow.codename)
      )
    }))

    // Zone widgets for runtime UI (sidebar + center composition).
    type ZoneWidgetItem = {
      id: string
      widgetKey: string
      sortOrder: number
      config: Record<string, unknown>
    }
    let zoneWidgets: {
      left: ZoneWidgetItem[]
      right: ZoneWidgetItem[]
      center: ZoneWidgetItem[]
    } = { left: [], right: [], center: [] }

    try {
      const [{ zoneWidgetsExists }] = (await manager.query(
        `
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = $1 AND table_name = '_app_widgets'
          ) AS "zoneWidgetsExists"
        `,
        [schemaName]
      )) as Array<{ zoneWidgetsExists: boolean }>

      if (zoneWidgetsExists) {
        const defaultLayoutRows = (await manager.query(
          `
            SELECT id
            FROM ${schemaIdent}._app_layouts
            WHERE (is_default = true OR is_active = true)
              AND _upl_deleted = false
              AND _app_deleted = false
            ORDER BY is_default DESC, sort_order ASC, _upl_created_at ASC
            LIMIT 1
          `
        )) as Array<{ id: string }>
        const activeLayoutId = defaultLayoutRows[0]?.id

        if (activeLayoutId) {
          const widgetRows = (await manager.query(
            `
              SELECT id, widget_key, sort_order, config, zone
              FROM ${schemaIdent}._app_widgets
              WHERE layout_id = $1
                AND zone IN ('left', 'right', 'center')
                AND _upl_deleted = false
                AND _app_deleted = false
              ORDER BY sort_order ASC, _upl_created_at ASC
            `,
            [activeLayoutId]
          )) as Array<{
            id: string
            widget_key: string
            sort_order: number
            config: Record<string, unknown> | null
            zone: string
          }>

          for (const row of widgetRows) {
            const mapped = {
              id: row.id,
              widgetKey: row.widget_key,
              sortOrder:
                typeof row.sort_order === 'number' ? row.sort_order : 0,
              config:
                row.config && typeof row.config === 'object' ? row.config : {}
            }
            if (row.zone === 'right') {
              zoneWidgets.right.push(mapped)
            } else if (row.zone === 'center') {
              zoneWidgets.center.push(mapped)
            } else {
              zoneWidgets.left.push(mapped)
            }
          }
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        '[ApplicationsRuntime] Failed to load zone widgets (ignored)',
        e
      )
    }

    // Build menus from menuWidget config stored in zone widgets.
    type RuntimeMenuItem = {
      id: string
      kind: string
      title: string
      icon: string | null
      href: string | null
      catalogId: string | null
      hubId: string | null
      sortOrder: number
      isActive: boolean
    }

    type RuntimeMenuEntry = {
      id: string
      widgetId: string
      showTitle: boolean
      title: string
      autoShowAllCatalogs: boolean
      items: RuntimeMenuItem[]
    }

    type RuntimeHubMeta = {
      id: string
      codename: unknown
      title: string
      parentHubId: string | null
      sortOrder: number
    }

    type RuntimeCatalogMeta = {
      id: string
      codename: unknown
      title: string
      sortOrder: number
      hubIds: string[]
    }

    let hubMetaById = new Map<string, RuntimeHubMeta>()
    let childHubIdsByParent = new Map<string, string[]>()
    let catalogsByHub = new Map<string, RuntimeCatalogMeta[]>()

    try {
      const objectRows = (await manager.query(
        `
          SELECT id, kind, codename, presentation, config
          FROM ${schemaIdent}._app_objects
          WHERE kind IN ('hub', 'catalog')
            AND _upl_deleted = false
            AND _app_deleted = false
        `
      )) as Array<{
        id: string
        kind: 'hub' | 'catalog'
        codename: unknown
        presentation?: unknown
        config?: unknown
      }>

      for (const row of objectRows) {
        const config =
          row.config && typeof row.config === 'object'
            ? (row.config as Record<string, unknown>)
            : {}
        const rawSortOrder = config.sortOrder
        const sortOrder =
          typeof rawSortOrder === 'number' ? rawSortOrder : 0
        const title = resolvePresentationName(
          row.presentation,
          requestedLocale,
          resolveRuntimeCodenameText(row.codename)
        )

        if (row.kind === 'hub') {
          const parentHubId =
            typeof config.parentHubId === 'string'
              ? config.parentHubId
              : null
          hubMetaById.set(row.id, {
            id: row.id,
            codename: row.codename,
            title,
            parentHubId,
            sortOrder
          })
          continue
        }

        const hubIds = Array.isArray(config.hubs)
          ? config.hubs.filter(
              (value): value is string => typeof value === 'string'
            )
          : []
        const catalogMeta: RuntimeCatalogMeta = {
          id: row.id,
          codename: row.codename,
          title,
          sortOrder,
          hubIds
        }
        for (const hubId of hubIds) {
          const list = catalogsByHub.get(hubId) ?? []
          list.push(catalogMeta)
          catalogsByHub.set(hubId, list)
        }
      }

      const hubSortComparator = (a: RuntimeHubMeta, b: RuntimeHubMeta) => {
        if (a.sortOrder !== b.sortOrder)
          return a.sortOrder - b.sortOrder
        return resolveRuntimeCodenameText(a.codename).localeCompare(
          resolveRuntimeCodenameText(b.codename)
        )
      }
      const catalogSortComparator = (
        a: RuntimeCatalogMeta,
        b: RuntimeCatalogMeta
      ) => {
        if (a.sortOrder !== b.sortOrder)
          return a.sortOrder - b.sortOrder
        return resolveRuntimeCodenameText(a.codename).localeCompare(
          resolveRuntimeCodenameText(b.codename)
        )
      }

      const hubs = Array.from(hubMetaById.values()).sort(hubSortComparator)
      childHubIdsByParent = new Map<string, string[]>()
      for (const hub of hubs) {
        if (!hub.parentHubId) continue
        const childIds = childHubIdsByParent.get(hub.parentHubId) ?? []
        childIds.push(hub.id)
        childHubIdsByParent.set(hub.parentHubId, childIds)
      }

      for (const [hubId, hubCatalogs] of catalogsByHub.entries()) {
        catalogsByHub.set(
          hubId,
          [...hubCatalogs].sort(catalogSortComparator)
        )
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        '[ApplicationsRuntime] Failed to build hub/catalog runtime map for menuWidget (ignored)',
        e
      )
      hubMetaById = new Map()
      childHubIdsByParent = new Map()
      catalogsByHub = new Map()
    }

    const normalizeMenuItem = (
      item: unknown
    ): RuntimeMenuItem | null => {
      if (!item || typeof item !== 'object') return null
      const typed = item as Record<string, unknown>
      if (typed.isActive === false) return null

      const kind =
        typeof typed.kind === 'string' && typed.kind.trim().length > 0
          ? typed.kind
          : 'link'
      return {
        id: String(typed.id ?? ''),
        kind,
        title: resolveLocalizedContent(typed.title, requestedLocale, kind),
        icon: typeof typed.icon === 'string' ? typed.icon : null,
        href: typeof typed.href === 'string' ? typed.href : null,
        catalogId:
          typeof typed.catalogId === 'string' ? typed.catalogId : null,
        hubId: typeof typed.hubId === 'string' ? typed.hubId : null,
        sortOrder:
          typeof typed.sortOrder === 'number' ? typed.sortOrder : 0,
        isActive: true
      }
    }

    const buildHubMenuItems = (
      baseItem: RuntimeMenuItem
    ): RuntimeMenuItem[] => {
      if (!baseItem.hubId) return []
      if (!hubMetaById.has(baseItem.hubId)) return []

      const items: RuntimeMenuItem[] = []
      const visited = new Set<string>()
      const hubSortComparator = (aId: string, bId: string) => {
        const a = hubMetaById.get(aId)
        const b = hubMetaById.get(bId)
        if (!a || !b) return aId.localeCompare(bId)
        if (a.sortOrder !== b.sortOrder)
          return a.sortOrder - b.sortOrder
        return resolveRuntimeCodenameText(a.codename).localeCompare(
          resolveRuntimeCodenameText(b.codename)
        )
      }

      const walkHub = (hubId: string, depth: number) => {
        if (visited.has(hubId)) return
        visited.add(hubId)

        const hubMeta = hubMetaById.get(hubId)
        if (!hubMeta) return
        const indent =
          depth > 0 ? `${'\u00A0\u00A0'.repeat(depth)}• ` : ''

        items.push({
          id: `${baseItem.id}:hub:${hubMeta.id}`,
          kind: 'hub',
          title: `${indent}${hubMeta.title}`,
          icon: baseItem.icon,
          href: null,
          catalogId: null,
          hubId: hubMeta.id,
          sortOrder: baseItem.sortOrder,
          isActive: true
        })

        const hubCatalogs = catalogsByHub.get(hubMeta.id) ?? []
        for (const catalog of hubCatalogs) {
          items.push({
            id: `${baseItem.id}:hub:${hubMeta.id}:catalog:${catalog.id}`,
            kind: 'catalog',
            title: `${'\u00A0\u00A0'.repeat(depth + 1)}${catalog.title}`,
            icon: baseItem.icon,
            href: null,
            catalogId: catalog.id,
            hubId: hubMeta.id,
            sortOrder: baseItem.sortOrder,
            isActive: true
          })
        }

        const childIds = [
          ...(childHubIdsByParent.get(hubMeta.id) ?? [])
        ].sort(hubSortComparator)
        for (const childId of childIds) {
          walkHub(childId, depth + 1)
        }
      }

      walkHub(baseItem.hubId, 0)
      return items
    }

    const buildBoundHubCatalogItems = (
      widgetId: string,
      boundHubId: string
    ): RuntimeMenuItem[] => {
      if (!hubMetaById.has(boundHubId)) return []
      const directCatalogs = catalogsByHub.get(boundHubId) ?? []
      return directCatalogs.map((catalog, index) => ({
        id: `${widgetId}:bound-hub:${boundHubId}:catalog:${catalog.id}`,
        kind: 'catalog',
        title: catalog.title,
        icon: 'database',
        href: null,
        catalogId: catalog.id,
        hubId: boundHubId,
        sortOrder: index + 1,
        isActive: true
      }))
    }

    const buildAllCatalogMenuItems = (
      widgetId: string
    ): RuntimeMenuItem[] => {
      return catalogsForRuntime.map((catalog, index) => ({
        id: `${widgetId}:all-catalogs:${catalog.id}`,
        kind: 'catalog',
        title: catalog.name,
        icon: 'database',
        href: null,
        catalogId: catalog.id,
        hubId: null,
        sortOrder: index + 1,
        isActive: true
      }))
    }

    let menus: RuntimeMenuEntry[] = []
    let activeMenuId: string | null = null

    try {
      for (const widget of zoneWidgets.left) {
        if (widget.widgetKey !== 'menuWidget') continue
        const cfg = widget.config as Record<string, unknown>
        const bindToHub = Boolean(cfg.bindToHub)
        const boundHubId =
          typeof cfg.boundHubId === 'string' ? cfg.boundHubId : null
        const autoShowAllCatalogs =
          Boolean(cfg.autoShowAllCatalogs) && !bindToHub

        let resolvedItems: RuntimeMenuItem[] = []
        if (bindToHub && boundHubId) {
          resolvedItems = buildBoundHubCatalogItems(
            widget.id,
            boundHubId
          )
        } else if (autoShowAllCatalogs) {
          resolvedItems = buildAllCatalogMenuItems(widget.id)
        } else {
          const rawItems = Array.isArray(cfg.items) ? cfg.items : []
          const normalizedItems = rawItems
            .map((item) => normalizeMenuItem(item))
            .filter(
              (item): item is RuntimeMenuItem => item !== null
            )
            .filter((item) => item.kind !== 'catalogs_all')
            .sort((a, b) => a.sortOrder - b.sortOrder)

          for (const item of normalizedItems) {
            if (item.kind === 'hub') {
              const expanded = buildHubMenuItems(item)
              if (expanded.length > 0) {
                resolvedItems.push(...expanded)
              }
              continue
            }
            resolvedItems.push(item)
          }
        }

        const menuEntry = {
          id: widget.id,
          widgetId: widget.id,
          showTitle: Boolean(cfg.showTitle),
          title: resolveLocalizedContent(
            cfg.title,
            requestedLocale,
            ''
          ),
          autoShowAllCatalogs,
          items: resolvedItems
        } satisfies RuntimeMenuEntry
        menus.push(menuEntry)
      }
      activeMenuId = menus[0]?.id ?? null
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        '[ApplicationsRuntime] Failed to build menus from widget config (ignored)',
        e
      )
    }

    type RuntimeColumnDefinition = {
      id: string
      codename: unknown
      field: string
      dataType: RuntimeDataType
      isRequired: boolean
      isDisplayAttribute: boolean
      headerName: string
      validationRules: Record<string, unknown>
      uiConfig: Record<string, unknown>
      refTargetEntityId: string | null
      refTargetEntityKind: string | null
      refTargetConstantId: string | null
      refOptions?: RuntimeRefOption[]
      enumOptions?: RuntimeRefOption[]
      childColumns?: RuntimeColumnDefinition[]
    }

    const buildSetConstantOption = (
      setConstantConfig: SetConstantUiConfig | null
    ): RuntimeRefOption[] | undefined => {
      if (!setConstantConfig) return undefined
      return [
        {
          id: setConstantConfig.id,
          label: resolveSetConstantLabel(
            setConstantConfig,
            requestedLocale
          ),
          codename: setConstantConfig.codename ?? 'setConstant',
          isDefault: true,
          sortOrder: 0
        }
      ]
    }

    const resolveRefOptions = (
      attribute: (typeof safeAttributes)[number],
      setConstantOption: RuntimeRefOption[] | undefined
    ): RuntimeRefOption[] | undefined => {
      if (
        attribute.data_type !== 'REF' ||
        typeof attribute.target_object_id !== 'string' ||
        (attribute.target_object_kind !== 'enumeration' &&
          attribute.target_object_kind !== 'catalog' &&
          attribute.target_object_kind !== 'set')
      ) {
        return undefined
      }

      if (attribute.target_object_kind === 'enumeration') {
        return enumOptionsMap.get(attribute.target_object_id) ?? []
      }
      if (attribute.target_object_kind === 'catalog') {
        return (
          catalogRefOptionsMap.get(attribute.target_object_id) ?? []
        )
      }
      return setConstantOption ?? []
    }

    const mapAttributeToColumnDefinition = (
      attribute: (typeof safeAttributes)[number],
      includeChildColumns: boolean
    ): RuntimeColumnDefinition => {
      const setConstantConfig =
        attribute.data_type === 'REF' &&
        attribute.target_object_kind === 'set'
          ? getSetConstantConfig(attribute.ui_config)
          : null
      const setConstantOption =
        buildSetConstantOption(setConstantConfig)
      const refOptions = resolveRefOptions(
        attribute,
        setConstantOption
      )
      const enumOptions =
        attribute.data_type === 'REF' &&
        attribute.target_object_kind === 'enumeration' &&
        attribute.target_object_id &&
        enumOptionsMap.has(attribute.target_object_id)
          ? enumOptionsMap.get(attribute.target_object_id)
          : undefined

      return {
        id: attribute.id,
        codename: attribute.codename,
        field: attribute.column_name,
        dataType: attribute.data_type,
        isRequired: attribute.is_required ?? false,
        isDisplayAttribute: attribute.is_display_attribute === true,
        headerName: resolvePresentationName(
          attribute.presentation,
          requestedLocale,
          resolveRuntimeCodenameText(attribute.codename)
        ),
        validationRules: attribute.validation_rules ?? {},
        uiConfig: {
          ...(attribute.ui_config ?? {}),
          ...(setConstantConfig?.dataType
            ? { setConstantDataType: setConstantConfig.dataType }
            : {})
        },
        refTargetEntityId: attribute.target_object_id ?? null,
        refTargetEntityKind: attribute.target_object_kind ?? null,
        refTargetConstantId: setConstantConfig?.id ?? null,
        refOptions,
        enumOptions,
        ...(includeChildColumns && attribute.data_type === 'TABLE'
          ? {
              childColumns: (
                childAttrsByTableId.get(attribute.id) ?? []
              ).map((child) =>
                mapAttributeToColumnDefinition(child, false)
              )
            }
          : {})
      }
    }

    return res.json({
      catalog: {
        id: activeCatalog.id,
        codename: activeCatalog.codename,
        tableName: activeCatalog.table_name,
        runtimeConfig: {
          ...activeCatalogRuntimeConfig,
          enableRowReordering: canPersistRowReordering
        },
        name: resolvePresentationName(
          activeCatalog.presentation,
          requestedLocale,
          resolveRuntimeCodenameText(activeCatalog.codename)
        )
      },
      catalogs: catalogsForRuntime,
      activeCatalogId: activeCatalog.id,
      columns: safeAttributes.map((attribute) =>
        mapAttributeToColumnDefinition(attribute, true)
      ),
      rows,
      pagination: {
        total: typeof total === 'number' ? total : Number(total) || 0,
        limit,
        offset
      },
      ...(workspaceLimit ? { workspaceLimit } : {}),
      layoutConfig,
      zoneWidgets,
      menus,
      activeMenuId
    })
  }

  // ============ UPDATE SINGLE CELL ============
  const updateCell = async (req: Request, res: Response) => {
    const { applicationId, rowId } = req.params
    if (!UUID_REGEX.test(rowId))
      return res.status(400).json({ error: 'Invalid row ID format' })

    const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
    if (!ctx) return

    const parsedBody = runtimeUpdateBodySchema.safeParse(req.body)
    if (!parsedBody.success) {
      return res
        .status(400)
        .json({ error: 'Invalid body', details: parsedBody.error.flatten() })
    }

    const {
      field,
      value,
      catalogId: requestedCatalogId,
      expectedVersion
    } = parsedBody.data
    if (!IDENTIFIER_REGEX.test(field)) {
      return res.status(400).json({ error: 'Invalid field name' })
    }

    const {
      catalog,
      attrs,
      error: catalogError
    } = await resolveRuntimeCatalog(
      ctx.manager,
      ctx.schemaIdent,
      requestedCatalogId
    )
    if (!catalog)
      return res.status(404).json({ error: catalogError })
    const runtimeRowCondition = buildRuntimeActiveRowCondition(
      catalog.lifecycleContract,
      catalog.config,
      undefined,
      ctx.currentWorkspaceId
    )

    const attr = attrs.find((a) => a.column_name === field)
    if (!attr)
      return res.status(404).json({ error: 'Attribute not found' })
    if (!RUNTIME_WRITABLE_TYPES.has(attr.data_type)) {
      return res.status(400).json({
        error: `Field type ${attr.data_type} is not editable`
      })
    }

    if (attr.data_type === 'TABLE') {
      return res.status(400).json({
        error: `Field type ${attr.data_type} must be edited via tabular endpoints`
      })
    }

    if (
      attr.data_type === 'REF' &&
      attr.target_object_kind === 'enumeration' &&
      getEnumPresentationMode(attr.ui_config) === 'label'
    ) {
      return res.status(400).json({
        error: `Field is read-only: ${attr.codename}`
      })
    }

    const setConstantConfig =
      attr.data_type === 'REF' && attr.target_object_kind === 'set'
        ? getSetConstantConfig(attr.ui_config)
        : null
    let rawValue = value
    if (setConstantConfig) {
      const providedRefId = resolveRefId(rawValue)
      if (!providedRefId) {
        rawValue = setConstantConfig.id
      } else if (providedRefId !== setConstantConfig.id) {
        return res.status(400).json({
          error: `Field is read-only: ${attr.codename}`
        })
      } else {
        rawValue = setConstantConfig.id
      }
    }

    let coerced: unknown
    try {
      coerced = coerceRuntimeValue(
        rawValue,
        attr.data_type,
        attr.validation_rules
      )
    } catch (e) {
      return res.status(400).json({ error: (e as Error).message })
    }

    if (
      attr.is_required &&
      attr.data_type !== 'BOOLEAN' &&
      coerced === null
    ) {
      return res.status(400).json({
        error: `Required field cannot be set to null: ${attr.codename}`
      })
    }

    if (
      attr.data_type === 'REF' &&
      attr.target_object_kind === 'enumeration' &&
      typeof attr.target_object_id === 'string' &&
      coerced
    ) {
      try {
        await ensureEnumerationValueBelongsToTarget(
          ctx.manager,
          ctx.schemaIdent,
          String(coerced),
          attr.target_object_id
        )
      } catch (error) {
        return res
          .status(400)
          .json({ error: (error as Error).message })
      }
    }

    const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(catalog.table_name)}`
    const versionCheckClause =
      expectedVersion !== undefined
        ? 'AND COALESCE(_upl_version, 1) = $4'
        : ''
    const updated = (await ctx.manager.query(
      `
        UPDATE ${dataTableIdent}
        SET ${quoteIdentifier(field)} = $1,
            _upl_updated_at = NOW(),
            _upl_updated_by = $2,
            _upl_version = COALESCE(_upl_version, 1) + 1
        WHERE id = $3
          AND ${runtimeRowCondition}
          AND COALESCE(_upl_locked, false) = false
          ${versionCheckClause}
        RETURNING id
      `,
      expectedVersion !== undefined
        ? [coerced, ctx.userId, rowId, expectedVersion]
        : [coerced, ctx.userId, rowId]
    )) as Array<{ id: string }>

    if (updated.length === 0) {
      const exists = (await ctx.manager.query(
        `SELECT id, _upl_locked, _upl_version FROM ${dataTableIdent} WHERE id = $1 AND ${runtimeRowCondition}`,
        [rowId]
      )) as Array<{
        id: string
        _upl_locked?: boolean
        _upl_version?: number
      }>
      if (exists.length > 0 && exists[0]._upl_locked) {
        return res.status(423).json({ error: 'Record is locked' })
      }
      if (exists.length > 0 && expectedVersion !== undefined) {
        const actualVersion = Number(exists[0]._upl_version ?? 1)
        if (actualVersion !== expectedVersion) {
          return res.status(409).json({
            error: 'Version mismatch',
            expectedVersion,
            actualVersion
          })
        }
      }
      return res.status(404).json({ error: 'Row not found' })
    }

    return res.json({ status: 'ok' })
  }

  // ============ BULK UPDATE ROW ============
  const bulkUpdateRow = async (req: Request, res: Response) => {
    const { applicationId, rowId } = req.params
    if (!UUID_REGEX.test(rowId))
      return res.status(400).json({ error: 'Invalid row ID format' })

    const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
    if (!ctx) return
    if (!ensureRuntimePermission(res, ctx, 'editContent')) return

    const parsedBody = runtimeBulkUpdateBodySchema.safeParse(req.body)
    if (!parsedBody.success) {
      return res
        .status(400)
        .json({ error: 'Invalid body', details: parsedBody.error.flatten() })
    }

    const {
      catalogId: requestedCatalogId,
      data,
      expectedVersion
    } = parsedBody.data

    const {
      catalog,
      attrs,
      error: catalogError
    } = await resolveRuntimeCatalog(
      ctx.manager,
      ctx.schemaIdent,
      requestedCatalogId
    )
    if (!catalog)
      return res.status(404).json({ error: catalogError })
    const runtimeRowCondition = buildRuntimeActiveRowCondition(
      catalog.lifecycleContract,
      catalog.config,
      undefined,
      ctx.currentWorkspaceId
    )
    const runtimeDeleteSetClause = isSoftDeleteLifecycle(
      catalog.lifecycleContract
    )
      ? buildRuntimeSoftDeleteSetClause(
          '$1',
          catalog.lifecycleContract,
          catalog.config
        )
      : null

    const setClauses: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    const safeAttrs = attrs.filter(
      (a) =>
        IDENTIFIER_REGEX.test(a.column_name) &&
        RUNTIME_WRITABLE_TYPES.has(a.data_type)
    )
    const nonTableAttrs = safeAttrs.filter(
      (a) => a.data_type !== 'TABLE'
    )
    const tableAttrsForUpdate = safeAttrs.filter(
      (a) => a.data_type === 'TABLE'
    )

    for (const attr of nonTableAttrs) {
      const attrLabel = formatRuntimeFieldLabel(attr.codename)
      const { value: raw } = getRuntimeInputValue(
        data,
        attr.column_name,
        attr.codename
      )
      if (raw === undefined) continue
      let normalizedRaw = raw

      if (
        attr.data_type === 'REF' &&
        attr.target_object_kind === 'enumeration' &&
        getEnumPresentationMode(attr.ui_config) === 'label'
      ) {
        return res.status(400).json({
          error: `Field is read-only: ${attrLabel}`
        })
      }

      const setConstantConfig =
        attr.data_type === 'REF' && attr.target_object_kind === 'set'
          ? getSetConstantConfig(attr.ui_config)
          : null
      if (setConstantConfig) {
        const providedRefId = resolveRefId(raw)
        if (!providedRefId) {
          normalizedRaw = setConstantConfig.id
        } else if (providedRefId !== setConstantConfig.id) {
          return res.status(400).json({
            error: `Field is read-only: ${attrLabel}`
          })
        } else {
          normalizedRaw = setConstantConfig.id
        }
      }

      try {
        const coerced = coerceRuntimeValue(
          normalizedRaw,
          attr.data_type,
          attr.validation_rules
        )
        if (
          attr.is_required &&
          attr.data_type !== 'BOOLEAN' &&
          coerced === null
        ) {
          return res.status(400).json({
            error: `Required field cannot be set to null: ${attrLabel}`
          })
        }

        if (
          attr.data_type === 'REF' &&
          attr.target_object_kind === 'enumeration' &&
          typeof attr.target_object_id === 'string' &&
          coerced
        ) {
          await ensureEnumerationValueBelongsToTarget(
            ctx.manager,
            ctx.schemaIdent,
            String(coerced),
            attr.target_object_id
          )
        }

        setClauses.push(
          `${quoteIdentifier(attr.column_name)} = $${paramIndex}`
        )
        values.push(coerced)
        paramIndex++
      } catch (e) {
        return res.status(400).json({
          error: `Invalid value for ${attrLabel}: ${(e as Error).message}`
        })
      }
    }

    const tableDataEntries: Array<{
      tabTableName: string
      rows: Array<Record<string, unknown>>
    }> = []

    for (const tAttr of tableAttrsForUpdate) {
      const tableFieldPath = formatRuntimeFieldPath(tAttr.codename)
      const { hasUserValue, value: raw } = getRuntimeInputValue(
        data,
        tAttr.column_name,
        tAttr.codename
      )
      if (!hasUserValue) continue
      if (
        raw !== undefined &&
        raw !== null &&
        !Array.isArray(raw)
      ) {
        return res.status(400).json({
          error: `Invalid value for ${tableFieldPath}: TABLE value must be an array`
        })
      }

      const childRows = Array.isArray(raw)
        ? (raw as Array<Record<string, unknown>>)
        : []
      const rowCountError = getTableRowCountError(
        childRows.length,
        tableFieldPath,
        getTableRowLimits(tAttr.validation_rules)
      )
      if (rowCountError) {
        return res.status(400).json({ error: rowCountError })
      }

      const fallbackTabTableName = generateChildTableName(tAttr.id)
      const tabTableName =
        typeof tAttr.column_name === 'string' &&
        IDENTIFIER_REGEX.test(tAttr.column_name)
          ? tAttr.column_name
          : fallbackTabTableName
      if (!IDENTIFIER_REGEX.test(tabTableName)) {
        return res.status(400).json({
          error: `Invalid tabular table name for ${tableFieldPath}`
        })
      }

      const childAttrsResult = (await ctx.manager.query(
        `
          SELECT id, codename, column_name, data_type, is_required, validation_rules,
                 target_object_id, target_object_kind, ui_config
          FROM ${ctx.schemaIdent}._app_attributes
          WHERE parent_attribute_id = $1
            AND _upl_deleted = false
            AND _app_deleted = false
          ORDER BY sort_order ASC
        `,
        [tAttr.id]
      )) as Array<{
        id: string
        codename: unknown
        column_name: string
        data_type: string
        is_required: boolean
        validation_rules?: Record<string, unknown>
        target_object_id?: string | null
        target_object_kind?: string | null
        ui_config?: Record<string, unknown>
      }>

      const preparedRows: Array<Record<string, unknown>> = []

      for (let rowIdx = 0; rowIdx < childRows.length; rowIdx++) {
        const rowData = childRows[rowIdx]
        if (
          !rowData ||
          typeof rowData !== 'object' ||
          Array.isArray(rowData)
        ) {
          return res.status(400).json({
            error: `Invalid row ${rowIdx + 1} for ${tableFieldPath}: row must be an object`
          })
        }

        const preparedRow: Record<string, unknown> = {}

        for (const cAttr of childAttrsResult) {
          if (!IDENTIFIER_REGEX.test(cAttr.column_name)) continue

          const childFieldPath = formatRuntimeFieldPath(
            tAttr.codename,
            cAttr.codename
          )
          const isEnumRef =
            cAttr.data_type === 'REF' &&
            cAttr.target_object_kind === 'enumeration'
          const {
            hasUserValue: hasChildUserValue,
            value: childInputValue
          } = getRuntimeInputValue(
            rowData,
            cAttr.column_name,
            cAttr.codename
          )
          let cRaw = childInputValue

          if (
            isEnumRef &&
            getEnumPresentationMode(cAttr.ui_config) === 'label' &&
            hasChildUserValue
          ) {
            return res.status(400).json({
              error: `Field is read-only: ${childFieldPath}`
            })
          }

          if (
            cRaw === undefined &&
            isEnumRef &&
            typeof cAttr.target_object_id === 'string'
          ) {
            const defaultEnumValueId = getDefaultEnumValueId(
              cAttr.ui_config
            )
            if (defaultEnumValueId) {
              try {
                await ensureEnumerationValueBelongsToTarget(
                  ctx.manager,
                  ctx.schemaIdent,
                  defaultEnumValueId,
                  cAttr.target_object_id
                )
                cRaw = defaultEnumValueId
              } catch (error) {
                if (
                  error instanceof Error &&
                  error.message ===
                    'Enumeration value does not belong to target enumeration'
                ) {
                  cRaw = undefined
                } else {
                  throw error
                }
              }
            }
          }

          const childSetConstantConfig =
            cAttr.data_type === 'REF' &&
            cAttr.target_object_kind === 'set'
              ? getSetConstantConfig(cAttr.ui_config)
              : null
          if (childSetConstantConfig) {
            const providedRefId = resolveRefId(cRaw)
            if (!providedRefId) {
              cRaw = childSetConstantConfig.id
            } else if (
              providedRefId !== childSetConstantConfig.id
            ) {
              return res.status(400).json({
                error: `Field is read-only: ${childFieldPath}`
              })
            } else {
              cRaw = childSetConstantConfig.id
            }
          }

          if (cRaw === undefined || cRaw === null) {
            if (
              cAttr.is_required &&
              cAttr.data_type !== 'BOOLEAN'
            ) {
              let defaultValue: unknown
              switch (cAttr.data_type) {
                case 'STRING':
                  defaultValue = ''
                  break
                case 'NUMBER':
                  defaultValue = 0
                  break
                default:
                  defaultValue = ''
              }
              preparedRow[cAttr.column_name] = defaultValue
            }
            continue
          }

          try {
            const cCoerced = coerceRuntimeValue(
              cRaw,
              cAttr.data_type,
              cAttr.validation_rules
            )

            if (
              isEnumRef &&
              typeof cAttr.target_object_id === 'string' &&
              cCoerced
            ) {
              await ensureEnumerationValueBelongsToTarget(
                ctx.manager,
                ctx.schemaIdent,
                String(cCoerced),
                cAttr.target_object_id
              )
            }

            preparedRow[cAttr.column_name] = cCoerced
          } catch (err) {
            return res.status(400).json({
              error: `Invalid value for ${childFieldPath}: ${
                err instanceof Error ? err.message : String(err)
              }`
            })
          }
        }

        preparedRows.push(preparedRow)
      }

      tableDataEntries.push({ tabTableName, rows: preparedRows })
    }

    if (
      setClauses.length === 0 &&
      tableDataEntries.length === 0
    ) {
      return res
        .status(400)
        .json({ error: 'No valid fields to update' })
    }

    setClauses.push('_upl_updated_at = NOW()')
    setClauses.push(`_upl_updated_by = $${paramIndex}`)
    values.push(ctx.userId)
    paramIndex++
    setClauses.push(
      `_upl_version = COALESCE(_upl_version, 1) + 1`
    )

    const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(catalog.table_name)}`
    values.push(rowId)
    const rowIdParamIndex = paramIndex
    let versionCheckClause = ''

    if (expectedVersion !== undefined) {
      values.push(expectedVersion)
      versionCheckClause = `AND COALESCE(_upl_version, 1) = $${rowIdParamIndex + 1}`
    }

    const hasTableUpdates = tableDataEntries.length > 0

    const performBulkUpdate = async (mgr: DbExecutor) => {
      const updated = (await mgr.query(
        `
          UPDATE ${dataTableIdent}
          SET ${setClauses.join(', ')}
          WHERE id = $${rowIdParamIndex}
            AND ${runtimeRowCondition}
            AND COALESCE(_upl_locked, false) = false
            ${versionCheckClause}
          RETURNING id
        `,
        values
      )) as Array<{ id: string }>

      if (updated.length === 0) {
        const exists = (await mgr.query(
          `SELECT id, _upl_locked, _upl_version FROM ${dataTableIdent} WHERE id = $1 AND ${runtimeRowCondition}`,
          [rowId]
        )) as Array<{
          id: string
          _upl_locked?: boolean
          _upl_version?: number
        }>

        if (exists.length > 0 && exists[0]._upl_locked) {
          throw new UpdateFailure(423, {
            error: 'Record is locked'
          })
        }
        if (
          exists.length > 0 &&
          expectedVersion !== undefined
        ) {
          const actualVersion = Number(
            exists[0]._upl_version ?? 1
          )
          if (actualVersion !== expectedVersion) {
            throw new UpdateFailure(409, {
              error: 'Version mismatch',
              expectedVersion,
              actualVersion
            })
          }
        }
        throw new UpdateFailure(404, {
          error: 'Row not found'
        })
      }

      // Replace child rows for each TABLE attribute using batch INSERT
      for (const { tabTableName, rows: childRows } of tableDataEntries) {
        const tabTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(tabTableName)}`

        // Soft-delete existing child rows
        if (runtimeDeleteSetClause) {
          await mgr.query(
            `
              UPDATE ${tabTableIdent}
              SET ${runtimeDeleteSetClause},
                  _upl_version = COALESCE(_upl_version, 1) + 1
              WHERE _tp_parent_id = $2
                AND ${runtimeRowCondition}
            `,
            [ctx.userId, rowId]
          )
        } else {
          await mgr.query(
            `
              DELETE FROM ${tabTableIdent}
              WHERE _tp_parent_id = $1
                AND ${runtimeRowCondition}
            `,
            [rowId]
          )
        }

        // Batch insert new child rows
        if (childRows.length > 0) {
          const dataColSet = new Set<string>()
          for (const rd of childRows) {
            for (const cn of Object.keys(rd)) {
              if (IDENTIFIER_REGEX.test(cn)) dataColSet.add(cn)
            }
          }
          const dataColumns = [...dataColSet]
          const headerCols: string[] = [
            '_tp_parent_id',
            '_tp_sort_order'
          ]
          if (
            ctx.workspacesEnabled &&
            ctx.currentWorkspaceId
          ) {
            headerCols.push(quoteIdentifier('workspace_id'))
          }
          if (ctx.userId) headerCols.push('_upl_created_by')
          const allColumns = [
            ...headerCols,
            ...dataColumns.map((c) => quoteIdentifier(c))
          ]
          const allValues: unknown[] = []
          const valueTuples: string[] = []
          let pIdx = 1

          for (
            let rowIdx = 0;
            rowIdx < childRows.length;
            rowIdx++
          ) {
            const rowData = childRows[rowIdx]
            const ph: string[] = []
            ph.push(`$${pIdx++}`)
            allValues.push(rowId)
            ph.push(`$${pIdx++}`)
            allValues.push(rowIdx)
            if (
              ctx.workspacesEnabled &&
              ctx.currentWorkspaceId
            ) {
              ph.push(`$${pIdx++}`)
              allValues.push(ctx.currentWorkspaceId)
            }
            if (ctx.userId) {
              ph.push(`$${pIdx++}`)
              allValues.push(ctx.userId)
            }
            for (const cn of dataColumns) {
              ph.push(`$${pIdx++}`)
              allValues.push(rowData[cn] ?? null)
            }
            valueTuples.push(`(${ph.join(', ')})`)
          }

          await mgr.query(
            `INSERT INTO ${tabTableIdent} (${allColumns.join(', ')}) VALUES ${valueTuples.join(', ')}`,
            allValues
          )
        }
      }
    }

    try {
      if (hasTableUpdates) {
        await ctx.manager.transaction(async (txManager) => {
          await performBulkUpdate(txManager)
        })
      } else {
        await performBulkUpdate(ctx.manager)
      }
      return res.json({ status: 'ok' })
    } catch (e) {
      if (e instanceof UpdateFailure) {
        return res.status(e.statusCode).json(e.body)
      }
      throw e
    }
  }

  // ============ CREATE ROW ============
  const createRow = async (req: Request, res: Response) => {
    const { applicationId } = req.params

    const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
    if (!ctx) return
    if (!ensureRuntimePermission(res, ctx, 'createContent')) return

    const parsedBody = runtimeCreateBodySchema.safeParse(req.body)
    if (!parsedBody.success) {
      return res
        .status(400)
        .json({ error: 'Invalid body', details: parsedBody.error.flatten() })
    }

    const { catalogId: requestedCatalogId, data } = parsedBody.data

    const {
      catalog,
      attrs,
      error: catalogError
    } = await resolveRuntimeCatalog(
      ctx.manager,
      ctx.schemaIdent,
      requestedCatalogId
    )
    if (!catalog)
      return res.status(404).json({ error: catalogError })
    const runtimeRowCondition = buildRuntimeActiveRowCondition(
      catalog.lifecycleContract,
      catalog.config,
      undefined,
      ctx.currentWorkspaceId
    )
    const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(catalog.table_name)}`
    // Build column→value pairs from input data
    const columnValues: Array<{ column: string; value: unknown }> = []
    const safeAttrs = attrs.filter(
      (a) =>
        IDENTIFIER_REGEX.test(a.column_name) &&
        RUNTIME_WRITABLE_TYPES.has(a.data_type) &&
        a.data_type !== 'TABLE'
    )

    for (const attr of safeAttrs) {
      const attrLabel = formatRuntimeFieldLabel(attr.codename)
      const { hasUserValue, value: inputValue } =
        getRuntimeInputValue(data, attr.column_name, attr.codename)
      let raw = inputValue

      const isEnumRef =
        attr.data_type === 'REF' &&
        attr.target_object_kind === 'enumeration'
      const enumMode = getEnumPresentationMode(attr.ui_config)

      if (isEnumRef && enumMode === 'label' && hasUserValue) {
        return res.status(400).json({
          error: `Field is read-only: ${attrLabel}`
        })
      }

      if (
        raw === undefined &&
        isEnumRef &&
        typeof attr.target_object_id === 'string'
      ) {
        const defaultEnumValueId = getDefaultEnumValueId(
          attr.ui_config
        )
        if (defaultEnumValueId) {
          try {
            await ensureEnumerationValueBelongsToTarget(
              ctx.manager,
              ctx.schemaIdent,
              defaultEnumValueId,
              attr.target_object_id
            )
            raw = defaultEnumValueId
          } catch (error) {
            if (
              error instanceof Error &&
              error.message ===
                'Enumeration value does not belong to target enumeration'
            ) {
              raw = undefined
            } else {
              throw error
            }
          }
        }
      }

      const setConstantConfig =
        attr.data_type === 'REF' && attr.target_object_kind === 'set'
          ? getSetConstantConfig(attr.ui_config)
          : null
      if (setConstantConfig) {
        const providedRefId = resolveRefId(raw)
        if (!providedRefId) {
          raw = setConstantConfig.id
        } else if (providedRefId !== setConstantConfig.id) {
          return res.status(400).json({
            error: `Field is read-only: ${attrLabel}`
          })
        } else {
          raw = setConstantConfig.id
        }
      }

      if (raw === undefined) {
        if (
          attr.is_required &&
          attr.data_type !== 'BOOLEAN'
        ) {
          return res.status(400).json({
            error: `Required field missing: ${attrLabel}`
          })
        }
        continue
      }
      try {
        const coerced = coerceRuntimeValue(
          raw,
          attr.data_type,
          attr.validation_rules
        )
        if (
          attr.is_required &&
          attr.data_type !== 'BOOLEAN' &&
          coerced === null
        ) {
          return res.status(400).json({
            error: `Required field cannot be set to null: ${attrLabel}`
          })
        }

        if (
          isEnumRef &&
          typeof attr.target_object_id === 'string' &&
          coerced
        ) {
          await ensureEnumerationValueBelongsToTarget(
            ctx.manager,
            ctx.schemaIdent,
            String(coerced),
            attr.target_object_id
          )
        }

        columnValues.push({
          column: attr.column_name,
          value: coerced
        })
      } catch (e) {
        return res.status(400).json({
          error: `Invalid value for ${attrLabel}: ${(e as Error).message}`
        })
      }
    }

    const runtimeConfig = normalizeCatalogRuntimeViewConfig(
      (catalog.config?.runtimeConfig ?? undefined) as Record<string, unknown> | undefined
    )
    const reorderFieldAttr = resolveRuntimeReorderField(
      safeAttrs,
      runtimeConfig.enableRowReordering ? runtimeConfig.reorderPersistenceField : null
    )
    if (
      reorderFieldAttr &&
      !columnValues.some((item) => item.column === reorderFieldAttr.column_name)
    ) {
      const nextSortValue = await getNextRuntimeSortValue({
        manager: ctx.manager,
        dataTableIdent,
        runtimeRowCondition,
        reorderColumnName: reorderFieldAttr.column_name
      })
      columnValues.push({
        column: reorderFieldAttr.column_name,
        value: nextSortValue
      })
    }

    const colNames = columnValues.map((cv) =>
      quoteIdentifier(cv.column)
    )
    const placeholders = columnValues.map(
      (_, i) => `$${i + 1}`
    )
    const insertValues = columnValues.map((cv) => cv.value)

    if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
      colNames.push(quoteIdentifier('workspace_id'))
      placeholders.push(`$${insertValues.length + 1}`)
      insertValues.push(ctx.currentWorkspaceId)
    }

    if (ctx.userId) {
      colNames.push('_upl_created_by')
      placeholders.push(`$${insertValues.length + 1}`)
      insertValues.push(ctx.userId)
    }

    const insertSql =
      colNames.length > 0
        ? `INSERT INTO ${dataTableIdent} (${colNames.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`
        : `INSERT INTO ${dataTableIdent} DEFAULT VALUES RETURNING id`

    // Collect TABLE-type data from request body for child row insertion
    const tableAttrsForCreate = attrs.filter(
      (a) => a.data_type === 'TABLE'
    )
    const tableDataEntries: Array<{
      attr: (typeof attrs)[number]
      rows: Array<Record<string, unknown>>
      tabTableName: string
    }> = []
    for (const tAttr of tableAttrsForCreate) {
      const tableFieldPath = formatRuntimeFieldPath(tAttr.codename)
      const { value: raw } = getRuntimeInputValue(
        data,
        tAttr.column_name,
        tAttr.codename
      )
      if (
        raw !== undefined &&
        raw !== null &&
        !Array.isArray(raw)
      ) {
        return res.status(400).json({
          error: `Invalid value for ${tableFieldPath}: TABLE value must be an array`
        })
      }

      const childRows = Array.isArray(raw)
        ? (raw as Array<Record<string, unknown>>)
        : []
      const rowCountError = getTableRowCountError(
        childRows.length,
        tableFieldPath,
        getTableRowLimits(tAttr.validation_rules)
      )
      if (rowCountError) {
        return res.status(400).json({ error: rowCountError })
      }

      if (childRows.length > 0) {
        const fallbackTabTableName = generateChildTableName(
          tAttr.id
        )
        const tabTableName =
          typeof tAttr.column_name === 'string' &&
          IDENTIFIER_REGEX.test(tAttr.column_name)
            ? tAttr.column_name
            : fallbackTabTableName
        if (!IDENTIFIER_REGEX.test(tabTableName)) {
          return res.status(400).json({
            error: `Invalid tabular table name for ${tableFieldPath}`
          })
        }

        const childAttrsResult = (await ctx.manager.query(
          `
            SELECT id, codename, column_name, data_type, is_required, validation_rules,
                   target_object_id, target_object_kind, ui_config
            FROM ${ctx.schemaIdent}._app_attributes
            WHERE parent_attribute_id = $1
              AND _upl_deleted = false
              AND _app_deleted = false
            ORDER BY sort_order ASC
          `,
          [tAttr.id]
        )) as Array<{
          id: string
          codename: unknown
          column_name: string
          data_type: string
          is_required: boolean
          validation_rules?: Record<string, unknown>
          target_object_id?: string | null
          target_object_kind?: string | null
          ui_config?: Record<string, unknown>
        }>

        const preparedRows: Array<Record<string, unknown>> = []

        for (
          let rowIdx = 0;
          rowIdx < childRows.length;
          rowIdx++
        ) {
          const rowData = childRows[rowIdx]
          if (
            !rowData ||
            typeof rowData !== 'object' ||
            Array.isArray(rowData)
          ) {
            return res.status(400).json({
              error: `Invalid row ${rowIdx + 1} for ${tableFieldPath}: row must be an object`
            })
          }

          const preparedRow: Record<string, unknown> = {}
          for (const cAttr of childAttrsResult) {
            if (!IDENTIFIER_REGEX.test(cAttr.column_name))
              continue
            const childFieldPath = formatRuntimeFieldPath(
              tAttr.codename,
              cAttr.codename
            )
            const isEnumRef =
              cAttr.data_type === 'REF' &&
              cAttr.target_object_kind === 'enumeration'
            const { hasUserValue, value: childInputValue } =
              getRuntimeInputValue(
                rowData,
                cAttr.column_name,
                cAttr.codename
              )
            let cRaw = childInputValue

            if (
              isEnumRef &&
              getEnumPresentationMode(cAttr.ui_config) ===
                'label' &&
              hasUserValue
            ) {
              return res.status(400).json({
                error: `Field is read-only: ${childFieldPath}`
              })
            }

            if (
              cRaw === undefined &&
              isEnumRef &&
              typeof cAttr.target_object_id === 'string'
            ) {
              const defaultEnumValueId = getDefaultEnumValueId(
                cAttr.ui_config
              )
              if (defaultEnumValueId) {
                try {
                  await ensureEnumerationValueBelongsToTarget(
                    ctx.manager,
                    ctx.schemaIdent,
                    defaultEnumValueId,
                    cAttr.target_object_id
                  )
                  cRaw = defaultEnumValueId
                } catch (error) {
                  if (
                    error instanceof Error &&
                    error.message ===
                      'Enumeration value does not belong to target enumeration'
                  ) {
                    cRaw = undefined
                  } else {
                    throw error
                  }
                }
              }
            }

            const childSetConstantConfig =
              cAttr.data_type === 'REF' &&
              cAttr.target_object_kind === 'set'
                ? getSetConstantConfig(cAttr.ui_config)
                : null
            if (childSetConstantConfig) {
              const providedRefId = resolveRefId(cRaw)
              if (!providedRefId) {
                cRaw = childSetConstantConfig.id
              } else if (
                providedRefId !== childSetConstantConfig.id
              ) {
                return res.status(400).json({
                  error: `Field is read-only: ${childFieldPath}`
                })
              } else {
                cRaw = childSetConstantConfig.id
              }
            }

            if (cRaw === undefined || cRaw === null) {
              if (
                cAttr.is_required &&
                cAttr.data_type !== 'BOOLEAN'
              ) {
                return res.status(400).json({
                  error: `Required field missing: ${childFieldPath}`
                })
              }
              continue
            }

            try {
              const cCoerced = coerceRuntimeValue(
                cRaw,
                cAttr.data_type,
                cAttr.validation_rules
              )
              if (
                isEnumRef &&
                typeof cAttr.target_object_id === 'string' &&
                cCoerced
              ) {
                await ensureEnumerationValueBelongsToTarget(
                  ctx.manager,
                  ctx.schemaIdent,
                  String(cCoerced),
                  cAttr.target_object_id
                )
              }
              preparedRow[cAttr.column_name] = cCoerced
            } catch (err) {
              return res.status(400).json({
                error: `Invalid value for ${childFieldPath}: ${
                  err instanceof Error
                    ? err.message
                    : String(err)
                }`
              })
            }
          }

          preparedRows.push(preparedRow)
        }

        tableDataEntries.push({
          attr: tAttr,
          rows: preparedRows,
          tabTableName
        })
      }
    }

    const performCreate = async (
      mgr: DbExecutor
    ): Promise<string> => {
      if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
        const limitState = await enforceCatalogWorkspaceLimit(
          mgr,
          {
            schemaName: ctx.schemaName,
            objectId: catalog.id,
            tableName: catalog.table_name,
            workspaceId: ctx.currentWorkspaceId,
            runtimeRowCondition
          }
        )

        if (!limitState.canCreate) {
          throw new UpdateFailure(409, {
            error: 'Workspace catalog row limit reached',
            code: 'WORKSPACE_LIMIT_REACHED',
            details: limitState
          })
        }
      }

      const [inserted] = (await mgr.query(
        insertSql,
        insertValues
      )) as Array<{ id: string }>
      const parentId = inserted.id

      for (const {
        rows: childRows,
        tabTableName
      } of tableDataEntries) {
        if (childRows.length === 0) continue
        const tabTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(tabTableName)}`

        const dataColSet = new Set<string>()
        for (const rd of childRows) {
          for (const cn of Object.keys(rd)) {
            if (IDENTIFIER_REGEX.test(cn)) dataColSet.add(cn)
          }
        }
        const dataColumns = [...dataColSet]
        const headerCols: string[] = [
          '_tp_parent_id',
          '_tp_sort_order'
        ]
        if (
          ctx.workspacesEnabled &&
          ctx.currentWorkspaceId
        ) {
          headerCols.push(quoteIdentifier('workspace_id'))
        }
        if (ctx.userId)
          headerCols.push('_upl_created_by')
        const allColumns = [
          ...headerCols,
          ...dataColumns.map((c) => quoteIdentifier(c))
        ]
        const allValues: unknown[] = []
        const valueTuples: string[] = []
        let pIdx = 1

        for (
          let rowIdx = 0;
          rowIdx < childRows.length;
          rowIdx++
        ) {
          const rowData = childRows[rowIdx]
          const ph: string[] = []
          ph.push(`$${pIdx++}`)
          allValues.push(parentId)
          ph.push(`$${pIdx++}`)
          allValues.push(rowIdx)
          if (
            ctx.workspacesEnabled &&
            ctx.currentWorkspaceId
          ) {
            ph.push(`$${pIdx++}`)
            allValues.push(ctx.currentWorkspaceId)
          }
          if (ctx.userId) {
            ph.push(`$${pIdx++}`)
            allValues.push(ctx.userId)
          }
          for (const cn of dataColumns) {
            ph.push(`$${pIdx++}`)
            allValues.push(rowData[cn] ?? null)
          }
          valueTuples.push(`(${ph.join(', ')})`)
        }

        await mgr.query(
          `INSERT INTO ${tabTableIdent} (${allColumns.join(', ')}) VALUES ${valueTuples.join(', ')}`,
          allValues
        )
      }

      return parentId
    }

    let parentId: string
    if (
      tableDataEntries.length > 0 ||
      (ctx.workspacesEnabled && ctx.currentWorkspaceId)
    ) {
      try {
        parentId = await ctx.manager.transaction(
          async (txManager) => {
            return performCreate(txManager)
          }
        )
      } catch (error) {
        if (error instanceof UpdateFailure) {
          return res
            .status(error.statusCode)
            .json(error.body)
        }
        throw error
      }
    } else {
      try {
        parentId = await performCreate(ctx.manager)
      } catch (error) {
        if (error instanceof UpdateFailure) {
          return res
            .status(error.statusCode)
            .json(error.body)
        }
        throw error
      }
    }
    return res
      .status(201)
      .json({ id: parentId, status: 'created' })
  }

  // ============ COPY ROW ============
  const copyRow = async (req: Request, res: Response) => {
    const { applicationId, rowId } = req.params
    if (!UUID_REGEX.test(rowId))
      return res.status(400).json({ error: 'Invalid row ID format' })

    const parsedBody = runtimeCopyBodySchema.safeParse(
      req.body ?? {}
    )
    if (!parsedBody.success) {
      return res
        .status(400)
        .json({ error: 'Invalid body', details: parsedBody.error.flatten() })
    }

    const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
    if (!ctx) return
    if (!ensureRuntimePermission(res, ctx, 'createContent')) return

    const {
      catalog,
      attrs,
      error: catalogError
    } = await resolveRuntimeCatalog(
      ctx.manager,
      ctx.schemaIdent,
      parsedBody.data.catalogId
    )
    if (!catalog)
      return res.status(404).json({ error: catalogError })

    const safeAttrs = attrs.filter((a) =>
      IDENTIFIER_REGEX.test(a.column_name)
    )
    const nonTableAttrs = safeAttrs.filter(
      (a) => a.data_type !== 'TABLE'
    )
    const tableAttrsForCopy = safeAttrs.filter(
      (a) => a.data_type === 'TABLE'
    )

    const hasRequiredChildTables = tableAttrsForCopy.some(
      (attr) => {
        const { minRows } = getTableRowLimits(
          attr.validation_rules
        )
        return (
          Boolean(attr.is_required) ||
          (minRows !== null && minRows > 0)
        )
      }
    )
    const copyChildTables = hasRequiredChildTables
      ? true
      : parsedBody.data.copyChildTables !== false
    const runtimeRowCondition = buildRuntimeActiveRowCondition(
      catalog.lifecycleContract,
      catalog.config,
      undefined,
      ctx.currentWorkspaceId
    )
    const runtimeConfig = normalizeCatalogRuntimeViewConfig(
      (catalog.config?.runtimeConfig ?? undefined) as Record<string, unknown> | undefined
    )
    const reorderFieldAttr = resolveRuntimeReorderField(
      nonTableAttrs,
      runtimeConfig.enableRowReordering ? runtimeConfig.reorderPersistenceField : null
    )

    const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(catalog.table_name)}`
    const sourceRows = (await ctx.manager.query(
      `
        SELECT *
        FROM ${dataTableIdent}
        WHERE id = $1
          AND ${runtimeRowCondition}
      `,
      [rowId]
    )) as Array<Record<string, unknown>>

    if (sourceRows.length === 0)
      return res.status(404).json({ error: 'Row not found' })
    if (sourceRows[0]._upl_locked)
      return res.status(423).json({ error: 'Record is locked' })
    const sourceRow = sourceRows[0]

    const insertColumns = nonTableAttrs.map((attr) =>
      quoteIdentifier(attr.column_name)
    )
    const insertValuesArr = nonTableAttrs.map(
      (attr) =>
        reorderFieldAttr?.column_name === attr.column_name
          ? null
          : sourceRow[attr.column_name] ?? null
    )
    const placeholders = insertValuesArr.map(
      (_, index) => `$${index + 1}`
    )
    if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
      insertColumns.push(quoteIdentifier('workspace_id'))
      insertValuesArr.push(ctx.currentWorkspaceId)
      placeholders.push(`$${insertValuesArr.length}`)
    }
    if (ctx.userId) {
      insertColumns.push('_upl_created_by')
      insertValuesArr.push(ctx.userId)
      placeholders.push(`$${insertValuesArr.length}`)
    }

    const performCopy = async (mgr: DbExecutor) => {
      if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
        const limitState = await enforceCatalogWorkspaceLimit(
          mgr,
          {
            schemaName: ctx.schemaName,
            objectId: catalog.id,
            tableName: catalog.table_name,
            workspaceId: ctx.currentWorkspaceId,
            runtimeRowCondition
          }
        )

        if (!limitState.canCreate) {
          throw new UpdateFailure(409, {
            error: 'Workspace catalog row limit reached',
            code: 'WORKSPACE_LIMIT_REACHED',
            details: limitState
          })
        }
      }

      if (reorderFieldAttr) {
        const reorderFieldIndex = nonTableAttrs.findIndex(
          (attr) => attr.column_name === reorderFieldAttr.column_name
        )
        if (reorderFieldIndex >= 0) {
          insertValuesArr[reorderFieldIndex] = await getNextRuntimeSortValue({
            manager: mgr,
            dataTableIdent,
            runtimeRowCondition,
            reorderColumnName: reorderFieldAttr.column_name
          })
        }
      }

      const [insertedParent] = (await mgr.query(
        `INSERT INTO ${dataTableIdent} (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
        insertValuesArr
      )) as Array<{ id: string }>

      if (copyChildTables) {
        for (const tableAttr of tableAttrsForCopy) {
          const { minRows } = getTableRowLimits(
            tableAttr.validation_rules
          )
          const fallbackTabTableName = generateChildTableName(
            tableAttr.id
          )
          const tabTableName =
            typeof tableAttr.column_name === 'string' &&
            IDENTIFIER_REGEX.test(tableAttr.column_name)
              ? tableAttr.column_name
              : fallbackTabTableName
          if (!IDENTIFIER_REGEX.test(tabTableName)) continue
          const tabTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(tabTableName)}`

          const childAttrs = (await mgr.query(
            `
              SELECT codename, column_name
              FROM ${ctx.schemaIdent}._app_attributes
              WHERE parent_attribute_id = $1
                AND _upl_deleted = false
                AND _app_deleted = false
              ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST
            `,
            [tableAttr.id]
          )) as Array<{
            codename: string
            column_name: string
          }>

          const validChildColumns = childAttrs
            .map((attr) => attr.column_name)
            .filter((column) => IDENTIFIER_REGEX.test(column))
          const sourceChildRows = (await mgr.query(
            `
              SELECT ${
                validChildColumns.length > 0
                  ? validChildColumns
                      .map((column) => quoteIdentifier(column))
                      .join(', ') + ','
                  : ''
              }
                     _tp_sort_order
              FROM ${tabTableIdent}
              WHERE _tp_parent_id = $1
                AND ${runtimeRowCondition}
              ORDER BY _tp_sort_order ASC, _upl_created_at ASC NULLS LAST
            `,
            [rowId]
          )) as Array<Record<string, unknown>>

          if (
            minRows !== null &&
            sourceChildRows.length < minRows
          ) {
            throw new UpdateFailure(400, {
              error: `TABLE ${tableAttr.codename} requires at least ${minRows} row(s)`
            })
          }

          if (sourceChildRows.length === 0) continue

          const headerColumns = [
            '_tp_parent_id',
            '_tp_sort_order',
            ...(ctx.workspacesEnabled &&
            ctx.currentWorkspaceId
              ? [quoteIdentifier('workspace_id')]
              : []),
            ...(ctx.userId ? ['_upl_created_by'] : [])
          ]
          const allColumns = [
            ...headerColumns,
            ...validChildColumns.map((column) =>
              quoteIdentifier(column)
            )
          ]
          const copyValues: unknown[] = []
          const valueTuples: string[] = []
          let copyParamIndex = 1
          for (
            let index = 0;
            index < sourceChildRows.length;
            index++
          ) {
            const sourceChild = sourceChildRows[index]
            const tuple: string[] = []
            tuple.push(`$${copyParamIndex++}`)
            copyValues.push(insertedParent.id)
            tuple.push(`$${copyParamIndex++}`)
            copyValues.push(index)
            if (
              ctx.workspacesEnabled &&
              ctx.currentWorkspaceId
            ) {
              tuple.push(`$${copyParamIndex++}`)
              copyValues.push(ctx.currentWorkspaceId)
            }
            if (ctx.userId) {
              tuple.push(`$${copyParamIndex++}`)
              copyValues.push(ctx.userId)
            }
            for (const column of validChildColumns) {
              tuple.push(`$${copyParamIndex++}`)
              copyValues.push(sourceChild[column] ?? null)
            }
            valueTuples.push(`(${tuple.join(', ')})`)
          }
          await mgr.query(
            `INSERT INTO ${tabTableIdent} (${allColumns.join(', ')}) VALUES ${valueTuples.join(', ')}`,
            copyValues
          )
        }
      }

      return insertedParent.id
    }

    try {
      const copiedId =
        tableAttrsForCopy.length > 0 ||
        (ctx.workspacesEnabled && ctx.currentWorkspaceId)
          ? await ctx.manager.transaction((tx) =>
              performCopy(tx)
            )
          : await performCopy(ctx.manager)
      return res.status(201).json({
        id: copiedId,
        status: 'created',
        copyOptions: { copyChildTables },
        hasRequiredChildTables
      })
    } catch (error) {
      if (error instanceof UpdateFailure) {
        return res
          .status(error.statusCode)
          .json(error.body)
      }
      throw error
    }
  }

  // ============ GET SINGLE ROW (raw for edit) ============
  const getRow = async (req: Request, res: Response) => {
    const { applicationId, rowId } = req.params
    if (!UUID_REGEX.test(rowId))
      return res.status(400).json({ error: 'Invalid row ID format' })
    const catalogId =
      typeof req.query.catalogId === 'string'
        ? req.query.catalogId
        : undefined
    if (catalogId && !UUID_REGEX.test(catalogId))
      return res
        .status(400)
        .json({ error: 'Invalid catalog ID format' })

    const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
    if (!ctx) return

    const {
      catalog,
      attrs,
      error: catalogError
    } = await resolveRuntimeCatalog(
      ctx.manager,
      ctx.schemaIdent,
      catalogId
    )
    if (!catalog)
      return res.status(404).json({ error: catalogError })
    const runtimeRowCondition = buildRuntimeActiveRowCondition(
      catalog.lifecycleContract,
      catalog.config,
      undefined,
      ctx.currentWorkspaceId
    )

    const safeAttrs = attrs.filter(
      (a) =>
        IDENTIFIER_REGEX.test(a.column_name) &&
        a.data_type !== 'TABLE'
    )
    const selectColumns = [
      'id',
      ...safeAttrs.map((a) => quoteIdentifier(a.column_name))
    ]
    const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(catalog.table_name)}`

    const rows = (await ctx.manager.query(
      `
        SELECT ${selectColumns.join(', ')}
        FROM ${dataTableIdent}
        WHERE id = $1
          AND ${runtimeRowCondition}
      `,
      [rowId]
    )) as Array<Record<string, unknown>>

    if (rows.length === 0)
      return res.status(404).json({ error: 'Row not found' })

    const row = rows[0]
    const rawData: Record<string, unknown> = {}
    for (const attr of safeAttrs) {
      const raw = row[attr.column_name] ?? null
      rawData[attr.column_name] =
        attr.data_type === 'NUMBER' && raw !== null
          ? pgNumericToNumber(raw)
          : raw
    }

    return res.json({ id: String(row.id), data: rawData })
  }

  // ============ DELETE ROW (soft) ============
  const deleteRow = async (req: Request, res: Response) => {
    const { applicationId, rowId } = req.params
    if (!UUID_REGEX.test(rowId))
      return res.status(400).json({ error: 'Invalid row ID format' })
    const catalogId =
      typeof req.query.catalogId === 'string'
        ? req.query.catalogId
        : undefined
    if (catalogId && !UUID_REGEX.test(catalogId))
      return res
        .status(400)
        .json({ error: 'Invalid catalog ID format' })

    const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
    if (!ctx) return
    if (!ensureRuntimePermission(res, ctx, 'deleteContent')) return

    const {
      catalog,
      attrs,
      error: catalogError
    } = await resolveRuntimeCatalog(
      ctx.manager,
      ctx.schemaIdent,
      catalogId
    )
    if (!catalog)
      return res.status(404).json({ error: catalogError })

    const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(catalog.table_name)}`
    const runtimeRowCondition = buildRuntimeActiveRowCondition(
      catalog.lifecycleContract,
      catalog.config,
      undefined,
      ctx.currentWorkspaceId
    )
    const runtimeDeleteSetClause = isSoftDeleteLifecycle(
      catalog.lifecycleContract
    )
      ? buildRuntimeSoftDeleteSetClause(
          '$1',
          catalog.lifecycleContract,
          catalog.config
        )
      : null

    const tableAttrsForDelete = attrs.filter(
      (a) => a.data_type === 'TABLE'
    )
    const needsTransaction =
      isSoftDeleteLifecycle(catalog.lifecycleContract) &&
      tableAttrsForDelete.length > 0

    const performDelete = async (mgr: DbExecutor) => {
      const deleted = runtimeDeleteSetClause
        ? ((await mgr.query(
            `
              UPDATE ${dataTableIdent}
              SET ${runtimeDeleteSetClause},
                  _upl_version = COALESCE(_upl_version, 1) + 1
              WHERE id = $2
                AND ${runtimeRowCondition}
                AND COALESCE(_upl_locked, false) = false
              RETURNING id
            `,
            [ctx.userId, rowId]
          )) as Array<{ id: string }>)
        : ((await mgr.query(
            `
              DELETE FROM ${dataTableIdent}
              WHERE id = $1
                AND ${runtimeRowCondition}
                AND COALESCE(_upl_locked, false) = false
              RETURNING id
            `,
            [rowId]
          )) as Array<{ id: string }>)

      if (deleted.length === 0) {
        const exists = (await mgr.query(
          `SELECT id, _upl_locked FROM ${dataTableIdent} WHERE id = $1 AND ${runtimeRowCondition}`,
          [rowId]
        )) as Array<{
          id: string
          _upl_locked?: boolean
        }>
        if (exists.length > 0 && exists[0]._upl_locked) {
          throw new UpdateFailure(423, {
            error: 'Record is locked'
          })
        }
        throw new UpdateFailure(404, {
          error: 'Row not found'
        })
      }

      if (!runtimeDeleteSetClause) {
        return
      }

      // Soft-delete child rows in TABLE child tables
      for (const tAttr of tableAttrsForDelete) {
        const fallbackTabTableName = generateChildTableName(
          tAttr.id
        )
        const tabTableName =
          typeof tAttr.column_name === 'string' &&
          IDENTIFIER_REGEX.test(tAttr.column_name)
            ? tAttr.column_name
            : fallbackTabTableName
        if (!IDENTIFIER_REGEX.test(tabTableName)) continue
        const tabTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(tabTableName)}`
        await mgr.query(
          `
            UPDATE ${tabTableIdent}
            SET ${runtimeDeleteSetClause},
                _upl_version = COALESCE(_upl_version, 1) + 1
            WHERE _tp_parent_id = $2
              AND ${runtimeRowCondition}
          `,
          [ctx.userId, rowId]
        )
      }
    }

    try {
      if (needsTransaction) {
        await ctx.manager.transaction(async (txManager) => {
          await performDelete(txManager)
        })
      } else {
        await performDelete(ctx.manager)
      }
      return res.json({ status: 'deleted' })
    } catch (e) {
      if (e instanceof UpdateFailure) {
        return res.status(e.statusCode).json(e.body)
      }
      throw e
    }
  }

  const reorderRows = async (req: Request, res: Response) => {
    const { applicationId } = req.params

    const parsedBody = runtimeReorderBodySchema.safeParse(req.body)
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
    }

    const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
    if (!ctx) return
    if (!ensureRuntimePermission(res, ctx, 'editContent')) return

    const { orderedRowIds, catalogId: requestedCatalogId } = parsedBody.data
    const { catalog, attrs, error: catalogError } = await resolveRuntimeCatalog(ctx.manager, ctx.schemaIdent, requestedCatalogId)
    if (!catalog) {
      return res.status(404).json({ error: catalogError })
    }

    const runtimeConfig = normalizeCatalogRuntimeViewConfig(
      (catalog.config?.runtimeConfig ?? undefined) as Record<string, unknown> | undefined
    )
    const reorderFieldAttr = resolveRuntimeReorderField(attrs, runtimeConfig.reorderPersistenceField)

    if (!runtimeConfig.enableRowReordering || !reorderFieldAttr) {
      return res.status(409).json({ error: 'Persisted row reordering is not enabled for this catalog' })
    }

    const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(catalog.table_name)}`
    const runtimeRowCondition = buildRuntimeActiveRowCondition(
      catalog.lifecycleContract,
      catalog.config,
      undefined,
      ctx.currentWorkspaceId
    )

    const [{ total }] = (await ctx.manager.query(
      `
        SELECT COUNT(*)::int AS total
        FROM ${dataTableIdent}
        WHERE ${runtimeRowCondition}
      `
    )) as Array<{ total: number }>

    if (total !== orderedRowIds.length) {
      return res.status(409).json({
        error: 'Persisted row reordering requires the complete loaded dataset',
        details: { total, received: orderedRowIds.length }
      })
    }

    const matchedRows = (await ctx.manager.query(
      `
        SELECT id
        FROM ${dataTableIdent}
        WHERE id = ANY($1::uuid[])
          AND ${runtimeRowCondition}
      `,
      [orderedRowIds]
    )) as Array<{ id: string }>

    if (matchedRows.length !== orderedRowIds.length) {
      return res.status(404).json({ error: 'One or more rows could not be reordered' })
    }

    const valuesSql = orderedRowIds
      .map((_, index) => `($${index * 2 + 1}::uuid, $${index * 2 + 2}::numeric)`)
      .join(', ')
    const parameters = orderedRowIds.flatMap((rowId, index) => [rowId, index])

    await ctx.manager.query(
      `
        WITH incoming(id, sort_order) AS (
          VALUES ${valuesSql}
        )
        UPDATE ${dataTableIdent} AS target
        SET ${quoteIdentifier(reorderFieldAttr.column_name)} = incoming.sort_order,
            _upl_updated_by = $${parameters.length + 1},
            _upl_version = COALESCE(target._upl_version, 1) + 1
        FROM incoming
        WHERE target.id = incoming.id
          AND ${runtimeRowCondition}
      `,
      [...parameters, ctx.userId]
    )

    return res.json({ status: 'reordered' })
  }

  return {
    getRuntime,
    updateCell,
    bulkUpdateRow,
    createRow,
    copyRow,
    getRow,
    deleteRow,
    reorderRows
  }
}
