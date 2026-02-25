import type { Knex } from 'knex'
import { AttributeDataType, MetaEntityKind } from '@universo/types'
import type { AttributeValidationRules } from '@universo/types'
import { buildFkConstraintName, generateColumnName, generateTableName } from './naming'
import { uuidToLockKey, acquireAdvisoryLock, releaseAdvisoryLock } from './locking'
import { calculateSchemaDiff, ChangeType } from './diff'
import type { SchemaDiff, SchemaChange } from './diff'
import type { EntityDefinition, FieldDefinition, MigrationResult, SchemaSnapshot } from './types'
import { SchemaGenerator } from './SchemaGenerator'
import { MigrationManager, generateMigrationName } from './MigrationManager'

const ENUMERATION_KIND: MetaEntityKind = ((MetaEntityKind as unknown as { ENUMERATION?: MetaEntityKind }).ENUMERATION ??
    'enumeration') as MetaEntityKind

/**
 * Options for applying changes with migration recording
 */
export interface ApplyChangesOptions {
    /** Record migration in _app_migrations table */
    recordMigration?: boolean
    /** Description for migration name generation */
    migrationDescription?: string
    /** Optional metadata to store in migration record */
    migrationMeta?: Pick<import('./types').MigrationMeta, 'publicationSnapshotHash' | 'publicationId' | 'publicationVersionId'>
    /** Optional Metahub snapshot stored separately from meta */
    publicationSnapshot?: Record<string, unknown> | null
    /** User ID for audit fields */
    userId?: string | null
}

/**
 * SchemaMigrator - Applies schema changes (additive and destructive) to PostgreSQL schemas.
 *
 * Uses Dependency Injection pattern: receives Knex, SchemaGenerator, and MigrationManager
 * via constructor instead of creating them internally.
 */
export class SchemaMigrator {
    private knex: Knex
    private generator: SchemaGenerator
    private migrationManager: MigrationManager

    constructor(knex: Knex, generator: SchemaGenerator, migrationManager: MigrationManager) {
        this.knex = knex
        this.generator = generator
        this.migrationManager = migrationManager
    }

    public calculateDiff(oldSnapshot: SchemaSnapshot | null, newEntities: EntityDefinition[]): SchemaDiff {
        return calculateSchemaDiff(oldSnapshot, newEntities)
    }

    public async applyAdditiveChanges(schemaName: string, diff: SchemaDiff, entities: EntityDefinition[]): Promise<MigrationResult> {
        const result: MigrationResult = {
            success: false,
            changesApplied: 0,
            errors: []
        }

        const lockKey = uuidToLockKey(schemaName)
        const lockAcquired = await acquireAdvisoryLock(this.knex, lockKey)

        if (!lockAcquired) {
            result.errors.push('Could not acquire advisory lock. Another migration may be in progress.')
            return result
        }

        try {
            await this.knex.transaction(async (trx) => {
                for (const change of this.orderChangesForApply(diff.additive, 'additive')) {
                    try {
                        await this.applyChange(schemaName, change, entities, trx)
                        result.changesApplied++
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error)
                        throw new Error(`${change.description}: ${message}`)
                    }
                }

                await this.generator.syncSystemMetadata(schemaName, entities, {
                    trx,
                    removeMissing: true
                })
            })

            result.success = true
            result.newSnapshot = this.generator.generateSnapshot(entities)
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            result.errors.push(message)
            result.success = false
        } finally {
            await releaseAdvisoryLock(this.knex, lockKey)
        }

