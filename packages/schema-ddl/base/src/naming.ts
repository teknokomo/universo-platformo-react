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
 * Generates independent table name for a child table (TABLE attribute).
 * Convention: tbl_{attributeUuid32}
 * Uses full UUID v7 hex (32 chars) of the TABLE attribute ID.
 * Total name = 4 ('tbl_') + 32 (hex) = 36 chars, well within PostgreSQL 63-char limit.
 * The name is independent of the parent table, enabling future multi-parent (junction table) support.
 *
 * Example: tbl_0196117f8e037db3bbe2d3e0f1a2b3c4
 */
export const generateChildTableName = (attributeId: string): string => {
    const cleanId = attributeId.replace(/-/g, '')
    return `tbl_${cleanId}`
}

export const buildFkConstraintName = (tableName: string, columnName: string): string => `fk_${tableName}_${columnName}`.substring(0, 63)
