import { type Request, type Response } from 'express'
import type { z } from 'zod'
import type { DbExecutor } from '@universo-react/utils'
import { generateChildTableName } from '@universo-react/schema-ddl'
import { normalizeRuntimePageBlocks } from '@universo-react/types'
import {
    normalizeDashboardSideMenuConfig,
    normalizeObjectCollectionRuntimeViewConfig,
    resolveApplicationLifecycleContractFromConfig,
    resolveObjectCollectionLayoutBehaviorConfig,
    resolveObjectCollectionRuntimeDashboardLayoutConfig
} from '@universo-react/utils'
import { getObjectWorkspaceLimit, getObjectWorkspaceUsage } from '../services/applicationWorkspaces'
import { isRuntimeRecordBehaviorEnabled, normalizeRuntimeRecordBehavior } from '../services/runtimeRecordBehavior'
import {
    IDENTIFIER_REGEX,
    UUID_REGEX,
    UpdateFailure,
    buildRuntimeActiveRowCondition,
    buildRuntimeDeletedRowCondition,
    normalizeLocale,
    pgNumericToNumber,
    quoteIdentifier,
    resolveLocalizedContent,
    resolvePresentationName,
    resolveRuntimeCodenameText,
    resolveRuntimeSchema,
    resolveRuntimeValue,
    runtimeCodenameTextSql,
    runtimeStandardKindSql,
    toRuntimeInputFormatErrorBody,
    createQueryHelper,
    type RuntimeDataType,
    type RuntimeRefOption,
    type RuntimeSchemaContext
} from '../shared/runtimeHelpers'
import {
    RUNTIME_OBJECT_FILTER_SQL,
    RUNTIME_RECORD_SYSTEM_FIELDS,
    isRuntimeEnumerationKind,
    isRuntimeHubKind,
    isRuntimeObjectTargetKind,
    partitionRuntimeMenuItems,
    resolveRuntimeStandardKind,
    runtimeQuerySchema,
    runtimeRecordsUnionBodySchema,
    type RuntimeZoneWidgets
} from './runtimeRowSupport/contracts'
import { mapRuntimeComponentToColumnDefinition, resolveRuntimeObjectCollection } from './runtimeRowSupport/objects'
import { readConfiguredWorkflowActions } from './runtimeRowSupport/workflow'
import {
    buildRuntimeListClauses,
    buildRuntimeRowsOrderBy,
    findUnsupportedRuntimeListFields,
    resolveRuntimeReorderField
} from './runtimeRowSupport/list'
import { buildRuntimeLibraryViewClause, buildRuntimeRecordAccessClause } from './runtimeRowSupport/access'
import { resolvePreferredScopeEntityIdFromGlobalMenu, resolveRuntimeEffectiveLayout } from './runtimeRowSupport/menu'
import { executeRuntimeRecordsUnionDatasource } from './runtimeRowSupport/union'
import {
    buildRuntimeAllObjectCollectionMenuItems,
    buildRuntimeBoundTreeEntityObjectCollectionItems,
    buildRuntimeTreeEntityMenuItems,
    buildRuntimeWorkspaceMenuItem,
    normalizeRuntimeMenuItem,
    resolveRuntimeMenuStartSectionTarget,
    resolveRuntimeMenuTreeEntityId,
    type RuntimeMenuEntry,
    type RuntimeMenuLookups,
    type RuntimeMenuItem,
    type RuntimeMenuStructure,
    type RuntimeObjectCollectionMeta,
    type RuntimeTreeEntityMeta,
    type RuntimeWorkspacePlacement
} from './runtimeRowSupport/menuItems'

/**
 * Read-only runtime row handlers (records union, runtime table payload and a
 * single row). Extracted from `runtimeRowsController` so the controller stays a
 * composition root; shared helpers live in `./runtimeRowSupport/*`.
 */
export interface RuntimeRowReadHandlerContext {
    getDbExecutor: () => DbExecutor
}

type RuntimeReadFailure = { statusCode: number; body: Record<string, unknown> }

type RuntimeReadQuery = z.infer<typeof runtimeQuerySchema>

type RuntimeReadComponent = {
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
}

type RuntimeReadChildComponent = RuntimeReadComponent & { parent_component_id: string }

type RuntimeReadObjectCollection = {
    id: string
    kind: string
    codename: unknown
    table_name: string | null
    presentation?: unknown
    config?: Record<string, unknown> | null
    lifecycleContract: ReturnType<typeof resolveApplicationLifecycleContractFromConfig>
}

type RuntimeReadRuntimeSection = {
    id: string
    kind: string
    codename: string
    tableName: string | null
    runtimeConfig:
        | ReturnType<typeof resolveObjectCollectionLayoutBehaviorConfig>
        | ReturnType<typeof normalizeObjectCollectionRuntimeViewConfig>
    recordBehavior: ReturnType<typeof normalizeRuntimeRecordBehavior> | undefined
    workflowActions: ReturnType<typeof readConfiguredWorkflowActions>
    name: string
}

type RuntimeReadColumnDefinition = {
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
    childColumns?: RuntimeReadColumnDefinition[]
}

const loadRuntimeReadObjectCollections = async (params: { manager: DbExecutor; schemaIdent: string }) => {
    const objectCollections = await params.manager.query(
        `
    SELECT id, kind, codename, table_name, presentation, config
    FROM ${params.schemaIdent}._app_objects
    WHERE (${RUNTIME_OBJECT_FILTER_SQL} OR ${runtimeStandardKindSql('kind')} = 'page')
      AND _upl_deleted = false
      AND _app_deleted = false
    ORDER BY ${runtimeCodenameTextSql('codename')} ASC, id ASC
  `
    )

    const typedObjects = objectCollections as Array<{
        id: string
        kind: string
        codename: unknown
        table_name: string | null
        presentation?: unknown
        config?: Record<string, unknown> | null
    }>

    const runtimeObjects: RuntimeReadObjectCollection[] = typedObjects.map((objectRow) => ({
        ...objectRow,
        lifecycleContract: resolveApplicationLifecycleContractFromConfig(objectRow.config)
    }))

    return { objectCollections, runtimeObjects }
}

