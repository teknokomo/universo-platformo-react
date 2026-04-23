import type { Request, Response } from 'express'
import { z } from 'zod'
import type { DbExecutor } from '@universo/utils'
import { isBuiltinEntityKind } from '@universo/types'
import {
    normalizeLinkedCollectionRuntimeViewConfig,
    resolveLinkedCollectionLayoutBehaviorConfig,
    resolveLinkedCollectionRuntimeDashboardLayoutConfig,
    resolveApplicationLifecycleContractFromConfig
} from '@universo/utils'
import { generateChildTableName } from '@universo/schema-ddl'
import { getCatalogWorkspaceLimit, getCatalogWorkspaceUsage, enforceCatalogWorkspaceLimit } from '../services/applicationWorkspaces'
import { RuntimeScriptsService } from '../services/runtimeScriptsService'
import type { RolePermission } from '../routes/guards'
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
    linkedCollectionId: z.string().uuid().optional()
})

const runtimeUpdateBodySchema = z.object({
    field: z.string().min(1),
    value: z.unknown(),
    linkedCollectionId: z.string().uuid().optional(),
    expectedVersion: z.number().int().positive().optional()
})

const runtimeBulkUpdateBodySchema = z.object({
    linkedCollectionId: z.string().uuid().optional(),
    data: z.record(z.unknown()),
    expectedVersion: z.number().int().positive().optional()
})

const runtimeCreateBodySchema = z.object({
    linkedCollectionId: z.string().uuid().optional(),
    data: z.record(z.unknown())
})

const runtimeCopyBodySchema = z.object({
    linkedCollectionId: z.string().uuid().optional(),
    copyChildTables: z.boolean().optional()
})

const runtimeReorderBodySchema = z.object({
    linkedCollectionId: z.string().uuid().optional(),
    orderedRowIds: z.array(z.string().uuid()).min(1).max(1000)
})

const RUNTIME_STANDARD_KIND_SQL = (kindColumn = 'kind') => `COALESCE(${kindColumn}, '')`

const RUNTIME_CATALOG_FILTER_SQL = `${RUNTIME_STANDARD_KIND_SQL()} NOT IN ('hub', 'set', 'enumeration')`

const resolveRuntimeStandardKind = (kind: unknown): 'catalog' | 'hub' | 'set' | 'enumeration' | null =>
    typeof kind === 'string' && isBuiltinEntityKind(kind) ? kind : null

const isRuntimeCatalogTargetKind = (kind: unknown): kind is string =>
    typeof kind === 'string' && !['hub', 'set', 'enumeration'].includes(resolveRuntimeStandardKind(kind) ?? '')

const isRuntimeEnumerationKind = (kind: unknown): kind is string =>
    typeof kind === 'string' && resolveRuntimeStandardKind(kind) === 'enumeration'

const isRuntimeSetKind = (kind: unknown): kind is string => typeof kind === 'string' && resolveRuntimeStandardKind(kind) === 'set'

const isRuntimeHubKind = (kind: unknown): kind is string => typeof kind === 'string' && resolveRuntimeStandardKind(kind) === 'hub'

type RuntimeTableChildAttributeMeta = {
    column_name: string
    data_type?: string | null
    validation_rules?: Record<string, unknown>
}

export const normalizeRuntimeTableChildInsertValue = (
    value: unknown,
    dataType: string | null | undefined,
    validationRules?: Record<string, unknown>
): unknown => {
    if (value === undefined || value === null) {
        return null
    }

    if (dataType === 'JSON') {
        return typeof value === 'string' ? value : JSON.stringify(value)
    }

    if (dataType === 'STRING' && typeof value === 'object' && (validationRules?.localized === true || validationRules?.versioned === true)) {
        return JSON.stringify(value)
    }

    return value
}

