import type { Request, Response } from 'express'
import { z } from 'zod'
import type { DbExecutor } from '@universo/utils'
import { escapeLikeWildcards } from '@universo/utils'
import {
    isBuiltinEntityKind,
    normalizeRuntimePageBlocks,
    runtimeDatasourceFilterSchema,
    runtimeDatasourceSortSchema,
    workflowActionSchema,
    type BuiltinEntityKind,
    type RuntimeDatasourceFilter,
    type RuntimeDatasourceSort,
    type WorkflowAction
} from '@universo/types'
import {
    normalizeObjectCollectionRuntimeViewConfig,
    resolveObjectCollectionLayoutBehaviorConfig,
    resolveObjectCollectionRuntimeDashboardLayoutConfig,
    resolveApplicationLifecycleContractFromConfig
} from '@universo/utils'
import { generateChildTableName } from '@universo/schema-ddl'
import { getObjectWorkspaceLimit, getObjectWorkspaceUsage, enforceObjectWorkspaceLimit } from '../services/applicationWorkspaces'
import {
    assertRuntimeRecordMutable,
    isRuntimeRecordBehaviorEnabled,
    normalizeRuntimeRecordBehavior,
    RuntimeRecordCommandService
} from '../services/runtimeRecordBehavior'
import { RuntimeScriptsService } from '../services/runtimeScriptsService'
import { RuntimePostingMovementService } from '../services/runtimePostingMovements'
import { applyWorkflowAction } from '../services/runtimeWorkflowActions'
import type { RolePermission } from '../routes/guards'
import {
    UpdateFailure,
    IDENTIFIER_REGEX,
    UUID_REGEX,
    quoteIdentifier,
    normalizeLocale,
    runtimeCodenameTextSql,
    runtimeObjectFilterSql,
    runtimeStandardKindSql,
    runtimeLayoutCapableFilterSql,
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
    normalizeConfiguredRuntimeJsonValue,
    normalizeRuntimeTableChildInsertValue,
    normalizeRuntimeTableChildInsertValueByMeta,
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
    type RuntimeTableChildComponentMeta,
    type SetConstantUiConfig
} from '../shared/runtimeHelpers'

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const parseJsonQueryValue = (value: unknown): unknown => {
    if (typeof value !== 'string') {
        return value
    }

    try {
        return JSON.parse(value)
    } catch {
        return value
    }
}

const runtimeQuerySchema = z.object({
    limit: z.coerce.number().int().positive().max(10000).default(100),
    offset: z.coerce.number().int().min(0).default(0),
    locale: z.string().optional(),
    objectCollectionId: z.string().uuid().optional(),
    search: z.string().trim().max(200).optional(),
    sort: z.preprocess(parseJsonQueryValue, z.array(runtimeDatasourceSortSchema).max(5).optional()),
    filters: z.preprocess(parseJsonQueryValue, z.array(runtimeDatasourceFilterSchema).max(20).optional())
})

const runtimeUpdateBodySchema = z.object({
    field: z.string().min(1),
    value: z.unknown(),
    objectCollectionId: z.string().uuid().optional(),
    expectedVersion: z.number().int().positive().optional()
})

const runtimeBulkUpdateBodySchema = z.object({
    objectCollectionId: z.string().uuid().optional(),
    data: z.record(z.unknown()),
    expectedVersion: z.number().int().positive().optional()
})

const runtimeCreateBodySchema = z.object({
    objectCollectionId: z.string().uuid().optional(),
    data: z.record(z.unknown())
})

const runtimeCopyBodySchema = z.object({
    objectCollectionId: z.string().uuid().optional(),
    copyChildTables: z.boolean().optional()
})

const runtimeReorderBodySchema = z.object({
    objectCollectionId: z.string().uuid().optional(),
    orderedRowIds: z.array(z.string().uuid()).min(1).max(1000)
})

const runtimeRecordCommandBodySchema = z.object({
    objectCollectionId: z.string().uuid().optional(),
    expectedVersion: z.number().int().positive().optional()
})

const runtimeWorkflowActionBodySchema = z.object({
    objectCollectionId: z.string().uuid().optional(),
    expectedVersion: z.number().int().positive()
})

const runtimeWorkflowActionParamSchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)

const RUNTIME_RECORD_SYSTEM_FIELDS = [
    '_app_record_number',
    '_app_record_date',
    '_app_record_state',
    '_app_posted_at',
    '_app_posted_by',
    '_app_posting_batch_id',
    '_app_posting_movements',
    '_app_voided_at',
    '_app_voided_by'
] as const

const RUNTIME_OBJECT_FILTER_SQL = runtimeObjectFilterSql()
const RUNTIME_LAYOUT_CAPABLE_FILTER_SQL = runtimeLayoutCapableFilterSql()

const resolveRuntimeStandardKind = (kind: unknown): BuiltinEntityKind | null =>
    typeof kind === 'string' && isBuiltinEntityKind(kind) ? kind : null

const isRuntimeObjectTargetKind = (kind: unknown): kind is string =>
    typeof kind === 'string' && !['hub', 'set', 'enumeration', 'page', 'ledger'].includes(resolveRuntimeStandardKind(kind) ?? '')

const isRuntimeEnumerationKind = (kind: unknown): kind is string =>
    typeof kind === 'string' && resolveRuntimeStandardKind(kind) === 'enumeration'

const isRuntimeSetKind = (kind: unknown): kind is string => typeof kind === 'string' && resolveRuntimeStandardKind(kind) === 'set'

const isRuntimeHubKind = (kind: unknown): kind is string => typeof kind === 'string' && resolveRuntimeStandardKind(kind) === 'hub'

type RuntimeMenuPartitionPlacement = 'primary' | 'overflow' | 'hidden'

export const partitionRuntimeMenuItems = <T>(
    resolvedItems: readonly T[],
    maxPrimaryItems: number | null,
    workspaceItem: T | null,
    workspacePlacement: RuntimeMenuPartitionPlacement
): { primaryItems: T[]; overflowItems: T[] } => {
    const workspaceInPrimary = workspaceItem !== null && workspacePlacement === 'primary'
    const effectiveMaxPrimary = maxPrimaryItems === null ? null : Math.max(0, maxPrimaryItems - (workspaceInPrimary ? 1 : 0))

    const primaryItems = effectiveMaxPrimary === null ? [...resolvedItems] : resolvedItems.slice(0, effectiveMaxPrimary)
    const overflowItems = effectiveMaxPrimary === null ? [] : resolvedItems.slice(effectiveMaxPrimary)

    if (workspaceItem !== null) {
        if (workspacePlacement === 'primary') {
            primaryItems.push(workspaceItem)
        } else if (workspacePlacement === 'overflow') {
            overflowItems.push(workspaceItem)
        }
    }

    return { primaryItems, overflowItems }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a runtime row section and load its components from a runtime schema.
 */
const resolveRuntimeObjectCollection = async (manager: DbExecutor, schemaIdent: string, requestedObjectCollectionId?: string) => {
    const objectCollections = (await manager.query(
        `
      SELECT id, kind, codename, table_name, config
      FROM ${schemaIdent}._app_objects
    WHERE ${RUNTIME_OBJECT_FILTER_SQL}
        AND _upl_deleted = false
        AND _app_deleted = false
      ORDER BY ${runtimeCodenameTextSql('codename')} ASC, id ASC
    `
    )) as Array<{
        id: string
        kind: string | null
        codename: unknown
        table_name: string
        config?: Record<string, unknown> | null
    }>

    if (objectCollections.length === 0) return { objectCollection: null, attrs: [], error: 'No record collections available' } as const

    const selectedObjectCollection =
        (requestedObjectCollectionId ? objectCollections.find((c) => c.id === requestedObjectCollectionId) : undefined) ??
        objectCollections[0]
    const objectCollection = selectedObjectCollection
        ? {
              ...selectedObjectCollection,
              lifecycleContract: resolveApplicationLifecycleContractFromConfig(selectedObjectCollection.config)
          }
        : null
    if (!objectCollection) return { objectCollection: null, attrs: [], error: 'Record collection not found' } as const
    if (!IDENTIFIER_REGEX.test(objectCollection.table_name))
        return { objectCollection: null, attrs: [], error: 'Invalid table name' } as const

    const attrs = (await manager.query(
        `
      SELECT id, codename, column_name, data_type, is_required, validation_rules
             , target_object_id, target_object_kind, ui_config
      FROM ${schemaIdent}._app_components
      WHERE object_id = $1
        AND parent_component_id IS NULL
        AND _upl_deleted = false
        AND _app_deleted = false
    `,
        [objectCollection.id]
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

    return { objectCollection, attrs, error: null } as const
}

const readConfiguredWorkflowActions = (config: Record<string, unknown> | null | undefined): WorkflowAction[] => {
    const rawActions = Array.isArray(config?.workflowActions) ? config.workflowActions : []
    return rawActions.flatMap((rawAction) => {
        const parsed = workflowActionSchema.safeParse(rawAction)
        return parsed.success ? [parsed.data] : []
    })
}

const resolveWorkflowStatusColumnName = (
    action: WorkflowAction,
    attrs: Array<{ codename: unknown; column_name: string }>
): string | null => {
    if (action.statusColumnName) return action.statusColumnName
    if (!action.statusFieldCodename) return '_app_record_state'

    const target = action.statusFieldCodename.trim()
    const attr = attrs.find((candidate) => candidate.column_name === target || resolveRuntimeCodenameText(candidate.codename) === target)
    return attr?.column_name ?? null
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
            (cmp) =>
                cmp.data_type === 'NUMBER' &&
                IDENTIFIER_REGEX.test(cmp.column_name) &&
                (cmp.column_name.toLowerCase() === target ||
                    String(cmp.codename ?? '')
                        .trim()
                        .toLowerCase() === target)
        ) ?? null
    )
}

const buildRuntimeRowsOrderBy = (reorderColumnName: string | null) => {
    if (!reorderColumnName || !IDENTIFIER_REGEX.test(reorderColumnName)) {
        return '_upl_created_at ASC NULLS LAST, id ASC'
    }

    return `${quoteIdentifier(reorderColumnName)} ASC NULLS LAST, _upl_created_at ASC NULLS LAST, id ASC`
}

const normalizeRuntimeListFieldKey = (value: unknown) =>
    (typeof value === 'string' ? value : resolveRuntimeCodenameText(value)).trim().toLowerCase()

const findRuntimeListComponent = (attrs: Array<{ codename: unknown; column_name: string; data_type: RuntimeDataType }>, field: string) => {
    const target = normalizeRuntimeListFieldKey(field)
    if (!target) return null

    return attrs.find((cmp) => cmp.column_name.toLowerCase() === target || normalizeRuntimeListFieldKey(cmp.codename) === target) ?? null
}

const buildRuntimeListSearchClause = (
    attrs: Array<{ column_name: string; data_type: RuntimeDataType }>,
    search: string | undefined,
    values: unknown[]
) => {
    const query = search?.trim()
    if (!query) return null

    const searchableAttrs = attrs.filter((cmp) => cmp.data_type !== 'TABLE' && cmp.data_type !== 'JSON')
    if (searchableAttrs.length === 0) return null

    values.push(`%${escapeLikeWildcards(query)}%`)
    const placeholder = `$${values.length}`
    return `(${searchableAttrs.map((cmp) => `${quoteIdentifier(cmp.column_name)}::text ILIKE ${placeholder} ESCAPE '\\'`).join(' OR ')})`
}

const normalizeRuntimeFilterValue = (cmp: { data_type: RuntimeDataType }, rawValue: unknown): unknown => {
    if (rawValue === null || rawValue === undefined) return rawValue

    if (cmp.data_type === 'NUMBER') {
        const numeric = typeof rawValue === 'number' ? rawValue : Number(rawValue)
        return Number.isFinite(numeric) ? numeric : undefined
    }

    if (cmp.data_type === 'BOOLEAN') {
        if (typeof rawValue === 'boolean') return rawValue
        if (typeof rawValue === 'string') {
            const normalized = rawValue.trim().toLowerCase()
            if (normalized === 'true') return true
            if (normalized === 'false') return false
        }
        return undefined
    }

    return rawValue
}

const buildRuntimeListFilterClause = (
    cmp: { column_name: string; data_type: RuntimeDataType },
    filter: RuntimeDatasourceFilter,
    values: unknown[]
) => {
    const columnSql = quoteIdentifier(cmp.column_name)

    if (filter.operator === 'isEmpty') {
        return `(${columnSql} IS NULL OR ${columnSql}::text = '')`
    }
    if (filter.operator === 'isNotEmpty') {
        return `(${columnSql} IS NOT NULL AND ${columnSql}::text <> '')`
    }

    const normalizedValue = normalizeRuntimeFilterValue(cmp, filter.value)
    if (normalizedValue === undefined || normalizedValue === null || normalizedValue === '') {
        return null
    }

    const addValue = (value: unknown) => {
        values.push(value)
        return `$${values.length}`
    }

    if (filter.operator === 'contains') {
        return `${columnSql}::text ILIKE ${addValue(`%${escapeLikeWildcards(String(normalizedValue))}%`)} ESCAPE '\\'`
    }
    if (filter.operator === 'startsWith') {
        return `${columnSql}::text ILIKE ${addValue(`${escapeLikeWildcards(String(normalizedValue))}%`)} ESCAPE '\\'`
    }
    if (filter.operator === 'endsWith') {
        return `${columnSql}::text ILIKE ${addValue(`%${escapeLikeWildcards(String(normalizedValue))}`)} ESCAPE '\\'`
    }

    const comparableOperators: Record<RuntimeDatasourceFilter['operator'], string | undefined> = {
        contains: undefined,
        equals: '=',
        startsWith: undefined,
        endsWith: undefined,
        isEmpty: undefined,
        isNotEmpty: undefined,
        greaterThan: '>',
        greaterThanOrEqual: '>=',
        lessThan: '<',
        lessThanOrEqual: '<='
    }

    const sqlOperator = comparableOperators[filter.operator]
    if (!sqlOperator) return null

    return `${columnSql} ${sqlOperator} ${addValue(normalizedValue)}`
}

const buildRuntimeListClauses = (params: {
    activeCondition: string
    attrs: Array<{ codename: unknown; column_name: string; data_type: RuntimeDataType }>
    search?: string
    sort?: RuntimeDatasourceSort[]
    filters?: RuntimeDatasourceFilter[]
    fallbackOrderBy: string
}) => {
    const values: unknown[] = []
    const whereClauses = [params.activeCondition]
    const searchClause = buildRuntimeListSearchClause(params.attrs, params.search, values)
    if (searchClause) {
        whereClauses.push(searchClause)
    }

    for (const filter of params.filters ?? []) {
        const cmp = findRuntimeListComponent(params.attrs, filter.field)
        if (!cmp || cmp.data_type === 'TABLE' || cmp.data_type === 'JSON') {
            continue
        }
        const filterClause = buildRuntimeListFilterClause(cmp, filter, values)
        if (filterClause) {
            whereClauses.push(filterClause)
        }
    }

    const orderClauses: string[] = []
    for (const sort of params.sort ?? []) {
        const cmp = findRuntimeListComponent(params.attrs, sort.field)
        if (!cmp || cmp.data_type === 'TABLE' || cmp.data_type === 'JSON') {
            continue
        }
        orderClauses.push(`${quoteIdentifier(cmp.column_name)} ${sort.direction.toUpperCase()} NULLS LAST`)
    }
    orderClauses.push(params.fallbackOrderBy)

    return {
        whereSql: whereClauses.join(' AND '),
        orderBySql: orderClauses.join(', '),
        values
    }
}

const findUnsupportedRuntimeListFields = (
    attrs: Array<{ codename: unknown; column_name: string; data_type: RuntimeDataType }>,
    sort?: RuntimeDatasourceSort[],
    filters?: RuntimeDatasourceFilter[]
) => {
    const unsupported = new Set<string>()
    const isSupported = (field: string) => {
        const cmp = findRuntimeListComponent(attrs, field)
        return Boolean(cmp && cmp.data_type !== 'TABLE' && cmp.data_type !== 'JSON')
    }

    for (const sortItem of sort ?? []) {
        if (!isSupported(sortItem.field)) {
            unsupported.add(sortItem.field)
        }
    }
    for (const filterItem of filters ?? []) {
        if (!isSupported(filterItem.field)) {
            unsupported.add(filterItem.field)
        }
    }

    return Array.from(unsupported)
}

const runtimeSystemTableExists = async (manager: DbExecutor, schemaName: string, tableName: string) => {
    const [row] = (await manager.query(
        `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = $2
      ) AS exists
    `,
        [schemaName, tableName]
    )) as Array<{ exists: boolean }>

    return row?.exists === true
}

const loadRuntimeSelectedLayout = async (params: {
    manager: DbExecutor
    schemaName: string
    schemaIdent: string
    scopeEntityId: string
}) => {
    const { manager, schemaName, schemaIdent, scopeEntityId } = params
    const layoutsExist = await runtimeSystemTableExists(manager, schemaName, '_app_layouts')
    if (!layoutsExist) {
        return { layoutId: null, layoutConfig: {} as Record<string, unknown> }
    }

    const rows = (await manager.query(
        `
      SELECT id, config
      FROM ${schemaIdent}._app_layouts
      WHERE (scope_entity_id = $1 OR scope_entity_id IS NULL)
        AND is_active = true
        AND _upl_deleted = false
        AND _app_deleted = false
      ORDER BY CASE WHEN scope_entity_id = $1 THEN 0 ELSE 1 END,
               is_default DESC,
               is_active DESC,
               sort_order ASC,
               _upl_created_at ASC
      LIMIT 1
    `,
        [scopeEntityId]
    )) as Array<{ id: string; config: Record<string, unknown> | null }>

    return {
        layoutId: rows[0]?.id ?? null,
        layoutConfig: rows[0]?.config ?? {}
    }
}

export const resolvePreferredScopeEntityIdFromGlobalMenu = async (params: {
    manager: DbExecutor
    schemaName: string
    schemaIdent: string
}) => {
    const { manager, schemaName, schemaIdent } = params

    const resolveScopeEntityByToken = async (token: string): Promise<string | null> => {
        const normalized = token.trim()
        if (!normalized) return null

        const rows = (await manager.query(
            `
        SELECT id
        FROM ${schemaIdent}._app_objects
        WHERE _upl_deleted = false
          AND _app_deleted = false
          AND ${RUNTIME_LAYOUT_CAPABLE_FILTER_SQL}
          AND (id::text = $1 OR ${runtimeCodenameTextSql('codename')} = $1)
        ORDER BY CASE
                   WHEN id::text = $1 THEN 0
                   WHEN ${runtimeCodenameTextSql('codename')} = $1 THEN 1
                   ELSE 2
                 END,
                 ${runtimeCodenameTextSql('codename')} ASC,
                 id ASC
        LIMIT 1
      `,
            [normalized]
        )) as Array<{ id: string }>

        return rows[0]?.id ?? null
    }

    const resolveStartPageTokenFromMenuConfig = (config: Record<string, unknown>): string | null => {
        const startPage = typeof config.startPage === 'string' ? config.startPage.trim() : ''
        if (!startPage) return null

        const items = Array.isArray(config.items) ? config.items : []
        const matchedItem = items
            .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : null))
            .find((item) => item?.id === startPage)

        if (matchedItem) {
            for (const key of ['sectionId', 'objectCollectionId']) {
                const value = matchedItem[key]
                if (typeof value === 'string' && value.trim()) {
                    return value.trim()
                }
            }
        }

        return startPage
    }

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

        if (!layoutsExists || !widgetsExists) {
            return null
        }

        const defaultLayoutRows = (await manager.query(
            `
        SELECT id
        FROM ${schemaIdent}._app_layouts
        WHERE scope_entity_id IS NULL
          AND is_active = true
          AND _upl_deleted = false
          AND _app_deleted = false
        ORDER BY is_default DESC,
                 is_active DESC,
                 sort_order ASC,
                 _upl_created_at ASC
        LIMIT 1
      `
        )) as Array<{ id: string }>
        const activeLayoutId = defaultLayoutRows[0]?.id

        if (!activeLayoutId) {
            return null
        }

        const menuWidgets = (await manager.query(
            `
        SELECT config
        FROM ${schemaIdent}._app_widgets
        WHERE layout_id = $1
          AND zone = 'left'
          AND widget_key = 'menuWidget'
          AND is_active = true
          AND _upl_deleted = false
          AND _app_deleted = false
        ORDER BY sort_order ASC, _upl_created_at ASC
      `,
            [activeLayoutId]
        )) as Array<{ config?: unknown }>

        const menuConfigs = menuWidgets
            .map((row) => (row.config && typeof row.config === 'object' ? (row.config as Record<string, unknown>) : null))
            .filter((cfg): cfg is Record<string, unknown> => Boolean(cfg))

        for (const cfg of menuConfigs) {
            const startPageToken = resolveStartPageTokenFromMenuConfig(cfg)
            if (!startPageToken) continue

            const scopeEntityId = await resolveScopeEntityByToken(startPageToken)
            if (scopeEntityId) {
                return scopeEntityId
            }
        }

        const boundMenuConfig = menuConfigs.find((cfg) => Boolean(cfg.bindToHub) && typeof cfg.boundHubId === 'string')

        const boundTreeEntityId = typeof boundMenuConfig?.boundHubId === 'string' ? boundMenuConfig.boundHubId : null
        if (!boundTreeEntityId) {
            return null
        }

        const preferredObjectCollectionRows = (await manager.query(
            `
        SELECT id
        FROM ${schemaIdent}._app_objects
        WHERE ${RUNTIME_OBJECT_FILTER_SQL}
          AND _upl_deleted = false
          AND _app_deleted = false
          AND config->'hubs' @> $1::jsonb
        ORDER BY COALESCE((config->>'sortOrder')::int, 0) ASC, codename ASC
        LIMIT 1
      `,
            [JSON.stringify([boundTreeEntityId])]
        )) as Array<{ id: string }>

        return preferredObjectCollectionRows[0]?.id ?? null
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[ApplicationsRuntime] Failed to resolve preferred startup section from menu binding (ignored)', e)
        return null
    }
}

