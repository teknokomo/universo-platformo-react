import { Knex } from 'knex'
import { KnexClient } from './KnexClient'
import {
    SchemaGenerator,
    CatalogDefinition,
    SchemaSnapshot,
    AttributeDefinition,
} from './SchemaGenerator'
import { AttributeDataType } from '../database/entities/Attribute'

/**
 * Change types for schema diff
 */
export enum ChangeType {
    ADD_TABLE = 'ADD_TABLE',
    DROP_TABLE = 'DROP_TABLE',
    RENAME_TABLE = 'RENAME_TABLE',
    ADD_COLUMN = 'ADD_COLUMN',
    DROP_COLUMN = 'DROP_COLUMN',
    ALTER_COLUMN = 'ALTER_COLUMN',
    ADD_FK = 'ADD_FK',
    DROP_FK = 'DROP_FK',
}

/**
 * Single change in the migration diff
 */
export interface SchemaChange {
    type: ChangeType
    catalogId?: string
    catalogCodename?: string
    tableName?: string
    attributeId?: string
    attributeCodename?: string
    columnName?: string
    oldValue?: unknown
    newValue?: unknown
    isDestructive: boolean
    description: string
}

/**
 * Result of diff calculation
 */
export interface SchemaDiff {
    hasChanges: boolean
    additive: SchemaChange[]
    destructive: SchemaChange[]
    summary: string
}

/**
 * Result of migration execution
 */
export interface MigrationResult {
    success: boolean
    changesApplied: number
    errors: string[]
    newSnapshot?: SchemaSnapshot
}

/**
 * SchemaMigrator - Computes and applies changes between Metahub versions
 *
 * Key principles:
 * 1. Additive changes (ADD_TABLE, ADD_COLUMN) are safe and applied automatically
 * 2. Destructive changes (DROP_*, RENAME_*) require explicit confirmation
 * 3. ALTER_COLUMN (type changes) are complex and may require data migration
 * 4. Uses advisory locks to prevent concurrent modifications
 * 5. All changes are logged for audit trail
 */
export class SchemaMigrator {
    private knex: Knex
    private generator: SchemaGenerator

    constructor() {
        this.knex = KnexClient.getInstance()
        this.generator = new SchemaGenerator()
    }