const normalizeRuntimeTableChildInsertValueByMeta = (
    value: unknown,
    childAttrMeta?: RuntimeTableChildAttributeMeta | null
): unknown => {
    return normalizeRuntimeTableChildInsertValue(value, childAttrMeta?.data_type, childAttrMeta?.validation_rules)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a runtime row section and load its attributes from a runtime schema.
 */
const resolveRuntimeLinkedCollection = async (manager: DbExecutor, schemaIdent: string, requestedLinkedCollectionId?: string) => {
    const linkedCollections = (await manager.query(
        `
      SELECT id, codename, table_name, config
      FROM ${schemaIdent}._app_objects
    WHERE ${RUNTIME_CATALOG_FILTER_SQL}
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

    if (linkedCollections.length === 0) return { linkedCollection: null, attrs: [], error: 'No catalogs available' } as const

    const selectedLinkedCollection =
        (requestedLinkedCollectionId ? linkedCollections.find((c) => c.id === requestedLinkedCollectionId) : undefined) ??
        linkedCollections[0]
    const linkedCollection = selectedLinkedCollection
        ? {
              ...selectedLinkedCollection,
              lifecycleContract: resolveApplicationLifecycleContractFromConfig(selectedLinkedCollection.config)
          }
        : null
    if (!linkedCollection) return { linkedCollection: null, attrs: [], error: 'Catalog not found' } as const
    if (!IDENTIFIER_REGEX.test(linkedCollection.table_name))
        return { linkedCollection: null, attrs: [], error: 'Invalid table name' } as const

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
        [linkedCollection.id]
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

    return { linkedCollection, attrs, error: null } as const
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
                (attr.column_name.toLowerCase() === target ||
                    String(attr.codename ?? '')
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
    linkedCollectionId: string
}) => {
    const { manager, schemaName, schemaIdent, linkedCollectionId } = params
    const layoutsExist = await runtimeSystemTableExists(manager, schemaName, '_app_layouts')
    if (!layoutsExist) {
        return { layoutId: null, layoutConfig: {} as Record<string, unknown> }
    }

    const rows = (await manager.query(
        `
      SELECT id, config
      FROM ${schemaIdent}._app_layouts
      WHERE (catalog_id = $1 OR catalog_id IS NULL)
        AND is_active = true
        AND _upl_deleted = false
        AND _app_deleted = false
      ORDER BY CASE WHEN catalog_id = $1 THEN 0 ELSE 1 END,
               is_default DESC,
               is_active DESC,
               sort_order ASC,
               _upl_created_at ASC
      LIMIT 1
    `,
        [linkedCollectionId]
    )) as Array<{ id: string; config: Record<string, unknown> | null }>

    return {
        layoutId: rows[0]?.id ?? null,
        layoutConfig: rows[0]?.config ?? {}
    }
}

export const resolvePreferredLinkedCollectionIdFromGlobalMenu = async (params: {
    manager: DbExecutor
    schemaName: string
    schemaIdent: string
}) => {
    const { manager, schemaName, schemaIdent } = params

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
        WHERE catalog_id IS NULL
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

        const boundMenuConfig = menuWidgets
            .map((row) => (row.config && typeof row.config === 'object' ? (row.config as Record<string, unknown>) : null))
            .find((cfg) => Boolean(cfg?.bindToHub) && typeof cfg?.boundHubId === 'string')

        const boundTreeEntityId = typeof boundMenuConfig?.boundHubId === 'string' ? boundMenuConfig.boundHubId : null
        if (!boundTreeEntityId) {
            return null
        }

        const preferredLinkedCollectionRows = (await manager.query(
            `
        SELECT id
        FROM ${schemaIdent}._app_objects
        WHERE ${RUNTIME_CATALOG_FILTER_SQL}
          AND _upl_deleted = false
          AND _app_deleted = false
          AND config->'hubs' @> $1::jsonb
        ORDER BY COALESCE((config->>'sortOrder')::int, 0) ASC, codename ASC
        LIMIT 1
      `,
            [JSON.stringify([boundTreeEntityId])]
        )) as Array<{ id: string }>

        return preferredLinkedCollectionRows[0]?.id ?? null
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[ApplicationsRuntime] Failed to resolve preferred startup catalog from menu binding (ignored)', e)
        return null
    }
}

const resolveEffectiveLinkedCollectionRuntimeConfig = async (params: {
    manager: DbExecutor
    schemaName: string
    schemaIdent: string
    linkedCollectionId: string
}) => {
    const selectedLayout = await loadRuntimeSelectedLayout({
        manager: params.manager,
        schemaName: params.schemaName,
        schemaIdent: params.schemaIdent,
        linkedCollectionId: params.linkedCollectionId
    })

    return {
        selectedLayout,
        runtimeConfig: resolveLinkedCollectionLayoutBehaviorConfig({
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

const collectTouchedAttributeIds = (
    attrs: Array<{ id: string; codename: unknown; column_name: string }>,
    payload: Record<string, unknown>
) => {
    const touched = new Set<string>()

    for (const attr of attrs) {
        const { hasUserValue } = getRuntimeInputValue(payload, attr.column_name, attr.codename)
        if (hasUserValue) {
            touched.add(attr.id)
        }
    }

    return [...touched]
}

const dispatchRuntimeLifecycle = async (params: {
    manager: DbExecutor
    applicationId: string
    schemaName: string
    linkedCollection: { id: string; codename: unknown }
    currentWorkspaceId?: string | null
    currentUserId?: string | null
    permissions?: Record<RolePermission, boolean>
    attributeIds?: string[]
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
        row?: Record<string, unknown> | null
        previousRow?: Record<string, unknown> | null
        patch?: Record<string, unknown> | null
        metadata?: Record<string, unknown>
    }
}) => {
    const scriptsService = new RuntimeScriptsService()

    await scriptsService.dispatchLifecycleEvent({
        executor: params.manager,
        applicationId: params.applicationId,
        schemaName: params.schemaName,
        attachmentKind: 'catalog',
        attachmentId: params.linkedCollection.id,
        entityCodename: resolveRuntimeCodenameText(params.linkedCollection.codename),
        currentWorkspaceId: params.currentWorkspaceId ?? null,
        currentUserId: params.currentUserId ?? null,
        permissions: params.permissions ?? null,
        attributeIds: params.attributeIds,
        payload: params.payload
    })
}

type RuntimeLifecycleDispatchRequest = Omit<Parameters<typeof dispatchRuntimeLifecycle>[0], 'manager'>

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

    // ============ GET RUNTIME TABLE ============
    const getRuntime = async (req: Request, res: Response) => {
        const { applicationId } = req.params

        const parsedQuery = runtimeQuerySchema.safeParse(req.query)
        if (!parsedQuery.success) {
            return res.status(400).json({ error: 'Invalid query', details: parsedQuery.error.flatten() })
        }

        const { limit, offset, locale } = parsedQuery.data
        const requestedLocale = normalizeLocale(locale)
        const requestedLinkedCollectionId = parsedQuery.data.linkedCollectionId ?? null
        const runtimeContext = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!runtimeContext) return

        const { schemaName, schemaIdent } = runtimeContext
        const manager = runtimeContext.manager
        const currentWorkspaceId = runtimeContext.currentWorkspaceId

        const linkedCollections = await manager.query(
            `
        SELECT id, codename, table_name, presentation, config
        FROM ${schemaIdent}._app_objects
        WHERE ${RUNTIME_CATALOG_FILTER_SQL}
          AND _upl_deleted = false
          AND _app_deleted = false
        ORDER BY ${runtimeCodenameTextSql('codename')} ASC, id ASC
      `
        )

        if (linkedCollections.length === 0) {
            return res.status(404).json({ error: 'No linkedCollections available in application runtime schema' })
        }

        const typedCatalogs = linkedCollections as Array<{
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

        const preferredLinkedCollectionIdFromMenu = requestedLinkedCollectionId
            ? null
            : await resolvePreferredLinkedCollectionIdFromGlobalMenu({
                  manager,
                  schemaName,
                  schemaIdent
              })

        const activeLinkedCollection =
            (requestedLinkedCollectionId
                ? runtimeCatalogs.find((catalogRow) => catalogRow.id === requestedLinkedCollectionId)
                : undefined) ??
            (preferredLinkedCollectionIdFromMenu
                ? runtimeCatalogs.find((catalogRow) => catalogRow.id === preferredLinkedCollectionIdFromMenu)
                : undefined) ??
            runtimeCatalogs[0]
        if (!activeLinkedCollection) {
            return res.status(404).json({
                error: 'Requested catalog not found in runtime schema',
                details: { linkedCollectionId: requestedLinkedCollectionId }
            })
        }

        if (!IDENTIFIER_REGEX.test(activeLinkedCollection.table_name)) {
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
            [activeLinkedCollection.id]
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

        const safeAttributes = attributes.filter((attr) => IDENTIFIER_REGEX.test(attr.column_name))

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
                        (attr) => attr.data_type === 'REF' && isRuntimeEnumerationKind(attr.target_object_kind) && attr.target_object_id
                    )
                    .map((attr) => String(attr.target_object_id)),
                ...allChildAttributes
                    .filter(
                        (attr) => attr.data_type === 'REF' && isRuntimeEnumerationKind(attr.target_object_kind) && attr.target_object_id
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
                    label: resolvePresentationName(row.presentation, requestedLocale, resolveRuntimeCodenameText(row.codename)),
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
                        (attr) => attr.data_type === 'REF' && isRuntimeCatalogTargetKind(attr.target_object_kind) && attr.target_object_id
                    )
                    .map((attr) => String(attr.target_object_id)),
                ...allChildAttributes
                    .filter(
                        (attr) => attr.data_type === 'REF' && isRuntimeCatalogTargetKind(attr.target_object_kind) && attr.target_object_id
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
            AND ${RUNTIME_CATALOG_FILTER_SQL}
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

            const attrsByLinkedCollectionId = new Map<string, typeof targetCatalogAttrs>()
            for (const row of targetCatalogAttrs) {
                const list = attrsByLinkedCollectionId.get(row.object_id) ?? []
                list.push(row)
                attrsByLinkedCollectionId.set(row.object_id, list)
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

                const targetAttrs = attrsByLinkedCollectionId.get(targetCatalog.id) ?? []
                const preferredDisplayAttr =
                    targetAttrs.find((attr) => attr.is_display_attribute) ??
                    targetAttrs.find((attr) => attr.data_type === 'STRING') ??
                    targetAttrs[0]

                const selectLabelSql =
                    preferredDisplayAttr && IDENTIFIER_REGEX.test(preferredDisplayAttr.column_name)
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
                        preferredDisplayAttr?.data_type === 'STRING' ? resolveRuntimeValue(rawLabel, 'STRING', requestedLocale) : rawLabel
                    const label = typeof localizedLabel === 'string' && localizedLabel.trim().length > 0 ? localizedLabel : String(row.id)

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

        const dataTableIdent = `${schemaIdent}.${quoteIdentifier(activeLinkedCollection.table_name)}`
        const activeCatalogRowCondition = buildRuntimeActiveRowCondition(
            activeLinkedCollection.lifecycleContract,
            activeLinkedCollection.config,
            undefined,
            currentWorkspaceId
        )
        // Use physicalAttributes for SQL — TABLE attrs have no physical column in parent table
        const selectColumns = ['id', ...physicalAttributes.map((attr) => quoteIdentifier(attr.column_name))]

        // Add correlated subqueries for TABLE attributes to include child row counts
        for (const tAttr of tableAttrs) {
            const fallbackTabTableName = generateChildTableName(tAttr.id)
            const tabTableName =
                typeof tAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tAttr.column_name) ? tAttr.column_name : fallbackTabTableName
            if (!IDENTIFIER_REGEX.test(tabTableName)) continue
            const tabTableIdent = `${schemaIdent}.${quoteIdentifier(tabTableName)}`
            selectColumns.push(
                `(SELECT COUNT(*)::int FROM ${tabTableIdent} WHERE _tp_parent_id = ${dataTableIdent}.id AND ${activeCatalogRowCondition}) AS ${quoteIdentifier(
                    tAttr.column_name
                )}`
            )
        }

        const { selectedLayout, runtimeConfig: activeLinkedCollectionRuntimeConfig } = await resolveEffectiveLinkedCollectionRuntimeConfig({
            manager,
            schemaName,
            schemaIdent,
            linkedCollectionId: activeLinkedCollection.id
        })
        const reorderFieldAttr = resolveRuntimeReorderField(
            safeAttributes,
            activeLinkedCollectionRuntimeConfig.enableRowReordering ? activeLinkedCollectionRuntimeConfig.reorderPersistenceField : null
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
            activeLinkedCollectionRuntimeConfig.enableRowReordering && Boolean(reorderFieldAttr) && offset === 0 && total <= limit

        const rows = rawRows.map((row) => {
            const mappedRow: Record<string, unknown> & { id: string } = {
                id: String(row.id)
            }

            for (const attribute of safeAttributes) {
                // TABLE attributes contain child row counts from subqueries
                if (attribute.data_type === 'TABLE') {
                    mappedRow[attribute.column_name] = typeof row[attribute.column_name] === 'number' ? row[attribute.column_name] : 0
                    continue
                }
                mappedRow[attribute.column_name] = resolveRuntimeValue(row[attribute.column_name], attribute.data_type, requestedLocale)
            }

            return mappedRow
        })

        let workspaceLimit: { maxRows: number | null; currentRows: number; canCreate: boolean } | undefined
        if (runtimeContext.workspacesEnabled && currentWorkspaceId) {
            const maxRows = await getCatalogWorkspaceLimit(manager, {
                schemaName,
                objectId: activeLinkedCollection.id
            })
            const currentRows = await getCatalogWorkspaceUsage(manager, {
                schemaName,
                tableName: activeLinkedCollection.table_name,
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

        layoutConfig = resolveLinkedCollectionRuntimeDashboardLayoutConfig({ layoutConfig })
        layoutConfig = {
            ...layoutConfig,
            enableRowReordering: canPersistRowReordering
        }

        const linkedCollectionsForRuntime = runtimeCatalogs.map((catalogRow) => ({
            id: catalogRow.id,
            codename: catalogRow.codename,
            tableName: catalogRow.table_name,
            runtimeConfig:
                catalogRow.id === activeLinkedCollection.id
                    ? activeLinkedCollectionRuntimeConfig
                    : normalizeLinkedCollectionRuntimeViewConfig(undefined),
            name: resolvePresentationName(catalogRow.presentation, requestedLocale, resolveRuntimeCodenameText(catalogRow.codename))
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
            linkedCollectionId: string | null
            sectionId: string | null
            treeEntityId: string | null
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

        type RuntimeTreeEntityMeta = {
            id: string
            codename: unknown
            title: string
            parentTreeEntityId: string | null
            sortOrder: number
        }

        type RuntimeLinkedCollectionMeta = {
            id: string
            codename: unknown
            title: string
            sortOrder: number
            treeEntityIds: string[]
        }

        let treeEntityMetaById = new Map<string, RuntimeTreeEntityMeta>()
        let childTreeEntityIdsByParent = new Map<string, string[]>()
        let linkedCollectionsByTreeEntity = new Map<string, RuntimeLinkedCollectionMeta[]>()

        try {
            const objectRows = (await manager.query(
                `
          SELECT id, kind, codename, presentation, config
          FROM ${schemaIdent}._app_objects
                    WHERE (${RUNTIME_STANDARD_KIND_SQL('kind')} = 'hub' OR ${RUNTIME_CATALOG_FILTER_SQL})
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
                    treeEntityMetaById.set(row.id, {
                        id: row.id,
                        codename: row.codename,
                        title,
                        parentTreeEntityId,
                        sortOrder
                    })
                    continue
                }

                const treeEntityIds = Array.isArray(config.hubs)
                    ? config.hubs.filter((value): value is string => typeof value === 'string')
                    : []
                const linkedCollectionMeta: RuntimeLinkedCollectionMeta = {
                    id: row.id,
                    codename: row.codename,
                    title,
                    sortOrder,
                    treeEntityIds
                }
                for (const treeEntityId of treeEntityIds) {
                    const list = linkedCollectionsByTreeEntity.get(treeEntityId) ?? []
                    list.push(linkedCollectionMeta)
                    linkedCollectionsByTreeEntity.set(treeEntityId, list)
                }
            }

            const treeEntitySortComparator = (a: RuntimeTreeEntityMeta, b: RuntimeTreeEntityMeta) => {
                if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
                return resolveRuntimeCodenameText(a.codename).localeCompare(resolveRuntimeCodenameText(b.codename))
            }
            const linkedCollectionSortComparator = (a: RuntimeLinkedCollectionMeta, b: RuntimeLinkedCollectionMeta) => {
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

            for (const [treeEntityId, treeEntityLinkedCollections] of linkedCollectionsByTreeEntity.entries()) {
                linkedCollectionsByTreeEntity.set(treeEntityId, [...treeEntityLinkedCollections].sort(linkedCollectionSortComparator))
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('[ApplicationsRuntime] Failed to build hub/catalog runtime map for menuWidget (ignored)', e)
            treeEntityMetaById = new Map()
            childTreeEntityIdsByParent = new Map()
            linkedCollectionsByTreeEntity = new Map()
        }

        const normalizeMenuItem = (item: unknown): RuntimeMenuItem | null => {
            if (!item || typeof item !== 'object') return null
            const typed = item as Record<string, unknown>
            if (typed.isActive === false) return null

            const kind = typeof typed.kind === 'string' && typed.kind.trim().length > 0 ? typed.kind : 'link'
            return {
                id: String(typed.id ?? ''),
                kind,
                title: resolveLocalizedContent(typed.title, requestedLocale, kind),
                icon: typeof typed.icon === 'string' ? typed.icon : null,
                href: typeof typed.href === 'string' ? typed.href : null,
                linkedCollectionId:
                    typeof typed.catalogId === 'string' ? typed.catalogId : typeof typed.sectionId === 'string' ? typed.sectionId : null,
                sectionId:
                    typeof typed.sectionId === 'string' ? typed.sectionId : typeof typed.catalogId === 'string' ? typed.catalogId : null,
                treeEntityId: typeof typed.hubId === 'string' ? typed.hubId : null,
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
                    linkedCollectionId: null,
                    sectionId: null,
                    treeEntityId: treeEntityMeta.id,
                    sortOrder: baseItem.sortOrder,
                    isActive: true
                })

                const treeEntityLinkedCollections = linkedCollectionsByTreeEntity.get(treeEntityMeta.id) ?? []
                for (const lc of treeEntityLinkedCollections) {
                    items.push({
                        id: `${baseItem.id}:hub:${treeEntityMeta.id}:catalog:${lc.id}`,
                        kind: 'catalog',
                        title: `${'\u00A0\u00A0'.repeat(depth + 1)}${lc.title}`,
                        icon: baseItem.icon,
                        href: null,
                        linkedCollectionId: lc.id,
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

        const buildBoundTreeEntityLinkedCollectionItems = (widgetId: string, boundTreeEntityId: string): RuntimeMenuItem[] => {
            if (!treeEntityMetaById.has(boundTreeEntityId)) return []
            const directLinkedCollections = linkedCollectionsByTreeEntity.get(boundTreeEntityId) ?? []
            return directLinkedCollections.map((lc, index) => ({
                id: `${widgetId}:bound-hub:${boundTreeEntityId}:catalog:${lc.id}`,
                kind: 'catalog',
                title: lc.title,
                icon: 'database',
                href: null,
                linkedCollectionId: lc.id,
                sectionId: lc.id,
                treeEntityId: boundTreeEntityId,
                sortOrder: index + 1,
                isActive: true
            }))
        }

        const buildAllLinkedCollectionMenuItems = (widgetId: string): RuntimeMenuItem[] => {
            return linkedCollectionsForRuntime.map((lc, index) => ({
                id: `${widgetId}:all-catalogs:${lc.id}`,
                kind: 'catalog',
                title: lc.name,
                icon: 'database',
                href: null,
                linkedCollectionId: lc.id,
                sectionId: lc.id,
                treeEntityId: null,
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
                const bindToTreeEntity = Boolean(cfg.bindToHub)
                const boundTreeEntityId = typeof cfg.boundHubId === 'string' ? cfg.boundHubId : null
                const autoShowAllCatalogs = Boolean(cfg.autoShowAllCatalogs) && !bindToTreeEntity

                let resolvedItems: RuntimeMenuItem[] = []
                if (bindToTreeEntity && boundTreeEntityId) {
                    resolvedItems = buildBoundTreeEntityLinkedCollectionItems(widget.id, boundTreeEntityId)
                } else if (autoShowAllCatalogs) {
                    resolvedItems = buildAllLinkedCollectionMenuItems(widget.id)
                } else {
                    const rawItems = Array.isArray(cfg.items) ? cfg.items : []
                    const normalizedItems = rawItems
                        .map((item) => normalizeMenuItem(item))
                        .filter((item): item is RuntimeMenuItem => item !== null)
                        .filter((item) => item.kind !== 'catalogs_all')
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

                const menuEntry = {
                    id: widget.id,
                    widgetId: widget.id,
                    showTitle: Boolean(cfg.showTitle),
                    title: resolveLocalizedContent(cfg.title, requestedLocale, ''),
                    autoShowAllCatalogs,
                    items: resolvedItems
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
            attribute: (typeof safeAttributes)[number],
            setConstantOption: RuntimeRefOption[] | undefined
        ): RuntimeRefOption[] | undefined => {
            const targetObjectKind = attribute.target_object_kind ?? null

            if (
                attribute.data_type !== 'REF' ||
                typeof attribute.target_object_id !== 'string' ||
                (!isRuntimeEnumerationKind(targetObjectKind) &&
                    !isRuntimeSetKind(targetObjectKind) &&
                    !isRuntimeCatalogTargetKind(targetObjectKind))
            ) {
                return undefined
            }

            if (isRuntimeEnumerationKind(targetObjectKind)) {
                return enumOptionsMap.get(attribute.target_object_id) ?? []
            }
            if (isRuntimeCatalogTargetKind(targetObjectKind)) {
                return catalogRefOptionsMap.get(attribute.target_object_id) ?? []
            }
            return setConstantOption ?? []
        }

        const mapAttributeToColumnDefinition = (
            attribute: (typeof safeAttributes)[number],
            includeChildColumns: boolean
        ): RuntimeColumnDefinition => {
            const valueGroupFixedValueConfig =
                attribute.data_type === 'REF' && isRuntimeSetKind(attribute.target_object_kind)
                    ? getSetConstantConfig(attribute.ui_config)
                    : null
            const setConstantOption = buildSetConstantOption(valueGroupFixedValueConfig)
            const refOptions = resolveRefOptions(attribute, setConstantOption)
            const enumOptions =
                attribute.data_type === 'REF' &&
                isRuntimeEnumerationKind(attribute.target_object_kind) &&
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
                    ...(valueGroupFixedValueConfig?.dataType ? { setConstantDataType: valueGroupFixedValueConfig.dataType } : {})
                },
                refTargetEntityId: attribute.target_object_id ?? null,
                refTargetEntityKind: attribute.target_object_kind ?? null,
                refTargetConstantId: valueGroupFixedValueConfig?.id ?? null,
                refOptions,
                enumOptions,
                ...(includeChildColumns && attribute.data_type === 'TABLE'
                    ? {
                          childColumns: (childAttrsByTableId.get(attribute.id) ?? []).map((child) =>
                              mapAttributeToColumnDefinition(child, false)
                          )
                      }
                    : {})
            }
        }

        const activeSectionPayload = {
            id: activeLinkedCollection.id,
            codename: activeLinkedCollection.codename,
            tableName: activeLinkedCollection.table_name,
            runtimeConfig: {
                ...activeLinkedCollectionRuntimeConfig,
                enableRowReordering: canPersistRowReordering
            },
            name: resolvePresentationName(
                activeLinkedCollection.presentation,
                requestedLocale,
                resolveRuntimeCodenameText(activeLinkedCollection.codename)
            )
        }

        return res.json({
            section: activeSectionPayload,
            sections: linkedCollectionsForRuntime,
            activeSectionId: activeLinkedCollection.id,
            linkedCollection: {
                ...activeSectionPayload
            },
            linkedCollections: linkedCollectionsForRuntime,
            activeLinkedCollectionId: activeLinkedCollection.id,
            columns: safeAttributes.map((attribute) => mapAttributeToColumnDefinition(attribute, true)),
            rows,
            pagination: {
                total: typeof total === 'number' ? total : Number(total) || 0,
                limit,
                offset
            },
            ...(workspaceLimit ? { workspaceLimit } : {}),
            workspacesEnabled: runtimeContext.workspacesEnabled,
            currentWorkspaceId: runtimeContext.currentWorkspaceId,
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

        const { field, value, linkedCollectionId: requestedLinkedCollectionId, expectedVersion } = parsedBody.data
        if (!IDENTIFIER_REGEX.test(field)) {
            return res.status(400).json({ error: 'Invalid field name' })
        }

        const {
            linkedCollection,
            attrs,
            error: linkedCollectionError
        } = await resolveRuntimeLinkedCollection(ctx.manager, ctx.schemaIdent, requestedLinkedCollectionId)
        if (!linkedCollection) return res.status(404).json({ error: linkedCollectionError })
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            linkedCollection.lifecycleContract,
            linkedCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )

        const attr = attrs.find((a) => a.column_name === field)
        if (!attr) return res.status(404).json({ error: 'Attribute not found' })
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
            isRuntimeEnumerationKind(attr.target_object_kind) &&
            getEnumPresentationMode(attr.ui_config) === 'label'
        ) {
            return res.status(400).json({
                error: `Field is read-only: ${attr.codename}`
            })
        }

        const valueGroupFixedValueConfig =
            attr.data_type === 'REF' && isRuntimeSetKind(attr.target_object_kind) ? getSetConstantConfig(attr.ui_config) : null
        let rawValue = value
        if (valueGroupFixedValueConfig) {
            const providedRefId = resolveRefId(rawValue)
            if (!providedRefId) {
                rawValue = valueGroupFixedValueConfig.id
            } else if (providedRefId !== valueGroupFixedValueConfig.id) {
                return res.status(400).json({
                    error: `Field is read-only: ${attr.codename}`
                })
            } else {
                rawValue = valueGroupFixedValueConfig.id
            }
        }

        let coerced: unknown
        try {
            coerced = coerceRuntimeValue(rawValue, attr.data_type, attr.validation_rules)
        } catch (e) {
            return res.status(400).json({ error: (e as Error).message })
        }

        if (attr.is_required && attr.data_type !== 'BOOLEAN' && coerced === null) {
            return res.status(400).json({
                error: `Required field cannot be set to null: ${attr.codename}`
            })
        }

        if (
            attr.data_type === 'REF' &&
            isRuntimeEnumerationKind(attr.target_object_kind) &&
            typeof attr.target_object_id === 'string' &&
            coerced
        ) {
            try {
                await ensureEnumerationValueBelongsToTarget(ctx.manager, ctx.schemaIdent, String(coerced), attr.target_object_id)
            } catch (error) {
                return res.status(400).json({ error: (error as Error).message })
            }
        }

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(linkedCollection.table_name)}`
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

                await dispatchRuntimeLifecycle({
                    manager: txManager,
                    applicationId,
                    schemaName: ctx.schemaName,
                    linkedCollection,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    attributeIds: [attr.id],
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
                    linkedCollection,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    attributeIds: [attr.id],
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

        const { linkedCollectionId: requestedLinkedCollectionId, data, expectedVersion } = parsedBody.data

        const {
            linkedCollection,
            attrs,
            error: linkedCollectionError
        } = await resolveRuntimeLinkedCollection(ctx.manager, ctx.schemaIdent, requestedLinkedCollectionId)
        if (!linkedCollection) return res.status(404).json({ error: linkedCollectionError })
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            linkedCollection.lifecycleContract,
            linkedCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const runtimeDeleteSetClause = isSoftDeleteLifecycle(linkedCollection.lifecycleContract)
            ? buildRuntimeSoftDeleteSetClause('$1', linkedCollection.lifecycleContract, linkedCollection.config)
            : null

        const setClauses: string[] = []
        const values: unknown[] = []
        let paramIndex = 1
        const touchedAttributeIds = collectTouchedAttributeIds(attrs, data)

        const safeAttrs = attrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name) && RUNTIME_WRITABLE_TYPES.has(a.data_type))
        const nonTableAttrs = safeAttrs.filter((a) => a.data_type !== 'TABLE')
        const tableAttrsForUpdate = safeAttrs.filter((a) => a.data_type === 'TABLE')

        for (const attr of nonTableAttrs) {
            const attrLabel = formatRuntimeFieldLabel(attr.codename)
            const { value: raw } = getRuntimeInputValue(data, attr.column_name, attr.codename)
            if (raw === undefined) continue
            let normalizedRaw = raw

            if (
                attr.data_type === 'REF' &&
                isRuntimeEnumerationKind(attr.target_object_kind) &&
                getEnumPresentationMode(attr.ui_config) === 'label'
            ) {
                return res.status(400).json({
                    error: `Field is read-only: ${attrLabel}`
                })
            }
            const valueGroupFixedValueConfig =
                attr.data_type === 'REF' && isRuntimeSetKind(attr.target_object_kind) ? getSetConstantConfig(attr.ui_config) : null
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
                const coerced = coerceRuntimeValue(normalizedRaw, attr.data_type, attr.validation_rules)
                if (attr.is_required && attr.data_type !== 'BOOLEAN' && coerced === null) {
                    return res.status(400).json({
                        error: `Required field cannot be set to null: ${attrLabel}`
                    })
                }

                if (
                    attr.data_type === 'REF' &&
                    isRuntimeEnumerationKind(attr.target_object_kind) &&
                    typeof attr.target_object_id === 'string' &&
                    coerced
                ) {
                    await ensureEnumerationValueBelongsToTarget(ctx.manager, ctx.schemaIdent, String(coerced), attr.target_object_id)
                }

                setClauses.push(`${quoteIdentifier(attr.column_name)} = $${paramIndex}`)
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
            childAttrsByColumn: Map<string, RuntimeTableChildAttributeMeta>
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
                        const cCoerced = coerceRuntimeValue(cRaw, cAttr.data_type, cAttr.validation_rules)

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

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(linkedCollection.table_name)}`
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

            // Replace child rows for each TABLE attribute using batch INSERT
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

                await dispatchRuntimeLifecycle({
                    manager: txManager,
                    applicationId,
                    schemaName: ctx.schemaName,
                    linkedCollection,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    attributeIds: touchedAttributeIds,
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
                    linkedCollection,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    attributeIds: touchedAttributeIds,
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

        const { linkedCollectionId: requestedLinkedCollectionId, data } = parsedBody.data

        const {
            linkedCollection,
            attrs,
            error: linkedCollectionError
        } = await resolveRuntimeLinkedCollection(ctx.manager, ctx.schemaIdent, requestedLinkedCollectionId)
        if (!linkedCollection) return res.status(404).json({ error: linkedCollectionError })
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            linkedCollection.lifecycleContract,
            linkedCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(linkedCollection.table_name)}`
        // Build column→value pairs from input data
        const columnValues: Array<{ column: string; value: unknown }> = []
        const safeAttrs = attrs.filter(
            (a) => IDENTIFIER_REGEX.test(a.column_name) && RUNTIME_WRITABLE_TYPES.has(a.data_type) && a.data_type !== 'TABLE'
        )

        for (const attr of safeAttrs) {
            const attrLabel = formatRuntimeFieldLabel(attr.codename)
            const { hasUserValue, value: inputValue } = getRuntimeInputValue(data, attr.column_name, attr.codename)
            let raw = inputValue

            const isEnumRef = attr.data_type === 'REF' && isRuntimeEnumerationKind(attr.target_object_kind)
            const enumMode = getEnumPresentationMode(attr.ui_config)

            if (isEnumRef && enumMode === 'label' && hasUserValue) {
                return res.status(400).json({
                    error: `Field is read-only: ${attrLabel}`
                })
            }

            if (raw === undefined && isEnumRef && typeof attr.target_object_id === 'string') {
                const defaultEnumValueId = getDefaultEnumValueId(attr.ui_config)
                if (defaultEnumValueId) {
                    try {
                        await ensureEnumerationValueBelongsToTarget(ctx.manager, ctx.schemaIdent, defaultEnumValueId, attr.target_object_id)
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
                attr.data_type === 'REF' && isRuntimeSetKind(attr.target_object_kind) ? getSetConstantConfig(attr.ui_config) : null
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
                if (attr.is_required && attr.data_type !== 'BOOLEAN') {
                    return res.status(400).json({
                        error: `Required field missing: ${attrLabel}`
                    })
                }
                continue
            }
            try {
                const coerced = coerceRuntimeValue(raw, attr.data_type, attr.validation_rules)
                if (attr.is_required && attr.data_type !== 'BOOLEAN' && coerced === null) {
                    return res.status(400).json({
                        error: `Required field cannot be set to null: ${attrLabel}`
                    })
                }

                if (isEnumRef && typeof attr.target_object_id === 'string' && coerced) {
                    await ensureEnumerationValueBelongsToTarget(ctx.manager, ctx.schemaIdent, String(coerced), attr.target_object_id)
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

        const { runtimeConfig } = await resolveEffectiveLinkedCollectionRuntimeConfig({
            manager: ctx.manager,
            schemaName: ctx.schemaName,
            schemaIdent: ctx.schemaIdent,
            linkedCollectionId: linkedCollection.id
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

        const colNames = columnValues.map((cv) => quoteIdentifier(cv.column))
        const placeholders = columnValues.map((_, i) => `$${i + 1}`)
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
        const touchedAttributeIds = collectTouchedAttributeIds(attrs, data)

        // Collect TABLE-type data from request body for child row insertion
        const tableAttrsForCreate = attrs.filter((a) => a.data_type === 'TABLE')
        const tableDataEntries: Array<{
            attr: (typeof attrs)[number]
            rows: Array<Record<string, unknown>>
            tabTableName: string
            childAttrsByColumn: Map<string, RuntimeTableChildAttributeMeta>
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
                            const cCoerced = coerceRuntimeValue(cRaw, cAttr.data_type, cAttr.validation_rules)
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
                    attr: tAttr,
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
                const limitState = await enforceCatalogWorkspaceLimit(mgr, {
                    schemaName: ctx.schemaName,
                    objectId: linkedCollection.id,
                    tableName: linkedCollection.table_name,
                    workspaceId: ctx.currentWorkspaceId,
                    runtimeRowCondition
                })

                if (!limitState.canCreate) {
                    throw new UpdateFailure(409, {
                        error: 'Workspace catalog row limit reached',
                        code: 'WORKSPACE_LIMIT_REACHED',
                        details: limitState
                    })
                }
            }

            await dispatchRuntimeLifecycle({
                manager: mgr,
                applicationId,
                schemaName: ctx.schemaName,
                linkedCollection,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                attributeIds: touchedAttributeIds,
                payload: {
                    eventName: 'beforeCreate',
                    patch: data
                }
            })

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
                linkedCollection,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                attributeIds: touchedAttributeIds,
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
            linkedCollection,
            attrs,
            error: linkedCollectionError
        } = await resolveRuntimeLinkedCollection(ctx.manager, ctx.schemaIdent, parsedBody.data.linkedCollectionId)
        if (!linkedCollection) return res.status(404).json({ error: linkedCollectionError })

        const safeAttrs = attrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name))
        const nonTableAttrs = safeAttrs.filter((a) => a.data_type !== 'TABLE')
        const tableAttrsForCopy = safeAttrs.filter((a) => a.data_type === 'TABLE')

        const hasRequiredChildTables = tableAttrsForCopy.some((attr) => {
            const { minRows } = getTableRowLimits(attr.validation_rules)
            return Boolean(attr.is_required) || (minRows !== null && minRows > 0)
        })
        const copyChildTables = hasRequiredChildTables ? true : parsedBody.data.copyChildTables !== false
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            linkedCollection.lifecycleContract,
            linkedCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const { runtimeConfig } = await resolveEffectiveLinkedCollectionRuntimeConfig({
            manager: ctx.manager,
            schemaName: ctx.schemaName,
            schemaIdent: ctx.schemaIdent,
            linkedCollectionId: linkedCollection.id
        })
        const reorderFieldAttr = resolveRuntimeReorderField(
            nonTableAttrs,
            runtimeConfig.enableRowReordering ? runtimeConfig.reorderPersistenceField : null
        )

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(linkedCollection.table_name)}`
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

        const insertColumns = nonTableAttrs.map((attr) => quoteIdentifier(attr.column_name))
        const insertValuesArr = nonTableAttrs.map((attr) =>
            reorderFieldAttr?.column_name === attr.column_name ? null : sourceRow[attr.column_name] ?? null
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
                const limitState = await enforceCatalogWorkspaceLimit(mgr, {
                    schemaName: ctx.schemaName,
                    objectId: linkedCollection.id,
                    tableName: linkedCollection.table_name,
                    workspaceId: ctx.currentWorkspaceId,
                    runtimeRowCondition
                })

                if (!limitState.canCreate) {
                    throw new UpdateFailure(409, {
                        error: 'Workspace catalog row limit reached',
                        code: 'WORKSPACE_LIMIT_REACHED',
                        details: limitState
                    })
                }
            }

            await dispatchRuntimeLifecycle({
                manager: mgr,
                applicationId,
                schemaName: ctx.schemaName,
                linkedCollection,
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
                const reorderFieldIndex = nonTableAttrs.findIndex((attr) => attr.column_name === reorderFieldAttr.column_name)
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
                        data_type: string
                    }>

                    const validChildColumns = childAttrs.map((attr) => attr.column_name).filter((column) => IDENTIFIER_REGEX.test(column))
                    const childColumnTypes = new Map(childAttrs.map((attr) => [attr.column_name, attr.data_type]))
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
                            copyValues.push(normalizeRuntimeTableChildInsertValue(sourceChild[column] ?? null, childColumnTypes.get(column)))
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
                linkedCollection,
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

    // ============ GET SINGLE ROW (raw for edit) ============
    const getRow = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })
        const linkedCollectionId = typeof req.query.linkedCollectionId === 'string' ? req.query.linkedCollectionId : undefined
        if (linkedCollectionId && !UUID_REGEX.test(linkedCollectionId)) return res.status(400).json({ error: 'Invalid catalog ID format' })

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        const {
            linkedCollection,
            attrs,
            error: linkedCollectionError
        } = await resolveRuntimeLinkedCollection(ctx.manager, ctx.schemaIdent, linkedCollectionId)
        if (!linkedCollection) return res.status(404).json({ error: linkedCollectionError })
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            linkedCollection.lifecycleContract,
            linkedCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )

        const safeAttrs = attrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name) && a.data_type !== 'TABLE')
        const selectColumns = ['id', ...safeAttrs.map((a) => quoteIdentifier(a.column_name))]
        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(linkedCollection.table_name)}`

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
        for (const attr of safeAttrs) {
            const raw = row[attr.column_name] ?? null
            rawData[attr.column_name] = attr.data_type === 'NUMBER' && raw !== null ? pgNumericToNumber(raw) : raw
        }

        return res.json({ id: String(row.id), data: rawData })
    }

    // ============ DELETE ROW (soft) ============
    const deleteRow = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })
        const linkedCollectionId = typeof req.query.linkedCollectionId === 'string' ? req.query.linkedCollectionId : undefined
        if (linkedCollectionId && !UUID_REGEX.test(linkedCollectionId)) return res.status(400).json({ error: 'Invalid catalog ID format' })

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'deleteContent')) return

        const {
            linkedCollection,
            attrs,
            error: linkedCollectionError
        } = await resolveRuntimeLinkedCollection(ctx.manager, ctx.schemaIdent, linkedCollectionId)
        if (!linkedCollection) return res.status(404).json({ error: linkedCollectionError })

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(linkedCollection.table_name)}`
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            linkedCollection.lifecycleContract,
            linkedCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const runtimeDeleteSetClause = isSoftDeleteLifecycle(linkedCollection.lifecycleContract)
            ? buildRuntimeSoftDeleteSetClause('$1', linkedCollection.lifecycleContract, linkedCollection.config)
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

            await dispatchRuntimeLifecycle({
                manager: mgr,
                applicationId,
                schemaName: ctx.schemaName,
                linkedCollection,
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
                linkedCollection,
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

        const { orderedRowIds, linkedCollectionId: requestedLinkedCollectionId } = parsedBody.data
        const {
            linkedCollection,
            attrs,
            error: linkedCollectionError
        } = await resolveRuntimeLinkedCollection(ctx.manager, ctx.schemaIdent, requestedLinkedCollectionId)
        if (!linkedCollection) {
            return res.status(404).json({ error: linkedCollectionError })
        }

        const { runtimeConfig } = await resolveEffectiveLinkedCollectionRuntimeConfig({
            manager: ctx.manager,
            schemaName: ctx.schemaName,
            schemaIdent: ctx.schemaIdent,
            linkedCollectionId: linkedCollection.id
        })
        const reorderFieldAttr = resolveRuntimeReorderField(attrs, runtimeConfig.reorderPersistenceField)

        if (!runtimeConfig.enableRowReordering || !reorderFieldAttr) {
            return res.status(409).json({ error: 'Persisted row reordering is not enabled for this catalog' })
        }

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(linkedCollection.table_name)}`
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            linkedCollection.lifecycleContract,
            linkedCollection.config,
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
        getRow,
        deleteRow,
        reorderRows
    }
}
