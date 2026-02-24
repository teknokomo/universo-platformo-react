import type { MetaEntityKind } from '@universo/types'

type RuntimeEntityKind = MetaEntityKind | 'enumeration'

const ENTITY_TABLE_PREFIX: Record<string, string> = {
    catalog: 'cat',
    enumeration: 'enum',
    hub: 'hub',
    document: 'doc'
}

const SCHEMA_PREFIX = 'app'
const FIELD_PREFIX = 'attr'

export const generateSchemaName = (applicationId: string): string => {
    const cleanId = applicationId.replace(/-/g, '')
    return `${SCHEMA_PREFIX}_${cleanId}`
}

export const generateTableName = (entityId: string, kind: RuntimeEntityKind): string => {
    const cleanId = entityId.replace(/-/g, '')
    const prefix = ENTITY_TABLE_PREFIX[kind] ?? 'obj'
    return `${prefix}_${cleanId}`
}

export const generateColumnName = (fieldId: string): string => {
    const cleanId = fieldId.replace(/-/g, '')
    return `${FIELD_PREFIX}_${cleanId}`
}

export const generateMetahubSchemaName = (metahubId: string): string => {
    const cleanId = metahubId.replace(/-/g, '')
    return `mhb_${cleanId}`
}

export const isValidSchemaName = (schemaName: string): boolean => /^(app_[a-f0-9]+|mhb_[a-f0-9]+(_b[0-9]+)?)$/.test(schemaName)

/**
 * Generates table name for a tabular part (TABLE attribute).
 * Convention: {parentTableName}_tp_{attributeUuid12}
 * Uses first 12 hex chars of UUID (48 bits) for uniqueness within a catalog.
 * Keeps total name ≤ 63 chars (PostgreSQL NAMEDATALEN limit).
 * The parent prefix is truncated first to guarantee _tp_ (4 chars) and
 * cleanId (12 chars) are always fully preserved, preventing name collisions.
 * Example: cat_abc123def456...gggg_tp_111122223333
 */
export const generateTabularTableName = (parentTableName: string, attributeId: string): string => {
    const cleanId = attributeId.replace(/-/g, '').substring(0, 12)
    // Reserve 16 chars for suffix: '_tp_' (4) + cleanId (12)
    const prefix = parentTableName.substring(0, 63 - 4 - 12)
    return `${prefix}_tp_${cleanId}`
}

export const buildFkConstraintName = (tableName: string, columnName: string): string => `fk_${tableName}_${columnName}`.substring(0, 63)