export const resolveRuntimeReadActiveObjectCollection = async (params: {
    manager: DbExecutor
    schemaName: string
    schemaIdent: string
    runtimeObjects: RuntimeReadObjectCollection[]
    requestedSectionId: string | null
    requestedObjectCollectionId: string | null
    requestedObjectCollectionCodename: string | null
}): Promise<
    | {
          activeObjectCollection: RuntimeReadObjectCollection
          activeObjectCollectionKind: ReturnType<typeof resolveRuntimeStandardKind>
          isActivePage: boolean
          activeRecordBehavior: ReturnType<typeof normalizeRuntimeRecordBehavior>
          activeRecordBehaviorEnabled: boolean
          activeWorkflowActions: ReturnType<typeof readConfiguredWorkflowActions>
          includeRuntimeRowVersion: boolean
      }
    | { failure: RuntimeReadFailure }
> => {
    const requestedObjectCollectionId = params.requestedObjectCollectionId
    const requestedObjectCollectionCodename = params.requestedObjectCollectionCodename
    const preferredObjectCollectionIdFromMenu =
        requestedObjectCollectionId || requestedObjectCollectionCodename
            ? null
            : await resolvePreferredScopeEntityIdFromGlobalMenu({
                  manager: params.manager,
                  schemaName: params.schemaName,
                  schemaIdent: params.schemaIdent
              })

    const hasExplicitObjectSelector = Boolean(requestedObjectCollectionId || requestedObjectCollectionCodename)
    // Default and menu-derived selections must skip collections without a
    // runtime table (for example clones of set/enumeration presets with
    // physicalTable disabled); only an explicit selector may address them and
    // receive the fail-closed table-name error below.
    const isRuntimeTableBackedCollection = (objectRow: RuntimeReadObjectCollection): boolean =>
        resolveRuntimeStandardKind(objectRow.kind) === 'page' || IDENTIFIER_REGEX.test(objectRow.table_name ?? '')
    const matchedObjectCollection =
        (requestedObjectCollectionId
            ? params.runtimeObjects.find((objectRow) => objectRow.id === requestedObjectCollectionId)
            : undefined) ??
        (requestedObjectCollectionCodename
            ? params.runtimeObjects.find(
                  (objectRow) =>
                      resolveRuntimeCodenameText(objectRow.codename).trim().toLowerCase() ===
                      requestedObjectCollectionCodename.toLowerCase()
              )
            : undefined) ??
        (preferredObjectCollectionIdFromMenu
            ? params.runtimeObjects.find(
                  (objectRow) => objectRow.id === preferredObjectCollectionIdFromMenu && isRuntimeTableBackedCollection(objectRow)
              )
            : undefined)
    const activeObjectCollection =
        matchedObjectCollection ?? (hasExplicitObjectSelector ? undefined : params.runtimeObjects.find(isRuntimeTableBackedCollection))
    if (!activeObjectCollection) {
        return {
            failure: {
                statusCode: 404,
                body: {
                    error: 'Requested object not found in runtime schema',
                    details: {
                        sectionId: params.requestedSectionId,
                        objectCollectionId: params.requestedObjectCollectionId,
                        objectCollectionCodename: params.requestedObjectCollectionCodename
                    }
                }
            }
        }
    }

    const activeObjectCollectionKind = resolveRuntimeStandardKind(activeObjectCollection.kind)
    const isActivePage = activeObjectCollectionKind === 'page'
    if (!isActivePage && !IDENTIFIER_REGEX.test(activeObjectCollection.table_name ?? '')) {
        return { failure: { statusCode: 400, body: { error: 'Invalid runtime table name' } } }
    }
    const activeRecordBehavior = normalizeRuntimeRecordBehavior(activeObjectCollection.config)
    const activeRecordBehaviorEnabled = !isActivePage && isRuntimeRecordBehaviorEnabled(activeRecordBehavior)
    const activeWorkflowActions = isActivePage ? [] : readConfiguredWorkflowActions(activeObjectCollection.config)
    const includeRuntimeRowVersion = activeWorkflowActions.length > 0

    return {
        activeObjectCollection,
        activeObjectCollectionKind,
        isActivePage,
        activeRecordBehavior,
        activeRecordBehaviorEnabled,
        activeWorkflowActions,
        includeRuntimeRowVersion
    }
}

const loadRuntimeReadComponents = async (params: {
    manager: DbExecutor
    schemaIdent: string
    activeObjectCollection: RuntimeReadObjectCollection
    isActivePage: boolean
}): Promise<{
    safeComponents: RuntimeReadComponent[]
    physicalComponents: RuntimeReadComponent[]
    tableAttrs: RuntimeReadComponent[]
    childAttrsByTableId: Map<string, RuntimeReadChildComponent[]>
    allChildComponents: RuntimeReadChildComponent[]
}> => {
    const components = params.isActivePage
        ? []
        : ((await params.manager.query(
              `
    SELECT id, codename, column_name, data_type, is_required, is_display_component,
           presentation, validation_rules, sort_order, ui_config,
           target_object_id, target_object_kind
    FROM ${params.schemaIdent}._app_components
    WHERE object_id = $1
      AND data_type IN ('BOOLEAN', 'STRING', 'NUMBER', 'DATE', 'REF', 'JSON', 'TABLE')
      AND parent_component_id IS NULL
      AND _upl_deleted = false
      AND _app_deleted = false
    ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST, codename ASC
  `,
              [params.activeObjectCollection.id]
          )) as RuntimeReadComponent[])

    const safeComponents = components.filter((cmp) => IDENTIFIER_REGEX.test(cmp.column_name))
    const physicalComponents = safeComponents.filter((a) => a.data_type !== 'TABLE')

    const tableAttrs = safeComponents.filter((a) => a.data_type === 'TABLE')
    const childAttrsByTableId = new Map<string, RuntimeReadChildComponent[]>()
    if (tableAttrs.length > 0) {
        const tableAttrIds = tableAttrs.map((a) => a.id)
        const childAttrs = (await params.manager.query(
            `
      SELECT id, codename, column_name, data_type, is_required, is_display_component,
             presentation, validation_rules, sort_order, ui_config,
             target_object_id, target_object_kind, parent_component_id
      FROM ${params.schemaIdent}._app_components
      WHERE parent_component_id = ANY($1::uuid[])
        AND _upl_deleted = false
        AND _app_deleted = false
      ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST, codename ASC
    `,
            [tableAttrIds]
        )) as RuntimeReadChildComponent[]

        for (const child of childAttrs) {
            const list = childAttrsByTableId.get(child.parent_component_id) ?? []
            list.push(child)
            childAttrsByTableId.set(child.parent_component_id, list)
        }
    }

    const allChildComponents = Array.from(childAttrsByTableId.values()).flat()

    return { safeComponents, physicalComponents, tableAttrs, childAttrsByTableId, allChildComponents }
}

