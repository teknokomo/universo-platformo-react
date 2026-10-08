import { type DbExecutor } from '@universo-react/utils'
import { resolveObjectCollectionLayoutBehaviorConfig, resolveApplicationLifecycleContractFromConfig } from '@universo-react/utils'
import type { EffectiveLayoutAuthContext } from '../../services/effectiveLayoutResolverCore'
import { IDENTIFIER_REGEX, quoteIdentifier, runtimeCodenameTextSql, pgNumericToNumber } from '../../shared/runtimeHelpers'
import { RUNTIME_OBJECT_FILTER_SQL } from '../../services/runtimeRowSupport/contracts'
import { resolveRuntimeEffectiveLayout } from './menu'
import { resolveRuntimeRowReorderAuthority } from '../../services/runtimeRowSupport/list'
import { loadRuntimeObjectAttrs } from '../../services/runtimeRowSupport/objectMetadata'
export {
    buildRuntimeAttrLookup,
    findRuntimeAttrByFieldKey,
    findRuntimeSystemKeyAttr,
    loadRuntimeObjectAttrs,
    readRuntimeAttrStringValue,
    readRuntimeAttrValue,
    resolveRuntimeObjectCollectionByCodename,
    resolveRuntimeRecordOwnerColumnName
} from '../../services/runtimeRowSupport/objectMetadata'

export {
    buildRuntimeSetConstantOption,
    loadRuntimeEnumOptionsMap,
    loadRuntimeObjectCollections,
    loadRuntimeReadableComponents,
    mapRuntimeComponentToColumnDefinition,
    resolveRuntimeObjectByCodename
} from '../../services/runtimeRowSupport/runtimeObjectCatalog'

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

export const resolveRuntimeObjectCollectionConfig = async (params: {
    manager: DbExecutor
    applicationId: string
    userId: string
    role: EffectiveLayoutAuthContext['role']
    workspaceId: string | null
    locale?: string
    objectCollectionId: string
    objectCollectionCodename: string
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

    const objectBehaviorConfig = resolveObjectCollectionLayoutBehaviorConfig({ layoutConfig: selectedLayout.layoutConfig })
    const rowReorderAuthority = resolveRuntimeRowReorderAuthority(selectedLayout.zoneWidgets, params.objectCollectionCodename)

    return {
        selectedLayout,
        runtimeConfig: { ...objectBehaviorConfig, ...rowReorderAuthority }
    }
}

export const getNextRuntimeSortValue = async (params: {
    manager: DbExecutor
    dataTableIdent: string
    runtimeRowCondition: string
    reorderColumnName: string
    parentScope?: { fieldColumnName: string; parentRecordId: string }
}) => {
    const { manager, dataTableIdent, runtimeRowCondition, reorderColumnName, parentScope } = params
    const parentScopeCondition = parentScope ? `AND ${quoteIdentifier(parentScope.fieldColumnName)} = $1` : ''
    const [row] = (await manager.query(
        `
      SELECT COALESCE(MAX(${quoteIdentifier(reorderColumnName)}), -1) AS value
      FROM ${dataTableIdent}
      WHERE ${runtimeRowCondition}
        ${parentScopeCondition}
    `,
        parentScope ? [parentScope.parentRecordId] : []
    )) as Array<{ value: unknown }>

    const maxValue = pgNumericToNumber(row?.value)
    return typeof maxValue === 'number' && Number.isFinite(maxValue) ? maxValue + 1 : 0
}
