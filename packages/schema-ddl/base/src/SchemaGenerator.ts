import type { Knex } from 'knex'
import { AttributeDataType, MetaEntityKind, getPhysicalDataType, formatPhysicalType } from '@universo/types'
import type { AttributeValidationRules } from '@universo/types'
import { buildSchemaSnapshot } from './snapshot'
import { buildFkConstraintName, generateColumnName, generateTableName, generateChildTableName, isValidSchemaName } from './naming'
import { generateMigrationName } from './MigrationManager'
import type { MigrationManager } from './MigrationManager'
import type { EntityDefinition, FieldDefinition, SchemaGenerationResult, SchemaSnapshot } from './types'
import type { SchemaDiff } from './diff'

const ENUMERATION_KIND: MetaEntityKind = ((MetaEntityKind as unknown as { ENUMERATION?: MetaEntityKind }).ENUMERATION ??
    'enumeration') as MetaEntityKind

/**
 * Options for generateFullSchema method
 */
export interface GenerateFullSchemaOptions {
    /** Record initial migration in _app_migrations table */
    recordMigration?: boolean
    /** Description for migration name generation */
    migrationDescription?: string
    /** MigrationManager instance for recording migrations (required if recordMigration is true) */
    migrationManager?: MigrationManager
    /** Optional metadata to store in migration record */
    migrationMeta?: Pick<import('./types').MigrationMeta, 'publicationSnapshotHash' | 'publicationId' | 'publicationVersionId'>
    /** Optional Metahub snapshot stored separately from meta */
    publicationSnapshot?: Record<string, unknown> | null
    /** User ID for audit fields */
    userId?: string | null
}

/**
 * SchemaGenerator - Creates PostgreSQL schemas and tables from Metahub configuration.
 *
 * Uses Dependency Injection pattern: receives Knex instance via constructor
 * instead of using a singleton.
 */
export class SchemaGenerator {
    private knex: Knex

    constructor(knex: Knex) {
        this.knex = knex
    }

    /**
     * Maps abstract data type to PostgreSQL type with optional configuration.
     * Delegates to shared getPhysicalDataType() from @universo/types.
     * @param dataType - The abstract data type
     * @param config - Type-specific configuration from validationRules
     * @returns PostgreSQL type string
     */
    public static mapDataType(dataType: AttributeDataType, config?: Partial<AttributeValidationRules>): string {
        if (dataType === AttributeDataType.TABLE) {
            throw new Error('TABLE is a virtual type with no physical column. Use createTabularTable() instead.')
        }
        const info = getPhysicalDataType(dataType, config)
        return formatPhysicalType(info)
    }

    public async createSchema(schemaName: string, trx?: Knex.Transaction): Promise<void> {
        console.log(`[SchemaGenerator] Creating schema: ${schemaName}`)

        if (!isValidSchemaName(schemaName)) {
            throw new Error(`Invalid schema name format: ${schemaName}`)
        }

        const knex = trx ?? this.knex
        await knex.raw(`CREATE SCHEMA IF NOT EXISTS ??`, [schemaName])
        console.log(`[SchemaGenerator] Schema ${schemaName} created`)
    }

    public async dropSchema(schemaName: string, trx?: Knex.Transaction): Promise<void> {
        console.log(`[SchemaGenerator] Dropping schema: ${schemaName}`)

        if (!isValidSchemaName(schemaName)) {
            throw new Error(`Invalid schema name format: ${schemaName}`)
        }

        const knex = trx ?? this.knex
        await knex.raw(`DROP SCHEMA IF EXISTS ?? CASCADE`, [schemaName])
        console.log(`[SchemaGenerator] Schema ${schemaName} dropped`)
    }

    public async generateFullSchema(
        schemaName: string,
        entities: EntityDefinition[],
        options?: GenerateFullSchemaOptions
    ): Promise<SchemaGenerationResult> {
        const result: SchemaGenerationResult = {
            success: false,
            schemaName,
            tablesCreated: [],
            errors: []
        }

        try {
            await this.knex.transaction(async (trx) => {
                await this.createSchema(schemaName, trx)

                for (const entity of entities) {
                    if (entity.kind === ENUMERATION_KIND) {
                        continue
                    }
                    await this.createEntityTable(schemaName, entity, trx)
                    result.tablesCreated.push(entity.codename)

                    // Create tabular tables for TABLE attributes
                    const tableFields = entity.fields.filter((f) => f.dataType === AttributeDataType.TABLE && !f.parentAttributeId)
                    for (const tableField of tableFields) {
                        const childFields = entity.fields.filter((f) => f.parentAttributeId === tableField.id)
                        const parentTableName = generateTableName(entity.id, entity.kind)
                        await this.createTabularTable(schemaName, parentTableName, tableField, childFields, trx)
                        result.tablesCreated.push(`${entity.codename}__tbl__${tableField.codename}`)
                    }
                }

                // Ensure system tables before adding REF FKs that may target _app_values.
                await this.ensureSystemTables(schemaName, trx)

                for (const entity of entities) {
                    const rootRefFields = entity.fields.filter(
                        (field) => field.dataType === AttributeDataType.REF && field.targetEntityId && !field.parentAttributeId
                    )
                    for (const field of rootRefFields) {
                        await this.addForeignKey(schemaName, entity, field, entities, trx)
                    }

                    const childRefFields = entity.fields.filter(
                        (field) => field.dataType === AttributeDataType.REF && field.targetEntityId && Boolean(field.parentAttributeId)
                    )
                    for (const childRefField of childRefFields) {
                        const tableParentField = entity.fields.find(
                            (field) => field.id === childRefField.parentAttributeId && field.dataType === AttributeDataType.TABLE
                        )
                        if (!tableParentField) {
                            console.warn(
                                `[SchemaGenerator] TABLE parent field ${childRefField.parentAttributeId} not found for child REF field ${childRefField.id}`
                            )
                            continue
                        }

                        const parentTableName = generateTableName(entity.id, entity.kind)
                        const tabularTableName = generateChildTableName(tableParentField.id)
                        await this.addForeignKeyToTable(schemaName, tabularTableName, childRefField, entities, trx)
                    }
                }

                await this.syncSystemMetadata(schemaName, entities, { trx, userId: options?.userId })

                // Record initial migration if requested
                if (options?.recordMigration) {
                    if (!options.migrationManager) {
                        throw new Error('migrationManager is required when recordMigration is true')
                    }
                    const migrationManager = options.migrationManager
                    const snapshot = this.generateSnapshot(entities)
                    const description = options.migrationDescription || 'initial_schema'
                    const migrationName = generateMigrationName(description)

                    // Initial migration: snapshotBefore is null, snapshotAfter is current state
                    const initialDiff: SchemaDiff = {
                        hasChanges: true,
                        additive: [],
                        destructive: [],
                        summary: `Initial schema creation with ${entities.length} table(s)`
                    }

                    await migrationManager.recordMigration(
                        schemaName,
                        migrationName,
                        null, // snapshotBefore
                        snapshot,
                        initialDiff,
                        trx,
                        options.migrationMeta,
                        options.publicationSnapshot ?? null,
                        options.userId ?? null
                    )
                }
            })

            result.success = true
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            result.errors.push(`Schema generation failed: ${message}`)
        }

        return result
    }

