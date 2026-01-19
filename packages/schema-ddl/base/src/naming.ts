import type { MetaEntityKind } from '@universo/types'

const ENTITY_TABLE_PREFIX: Record<MetaEntityKind, string> = {
    catalog: 'cat',
    hub: 'hub',
    document: 'doc'
}

const SCHEMA_PREFIX = 'app'
const FIELD_PREFIX = 'attr'

export const generateSchemaName = (applicationId: string): string => {
    const cleanId = applicationId.replace(/-/g, '')
    return `${SCHEMA_PREFIX}_${cleanId}`
}

export const generateTableName = (entityId: string, kind: MetaEntityKind): string => {
    const cleanId = entityId.replace(/-/g, '')
    return `${ENTITY_TABLE_PREFIX[kind]}_${cleanId}`
}

export const generateColumnName = (fieldId: string): string => {
    const cleanId = fieldId.replace(/-/g, '')
    return `${FIELD_PREFIX}_${cleanId}`
}

export const isValidSchemaName = (schemaName: string): boolean => /^app_[a-f0-9]+$/.test(schemaName)

export const buildFkConstraintName = (tableName: string, columnName: string): string => `fk_${tableName}_${columnName}`.substring(0, 63)