        return result
    }

    public async applyAllChanges(
        schemaName: string,
        diff: SchemaDiff,
        entities: EntityDefinition[],
        confirmedDestructive: boolean,
        options?: ApplyChangesOptions
    ): Promise<MigrationResult> {
        if (diff.destructive.length > 0 && !confirmedDestructive) {
            return {
                success: false,
                changesApplied: 0,
                errors: [
                    'Destructive changes require explicit confirmation. ' +
                        `Changes: ${diff.destructive.map((c) => c.description).join('; ')}`
                ]
            }
        }

        const result: MigrationResult = {
            success: false,
            changesApplied: 0,
            errors: []
        }

        const lockKey = uuidToLockKey(schemaName)
        const lockAcquired = await acquireAdvisoryLock(this.knex, lockKey)

        if (!lockAcquired) {
            result.errors.push('Could not acquire advisory lock.')
            return result
        }

        // Capture snapshot before changes for migration recording
        const snapshotBefore = await this.getCurrentSnapshot(schemaName)

        try {
            await this.knex.transaction(async (trx) => {
                for (const change of this.orderChangesForApply(diff.destructive, 'destructive')) {
                    try {
                        await this.applyChange(schemaName, change, entities, trx)
                        result.changesApplied++
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error)
                        throw new Error(`${change.description}: ${message}`)
                    }
                }

                for (const change of this.orderChangesForApply(diff.additive, 'additive')) {
                    try {
                        await this.applyChange(schemaName, change, entities, trx)
                        result.changesApplied++
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error)
                        throw new Error(`${change.description}: ${message}`)
                    }
                }

                await this.generator.syncSystemMetadata(schemaName, entities, {
                    trx,
                    removeMissing: true,
                    userId: options?.userId
                })

                // Record migration if requested
                if (options?.recordMigration && result.changesApplied > 0) {
                    const snapshotAfter = this.generator.generateSnapshot(entities)
                    const description = options.migrationDescription || 'schema_sync'
                    const migrationName = generateMigrationName(description)

                    await this.migrationManager.recordMigration(
                        schemaName,
                        migrationName,
                        snapshotBefore,
                        snapshotAfter,
                        diff,
                        trx,
                        options.migrationMeta,
                        options.publicationSnapshot ?? null,
                        options.userId ?? null
                    )
                }
            })

            result.success = true
            result.newSnapshot = this.generator.generateSnapshot(entities)
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            result.errors.push(message)
            result.success = false
        } finally {
            await releaseAdvisoryLock(this.knex, lockKey)
        }

        return result
    }

    /**
     * Get current snapshot from _app_migrations (latest migration's snapshotAfter)
     * Returns null if no migrations exist
     */
    private async getCurrentSnapshot(schemaName: string): Promise<SchemaSnapshot | null> {
        const latestMigration = await this.migrationManager.getLatestMigration(schemaName)
        return latestMigration?.meta?.snapshotAfter ?? null
    }

    private findField(entities: EntityDefinition[], entityId: string, fieldId: string): FieldDefinition {
        const entity = entities.find((item) => item.id === entityId)
        if (!entity) {
            throw new Error(`Entity ${entityId} not found`)
        }
        const field = entity.fields.find((item) => item.id === fieldId)
        if (!field) {
            throw new Error(`Field ${fieldId} not found in entity ${entityId}`)
        }
        return field
    }

    private async applyChange(
        schemaName: string,
        change: SchemaChange,
        entities: EntityDefinition[],
        trx: Knex.Transaction
    ): Promise<void> {
        console.log(`[SchemaMigrator] Applying: ${change.description}`)

        switch (change.type) {
            case ChangeType.ADD_TABLE: {
                const entity = entities.find((item) => item.id === change.entityId)
                if (!entity) throw new Error(`Entity ${change.entityId} not found`)
                await this.generator.createEntityTable(schemaName, entity, trx)
                break
            }

            case ChangeType.DROP_TABLE: {
                await trx.schema.withSchema(schemaName).dropTableIfExists(change.tableName!)
                break
            }

            case ChangeType.ADD_COLUMN: {
                const field = this.findField(entities, change.entityId!, change.fieldId!)
                const pgType = SchemaGenerator.mapDataType(
                    field.dataType,
                    field.validationRules as Partial<AttributeValidationRules> | undefined
                )
                const columnName = change.columnName ?? generateColumnName(field.id)

                await trx.schema.withSchema(schemaName).alterTable(change.tableName!, (table: Knex.AlterTableBuilder) => {
                    const col = table.specificType(columnName, pgType).nullable()
                    // BOOLEAN columns default to false to prevent NULL → indeterminate checkbox state
                    if (field.dataType === AttributeDataType.BOOLEAN) {
                        col.defaultTo(false)
                    }
                })

                if (field.isRequired) {
                    await trx.raw(`ALTER TABLE ??.?? ALTER COLUMN ?? SET NOT NULL`, [schemaName, change.tableName, columnName])
                }
                break
            }

            case ChangeType.DROP_COLUMN: {
                await trx.schema.withSchema(schemaName).alterTable(change.tableName!, (table: Knex.AlterTableBuilder) => {
                    table.dropColumn(change.columnName!)
                })
                break
            }

            case ChangeType.ALTER_COLUMN: {
                if (change.oldValue === 'nullable' && change.newValue === 'required') {
                    await trx.raw(`ALTER TABLE ??.?? ALTER COLUMN ?? SET NOT NULL`, [schemaName, change.tableName, change.columnName])
                } else if (change.oldValue === 'required' && change.newValue === 'nullable') {
                    await trx.raw(`ALTER TABLE ??.?? ALTER COLUMN ?? DROP NOT NULL`, [schemaName, change.tableName, change.columnName])
                } else {
                    // Type change - get field to access validationRules for type config
                    const field = change.fieldId && change.entityId ? this.findField(entities, change.entityId, change.fieldId) : null
                    const newType = SchemaGenerator.mapDataType(
                        change.newValue as AttributeDataType,
                        field?.validationRules as Partial<AttributeValidationRules> | undefined
                    )
                    await trx.raw(`ALTER TABLE ??.?? ALTER COLUMN ?? TYPE ${newType} USING ??::${newType}`, [
                        schemaName,
                        change.tableName,
                        change.columnName,
                        change.columnName
                    ])
                }
                break
            }

            case ChangeType.ADD_FK: {
                const field = this.findField(entities, change.entityId!, change.fieldId!)
                const targetEntityId = field.targetEntityId ?? (typeof change.newValue === 'string' ? change.newValue : null)
                const targetEntity = targetEntityId ? entities.find((item) => item.id === targetEntityId) : null
                const targetEntityKind = field.targetEntityKind ?? targetEntity?.kind ?? null
                const columnName = change.columnName ?? generateColumnName(change.fieldId!)
                const constraintName = buildFkConstraintName(change.tableName!, columnName)
                const onDelete = change.onDeleteAction ?? 'SET NULL'

                let targetTableName: string
                if (targetEntityKind === ENUMERATION_KIND) {
                    await this.generator.ensureSystemTables(schemaName, trx)
                    targetTableName = '_app_values'
                } else {
                    if (!targetEntity) {
                        console.warn(`[SchemaMigrator] Target entity ${targetEntityId ?? change.newValue} not found for FK`)
                        return
                    }
                    targetTableName = generateTableName(targetEntity.id, targetEntity.kind)
                }

                await trx.raw(`ALTER TABLE ??.?? ADD CONSTRAINT ?? FOREIGN KEY (??) REFERENCES ??.??(id) ON DELETE ${onDelete}`, [
                    schemaName,
                    change.tableName,
                    constraintName,
                    columnName,
                    schemaName,
                    targetTableName
                ])
                break
            }

            case ChangeType.DROP_FK: {
                const constraintName = buildFkConstraintName(change.tableName!, change.columnName!)
                await trx.raw(`ALTER TABLE ??.?? DROP CONSTRAINT IF EXISTS ??`, [schemaName, change.tableName, constraintName])
                break
            }

            case ChangeType.RENAME_TABLE: {
                const nextTableName = change.newValue ? String(change.newValue) : null
                if (!nextTableName) {
                    throw new Error('Missing new table name for rename')
                }
                await trx.schema.withSchema(schemaName).renameTable(change.tableName!, nextTableName)
                break
            }

            case ChangeType.MODIFY_FIELD: {
                // MODIFY_FIELD represents metadata-only changes (e.g., isDisplayAttribute, targetEntityId)
                // that don't require DDL operations. We log and skip.
                console.log(`[SchemaMigrator] Metadata change (no DDL): ${change.description}`)
                break
            }

            case ChangeType.ADD_TABULAR_TABLE: {
                // Create a new tabular part table for a TABLE attribute
                const entity = entities.find((item) => item.id === change.entityId)
                if (!entity) throw new Error(`Entity ${change.entityId} not found`)
                const tableField = entity.fields.find((f) => f.id === change.fieldId)
                if (!tableField) throw new Error(`TABLE field ${change.fieldId} not found`)
                const childFields = entity.fields.filter((f) => f.parentAttributeId === tableField.id)
                const parentTableName = generateTableName(entity.id, entity.kind)
                await this.generator.createTabularTable(schemaName, parentTableName, tableField, childFields, trx)
                break
            }

            case ChangeType.DROP_TABULAR_TABLE: {
                // Drop the tabular part table
                await trx.schema.withSchema(schemaName).dropTableIfExists(change.tableName!)
                break
            }

            case ChangeType.ADD_TABULAR_COLUMN: {
                // Add a column to an existing tabular table
                const entity = entities.find((item) => item.id === change.entityId)
                if (!entity) throw new Error(`Entity ${change.entityId} not found`)
                const field = entity.fields.find((f) => f.id === change.fieldId)
                if (!field) throw new Error(`Child field ${change.fieldId} not found`)
                const pgType = SchemaGenerator.mapDataType(
                    field.dataType,
                    field.validationRules as Partial<AttributeValidationRules> | undefined
                )
                const columnName = change.columnName ?? generateColumnName(field.id)

                await trx.schema.withSchema(schemaName).alterTable(change.tableName!, (table: Knex.AlterTableBuilder) => {
                    const col = table.specificType(columnName, pgType).nullable()
                    if (field.dataType === AttributeDataType.BOOLEAN) {
                        col.defaultTo(false)
                    }
                })
                break
            }

            case ChangeType.DROP_TABULAR_COLUMN: {
                // Drop a column from a tabular table
                await trx.schema.withSchema(schemaName).alterTable(change.tableName!, (table: Knex.AlterTableBuilder) => {
                    table.dropColumn(change.columnName!)
                })
                break
            }

            case ChangeType.ALTER_TABULAR_COLUMN: {
                // Change column type in a tabular table
                const entity = entities.find((item) => item.id === change.entityId)
                const field = entity?.fields.find((f) => f.id === change.fieldId) ?? null
                const newType = SchemaGenerator.mapDataType(
                    change.newValue as AttributeDataType,
                    field?.validationRules as Partial<AttributeValidationRules> | undefined
                )
                await trx.raw(`ALTER TABLE ??.?? ALTER COLUMN ?? TYPE ${newType} USING ??::${newType}`, [
                    schemaName,
                    change.tableName,
                    change.columnName,
                    change.columnName
                ])
                break
            }

            default:
                console.warn(`[SchemaMigrator] Unknown change type: ${change.type}`)
        }
    }

    /**
     * Orders schema changes to avoid dependency violations.
     *
     * For destructive migrations this guarantees that:
     * 1) FKs are removed first
     * 2) dependent columns are dropped next
     * 3) tables are dropped last
     *
     * This prevents PostgreSQL errors like dropping a referenced table
     * before removing referencing constraints/columns.
     */
    private orderChangesForApply(changes: SchemaChange[], mode: 'additive' | 'destructive'): SchemaChange[] {
        const rank = (change: SchemaChange): number => {
            if (mode === 'destructive') {
                switch (change.type) {
                    case ChangeType.DROP_FK:
                        return 10
                    case ChangeType.DROP_TABULAR_COLUMN:
                        return 15
                    case ChangeType.DROP_COLUMN:
                        return 20
                    case ChangeType.ALTER_COLUMN:
                        return 25
                    case ChangeType.ALTER_TABULAR_COLUMN:
                        return 26
                    case ChangeType.DROP_TABULAR_TABLE:
                        return 30
                    case ChangeType.DROP_TABLE:
                        return 40
                    case ChangeType.RENAME_TABLE:
                        return 50
                    case ChangeType.MODIFY_FIELD:
                        return 60
                    default:
                        return 100
                }
            }

            switch (change.type) {
                case ChangeType.ADD_TABLE:
                    return 10
                case ChangeType.ADD_TABULAR_TABLE:
                    return 12
                case ChangeType.ADD_COLUMN:
                    return 20
                case ChangeType.ADD_TABULAR_COLUMN:
                    return 22
                case ChangeType.ALTER_COLUMN:
                    return 30
                case ChangeType.ALTER_TABULAR_COLUMN:
                    return 32
                case ChangeType.ADD_FK:
                    return 40
                case ChangeType.RENAME_TABLE:
                    return 50
                case ChangeType.MODIFY_FIELD:
                    return 60
                default:
                    return 100
            }
        }

        return changes
            .map((change, index) => ({ change, index, rank: rank(change) }))
            .sort((a, b) => a.rank - b.rank || a.index - b.index)
            .map((item) => item.change)
    }
}

export { ChangeType }
export type { SchemaChange, SchemaDiff }
export default SchemaMigrator