    public async createEntityTable(schemaName: string, entity: EntityDefinition, trx?: Knex.Transaction): Promise<void> {
        if (entity.kind === ENUMERATION_KIND) {
            console.log(`[SchemaGenerator] Skipping physical table for enumeration entity: ${entity.codename}`)
            return
        }

        const tableName = generateTableName(entity.id, entity.kind)
        console.log(`[SchemaGenerator] Creating table: ${schemaName}.${tableName} (entity: ${entity.codename})`)

        const knex = trx ?? this.knex
        await knex.schema.withSchema(schemaName).createTable(tableName, (table: Knex.CreateTableBuilder) => {
            table.uuid('id').primary().defaultTo(knex.raw('public.uuid_generate_v7()'))

            // User-defined fields (skip TABLE and child fields)
            for (const field of entity.fields) {
                // TABLE fields create separate child tables, not columns
                if (field.dataType === AttributeDataType.TABLE) continue
                // Child fields belong to tabular tables, not the parent entity table
                if (field.parentAttributeId) continue

                const columnName = generateColumnName(field.id)
                const pgType = SchemaGenerator.mapDataType(
                    field.dataType,
                    field.validationRules as Partial<AttributeValidationRules> | undefined
                )
                if (field.isRequired) {
                    table.specificType(columnName, pgType).notNullable()
                } else {
                    const col = table.specificType(columnName, pgType).nullable()
                    // BOOLEAN columns default to false to prevent NULL → indeterminate checkbox state
                    if (field.dataType === AttributeDataType.BOOLEAN) {
                        col.defaultTo(false)
                    }
                }
            }

            // ═══════════════════════════════════════════════════════════════════════
            // Platform-level system fields (_upl_*)
            // ═══════════════════════════════════════════════════════════════════════
            table.timestamp('_upl_created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
            table.uuid('_upl_created_by').nullable()
            table.timestamp('_upl_updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
            table.uuid('_upl_updated_by').nullable()
            table.integer('_upl_version').notNullable().defaultTo(1)
            // Archive fields
            table.boolean('_upl_archived').notNullable().defaultTo(false)
            table.timestamp('_upl_archived_at', { useTz: true }).nullable()
            table.uuid('_upl_archived_by').nullable()
            // Soft delete fields
            table.boolean('_upl_deleted').notNullable().defaultTo(false)
            table.timestamp('_upl_deleted_at', { useTz: true }).nullable()
            table.uuid('_upl_deleted_by').nullable()
            table.timestamp('_upl_purge_after', { useTz: true }).nullable()
            // Lock fields
            table.boolean('_upl_locked').notNullable().defaultTo(false)
            table.timestamp('_upl_locked_at', { useTz: true }).nullable()
            table.uuid('_upl_locked_by').nullable()
            table.text('_upl_locked_reason').nullable()

            // ═══════════════════════════════════════════════════════════════════════
            // Application-level system fields (_app_*)
            // ═══════════════════════════════════════════════════════════════════════
            // Publication status
            table.boolean('_app_published').notNullable().defaultTo(true)
            table.timestamp('_app_published_at', { useTz: true }).nullable()
            table.uuid('_app_published_by').nullable()
            // Archive fields
            table.boolean('_app_archived').notNullable().defaultTo(false)
            table.timestamp('_app_archived_at', { useTz: true }).nullable()
            table.uuid('_app_archived_by').nullable()
            // Soft delete fields
            table.boolean('_app_deleted').notNullable().defaultTo(false)
            table.timestamp('_app_deleted_at', { useTz: true }).nullable()
            table.uuid('_app_deleted_by').nullable()
            // Access control
            table.uuid('_app_owner_id').nullable()
            table.string('_app_access_level', 20).notNullable().defaultTo('private')
        })

        // Create indexes for system fields
        await knex.raw(`
            CREATE INDEX IF NOT EXISTS idx_${tableName}_upl_deleted
            ON "${schemaName}"."${tableName}" (_upl_deleted_at)
            WHERE _upl_deleted = true
        `)
        await knex.raw(`
            CREATE INDEX IF NOT EXISTS idx_${tableName}_app_deleted
            ON "${schemaName}"."${tableName}" (_app_deleted_at)
            WHERE _app_deleted = true
        `)
        await knex.raw(`
            CREATE INDEX IF NOT EXISTS idx_${tableName}_app_owner
            ON "${schemaName}"."${tableName}" (_app_owner_id)
            WHERE _app_owner_id IS NOT NULL
        `)

        console.log(`[SchemaGenerator] Table ${schemaName}.${tableName} created`)
    }

    /**
     * Creates a tabular part table for a TABLE attribute.
     * Child table has: id, _tp_parent_id (FK CASCADE), _tp_sort_order,
     * child attribute columns, and full _upl_* + _app_* system fields.
     */
    public async createTabularTable(
        schemaName: string,
        parentTableName: string,
        tableField: FieldDefinition,
        childFields: FieldDefinition[],
        trx?: Knex.Transaction
    ): Promise<void> {
        const tabularTableName = generateChildTableName(tableField.id)
        console.log(`[SchemaGenerator] Creating tabular table: ${schemaName}.${tabularTableName}`)

        const knex = trx ?? this.knex
        await knex.schema.withSchema(schemaName).createTable(tabularTableName, (table: Knex.CreateTableBuilder) => {
            table.uuid('id').primary().defaultTo(knex.raw('public.uuid_generate_v7()'))

            // Parent reference with CASCADE delete
            table.uuid('_tp_parent_id').notNullable()
            table.integer('_tp_sort_order').notNullable().defaultTo(0)

            // Child attribute columns
            for (const child of childFields) {
                const columnName = generateColumnName(child.id)
                const pgType = SchemaGenerator.mapDataType(
                    child.dataType,
                    child.validationRules as Partial<AttributeValidationRules> | undefined
                )
                if (child.isRequired) {
                    table.specificType(columnName, pgType).notNullable()
                } else {
                    const col = table.specificType(columnName, pgType).nullable()
                    if (child.dataType === AttributeDataType.BOOLEAN) {
                        col.defaultTo(false)
                    }
                }
            }

            // ═══════════════════════════════════════════════════════════════════════
            // Platform-level system fields (_upl_*)
            // ═══════════════════════════════════════════════════════════════════════
            table.timestamp('_upl_created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
            table.uuid('_upl_created_by').nullable()
            table.timestamp('_upl_updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
            table.uuid('_upl_updated_by').nullable()
            table.integer('_upl_version').notNullable().defaultTo(1)
            table.boolean('_upl_archived').notNullable().defaultTo(false)
            table.timestamp('_upl_archived_at', { useTz: true }).nullable()
            table.uuid('_upl_archived_by').nullable()
            table.boolean('_upl_deleted').notNullable().defaultTo(false)
            table.timestamp('_upl_deleted_at', { useTz: true }).nullable()
            table.uuid('_upl_deleted_by').nullable()
            table.timestamp('_upl_purge_after', { useTz: true }).nullable()
            table.boolean('_upl_locked').notNullable().defaultTo(false)
            table.timestamp('_upl_locked_at', { useTz: true }).nullable()
            table.uuid('_upl_locked_by').nullable()
            table.text('_upl_locked_reason').nullable()

            // ═══════════════════════════════════════════════════════════════════════
            // Application-level system fields (_app_*)
            // ═══════════════════════════════════════════════════════════════════════
            table.boolean('_app_published').notNullable().defaultTo(true)
            table.timestamp('_app_published_at', { useTz: true }).nullable()
            table.uuid('_app_published_by').nullable()
            table.boolean('_app_archived').notNullable().defaultTo(false)
            table.timestamp('_app_archived_at', { useTz: true }).nullable()
            table.uuid('_app_archived_by').nullable()
            table.boolean('_app_deleted').notNullable().defaultTo(false)
            table.timestamp('_app_deleted_at', { useTz: true }).nullable()
            table.uuid('_app_deleted_by').nullable()
            table.uuid('_app_owner_id').nullable()
            table.string('_app_access_level', 20).notNullable().defaultTo('private')
        })

        // FK: _tp_parent_id → parent table with CASCADE delete
        const fkName = buildFkConstraintName(tabularTableName, '_tp_parent_id')
        await knex.raw(`ALTER TABLE ??.?? ADD CONSTRAINT ?? FOREIGN KEY ("_tp_parent_id") REFERENCES ??.??(id) ON DELETE CASCADE`, [
            schemaName,
            tabularTableName,
            fkName,
            schemaName,
            parentTableName
        ])

        // Indexes — use abbreviated suffixes to stay within PostgreSQL 63-char identifier limit
        const idxParent = `idx_${tabularTableName}_pi`.substring(0, 63)
        const idxParentSort = `idx_${tabularTableName}_ps`.substring(0, 63)
        const idxAppDeleted = `idx_${tabularTableName}_ad`.substring(0, 63)
        const idxUplDeleted = `idx_${tabularTableName}_ud`.substring(0, 63)

        await knex.raw(`
            CREATE INDEX IF NOT EXISTS "${idxParent}"
            ON "${schemaName}"."${tabularTableName}" (_tp_parent_id)
        `)
        await knex.raw(`
            CREATE INDEX IF NOT EXISTS "${idxParentSort}"
            ON "${schemaName}"."${tabularTableName}" (_tp_parent_id, _tp_sort_order)
        `)
        await knex.raw(`
            CREATE INDEX IF NOT EXISTS "${idxAppDeleted}"
            ON "${schemaName}"."${tabularTableName}" (_app_deleted_at)
            WHERE _app_deleted = true
        `)
        await knex.raw(`
            CREATE INDEX IF NOT EXISTS "${idxUplDeleted}"
            ON "${schemaName}"."${tabularTableName}" (_upl_deleted_at)
            WHERE _upl_deleted = true
        `)

        console.log(`[SchemaGenerator] Tabular table ${schemaName}.${tabularTableName} created`)
    }

    public async addForeignKey(
        schemaName: string,
        entity: EntityDefinition,
        field: FieldDefinition,
        entities: EntityDefinition[],
        trx?: Knex.Transaction
    ): Promise<void> {
        const sourceTableName = generateTableName(entity.id, entity.kind)
        await this.addForeignKeyToTable(schemaName, sourceTableName, field, entities, trx)
    }

    private async addForeignKeyToTable(
        schemaName: string,
        sourceTableName: string,
        field: FieldDefinition,
        entities: EntityDefinition[],
        trx?: Knex.Transaction
    ): Promise<void> {
        if (!field.targetEntityId) {
            return
        }

        const columnName = generateColumnName(field.id)
        const constraintName = buildFkConstraintName(sourceTableName, columnName)
        const knex = trx ?? this.knex

        if (field.targetEntityKind === ENUMERATION_KIND) {
            await this.ensureSystemTables(schemaName, trx)
            console.log(`[SchemaGenerator] Adding FK: ${sourceTableName}.${columnName} -> _app_values.id`)
            await knex.raw(
                `
                ALTER TABLE ??.??
                ADD CONSTRAINT ??
                FOREIGN KEY (??)
                REFERENCES ??._app_values(id)
                ON DELETE SET NULL
            `,
                [schemaName, sourceTableName, constraintName, columnName, schemaName]
            )
            return
        }

        const targetEntity = entities.find((item) => item.id === field.targetEntityId)
        if (!targetEntity) {
            console.warn(`[SchemaGenerator] Target entity ${field.targetEntityId} not found for REF field ${field.id}`)
            return
        }

        const targetTableName = generateTableName(targetEntity.id, targetEntity.kind)

        console.log(`[SchemaGenerator] Adding FK: ${sourceTableName}.${columnName} -> ${targetTableName}.id`)
        await knex.raw(
            `
            ALTER TABLE ??.??
            ADD CONSTRAINT ??
            FOREIGN KEY (??)
            REFERENCES ??.??(id)
            ON DELETE SET NULL
        `,
            [schemaName, sourceTableName, constraintName, columnName, schemaName, targetTableName]
        )
    }

    public async systemTablesExist(schemaName: string): Promise<boolean> {
        const knex = this.knex
        const hasObjects = await knex.schema.withSchema(schemaName).hasTable('_app_objects')
        const hasAttributes = await knex.schema.withSchema(schemaName).hasTable('_app_attributes')
        return hasObjects && hasAttributes
    }

    public async ensureSystemTables(schemaName: string, trx?: Knex.Transaction): Promise<void> {
        const knex = trx ?? this.knex

        console.log(`[SchemaGenerator] Ensuring system tables in schema: ${schemaName}`)

        // IMPORTANT: Do NOT reuse SchemaBuilder object - create fresh one for each operation
        // Knex SchemaBuilder accumulates state and can cause "relation already exists" errors
        const hasObjects = await knex.schema.withSchema(schemaName).hasTable('_app_objects')
        console.log(`[SchemaGenerator] _app_objects exists: ${hasObjects}`)

        if (!hasObjects) {
            console.log(`[SchemaGenerator] Creating _app_objects...`)
            await knex.schema.withSchema(schemaName).createTable('_app_objects', (table) => {
                table.uuid('id').primary()
                table.string('kind', 20).notNullable()
                table.string('codename', 100).notNullable()
                table.string('table_name', 255).notNullable()
                table.jsonb('presentation').notNullable().defaultTo('{}')
                table.jsonb('config').notNullable().defaultTo('{}')

                // ═══════════════════════════════════════════════════════════════════════
                // Platform-level system fields (_upl_*)
                // ═══════════════════════════════════════════════════════════════════════
                table.timestamp('_upl_created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
                table.uuid('_upl_created_by').nullable()
                table.timestamp('_upl_updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
                table.uuid('_upl_updated_by').nullable()
                table.integer('_upl_version').notNullable().defaultTo(1)
                // Archive fields
                table.boolean('_upl_archived').notNullable().defaultTo(false)
                table.timestamp('_upl_archived_at', { useTz: true }).nullable()
                table.uuid('_upl_archived_by').nullable()
                // Soft delete fields
                table.boolean('_upl_deleted').notNullable().defaultTo(false)
                table.timestamp('_upl_deleted_at', { useTz: true }).nullable()
                table.uuid('_upl_deleted_by').nullable()
                table.timestamp('_upl_purge_after', { useTz: true }).nullable()
                // Lock fields
                table.boolean('_upl_locked').notNullable().defaultTo(false)
                table.timestamp('_upl_locked_at', { useTz: true }).nullable()
                table.uuid('_upl_locked_by').nullable()
                table.text('_upl_locked_reason').nullable()

                // ═══════════════════════════════════════════════════════════════════════
                // Application-level system fields (_app_*)
                // ═══════════════════════════════════════════════════════════════════════
                // Publication status
                table.boolean('_app_published').notNullable().defaultTo(true)
                table.timestamp('_app_published_at', { useTz: true }).nullable()
                table.uuid('_app_published_by').nullable()
                // Archive fields
                table.boolean('_app_archived').notNullable().defaultTo(false)
                table.timestamp('_app_archived_at', { useTz: true }).nullable()
                table.uuid('_app_archived_by').nullable()
                // Soft delete fields
                table.boolean('_app_deleted').notNullable().defaultTo(false)
                table.timestamp('_app_deleted_at', { useTz: true }).nullable()
                table.uuid('_app_deleted_by').nullable()

                table.unique(['kind', 'codename'])
                table.unique(['table_name'])
            })
            console.log(`[SchemaGenerator] _app_objects created`)
        }

        const hasAttributes = await knex.schema.withSchema(schemaName).hasTable('_app_attributes')
        console.log(`[SchemaGenerator] _app_attributes exists: ${hasAttributes}`)

        if (!hasAttributes) {
            console.log(`[SchemaGenerator] Creating _app_attributes...`)
            await knex.schema.withSchema(schemaName).createTable('_app_attributes', (table) => {
                table.uuid('id').primary()
                table.uuid('object_id').notNullable()
                table.string('codename', 100).notNullable()
                // Stable field order from metahub snapshot (1..N). Used by runtime UI rendering.
                table.integer('sort_order').notNullable().defaultTo(0)
                table.string('column_name', 255).notNullable()
                table.string('data_type', 20).notNullable()
                table.boolean('is_required').notNullable().defaultTo(false)
                table.boolean('is_display_attribute').notNullable().defaultTo(false)
                // Polymorphic reference: target entity ID and kind
                table.uuid('target_object_id').nullable()
                table.string('target_object_kind', 20).nullable() // 'catalog', 'document', 'hub', etc.
                // Self-reference: parent TABLE attribute ID for child attributes
                table.uuid('parent_attribute_id').nullable()
                table.jsonb('presentation').notNullable().defaultTo('{}')
                table.jsonb('validation_rules').notNullable().defaultTo('{}')
                table.jsonb('ui_config').notNullable().defaultTo('{}')

                // ═══════════════════════════════════════════════════════════════════════
                // Platform-level system fields (_upl_*)
                // ═══════════════════════════════════════════════════════════════════════
                table.timestamp('_upl_created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
                table.uuid('_upl_created_by').nullable()
                table.timestamp('_upl_updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
                table.uuid('_upl_updated_by').nullable()
                table.integer('_upl_version').notNullable().defaultTo(1)
                // Archive fields
                table.boolean('_upl_archived').notNullable().defaultTo(false)
                table.timestamp('_upl_archived_at', { useTz: true }).nullable()
                table.uuid('_upl_archived_by').nullable()
                // Soft delete fields
                table.boolean('_upl_deleted').notNullable().defaultTo(false)
                table.timestamp('_upl_deleted_at', { useTz: true }).nullable()
                table.uuid('_upl_deleted_by').nullable()
                table.timestamp('_upl_purge_after', { useTz: true }).nullable()
                // Lock fields
                table.boolean('_upl_locked').notNullable().defaultTo(false)
                table.timestamp('_upl_locked_at', { useTz: true }).nullable()
                table.uuid('_upl_locked_by').nullable()
                table.text('_upl_locked_reason').nullable()

                // ═══════════════════════════════════════════════════════════════════════
                // Application-level system fields (_app_*)
                // ═══════════════════════════════════════════════════════════════════════
                // Publication status
                table.boolean('_app_published').notNullable().defaultTo(true)
                table.timestamp('_app_published_at', { useTz: true }).nullable()
                table.uuid('_app_published_by').nullable()
                // Archive fields
                table.boolean('_app_archived').notNullable().defaultTo(false)
                table.timestamp('_app_archived_at', { useTz: true }).nullable()
                table.uuid('_app_archived_by').nullable()
                // Soft delete fields
                table.boolean('_app_deleted').notNullable().defaultTo(false)
                table.timestamp('_app_deleted_at', { useTz: true }).nullable()
                table.uuid('_app_deleted_by').nullable()

                table.foreign('object_id').references('id').inTable(`${schemaName}._app_objects`).onDelete('CASCADE')
                table.foreign('target_object_id').references('id').inTable(`${schemaName}._app_objects`).onDelete('SET NULL')
                table.foreign('parent_attribute_id').references('id').inTable(`${schemaName}._app_attributes`).onDelete('CASCADE')
                table.unique(['object_id', 'column_name'])
                table.index(['parent_attribute_id'], 'idx_app_attributes_parent')
            })

            // Partial unique indexes for codename uniqueness (scoped by parent/root and soft-delete status)
            await knex.raw(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_app_attributes_object_codename_root_active
                ON "${schemaName}"._app_attributes (object_id, codename)
                WHERE parent_attribute_id IS NULL AND _upl_deleted = false AND _app_deleted = false
            `)

            await knex.raw(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_app_attributes_object_parent_codename_child_active
                ON "${schemaName}"._app_attributes (object_id, parent_attribute_id, codename)
                WHERE parent_attribute_id IS NOT NULL AND _upl_deleted = false AND _app_deleted = false
            `)

            console.log(`[SchemaGenerator] _app_attributes created`)
        }

        const hasMigrations = await knex.schema.withSchema(schemaName).hasTable('_app_migrations')
        console.log(`[SchemaGenerator] _app_migrations exists: ${hasMigrations}`)

        if (!hasMigrations) {
            console.log(`[SchemaGenerator] Creating _app_migrations...`)
            await knex.schema.withSchema(schemaName).createTable('_app_migrations', (table) => {
                table.uuid('id').primary().defaultTo(knex.raw('public.uuid_generate_v7()'))
                table.string('name', 255).notNullable()
                table.timestamp('applied_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
                table.jsonb('meta').notNullable().defaultTo('{}')
                table.jsonb('publication_snapshot').nullable()

                // ═══════════════════════════════════════════════════════════════════════
                // Platform-level system fields (_upl_*)
                // ═══════════════════════════════════════════════════════════════════════
                table.timestamp('_upl_created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
                table.uuid('_upl_created_by').nullable()
                table.timestamp('_upl_updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
                table.uuid('_upl_updated_by').nullable()
                table.integer('_upl_version').notNullable().defaultTo(1)
                // Archive fields
                table.boolean('_upl_archived').notNullable().defaultTo(false)
                table.timestamp('_upl_archived_at', { useTz: true }).nullable()
                table.uuid('_upl_archived_by').nullable()
                // Soft delete fields
                table.boolean('_upl_deleted').notNullable().defaultTo(false)
                table.timestamp('_upl_deleted_at', { useTz: true }).nullable()
                table.uuid('_upl_deleted_by').nullable()
                table.timestamp('_upl_purge_after', { useTz: true }).nullable()
                // Lock fields
                table.boolean('_upl_locked').notNullable().defaultTo(false)
                table.timestamp('_upl_locked_at', { useTz: true }).nullable()
                table.uuid('_upl_locked_by').nullable()
                table.text('_upl_locked_reason').nullable()

                // ═══════════════════════════════════════════════════════════════════════
                // Application-level system fields (_app_*)
                // ═══════════════════════════════════════════════════════════════════════
                // Publication status
                table.boolean('_app_published').notNullable().defaultTo(true)
                table.timestamp('_app_published_at', { useTz: true }).nullable()
                table.uuid('_app_published_by').nullable()
                // Archive fields
                table.boolean('_app_archived').notNullable().defaultTo(false)
                table.timestamp('_app_archived_at', { useTz: true }).nullable()
                table.uuid('_app_archived_by').nullable()
                // Soft delete fields
                table.boolean('_app_deleted').notNullable().defaultTo(false)
                table.timestamp('_app_deleted_at', { useTz: true }).nullable()
                table.uuid('_app_deleted_by').nullable()

                table.unique(['name'])
            })
            console.log(`[SchemaGenerator] _app_migrations created`)
        }

        const hasSettings = await knex.schema.withSchema(schemaName).hasTable('_app_settings')
        console.log(`[SchemaGenerator] _app_settings exists: ${hasSettings}`)

        const hasLayouts = await knex.schema.withSchema(schemaName).hasTable('_app_layouts')
        console.log(`[SchemaGenerator] _app_layouts exists: ${hasLayouts}`)

        if (!hasLayouts) {
            console.log(`[SchemaGenerator] Creating _app_layouts...`)
            await knex.schema.withSchema(schemaName).createTable('_app_layouts', (table) => {
                table.uuid('id').primary().defaultTo(knex.raw('public.uuid_generate_v7()'))
                table.string('template_key', 100).notNullable().defaultTo('dashboard')
                table.jsonb('name').notNullable().defaultTo('{}')
                table.jsonb('description').nullable()
                table.jsonb('config').notNullable().defaultTo('{}')
                table.boolean('is_active').notNullable().defaultTo(true)
                table.boolean('is_default').notNullable().defaultTo(false)
                table.integer('sort_order').notNullable().defaultTo(0)
                table.uuid('owner_id').nullable()

                // ═══════════════════════════════════════════════════════════════════════
                // Platform-level system fields (_upl_*)
                // ═══════════════════════════════════════════════════════════════════════
                table.timestamp('_upl_created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
                table.uuid('_upl_created_by').nullable()
                table.timestamp('_upl_updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
                table.uuid('_upl_updated_by').nullable()
                table.integer('_upl_version').notNullable().defaultTo(1)
                // Archive fields
                table.boolean('_upl_archived').notNullable().defaultTo(false)
                table.timestamp('_upl_archived_at', { useTz: true }).nullable()
                table.uuid('_upl_archived_by').nullable()
                // Soft delete fields
                table.boolean('_upl_deleted').notNullable().defaultTo(false)
                table.timestamp('_upl_deleted_at', { useTz: true }).nullable()
                table.uuid('_upl_deleted_by').nullable()
                table.timestamp('_upl_purge_after', { useTz: true }).nullable()
                // Lock fields
                table.boolean('_upl_locked').notNullable().defaultTo(false)
                table.timestamp('_upl_locked_at', { useTz: true }).nullable()
                table.uuid('_upl_locked_by').nullable()
                table.text('_upl_locked_reason').nullable()

                // ═══════════════════════════════════════════════════════════════════════
                // Application-level system fields (_app_*)
                // ═══════════════════════════════════════════════════════════════════════
                // Publication status
                table.boolean('_app_published').notNullable().defaultTo(true)
                table.timestamp('_app_published_at', { useTz: true }).nullable()
                table.uuid('_app_published_by').nullable()
                // Archive fields
                table.boolean('_app_archived').notNullable().defaultTo(false)
                table.timestamp('_app_archived_at', { useTz: true }).nullable()
                table.uuid('_app_archived_by').nullable()
                // Soft delete fields
                table.boolean('_app_deleted').notNullable().defaultTo(false)
                table.timestamp('_app_deleted_at', { useTz: true }).nullable()
                table.uuid('_app_deleted_by').nullable()

                table.index(['template_key'], 'idx_app_layouts_template_key')
                table.index(['is_active'], 'idx_app_layouts_is_active')
                table.index(['is_default'], 'idx_app_layouts_is_default')
                table.index(['sort_order'], 'idx_app_layouts_sort_order')
            })

            await knex.raw(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_app_layouts_default_active
                ON "${schemaName}"._app_layouts (is_default)
                WHERE is_default = true AND _upl_deleted = false AND _app_deleted = false
            `)
            console.log(`[SchemaGenerator] _app_layouts created`)
        }

        const hasWidgets = await knex.schema.withSchema(schemaName).hasTable('_app_widgets')
        console.log(`[SchemaGenerator] _app_widgets exists: ${hasWidgets}`)
        if (!hasWidgets) {
            console.log(`[SchemaGenerator] Creating _app_widgets...`)
            await knex.schema.withSchema(schemaName).createTable('_app_widgets', (table) => {
                table.uuid('id').primary().defaultTo(knex.raw('public.uuid_generate_v7()'))
                table.uuid('layout_id').notNullable().references('id').inTable(`${schemaName}._app_layouts`).onDelete('CASCADE')
                table.string('zone', 20).notNullable()
                table.string('widget_key', 100).notNullable()
                table.integer('sort_order').notNullable().defaultTo(1)
                table.jsonb('config').notNullable().defaultTo('{}')

                table.timestamp('_upl_created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
                table.uuid('_upl_created_by').nullable()
                table.timestamp('_upl_updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
                table.uuid('_upl_updated_by').nullable()
                table.integer('_upl_version').notNullable().defaultTo(1)
                table.boolean('_upl_archived').notNullable().defaultTo(false)
                table.timestamp('_upl_archived_at', { useTz: true }).nullable()
                table.uuid('_upl_archived_by').nullable()
                table.boolean('_upl_deleted').notNullable().defaultTo(false)
                table.timestamp('_upl_deleted_at', { useTz: true }).nullable()
                table.uuid('_upl_deleted_by').nullable()
                table.timestamp('_upl_purge_after', { useTz: true }).nullable()
                table.boolean('_upl_locked').notNullable().defaultTo(false)
                table.timestamp('_upl_locked_at', { useTz: true }).nullable()
                table.uuid('_upl_locked_by').nullable()
                table.text('_upl_locked_reason').nullable()

                table.boolean('_app_published').notNullable().defaultTo(true)
                table.timestamp('_app_published_at', { useTz: true }).nullable()
                table.uuid('_app_published_by').nullable()
                table.boolean('_app_archived').notNullable().defaultTo(false)
                table.timestamp('_app_archived_at', { useTz: true }).nullable()
                table.uuid('_app_archived_by').nullable()
                table.boolean('_app_deleted').notNullable().defaultTo(false)
                table.timestamp('_app_deleted_at', { useTz: true }).nullable()
                table.uuid('_app_deleted_by').nullable()

                table.index(['layout_id'], 'idx_app_widgets_layout_id')
                table.index(['layout_id', 'zone', 'sort_order'], 'idx_app_widgets_layout_zone_sort')
            })
            console.log(`[SchemaGenerator] _app_widgets created`)
        }

        const hasEnumValues = await knex.schema.withSchema(schemaName).hasTable('_app_values')
        console.log(`[SchemaGenerator] _app_values exists: ${hasEnumValues}`)
        if (!hasEnumValues) {
            console.log(`[SchemaGenerator] Creating _app_values...`)
            await knex.schema.withSchema(schemaName).createTable('_app_values', (table) => {
                table.uuid('id').primary().defaultTo(knex.raw('public.uuid_generate_v7()'))
                table.uuid('object_id').notNullable().references('id').inTable(`${schemaName}._app_objects`).onDelete('CASCADE')
                table.string('codename', 100).notNullable()
                table.jsonb('presentation').notNullable().defaultTo('{}')
                table.integer('sort_order').notNullable().defaultTo(0)
                table.boolean('is_default').notNullable().defaultTo(false)

                table.timestamp('_upl_created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
                table.uuid('_upl_created_by').nullable()
                table.timestamp('_upl_updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
                table.uuid('_upl_updated_by').nullable()
                table.integer('_upl_version').notNullable().defaultTo(1)
                table.boolean('_upl_archived').notNullable().defaultTo(false)
                table.timestamp('_upl_archived_at', { useTz: true }).nullable()
                table.uuid('_upl_archived_by').nullable()
                table.boolean('_upl_deleted').notNullable().defaultTo(false)
                table.timestamp('_upl_deleted_at', { useTz: true }).nullable()
                table.uuid('_upl_deleted_by').nullable()
                table.timestamp('_upl_purge_after', { useTz: true }).nullable()
                table.boolean('_upl_locked').notNullable().defaultTo(false)
                table.timestamp('_upl_locked_at', { useTz: true }).nullable()
                table.uuid('_upl_locked_by').nullable()
                table.text('_upl_locked_reason').nullable()

                table.boolean('_app_published').notNullable().defaultTo(true)
                table.timestamp('_app_published_at', { useTz: true }).nullable()
                table.uuid('_app_published_by').nullable()
                table.boolean('_app_archived').notNullable().defaultTo(false)
                table.timestamp('_app_archived_at', { useTz: true }).nullable()
                table.uuid('_app_archived_by').nullable()
                table.boolean('_app_deleted').notNullable().defaultTo(false)
                table.timestamp('_app_deleted_at', { useTz: true }).nullable()
                table.uuid('_app_deleted_by').nullable()

                table.index(['object_id'], 'idx_app_values_object_id')
                table.index(['object_id', 'sort_order'], 'idx_app_values_object_sort')
            })
            console.log(`[SchemaGenerator] _app_values created`)
        }

        await this.normalizeAppEnumValueDefaults(schemaName, knex)
        await knex.raw(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_app_values_object_codename_active
            ON "${schemaName}"._app_values (object_id, codename)
            WHERE _upl_deleted = false AND _app_deleted = false
        `)
        await knex.raw(`
            CREATE INDEX IF NOT EXISTS idx_app_values_default_active
            ON "${schemaName}"._app_values (object_id, is_default)
            WHERE is_default = true AND _upl_deleted = false AND _app_deleted = false
        `)
        await knex.raw(`
            CREATE UNIQUE INDEX IF NOT EXISTS uidx_app_values_default_active
            ON "${schemaName}"._app_values (object_id)
            WHERE is_default = true AND _upl_deleted = false AND _app_deleted = false
        `)

        if (!hasSettings) {
            console.log(`[SchemaGenerator] Creating _app_settings...`)
            await knex.schema.withSchema(schemaName).createTable('_app_settings', (table) => {
                table.uuid('id').primary().defaultTo(knex.raw('public.uuid_generate_v7()'))
                table.string('key', 100).notNullable()
                table.jsonb('value').notNullable().defaultTo('{}')

                // ═══════════════════════════════════════════════════════════════════════
                // Platform-level system fields (_upl_*)
                // ═══════════════════════════════════════════════════════════════════════
                table.timestamp('_upl_created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
                table.uuid('_upl_created_by').nullable()
                table.timestamp('_upl_updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
                table.uuid('_upl_updated_by').nullable()
                table.integer('_upl_version').notNullable().defaultTo(1)
                // Archive fields
                table.boolean('_upl_archived').notNullable().defaultTo(false)
                table.timestamp('_upl_archived_at', { useTz: true }).nullable()
                table.uuid('_upl_archived_by').nullable()
                // Soft delete fields
                table.boolean('_upl_deleted').notNullable().defaultTo(false)
                table.timestamp('_upl_deleted_at', { useTz: true }).nullable()
                table.uuid('_upl_deleted_by').nullable()
                table.timestamp('_upl_purge_after', { useTz: true }).nullable()
                // Lock fields
                table.boolean('_upl_locked').notNullable().defaultTo(false)
                table.timestamp('_upl_locked_at', { useTz: true }).nullable()
                table.uuid('_upl_locked_by').nullable()
                table.text('_upl_locked_reason').nullable()

                // ═══════════════════════════════════════════════════════════════════════
                // Application-level system fields (_app_*)
                // ═══════════════════════════════════════════════════════════════════════
                // Publication status
                table.boolean('_app_published').notNullable().defaultTo(true)
                table.timestamp('_app_published_at', { useTz: true }).nullable()
                table.uuid('_app_published_by').nullable()
                // Archive fields
                table.boolean('_app_archived').notNullable().defaultTo(false)
                table.timestamp('_app_archived_at', { useTz: true }).nullable()
                table.uuid('_app_archived_by').nullable()
                // Soft delete fields
                table.boolean('_app_deleted').notNullable().defaultTo(false)
                table.timestamp('_app_deleted_at', { useTz: true }).nullable()
                table.uuid('_app_deleted_by').nullable()

                table.unique(['key'])
            })
            console.log(`[SchemaGenerator] _app_settings created`)
        }

        console.log(`[SchemaGenerator] System tables ensured in schema: ${schemaName}`)
    }

    private async normalizeAppEnumValueDefaults(schemaName: string, knex: Knex | Knex.Transaction): Promise<void> {
        await knex.raw(
            `
                WITH ranked AS (
                    SELECT
                        id,
                        ROW_NUMBER() OVER (
                            PARTITION BY object_id
                            ORDER BY sort_order ASC, _upl_created_at ASC, id ASC
                        ) AS row_number
                    FROM "${schemaName}"._app_values
                    WHERE is_default = true
                      AND _upl_deleted = false
                      AND _app_deleted = false
                )
                UPDATE "${schemaName}"._app_values AS ev
                SET is_default = false,
                    _upl_updated_at = NOW()
                FROM ranked
                WHERE ev.id = ranked.id
                  AND ranked.row_number > 1
            `
        )
    }

    public async syncSystemMetadata(
        schemaName: string,
        entities: EntityDefinition[],
        options?: {
            removeMissing?: boolean
            trx?: Knex.Transaction
            userId?: string | null
        }
    ): Promise<void> {
        const knex = options?.trx ?? this.knex
        const userId = options?.userId ?? null
        await this.ensureSystemTables(schemaName, options?.trx)

        if (options?.removeMissing) {
            const entityIds = entities.map((entity) => entity.id)
            const attributeIds = entities.flatMap((entity) => entity.fields.map((field) => field.id))

            const objectsTable = knex.withSchema(schemaName).table('_app_objects')
            if (entityIds.length > 0) {
                await objectsTable.whereNotIn('id', entityIds).del()
            } else {
                await objectsTable.del()
            }

            const attributesTable = knex.withSchema(schemaName).table('_app_attributes')
            if (attributeIds.length > 0) {
                await attributesTable.whereNotIn('id', attributeIds).del()
            } else {
                await attributesTable.del()
            }
        }

        const objectRows = entities.map((entity) => ({
            id: entity.id,
            kind: entity.kind,
            codename: entity.codename,
            table_name: generateTableName(entity.id, entity.kind),
            presentation: entity.presentation,
            config: (entity as { config?: Record<string, unknown> }).config ?? {},
            _upl_created_at: knex.fn.now(),
            _upl_created_by: userId,
            _upl_updated_at: knex.fn.now(),
            _upl_updated_by: userId
        }))

        if (objectRows.length > 0) {
            await knex
                .withSchema(schemaName)
                .table('_app_objects')
                .insert(objectRows)
                .onConflict('id')
                .merge(['kind', 'codename', 'table_name', 'presentation', 'config', '_upl_updated_at', '_upl_updated_by'])
        }

        const attributeRows = entities.flatMap((entity) => {
            const entityTableName = generateTableName(entity.id, entity.kind)
            return entity.fields.map((field) => {
                // For TABLE fields, column_name stores the tabular table name
                // For child fields, column_name is the physical column in the tabular table
                const columnName =
                    field.dataType === AttributeDataType.TABLE && !field.parentAttributeId
                        ? generateChildTableName(field.id)
                        : generateColumnName(field.id)

                return {
                    id: field.id,
                    object_id: entity.id,
                    codename: field.codename,
                    sort_order: typeof (field as any)?.sortOrder === 'number' ? (field as any).sortOrder : 0,
                    column_name: columnName,
                    data_type: field.dataType,
                    is_required: field.isRequired,
                    is_display_attribute: field.isDisplayAttribute ?? false,
                    target_object_id: field.targetEntityId ?? null,
                    target_object_kind: field.targetEntityKind ?? null,
                    parent_attribute_id: field.parentAttributeId ?? null,
                    presentation: field.presentation,
                    validation_rules: field.validationRules ?? {},
                    ui_config: field.uiConfig ?? {},
                    _upl_created_at: knex.fn.now(),
                    _upl_created_by: userId,
                    _upl_updated_at: knex.fn.now(),
                    _upl_updated_by: userId
                }
            })
        })

        if (attributeRows.length > 0) {
            await knex
                .withSchema(schemaName)
                .table('_app_attributes')
                .insert(attributeRows)
                .onConflict('id')
                .merge([
                    'object_id',
                    'codename',
                    'sort_order',
                    'column_name',
                    'data_type',
                    'is_required',
                    'is_display_attribute',
                    'target_object_id',
                    'target_object_kind',
                    'parent_attribute_id',
                    'presentation',
                    'validation_rules',
                    'ui_config',
                    '_upl_updated_at',
                    '_upl_updated_by'
                ])
        }
    }

    public generateSnapshot(entities: EntityDefinition[]): SchemaSnapshot {
        return buildSchemaSnapshot(entities)
    }

    public async schemaExists(schemaName: string): Promise<boolean> {
        const result = await this.knex.raw<{ rows: { exists: boolean }[] }>(
            `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = ?)`,
            [schemaName]
        )
        return result.rows[0]?.exists === true
    }
}

export default SchemaGenerator
