import type { Knex } from 'knex'
import { AttributeDataType } from '@universo/types'
import { buildSchemaSnapshot } from './snapshot'
import {
    buildFkConstraintName,
    generateColumnName,
    generateSchemaName,
    generateTableName,
    isValidSchemaName,
} from './naming'
import { generateMigrationName } from './MigrationManager'
import type { MigrationManager } from './MigrationManager'
import type { EntityDefinition, FieldDefinition, SchemaGenerationResult, SchemaSnapshot } from './types'
import type { SchemaDiff } from './diff'

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
    migrationMeta?: Pick<
        import('./types').MigrationMeta,
        'publicationSnapshotHash' | 'publicationId' | 'publicationVersionId'
    >
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

    public static mapDataType(dataType: AttributeDataType): string {
        switch (dataType) {
            case AttributeDataType.STRING:
                return 'TEXT'
            case AttributeDataType.NUMBER:
                return 'NUMERIC'
            case AttributeDataType.BOOLEAN:
                return 'BOOLEAN'
            case AttributeDataType.DATE:
                return 'DATE'
            case AttributeDataType.DATETIME:
                return 'TIMESTAMPTZ'
            case AttributeDataType.REF:
                return 'UUID'
            case AttributeDataType.JSON:
                return 'JSONB'
            default:
                return 'TEXT'
        }
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
            errors: [],
        }

        try {
            await this.knex.transaction(async (trx) => {
                await this.createSchema(schemaName, trx)

                for (const entity of entities) {
                    await this.createEntityTable(schemaName, entity, trx)
                    result.tablesCreated.push(entity.codename)
                }

                for (const entity of entities) {
                    const refFields = entity.fields.filter(
                        (field) => field.dataType === AttributeDataType.REF && field.targetEntityId
                    )
                    for (const field of refFields) {
                        await this.addForeignKey(schemaName, entity, field, entities, trx)
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

    public async createEntityTable(
        schemaName: string,
        entity: EntityDefinition,
        trx?: Knex.Transaction
    ): Promise<void> {
        const tableName = generateTableName(entity.id, entity.kind)
        console.log(`[SchemaGenerator] Creating table: ${schemaName}.${tableName} (entity: ${entity.codename})`)

        const knex = trx ?? this.knex
        await knex.schema.withSchema(schemaName).createTable(tableName, (table: Knex.CreateTableBuilder) => {
            table.uuid('id').primary().defaultTo(knex.raw('public.uuid_generate_v7()'))

            // User-defined fields
            for (const field of entity.fields) {
                const columnName = generateColumnName(field.id)
                const pgType = SchemaGenerator.mapDataType(field.dataType)
                if (field.isRequired) {
                    table.specificType(columnName, pgType).notNullable()
                } else {
                    table.specificType(columnName, pgType).nullable()
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

    public async addForeignKey(
        schemaName: string,
        entity: EntityDefinition,
        field: FieldDefinition,
        entities: EntityDefinition[],
        trx?: Knex.Transaction
    ): Promise<void> {
        if (!field.targetEntityId) {
            return
        }

        const targetEntity = entities.find((item) => item.id === field.targetEntityId)
        if (!targetEntity) {
            console.warn(
                `[SchemaGenerator] Target entity ${field.targetEntityId} not found for REF field ${field.id}`
            )
            return
        }

        const sourceTableName = generateTableName(entity.id, entity.kind)
        const targetTableName = generateTableName(targetEntity.id, targetEntity.kind)
        const columnName = generateColumnName(field.id)
        const constraintName = buildFkConstraintName(sourceTableName, columnName)

        console.log(
            `[SchemaGenerator] Adding FK: ${sourceTableName}.${columnName} -> ${targetTableName}.id`
        )

        const knex = trx ?? this.knex
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
                table.string('column_name', 255).notNullable()
                table.string('data_type', 20).notNullable()
                table.boolean('is_required').notNullable().defaultTo(false)
                table.uuid('target_object_id').nullable()
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

                table
                    .foreign('object_id')
                    .references('id')
                    .inTable(`${schemaName}._app_objects`)
                    .onDelete('CASCADE')
                table
                    .foreign('target_object_id')
                    .references('id')
                    .inTable(`${schemaName}._app_objects`)
                    .onDelete('SET NULL')
                table.unique(['object_id', 'codename'])
                table.unique(['object_id', 'column_name'])
            })
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

        console.log(`[SchemaGenerator] System tables ensured in schema: ${schemaName}`)
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
            _upl_updated_by: userId,
        }))

        if (objectRows.length > 0) {
            await knex
                .withSchema(schemaName)
                .table('_app_objects')
                .insert(objectRows)
                .onConflict('id')
                .merge(['kind', 'codename', 'table_name', 'presentation', 'config', '_upl_updated_at', '_upl_updated_by'])
        }

        const attributeRows = entities.flatMap((entity) =>
            entity.fields.map((field) => ({
                id: field.id,
                object_id: entity.id,
                codename: field.codename,
                column_name: generateColumnName(field.id),
                data_type: field.dataType,
                is_required: field.isRequired,
                target_object_id: field.targetEntityId ?? null,
                presentation: field.presentation,
                validation_rules: field.validationRules ?? {},
                ui_config: field.uiConfig ?? {},
                _upl_created_at: knex.fn.now(),
                _upl_created_by: userId,
                _upl_updated_at: knex.fn.now(),
                _upl_updated_by: userId,
            }))
        )

        if (attributeRows.length > 0) {
            await knex
                .withSchema(schemaName)
                .table('_app_attributes')
                .insert(attributeRows)
                .onConflict('id')
                .merge([
                    'object_id',
                    'codename',
                    'column_name',
                    'data_type',
                    'is_required',
                    'target_object_id',
                    'presentation',
                    'validation_rules',
                    'ui_config',
                    '_upl_updated_at',
                    '_upl_updated_by',
                ])
        }

        if (options?.removeMissing) {
            const entityIds = entities.map((entity) => entity.id)
            const attributeIds = entities.flatMap((entity) => entity.fields.map((field) => field.id))

            const attributesTable = knex.withSchema(schemaName).table('_app_attributes')
            if (attributeIds.length > 0) {
                await attributesTable.whereNotIn('id', attributeIds).del()
            } else {
                await attributesTable.del()
            }

            const objectsTable = knex.withSchema(schemaName).table('_app_objects')
            if (entityIds.length > 0) {
                await objectsTable.whereNotIn('id', entityIds).del()
            } else {
                await objectsTable.del()
            }
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
