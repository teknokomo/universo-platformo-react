import type { AttributeDataType, MetaEntityDefinition, MetaEntityKind, MetaFieldDefinition, MetaPresentation } from '@universo/types'

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
    hasSystemTables: boolean
    entities: Record<string, SchemaEntitySnapshot>
}

export interface SysObjectRecord {
    id: string
    kind: MetaEntityKind
    codename: string
    tableName: string
    presentation: MetaPresentation
    config: Record<string, unknown>
}

export interface SysAttributeRecord {
    id: string
    objectId: string
    codename: string
    columnName: string
    dataType: AttributeDataType
    isRequired: boolean
    targetObjectId?: string | null
    presentation: MetaPresentation
    validationRules?: Record<string, unknown>
    uiConfig?: Record<string, unknown>
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

// ═══════════════════════════════════════════════════════════════════════════
// Migration History Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Metadata stored in _sys_migrations.meta JSONB column
 */
export interface MigrationMeta {
    /** Snapshot of schema state BEFORE this migration was applied */
    snapshotBefore: SchemaSnapshot | null
    /** Snapshot of schema state AFTER this migration was applied */
    snapshotAfter: SchemaSnapshot
    /** List of changes applied in this migration */
    changes: MigrationChangeRecord[]
    /** Whether this migration contains destructive changes */
    hasDestructive: boolean
    /** Description of changes for display */
    summary: string
}

/**
 * Record of a single change within a migration
 */
export interface MigrationChangeRecord {
    type: string
    entityCodename?: string
    fieldCodename?: string
    tableName?: string
    columnName?: string
    isDestructive: boolean
    description: string
}

/**
 * Migration record as stored in _sys_migrations table
 */
export interface MigrationRecord {
    id: string
    name: string
    appliedAt: Date
    meta: MigrationMeta
}

/**
 * Result of rollback path analysis
 */
export interface RollbackAnalysis {
    canRollback: boolean
    blockers: string[]
    warnings: string[]
    rollbackChanges: MigrationChangeRecord[]
}
