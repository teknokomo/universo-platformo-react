import type { AttributeDataType, MetaEntityDefinition, MetaEntityKind, MetaFieldDefinition } from '@universo/types'

export type EntityDefinition = MetaEntityDefinition
export type FieldDefinition = MetaFieldDefinition

export interface SchemaFieldSnapshot {
    codename: string
    columnName: string
    dataType: AttributeDataType
    isRequired: boolean
    targetEntityId?: string | null
}

export interface SchemaEntitySnapshot {
    kind: MetaEntityKind
    codename: string
    tableName: string
    fields: Record<string, SchemaFieldSnapshot>
}

export interface SchemaSnapshot {
    version: number
    generatedAt: string
    entities: Record<string, SchemaEntitySnapshot>
}

export interface SchemaGenerationResult {
    success: boolean
    schemaName: string
    tablesCreated: string[]
    errors: string[]
}

export interface MigrationResult {
    success: boolean
    changesApplied: number
    errors: string[]
    newSnapshot?: SchemaSnapshot
}
