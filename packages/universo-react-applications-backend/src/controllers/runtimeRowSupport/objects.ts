import { type DbExecutor } from '@universo-react/utils'
import { resolveObjectCollectionLayoutBehaviorConfig, resolveApplicationLifecycleContractFromConfig } from '@universo-react/utils'
import { resolveEffectiveLayoutForRequest } from '../../services/effectiveLayoutResolver'
import {
    IDENTIFIER_REGEX,
    quoteIdentifier,
    runtimeCodenameTextSql,
    runtimeStandardKindSql,
    resolveRuntimeCodenameText,
    resolvePresentationName,
    pgNumericToNumber,
    getSetConstantConfig,
    resolveSetConstantLabel,
    type RuntimeRefOption,
    type SetConstantUiConfig
} from '../../shared/runtimeHelpers'
import {
    RUNTIME_OBJECT_FILTER_SQL,
    isRuntimeEnumerationKind,
    isRuntimeObjectTargetKind,
    isRuntimeSetKind,
    resolveRuntimeStandardKind,
    type RuntimeColumnDefinition,
    type RuntimeObjectCollectionAttr,
    type RuntimeObjectCollectionRow,
    type RuntimeReadableComponent,
    isRuntimeServerOwnedAttr,
    readRuntimeRecordAccessConfig
} from './contracts'
import { resolveRuntimeEffectiveLayout } from './menu'

export const loadRuntimeObjectAttrs = async (
    manager: DbExecutor,
    schemaIdent: string,
    objectId: string
): Promise<RuntimeObjectCollectionAttr[]> => {
    return (await manager.query(
        `
      SELECT id, codename, column_name, data_type, is_required, validation_rules,
             target_object_id, target_object_kind, ui_config
      FROM ${schemaIdent}._app_components
      WHERE object_id = $1
        AND parent_component_id IS NULL
        AND _upl_deleted = false
        AND _app_deleted = false
      ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST
    `,
        [objectId]
    )) as RuntimeObjectCollectionAttr[]
}

/**
 * Resolve a runtime row section and load its components from a runtime schema.
 */

/**
 * Resolve a runtime row section and load its components from a runtime schema.
 */
export const resolveRuntimeObjectCollection = async (manager: DbExecutor, schemaIdent: string, requestedObjectCollectionId?: string) => {
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

    // Write endpoints must not default to a collection without a physical
    // runtime table (custom clones of set/enumeration presets); explicit ids
    // keep failing closed with the table-name error below.
    const selectedObjectCollection = requestedObjectCollectionId
        ? objectCollections.find((c) => c.id === requestedObjectCollectionId)
        : objectCollections.find((c) => IDENTIFIER_REGEX.test(c.table_name ?? ''))
    const objectCollection = selectedObjectCollection
        ? {
              ...selectedObjectCollection,
              lifecycleContract: resolveApplicationLifecycleContractFromConfig(selectedObjectCollection.config)
          }
        : null
    if (!objectCollection) return { objectCollection: null, attrs: [], error: 'Record collection not found' } as const
    if (typeof objectCollection.table_name !== 'string' || !IDENTIFIER_REGEX.test(objectCollection.table_name))
        return { objectCollection: null, attrs: [], error: 'Invalid table name' } as const

    const attrs = await loadRuntimeObjectAttrs(manager, schemaIdent, objectCollection.id)

    return { objectCollection, attrs, error: null } as const
}

export const resolveRuntimeObjectCollectionByCodename = async (
    manager: DbExecutor,
    schemaIdent: string,
    codename: string
): Promise<{
    id: string
    codename: string
    tableName: string
    config?: Record<string, unknown> | null
    attrs: RuntimeObjectCollectionAttr[]
} | null> => {
    const rows = (await manager.query(
        `
      SELECT id, codename, table_name, config
      FROM ${schemaIdent}._app_objects
      WHERE LOWER(${runtimeCodenameTextSql('codename')}) = LOWER($1)
        AND ${RUNTIME_OBJECT_FILTER_SQL}
        AND _upl_deleted = false
        AND _app_deleted = false
      LIMIT 1
    `,
        [codename]
    )) as Array<{ id: string; codename: unknown; table_name: string; config?: Record<string, unknown> | null }>

    const row = rows[0]
    if (!row || !IDENTIFIER_REGEX.test(row.table_name)) return null

    return {
        id: row.id,
        codename: resolveRuntimeCodenameText(row.codename),
        tableName: row.table_name,
        config: row.config,
        attrs: await loadRuntimeObjectAttrs(manager, schemaIdent, row.id)
    }
}