    /**
     * Calculate diff between old snapshot and new catalog definitions
     *
     * @param oldSnapshot - Previously stored schema snapshot
     * @param newCatalogs - Current catalog definitions from Metahub
     * @returns Diff with additive and destructive changes
     */
    public calculateDiff(
        oldSnapshot: SchemaSnapshot | null,
        newCatalogs: CatalogDefinition[]
    ): SchemaDiff {
        const diff: SchemaDiff = {
            hasChanges: false,
            additive: [],
            destructive: [],
            summary: '',
        }

        // If no old snapshot, everything is new (additive)
        if (!oldSnapshot) {
            for (const catalog of newCatalogs) {
                diff.additive.push({
                    type: ChangeType.ADD_TABLE,
                    catalogId: catalog.id,
                    catalogCodename: catalog.codename,
                    tableName: SchemaGenerator.generateTableName(catalog.id),
                    isDestructive: false,
                    description: `Create table "${catalog.codename}"`,
                })
            }
            diff.hasChanges = diff.additive.length > 0
            diff.summary = `${diff.additive.length} new table(s)`
            return diff
        }

        const oldCatalogIds = new Set(Object.keys(oldSnapshot.catalogs))
        const newCatalogIds = new Set(newCatalogs.map((c) => c.id))

        // Find new catalogs (ADD_TABLE)
        for (const catalog of newCatalogs) {
            if (!oldCatalogIds.has(catalog.id)) {
                diff.additive.push({
                    type: ChangeType.ADD_TABLE,
                    catalogId: catalog.id,
                    catalogCodename: catalog.codename,
                    tableName: SchemaGenerator.generateTableName(catalog.id),
                    isDestructive: false,
                    description: `Create table "${catalog.codename}"`,
                })
            }
        }

        // Find removed catalogs (DROP_TABLE - destructive)
        for (const oldCatalogId of oldCatalogIds) {
            if (!newCatalogIds.has(oldCatalogId)) {
                const oldCatalog = oldSnapshot.catalogs[oldCatalogId]
                diff.destructive.push({
                    type: ChangeType.DROP_TABLE,
                    catalogId: oldCatalogId,
                    catalogCodename: oldCatalog.codename,
                    tableName: oldCatalog.tableName,
                    isDestructive: true,
                    description: `Drop table "${oldCatalog.codename}" (DATA WILL BE LOST)`,
                })
            }
        }

        // Compare existing catalogs
        for (const catalog of newCatalogs) {
            if (!oldCatalogIds.has(catalog.id)) continue // Already handled as ADD_TABLE

            const oldCatalog = oldSnapshot.catalogs[catalog.id]
            const oldAttrIds = new Set(Object.keys(oldCatalog.attributes))
            const newAttrIds = new Set(catalog.attributes.map((a) => a.id))
            
            // Table name is UUID-based, so it stays the same when codename changes
            const tableName = SchemaGenerator.generateTableName(catalog.id)

            // Check for codename change (no SQL migration needed - tableName is UUID-based)
            if (oldCatalog.codename !== catalog.codename) {
                console.info(
                    `[SchemaMigrator] Catalog codename changed from "${oldCatalog.codename}" to "${catalog.codename}". ` +
                    `Table name "${tableName}" remains unchanged (UUID-based naming).`
                )
            }

            // Find new attributes (ADD_COLUMN)
            for (const attr of catalog.attributes) {
                if (!oldAttrIds.has(attr.id)) {
                    diff.additive.push({
                        type: ChangeType.ADD_COLUMN,
                        catalogId: catalog.id,
                        catalogCodename: catalog.codename,
                        tableName: tableName,
                        attributeId: attr.id,
                        attributeCodename: attr.codename,
                        columnName: SchemaGenerator.generateColumnName(attr.id),
                        newValue: attr.dataType,
                        isDestructive: false,
                        description: `Add column "${attr.codename}" (${attr.dataType}) to "${catalog.codename}"`,
                    })
                }
            }

            // Find removed attributes (DROP_COLUMN - destructive)
            for (const oldAttrId of oldAttrIds) {
                if (!newAttrIds.has(oldAttrId)) {
                    const oldAttr = oldCatalog.attributes[oldAttrId]
                    diff.destructive.push({
                        type: ChangeType.DROP_COLUMN,
                        catalogId: catalog.id,
                        catalogCodename: catalog.codename,
                        tableName: tableName,
                        attributeId: oldAttrId,
                        attributeCodename: oldAttr.codename,
                        columnName: oldAttr.columnName,
                        isDestructive: true,
                        description: `Drop column "${oldAttr.codename}" from "${catalog.codename}" (DATA WILL BE LOST)`,
                    })
                }
            }

            // Check for attribute changes (ALTER_COLUMN)
            for (const attr of catalog.attributes) {
                if (!oldAttrIds.has(attr.id)) continue // New attribute, already handled

                const oldAttr = oldCatalog.attributes[attr.id]

                // Type change is destructive (may need data conversion)
                if (oldAttr.dataType !== attr.dataType) {
                    diff.destructive.push({
                        type: ChangeType.ALTER_COLUMN,
                        catalogId: catalog.id,
                        catalogCodename: catalog.codename,
                        tableName: tableName,
                        attributeId: attr.id,
                        attributeCodename: attr.codename,
                        columnName: oldAttr.columnName,
                        oldValue: oldAttr.dataType,
                        newValue: attr.dataType,
                        isDestructive: true,
                        description: `Change type of "${attr.codename}" from ${oldAttr.dataType} to ${attr.dataType}`,
                    })
                }

                // Required change (NULL -> NOT NULL could fail if NULLs exist)
                if (!oldAttr.isRequired && attr.isRequired) {
                    diff.destructive.push({
                        type: ChangeType.ALTER_COLUMN,
                        catalogId: catalog.id,
                        catalogCodename: catalog.codename,
                        tableName: tableName,
                        attributeId: attr.id,
                        attributeCodename: attr.codename,
                        columnName: oldAttr.columnName,
                        oldValue: 'nullable',
                        newValue: 'required',
                        isDestructive: true,
                        description: `Make "${attr.codename}" required (may fail if NULLs exist)`,
                    })
                } else if (oldAttr.isRequired && !attr.isRequired) {
                    // NOT NULL -> NULL is additive (safe)
                    diff.additive.push({
                        type: ChangeType.ALTER_COLUMN,
                        catalogId: catalog.id,
                        catalogCodename: catalog.codename,
                        tableName: tableName,
                        attributeId: attr.id,
                        attributeCodename: attr.codename,
                        columnName: oldAttr.columnName,
                        oldValue: 'required',
                        newValue: 'nullable',
                        isDestructive: false,
                        description: `Make "${attr.codename}" optional`,
                    })
                }

                // FK target change
                if (oldAttr.targetCatalogId !== attr.targetCatalogId) {
                    if (oldAttr.targetCatalogId) {
                        diff.destructive.push({
                            type: ChangeType.DROP_FK,
                            catalogId: catalog.id,
                            catalogCodename: catalog.codename,
                            tableName: tableName,
                            attributeId: attr.id,
                            columnName: oldAttr.columnName,
                            oldValue: oldAttr.targetCatalogId,
                            isDestructive: true,
                            description: `Drop FK on "${attr.codename}"`,
                        })
                    }
                    if (attr.targetCatalogId) {
                        diff.additive.push({
                            type: ChangeType.ADD_FK,
                            catalogId: catalog.id,
                            catalogCodename: catalog.codename,
                            tableName: tableName,
                            attributeId: attr.id,
                            columnName: SchemaGenerator.generateColumnName(attr.id),
                            newValue: attr.targetCatalogId,
                            isDestructive: false,
                            description: `Add FK on "${attr.codename}"`,
                        })
                    }
                }
            }
        }

        diff.hasChanges = diff.additive.length > 0 || diff.destructive.length > 0
        diff.summary = this.buildSummary(diff)

        return diff
    }