const loadRuntimeReadEnumOptions = async (params: {
    manager: DbExecutor
    schemaIdent: string
    requestedLocale: string
    safeComponents: RuntimeReadComponent[]
    allChildComponents: RuntimeReadChildComponent[]
}): Promise<Map<string, RuntimeRefOption[]>> => {
    const enumTargetObjectIds = Array.from(
        new Set([
            ...params.safeComponents
                .filter((cmp) => cmp.data_type === 'REF' && isRuntimeEnumerationKind(cmp.target_object_kind) && cmp.target_object_id)
                .map((cmp) => String(cmp.target_object_id)),
            ...params.allChildComponents
                .filter((cmp) => cmp.data_type === 'REF' && isRuntimeEnumerationKind(cmp.target_object_kind) && cmp.target_object_id)
                .map((cmp) => String(cmp.target_object_id))
        ])
    )

    const enumOptionsMap = new Map<string, RuntimeRefOption[]>()
    if (enumTargetObjectIds.length > 0) {
        const enumRows = (await params.manager.query(
            `
      SELECT id, object_id, codename, presentation, sort_order, is_default
      FROM ${params.schemaIdent}._app_values
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
                label: resolvePresentationName(row.presentation, params.requestedLocale, resolveRuntimeCodenameText(row.codename)),
                isDefault: row.is_default === true,
                sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0
            })
            enumOptionsMap.set(row.object_id, list)
        }
    }

    return enumOptionsMap
}

const loadRuntimeReadObjectRefOptions = async (params: {
    manager: DbExecutor
    schemaIdent: string
    runtimeContext: RuntimeSchemaContext
    requestedLocale: string
    safeComponents: RuntimeReadComponent[]
    allChildComponents: RuntimeReadChildComponent[]
}): Promise<Map<string, RuntimeRefOption[]>> => {
    const currentWorkspaceId = params.runtimeContext.currentWorkspaceId
    const objectTargetObjectIds = Array.from(
        new Set([
            ...params.safeComponents
                .filter((cmp) => cmp.data_type === 'REF' && isRuntimeObjectTargetKind(cmp.target_object_kind) && cmp.target_object_id)
                .map((cmp) => String(cmp.target_object_id)),
            ...params.allChildComponents
                .filter((cmp) => cmp.data_type === 'REF' && isRuntimeObjectTargetKind(cmp.target_object_kind) && cmp.target_object_id)
                .map((cmp) => String(cmp.target_object_id))
        ])
    )

    const objectRefOptionsMap = new Map<string, RuntimeRefOption[]>()
    if (objectTargetObjectIds.length > 0) {
        const targetObjects = (await params.manager.query(
            `
      SELECT id, kind, codename, table_name, config
      FROM ${params.schemaIdent}._app_objects
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

        const targetObjectAttrs = (await params.manager.query(
            `
      SELECT id, object_id, column_name, codename, data_type, is_required, validation_rules, target_object_id, target_object_kind, ui_config, is_display_component, sort_order
      FROM ${params.schemaIdent}._app_components
      WHERE object_id = ANY($1::uuid[])
        AND parent_component_id IS NULL
        AND _upl_deleted = false
        AND _app_deleted = false
      ORDER BY object_id ASC, is_display_component DESC, sort_order ASC, codename ASC
    `,
            [objectTargetObjectIds]
        )) as Array<{
            id: string
            object_id: string
            column_name: string
            codename: unknown
            data_type: RuntimeDataType
            is_required: boolean
            validation_rules?: Record<string, unknown>
            target_object_id?: string | null
            target_object_kind?: string | null
            ui_config?: Record<string, unknown>
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

            const targetTableIdent = `${params.schemaIdent}.${quoteIdentifier(targetObject.table_name)}`
            const targetAccessValues: unknown[] = []
            const targetAccessClause = await buildRuntimeRecordAccessClause({
                manager: params.manager,
                schemaIdent: params.schemaIdent,
                currentWorkspaceId,
                currentUserId: params.runtimeContext.userId,
                permissions: params.runtimeContext.permissions,
                objectCodename: resolveRuntimeCodenameText(targetObject.codename),
                attrs: targetAttrs,
                config: targetObject.config,
                outerRowIdSql: `${targetTableIdent}.id`,
                values: targetAccessValues
            })
            const targetWhereSql = [targetObjectActiveRowCondition, targetAccessClause]
                .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                .join(' AND ')

            const targetRows = (await params.manager.query(
                `
        SELECT id, ${selectLabelSql}
        FROM ${targetTableIdent}
        WHERE ${targetWhereSql}
        ORDER BY _upl_created_at ASC NULLS LAST, id ASC
        LIMIT 1000
      `,
                targetAccessValues
            )) as Array<{
                id: string
                label_value?: unknown
            }>

            const options: RuntimeRefOption[] = targetRows.map((row, index) => {
                const rawLabel = row.label_value
                const localizedLabel =
                    preferredDisplayAttr?.data_type === 'STRING'
                        ? resolveRuntimeValue(rawLabel, 'STRING', params.requestedLocale)
                        : rawLabel
                const label = typeof localizedLabel === 'string' && localizedLabel.trim().length > 0 ? localizedLabel : String(row.id)

                return {
                    id: row.id,
                    label,
                    codename: resolveRuntimeCodenameText(targetObject.codename),
                    isDefault: false,
                    sortOrder: index
                }
            })

            objectRefOptionsMap.set(targetObject.id, options)
        }
    }

    return objectRefOptionsMap
}

const resolveRuntimeReadLayout = async (params: {
    manager: DbExecutor
    applicationId: string
    runtimeContext: RuntimeSchemaContext
    isActivePage: boolean
    activeObjectCollection: RuntimeReadObjectCollection
    requestedLocale: string
    safeComponents: RuntimeReadComponent[]
}): Promise<
    | {
          selectedLayout: Awaited<ReturnType<typeof resolveRuntimeEffectiveLayout>>
          activeObjectCollectionRuntimeConfig: ReturnType<typeof resolveObjectCollectionLayoutBehaviorConfig>
          reorderFieldAttr: ReturnType<typeof resolveRuntimeReorderField>
      }
    | { failure: RuntimeReadFailure }
> => {
    let selectedLayout: Awaited<ReturnType<typeof resolveRuntimeEffectiveLayout>>
    try {
        selectedLayout = await resolveRuntimeEffectiveLayout({
            manager: params.manager,
            applicationId: params.applicationId,
            userId: params.runtimeContext.userId,
            role: params.runtimeContext.role,
            targetKind: params.isActivePage ? 'page' : 'object',
            entityTypeId: params.activeObjectCollection.id,
            workspaceId: params.runtimeContext.currentWorkspaceId,
            locale: params.requestedLocale
        })
    } catch (error) {
        if (error instanceof UpdateFailure) {
            return { failure: { statusCode: error.statusCode, body: error.body } }
        }
        throw error
    }
    const activeObjectCollectionRuntimeConfig = resolveObjectCollectionLayoutBehaviorConfig({
        layoutConfig: selectedLayout.layoutConfig
    })
    const reorderFieldAttr = resolveRuntimeReorderField(
        params.safeComponents,
        activeObjectCollectionRuntimeConfig.enableRowReordering ? activeObjectCollectionRuntimeConfig.reorderPersistenceField : null
    )

    return { selectedLayout, activeObjectCollectionRuntimeConfig, reorderFieldAttr }
}

const loadRuntimeReadRows = async (params: {
    manager: DbExecutor
    schemaIdent: string
    runtimeContext: RuntimeSchemaContext
    activeObjectCollection: RuntimeReadObjectCollection
    physicalComponents: RuntimeReadComponent[]
    safeComponents: RuntimeReadComponent[]
    tableAttrs: RuntimeReadComponent[]
    activeRecordBehaviorEnabled: boolean
    includeRuntimeRowVersion: boolean
    reorderFieldAttr: ReturnType<typeof resolveRuntimeReorderField>
    activeObjectCollectionRuntimeConfig: ReturnType<typeof resolveObjectCollectionLayoutBehaviorConfig>
    query: RuntimeReadQuery
    requestedLocale: string
}): Promise<
    | { total: number; rows: Array<Record<string, unknown> & { id: string }>; canPersistRowReordering: boolean }
    | { failure: RuntimeReadFailure }
> => {
    const currentWorkspaceId = params.runtimeContext.currentWorkspaceId
    const { lifecycleState, libraryView, search, sort, filters, limit, offset } = params.query
    const tableName = params.activeObjectCollection.table_name as string
    const dataTableIdent = `${params.schemaIdent}.${quoteIdentifier(tableName)}`
    const activeObjectRowCondition =
        lifecycleState === 'deleted'
            ? buildRuntimeDeletedRowCondition(
                  params.activeObjectCollection.lifecycleContract,
                  params.activeObjectCollection.config,
                  undefined,
                  currentWorkspaceId
              )
            : buildRuntimeActiveRowCondition(
                  params.activeObjectCollection.lifecycleContract,
                  params.activeObjectCollection.config,
                  undefined,
                  currentWorkspaceId
              )
    const unsupportedListFields = findUnsupportedRuntimeListFields(params.physicalComponents, sort, filters)
    if (unsupportedListFields.length > 0) {
        return {
            failure: {
                statusCode: 400,
                body: {
                    error: 'Runtime list query references unknown or unsupported fields',
                    fields: unsupportedListFields
                }
            }
        }
    }
    const runtimeListClauses = buildRuntimeListClauses({
        activeCondition: activeObjectRowCondition,
        attrs: params.physicalComponents,
        search,
        sort,
        filters,
        fallbackOrderBy: buildRuntimeRowsOrderBy(params.reorderFieldAttr?.column_name ?? null),
        currentUserId: params.runtimeContext.userId
    })
    const objectCodename = resolveRuntimeCodenameText(params.activeObjectCollection.codename)
    const recordAccessClause = await buildRuntimeRecordAccessClause({
        manager: params.manager,
        schemaIdent: params.schemaIdent,
        currentWorkspaceId,
        currentUserId: params.runtimeContext.userId,
        permissions: params.runtimeContext.permissions,
        objectCodename,
        attrs: params.safeComponents,
        config: params.activeObjectCollection.config,
        outerRowIdSql: `${dataTableIdent}.id`,
        values: runtimeListClauses.values
    })
    const libraryViewClause = await buildRuntimeLibraryViewClause({
        manager: params.manager,
        schemaIdent: params.schemaIdent,
        currentWorkspaceId,
        currentUserId: params.runtimeContext.userId,
        objectCodename,
        config: params.activeObjectCollection.config,
        libraryView,
        outerRowIdSql: `${dataTableIdent}.id`,
        values: runtimeListClauses.values
    })
    const runtimeListWhereSql = [runtimeListClauses.whereSql, recordAccessClause, libraryViewClause].filter(Boolean).join(' AND ')
    // Use physicalComponents for SQL because TABLE attrs have no physical column in the parent table.
    const selectColumns = [
        'id',
        ...(params.activeRecordBehaviorEnabled ? RUNTIME_RECORD_SYSTEM_FIELDS.map((field) => quoteIdentifier(field)) : []),
        ...(params.includeRuntimeRowVersion || lifecycleState === 'deleted' ? [quoteIdentifier('_upl_version')] : []),
        ...params.physicalComponents.map((cmp) => quoteIdentifier(cmp.column_name))
    ]

    for (const tAttr of params.tableAttrs) {
        const fallbackTabTableName = generateChildTableName(tAttr.id)
        const tabTableName =
            typeof tAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tAttr.column_name) ? tAttr.column_name : fallbackTabTableName
        if (!IDENTIFIER_REGEX.test(tabTableName)) continue
        const tabTableIdent = `${params.schemaIdent}.${quoteIdentifier(tabTableName)}`
        selectColumns.push(
            `(SELECT COUNT(*)::int FROM ${tabTableIdent} WHERE _tp_parent_id = ${dataTableIdent}.id AND ${activeObjectRowCondition}) AS ${quoteIdentifier(
                tAttr.column_name
            )}`
        )
    }

    const totalRows = (await params.manager.query(
        `
    SELECT COUNT(*)::int AS total
    FROM ${dataTableIdent}
    WHERE ${runtimeListWhereSql}
  `,
        runtimeListClauses.values
    )) as Array<{ total: number }>
    const total = typeof totalRows[0]?.total === 'number' ? totalRows[0].total : Number(totalRows[0]?.total) || 0

    const pageValues = [...runtimeListClauses.values, limit, offset]
    const rawRows = (await params.manager.query(
        `
    SELECT ${selectColumns.join(', ')}
    FROM ${dataTableIdent}
    WHERE ${runtimeListWhereSql}
    ORDER BY ${runtimeListClauses.orderBySql}
    LIMIT $${runtimeListClauses.values.length + 1} OFFSET $${runtimeListClauses.values.length + 2}
  `,
        pageValues
    )) as Array<Record<string, unknown>>

    const hasRuntimeListModifiers = Boolean(search?.trim() || sort?.length || filters?.length)
    const canPersistRowReordering =
        params.activeObjectCollectionRuntimeConfig.enableRowReordering &&
        Boolean(params.reorderFieldAttr) &&
        offset === 0 &&
        total <= limit &&
        !hasRuntimeListModifiers

    const rows = rawRows.map((row) => {
        const mappedRow: Record<string, unknown> & { id: string } = {
            id: String(row.id)
        }

        if (params.activeRecordBehaviorEnabled) {
            for (const field of RUNTIME_RECORD_SYSTEM_FIELDS) {
                mappedRow[field] = row[field] ?? null
            }
        }
        if (params.includeRuntimeRowVersion) {
            mappedRow._upl_version = row._upl_version ?? null
        }
        if (lifecycleState === 'deleted') {
            mappedRow._upl_version = row._upl_version ?? null
        }

        for (const component of params.safeComponents) {
            if (component.data_type === 'TABLE') {
                mappedRow[component.column_name] = typeof row[component.column_name] === 'number' ? row[component.column_name] : 0
                continue
            }
            mappedRow[component.column_name] = resolveRuntimeValue(row[component.column_name], component.data_type, params.requestedLocale)
        }

        return mappedRow
    })

    return { total, rows, canPersistRowReordering }
}

const loadRuntimeReadWorkspaceLimit = async (params: {
    manager: DbExecutor
    runtimeContext: RuntimeSchemaContext
    isActivePage: boolean
    activeObjectCollection: RuntimeReadObjectCollection
    schemaName: string
}): Promise<{ maxRows: number | null; currentRows: number; canCreate: boolean } | undefined> => {
    const currentWorkspaceId = params.runtimeContext.currentWorkspaceId
    if (params.isActivePage || !params.runtimeContext.workspacesEnabled || !currentWorkspaceId) {
        return undefined
    }

    const maxRows = await getObjectWorkspaceLimit(params.manager, {
        schemaName: params.schemaName,
        objectId: params.activeObjectCollection.id
    })
    const currentRows = await getObjectWorkspaceUsage(params.manager, {
        schemaName: params.schemaName,
        tableName: params.activeObjectCollection.table_name as string,
        workspaceId: currentWorkspaceId,
        runtimeRowCondition: buildRuntimeActiveRowCondition(
            params.activeObjectCollection.lifecycleContract,
            params.activeObjectCollection.config,
            undefined,
            currentWorkspaceId
        )
    })

    return {
        maxRows,
        currentRows,
        canCreate: maxRows === null ? true : currentRows < maxRows
    }
}

const buildRuntimeReadSections = (params: {
    runtimeObjects: RuntimeReadObjectCollection[]
    activeObjectCollection: RuntimeReadObjectCollection
    activeObjectCollectionRuntimeConfig: ReturnType<typeof resolveObjectCollectionLayoutBehaviorConfig>
    requestedLocale: string
    canPersistRowReordering: boolean
    selectedLayout: Awaited<ReturnType<typeof resolveRuntimeEffectiveLayout>>
}): {
    layoutConfig: ReturnType<typeof resolveObjectCollectionRuntimeDashboardLayoutConfig>
    objectCollectionsForRuntime: RuntimeReadRuntimeSection[]
    runtimeMenuTargetById: Map<string, RuntimeReadRuntimeSection>
    zoneWidgets: RuntimeZoneWidgets
} => {
    let layoutConfig = resolveObjectCollectionRuntimeDashboardLayoutConfig({ layoutConfig: params.selectedLayout.layoutConfig })
    layoutConfig = {
        ...layoutConfig,
        enableRowReordering: params.canPersistRowReordering
    }

    const objectCollectionsForRuntime: RuntimeReadRuntimeSection[] = params.runtimeObjects.map((objectRow) => ({
        id: objectRow.id,
        kind: resolveRuntimeStandardKind(objectRow.kind) ?? 'object',
        codename: resolveRuntimeCodenameText(objectRow.codename),
        tableName: objectRow.table_name,
        runtimeConfig:
            objectRow.id === params.activeObjectCollection.id
                ? params.activeObjectCollectionRuntimeConfig
                : normalizeObjectCollectionRuntimeViewConfig(undefined),
        recordBehavior:
            resolveRuntimeStandardKind(objectRow.kind) === 'page' ? undefined : normalizeRuntimeRecordBehavior(objectRow.config),
        workflowActions: resolveRuntimeStandardKind(objectRow.kind) === 'page' ? [] : readConfiguredWorkflowActions(objectRow.config),
        name: resolvePresentationName(objectRow.presentation, params.requestedLocale, resolveRuntimeCodenameText(objectRow.codename))
    }))
    const runtimeMenuTargetById = new Map(objectCollectionsForRuntime.map((section) => [section.id, section]))

    const zoneWidgets = params.selectedLayout.zoneWidgets

    return { layoutConfig, objectCollectionsForRuntime, runtimeMenuTargetById, zoneWidgets }
}

const loadRuntimeMenuStructure = async (params: {
    manager: DbExecutor
    schemaIdent: string
    requestedLocale: string
}): Promise<RuntimeMenuStructure> => {
    let treeEntityMetaById = new Map<string, RuntimeTreeEntityMeta>()
    let treeEntityMetaByCodename = new Map<string, RuntimeTreeEntityMeta>()
    let objectCollectionMetaById = new Map<string, RuntimeObjectCollectionMeta>()
    let objectCollectionMetaByCodename = new Map<string, RuntimeObjectCollectionMeta>()
    let childTreeEntityIdsByParent = new Map<string, string[]>()
    let objectCollectionsByTreeEntity = new Map<string, RuntimeObjectCollectionMeta[]>()

    try {
        const objectRows = (await params.manager.query(
            `
      SELECT id, kind, codename, presentation, config, table_name
      FROM ${params.schemaIdent}._app_objects
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
            table_name?: string | null
        }>

        for (const row of objectRows) {
            // Tree/bound menu items must resolve: object collections without a
            // physical runtime table fail closed when opened, so they never
            // become navigation targets (hubs and pages are not table-backed).
            const isHubRow = isRuntimeHubKind(row.kind)
            const isPageRow = resolveRuntimeStandardKind(row.kind) === 'page'
            if (!isHubRow && !isPageRow && !IDENTIFIER_REGEX.test(row.table_name ?? '')) continue

            const config = row.config && typeof row.config === 'object' ? (row.config as Record<string, unknown>) : {}
            const rawSortOrder = config.sortOrder
            const sortOrder = typeof rawSortOrder === 'number' ? rawSortOrder : 0
            const title = resolvePresentationName(row.presentation, params.requestedLocale, resolveRuntimeCodenameText(row.codename))

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
                kind: resolveRuntimeStandardKind(row.kind),
                title,
                sortOrder,
                treeEntityIds
            }
            objectCollectionMetaById.set(row.id, objectCollectionMeta)
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
        objectCollectionMetaById = new Map()
        objectCollectionMetaByCodename = new Map()
        childTreeEntityIdsByParent = new Map()
        objectCollectionsByTreeEntity = new Map()
    }

    return {
        treeEntityMetaById,
        treeEntityMetaByCodename,
        objectCollectionMetaById,
        objectCollectionMetaByCodename,
        childTreeEntityIdsByParent,
        objectCollectionsByTreeEntity
    }
}

const buildRuntimeReadMenus = (params: {
    objectCollectionsForRuntime: RuntimeReadRuntimeSection[]
    runtimeMenuTargetById: Map<string, RuntimeReadRuntimeSection>
    menuStructure: RuntimeMenuStructure
    zoneWidgets: RuntimeZoneWidgets
    requestedLocale: string
    applicationId: string
    workspacesEnabled: boolean
}): { menus: RuntimeMenuEntry[]; activeMenuId: string | null } => {
    const lookups: RuntimeMenuLookups = {
        runtimeMenuTargetById: params.runtimeMenuTargetById,
        objectCollectionMetaById: params.menuStructure.objectCollectionMetaById,
        objectCollectionMetaByCodename: params.menuStructure.objectCollectionMetaByCodename,
        treeEntityMetaById: params.menuStructure.treeEntityMetaById,
        treeEntityMetaByCodename: params.menuStructure.treeEntityMetaByCodename,
        childTreeEntityIdsByParent: params.menuStructure.childTreeEntityIdsByParent,
        objectCollectionsByTreeEntity: params.menuStructure.objectCollectionsByTreeEntity
    }

    let menus: RuntimeMenuEntry[] = []
    let activeMenuId: string | null = null

    try {
        for (const widget of params.zoneWidgets.left) {
            if (widget.widgetKey !== 'menuWidget') continue
            const cfg = widget.config as Record<string, unknown>
            const bindToTreeEntity = Boolean(cfg.bindToHub)
            const boundTreeEntityId = resolveRuntimeMenuTreeEntityId({
                treeEntityMetaById: lookups.treeEntityMetaById,
                treeEntityMetaByCodename: lookups.treeEntityMetaByCodename,
                value: cfg.boundHubId ?? cfg.boundTreeEntityId
            })
            const autoShowAllSections = Boolean(cfg.autoShowAllSections) && !bindToTreeEntity

            let resolvedItems: RuntimeMenuItem[] = []
            if (bindToTreeEntity && boundTreeEntityId) {
                resolvedItems = buildRuntimeBoundTreeEntityObjectCollectionItems({
                    treeEntityMetaById: lookups.treeEntityMetaById,
                    objectCollectionsByTreeEntity: lookups.objectCollectionsByTreeEntity,
                    widgetId: widget.id,
                    boundTreeEntityId
                })
            } else if (autoShowAllSections) {
                resolvedItems = buildRuntimeAllObjectCollectionMenuItems({
                    // Menu entries must resolve: non-tabular collections (set/
                    // enumeration clones without a physical table) fail closed
                    // when opened, so they never become navigation targets.
                    sections: params.objectCollectionsForRuntime.filter(
                        (section) => section.kind === 'page' || IDENTIFIER_REGEX.test(section.tableName ?? '')
                    ),
                    widgetId: widget.id
                })
            } else {
                const rawItems = Array.isArray(cfg.items) ? cfg.items : []
                const normalizedItems = rawItems
                    .map((item) => normalizeRuntimeMenuItem({ ...lookups, locale: params.requestedLocale, item }))
                    .filter((item): item is RuntimeMenuItem => item !== null)
                    .sort((a, b) => a.sortOrder - b.sortOrder)

                for (const item of normalizedItems) {
                    if (isRuntimeHubKind(item.kind)) {
                        const expanded = buildRuntimeTreeEntityMenuItems({
                            treeEntityMetaById: lookups.treeEntityMetaById,
                            childTreeEntityIdsByParent: lookups.childTreeEntityIdsByParent,
                            objectCollectionsByTreeEntity: lookups.objectCollectionsByTreeEntity,
                            baseItem: item
                        })
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
            if (params.workspacesEnabled) {
                workspaceItem = buildRuntimeWorkspaceMenuItem({
                    sortOrder: resolvedItems.length + 1000,
                    locale: params.requestedLocale,
                    applicationId: params.applicationId
                })
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
                title: resolveLocalizedContent(cfg.title, params.requestedLocale, ''),
                autoShowAllSections,
                startPage: typeof cfg.startPage === 'string' ? cfg.startPage : null,
                startSectionId:
                    resolveRuntimeMenuStartSectionTarget({
                        ...lookups,
                        value: cfg.startPage,
                        target: cfg.startTarget,
                        items: resolvedItems
                    })?.id ?? null,
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

    return { menus, activeMenuId }
}

const buildRuntimeReadColumnDefinitions = (params: {
    safeComponents: RuntimeReadComponent[]
    enumOptionsMap: Map<string, RuntimeRefOption[]>
    objectRefOptionsMap: Map<string, RuntimeRefOption[]>
    childAttrsByTableId: Map<string, RuntimeReadChildComponent[]>
    requestedLocale: string
}): RuntimeReadColumnDefinition[] => {
    return params.safeComponents.map((component) =>
        mapRuntimeComponentToColumnDefinition({
            component,
            enumOptionsMap: params.enumOptionsMap,
            objectRefOptionsMap: params.objectRefOptionsMap,
            childAttrsByTableId: params.childAttrsByTableId,
            includeChildColumns: true,
            locale: params.requestedLocale
        })
    )
}

const buildRuntimeReadResponsePayload = (params: {
    runtimeContext: RuntimeSchemaContext
    activeObjectCollection: RuntimeReadObjectCollection
    activeObjectCollectionKind: ReturnType<typeof resolveRuntimeStandardKind>
    isActivePage: boolean
    activeRecordBehavior: ReturnType<typeof normalizeRuntimeRecordBehavior>
    activeWorkflowActions: ReturnType<typeof readConfiguredWorkflowActions>
    activeObjectCollectionRuntimeConfig: ReturnType<typeof resolveObjectCollectionLayoutBehaviorConfig>
    canPersistRowReordering: boolean
    requestedLocale: string
    objectCollectionsForRuntime: RuntimeReadRuntimeSection[]
    columns: RuntimeReadColumnDefinition[]
    rows: Array<Record<string, unknown> & { id: string }>
    total: number
    limit: number
    offset: number
    workspaceLimit: { maxRows: number | null; currentRows: number; canCreate: boolean } | undefined
    layoutConfig: ReturnType<typeof resolveObjectCollectionRuntimeDashboardLayoutConfig>
    zoneWidgets: RuntimeZoneWidgets
    menus: RuntimeMenuEntry[]
    activeMenuId: string | null
}): Record<string, unknown> => {
    const activeSectionPayload = {
        id: params.activeObjectCollection.id,
        kind: params.activeObjectCollectionKind ?? 'object',
        codename: resolveRuntimeCodenameText(params.activeObjectCollection.codename),
        tableName: params.activeObjectCollection.table_name,
        pageBlocks: params.isActivePage ? normalizeRuntimePageBlocks(params.activeObjectCollection.config?.blockContent) : undefined,
        runtimeConfig: {
            ...params.activeObjectCollectionRuntimeConfig,
            enableRowReordering: params.canPersistRowReordering
        },
        recordBehavior: params.isActivePage ? undefined : params.activeRecordBehavior,
        workflowActions: params.activeWorkflowActions,
        name: resolvePresentationName(
            params.activeObjectCollection.presentation,
            params.requestedLocale,
            resolveRuntimeCodenameText(params.activeObjectCollection.codename)
        )
    }

    return {
        section: activeSectionPayload,
        sections: params.objectCollectionsForRuntime,
        activeSectionId: params.activeObjectCollection.id,
        objectCollection: {
            ...activeSectionPayload
        },
        objectCollections: params.objectCollectionsForRuntime,
        activeObjectCollectionId: params.isActivePage ? null : params.activeObjectCollection.id,
        columns: params.columns,
        rows: params.rows,
        pagination: {
            total: typeof params.total === 'number' ? params.total : Number(params.total) || 0,
            limit: params.limit,
            offset: params.offset
        },
        ...(params.workspaceLimit ? { workspaceLimit: params.workspaceLimit } : {}),
        settings: params.runtimeContext.applicationSettings,
        workspacesEnabled: params.runtimeContext.workspacesEnabled,
        currentWorkspaceId: params.runtimeContext.currentWorkspaceId,
        permissions: params.runtimeContext.permissions,
        workflowCapabilities: params.runtimeContext.workflowCapabilities,
        layoutConfig: params.layoutConfig,
        zoneWidgets: params.zoneWidgets,
        menus: params.menus,
        activeMenuId: params.activeMenuId
    }
}

export function createRuntimeRowReadHandlers({ getDbExecutor }: RuntimeRowReadHandlerContext) {
    const query = createQueryHelper(getDbExecutor)

    const listRecordsUnionDatasource = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const parsedBody = runtimeRecordsUnionBodySchema.safeParse(req.body)
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const { datasource, limit, offset, locale } = parsedBody.data
        const requestedLocale = normalizeLocale(locale)
        const runtimeContext = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!runtimeContext) return

        try {
            const payload = await executeRuntimeRecordsUnionDatasource({
                runtimeContext,
                applicationId,
                datasource,
                limit,
                offset,
                locale: requestedLocale
            })
            return res.json(payload)
        } catch (error) {
            if (error instanceof UpdateFailure) {
                return res.status(error.statusCode).json(error.body)
            }
            const formatError = toRuntimeInputFormatErrorBody(error)
            if (formatError) {
                return res.status(400).json(formatError)
            }
            throw error
        }
    }

    // ============ GET RUNTIME TABLE ============

    const getRuntime = async (req: Request, res: Response) => {
        const { applicationId } = req.params

        const parsedQuery = runtimeQuerySchema.safeParse(req.query)
        if (!parsedQuery.success) {
            return res.status(400).json({ error: 'Invalid query', details: parsedQuery.error.flatten() })
        }

        const { limit, offset, locale } = parsedQuery.data
        const requestedLocale = normalizeLocale(locale)
        const requestedSectionId = parsedQuery.data.sectionId ?? null
        const requestedObjectCollectionId = parsedQuery.data.objectCollectionId ?? requestedSectionId ?? null
        const requestedObjectCollectionCodename = parsedQuery.data.objectCollectionCodename?.trim() || null
        const runtimeContext = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!runtimeContext) return

        const { schemaName, schemaIdent } = runtimeContext
        const manager = runtimeContext.manager

        const { objectCollections, runtimeObjects } = await loadRuntimeReadObjectCollections({ manager, schemaIdent })
        if (objectCollections.length === 0) {
            return res.status(404).json({ error: 'No objectCollections available in application runtime schema' })
        }

        const activeResult = await resolveRuntimeReadActiveObjectCollection({
            manager,
            schemaName,
            schemaIdent,
            runtimeObjects,
            requestedSectionId,
            requestedObjectCollectionId,
            requestedObjectCollectionCodename
        })
        if ('failure' in activeResult) {
            return res.status(activeResult.failure.statusCode).json(activeResult.failure.body)
        }
        const {
            activeObjectCollection,
            activeObjectCollectionKind,
            isActivePage,
            activeRecordBehavior,
            activeRecordBehaviorEnabled,
            activeWorkflowActions,
            includeRuntimeRowVersion
        } = activeResult

        const { safeComponents, physicalComponents, tableAttrs, childAttrsByTableId, allChildComponents } = await loadRuntimeReadComponents(
            {
                manager,
                schemaIdent,
                activeObjectCollection,
                isActivePage
            }
        )

        const enumOptionsMap = await loadRuntimeReadEnumOptions({
            manager,
            schemaIdent,
            requestedLocale,
            safeComponents,
            allChildComponents
        })

        const objectRefOptionsMap = await loadRuntimeReadObjectRefOptions({
            manager,
            schemaIdent,
            runtimeContext,
            requestedLocale,
            safeComponents,
            allChildComponents
        })

        const layoutResult = await resolveRuntimeReadLayout({
            manager,
            applicationId,
            runtimeContext,
            isActivePage,
            activeObjectCollection,
            requestedLocale,
            safeComponents
        })
        if ('failure' in layoutResult) {
            return res.status(layoutResult.failure.statusCode).json(layoutResult.failure.body)
        }
        const { selectedLayout, activeObjectCollectionRuntimeConfig, reorderFieldAttr } = layoutResult

        let total = 0
        let rows: Array<Record<string, unknown> & { id: string }> = []
        let canPersistRowReordering = false

        if (!isActivePage) {
            const rowsResult = await loadRuntimeReadRows({
                manager,
                schemaIdent,
                runtimeContext,
                activeObjectCollection,
                physicalComponents,
                safeComponents,
                tableAttrs,
                activeRecordBehaviorEnabled,
                includeRuntimeRowVersion,
                reorderFieldAttr,
                activeObjectCollectionRuntimeConfig,
                query: parsedQuery.data,
                requestedLocale
            })
            if ('failure' in rowsResult) {
                return res.status(rowsResult.failure.statusCode).json(rowsResult.failure.body)
            }
            total = rowsResult.total
            rows = rowsResult.rows
            canPersistRowReordering = rowsResult.canPersistRowReordering
        }

        const workspaceLimit = await loadRuntimeReadWorkspaceLimit({
            manager,
            runtimeContext,
            isActivePage,
            activeObjectCollection,
            schemaName
        })

        const {
            layoutConfig: initialLayoutConfig,
            objectCollectionsForRuntime,
            runtimeMenuTargetById,
            zoneWidgets
        } = buildRuntimeReadSections({
            runtimeObjects,
            activeObjectCollection,
            activeObjectCollectionRuntimeConfig,
            requestedLocale,
            canPersistRowReordering,
            selectedLayout
        })
        let layoutConfig = initialLayoutConfig

        const menuStructure = await loadRuntimeMenuStructure({ manager, schemaIdent, requestedLocale })
        const { menus, activeMenuId } = buildRuntimeReadMenus({
            objectCollectionsForRuntime,
            runtimeMenuTargetById,
            menuStructure,
            zoneWidgets,
            requestedLocale,
            applicationId,
            workspacesEnabled: runtimeContext.workspacesEnabled
        })

        const sideMenuWidgetConfig = zoneWidgets.left.find(
            (widget) => widget.widgetKey === 'menuWidget' && widget.config && typeof widget.config.sideMenu === 'object'
        )?.config.sideMenu
        if (sideMenuWidgetConfig && (layoutConfig.sideMenu === undefined || layoutConfig.sideMenu === null)) {
            layoutConfig = {
                ...layoutConfig,
                sideMenu: normalizeDashboardSideMenuConfig(sideMenuWidgetConfig)
            }
        }

        const columns = buildRuntimeReadColumnDefinitions({
            safeComponents,
            enumOptionsMap,
            objectRefOptionsMap,
            childAttrsByTableId,
            requestedLocale
        })

        return res.json(
            buildRuntimeReadResponsePayload({
                runtimeContext,
                activeObjectCollection,
                activeObjectCollectionKind,
                isActivePage,
                activeRecordBehavior,
                activeWorkflowActions,
                activeObjectCollectionRuntimeConfig,
                canPersistRowReordering,
                requestedLocale,
                objectCollectionsForRuntime,
                columns,
                rows,
                total,
                limit,
                offset,
                workspaceLimit,
                layoutConfig,
                zoneWidgets,
                menus,
                activeMenuId
            })
        )
    }

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
        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`

        const rowValues: unknown[] = [rowId]
        const recordAccessClause = await buildRuntimeRecordAccessClause({
            manager: ctx.manager,
            schemaIdent: ctx.schemaIdent,
            currentWorkspaceId: ctx.currentWorkspaceId,
            currentUserId: ctx.userId,
            permissions: ctx.permissions,
            objectCodename: resolveRuntimeCodenameText(objectCollection.codename),
            attrs,
            config: objectCollection.config,
            outerRowIdSql: `${dataTableIdent}.id`,
            values: rowValues
        })
        const safeAttrs = attrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name) && a.data_type !== 'TABLE')
        const selectColumns = ['id', ...safeAttrs.map((a) => quoteIdentifier(a.column_name)), quoteIdentifier('_upl_version')]
        const whereSql = ['id = $1', runtimeRowCondition, recordAccessClause]
            .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
            .join(' AND ')

        const rows = (await ctx.manager.query(
            `
    SELECT ${selectColumns.join(', ')}
    FROM ${dataTableIdent}
    WHERE ${whereSql}
  `,
            rowValues
        )) as Array<Record<string, unknown>>

        if (rows.length === 0) return res.status(404).json({ error: 'Row not found' })

        const row = rows[0]
        const rawData: Record<string, unknown> = {}
        for (const cmp of safeAttrs) {
            const raw = row[cmp.column_name] ?? null
            rawData[cmp.column_name] = cmp.data_type === 'NUMBER' && raw !== null ? pgNumericToNumber(raw) : raw
        }

        return res.json({ id: String(row.id), version: Number(row._upl_version ?? 1), data: rawData })
    }

    // ============ DELETE ROW (soft) ============

    return { listRecordsUnionDatasource, getRuntime, getRow }
}