export const resolveRuntimeRecordOwnerColumnName = (
    attrs: RuntimeObjectCollectionAttr[],
    config: Record<string, unknown> | null | undefined
): string | null => {
    const accessConfig = readRuntimeRecordAccessConfig(config)
    if (!accessConfig) return null

    const ownerAttr = accessConfig.ownerFieldCodename ? findRuntimeAttrByFieldKey(attrs, accessConfig.ownerFieldCodename) : undefined
    const ownerColumnName = ownerAttr?.column_name ?? accessConfig.ownerColumnName

    return ownerColumnName && IDENTIFIER_REGEX.test(ownerColumnName) ? ownerColumnName : null
}

export const findRuntimeAttrByFieldKey = (
    attrs: RuntimeObjectCollectionAttr[],
    fieldKey: string
): RuntimeObjectCollectionAttr | undefined => buildRuntimeAttrLookup(attrs).get(fieldKey.trim().toLowerCase())

export const buildRuntimeAttrLookup = (attrs: RuntimeObjectCollectionAttr[]): Map<string, RuntimeObjectCollectionAttr> => {
    const attrsByKey = new Map<string, RuntimeObjectCollectionAttr>()
    for (const attr of attrs) {
        const columnName = attr.column_name.trim()
        const codename = resolveRuntimeCodenameText(attr.codename).trim()
        attrsByKey.set(columnName, attr)
        attrsByKey.set(columnName.toLowerCase(), attr)
        attrsByKey.set(codename, attr)
        attrsByKey.set(codename.toLowerCase(), attr)
    }
    return attrsByKey
}

export const readRuntimeAttrValue = (row: Record<string, unknown>, attr: RuntimeObjectCollectionAttr): unknown =>
    row[attr.column_name] ?? row[resolveRuntimeCodenameText(attr.codename)]

export const findRuntimeSystemKeyAttr = (
    attrs: Array<{ codename: unknown; column_name: string; ui_config?: Record<string, unknown> | null }>
): { column_name: string } | undefined =>
    attrs.find((attr) => attr.codename === 'SystemKey' && IDENTIFIER_REGEX.test(attr.column_name) && isRuntimeServerOwnedAttr(attr))