    /**
     * Build human-readable summary of changes
     */
    private buildSummary(diff: SchemaDiff): string {
        const parts: string[] = []

        if (diff.additive.length > 0) {
            parts.push(`${diff.additive.length} additive change(s)`)
        }
        if (diff.destructive.length > 0) {
            parts.push(`${diff.destructive.length} DESTRUCTIVE change(s)`)
        }
        if (parts.length === 0) {
            return 'No changes'
        }

        return parts.join(', ')
    }

    /**
     * Build a safe FK constraint name within PostgreSQL's 63-char limit.
     */
    private buildFkConstraintName(tableName: string, columnName: string): string {
        return `fk_${tableName}_${columnName}`.substring(0, 63)
    }

    /**
     * Apply additive changes only (safe operation)
     *
     * @param schemaName - Target schema
     * @param diff - Calculated diff
     * @param catalogs - Current catalog definitions (for new tables)
     */
    public async applyAdditiveChanges(
        schemaName: string,
        diff: SchemaDiff,
        catalogs: CatalogDefinition[]
    ): Promise<MigrationResult> {
        const result: MigrationResult = {
            success: false,
            changesApplied: 0,
            errors: [],
        }

        // Acquire advisory lock
        const lockKey = KnexClient.uuidToLockKey(schemaName)
        const lockAcquired = await KnexClient.acquireAdvisoryLock(lockKey)

        if (!lockAcquired) {
            result.errors.push('Could not acquire advisory lock. Another migration may be in progress.')
            return result
        }

        try {
            for (const change of diff.additive) {
                try {
                    await this.applyChange(schemaName, change, catalogs)
                    result.changesApplied++
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    result.errors.push(`${change.description}: ${message}`)
                }
            }

            result.success = result.errors.length === 0
            result.newSnapshot = this.generator.generateSnapshot(catalogs)
        } finally {
            await KnexClient.releaseAdvisoryLock(lockKey)
        }

        return result
    }

    /**
     * Apply all changes including destructive ones
     * WARNING: This will cause data loss for DROP operations!
     *
     * @param schemaName - Target schema
     * @param diff - Calculated diff
     * @param catalogs - Current catalog definitions
     * @param confirmedDestructive - Must be true to proceed with destructive changes
     */
    public async applyAllChanges(
        schemaName: string,
        diff: SchemaDiff,
        catalogs: CatalogDefinition[],
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
            // Apply destructive changes first (in case they affect additive ones)
            for (const change of diff.destructive) {
                try {
                    await this.applyChange(schemaName, change, catalogs)
                    result.changesApplied++
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    result.errors.push(`${change.description}: ${message}`)
                }
            }

            // Then additive changes
            for (const change of diff.additive) {
                try {
                    await this.applyChange(schemaName, change, catalogs)
                    result.changesApplied++
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    result.errors.push(`${change.description}: ${message}`)
                }
            }

            result.success = result.errors.length === 0
            result.newSnapshot = this.generator.generateSnapshot(catalogs)
        } finally {
            await KnexClient.releaseAdvisoryLock(lockKey)
        }

