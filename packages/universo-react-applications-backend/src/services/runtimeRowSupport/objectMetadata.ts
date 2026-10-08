import type { DbExecutor } from '@universo-react/utils'
import { resolveRuntimeCodenameText, runtimeCodenameTextSql, IDENTIFIER_REGEX } from '../../shared/runtimeHelpers'
import {
    isRuntimeServerOwnedAttr,
    readRuntimeRecordAccessConfig,
    RUNTIME_OBJECT_FILTER_SQL,
    type RuntimeObjectCollectionAttr
} from './contracts'

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