const resolveEffectiveObjectCollectionRuntimeConfig = async (params: {
    manager: DbExecutor
    schemaName: string
    schemaIdent: string
    objectCollectionId: string
}) => {
    const selectedLayout = await loadRuntimeSelectedLayout({
        manager: params.manager,
        schemaName: params.schemaName,
        schemaIdent: params.schemaIdent,
        scopeEntityId: params.objectCollectionId
    })

    return {
        selectedLayout,
        runtimeConfig: resolveObjectCollectionLayoutBehaviorConfig({
            layoutConfig: selectedLayout.layoutConfig
        })
    }
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

const loadRuntimeRowById = async (manager: DbExecutor, dataTableIdent: string, rowId: string, runtimeRowCondition = 'TRUE') => {
    const rows = (await manager.query(
        `
      SELECT *
      FROM ${dataTableIdent}
      WHERE id = $1
        AND ${runtimeRowCondition}
      LIMIT 1
    `,
        [rowId]
    )) as Array<Record<string, unknown>>

    return rows[0] ?? null
}

const collectTouchedComponentIds = (
    attrs: Array<{ id: string; codename: unknown; column_name: string }>,
    payload: Record<string, unknown>
) => {
    const touched = new Set<string>()

    for (const cmp of attrs) {
        const { hasUserValue } = getRuntimeInputValue(payload, cmp.column_name, cmp.codename)
        if (hasUserValue) {
            touched.add(cmp.id)
        }
    }

    return [...touched]
}

const dispatchRuntimeLifecycle = async (params: {
    manager: DbExecutor
    applicationId: string
    schemaName: string
    objectCollection: { id: string; codename: unknown }
    currentWorkspaceId?: string | null
    currentUserId?: string | null
    permissions?: Record<RolePermission, boolean>
    componentIds?: string[]
    payload: {
        eventName:
            | 'beforeCreate'
            | 'afterCreate'
            | 'beforeUpdate'
            | 'afterUpdate'
            | 'beforeDelete'
            | 'afterDelete'
            | 'beforeCopy'
            | 'afterCopy'
            | 'beforePost'
            | 'afterPost'
            | 'beforeUnpost'
            | 'afterUnpost'
            | 'beforeVoid'
            | 'afterVoid'
        row?: Record<string, unknown> | null
        previousRow?: Record<string, unknown> | null
        patch?: Record<string, unknown> | null
        metadata?: Record<string, unknown>
    }
}): Promise<unknown[]> => {
    const scriptsService = new RuntimeScriptsService()

    return scriptsService.dispatchLifecycleEvent({
        executor: params.manager,
        applicationId: params.applicationId,
        schemaName: params.schemaName,
        attachmentKind: 'object',
        attachmentId: params.objectCollection.id,
        entityCodename: resolveRuntimeCodenameText(params.objectCollection.codename),
        currentWorkspaceId: params.currentWorkspaceId ?? null,
        currentUserId: params.currentUserId ?? null,
        permissions: params.permissions ?? null,
        componentIds: params.componentIds,
        payload: params.payload
    })
}

type RuntimeLifecycleDispatchRequest = Omit<Parameters<typeof dispatchRuntimeLifecycle>[0], 'manager'>
type RuntimePostingMovementWriteResult = {
    postingMovements: Array<{ ledgerCodename: string; facts: Array<{ id: string; idempotent?: boolean }> }>
    postingReversals: Array<{ ledgerCodename: string; facts: Array<{ id: string }> }>
}

const dispatchRuntimeLifecycleAfterCommit = (manager: DbExecutor, request: RuntimeLifecycleDispatchRequest | null) => {
    if (!request) return

    void dispatchRuntimeLifecycle({
        manager,
        ...request
    }).catch((error) => {
        console.error(`[runtimeRowsController] ${request.payload.eventName} lifecycle hook failed`, error)
    })
}

// ---------------------------------------------------------------------------
// Controller factory
// ---------------------------------------------------------------------------

export function createRuntimeRowsController(getDbExecutor: () => DbExecutor) {
    const query = createQueryHelper(getDbExecutor)
    const recordCommandService = new RuntimeRecordCommandService()
    const postingMovementService = new RuntimePostingMovementService()

    const resolveRecordCommandEventPrefix = (command: 'post' | 'unpost' | 'void'): 'Post' | 'Unpost' | 'Void' => {
        if (command === 'post') return 'Post'
        if (command === 'unpost') return 'Unpost'
        return 'Void'
    }

    const runPostingMovementWrites = async (params: {
        command: 'post' | 'unpost' | 'void'
        executor: DbExecutor
        schemaName: string
        registrarKind: string
        behavior: ReturnType<typeof normalizeRuntimeRecordBehavior>
        currentWorkspaceId: string | null
        currentUserId: string
        beforeLifecycleResults: unknown[]
        storedMovements: unknown
    }): Promise<RuntimePostingMovementWriteResult> => {
        if (params.command === 'post') {
            return {
                postingMovements: await postingMovementService.appendMovements({
                    executor: params.executor,
                    schemaName: params.schemaName,
                    registrarKind: params.registrarKind,
                    behavior: params.behavior,
                    currentWorkspaceId: params.currentWorkspaceId,
                    currentUserId: params.currentUserId,
                    results: params.beforeLifecycleResults
                }),
                postingReversals: []
            }
        }

        return {
            postingMovements: [],
            postingReversals: await postingMovementService.reversePostedMovements({
                executor: params.executor,
                schemaName: params.schemaName,
                registrarKind: params.registrarKind,
                currentWorkspaceId: params.currentWorkspaceId,
                currentUserId: params.currentUserId,
                storedMovements: params.storedMovements
            })
        }
    }

    const buildRecordCommandResponse = (
        command: 'post' | 'unpost' | 'void',
        row: Record<string, unknown>,
        movementResult: RuntimePostingMovementWriteResult
    ): Record<string, unknown> => ({
        id: String(row.id),
        status: command === 'post' ? 'posted' : command === 'unpost' ? 'unposted' : 'voided',
        recordState: row._app_record_state ?? null,
        recordNumber: row._app_record_number ?? null,
        postedAt: row._app_posted_at ?? null,
        postingBatchId: row._app_posting_batch_id ?? null,
        postingMovements: movementResult.postingMovements,
        postingReversals: movementResult.postingReversals
    })

    // ============ GET RUNTIME TABLE ============
    const getRuntime = async (req: Request, res: Response) => {
        const { applicationId } = req.params

        const parsedQuery = runtimeQuerySchema.safeParse(req.query)
        if (!parsedQuery.success) {
            return res.status(400).json({ error: 'Invalid query', details: parsedQuery.error.flatten() })
        }

        const { limit, offset, locale, search, sort, filters } = parsedQuery.data
        const requestedLocale = normalizeLocale(locale)
        const requestedObjectCollectionId = parsedQuery.data.objectCollectionId ?? null
        const runtimeContext = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!runtimeContext) return

        const { schemaName, schemaIdent } = runtimeContext
        const manager = runtimeContext.manager
        const currentWorkspaceId = runtimeContext.currentWorkspaceId

        const objectCollections = await manager.query(
            `
        SELECT id, kind, codename, table_name, presentation, config
        FROM ${schemaIdent}._app_objects
        WHERE (${RUNTIME_OBJECT_FILTER_SQL} OR ${runtimeStandardKindSql('kind')} = 'page')
          AND _upl_deleted = false
          AND _app_deleted = false
        ORDER BY ${runtimeCodenameTextSql('codename')} ASC, id ASC
      `
        )

        if (objectCollections.length === 0) {
            return res.status(404).json({ error: 'No objectCollections available in application runtime schema' })
        }

        const typedObjects = objectCollections as Array<{
            id: string
            kind: string
            codename: unknown
            table_name: string | null
            presentation?: unknown
            config?: Record<string, unknown> | null
        }>

        const runtimeObjects = typedObjects.map((objectRow) => ({
            ...objectRow,
            lifecycleContract: resolveApplicationLifecycleContractFromConfig(objectRow.config)
        }))

        const preferredObjectCollectionIdFromMenu = requestedObjectCollectionId
            ? null
            : await resolvePreferredScopeEntityIdFromGlobalMenu({
                  manager,
                  schemaName,
                  schemaIdent
              })

        const activeObjectCollection =
            (requestedObjectCollectionId ? runtimeObjects.find((objectRow) => objectRow.id === requestedObjectCollectionId) : undefined) ??
            (preferredObjectCollectionIdFromMenu
                ? runtimeObjects.find((objectRow) => objectRow.id === preferredObjectCollectionIdFromMenu)
                : undefined) ??
            runtimeObjects[0]
        if (!activeObjectCollection) {
            return res.status(404).json({
                error: 'Requested object not found in runtime schema',
                details: { objectCollectionId: requestedObjectCollectionId }
            })
        }

        const activeObjectCollectionKind = resolveRuntimeStandardKind(activeObjectCollection.kind)
        const isActivePage = activeObjectCollectionKind === 'page'
        if (!isActivePage && !IDENTIFIER_REGEX.test(activeObjectCollection.table_name ?? '')) {
            return res.status(400).json({ error: 'Invalid runtime table name' })
        }
        const activeRecordBehavior = normalizeRuntimeRecordBehavior(activeObjectCollection.config)
        const activeRecordBehaviorEnabled = !isActivePage && isRuntimeRecordBehaviorEnabled(activeRecordBehavior)
        const activeWorkflowActions = isActivePage ? [] : readConfiguredWorkflowActions(activeObjectCollection.config)
        const includeRuntimeRowVersion = activeWorkflowActions.length > 0

        const components = isActivePage
            ? []
            : ((await manager.query(
                  `
        SELECT id, codename, column_name, data_type, is_required, is_display_component,
               presentation, validation_rules, sort_order, ui_config,
               target_object_id, target_object_kind
        FROM ${schemaIdent}._app_components
        WHERE object_id = $1
          AND data_type IN ('BOOLEAN', 'STRING', 'NUMBER', 'DATE', 'REF', 'JSON', 'TABLE')
          AND parent_component_id IS NULL
          AND _upl_deleted = false
          AND _app_deleted = false
        ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST, codename ASC
      `,
                  [activeObjectCollection.id]
              )) as Array<{
                  id: string
                  codename: string
                  column_name: string
                  data_type: RuntimeDataType
                  is_required: boolean
                  is_display_component?: boolean
                  presentation?: unknown
                  validation_rules?: Record<string, unknown>
                  sort_order?: number
                  ui_config?: Record<string, unknown>
                  target_object_id?: string | null
                  target_object_kind?: string | null
              }>)

        const safeComponents = components.filter((cmp) => IDENTIFIER_REGEX.test(cmp.column_name))

        // Separate physical (non-TABLE) components from virtual TABLE components
        const physicalComponents = safeComponents.filter((a) => a.data_type !== 'TABLE')

        // Fetch child components for TABLE-type components
        const tableAttrs = safeComponents.filter((a) => a.data_type === 'TABLE')
        const childAttrsByTableId = new Map<string, typeof components>()
        if (tableAttrs.length > 0) {
            const tableAttrIds = tableAttrs.map((a) => a.id)
            const childAttrs = (await manager.query(
                `
          SELECT id, codename, column_name, data_type, is_required, is_display_component,
                 presentation, validation_rules, sort_order, ui_config,
                 target_object_id, target_object_kind, parent_component_id
          FROM ${schemaIdent}._app_components
          WHERE parent_component_id = ANY($1::uuid[])
            AND _upl_deleted = false
            AND _app_deleted = false
          ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST, codename ASC
        `,
                [tableAttrIds]
            )) as Array<(typeof components)[number] & { parent_component_id: string }>

            for (const child of childAttrs) {
                const list = childAttrsByTableId.get(child.parent_component_id) ?? []
                list.push(child)
                childAttrsByTableId.set(child.parent_component_id, list)
            }
        }

        // Collect all child components (across all TABLE components) for REF target resolution
        const allChildComponents = Array.from(childAttrsByTableId.values()).flat()

        const enumTargetObjectIds = Array.from(
            new Set([
                ...safeComponents
                    .filter((cmp) => cmp.data_type === 'REF' && isRuntimeEnumerationKind(cmp.target_object_kind) && cmp.target_object_id)
                    .map((cmp) => String(cmp.target_object_id)),
                ...allChildComponents
                    .filter((cmp) => cmp.data_type === 'REF' && isRuntimeEnumerationKind(cmp.target_object_kind) && cmp.target_object_id)
                    .map((cmp) => String(cmp.target_object_id))
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
                    label: resolvePresentationName(row.presentation, requestedLocale, resolveRuntimeCodenameText(row.codename)),
                    isDefault: row.is_default === true,
                    sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0
                })
                enumOptionsMap.set(row.object_id, list)
            }
        }

        const objectTargetObjectIds = Array.from(
            new Set([
                ...safeComponents
                    .filter((cmp) => cmp.data_type === 'REF' && isRuntimeObjectTargetKind(cmp.target_object_kind) && cmp.target_object_id)
                    .map((cmp) => String(cmp.target_object_id)),
                ...allChildComponents
                    .filter((cmp) => cmp.data_type === 'REF' && isRuntimeObjectTargetKind(cmp.target_object_kind) && cmp.target_object_id)
                    .map((cmp) => String(cmp.target_object_id))
            ])
        )

        const objectRefOptionsMap = new Map<string, RuntimeRefOption[]>()
        if (objectTargetObjectIds.length > 0) {
            const targetObjects = (await manager.query(
                `
          SELECT id, codename, table_name, config
          FROM ${schemaIdent}._app_objects
          WHERE id = ANY($1::uuid[])
            AND ${RUNTIME_OBJECT_FILTER_SQL}
            AND _upl_deleted = false
            AND _app_deleted = false
        `,
                [objectTargetObjectIds]
            )) as Array<{
                id: string
                codename: unknown
                table_name: string
                config?: Record<string, unknown> | null
            }>

            const targetObjectAttrs = (await manager.query(
                `
          SELECT object_id, column_name, codename, data_type, is_display_component, sort_order
          FROM ${schemaIdent}._app_components
          WHERE object_id = ANY($1::uuid[])
            AND parent_component_id IS NULL
            AND _upl_deleted = false
            AND _app_deleted = false
          ORDER BY object_id ASC, is_display_component DESC, sort_order ASC, codename ASC
        `,
                [objectTargetObjectIds]
            )) as Array<{
                object_id: string
                column_name: string
                codename: unknown
                data_type: RuntimeDataType
                is_display_component: boolean
                sort_order?: number
            }>

            const attrsByObjectCollectionId = new Map<string, typeof targetObjectAttrs>()
            for (const row of targetObjectAttrs) {
                const list = attrsByObjectCollectionId.get(row.object_id) ?? []
                list.push(row)
                attrsByObjectCollectionId.set(row.object_id, list)
            }

            for (const targetObject of targetObjects) {
                if (!IDENTIFIER_REGEX.test(targetObject.table_name)) {
                    continue
                }

                const targetObjectActiveRowCondition = buildRuntimeActiveRowCondition(
                    resolveApplicationLifecycleContractFromConfig(targetObject.config),
                    targetObject.config,
                    undefined,
                    currentWorkspaceId
                )

                const targetAttrs = attrsByObjectCollectionId.get(targetObject.id) ?? []
                const preferredDisplayAttr =
                    targetAttrs.find((cmp) => cmp.is_display_component) ??
                    targetAttrs.find((cmp) => cmp.data_type === 'STRING') ??
                    targetAttrs[0]

                const selectLabelSql =
                    preferredDisplayAttr && IDENTIFIER_REGEX.test(preferredDisplayAttr.column_name)
                        ? `${quoteIdentifier(preferredDisplayAttr.column_name)} AS label_value`
                        : 'NULL AS label_value'

                const targetRows = (await manager.query(
                    `
            SELECT id, ${selectLabelSql}
            FROM ${schemaIdent}.${quoteIdentifier(targetObject.table_name)}
            WHERE ${targetObjectActiveRowCondition}
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
                        preferredDisplayAttr?.data_type === 'STRING' ? resolveRuntimeValue(rawLabel, 'STRING', requestedLocale) : rawLabel
                    const label = typeof localizedLabel === 'string' && localizedLabel.trim().length > 0 ? localizedLabel : String(row.id)

                    return {
                        id: row.id,
                        label,
                        codename: targetObject.codename,
                        isDefault: false,
                        sortOrder: index
                    }
                })

                objectRefOptionsMap.set(targetObject.id, options)
            }
        }

        const { selectedLayout, runtimeConfig: activeObjectCollectionRuntimeConfig } = await resolveEffectiveObjectCollectionRuntimeConfig({
            manager,
            schemaName,
            schemaIdent,
            objectCollectionId: activeObjectCollection.id
        })
        const reorderFieldAttr = resolveRuntimeReorderField(
            safeComponents,
            activeObjectCollectionRuntimeConfig.enableRowReordering ? activeObjectCollectionRuntimeConfig.reorderPersistenceField : null
        )

        let total = 0
        let rows: Array<Record<string, unknown> & { id: string }> = []
        let canPersistRowReordering = false

        if (!isActivePage) {
            const tableName = activeObjectCollection.table_name as string
            const dataTableIdent = `${schemaIdent}.${quoteIdentifier(tableName)}`
            const activeObjectRowCondition = buildRuntimeActiveRowCondition(
                activeObjectCollection.lifecycleContract,
                activeObjectCollection.config,
                undefined,
                currentWorkspaceId
            )
            const unsupportedListFields = findUnsupportedRuntimeListFields(physicalComponents, sort, filters)
            if (unsupportedListFields.length > 0) {
                return res.status(400).json({
                    error: 'Runtime list query references unknown or unsupported fields',
                    fields: unsupportedListFields
                })
            }
            const runtimeListClauses = buildRuntimeListClauses({
                activeCondition: activeObjectRowCondition,
                attrs: physicalComponents,
                search,
                sort,
                filters,
                fallbackOrderBy: buildRuntimeRowsOrderBy(reorderFieldAttr?.column_name ?? null)
            })
            // Use physicalComponents for SQL because TABLE attrs have no physical column in the parent table.
            const selectColumns = [
                'id',
                ...(activeRecordBehaviorEnabled ? RUNTIME_RECORD_SYSTEM_FIELDS.map((field) => quoteIdentifier(field)) : []),
                ...(includeRuntimeRowVersion ? [quoteIdentifier('_upl_version')] : []),
                ...physicalComponents.map((cmp) => quoteIdentifier(cmp.column_name))
            ]

            for (const tAttr of tableAttrs) {
                const fallbackTabTableName = generateChildTableName(tAttr.id)
                const tabTableName =
                    typeof tAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tAttr.column_name)
                        ? tAttr.column_name
                        : fallbackTabTableName
                if (!IDENTIFIER_REGEX.test(tabTableName)) continue
                const tabTableIdent = `${schemaIdent}.${quoteIdentifier(tabTableName)}`
                selectColumns.push(
                    `(SELECT COUNT(*)::int FROM ${tabTableIdent} WHERE _tp_parent_id = ${dataTableIdent}.id AND ${activeObjectRowCondition}) AS ${quoteIdentifier(
                        tAttr.column_name
                    )}`
                )
            }

            const totalRows = (await manager.query(
                `
        SELECT COUNT(*)::int AS total
        FROM ${dataTableIdent}
        WHERE ${runtimeListClauses.whereSql}
      `,
                runtimeListClauses.values
            )) as Array<{ total: number }>
            total = typeof totalRows[0]?.total === 'number' ? totalRows[0].total : Number(totalRows[0]?.total) || 0

            const pageValues = [...runtimeListClauses.values, limit, offset]
            const rawRows = (await manager.query(
                `
        SELECT ${selectColumns.join(', ')}
        FROM ${dataTableIdent}
        WHERE ${runtimeListClauses.whereSql}
        ORDER BY ${runtimeListClauses.orderBySql}
        LIMIT $${runtimeListClauses.values.length + 1} OFFSET $${runtimeListClauses.values.length + 2}
      `,
                pageValues
            )) as Array<Record<string, unknown>>

            const hasRuntimeListModifiers = Boolean(search?.trim() || sort?.length || filters?.length)
            canPersistRowReordering =
                activeObjectCollectionRuntimeConfig.enableRowReordering &&
                Boolean(reorderFieldAttr) &&
                offset === 0 &&
                total <= limit &&
                !hasRuntimeListModifiers

            rows = rawRows.map((row) => {
                const mappedRow: Record<string, unknown> & { id: string } = {
                    id: String(row.id)
                }

                if (activeRecordBehaviorEnabled) {
                    for (const field of RUNTIME_RECORD_SYSTEM_FIELDS) {
                        mappedRow[field] = row[field] ?? null
                    }
                }
                if (includeRuntimeRowVersion) {
                    mappedRow._upl_version = row._upl_version ?? null
                }

                for (const component of safeComponents) {
                    if (component.data_type === 'TABLE') {
                        mappedRow[component.column_name] = typeof row[component.column_name] === 'number' ? row[component.column_name] : 0
                        continue
                    }
                    mappedRow[component.column_name] = resolveRuntimeValue(row[component.column_name], component.data_type, requestedLocale)
                }

                return mappedRow
            })
        }

        let workspaceLimit: { maxRows: number | null; currentRows: number; canCreate: boolean } | undefined
        if (!isActivePage && runtimeContext.workspacesEnabled && currentWorkspaceId) {
            const maxRows = await getObjectWorkspaceLimit(manager, {
                schemaName,
                objectId: activeObjectCollection.id
            })
            const currentRows = await getObjectWorkspaceUsage(manager, {
                schemaName,
                tableName: activeObjectCollection.table_name as string,
                workspaceId: currentWorkspaceId,
                runtimeRowCondition: buildRuntimeActiveRowCondition(
                    activeObjectCollection.lifecycleContract,
                    activeObjectCollection.config,
                    undefined,
                    currentWorkspaceId
                )
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
            const layoutsExists = await runtimeSystemTableExists(manager, schemaName, '_app_layouts')

            if (layoutsExists) {
                layoutConfig = selectedLayout.layoutConfig
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
            console.warn('[ApplicationsRuntime] Failed to load layout config (ignored)', e)
        }

        layoutConfig = resolveObjectCollectionRuntimeDashboardLayoutConfig({ layoutConfig })
        layoutConfig = {
            ...layoutConfig,
            enableRowReordering: canPersistRowReordering
        }

        const objectCollectionsForRuntime = runtimeObjects.map((objectRow) => ({
            id: objectRow.id,
            kind: resolveRuntimeStandardKind(objectRow.kind) ?? 'object',
            codename: resolveRuntimeCodenameText(objectRow.codename),
            tableName: objectRow.table_name,
            runtimeConfig:
                objectRow.id === activeObjectCollection.id
                    ? activeObjectCollectionRuntimeConfig
                    : normalizeObjectCollectionRuntimeViewConfig(undefined),
            recordBehavior:
                resolveRuntimeStandardKind(objectRow.kind) === 'page' ? undefined : normalizeRuntimeRecordBehavior(objectRow.config),
            workflowActions: resolveRuntimeStandardKind(objectRow.kind) === 'page' ? [] : readConfiguredWorkflowActions(objectRow.config),
            name: resolvePresentationName(objectRow.presentation, requestedLocale, resolveRuntimeCodenameText(objectRow.codename))
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

            if (zoneWidgetsExists && selectedLayout.layoutId) {
                const widgetRows = (await manager.query(
                    `
              SELECT id, widget_key, sort_order, config, zone
              FROM ${schemaIdent}._app_widgets
              WHERE layout_id = $1
                AND zone IN ('left', 'right', 'center')
                AND is_active = true
                AND _upl_deleted = false
                AND _app_deleted = false
              ORDER BY sort_order ASC, _upl_created_at ASC
            `,
                    [selectedLayout.layoutId]
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
                        sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
                        config: row.config && typeof row.config === 'object' ? row.config : {}
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
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('[ApplicationsRuntime] Failed to load zone widgets (ignored)', e)
        }

        // Build menus from menuWidget config stored in zone widgets.
        type RuntimeMenuItem = {
            id: string
            kind: string
            title: string
            icon: string | null
            href: string | null
            objectCollectionId: string | null
            sectionId: string | null
            treeEntityId: string | null
            sortOrder: number
            isActive: boolean
        }

        type RuntimeWorkspacePlacement = 'primary' | 'overflow' | 'hidden'

        type RuntimeMenuEntry = {
            id: string
            widgetId: string
            showTitle: boolean
            title: string
            autoShowAllSections: boolean
            startPage: string | null
            startSectionId: string | null
            maxPrimaryItems: number | null
            overflowLabelKey: string | null
            workspacePlacement: RuntimeWorkspacePlacement
            items: RuntimeMenuItem[]
            overflowItems: RuntimeMenuItem[]
        }

        type RuntimeTreeEntityMeta = {
            id: string
            codename: unknown
            title: string
            parentTreeEntityId: string | null
            sortOrder: number
        }

        type RuntimeObjectCollectionMeta = {
            id: string
            codename: unknown
            title: string
            sortOrder: number
            treeEntityIds: string[]
        }

        let treeEntityMetaById = new Map<string, RuntimeTreeEntityMeta>()
        let treeEntityMetaByCodename = new Map<string, RuntimeTreeEntityMeta>()
        let objectCollectionMetaByCodename = new Map<string, RuntimeObjectCollectionMeta>()
        let childTreeEntityIdsByParent = new Map<string, string[]>()
        let objectCollectionsByTreeEntity = new Map<string, RuntimeObjectCollectionMeta[]>()

        try {
            const objectRows = (await manager.query(
                `
          SELECT id, kind, codename, presentation, config
          FROM ${schemaIdent}._app_objects
                    WHERE (${runtimeStandardKindSql('kind')} = 'hub' OR ${RUNTIME_OBJECT_FILTER_SQL} OR ${runtimeStandardKindSql(
                    'kind'
                )} = 'page')
            AND _upl_deleted = false
            AND _app_deleted = false
        `
            )) as Array<{
                id: string
                kind: string
                codename: unknown
                presentation?: unknown
                config?: unknown
            }>

            for (const row of objectRows) {
                const config = row.config && typeof row.config === 'object' ? (row.config as Record<string, unknown>) : {}
                const rawSortOrder = config.sortOrder
                const sortOrder = typeof rawSortOrder === 'number' ? rawSortOrder : 0
                const title = resolvePresentationName(row.presentation, requestedLocale, resolveRuntimeCodenameText(row.codename))

                if (isRuntimeHubKind(row.kind)) {
                    const parentTreeEntityId = typeof config.parentHubId === 'string' ? config.parentHubId : null
                    const treeEntityMeta: RuntimeTreeEntityMeta = {
                        id: row.id,
                        codename: row.codename,
                        title,
                        parentTreeEntityId,
                        sortOrder
                    }
                    treeEntityMetaById.set(row.id, treeEntityMeta)
                    treeEntityMetaByCodename.set(resolveRuntimeCodenameText(row.codename), treeEntityMeta)
                    continue
                }

                const treeEntityIds = Array.isArray(config.hubs)
                    ? config.hubs.filter((value): value is string => typeof value === 'string')
                    : []
                const objectCollectionMeta: RuntimeObjectCollectionMeta = {
                    id: row.id,
                    codename: row.codename,
                    title,
                    sortOrder,
                    treeEntityIds
                }
                objectCollectionMetaByCodename.set(resolveRuntimeCodenameText(row.codename), objectCollectionMeta)
                for (const treeEntityId of treeEntityIds) {
                    const list = objectCollectionsByTreeEntity.get(treeEntityId) ?? []
                    list.push(objectCollectionMeta)
                    objectCollectionsByTreeEntity.set(treeEntityId, list)
                }
            }

            const treeEntitySortComparator = (a: RuntimeTreeEntityMeta, b: RuntimeTreeEntityMeta) => {
                if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
                return resolveRuntimeCodenameText(a.codename).localeCompare(resolveRuntimeCodenameText(b.codename))
            }
            const objectCollectionSortComparator = (a: RuntimeObjectCollectionMeta, b: RuntimeObjectCollectionMeta) => {
                if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
                return resolveRuntimeCodenameText(a.codename).localeCompare(resolveRuntimeCodenameText(b.codename))
            }

            const treeEntities = Array.from(treeEntityMetaById.values()).sort(treeEntitySortComparator)
            childTreeEntityIdsByParent = new Map<string, string[]>()
            for (const treeEntity of treeEntities) {
                if (!treeEntity.parentTreeEntityId) continue
                const childIds = childTreeEntityIdsByParent.get(treeEntity.parentTreeEntityId) ?? []
                childIds.push(treeEntity.id)
                childTreeEntityIdsByParent.set(treeEntity.parentTreeEntityId, childIds)
            }

            for (const [treeEntityId, treeEntityObjectCollections] of objectCollectionsByTreeEntity.entries()) {
                objectCollectionsByTreeEntity.set(treeEntityId, [...treeEntityObjectCollections].sort(objectCollectionSortComparator))
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('[ApplicationsRuntime] Failed to build hub/object runtime map for menuWidget (ignored)', e)
            treeEntityMetaById = new Map()
            treeEntityMetaByCodename = new Map()
            objectCollectionMetaByCodename = new Map()
            childTreeEntityIdsByParent = new Map()
            objectCollectionsByTreeEntity = new Map()
        }

        const resolveObjectCollectionId = (value: unknown): string | null => {
            if (typeof value !== 'string' || value.trim().length === 0) return null
            const normalized = value.trim()
            if (objectCollectionsForRuntime.some((section) => section.id === normalized)) return normalized
            return objectCollectionMetaByCodename.get(normalized)?.id ?? null
        }

        const resolveTreeEntityId = (value: unknown): string | null => {
            if (typeof value !== 'string' || value.trim().length === 0) return null
            const normalized = value.trim()
            if (treeEntityMetaById.has(normalized)) return normalized
            return treeEntityMetaByCodename.get(normalized)?.id ?? null
        }

        const resolveStartSectionId = (value: unknown, items: RuntimeMenuItem[]): string | null => {
            if (typeof value !== 'string' || value.trim().length === 0) return null
            const normalized = value.trim()
            const explicitItem = items.find((item) => item.id === normalized)
            if (explicitItem?.sectionId || explicitItem?.objectCollectionId) {
                return explicitItem.sectionId ?? explicitItem.objectCollectionId
            }
            const treeEntityId = resolveTreeEntityId(normalized)
            if (treeEntityId) {
                return (
                    items.find((item) => item.treeEntityId === treeEntityId && (item.sectionId || item.objectCollectionId))?.sectionId ??
                    null
                )
            }
            return resolveObjectCollectionId(normalized)
        }

        const normalizeMenuItem = (item: unknown): RuntimeMenuItem | null => {
            if (!item || typeof item !== 'object') return null
            const typed = item as Record<string, unknown>
            if (typed.isActive === false) return null

            const kind = typeof typed.kind === 'string' && typed.kind.trim().length > 0 ? typed.kind : 'link'
            const objectCollectionId = resolveObjectCollectionId(typed.sectionId ?? typed.objectCollectionId)
            const treeEntityId = resolveTreeEntityId(typed.hubId ?? typed.treeEntityId)
            return {
                id: String(typed.id ?? ''),
                kind,
                title: resolveLocalizedContent(typed.title, requestedLocale, kind),
                icon: typeof typed.icon === 'string' ? typed.icon : null,
                href: typeof typed.href === 'string' ? typed.href : null,
                objectCollectionId,
                sectionId: objectCollectionId,
                treeEntityId,
                sortOrder: typeof typed.sortOrder === 'number' ? typed.sortOrder : 0,
                isActive: true
            }
        }

        const buildTreeEntityMenuItems = (baseItem: RuntimeMenuItem): RuntimeMenuItem[] => {
            if (!baseItem.treeEntityId) return []
            if (!treeEntityMetaById.has(baseItem.treeEntityId)) return []

            const items: RuntimeMenuItem[] = []
            const visited = new Set<string>()
            const treeEntitySortComparator = (aId: string, bId: string) => {
                const a = treeEntityMetaById.get(aId)
                const b = treeEntityMetaById.get(bId)
                if (!a || !b) return aId.localeCompare(bId)
                if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
                return resolveRuntimeCodenameText(a.codename).localeCompare(resolveRuntimeCodenameText(b.codename))
            }

            const walkTreeEntity = (treeEntityId: string, depth: number) => {
                if (visited.has(treeEntityId)) return
                visited.add(treeEntityId)

                const treeEntityMeta = treeEntityMetaById.get(treeEntityId)
                if (!treeEntityMeta) return
                const indent = depth > 0 ? `${'\u00A0\u00A0'.repeat(depth)}• ` : ''

                items.push({
                    id: `${baseItem.id}:hub:${treeEntityMeta.id}`,
                    kind: 'hub',
                    title: `${indent}${treeEntityMeta.title}`,
                    icon: baseItem.icon,
                    href: null,
                    objectCollectionId: null,
                    sectionId: null,
                    treeEntityId: treeEntityMeta.id,
                    sortOrder: baseItem.sortOrder,
                    isActive: true
                })

                const treeEntityObjectCollections = objectCollectionsByTreeEntity.get(treeEntityMeta.id) ?? []
                for (const lc of treeEntityObjectCollections) {
                    items.push({
                        id: `${baseItem.id}:hub:${treeEntityMeta.id}:section:${lc.id}`,
                        kind: 'section',
                        title: `${'\u00A0\u00A0'.repeat(depth + 1)}${lc.title}`,
                        icon: baseItem.icon,
                        href: null,
                        objectCollectionId: lc.id,
                        sectionId: lc.id,
                        treeEntityId: treeEntityMeta.id,
                        sortOrder: baseItem.sortOrder,
                        isActive: true
                    })
                }

                const childIds = [...(childTreeEntityIdsByParent.get(treeEntityMeta.id) ?? [])].sort(treeEntitySortComparator)
                for (const childId of childIds) {
                    walkTreeEntity(childId, depth + 1)
                }
            }

            walkTreeEntity(baseItem.treeEntityId, 0)
            return items
        }

        const buildBoundTreeEntityObjectCollectionItems = (widgetId: string, boundTreeEntityId: string): RuntimeMenuItem[] => {
            if (!treeEntityMetaById.has(boundTreeEntityId)) return []
            const directObjectCollections = objectCollectionsByTreeEntity.get(boundTreeEntityId) ?? []
            return directObjectCollections.map((lc, index) => ({
                id: `${widgetId}:bound-hub:${boundTreeEntityId}:section:${lc.id}`,
                kind: 'section',
                title: lc.title,
                icon: 'database',
                href: null,
                objectCollectionId: lc.id,
                sectionId: lc.id,
                treeEntityId: boundTreeEntityId,
                sortOrder: index + 1,
                isActive: true
            }))
        }

        const buildAllObjectCollectionMenuItems = (widgetId: string): RuntimeMenuItem[] => {
            return objectCollectionsForRuntime.map((lc, index) => ({
                id: `${widgetId}:all-sections:${lc.id}`,
                kind: 'section',
                title: lc.name,
                icon: 'database',
                href: null,
                objectCollectionId: lc.id,
                sectionId: lc.id,
                treeEntityId: null,
                sortOrder: index + 1,
                isActive: true
            }))
        }

        const buildWorkspaceMenuItem = (widgetId: string, sortOrder: number): RuntimeMenuItem => ({
            id: 'runtime-workspaces',
            kind: 'link',
            title: requestedLocale === 'ru' ? 'Рабочие пространства' : 'Workspaces',
            icon: 'apps',
            href: `/a/${applicationId}/workspaces`,
            objectCollectionId: null,
            sectionId: null,
            treeEntityId: null,
            sortOrder,
            isActive: true
        })

        let menus: RuntimeMenuEntry[] = []
        let activeMenuId: string | null = null

        try {
            for (const widget of zoneWidgets.left) {
                if (widget.widgetKey !== 'menuWidget') continue
                const cfg = widget.config as Record<string, unknown>
                const bindToTreeEntity = Boolean(cfg.bindToHub)
                const boundTreeEntityId = resolveTreeEntityId(cfg.boundHubId ?? cfg.boundTreeEntityId)
                const autoShowAllSections = Boolean(cfg.autoShowAllSections) && !bindToTreeEntity

                let resolvedItems: RuntimeMenuItem[] = []
                if (bindToTreeEntity && boundTreeEntityId) {
                    resolvedItems = buildBoundTreeEntityObjectCollectionItems(widget.id, boundTreeEntityId)
                } else if (autoShowAllSections) {
                    resolvedItems = buildAllObjectCollectionMenuItems(widget.id)
                } else {
                    const rawItems = Array.isArray(cfg.items) ? cfg.items : []
                    const normalizedItems = rawItems
                        .map((item) => normalizeMenuItem(item))
                        .filter((item): item is RuntimeMenuItem => item !== null)
                        .sort((a, b) => a.sortOrder - b.sortOrder)

                    for (const item of normalizedItems) {
                        if (isRuntimeHubKind(item.kind)) {
                            const expanded = buildTreeEntityMenuItems(item)
                            if (expanded.length > 0) {
                                resolvedItems.push(...expanded)
                            }
                            continue
                        }
                        resolvedItems.push(item)
                    }
                }

                const rawMaxPrimaryItems = cfg.maxPrimaryItems
                const maxPrimaryItems =
                    typeof rawMaxPrimaryItems === 'number' && Number.isFinite(rawMaxPrimaryItems)
                        ? Math.max(1, Math.min(12, Math.trunc(rawMaxPrimaryItems)))
                        : null
                const rawWorkspacePlacement = cfg.workspacePlacement
                const workspacePlacement: RuntimeWorkspacePlacement =
                    rawWorkspacePlacement === 'overflow' || rawWorkspacePlacement === 'hidden' ? rawWorkspacePlacement : 'primary'
                let workspaceItem: RuntimeMenuItem | null = null
                if (runtimeContext.workspacesEnabled) {
                    workspaceItem = buildWorkspaceMenuItem(widget.id, resolvedItems.length + 1000)
                }
                const { primaryItems, overflowItems } = partitionRuntimeMenuItems(
                    resolvedItems,
                    maxPrimaryItems,
                    workspaceItem,
                    workspacePlacement
                )

                const menuEntry = {
                    id: widget.id,
                    widgetId: widget.id,
                    showTitle: Boolean(cfg.showTitle),
                    title: resolveLocalizedContent(cfg.title, requestedLocale, ''),
                    autoShowAllSections,
                    startPage: typeof cfg.startPage === 'string' ? cfg.startPage : null,
                    startSectionId: resolveStartSectionId(cfg.startPage, resolvedItems),
                    maxPrimaryItems,
                    overflowLabelKey: typeof cfg.overflowLabelKey === 'string' ? cfg.overflowLabelKey : null,
                    workspacePlacement,
                    items: primaryItems,
                    overflowItems
                } satisfies RuntimeMenuEntry
                menus.push(menuEntry)
            }
            activeMenuId = menus[0]?.id ?? null
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('[ApplicationsRuntime] Failed to build menus from widget config (ignored)', e)
        }

        type RuntimeColumnDefinition = {
            id: string
            codename: unknown
            field: string
            dataType: RuntimeDataType
            isRequired: boolean
            isDisplayComponent: boolean
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

        const buildSetConstantOption = (valueGroupFixedValueConfig: SetConstantUiConfig | null): RuntimeRefOption[] | undefined => {
            if (!valueGroupFixedValueConfig) return undefined
            return [
                {
                    id: valueGroupFixedValueConfig.id,
                    label: resolveSetConstantLabel(valueGroupFixedValueConfig, requestedLocale),
                    codename: valueGroupFixedValueConfig.codename ?? 'valueGroupFixedValue',
                    isDefault: true,
                    sortOrder: 0
                }
            ]
        }

        const resolveRefOptions = (
            component: (typeof safeComponents)[number],
            setConstantOption: RuntimeRefOption[] | undefined
        ): RuntimeRefOption[] | undefined => {
            const targetObjectKind = component.target_object_kind ?? null

            if (
                component.data_type !== 'REF' ||
                typeof component.target_object_id !== 'string' ||
                (!isRuntimeEnumerationKind(targetObjectKind) &&
                    !isRuntimeSetKind(targetObjectKind) &&
                    !isRuntimeObjectTargetKind(targetObjectKind))
            ) {
                return undefined
            }

            if (isRuntimeEnumerationKind(targetObjectKind)) {
                return enumOptionsMap.get(component.target_object_id) ?? []
            }
            if (isRuntimeObjectTargetKind(targetObjectKind)) {
                return objectRefOptionsMap.get(component.target_object_id) ?? []
            }
            return setConstantOption ?? []
        }

        const mapComponentToColumnDefinition = (
            component: (typeof safeComponents)[number],
            includeChildColumns: boolean
        ): RuntimeColumnDefinition => {
            const valueGroupFixedValueConfig =
                component.data_type === 'REF' && isRuntimeSetKind(component.target_object_kind)
                    ? getSetConstantConfig(component.ui_config)
                    : null
            const setConstantOption = buildSetConstantOption(valueGroupFixedValueConfig)
            const refOptions = resolveRefOptions(component, setConstantOption)
            const enumOptions =
                component.data_type === 'REF' &&
                isRuntimeEnumerationKind(component.target_object_kind) &&
                component.target_object_id &&
                enumOptionsMap.has(component.target_object_id)
                    ? enumOptionsMap.get(component.target_object_id)
                    : undefined

            return {
                id: component.id,
                codename: resolveRuntimeCodenameText(component.codename),
                field: component.column_name,
                dataType: component.data_type,
                isRequired: component.is_required ?? false,
                isDisplayComponent: component.is_display_component === true,
                headerName: resolvePresentationName(
                    component.presentation,
                    requestedLocale,
                    resolveRuntimeCodenameText(component.codename)
                ),
                validationRules: component.validation_rules ?? {},
                uiConfig: {
                    ...(component.ui_config ?? {}),
                    ...(valueGroupFixedValueConfig?.dataType ? { setConstantDataType: valueGroupFixedValueConfig.dataType } : {})
                },
                refTargetEntityId: component.target_object_id ?? null,
                refTargetEntityKind: component.target_object_kind ?? null,
                refTargetConstantId: valueGroupFixedValueConfig?.id ?? null,
                refOptions,
                enumOptions,
                ...(includeChildColumns && component.data_type === 'TABLE'
                    ? {
                          childColumns: (childAttrsByTableId.get(component.id) ?? []).map((child) =>
                              mapComponentToColumnDefinition(child, false)
                          )
                      }
                    : {})
            }
        }

        const activeSectionPayload = {
            id: activeObjectCollection.id,
            kind: activeObjectCollectionKind ?? 'object',
            codename: resolveRuntimeCodenameText(activeObjectCollection.codename),
            tableName: activeObjectCollection.table_name,
            pageBlocks: isActivePage ? normalizeRuntimePageBlocks(activeObjectCollection.config?.blockContent) : undefined,
            runtimeConfig: {
                ...activeObjectCollectionRuntimeConfig,
                enableRowReordering: canPersistRowReordering
            },
            recordBehavior: isActivePage ? undefined : activeRecordBehavior,
            workflowActions: activeWorkflowActions,
            name: resolvePresentationName(
                activeObjectCollection.presentation,
                requestedLocale,
                resolveRuntimeCodenameText(activeObjectCollection.codename)
            )
        }

        return res.json({
            section: activeSectionPayload,
            sections: objectCollectionsForRuntime,
            activeSectionId: activeObjectCollection.id,
            objectCollection: {
                ...activeSectionPayload
            },
            objectCollections: objectCollectionsForRuntime,
            activeObjectCollectionId: activeObjectCollection.id,
            columns: safeComponents.map((component) => mapComponentToColumnDefinition(component, true)),
            rows,
            pagination: {
                total: typeof total === 'number' ? total : Number(total) || 0,
                limit,
                offset
            },
            ...(workspaceLimit ? { workspaceLimit } : {}),
            settings: runtimeContext.applicationSettings,
            workspacesEnabled: runtimeContext.workspacesEnabled,
            currentWorkspaceId: runtimeContext.currentWorkspaceId,
            permissions: runtimeContext.permissions,
            workflowCapabilities: runtimeContext.workflowCapabilities,
            layoutConfig,
            zoneWidgets,
            menus,
            activeMenuId
        })
    }

    // ============ UPDATE SINGLE CELL ============
    const updateCell = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'editContent')) return

        const parsedBody = runtimeUpdateBodySchema.safeParse(req.body)
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const { field, value, objectCollectionId: requestedObjectCollectionId, expectedVersion } = parsedBody.data
        if (!IDENTIFIER_REGEX.test(field)) {
            return res.status(400).json({ error: 'Invalid field name' })
        }

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, requestedObjectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )

        const cmp = attrs.find((a) => a.column_name === field)
        if (!cmp) return res.status(404).json({ error: 'Component not found' })
        if (!RUNTIME_WRITABLE_TYPES.has(cmp.data_type)) {
            return res.status(400).json({
                error: `Field type ${cmp.data_type} is not editable`
            })
        }

        if (cmp.data_type === 'TABLE') {
            return res.status(400).json({
                error: `Field type ${cmp.data_type} must be edited via tabular endpoints`
            })
        }

        if (
            cmp.data_type === 'REF' &&
            isRuntimeEnumerationKind(cmp.target_object_kind) &&
            getEnumPresentationMode(cmp.ui_config) === 'label'
        ) {
            return res.status(400).json({
                error: `Field is read-only: ${cmp.codename}`
            })
        }

        const valueGroupFixedValueConfig =
            cmp.data_type === 'REF' && isRuntimeSetKind(cmp.target_object_kind) ? getSetConstantConfig(cmp.ui_config) : null
        let rawValue = value
        if (valueGroupFixedValueConfig) {
            const providedRefId = resolveRefId(rawValue)
            if (!providedRefId) {
                rawValue = valueGroupFixedValueConfig.id
            } else if (providedRefId !== valueGroupFixedValueConfig.id) {
                return res.status(400).json({
                    error: `Field is read-only: ${cmp.codename}`
                })
            } else {
                rawValue = valueGroupFixedValueConfig.id
            }
        }

        let coerced: unknown
        try {
            coerced = normalizeConfiguredRuntimeJsonValue(coerceRuntimeValue(rawValue, cmp.data_type, cmp.validation_rules), cmp)
        } catch (e) {
            return res.status(400).json({ error: (e as Error).message })
        }

        if (cmp.is_required && cmp.data_type !== 'BOOLEAN' && coerced === null) {
            return res.status(400).json({
                error: `Required field cannot be set to null: ${cmp.codename}`
            })
        }

        if (
            cmp.data_type === 'REF' &&
            isRuntimeEnumerationKind(cmp.target_object_kind) &&
            typeof cmp.target_object_id === 'string' &&
            coerced
        ) {
            try {
                await ensureEnumerationValueBelongsToTarget(ctx.manager, ctx.schemaIdent, String(coerced), cmp.target_object_id)
            } catch (error) {
                return res.status(400).json({ error: (error as Error).message })
            }
        }

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
        const versionCheckClause = expectedVersion !== undefined ? 'AND COALESCE(_upl_version, 1) = $4' : ''

        let afterUpdateLifecycleRequest: RuntimeLifecycleDispatchRequest | null = null

        try {
            await ctx.manager.transaction(async (txManager) => {
                const previousRow = await loadRuntimeRowById(txManager, dataTableIdent, rowId, runtimeRowCondition)
                if (!previousRow || !previousRow.id) {
                    throw new UpdateFailure(404, { error: 'Row not found' })
                }
                if (previousRow._upl_locked) {
                    throw new UpdateFailure(423, { error: 'Record is locked' })
                }
                assertRuntimeRecordMutable(objectCollection.config, previousRow)

                await dispatchRuntimeLifecycle({
                    manager: txManager,
                    applicationId,
                    schemaName: ctx.schemaName,
                    objectCollection,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    componentIds: [cmp.id],
                    payload: {
                        eventName: 'beforeUpdate',
                        previousRow,
                        patch: { [field]: coerced }
                    }
                })

                const updated = (await txManager.query(
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
                    expectedVersion !== undefined ? [coerced, ctx.userId, rowId, expectedVersion] : [coerced, ctx.userId, rowId]
                )) as Array<{ id: string }>

                if (updated.length === 0) {
                    const exists = (await txManager.query(
                        `SELECT id, _upl_locked, _upl_version FROM ${dataTableIdent} WHERE id = $1 AND ${runtimeRowCondition}`,
                        [rowId]
                    )) as Array<{
                        id: string
                        _upl_locked?: boolean
                        _upl_version?: number
                    }>

                    if (exists.length > 0 && exists[0]._upl_locked) {
                        throw new UpdateFailure(423, { error: 'Record is locked' })
                    }

                    if (exists.length > 0 && expectedVersion !== undefined) {
                        const actualVersion = Number(exists[0]._upl_version ?? 1)
                        if (actualVersion !== expectedVersion) {
                            throw new UpdateFailure(409, {
                                error: 'Version mismatch',
                                expectedVersion,
                                actualVersion
                            })
                        }
                    }

                    throw new UpdateFailure(404, { error: 'Row not found' })
                }

                const nextRow = await loadRuntimeRowById(txManager, dataTableIdent, rowId, runtimeRowCondition)
                afterUpdateLifecycleRequest = {
                    applicationId,
                    schemaName: ctx.schemaName,
                    objectCollection,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    componentIds: [cmp.id],
                    payload: {
                        eventName: 'afterUpdate',
                        row: nextRow,
                        previousRow,
                        patch: { [field]: coerced }
                    }
                }
            })

            dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterUpdateLifecycleRequest)
            return res.json({ status: 'ok' })
        } catch (e) {
            if (e instanceof UpdateFailure) {
                return res.status(e.statusCode).json(e.body)
            }
            throw e
        }
    }

    // ============ BULK UPDATE ROW ============
    const bulkUpdateRow = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'editContent')) return

        const parsedBody = runtimeBulkUpdateBodySchema.safeParse(req.body)
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const { objectCollectionId: requestedObjectCollectionId, data, expectedVersion } = parsedBody.data

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, requestedObjectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const runtimeDeleteSetClause = isSoftDeleteLifecycle(objectCollection.lifecycleContract)
            ? buildRuntimeSoftDeleteSetClause('$1', objectCollection.lifecycleContract, objectCollection.config)
            : null

        const setClauses: string[] = []
        const values: unknown[] = []
        let paramIndex = 1
        const touchedComponentIds = collectTouchedComponentIds(attrs, data)

        const safeAttrs = attrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name) && RUNTIME_WRITABLE_TYPES.has(a.data_type))
        const nonTableAttrs = safeAttrs.filter((a) => a.data_type !== 'TABLE')
        const tableAttrsForUpdate = safeAttrs.filter((a) => a.data_type === 'TABLE')

        for (const cmp of nonTableAttrs) {
            const attrLabel = formatRuntimeFieldLabel(cmp.codename)
            const { value: raw } = getRuntimeInputValue(data, cmp.column_name, cmp.codename)
            if (raw === undefined) continue
            let normalizedRaw = raw

            if (
                cmp.data_type === 'REF' &&
                isRuntimeEnumerationKind(cmp.target_object_kind) &&
                getEnumPresentationMode(cmp.ui_config) === 'label'
            ) {
                return res.status(400).json({
                    error: `Field is read-only: ${attrLabel}`
                })
            }
            const valueGroupFixedValueConfig =
                cmp.data_type === 'REF' && isRuntimeSetKind(cmp.target_object_kind) ? getSetConstantConfig(cmp.ui_config) : null
            if (valueGroupFixedValueConfig) {
                const providedRefId = resolveRefId(raw)
                if (!providedRefId) {
                    normalizedRaw = valueGroupFixedValueConfig.id
                } else if (providedRefId !== valueGroupFixedValueConfig.id) {
                    return res.status(400).json({
                        error: `Field is read-only: ${attrLabel}`
                    })
                } else {
                    normalizedRaw = valueGroupFixedValueConfig.id
                }
            }

            try {
                const coerced = normalizeConfiguredRuntimeJsonValue(
                    coerceRuntimeValue(normalizedRaw, cmp.data_type, cmp.validation_rules),
                    cmp
                )
                if (cmp.is_required && cmp.data_type !== 'BOOLEAN' && coerced === null) {
                    return res.status(400).json({
                        error: `Required field cannot be set to null: ${attrLabel}`
                    })
                }

                if (
                    cmp.data_type === 'REF' &&
                    isRuntimeEnumerationKind(cmp.target_object_kind) &&
                    typeof cmp.target_object_id === 'string' &&
                    coerced
                ) {
                    await ensureEnumerationValueBelongsToTarget(ctx.manager, ctx.schemaIdent, String(coerced), cmp.target_object_id)
                }

                setClauses.push(`${quoteIdentifier(cmp.column_name)} = $${paramIndex}`)
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
            childAttrsByColumn: Map<string, RuntimeTableChildComponentMeta>
        }> = []

        for (const tAttr of tableAttrsForUpdate) {
            const tableFieldPath = formatRuntimeFieldPath(tAttr.codename)
            const { hasUserValue, value: raw } = getRuntimeInputValue(data, tAttr.column_name, tAttr.codename)
            if (!hasUserValue) continue
            if (raw !== undefined && raw !== null && !Array.isArray(raw)) {
                return res.status(400).json({
                    error: `Invalid value for ${tableFieldPath}: TABLE value must be an array`
                })
            }

            const childRows = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : []
            const rowCountError = getTableRowCountError(childRows.length, tableFieldPath, getTableRowLimits(tAttr.validation_rules))
            if (rowCountError) {
                return res.status(400).json({ error: rowCountError })
            }

            const fallbackTabTableName = generateChildTableName(tAttr.id)
            const tabTableName =
                typeof tAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tAttr.column_name) ? tAttr.column_name : fallbackTabTableName
            if (!IDENTIFIER_REGEX.test(tabTableName)) {
                return res.status(400).json({
                    error: `Invalid tabular table name for ${tableFieldPath}`
                })
            }

            const childAttrsResult = (await ctx.manager.query(
                `
          SELECT id, codename, column_name, data_type, is_required, validation_rules,
                 target_object_id, target_object_kind, ui_config
          FROM ${ctx.schemaIdent}._app_components
          WHERE parent_component_id = $1
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
                if (!rowData || typeof rowData !== 'object' || Array.isArray(rowData)) {
                    return res.status(400).json({
                        error: `Invalid row ${rowIdx + 1} for ${tableFieldPath}: row must be an object`
                    })
                }

                const preparedRow: Record<string, unknown> = {}

                for (const cAttr of childAttrsResult) {
                    if (!IDENTIFIER_REGEX.test(cAttr.column_name)) continue

                    const childFieldPath = formatRuntimeFieldPath(tAttr.codename, cAttr.codename)
                    const isEnumRef = cAttr.data_type === 'REF' && isRuntimeEnumerationKind(cAttr.target_object_kind)
                    const { hasUserValue: hasChildUserValue, value: childInputValue } = getRuntimeInputValue(
                        rowData,
                        cAttr.column_name,
                        cAttr.codename
                    )
                    let cRaw = childInputValue

                    if (isEnumRef && getEnumPresentationMode(cAttr.ui_config) === 'label' && hasChildUserValue) {
                        return res.status(400).json({
                            error: `Field is read-only: ${childFieldPath}`
                        })
                    }

                    if (cRaw === undefined && isEnumRef && typeof cAttr.target_object_id === 'string') {
                        const defaultEnumValueId = getDefaultEnumValueId(cAttr.ui_config)
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
                                if (error instanceof Error && error.message === 'Enumeration value does not belong to target enumeration') {
                                    cRaw = undefined
                                } else {
                                    throw error
                                }
                            }
                        }
                    }

                    const childSetConstantConfig =
                        cAttr.data_type === 'REF' && isRuntimeSetKind(cAttr.target_object_kind)
                            ? getSetConstantConfig(cAttr.ui_config)
                            : null
                    if (childSetConstantConfig) {
                        const providedRefId = resolveRefId(cRaw)
                        if (!providedRefId) {
                            cRaw = childSetConstantConfig.id
                        } else if (providedRefId !== childSetConstantConfig.id) {
                            return res.status(400).json({
                                error: `Field is read-only: ${childFieldPath}`
                            })
                        } else {
                            cRaw = childSetConstantConfig.id
                        }
                    }

                    if (cRaw === undefined || cRaw === null) {
                        if (cAttr.is_required && cAttr.data_type !== 'BOOLEAN') {
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
                        const cCoerced = normalizeConfiguredRuntimeJsonValue(
                            coerceRuntimeValue(cRaw, cAttr.data_type, cAttr.validation_rules),
                            cAttr
                        )

                        if (isEnumRef && typeof cAttr.target_object_id === 'string' && cCoerced) {
                            await ensureEnumerationValueBelongsToTarget(
                                ctx.manager,
                                ctx.schemaIdent,
                                String(cCoerced),
                                cAttr.target_object_id
                            )
                        }

                        preparedRow[cAttr.column_name] = normalizeRuntimeTableChildInsertValue(
                            cCoerced,
                            cAttr.data_type,
                            cAttr.validation_rules
                        )
                    } catch (err) {
                        return res.status(400).json({
                            error: `Invalid value for ${childFieldPath}: ${err instanceof Error ? err.message : String(err)}`
                        })
                    }
                }

                preparedRows.push(preparedRow)
            }

            tableDataEntries.push({
                tabTableName,
                rows: preparedRows,
                childAttrsByColumn: new Map(
                    childAttrsResult.map((childAttr) => [
                        childAttr.column_name,
                        {
                            column_name: childAttr.column_name,
                            data_type: childAttr.data_type,
                            validation_rules: childAttr.validation_rules
                        }
                    ])
                )
            })
        }

        if (setClauses.length === 0 && tableDataEntries.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' })
        }

        setClauses.push('_upl_updated_at = NOW()')
        setClauses.push(`_upl_updated_by = $${paramIndex}`)
        values.push(ctx.userId)
        paramIndex++
        setClauses.push(`_upl_version = COALESCE(_upl_version, 1) + 1`)

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
        values.push(rowId)
        const rowIdParamIndex = paramIndex
        let versionCheckClause = ''

        if (expectedVersion !== undefined) {
            values.push(expectedVersion)
            versionCheckClause = `AND COALESCE(_upl_version, 1) = $${rowIdParamIndex + 1}`
        }

        let afterUpdateLifecycleRequest: RuntimeLifecycleDispatchRequest | null = null

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
                if (exists.length > 0 && expectedVersion !== undefined) {
                    const actualVersion = Number(exists[0]._upl_version ?? 1)
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

            // Replace child rows for each TABLE component using batch INSERT
            for (const { tabTableName, rows: childRows, childAttrsByColumn } of tableDataEntries) {
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
                    const headerCols: string[] = ['_tp_parent_id', '_tp_sort_order']
                    if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                        headerCols.push(quoteIdentifier('workspace_id'))
                    }
                    if (ctx.userId) headerCols.push('_upl_created_by')
                    const allColumns = [...headerCols, ...dataColumns.map((c) => quoteIdentifier(c))]
                    const allValues: unknown[] = []
                    const valueTuples: string[] = []
                    let pIdx = 1

                    for (let rowIdx = 0; rowIdx < childRows.length; rowIdx++) {
                        const rowData = childRows[rowIdx]
                        const ph: string[] = []
                        ph.push(`$${pIdx++}`)
                        allValues.push(rowId)
                        ph.push(`$${pIdx++}`)
                        allValues.push(rowIdx)
                        if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                            ph.push(`$${pIdx++}`)
                            allValues.push(ctx.currentWorkspaceId)
                        }
                        if (ctx.userId) {
                            ph.push(`$${pIdx++}`)
                            allValues.push(ctx.userId)
                        }
                        for (const cn of dataColumns) {
                            ph.push(`$${pIdx++}`)
                            allValues.push(normalizeRuntimeTableChildInsertValueByMeta(rowData[cn] ?? null, childAttrsByColumn.get(cn)))
                        }
                        valueTuples.push(`(${ph.join(', ')})`)
                    }

                    await mgr.query(`INSERT INTO ${tabTableIdent} (${allColumns.join(', ')}) VALUES ${valueTuples.join(', ')}`, allValues)
                }
            }
        }

        try {
            await ctx.manager.transaction(async (txManager) => {
                const previousRow = await loadRuntimeRowById(txManager, dataTableIdent, rowId, runtimeRowCondition)
                if (!previousRow || !previousRow.id) {
                    throw new UpdateFailure(404, {
                        error: 'Row not found'
                    })
                }
                if (previousRow._upl_locked) {
                    throw new UpdateFailure(423, {
                        error: 'Record is locked'
                    })
                }
                assertRuntimeRecordMutable(objectCollection.config, previousRow)

                await dispatchRuntimeLifecycle({
                    manager: txManager,
                    applicationId,
                    schemaName: ctx.schemaName,
                    objectCollection,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    componentIds: touchedComponentIds,
                    payload: {
                        eventName: 'beforeUpdate',
                        previousRow,
                        patch: data
                    }
                })

                await performBulkUpdate(txManager)

                const nextRow = await loadRuntimeRowById(txManager, dataTableIdent, rowId, runtimeRowCondition)
                afterUpdateLifecycleRequest = {
                    applicationId,
                    schemaName: ctx.schemaName,
                    objectCollection,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    componentIds: touchedComponentIds,
                    payload: {
                        eventName: 'afterUpdate',
                        row: nextRow,
                        previousRow,
                        patch: data
                    }
                }
            })

            dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterUpdateLifecycleRequest)
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
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const { objectCollectionId: requestedObjectCollectionId, data } = parsedBody.data

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, requestedObjectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
        // Build column→value pairs from input data
        const columnValues: Array<{ column: string; value: unknown }> = []
        const safeAttrs = attrs.filter(
            (a) => IDENTIFIER_REGEX.test(a.column_name) && RUNTIME_WRITABLE_TYPES.has(a.data_type) && a.data_type !== 'TABLE'
        )

        for (const cmp of safeAttrs) {
            const attrLabel = formatRuntimeFieldLabel(cmp.codename)
            const { hasUserValue, value: inputValue } = getRuntimeInputValue(data, cmp.column_name, cmp.codename)
            let raw = inputValue

            const isEnumRef = cmp.data_type === 'REF' && isRuntimeEnumerationKind(cmp.target_object_kind)
            const enumMode = getEnumPresentationMode(cmp.ui_config)

            if (isEnumRef && enumMode === 'label' && hasUserValue) {
                return res.status(400).json({
                    error: `Field is read-only: ${attrLabel}`
                })
            }

            if (raw === undefined && isEnumRef && typeof cmp.target_object_id === 'string') {
                const defaultEnumValueId = getDefaultEnumValueId(cmp.ui_config)
                if (defaultEnumValueId) {
                    try {
                        await ensureEnumerationValueBelongsToTarget(ctx.manager, ctx.schemaIdent, defaultEnumValueId, cmp.target_object_id)
                        raw = defaultEnumValueId
                    } catch (error) {
                        if (error instanceof Error && error.message === 'Enumeration value does not belong to target enumeration') {
                            raw = undefined
                        } else {
                            throw error
                        }
                    }
                }
            }

            const valueGroupFixedValueConfig =
                cmp.data_type === 'REF' && isRuntimeSetKind(cmp.target_object_kind) ? getSetConstantConfig(cmp.ui_config) : null
            if (valueGroupFixedValueConfig) {
                const providedRefId = resolveRefId(raw)
                if (!providedRefId) {
                    raw = valueGroupFixedValueConfig.id
                } else if (providedRefId !== valueGroupFixedValueConfig.id) {
                    return res.status(400).json({
                        error: `Field is read-only: ${attrLabel}`
                    })
                } else {
                    raw = valueGroupFixedValueConfig.id
                }
            }

            if (raw === undefined) {
                if (cmp.is_required && cmp.data_type !== 'BOOLEAN') {
                    return res.status(400).json({
                        error: `Required field missing: ${attrLabel}`
                    })
                }
                continue
            }
            try {
                const coerced = normalizeConfiguredRuntimeJsonValue(coerceRuntimeValue(raw, cmp.data_type, cmp.validation_rules), cmp)
                if (cmp.is_required && cmp.data_type !== 'BOOLEAN' && coerced === null) {
                    return res.status(400).json({
                        error: `Required field cannot be set to null: ${attrLabel}`
                    })
                }

                if (isEnumRef && typeof cmp.target_object_id === 'string' && coerced) {
                    await ensureEnumerationValueBelongsToTarget(ctx.manager, ctx.schemaIdent, String(coerced), cmp.target_object_id)
                }

                columnValues.push({
                    column: cmp.column_name,
                    value: coerced
                })
            } catch (e) {
                return res.status(400).json({
                    error: `Invalid value for ${attrLabel}: ${(e as Error).message}`
                })
            }
        }

        const { runtimeConfig } = await resolveEffectiveObjectCollectionRuntimeConfig({
            manager: ctx.manager,
            schemaName: ctx.schemaName,
            schemaIdent: ctx.schemaIdent,
            objectCollectionId: objectCollection.id
        })
        const reorderFieldAttr = resolveRuntimeReorderField(
            safeAttrs,
            runtimeConfig.enableRowReordering ? runtimeConfig.reorderPersistenceField : null
        )
        if (reorderFieldAttr && !columnValues.some((item) => item.column === reorderFieldAttr.column_name)) {
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

        const touchedComponentIds = collectTouchedComponentIds(attrs, data)
        const recordBehavior = normalizeRuntimeRecordBehavior(objectCollection.config)

        // Collect TABLE-type data from request body for child row insertion
        const tableAttrsForCreate = attrs.filter((a) => a.data_type === 'TABLE')
        const tableDataEntries: Array<{
            cmp: (typeof attrs)[number]
            rows: Array<Record<string, unknown>>
            tabTableName: string
            childAttrsByColumn: Map<string, RuntimeTableChildComponentMeta>
        }> = []
        for (const tAttr of tableAttrsForCreate) {
            const tableFieldPath = formatRuntimeFieldPath(tAttr.codename)
            const { value: raw } = getRuntimeInputValue(data, tAttr.column_name, tAttr.codename)
            if (raw !== undefined && raw !== null && !Array.isArray(raw)) {
                return res.status(400).json({
                    error: `Invalid value for ${tableFieldPath}: TABLE value must be an array`
                })
            }

            const childRows = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : []
            const rowCountError = getTableRowCountError(childRows.length, tableFieldPath, getTableRowLimits(tAttr.validation_rules))
            if (rowCountError) {
                return res.status(400).json({ error: rowCountError })
            }

            if (childRows.length > 0) {
                const fallbackTabTableName = generateChildTableName(tAttr.id)
                const tabTableName =
                    typeof tAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tAttr.column_name)
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
            FROM ${ctx.schemaIdent}._app_components
            WHERE parent_component_id = $1
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
                    if (!rowData || typeof rowData !== 'object' || Array.isArray(rowData)) {
                        return res.status(400).json({
                            error: `Invalid row ${rowIdx + 1} for ${tableFieldPath}: row must be an object`
                        })
                    }

                    const preparedRow: Record<string, unknown> = {}
                    for (const cAttr of childAttrsResult) {
                        if (!IDENTIFIER_REGEX.test(cAttr.column_name)) continue
                        const childFieldPath = formatRuntimeFieldPath(tAttr.codename, cAttr.codename)
                        const isEnumRef = cAttr.data_type === 'REF' && isRuntimeEnumerationKind(cAttr.target_object_kind)
                        const { hasUserValue, value: childInputValue } = getRuntimeInputValue(rowData, cAttr.column_name, cAttr.codename)
                        let cRaw = childInputValue

                        if (isEnumRef && getEnumPresentationMode(cAttr.ui_config) === 'label' && hasUserValue) {
                            return res.status(400).json({
                                error: `Field is read-only: ${childFieldPath}`
                            })
                        }

                        if (cRaw === undefined && isEnumRef && typeof cAttr.target_object_id === 'string') {
                            const defaultEnumValueId = getDefaultEnumValueId(cAttr.ui_config)
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
                                        error.message === 'Enumeration value does not belong to target enumeration'
                                    ) {
                                        cRaw = undefined
                                    } else {
                                        throw error
                                    }
                                }
                            }
                        }

                        const childSetConstantConfig =
                            cAttr.data_type === 'REF' && isRuntimeSetKind(cAttr.target_object_kind)
                                ? getSetConstantConfig(cAttr.ui_config)
                                : null
                        if (childSetConstantConfig) {
                            const providedRefId = resolveRefId(cRaw)
                            if (!providedRefId) {
                                cRaw = childSetConstantConfig.id
                            } else if (providedRefId !== childSetConstantConfig.id) {
                                return res.status(400).json({
                                    error: `Field is read-only: ${childFieldPath}`
                                })
                            } else {
                                cRaw = childSetConstantConfig.id
                            }
                        }

                        if (cRaw === undefined || cRaw === null) {
                            if (cAttr.is_required && cAttr.data_type !== 'BOOLEAN') {
                                return res.status(400).json({
                                    error: `Required field missing: ${childFieldPath}`
                                })
                            }
                            continue
                        }

                        try {
                            const cCoerced = normalizeConfiguredRuntimeJsonValue(
                                coerceRuntimeValue(cRaw, cAttr.data_type, cAttr.validation_rules),
                                cAttr
                            )
                            if (isEnumRef && typeof cAttr.target_object_id === 'string' && cCoerced) {
                                await ensureEnumerationValueBelongsToTarget(
                                    ctx.manager,
                                    ctx.schemaIdent,
                                    String(cCoerced),
                                    cAttr.target_object_id
                                )
                            }
                            preparedRow[cAttr.column_name] = normalizeRuntimeTableChildInsertValue(
                                cCoerced,
                                cAttr.data_type,
                                cAttr.validation_rules
                            )
                        } catch (err) {
                            return res.status(400).json({
                                error: `Invalid value for ${childFieldPath}: ${err instanceof Error ? err.message : String(err)}`
                            })
                        }
                    }

                    preparedRows.push(preparedRow)
                }

                tableDataEntries.push({
                    cmp: tAttr,
                    rows: preparedRows,
                    tabTableName,
                    childAttrsByColumn: new Map(
                        childAttrsResult.map((childAttr) => [
                            childAttr.column_name,
                            {
                                column_name: childAttr.column_name,
                                data_type: childAttr.data_type,
                                validation_rules: childAttr.validation_rules
                            }
                        ])
                    )
                })
            }
        }

        let afterCreateLifecycleRequest: RuntimeLifecycleDispatchRequest | null = null

        const performCreate = async (mgr: DbExecutor): Promise<string> => {
            if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                const limitState = await enforceObjectWorkspaceLimit(mgr, {
                    schemaName: ctx.schemaName,
                    objectId: objectCollection.id,
                    tableName: objectCollection.table_name,
                    workspaceId: ctx.currentWorkspaceId,
                    runtimeRowCondition
                })

                if (!limitState.canCreate) {
                    throw new UpdateFailure(409, {
                        error: 'Workspace object row limit reached',
                        code: 'WORKSPACE_LIMIT_REACHED',
                        details: limitState
                    })
                }
            }

            await dispatchRuntimeLifecycle({
                manager: mgr,
                applicationId,
                schemaName: ctx.schemaName,
                objectCollection,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                componentIds: touchedComponentIds,
                payload: {
                    eventName: 'beforeCreate',
                    patch: data
                }
            })

            const createColumnValues = await recordCommandService.buildInitialCreateColumnValues({
                columnValues,
                behavior: recordBehavior,
                manager: mgr,
                schemaIdent: ctx.schemaIdent,
                objectId: objectCollection.id,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId
            })

            const colNames = createColumnValues.map((cv) => quoteIdentifier(cv.column))
            const placeholders = createColumnValues.map((_, i) => `$${i + 1}`)
            const insertValues = createColumnValues.map((cv) => cv.value)

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
            const [inserted] = (await mgr.query(insertSql, insertValues)) as Array<{ id: string }>
            const parentId = inserted.id

            for (const { rows: childRows, tabTableName, childAttrsByColumn } of tableDataEntries) {
                if (childRows.length === 0) continue
                const tabTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(tabTableName)}`

                const dataColSet = new Set<string>()
                for (const rd of childRows) {
                    for (const cn of Object.keys(rd)) {
                        if (IDENTIFIER_REGEX.test(cn)) dataColSet.add(cn)
                    }
                }
                const dataColumns = [...dataColSet]
                const headerCols: string[] = ['_tp_parent_id', '_tp_sort_order']
                if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                    headerCols.push(quoteIdentifier('workspace_id'))
                }
                if (ctx.userId) headerCols.push('_upl_created_by')
                const allColumns = [...headerCols, ...dataColumns.map((c) => quoteIdentifier(c))]
                const allValues: unknown[] = []
                const valueTuples: string[] = []
                let pIdx = 1

                for (let rowIdx = 0; rowIdx < childRows.length; rowIdx++) {
                    const rowData = childRows[rowIdx]
                    const ph: string[] = []
                    ph.push(`$${pIdx++}`)
                    allValues.push(parentId)
                    ph.push(`$${pIdx++}`)
                    allValues.push(rowIdx)
                    if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                        ph.push(`$${pIdx++}`)
                        allValues.push(ctx.currentWorkspaceId)
                    }
                    if (ctx.userId) {
                        ph.push(`$${pIdx++}`)
                        allValues.push(ctx.userId)
                    }
                    for (const cn of dataColumns) {
                        ph.push(`$${pIdx++}`)
                        allValues.push(normalizeRuntimeTableChildInsertValueByMeta(rowData[cn] ?? null, childAttrsByColumn.get(cn)))
                    }
                    valueTuples.push(`(${ph.join(', ')})`)
                }

                await mgr.query(`INSERT INTO ${tabTableIdent} (${allColumns.join(', ')}) VALUES ${valueTuples.join(', ')}`, allValues)
            }

            const nextRow = await loadRuntimeRowById(mgr, dataTableIdent, parentId)
            afterCreateLifecycleRequest = {
                applicationId,
                schemaName: ctx.schemaName,
                objectCollection,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                componentIds: touchedComponentIds,
                payload: {
                    eventName: 'afterCreate',
                    row: nextRow,
                    patch: data
                }
            }

            return parentId
        }

        let parentId: string
        try {
            parentId = await ctx.manager.transaction(async (txManager) => {
                return performCreate(txManager)
            })
        } catch (error) {
            if (error instanceof UpdateFailure) {
                return res.status(error.statusCode).json(error.body)
            }
            throw error
        }
        dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterCreateLifecycleRequest)
        return res.status(201).json({ id: parentId, status: 'created' })
    }

    // ============ COPY ROW ============
    const copyRow = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })

        const parsedBody = runtimeCopyBodySchema.safeParse(req.body ?? {})
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'createContent')) return

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, parsedBody.data.objectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })

        const safeAttrs = attrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name))
        const nonTableAttrs = safeAttrs.filter((a) => a.data_type !== 'TABLE')
        const tableAttrsForCopy = safeAttrs.filter((a) => a.data_type === 'TABLE')

        const hasRequiredChildTables = tableAttrsForCopy.some((cmp) => {
            const { minRows } = getTableRowLimits(cmp.validation_rules)
            return Boolean(cmp.is_required) || (minRows !== null && minRows > 0)
        })
        const copyChildTables = hasRequiredChildTables ? true : parsedBody.data.copyChildTables !== false
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const { runtimeConfig } = await resolveEffectiveObjectCollectionRuntimeConfig({
            manager: ctx.manager,
            schemaName: ctx.schemaName,
            schemaIdent: ctx.schemaIdent,
            objectCollectionId: objectCollection.id
        })
        const reorderFieldAttr = resolveRuntimeReorderField(
            nonTableAttrs,
            runtimeConfig.enableRowReordering ? runtimeConfig.reorderPersistenceField : null
        )

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
        const sourceRows = (await ctx.manager.query(
            `
        SELECT *
        FROM ${dataTableIdent}
        WHERE id = $1
          AND ${runtimeRowCondition}
      `,
            [rowId]
        )) as Array<Record<string, unknown>>

        if (sourceRows.length === 0) return res.status(404).json({ error: 'Row not found' })
        if (sourceRows[0]._upl_locked) return res.status(423).json({ error: 'Record is locked' })
        const sourceRow = sourceRows[0]
        try {
            assertRuntimeRecordMutable(objectCollection.config, sourceRow)
        } catch (error) {
            if (error instanceof UpdateFailure) {
                return res.status(error.statusCode).json(error.body)
            }
            throw error
        }

        const insertColumns = nonTableAttrs.map((cmp) => quoteIdentifier(cmp.column_name))
        const insertValuesArr = nonTableAttrs.map((cmp) =>
            reorderFieldAttr?.column_name === cmp.column_name ? null : sourceRow[cmp.column_name] ?? null
        )
        const placeholders = insertValuesArr.map((_, index) => `$${index + 1}`)
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

        let afterCopyLifecycleRequest: RuntimeLifecycleDispatchRequest | null = null

        const performCopy = async (mgr: DbExecutor) => {
            if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                const limitState = await enforceObjectWorkspaceLimit(mgr, {
                    schemaName: ctx.schemaName,
                    objectId: objectCollection.id,
                    tableName: objectCollection.table_name,
                    workspaceId: ctx.currentWorkspaceId,
                    runtimeRowCondition
                })

                if (!limitState.canCreate) {
                    throw new UpdateFailure(409, {
                        error: 'Workspace object row limit reached',
                        code: 'WORKSPACE_LIMIT_REACHED',
                        details: limitState
                    })
                }
            }

            await dispatchRuntimeLifecycle({
                manager: mgr,
                applicationId,
                schemaName: ctx.schemaName,
                objectCollection,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                payload: {
                    eventName: 'beforeCopy',
                    previousRow: sourceRow,
                    metadata: {
                        copyChildTables
                    }
                }
            })

            if (reorderFieldAttr) {
                const reorderFieldIndex = nonTableAttrs.findIndex((cmp) => cmp.column_name === reorderFieldAttr.column_name)
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
                    const { minRows } = getTableRowLimits(tableAttr.validation_rules)
                    const fallbackTabTableName = generateChildTableName(tableAttr.id)
                    const tabTableName =
                        typeof tableAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tableAttr.column_name)
                            ? tableAttr.column_name
                            : fallbackTabTableName
                    if (!IDENTIFIER_REGEX.test(tabTableName)) continue
                    const tabTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(tabTableName)}`

                    const childAttrs = (await mgr.query(
                        `
              SELECT codename, column_name, data_type, validation_rules
              FROM ${ctx.schemaIdent}._app_components
              WHERE parent_component_id = $1
                AND _upl_deleted = false
                AND _app_deleted = false
              ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST
            `,
                        [tableAttr.id]
                    )) as Array<{
                        codename: string
                        column_name: string
                        data_type?: string | null
                        validation_rules?: Record<string, unknown>
                    }>

                    const validChildColumns = childAttrs.map((cmp) => cmp.column_name).filter((column) => IDENTIFIER_REGEX.test(column))
                    const childAttrsByColumn = new Map(childAttrs.map((cmp) => [cmp.column_name, cmp]))
                    const sourceChildRows = (await mgr.query(
                        `
              SELECT ${validChildColumns.length > 0 ? validChildColumns.map((column) => quoteIdentifier(column)).join(', ') + ',' : ''}
                     _tp_sort_order
              FROM ${tabTableIdent}
              WHERE _tp_parent_id = $1
                AND ${runtimeRowCondition}
              ORDER BY _tp_sort_order ASC, _upl_created_at ASC NULLS LAST
            `,
                        [rowId]
                    )) as Array<Record<string, unknown>>

                    if (minRows !== null && sourceChildRows.length < minRows) {
                        throw new UpdateFailure(400, {
                            error: `TABLE ${tableAttr.codename} requires at least ${minRows} row(s)`
                        })
                    }

                    if (sourceChildRows.length === 0) continue

                    const headerColumns = [
                        '_tp_parent_id',
                        '_tp_sort_order',
                        ...(ctx.workspacesEnabled && ctx.currentWorkspaceId ? [quoteIdentifier('workspace_id')] : []),
                        ...(ctx.userId ? ['_upl_created_by'] : [])
                    ]
                    const allColumns = [...headerColumns, ...validChildColumns.map((column) => quoteIdentifier(column))]
                    const copyValues: unknown[] = []
                    const valueTuples: string[] = []
                    let copyParamIndex = 1
                    for (let index = 0; index < sourceChildRows.length; index++) {
                        const sourceChild = sourceChildRows[index]
                        const tuple: string[] = []
                        tuple.push(`$${copyParamIndex++}`)
                        copyValues.push(insertedParent.id)
                        tuple.push(`$${copyParamIndex++}`)
                        copyValues.push(index)
                        if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                            tuple.push(`$${copyParamIndex++}`)
                            copyValues.push(ctx.currentWorkspaceId)
                        }
                        if (ctx.userId) {
                            tuple.push(`$${copyParamIndex++}`)
                            copyValues.push(ctx.userId)
                        }
                        for (const column of validChildColumns) {
                            tuple.push(`$${copyParamIndex++}`)
                            copyValues.push(
                                normalizeRuntimeTableChildInsertValueByMeta(sourceChild[column] ?? null, childAttrsByColumn.get(column))
                            )
                        }
                        valueTuples.push(`(${tuple.join(', ')})`)
                    }
                    await mgr.query(`INSERT INTO ${tabTableIdent} (${allColumns.join(', ')}) VALUES ${valueTuples.join(', ')}`, copyValues)
                }
            }

            const nextRow = await loadRuntimeRowById(mgr, dataTableIdent, insertedParent.id)
            afterCopyLifecycleRequest = {
                applicationId,
                schemaName: ctx.schemaName,
                objectCollection,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                payload: {
                    eventName: 'afterCopy',
                    row: nextRow,
                    previousRow: sourceRow,
                    metadata: {
                        copyChildTables
                    }
                }
            }

            return insertedParent.id
        }

        try {
            const copiedId = await ctx.manager.transaction((tx) => performCopy(tx))
            dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterCopyLifecycleRequest)
            return res.status(201).json({
                id: copiedId,
                status: 'created',
                copyOptions: { copyChildTables },
                hasRequiredChildTables
            })
        } catch (error) {
            if (error instanceof UpdateFailure) {
                return res.status(error.statusCode).json(error.body)
            }
            throw error
        }
    }

    const runRecordStateCommand = async (req: Request, res: Response, command: 'post' | 'unpost' | 'void') => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })

        const parsedBody = runtimeRecordCommandBodySchema.safeParse(req.body ?? {})
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ctx.userId) return res.status(401).json({ error: 'Current user is required' })
        if (!ensureRuntimePermission(res, ctx, 'editContent')) return

        const { objectCollection, error: objectCollectionError } = await resolveRuntimeObjectCollection(
            ctx.manager,
            ctx.schemaIdent,
            parsedBody.data.objectCollectionId
        )
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })

        const behavior = normalizeRuntimeRecordBehavior(objectCollection.config)
        if (!isRuntimeRecordBehaviorEnabled(behavior) || behavior.posting.mode === 'disabled') {
            return res.status(409).json({ error: 'Record posting is disabled for this record collection', code: 'POSTING_DISABLED' })
        }

        const registrarKind = typeof objectCollection.kind === 'string' ? objectCollection.kind.trim() : ''
        if (!registrarKind) {
            return res.status(409).json({
                error: 'Record posting registrar kind is not available',
                code: 'POSTING_REGISTRAR_KIND_UNAVAILABLE'
            })
        }

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )

        const eventPrefix = resolveRecordCommandEventPrefix(command)
        let afterLifecycleRequest: RuntimeLifecycleDispatchRequest | null = null
        let responsePayload: Record<string, unknown> | null = null

        try {
            await ctx.manager.transaction(async (txManager) => {
                const rows = (await txManager.query(
                    `
            SELECT *
            FROM ${dataTableIdent}
            WHERE id = $1
              AND ${runtimeRowCondition}
            FOR UPDATE
            LIMIT 1
          `,
                    [rowId]
                )) as Array<Record<string, unknown>>
                const previousRow = rows[0]
                if (!previousRow?.id) {
                    throw new UpdateFailure(404, { error: 'Row not found' })
                }
                if (previousRow._upl_locked) {
                    throw new UpdateFailure(423, { error: 'Record is locked' })
                }
                if (
                    parsedBody.data.expectedVersion !== undefined &&
                    Number(previousRow._upl_version ?? 1) !== parsedBody.data.expectedVersion
                ) {
                    throw new UpdateFailure(409, {
                        error: 'Version mismatch',
                        expectedVersion: parsedBody.data.expectedVersion,
                        actualVersion: Number(previousRow._upl_version ?? 1)
                    })
                }

                recordCommandService.assertCommandAllowed(command, previousRow)

                const beforeLifecycleResults =
                    (await dispatchRuntimeLifecycle({
                        manager: txManager,
                        applicationId,
                        schemaName: ctx.schemaName,
                        objectCollection,
                        currentWorkspaceId: ctx.currentWorkspaceId,
                        currentUserId: ctx.userId,
                        permissions: ctx.permissions,
                        payload: {
                            eventName: `before${eventPrefix}` as 'beforePost' | 'beforeUnpost' | 'beforeVoid',
                            previousRow,
                            metadata: { command }
                        }
                    })) ?? []

                const movementResult = await runPostingMovementWrites({
                    command,
                    executor: txManager,
                    schemaName: ctx.schemaName,
                    registrarKind,
                    behavior,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    beforeLifecycleResults,
                    storedMovements: previousRow._app_posting_movements
                })

                const { setClauses, values } = await recordCommandService.buildUpdate({
                    command,
                    previousRow,
                    behavior,
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    objectId: objectCollection.id,
                    rowId,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId
                })

                if (command === 'post') {
                    values.push(JSON.stringify(movementResult.postingMovements))
                    setClauses.push(`_app_posting_movements = $${values.length}::jsonb`)
                } else {
                    setClauses.push('_app_posting_movements = NULL')
                }

                const updatedRows = (await txManager.query(
                    `
            UPDATE ${dataTableIdent}
            SET ${setClauses.join(', ')}
            WHERE id = $1
              AND ${runtimeRowCondition}
              AND COALESCE(_upl_locked, false) = false
            RETURNING *
          `,
                    values
                )) as Array<Record<string, unknown>>

                const nextRow = updatedRows[0]
                if (!nextRow?.id) {
                    throw new UpdateFailure(404, { error: 'Row not found' })
                }

                nextRow._app_posting_movements = movementResult.postingMovements
                nextRow._app_posting_reversals = movementResult.postingReversals

                afterLifecycleRequest = {
                    applicationId,
                    schemaName: ctx.schemaName,
                    objectCollection,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    payload: {
                        eventName: `after${eventPrefix}` as 'afterPost' | 'afterUnpost' | 'afterVoid',
                        row: nextRow,
                        previousRow,
                        metadata: { command }
                    }
                }
                responsePayload = buildRecordCommandResponse(command, nextRow, movementResult)
            })
        } catch (error) {
            if (error instanceof UpdateFailure) {
                return res.status(error.statusCode).json(error.body)
            }
            throw error
        }

        dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterLifecycleRequest)
        return res.json(responsePayload ?? { id: rowId, status: command })
    }

    const postRow = async (req: Request, res: Response) => runRecordStateCommand(req, res, 'post')
    const unpostRow = async (req: Request, res: Response) => runRecordStateCommand(req, res, 'unpost')
    const voidRow = async (req: Request, res: Response) => runRecordStateCommand(req, res, 'void')

    const runWorkflowAction = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })

        const parsedActionCodename = runtimeWorkflowActionParamSchema.safeParse(req.params.actionCodename)
        if (!parsedActionCodename.success) {
            return res.status(400).json({ error: 'Invalid workflow action codename' })
        }

        const parsedBody = runtimeWorkflowActionBodySchema.safeParse(req.body ?? {})
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ctx.userId) return res.status(401).json({ error: 'Current user is required' })

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, parsedBody.data.objectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })

        const action = readConfiguredWorkflowActions(objectCollection.config).find(
            (candidate) => candidate.codename === parsedActionCodename.data
        )
        if (!action) {
            return res.status(404).json({
                error: 'Workflow action is not configured for this record collection',
                code: 'WORKFLOW_ACTION_NOT_CONFIGURED'
            })
        }
        const statusColumnName = resolveWorkflowStatusColumnName(action, attrs)
        if (!statusColumnName) {
            return res.status(400).json({
                error: 'Workflow action status field is not configured for this record collection',
                code: 'WORKFLOW_STATUS_FIELD_NOT_CONFIGURED'
            })
        }

        try {
            const result = await ctx.manager.transaction((txManager) =>
                applyWorkflowAction({
                    executor: txManager,
                    schemaName: ctx.schemaName,
                    tableName: objectCollection.table_name,
                    objectId: objectCollection.id,
                    rowId,
                    action,
                    capabilities: ctx.workflowCapabilities,
                    userId: ctx.userId,
                    statusColumnName,
                    expectedVersion: parsedBody.data.expectedVersion,
                    workspaceId: ctx.currentWorkspaceId,
                    hasWorkspaceColumn: ctx.workspacesEnabled,
                    auditMetadata: {
                        source: 'runtime.rows.workflowAction',
                        applicationId
                    }
                })
            )

            return res.json(result)
        } catch (error) {
            if (error instanceof UpdateFailure) {
                return res.status(error.statusCode).json(error.body)
            }
            throw error
        }
    }

    // ============ GET SINGLE ROW (raw for edit) ============
    const getRow = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })
        const objectCollectionId = typeof req.query.objectCollectionId === 'string' ? req.query.objectCollectionId : undefined
        if (objectCollectionId && !UUID_REGEX.test(objectCollectionId)) return res.status(400).json({ error: 'Invalid object ID format' })

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, objectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )

        const safeAttrs = attrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name) && a.data_type !== 'TABLE')
        const selectColumns = ['id', ...safeAttrs.map((a) => quoteIdentifier(a.column_name))]
        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`

        const rows = (await ctx.manager.query(
            `
        SELECT ${selectColumns.join(', ')}
        FROM ${dataTableIdent}
        WHERE id = $1
          AND ${runtimeRowCondition}
      `,
            [rowId]
        )) as Array<Record<string, unknown>>

        if (rows.length === 0) return res.status(404).json({ error: 'Row not found' })

        const row = rows[0]
        const rawData: Record<string, unknown> = {}
        for (const cmp of safeAttrs) {
            const raw = row[cmp.column_name] ?? null
            rawData[cmp.column_name] = cmp.data_type === 'NUMBER' && raw !== null ? pgNumericToNumber(raw) : raw
        }

        return res.json({ id: String(row.id), data: rawData })
    }

    // ============ DELETE ROW (soft) ============
    const deleteRow = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })
        const objectCollectionId = typeof req.query.objectCollectionId === 'string' ? req.query.objectCollectionId : undefined
        if (objectCollectionId && !UUID_REGEX.test(objectCollectionId)) return res.status(400).json({ error: 'Invalid object ID format' })

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'deleteContent')) return

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, objectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const runtimeDeleteSetClause = isSoftDeleteLifecycle(objectCollection.lifecycleContract)
            ? buildRuntimeSoftDeleteSetClause('$1', objectCollection.lifecycleContract, objectCollection.config)
            : null

        const tableAttrsForDelete = attrs.filter((a) => a.data_type === 'TABLE')

        let afterDeleteLifecycleRequest: RuntimeLifecycleDispatchRequest | null = null

        const performDelete = async (mgr: DbExecutor) => {
            const sourceRow = await loadRuntimeRowById(mgr, dataTableIdent, rowId, runtimeRowCondition)
            if (!sourceRow || !sourceRow.id) {
                throw new UpdateFailure(404, {
                    error: 'Row not found'
                })
            }
            if (sourceRow._upl_locked) {
                throw new UpdateFailure(423, {
                    error: 'Record is locked'
                })
            }
            assertRuntimeRecordMutable(objectCollection.config, sourceRow)

            await dispatchRuntimeLifecycle({
                manager: mgr,
                applicationId,
                schemaName: ctx.schemaName,
                objectCollection,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                payload: {
                    eventName: 'beforeDelete',
                    previousRow: sourceRow
                }
            })

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
                throw new UpdateFailure(404, {
                    error: 'Row not found'
                })
            }

            if (runtimeDeleteSetClause) {
                // Soft-delete child rows in TABLE child tables
                for (const tAttr of tableAttrsForDelete) {
                    const fallbackTabTableName = generateChildTableName(tAttr.id)
                    const tabTableName =
                        typeof tAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tAttr.column_name)
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

            const nextRow = runtimeDeleteSetClause ? await loadRuntimeRowById(mgr, dataTableIdent, rowId, runtimeRowCondition) : null
            afterDeleteLifecycleRequest = {
                applicationId,
                schemaName: ctx.schemaName,
                objectCollection,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                payload: {
                    eventName: 'afterDelete',
                    row: nextRow,
                    previousRow: sourceRow
                }
            }
        }

        try {
            await ctx.manager.transaction(async (txManager) => {
                await performDelete(txManager)
            })
            dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterDeleteLifecycleRequest)
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

        const { orderedRowIds, objectCollectionId: requestedObjectCollectionId } = parsedBody.data
        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, requestedObjectCollectionId)
        if (!objectCollection) {
            return res.status(404).json({ error: objectCollectionError })
        }

        const { runtimeConfig } = await resolveEffectiveObjectCollectionRuntimeConfig({
            manager: ctx.manager,
            schemaName: ctx.schemaName,
            schemaIdent: ctx.schemaIdent,
            objectCollectionId: objectCollection.id
        })
        const reorderFieldAttr = resolveRuntimeReorderField(attrs, runtimeConfig.reorderPersistenceField)

        if (!runtimeConfig.enableRowReordering || !reorderFieldAttr) {
            return res.status(409).json({ error: 'Persisted row reordering is not enabled for this object' })
        }

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
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

        const valuesSql = orderedRowIds.map((_, index) => `($${index * 2 + 1}::uuid, $${index * 2 + 2}::numeric)`).join(', ')
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
        postRow,
        unpostRow,
        voidRow,
        runWorkflowAction,
        getRow,
        deleteRow,
        reorderRows
    }
}