export const readRuntimeAttrStringValue = (row: Record<string, unknown>, attr: RuntimeObjectCollectionAttr | undefined): string | null => {
    if (!attr) return null
    const value = row[attr.column_name] ?? row[resolveRuntimeCodenameText(attr.codename)]
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

export const resolveRuntimeObjectCollectionConfig = async (params: {
    manager: DbExecutor
    applicationId: string
    userId: string
    role: Parameters<typeof resolveEffectiveLayoutForRequest>[1]['role']
    workspaceId: string | null
    locale?: string
    objectCollectionId: string
}) => {
    const selectedLayout = await resolveRuntimeEffectiveLayout({
        manager: params.manager,
        applicationId: params.applicationId,
        userId: params.userId,
        role: params.role,
        targetKind: 'object',
        entityTypeId: params.objectCollectionId,
        workspaceId: params.workspaceId,
        locale: params.locale ?? 'en'
    })

    return {
        selectedLayout,
        runtimeConfig: resolveObjectCollectionLayoutBehaviorConfig({
            layoutConfig: selectedLayout.layoutConfig
        })
    }
}

export const getNextRuntimeSortValue = async (params: {
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

export const loadRuntimeObjectCollections = async (manager: DbExecutor, schemaIdent: string): Promise<RuntimeObjectCollectionRow[]> => {
    const rows = (await manager.query(
        `
      SELECT id, kind, codename, table_name, presentation, config
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
        presentation?: unknown
        config?: Record<string, unknown> | null
    }>

    return rows.map((row) => ({
        ...row,
        lifecycleContract: resolveApplicationLifecycleContractFromConfig(row.config)
    }))
}

export const loadRuntimeReadableComponents = async (
    manager: DbExecutor,
    schemaIdent: string,
    objectCollectionId: string
): Promise<RuntimeReadableComponent[]> => {
    return (await manager.query(
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
        [objectCollectionId]
    )) as RuntimeReadableComponent[]
}

export const loadRuntimeEnumOptionsMap = async (params: {
    manager: DbExecutor
    schemaIdent: string
    components: RuntimeReadableComponent[]
    locale: string
}): Promise<Map<string, RuntimeRefOption[]>> => {
    const enumTargetObjectIds = Array.from(
        new Set(
            params.components
                .filter((cmp) => cmp.data_type === 'REF' && isRuntimeEnumerationKind(cmp.target_object_kind) && cmp.target_object_id)
                .map((cmp) => String(cmp.target_object_id))
        )
    )
    const enumOptionsMap = new Map<string, RuntimeRefOption[]>()
    if (enumTargetObjectIds.length === 0) return enumOptionsMap

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
        codename: unknown
        presentation?: unknown
        sort_order?: number
        is_default?: boolean
    }>

    for (const row of enumRows) {
        const options = enumOptionsMap.get(row.object_id) ?? []
        options.push({
            id: row.id,
            codename: resolveRuntimeCodenameText(row.codename),
            label: resolvePresentationName(row.presentation, params.locale, resolveRuntimeCodenameText(row.codename)),
            isDefault: row.is_default === true,
            sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0
        })
        enumOptionsMap.set(row.object_id, options)
    }

    return enumOptionsMap
}

export const buildRuntimeSetConstantOption = (
    valueGroupFixedValueConfig: SetConstantUiConfig | null,
    locale: string
): RuntimeRefOption[] | undefined => {
    if (!valueGroupFixedValueConfig) return undefined
    return [
        {
            id: valueGroupFixedValueConfig.id,
            label: resolveSetConstantLabel(valueGroupFixedValueConfig, locale),
            codename: valueGroupFixedValueConfig.codename ?? 'valueGroupFixedValue',
            isDefault: true,
            sortOrder: 0
        }
    ]
}

const resolveRuntimeRefOptions = (
    component: RuntimeReadableComponent,
    enumOptionsMap: Map<string, RuntimeRefOption[]>,
    objectRefOptionsMap: Map<string, RuntimeRefOption[]>,
    setConstantOption: RuntimeRefOption[] | undefined
): RuntimeRefOption[] | undefined => {
    const targetObjectKind = component.target_object_kind ?? null

    if (
        component.data_type !== 'REF' ||
        typeof component.target_object_id !== 'string' ||
        (!isRuntimeEnumerationKind(targetObjectKind) && !isRuntimeSetKind(targetObjectKind) && !isRuntimeObjectTargetKind(targetObjectKind))
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

export const mapRuntimeComponentToColumnDefinition = (params: {
    component: RuntimeReadableComponent
    enumOptionsMap: Map<string, RuntimeRefOption[]>
    locale: string
    objectRefOptionsMap?: Map<string, RuntimeRefOption[]>
    childAttrsByTableId?: ReadonlyMap<string, RuntimeReadableComponent[]>
    includeChildColumns?: boolean
}): RuntimeColumnDefinition => {
    const { component, enumOptionsMap, locale } = params
    const valueGroupFixedValueConfig =
        component.data_type === 'REF' && isRuntimeSetKind(component.target_object_kind) ? getSetConstantConfig(component.ui_config) : null
    const setConstantOption = buildRuntimeSetConstantOption(valueGroupFixedValueConfig, locale)
    const enumOptions =
        component.data_type === 'REF' &&
        isRuntimeEnumerationKind(component.target_object_kind) &&
        component.target_object_id &&
        enumOptionsMap.has(component.target_object_id)
            ? enumOptionsMap.get(component.target_object_id)
            : undefined
    const refOptions = params.objectRefOptionsMap
        ? resolveRuntimeRefOptions(component, enumOptionsMap, params.objectRefOptionsMap, setConstantOption)
        : enumOptions ?? setConstantOption

    return {
        id: component.id,
        codename: resolveRuntimeCodenameText(component.codename),
        field: component.column_name,
        dataType: component.data_type,
        isRequired: component.is_required ?? false,
        isDisplayComponent: component.is_display_component === true,
        headerName: resolvePresentationName(component.presentation, locale, resolveRuntimeCodenameText(component.codename)),
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
        ...(params.includeChildColumns && component.data_type === 'TABLE'
            ? {
                  childColumns: (params.childAttrsByTableId?.get(component.id) ?? []).map((child) =>
                      mapRuntimeComponentToColumnDefinition({
                          ...params,
                          component: child,
                          includeChildColumns: false
                      })
                  )
              }
            : {})
    }
}

export const resolveRuntimeObjectByCodename = async (
    manager: DbExecutor,
    schemaIdent: string,
    objectCodename: string,
    options: { includePages?: boolean } = {}
) => {
    const objectFilterSql = options.includePages
        ? `(${RUNTIME_OBJECT_FILTER_SQL} OR ${runtimeStandardKindSql('kind')} = 'page')`
        : RUNTIME_OBJECT_FILTER_SQL
    const rows = (await manager.query(
        `
      SELECT id, kind, codename, table_name, config
      FROM ${schemaIdent}._app_objects
      WHERE ${runtimeCodenameTextSql('codename')} = $1
        AND ${objectFilterSql}
        AND _upl_deleted = false
        AND _app_deleted = false
      LIMIT 1
    `,
        [objectCodename]
    )) as Array<{ id: string; codename: unknown; kind?: string | null; table_name: string | null; config?: Record<string, unknown> | null }>

    const object = rows[0]
    if (!object) {
        return null
    }

    const objectKind = resolveRuntimeStandardKind(object.kind)
    if (objectKind !== 'page' && (!object.table_name || !IDENTIFIER_REGEX.test(object.table_name))) {
        return null
    }

    return {
        ...object,
        kind: objectKind ?? object.kind ?? null,
        lifecycleContract: resolveApplicationLifecycleContractFromConfig(object.config)
    }
}
