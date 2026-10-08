import { resolveApplicationLifecycleContractFromConfig } from '@universo-react/utils'
import type { DbExecutor } from '@universo-react/utils'
import {
    IDENTIFIER_REGEX,
    getSetConstantConfig,
    resolvePresentationName,
    resolveRuntimeCodenameText,
    resolveSetConstantLabel,
    runtimeCodenameTextSql,
    runtimeStandardKindSql,
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
    type RuntimeObjectCollectionRow,
    type RuntimeReadableComponent
} from './contracts'

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
