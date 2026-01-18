import type { Knex } from 'knex'
import { AttributeDataType } from '@universo/types'
import { KnexClient } from './KnexClient'
import { buildFkConstraintName, generateColumnName, generateTableName } from './naming'
import { calculateSchemaDiff, ChangeType } from './diff'
import type { SchemaDiff, SchemaChange } from './diff'
import type { EntityDefinition, FieldDefinition, MigrationResult, SchemaSnapshot } from './types'
import { SchemaGenerator } from './SchemaGenerator'
import { MigrationManager } from './MigrationManager'

/**
 * Options for applying changes with migration recording
 */
export interface ApplyChangesOptions {
    /** Record migration in _sys_migrations table */
    recordMigration?: boolean
    /** Description for migration name generation */
    migrationDescription?: string
}

export class SchemaMigrator {
    private knex: Knex
    private generator: SchemaGenerator
    private migrationManager: MigrationManager

    constructor() {
        this.knex = KnexClient.getInstance()
        this.generator = new SchemaGenerator()
        this.migrationManager = new MigrationManager()
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
            await this.knex.transaction(async (trx) => {
                for (const change of diff.additive) {
                    try {
                        await this.applyChange(schemaName, change, entities, trx)
                        result.changesApplied++
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error)
                        throw new Error(`${change.description}: ${message}`)
                    }
                }

                await this.generator.syncSystemMetadata(schemaName, entities, { trx })
            })

            result.success = true
            result.newSnapshot = this.generator.generateSnapshot(entities)
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            result.errors.push(message)
            result.success = false
        } finally {
            await KnexClient.releaseAdvisoryLock(lockKey)
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

        // Capture snapshot before changes for migration recording
        const snapshotBefore = await this.getCurrentSnapshot(schemaName)

        try {
            await this.knex.transaction(async (trx) => {
                for (const change of diff.destructive) {
                    try {
                        await this.applyChange(schemaName, change, entities, trx)
                        result.changesApplied++
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error)
                        throw new Error(`${change.description}: ${message}`)
                    }
                }

                for (const change of diff.additive) {
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
                    removeMissing: diff.destructive.length > 0,
                })

                // Record migration if requested
                if (options?.recordMigration && result.changesApplied > 0) {
                    const snapshotAfter = this.generator.generateSnapshot(entities)
                    const description = options.migrationDescription || 'schema_sync'
                    const migrationName = MigrationManager.generateMigrationName(description)

                    await this.migrationManager.recordMigration(
                        schemaName,
                        migrationName,
                        snapshotBefore,
                        snapshotAfter,
                        diff,
                        trx
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
            await KnexClient.releaseAdvisoryLock(lockKey)
        }

        return result
    }

    /**
     * Get current snapshot from _sys_migrations (latest migration's snapshotAfter)
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
                const pgType = SchemaGenerator.mapDataType(field.dataType)
                const columnName = change.columnName ?? generateColumnName(field.id)

                await trx.schema.withSchema(schemaName).alterTable(change.tableName!, (table: Knex.AlterTableBuilder) => {
                    table.specificType(columnName, pgType).nullable()
                })

                if (field.isRequired) {
                    await trx.raw(
                        `ALTER TABLE ??.?? ALTER COLUMN ?? SET NOT NULL`,
                        [schemaName, change.tableName, columnName]
                    )
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
                    await trx.raw(
                        `ALTER TABLE ??.?? ALTER COLUMN ?? SET NOT NULL`,
                        [schemaName, change.tableName, change.columnName]
                    )
                } else if (change.oldValue === 'required' && change.newValue === 'nullable') {
                    await trx.raw(
                        `ALTER TABLE ??.?? ALTER COLUMN ?? DROP NOT NULL`,
                        [schemaName, change.tableName, change.columnName]
                    )
                } else {
                    const newType = SchemaGenerator.mapDataType(change.newValue as AttributeDataType)
                    await trx.raw(
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
                await trx.raw(
                    `ALTER TABLE ??.?? ADD CONSTRAINT ?? FOREIGN KEY (??) REFERENCES ??.??(id) ON DELETE SET NULL`,
                    [schemaName, change.tableName, constraintName, columnName, schemaName, targetTableName]
                )
                break
            }

            case ChangeType.DROP_FK: {
                const constraintName = buildFkConstraintName(change.tableName!, change.columnName!)
                await trx.raw(
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
                await trx.schema.withSchema(schemaName).renameTable(change.tableName!, nextTableName)
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
