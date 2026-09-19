import type { DbExecutor } from '@universo-react/utils'
import { generateChildTableName } from '@universo-react/schema-ddl'
import { resolveApplicationLifecycleContractFromConfig, resolveObjectCollectionLayoutBehaviorConfig } from '@universo-react/utils'
import { getObjectWorkspaceLimit, getObjectWorkspaceUsage } from '../../services/applicationWorkspaces'
import { isRuntimeRecordBehaviorEnabled, normalizeRuntimeRecordBehavior } from '../../services/runtimeRecordBehavior'
import {
    IDENTIFIER_REGEX,
    UpdateFailure,
    buildRuntimeActiveRowCondition,
    buildRuntimeDeletedRowCondition,
    quoteIdentifier,
    resolvePresentationName,
    resolveRuntimeCodenameText,
    resolveRuntimeValue,
    runtimeCodenameTextSql,
    runtimeStandardKindSql,
    type RuntimeDataType,
    type RuntimeRefOption,
    type RuntimeSchemaContext
} from '../../shared/runtimeHelpers'
import {
    RUNTIME_OBJECT_FILTER_SQL,
    RUNTIME_RECORD_SYSTEM_FIELDS,
    isRuntimeEnumerationKind,
    isRuntimeObjectTargetKind,
    resolveRuntimeStandardKind
} from '../runtimeRowSupport/contracts'
import { mapRuntimeComponentToColumnDefinition } from '../runtimeRowSupport/objects'
import { readConfiguredWorkflowActions } from '../runtimeRowSupport/workflow'
import {
    buildRuntimeListClauses,
    buildRuntimeRowsOrderBy,
    findUnsupportedRuntimeListFields,
    resolveRuntimeReorderField
} from '../runtimeRowSupport/list'
import { buildRuntimeLibraryViewClause, buildRuntimeRecordAccessClause } from '../runtimeRowSupport/access'
import { resolvePreferredScopeEntityIdFromGlobalMenu, resolveRuntimeEffectiveLayout } from '../runtimeRowSupport/menu'

import type {
    RuntimeReadChildComponent,
    RuntimeReadColumnDefinition,
    RuntimeReadComponent,
    RuntimeReadFailure,
    RuntimeReadObjectCollection,
    RuntimeReadQuery
} from './types'

export const loadRuntimeReadObjectCollections = async (params: { manager: DbExecutor; schemaIdent: string }) => {
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

export const loadRuntimeReadComponents = async (params: {
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

export const loadRuntimeReadEnumOptions = async (params: {
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

export const loadRuntimeReadObjectRefOptions = async (params: {
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

export const resolveRuntimeReadLayout = async (params: {
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

export const loadRuntimeReadRows = async (params: {
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

export const loadRuntimeReadWorkspaceLimit = async (params: {
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

export const buildRuntimeReadColumnDefinitions = (params: {
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