        return result
    }

    /**
     * Apply a single schema change
     */
    private async applyChange(
        schemaName: string,
        change: SchemaChange,
        catalogs: CatalogDefinition[]
    ): Promise<void> {
        console.log(`[SchemaMigrator] Applying: ${change.description}`)

        switch (change.type) {
            case ChangeType.ADD_TABLE: {
                const catalog = catalogs.find((c) => c.id === change.catalogId)
                if (!catalog) throw new Error(`Catalog ${change.catalogId} not found`)

                await this.knex.schema.withSchema(schemaName).createTable(change.tableName!, (table: Knex.CreateTableBuilder) => {
                    table.uuid('id').primary().defaultTo(this.knex.raw('public.uuid_generate_v7()'))
                    table.timestamp('created_at').notNullable().defaultTo(this.knex.fn.now())
                    table.timestamp('updated_at').notNullable().defaultTo(this.knex.fn.now())

                    for (const attr of catalog.attributes) {
                        const columnName = SchemaGenerator.generateColumnName(attr.id)
                        const pgType = SchemaGenerator.mapDataType(attr.dataType)
                        if (attr.isRequired) {
                            table.specificType(columnName, pgType).notNullable()
                        } else {
                            table.specificType(columnName, pgType).nullable()
                        }
                    }
                })
                break
            }

            case ChangeType.DROP_TABLE: {
                await this.knex.schema.withSchema(schemaName).dropTableIfExists(change.tableName!)
                break
            }

            case ChangeType.ADD_COLUMN: {
                const attr = this.findAttribute(catalogs, change.catalogId!, change.attributeId!)
                const pgType = SchemaGenerator.mapDataType(attr.dataType)

                await this.knex.schema.withSchema(schemaName).alterTable(change.tableName!, (table: Knex.AlterTableBuilder) => {
                    if (attr.isRequired) {
                        // For required columns, we might need a default - use NULL initially
                        table.specificType(change.columnName!, pgType).nullable()
                    } else {
                        table.specificType(change.columnName!, pgType).nullable()
                    }
                })

                // If required, alter to NOT NULL after (will fail if rows exist with NULL)
                if (attr.isRequired) {
                    await this.knex.raw(
                        `ALTER TABLE ??.?? ALTER COLUMN ?? SET NOT NULL`,
                        [schemaName, change.tableName, change.columnName]
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
                // Handle type change or nullability change
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
                    // Type change - complex, needs USING clause
                    const newType = SchemaGenerator.mapDataType(change.newValue as AttributeDataType)
                    await this.knex.raw(
                        `ALTER TABLE ??.?? ALTER COLUMN ?? TYPE ${newType} USING ??::${newType}`,
                        [schemaName, change.tableName, change.columnName, change.columnName]
                    )
                }
                break
            }

            case ChangeType.ADD_FK: {
                const targetCatalog = catalogs.find((c) => c.id === change.newValue)
                if (!targetCatalog) {
                    console.warn(`[SchemaMigrator] Target catalog ${change.newValue} not found for FK`)
                    return
                }
                const constraintName = this.buildFkConstraintName(change.tableName!, change.columnName!)
                const targetTableName = SchemaGenerator.generateTableName(targetCatalog.id)
                await this.knex.raw(
                    `ALTER TABLE ??.?? ADD CONSTRAINT ?? FOREIGN KEY (??) REFERENCES ??.??(id) ON DELETE SET NULL`,
                    [schemaName, change.tableName, constraintName, change.columnName, schemaName, targetTableName]
                )
                break
            }

            case ChangeType.DROP_FK: {
                const constraintName = this.buildFkConstraintName(change.tableName!, change.columnName!)
                await this.knex.raw(
                    `ALTER TABLE ??.?? DROP CONSTRAINT IF EXISTS ??`,
                    [schemaName, change.tableName, constraintName]
                )
                break
            }

            default:
                console.warn(`[SchemaMigrator] Unknown change type: ${change.type}`)
        }
    }

    /**
     * Find attribute in catalogs list
     */
    private findAttribute(
        catalogs: CatalogDefinition[],
        catalogId: string,
        attributeId: string
    ): AttributeDefinition {
        const catalog = catalogs.find((c) => c.id === catalogId)
        if (!catalog) throw new Error(`Catalog ${catalogId} not found`)

        const attr = catalog.attributes.find((a) => a.id === attributeId)
        if (!attr) throw new Error(`Attribute ${attributeId} not found in catalog ${catalogId}`)

        return attr
    }
}

export default SchemaMigrator
