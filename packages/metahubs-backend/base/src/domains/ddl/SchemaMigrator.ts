import type { Knex } from 'knex'
import { AttributeDataType } from '@universo/types'
import { KnexClient } from './KnexClient'
import { buildFkConstraintName, generateColumnName, generateTableName } from './naming'
import { calculateSchemaDiff, ChangeType } from './diff'
import type { SchemaDiff, SchemaChange } from './diff'
import type { EntityDefinition, FieldDefinition, MigrationResult, SchemaSnapshot } from './types'
import { SchemaGenerator } from './SchemaGenerator'

export class SchemaMigrator {
    private knex: Knex
    private generator: SchemaGenerator

    constructor() {
        this.knex = KnexClient.getInstance()
        this.generator = new SchemaGenerator()
    }

    public calculateDiff(oldSnapshot: SchemaSnapshot | null, newEntities: EntityDefinition[]): SchemaDiff {
        return calculateSchemaDiff(oldSnapshot, newEntities)
    }

    public async applyAdditiveChanges(
        schemaName: string,
        diff: SchemaDiff,
        entities: EntityDefinition[]
    ): Promise<MigrationResult> {
        const result: MigrationResult = {
            success: false,
            changesApplied: 0,
            errors: [],
        }

        const lockKey = KnexClient.uuidToLockKey(schemaName)
        const lockAcquired = await KnexClient.acquireAdvisoryLock(lockKey)

        if (!lockAcquired) {
            result.errors.push('Could not acquire advisory lock. Another migration may be in progress.')
            return result
        }

        try {
            for (const change of diff.additive) {
                try {
                    await this.applyChange(schemaName, change, entities)
                    result.changesApplied++
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    result.errors.push(`${change.description}: ${message}`)
                }
            }

            result.success = result.errors.length === 0
            result.newSnapshot = this.generator.generateSnapshot(entities)
        } finally {
            await KnexClient.releaseAdvisoryLock(lockKey)
        }

        return result
    }

    public async applyAllChanges(
        schemaName: string,
        diff: SchemaDiff,
        entities: EntityDefinition[],
        confirmedDestructive: boolean
    ): Promise<MigrationResult> {
        if (diff.destructive.length > 0 && !confirmedDestructive) {
            return {
                success: false,
                changesApplied: 0,
                errors: [
                    'Destructive changes require explicit confirmation. ' +
                    `Changes: ${diff.destructive.map((c) => c.description).join('; ')}`,
                ],
            }
        }

        const result: MigrationResult = {
            success: false,
            changesApplied: 0,
            errors: [],
        }

        const lockKey = KnexClient.uuidToLockKey(schemaName)
        const lockAcquired = await KnexClient.acquireAdvisoryLock(lockKey)

        if (!lockAcquired) {
            result.errors.push('Could not acquire advisory lock.')
            return result
        }

        try {
            for (const change of diff.destructive) {
                try {
                    await this.applyChange(schemaName, change, entities)
                    result.changesApplied++
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    result.errors.push(`${change.description}: ${message}`)
                }
            }

            for (const change of diff.additive) {
                try {
                    await this.applyChange(schemaName, change, entities)
                    result.changesApplied++
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    result.errors.push(`${change.description}: ${message}`)
                }
            }

            result.success = result.errors.length === 0
            result.newSnapshot = this.generator.generateSnapshot(entities)
        } finally {
            await KnexClient.releaseAdvisoryLock(lockKey)
        }

        return result
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
        entities: EntityDefinition[]
    ): Promise<void> {
        console.log(`[SchemaMigrator] Applying: ${change.description}`)

        switch (change.type) {
            case ChangeType.ADD_TABLE: {
                const entity = entities.find((item) => item.id === change.entityId)
                if (!entity) throw new Error(`Entity ${change.entityId} not found`)
                await this.generator.createEntityTable(schemaName, entity)
                break
            }

            case ChangeType.DROP_TABLE: {
                await this.knex.schema.withSchema(schemaName).dropTableIfExists(change.tableName!)
                break
            }

            case ChangeType.ADD_COLUMN: {
                const field = this.findField(entities, change.entityId!, change.fieldId!)
                const pgType = SchemaGenerator.mapDataType(field.dataType)
                const columnName = change.columnName ?? generateColumnName(field.id)

                await this.knex.schema.withSchema(schemaName).alterTable(change.tableName!, (table: Knex.AlterTableBuilder) => {
                    table.specificType(columnName, pgType).nullable()
                })

                if (field.isRequired) {
                    await this.knex.raw(
                        `ALTER TABLE ??.?? ALTER COLUMN ?? SET NOT NULL`,
                        [schemaName, change.tableName, columnName]
                    )
                }
                break
            }

            case ChangeType.DROP_COLUMN: {
                await this.knex.schema.withSchema(schemaName).alterTable(change.tableName!, (table: Knex.AlterTableBuilder) => {
                    table.dropColumn(change.columnName!)
                })
                break
            }

            case ChangeType.ALTER_COLUMN: {
                if (change.oldValue === 'nullable' && change.newValue === 'required') {
                    await this.knex.raw(
                        `ALTER TABLE ??.?? ALTER COLUMN ?? SET NOT NULL`,
                        [schemaName, change.tableName, change.columnName]
                    )
                } else if (change.oldValue === 'required' && change.newValue === 'nullable') {
                    await this.knex.raw(
                        `ALTER TABLE ??.?? ALTER COLUMN ?? DROP NOT NULL`,
                        [schemaName, change.tableName, change.columnName]
                    )
                } else {
                    const newType = SchemaGenerator.mapDataType(change.newValue as AttributeDataType)
                    await this.knex.raw(
                        `ALTER TABLE ??.?? ALTER COLUMN ?? TYPE ${newType} USING ??::${newType}`,
                        [schemaName, change.tableName, change.columnName, change.columnName]
                    )
                }
                break
            }

            case ChangeType.ADD_FK: {
                const targetEntity = entities.find((item) => item.id === change.newValue)
                if (!targetEntity) {
                    console.warn(`[SchemaMigrator] Target entity ${change.newValue} not found for FK`)
                    return
                }
                const columnName = change.columnName ?? generateColumnName(change.fieldId!)
                const constraintName = buildFkConstraintName(change.tableName!, columnName)
                const targetTableName = generateTableName(targetEntity.id, targetEntity.kind)
                await this.knex.raw(
                    `ALTER TABLE ??.?? ADD CONSTRAINT ?? FOREIGN KEY (??) REFERENCES ??.??(id) ON DELETE SET NULL`,
                    [schemaName, change.tableName, constraintName, columnName, schemaName, targetTableName]
                )
                break
            }

            case ChangeType.DROP_FK: {
                const constraintName = buildFkConstraintName(change.tableName!, change.columnName!)
                await this.knex.raw(
                    `ALTER TABLE ??.?? DROP CONSTRAINT IF EXISTS ??`,
                    [schemaName, change.tableName, constraintName]
                )
                break
            }

            case ChangeType.RENAME_TABLE: {
                const nextTableName = change.newValue ? String(change.newValue) : null
                if (!nextTableName) {
                    throw new Error('Missing new table name for rename')
                }
                await this.knex.schema.withSchema(schemaName).renameTable(change.tableName!, nextTableName)
                break
            }

            default:
                console.warn(`[SchemaMigrator] Unknown change type: ${change.type}`)
        }
    }
}

export { ChangeType }
export type { SchemaChange, SchemaDiff }
export default SchemaMigrator
