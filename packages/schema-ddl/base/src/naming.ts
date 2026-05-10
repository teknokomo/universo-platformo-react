import {
    assertCanonicalIdentifier,
    buildManagedDynamicSchemaName as buildDynamicSchemaName,
    isCanonicalSchemaName,
    isManagedCustomSchemaName as isDynamicCustomSchemaName,
    quoteIdentifier
} from '@universo/migrations-core'
import type { RuntimeEntityKind } from './types'

const ENTITY_TABLE_PREFIX: Record<string, string> = {
    catalog: 'cat',
    set: 'set',
    enumeration: 'enum',
    ledger: 'led',
    hub: 'hub',
    document: 'doc',
    relation: 'rel',
    settings: 'cfg'
}

const SCHEMA_PREFIX = 'app'
const FIELD_PREFIX = 'attr'
const RESERVED_DYNAMIC_SCHEMA_PREFIX_PATTERN = /^(app|mhb)_/

export const generateSchemaName = (applicationId: string): string => {
    return buildDynamicSchemaName({ prefix: SCHEMA_PREFIX, ownerId: applicationId })
}

export const generateTableName = (entityId: string, kind: RuntimeEntityKind, prefixOverride?: string | null): string => {
    const cleanId = entityId.replace(/-/g, '')
    const prefix = prefixOverride && prefixOverride.trim().length > 0 ? prefixOverride.trim() : ENTITY_TABLE_PREFIX[kind] ?? 'obj'
    return `${prefix}_${cleanId}`
}

export const resolveEntityTableName = (entity: {
    id: string
    kind: RuntimeEntityKind
    physicalTableName?: string | null
    physicalTablePrefix?: string | null
}): string => {
    if (typeof entity.physicalTableName === 'string' && entity.physicalTableName.trim().length > 0) {
        assertCanonicalIdentifier(entity.physicalTableName)
        return entity.physicalTableName
    }

    return generateTableName(entity.id, entity.kind, entity.physicalTablePrefix)
}

export const generateColumnName = (fieldId: string): string => {
    const cleanId = fieldId.replace(/-/g, '')
    return `${FIELD_PREFIX}_${cleanId}`
}

export const resolveFieldColumnName = (field: { id: string; physicalColumnName?: string | null }): string => {
    if (typeof field.physicalColumnName === 'string' && field.physicalColumnName.trim().length > 0) {
        assertCanonicalIdentifier(field.physicalColumnName)
        return field.physicalColumnName
    }

    return generateColumnName(field.id)
}

export const generateMetahubSchemaName = (metahubId: string): string => {
    return buildDynamicSchemaName({ prefix: 'mhb', ownerId: metahubId })
}

export const isValidSchemaName = (schemaName: string): boolean => {
    if (isCanonicalSchemaName(schemaName)) {
        return true
    }

    if (!isDynamicCustomSchemaName(schemaName)) {
        return false
    }

    return !RESERVED_DYNAMIC_SCHEMA_PREFIX_PATTERN.test(schemaName)
}

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

export const qualifySchemaObjectName = (schemaName: string, objectName: string): string => {
    assertCanonicalIdentifier(schemaName)
    assertCanonicalIdentifier(objectName)
    return `${quoteIdentifier(schemaName)}.${quoteIdentifier(objectName)}`
}

export const qualifyTableName = (schemaName: string, tableName: string): string => qualifySchemaObjectName(schemaName, tableName)
