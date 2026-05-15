import type { Knex } from 'knex'
import type { SystemTableCapabilityOptions } from '@universo/migrations-core'
import {
    ComponentDefinitionDataType,
    DASHBOARD_LAYOUT_WIDGETS,
    isObjectRecordBehaviorEnabled,
    isLedgerSchemaCapableEntity,
    normalizeObjectRecordBehaviorFromConfig,
    getPhysicalDataType,
    formatPhysicalType,
    type EntityTypeCapabilities,
    type ApplicationLifecycleContract,
    type ObjectRecordBehavior,
    type VersionedLocalizedContent
} from '@universo/types'
import type { ComponentDefinitionValidationRules } from '@universo/types'
import { resolveApplicationLifecycleContractFromConfig, resolvePlatformSystemFieldsContractFromConfig } from '@universo/utils'
import { buildSetLocalStatementTimeoutSql } from '@universo/utils/database'
import { buildSchemaSnapshot } from './snapshot'
import { buildFkConstraintName, resolveFieldColumnName, resolveEntityTableName, generateChildTableName, isValidSchemaName } from './naming'
import { generateMigrationName } from './MigrationManager'
import type { MigrationManager } from './MigrationManager'
import type { EntityDefinition, Component, SchemaGenerationResult, SchemaSnapshot } from './types'
import type { SchemaDiff } from './diff'
import { hasPhysicalRuntimeTable, isStandardEnumerationKind, isStandardSetKind } from './builtinEntityKinds'

const DEFAULT_DDL_STATEMENT_TIMEOUT_MS = 120_000
const ENTITY_KIND_DB_LENGTH = 64
const SINGLE_INSTANCE_DASHBOARD_WIDGET_KEYS = DASHBOARD_LAYOUT_WIDGETS.filter((widget) => widget.multiInstance === false).map(
    (widget) => widget.key
)
const quoteSqlStringLiteral = (value: string): string => `'${value.replace(/'/g, "''")}'`
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const createCodenameVLC = (primaryLocale: string, codename: string): VersionedLocalizedContent<string> => {
    const timestamp = new Date(0).toISOString()

    return {
        _schema: '1',
        _primary: primaryLocale,
        locales: {
            [primaryLocale]: {
                content: codename,
                version: 1,
                isActive: true,
                createdAt: timestamp,
                updatedAt: timestamp
            }
        }
    }
}

/**
 * Options for generateFullSchema method
 */
export interface GenerateFullSchemaOptions {
    /** Record initial migration in _app_migrations table */
    recordMigration?: boolean
    /** Exact migration name to persist when recordMigration is enabled */
    migrationName?: string
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
    /** Optional capability gates for application-like system tables */
    systemTableCapabilities?: SystemTableCapabilityOptions
    /** Optional hook executed inside the schema transaction after migration history is recorded */
    afterMigrationRecorded?: (context: {
        trx: Knex.Transaction
        schemaName: string
        snapshotBefore: null
        snapshotAfter: SchemaSnapshot
        diff: SchemaDiff
        migrationName: string
        migrationId: string
    }) => Promise<void>
    /** Optional statement timeout override for heavy DDL operations */
    statementTimeoutMs?: number
}

interface NormalizedSystemTableCapabilityOptions {
    includeComponents: boolean
    includeValues: boolean
    includeLayouts: boolean
    includeWidgets: boolean
}

const normalizeSystemTableCapabilities = (options?: SystemTableCapabilityOptions): NormalizedSystemTableCapabilityOptions => {
    const normalized: NormalizedSystemTableCapabilityOptions = {
        includeComponents: options?.includeComponents ?? true,
        includeValues: options?.includeValues ?? true,
        includeLayouts: options?.includeLayouts ?? true,
        includeWidgets: options?.includeWidgets ?? true
    }

    if (normalized.includeWidgets && !normalized.includeLayouts) {
        throw new Error('System table capabilities cannot enable _app_widgets without _app_layouts')
    }

    return normalized
}

/**
 * SchemaGenerator - Creates PostgreSQL schemas and tables from Metahub configuration.
 *
 * Uses Dependency Injection pattern: receives Knex instance via constructor
 * instead of using a singleton.
 */
export class SchemaGenerator {
    private knex: Knex

    private static runtimeCodenameTextSql(columnRef: string): string {
        return `COALESCE(${columnRef}->'locales'->(${columnRef}->>'_primary')->>'content', ${columnRef}->'locales'->'en'->>'content', '')`
    }

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
    public static mapDataType(dataType: ComponentDefinitionDataType, config?: Partial<ComponentDefinitionValidationRules>): string {
        if (dataType === ComponentDefinitionDataType.TABLE) {
            throw new Error('TABLE is a virtual type with no physical column. Use createTabularTable() instead.')
        }
        const info = getPhysicalDataType(dataType, config)
        return formatPhysicalType(info)
    }

    private static resolveFieldPhysicalType(field: Component): string {
        if (typeof field.physicalDataType === 'string' && field.physicalDataType.trim().length > 0) {
            return field.physicalDataType.trim()
        }

        return SchemaGenerator.mapDataType(field.dataType, field.validationRules as Partial<ComponentDefinitionValidationRules> | undefined)
    }

    private static applyFieldColumn(table: Knex.CreateTableBuilder, knex: Knex | Knex.Transaction, field: Component): void {
        const columnName = resolveFieldColumnName(field)
        const pgType = SchemaGenerator.resolveFieldPhysicalType(field)
        const column = table.specificType(columnName, pgType)

        if (field.isRequired) {
            column.notNullable()
        } else {
            column.nullable()
        }

        if (typeof field.defaultSqlExpression === 'string' && field.defaultSqlExpression.trim().length > 0) {
            column.defaultTo(knex.raw(field.defaultSqlExpression))
            return
        }

        if (!field.isRequired && field.dataType === ComponentDefinitionDataType.BOOLEAN) {
            column.defaultTo(false)
        }
    }

    private static resolveLifecycleContract(entity: EntityDefinition): ApplicationLifecycleContract {
        return resolveApplicationLifecycleContractFromConfig((entity as { config?: Record<string, unknown> }).config)
    }

    private static resolvePlatformSystemFieldsContract(entity: EntityDefinition) {
        return resolvePlatformSystemFieldsContractFromConfig((entity as { config?: Record<string, unknown> }).config)
    }

    private static resolveRecordBehavior(entity: EntityDefinition): ObjectRecordBehavior {
        const config = (entity as { config?: Record<string, unknown> }).config
        return normalizeObjectRecordBehaviorFromConfig(config)
    }

    private static isRecordBehaviorEnabled(behavior: ObjectRecordBehavior): boolean {
        return isObjectRecordBehaviorEnabled(behavior)
    }

    private static applyRecordBehaviorColumns(table: Knex.CreateTableBuilder, behavior: ObjectRecordBehavior): void {
        if (!SchemaGenerator.isRecordBehaviorEnabled(behavior)) {
            return
        }

        table.string('_app_record_number', 64).nullable()
        table.timestamp('_app_record_date', { useTz: true }).nullable()
        table.string('_app_record_state', 32).notNullable().defaultTo('draft')
        table.timestamp('_app_posted_at', { useTz: true }).nullable()
        table.uuid('_app_posted_by').nullable()
        table.uuid('_app_posting_batch_id').nullable()
        table.jsonb('_app_posting_movements').nullable()
        table.timestamp('_app_voided_at', { useTz: true }).nullable()
        table.uuid('_app_voided_by').nullable()
    }

    private static resolveRuntimeComponents(entity: EntityDefinition): EntityTypeCapabilities | undefined {
        if (entity.capabilities) {
            return entity.capabilities
        }

        const config = (entity as { config?: Record<string, unknown> }).config
        if (isRecord(config?.capabilities)) {
            return config.capabilities as unknown as EntityTypeCapabilities
        }

        return undefined
    }

    private static isLedgerEntity(entity: EntityDefinition): boolean {
        const capabilities = SchemaGenerator.resolveRuntimeComponents(entity)
        return isLedgerSchemaCapableEntity(capabilities)
    }

    private static buildRuntimeObjectConfig(entity: EntityDefinition): Record<string, unknown> {
        const config = (entity as { config?: Record<string, unknown> }).config ?? {}
        const capabilities = SchemaGenerator.resolveRuntimeComponents(entity)

        if (!capabilities) {
            return config
        }

        return {
            ...config,
            capabilities
        }
    }

    private static applyLedgerSystemColumns(table: Knex.CreateTableBuilder): void {
        table.uuid('_app_reversal_of_fact_id').nullable()
    }

    private static applyConfigurablePlatformSystemColumns(
        table: Knex.CreateTableBuilder,
        platformContract: ReturnType<typeof SchemaGenerator.resolvePlatformSystemFieldsContract>
    ): void {
        if (platformContract.archive.enabled) {
            table.boolean('_upl_archived').notNullable().defaultTo(false)
            if (platformContract.archive.trackAt) {
                table.timestamp('_upl_archived_at', { useTz: true }).nullable()
            }
            if (platformContract.archive.trackBy) {
                table.uuid('_upl_archived_by').nullable()
            }
        }

        if (platformContract.delete.enabled) {
            table.boolean('_upl_deleted').notNullable().defaultTo(false)
            if (platformContract.delete.trackAt) {
                table.timestamp('_upl_deleted_at', { useTz: true }).nullable()
            }
            if (platformContract.delete.trackBy) {
                table.uuid('_upl_deleted_by').nullable()
            }
        }
    }

    private static applyApplicationLifecycleColumns(table: Knex.CreateTableBuilder, contract: ApplicationLifecycleContract): void {
        if (contract.publish.enabled) {
            table.boolean('_app_published').notNullable().defaultTo(true)
            if (contract.publish.trackAt) {
                table.timestamp('_app_published_at', { useTz: true }).nullable()
            }
            if (contract.publish.trackBy) {
                table.uuid('_app_published_by').nullable()
            }
        }

        if (contract.archive.enabled) {
            table.boolean('_app_archived').notNullable().defaultTo(false)
            if (contract.archive.trackAt) {
                table.timestamp('_app_archived_at', { useTz: true }).nullable()
            }
            if (contract.archive.trackBy) {
                table.uuid('_app_archived_by').nullable()
            }
        }

        if (contract.delete.mode === 'soft') {
            table.boolean('_app_deleted').notNullable().defaultTo(false)
            if (contract.delete.trackAt) {
                table.timestamp('_app_deleted_at', { useTz: true }).nullable()
            }
            if (contract.delete.trackBy) {
                table.uuid('_app_deleted_by').nullable()
            }
        }

        table.uuid('_app_owner_id').nullable()
        table.string('_app_access_level', 20).notNullable().defaultTo('private')
    }

    private async createApplicationLifecycleIndexes(
        schemaName: string,
        tableName: string,
        contract: ApplicationLifecycleContract,
        trx?: Knex.Transaction
    ): Promise<void> {
        const knex = trx ?? this.knex
        if (contract.delete.mode === 'soft' && contract.delete.trackAt) {
            await knex.raw(`
                CREATE INDEX IF NOT EXISTS idx_${tableName}_app_deleted
                ON "${schemaName}"."${tableName}" (_app_deleted_at)
                WHERE _app_deleted = true
            `)
        }
        await knex.raw(`
            CREATE INDEX IF NOT EXISTS idx_${tableName}_app_owner
            ON "${schemaName}"."${tableName}" (_app_owner_id)
            WHERE _app_owner_id IS NOT NULL
        `)
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
                await trx.raw(buildSetLocalStatementTimeoutSql(options?.statementTimeoutMs ?? DEFAULT_DDL_STATEMENT_TIMEOUT_MS))
                await this.createSchema(schemaName, trx)

                for (const entity of entities) {
                    if (!hasPhysicalRuntimeTable(entity)) {
                        continue
                    }
                    await this.createEntityTable(schemaName, entity, trx)
                    result.tablesCreated.push(entity.codename)

                    // Create tabular tables for TABLE components
                    const tableFields = entity.fields.filter(
                        (f) => f.dataType === ComponentDefinitionDataType.TABLE && !f.parentComponentId
                    )
                    for (const tableField of tableFields) {
                        const childFields = entity.fields.filter((f) => f.parentComponentId === tableField.id)
                        const parentTableName = resolveEntityTableName(entity)
                        await this.createTabularTable(schemaName, entity, parentTableName, tableField, childFields, trx)
                        result.tablesCreated.push(`${entity.codename}__tbl__${tableField.codename}`)
                    }
                }

                // Ensure system tables before adding REF FKs that may target _app_values.
                await this.ensureSystemTables(schemaName, trx, options?.systemTableCapabilities)

                for (const entity of entities) {
                    const rootRefFields = entity.fields.filter(
                        (field) => field.dataType === ComponentDefinitionDataType.REF && field.targetEntityId && !field.parentComponentId
                    )
                    for (const field of rootRefFields) {
                        await this.addForeignKey(schemaName, entity, field, entities, trx)
                    }

                    const childRefFields = entity.fields.filter(
                        (field) =>
                            field.dataType === ComponentDefinitionDataType.REF && field.targetEntityId && Boolean(field.parentComponentId)
                    )
                    for (const childRefField of childRefFields) {
                        const tableParentField = entity.fields.find(
                            (field) => field.id === childRefField.parentComponentId && field.dataType === ComponentDefinitionDataType.TABLE
                        )
                        if (!tableParentField) {
                            console.warn(
                                `[SchemaGenerator] TABLE parent field ${childRefField.parentComponentId} not found for child REF field ${childRefField.id}`
                            )
                            continue
                        }

                        const parentTableName = resolveEntityTableName(entity)
                        const tabularTableName = generateChildTableName(tableParentField.id)
                        await this.addForeignKeyToTable(schemaName, tabularTableName, childRefField, entities, trx)
                    }
                }

                await this.syncSystemMetadata(schemaName, entities, {
                    trx,
                    userId: options?.userId,
                    systemTableCapabilities: options?.systemTableCapabilities
                })

                // Record initial migration if requested
                if (options?.recordMigration) {
                    if (!options.migrationManager) {
                        throw new Error('migrationManager is required when recordMigration is true')
                    }
                    const migrationManager = options.migrationManager
                    const snapshot = this.generateSnapshot(entities)
                    const description = options.migrationDescription || 'initial_schema'
                    const migrationName = options.migrationName || generateMigrationName(description)

                    // Initial migration: snapshotBefore is null, snapshotAfter is current state
                    const initialDiff: SchemaDiff = {
                        hasChanges: true,
                        additive: [],
                        destructive: [],
                        summary: `Initial schema creation with ${entities.length} table(s)`
                    }

                    const migrationId = await migrationManager.recordMigration(
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

                    await options.afterMigrationRecorded?.({
                        trx,
                        schemaName,
                        snapshotBefore: null,
                        snapshotAfter: snapshot,
                        diff: initialDiff,
                        migrationName,
                        migrationId
                    })
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
        if (!hasPhysicalRuntimeTable(entity)) {
            console.log(`[SchemaGenerator] Skipping physical table for ${entity.kind} entity: ${entity.codename}`)
            return
        }

        const tableName = resolveEntityTableName(entity)
        const lifecycleContract = SchemaGenerator.resolveLifecycleContract(entity)
        const platformContract = SchemaGenerator.resolvePlatformSystemFieldsContract(entity)
        const recordBehavior = SchemaGenerator.resolveRecordBehavior(entity)
        console.log(`[SchemaGenerator] Creating table: ${schemaName}.${tableName} (entity: ${entity.codename})`)

        const knex = trx ?? this.knex
        await knex.schema.withSchema(schemaName).createTable(tableName, (table: Knex.CreateTableBuilder) => {
            table.uuid('id').primary().defaultTo(knex.raw('public.uuid_generate_v7()'))

            // User-defined fields (skip TABLE and child fields)
            for (const field of entity.fields) {
                // TABLE fields create separate child tables, not columns
                if (field.dataType === ComponentDefinitionDataType.TABLE) continue
                // Child fields belong to tabular tables, not the parent entity table
                if (field.parentComponentId) continue

                SchemaGenerator.applyFieldColumn(table, knex, field)
            }

            // ═══════════════════════════════════════════════════════════════════════
            // Platform-level system fields (_upl_*)
            // ═══════════════════════════════════════════════════════════════════════
            table.timestamp('_upl_created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
            table.uuid('_upl_created_by').nullable()
            table.timestamp('_upl_updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
            table.uuid('_upl_updated_by').nullable()
            table.integer('_upl_version').notNullable().defaultTo(1)
            SchemaGenerator.applyConfigurablePlatformSystemColumns(table, platformContract)
            table.timestamp('_upl_purge_after', { useTz: true }).nullable()
            // Lock fields
            table.boolean('_upl_locked').notNullable().defaultTo(false)
            table.timestamp('_upl_locked_at', { useTz: true }).nullable()
            table.uuid('_upl_locked_by').nullable()
            table.text('_upl_locked_reason').nullable()

            SchemaGenerator.applyApplicationLifecycleColumns(table, lifecycleContract)
            SchemaGenerator.applyRecordBehaviorColumns(table, recordBehavior)
            if (SchemaGenerator.isLedgerEntity(entity)) {
                SchemaGenerator.applyLedgerSystemColumns(table)
            }
        })

        // Create indexes for system fields
        if (platformContract.delete.enabled && platformContract.delete.trackAt) {
            await knex.raw(`
                CREATE INDEX IF NOT EXISTS idx_${tableName}_upl_deleted
                ON "${schemaName}"."${tableName}" (_upl_deleted_at)
                WHERE _upl_deleted = true
            `)
        }
        await this.createApplicationLifecycleIndexes(schemaName, tableName, lifecycleContract, trx)
        if (SchemaGenerator.isRecordBehaviorEnabled(recordBehavior)) {
            await knex.raw(`
                CREATE INDEX IF NOT EXISTS idx_${tableName}_record_state
                ON "${schemaName}"."${tableName}" (_app_record_state)
            `)
            await knex.raw(`
                CREATE INDEX IF NOT EXISTS idx_${tableName}_posted_at
                ON "${schemaName}"."${tableName}" (_app_posted_at)
                WHERE _app_posted_at IS NOT NULL
            `)
        }
        if (SchemaGenerator.isLedgerEntity(entity)) {
            await knex.raw(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_${tableName}_reversal_of_fact
                ON "${schemaName}"."${tableName}" (_app_reversal_of_fact_id)
                WHERE _app_reversal_of_fact_id IS NOT NULL
                  AND _upl_deleted = false
                  AND _app_deleted = false
            `)
        }

        console.log(`[SchemaGenerator] Table ${schemaName}.${tableName} created`)
    }

    /**
     * Creates a tabular part table for a TABLE component.
     * Child table has: id, _tp_parent_id (FK CASCADE), _tp_sort_order,
     * child component columns, and full _upl_* + _app_* system fields.
     */
    public async createTabularTable(
        schemaName: string,
        entity: EntityDefinition,
        parentTableName: string,
        tableField: Component,
        childFields: Component[],
        trx?: Knex.Transaction
    ): Promise<void> {
        const tabularTableName = generateChildTableName(tableField.id)
        const lifecycleContract = SchemaGenerator.resolveLifecycleContract(entity)
        const platformContract = SchemaGenerator.resolvePlatformSystemFieldsContract(entity)
        console.log(`[SchemaGenerator] Creating tabular table: ${schemaName}.${tabularTableName}`)

        const knex = trx ?? this.knex
        await knex.schema.withSchema(schemaName).createTable(tabularTableName, (table: Knex.CreateTableBuilder) => {
            table.uuid('id').primary().defaultTo(knex.raw('public.uuid_generate_v7()'))

            // Parent reference with CASCADE delete
            table.uuid('_tp_parent_id').notNullable()
            table.integer('_tp_sort_order').notNullable().defaultTo(0)

            // Child component columns
            for (const child of childFields) {
                SchemaGenerator.applyFieldColumn(table, knex, child)
            }

            // ═══════════════════════════════════════════════════════════════════════
            // Platform-level system fields (_upl_*)
            // ═══════════════════════════════════════════════════════════════════════
            table.timestamp('_upl_created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
            table.uuid('_upl_created_by').nullable()
            table.timestamp('_upl_updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
            table.uuid('_upl_updated_by').nullable()
            table.integer('_upl_version').notNullable().defaultTo(1)
            SchemaGenerator.applyConfigurablePlatformSystemColumns(table, platformContract)
            table.timestamp('_upl_purge_after', { useTz: true }).nullable()
            table.boolean('_upl_locked').notNullable().defaultTo(false)
            table.timestamp('_upl_locked_at', { useTz: true }).nullable()
            table.uuid('_upl_locked_by').nullable()
            table.text('_upl_locked_reason').nullable()

            SchemaGenerator.applyApplicationLifecycleColumns(table, lifecycleContract)
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
        const idxUplDeleted = `idx_${tabularTableName}_ud`.substring(0, 63)

        await knex.raw(`
            CREATE INDEX IF NOT EXISTS "${idxParent}"
            ON "${schemaName}"."${tabularTableName}" (_tp_parent_id)
        `)
        await knex.raw(`
            CREATE INDEX IF NOT EXISTS "${idxParentSort}"
            ON "${schemaName}"."${tabularTableName}" (_tp_parent_id, _tp_sort_order)
        `)
        if (platformContract.delete.enabled && platformContract.delete.trackAt) {
            await knex.raw(`
                CREATE INDEX IF NOT EXISTS "${idxUplDeleted}"
                ON "${schemaName}"."${tabularTableName}" (_upl_deleted_at)
                WHERE _upl_deleted = true
            `)
        }
        await this.createApplicationLifecycleIndexes(schemaName, tabularTableName, lifecycleContract, trx)

        console.log(`[SchemaGenerator] Tabular table ${schemaName}.${tabularTableName} created`)
    }

    public async addForeignKey(
        schemaName: string,
        entity: EntityDefinition,
        field: Component,
        entities: EntityDefinition[],
        trx?: Knex.Transaction
    ): Promise<void> {
        if (!hasPhysicalRuntimeTable(entity)) {
            return
        }

        const sourceTableName = resolveEntityTableName(entity)
        await this.addForeignKeyToTable(schemaName, sourceTableName, field, entities, trx)
    }

    private async addForeignKeyToTable(
        schemaName: string,
        sourceTableName: string,
        field: Component,
        entities: EntityDefinition[],
        trx?: Knex.Transaction
    ): Promise<void> {
        if (!field.targetEntityId) {
            return
        }

        const columnName = resolveFieldColumnName(field)
        const constraintName = buildFkConstraintName(sourceTableName, columnName)
        const knex = trx ?? this.knex

        if (isStandardEnumerationKind(field.targetEntityKind)) {
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

        if (isStandardSetKind(field.targetEntityKind)) {
            console.log(
                `[SchemaGenerator] Skipping FK for set constant reference: ${sourceTableName}.${columnName} (set refs store constant IDs)`
            )
            return
        }

        const targetEntity = entities.find((item) => item.id === field.targetEntityId)
        if (!targetEntity) {
            console.warn(`[SchemaGenerator] Target entity ${field.targetEntityId} not found for REF field ${field.id}`)
            return
        }

        if (!hasPhysicalRuntimeTable(targetEntity)) {
            console.log(
                `[SchemaGenerator] Skipping FK for nonphysical target: ${sourceTableName}.${columnName} -> ${targetEntity.kind}:${targetEntity.codename}`
            )
            return
        }

        const targetTableName = resolveEntityTableName(targetEntity)

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
        const hasComponents = await knex.schema.withSchema(schemaName).hasTable('_app_components')
        return hasObjects && hasComponents
    }

    public async ensureSystemTables(schemaName: string, trx?: Knex.Transaction, options?: SystemTableCapabilityOptions): Promise<void> {
        const knex = trx ?? this.knex
        const capabilities = normalizeSystemTableCapabilities(options)

        console.log(`[SchemaGenerator] Ensuring system tables in schema: ${schemaName}`)

        // IMPORTANT: Do NOT reuse SchemaBuilder object - create fresh one for each operation
        // Knex SchemaBuilder accumulates state and can cause "relation already exists" errors
        const hasObjects = await knex.schema.withSchema(schemaName).hasTable('_app_objects')
        console.log(`[SchemaGenerator] _app_objects exists: ${hasObjects}`)

        if (!hasObjects) {
            console.log(`[SchemaGenerator] Creating _app_objects...`)
            await knex.schema.withSchema(schemaName).createTable('_app_objects', (table) => {
                table.uuid('id').primary()
                table.string('kind', ENTITY_KIND_DB_LENGTH).notNullable()
                table.jsonb('codename').notNullable()
                table.string('table_name', 255).nullable()
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

                table.unique(['table_name'])
            })
            await knex.raw(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_app_objects_kind_codename_active
                ON "${schemaName}"._app_objects (kind, ${SchemaGenerator.runtimeCodenameTextSql('codename')})
                WHERE _upl_deleted = false AND _app_deleted = false
            `)
            console.log(`[SchemaGenerator] _app_objects created`)
        }

        await knex.raw(`
            ALTER TABLE "${schemaName}"."_app_objects"
            ALTER COLUMN "kind" TYPE VARCHAR(${ENTITY_KIND_DB_LENGTH})
        `)
        await knex.raw(`
            ALTER TABLE "${schemaName}"."_app_objects"
            ALTER COLUMN "table_name" DROP NOT NULL
        `)

        const hasComponents = capabilities.includeComponents ? await knex.schema.withSchema(schemaName).hasTable('_app_components') : true
        console.log(`[SchemaGenerator] _app_components enabled=${capabilities.includeComponents} exists: ${hasComponents}`)

        if (capabilities.includeComponents && !hasComponents) {
            console.log(`[SchemaGenerator] Creating _app_components...`)
            await knex.schema.withSchema(schemaName).createTable('_app_components', (table) => {
                table.uuid('id').primary()
                table.uuid('object_id').notNullable()
                table.jsonb('codename').notNullable()
                // Stable field order from metahub snapshot (1..N). Used by runtime UI rendering.
                table.integer('sort_order').notNullable().defaultTo(0)
                table.string('column_name', 255).notNullable()
                table.string('data_type', 20).notNullable()
                table.boolean('is_required').notNullable().defaultTo(false)
                table.boolean('is_display_component').notNullable().defaultTo(false)
                // Polymorphic reference: target entity ID and kind
                table.uuid('target_object_id').nullable()
                table.string('target_object_kind', ENTITY_KIND_DB_LENGTH).nullable() // 'object', 'document', 'hub', etc.
                // Self-reference: parent TABLE component ID for child components
                table.uuid('parent_component_id').nullable()
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
                table.foreign('parent_component_id').references('id').inTable(`${schemaName}._app_components`).onDelete('CASCADE')
                table.unique(['object_id', 'column_name'])
                table.index(['parent_component_id'], 'idx_app_components_parent')
            })

            // Partial unique indexes for codename uniqueness (scoped by parent/root and soft-delete status)

            if (capabilities.includeComponents) {
                await knex.raw(`
                        ALTER TABLE "${schemaName}"."_app_components"
                        ALTER COLUMN "target_object_kind" TYPE VARCHAR(${ENTITY_KIND_DB_LENGTH})
                    `)
            }
            await knex.raw(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_app_components_object_codename_root_active
                ON "${schemaName}"._app_components (object_id, ${SchemaGenerator.runtimeCodenameTextSql('codename')})
                WHERE parent_component_id IS NULL AND _upl_deleted = false AND _app_deleted = false
            `)

            await knex.raw(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_app_components_object_parent_codename_child_active
                ON "${schemaName}"._app_components (object_id, parent_component_id, ${SchemaGenerator.runtimeCodenameTextSql('codename')})
                WHERE parent_component_id IS NOT NULL AND _upl_deleted = false AND _app_deleted = false
            `)

            console.log(`[SchemaGenerator] _app_components created`)
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

        const hasRecordCounters = await knex.schema.withSchema(schemaName).hasTable('_app_record_counters')
        console.log(`[SchemaGenerator] _app_record_counters exists: ${hasRecordCounters}`)

        if (!hasRecordCounters) {
            console.log(`[SchemaGenerator] Creating _app_record_counters...`)
            await knex.schema.withSchema(schemaName).createTable('_app_record_counters', (table) => {
                table.uuid('id').primary().defaultTo(knex.raw('public.uuid_generate_v7()'))
                table.uuid('object_id').notNullable().references('id').inTable(`${schemaName}._app_objects`).onDelete('CASCADE')
                table.string('scope_key', 128).notNullable()
                table.string('period_key', 32).notNullable()
                table.string('prefix', 64).notNullable().defaultTo('')
                table.specificType('last_number', 'BIGINT').notNullable().defaultTo(0)

                table.timestamp('_upl_created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
                table.uuid('_upl_created_by').nullable()
                table.timestamp('_upl_updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
                table.uuid('_upl_updated_by').nullable()
                table.integer('_upl_version').notNullable().defaultTo(1)

                table.unique(['object_id', 'scope_key', 'period_key', 'prefix'])
            })
            console.log(`[SchemaGenerator] _app_record_counters created`)
        }

        const hasSettings = await knex.schema.withSchema(schemaName).hasTable('_app_settings')
        console.log(`[SchemaGenerator] _app_settings exists: ${hasSettings}`)

        const hasLayouts = capabilities.includeLayouts ? await knex.schema.withSchema(schemaName).hasTable('_app_layouts') : true
        console.log(`[SchemaGenerator] _app_layouts enabled=${capabilities.includeLayouts} exists: ${hasLayouts}`)

        if (capabilities.includeLayouts && !hasLayouts) {
            console.log(`[SchemaGenerator] Creating _app_layouts...`)
            await knex.schema.withSchema(schemaName).createTable('_app_layouts', (table) => {
                table.uuid('id').primary().defaultTo(knex.raw('public.uuid_generate_v7()'))
                table.uuid('scope_entity_id').nullable().references('id').inTable(`${schemaName}._app_objects`).onDelete('CASCADE')
                table.string('template_key', 100).notNullable().defaultTo('dashboard')
                table.jsonb('name').notNullable().defaultTo('{}')
                table.jsonb('description').nullable()
                table.jsonb('config').notNullable().defaultTo('{}')
                table.boolean('is_active').notNullable().defaultTo(true)
                table.boolean('is_default').notNullable().defaultTo(false)
                table.integer('sort_order').notNullable().defaultTo(0)
                table.uuid('owner_id').nullable()
                table.text('source_kind').notNullable().defaultTo('metahub')
                table.uuid('source_layout_id').nullable()
                table.text('source_snapshot_hash').nullable()
                table.text('source_content_hash').nullable()
                table.text('local_content_hash').nullable()
                table.text('sync_state').notNullable().defaultTo('clean')
                table.boolean('is_source_excluded').notNullable().defaultTo(false)
                table.timestamp('source_deleted_at', { useTz: true }).nullable()
                table.uuid('source_deleted_by').nullable()

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

                table.index(['scope_entity_id'], 'idx_app_layouts_scope_entity_id')
                table.index(['template_key'], 'idx_app_layouts_template_key')
                table.index(['is_active'], 'idx_app_layouts_is_active')
                table.index(['is_default'], 'idx_app_layouts_is_default')
                table.index(['sort_order'], 'idx_app_layouts_sort_order')
                table.index(['source_kind', 'source_layout_id'], 'idx_app_layouts_source')
                table.index(['sync_state'], 'idx_app_layouts_sync_state')
                table.index(['scope_entity_id', 'source_kind'], 'idx_app_layouts_scope_source')
            })

            await knex.raw(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_app_layouts_default_active
                ON "${schemaName}"._app_layouts (COALESCE(scope_entity_id, '00000000-0000-0000-0000-000000000000'::uuid))
                WHERE is_default = true AND is_active = true AND _upl_deleted = false AND _app_deleted = false
            `)
            console.log(`[SchemaGenerator] _app_layouts created`)
        }

        if (capabilities.includeLayouts) {
            await knex.raw(`
                ALTER TABLE "${schemaName}"."_app_layouts"
                ADD COLUMN IF NOT EXISTS "source_kind" TEXT NOT NULL DEFAULT 'metahub',
                ADD COLUMN IF NOT EXISTS "source_layout_id" UUID NULL,
                ADD COLUMN IF NOT EXISTS "source_snapshot_hash" TEXT NULL,
                ADD COLUMN IF NOT EXISTS "source_content_hash" TEXT NULL,
                ADD COLUMN IF NOT EXISTS "local_content_hash" TEXT NULL,
                ADD COLUMN IF NOT EXISTS "sync_state" TEXT NOT NULL DEFAULT 'clean',
                ADD COLUMN IF NOT EXISTS "is_source_excluded" BOOLEAN NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS "source_deleted_at" TIMESTAMPTZ NULL,
                ADD COLUMN IF NOT EXISTS "source_deleted_by" UUID NULL
            `)
            await knex.raw(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'chk_app_layouts_source_kind'
                          AND conrelid = '"${schemaName}"."_app_layouts"'::regclass
                    ) THEN
                        ALTER TABLE "${schemaName}"."_app_layouts"
                        ADD CONSTRAINT chk_app_layouts_source_kind
                        CHECK (source_kind IN ('metahub', 'application'));
                    END IF;
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'chk_app_layouts_sync_state'
                          AND conrelid = '"${schemaName}"."_app_layouts"'::regclass
                    ) THEN
                        ALTER TABLE "${schemaName}"."_app_layouts"
                        ADD CONSTRAINT chk_app_layouts_sync_state
                        CHECK (sync_state IN ('clean', 'local_modified', 'source_updated', 'conflict', 'source_removed', 'source_excluded'));
                    END IF;
                END $$;
            `)
            await knex.raw(
                `
                CREATE INDEX IF NOT EXISTS idx_app_layouts_source
                ON "${schemaName}"._app_layouts (source_kind, source_layout_id)
            `
            )
            await knex.raw(`CREATE INDEX IF NOT EXISTS idx_app_layouts_sync_state ON "${schemaName}"._app_layouts (sync_state)`)
            await knex.raw(
                `
                CREATE INDEX IF NOT EXISTS idx_app_layouts_scope_source
                ON "${schemaName}"._app_layouts (scope_entity_id, source_kind)
            `
            )
        }

        const hasWidgets = capabilities.includeWidgets ? await knex.schema.withSchema(schemaName).hasTable('_app_widgets') : true
        console.log(`[SchemaGenerator] _app_widgets enabled=${capabilities.includeWidgets} exists: ${hasWidgets}`)
        if (capabilities.includeWidgets && !hasWidgets) {
            console.log(`[SchemaGenerator] Creating _app_widgets...`)
            await knex.schema.withSchema(schemaName).createTable('_app_widgets', (table) => {
                table.uuid('id').primary().defaultTo(knex.raw('public.uuid_generate_v7()'))
                table.uuid('layout_id').notNullable().references('id').inTable(`${schemaName}._app_layouts`).onDelete('CASCADE')
                table.string('zone', 20).notNullable()
                table.string('widget_key', 100).notNullable()
                table.integer('sort_order').notNullable().defaultTo(1)
                table.jsonb('config').notNullable().defaultTo('{}')
                table.boolean('is_active').notNullable().defaultTo(true)
                table.uuid('source_widget_id').nullable()
                table.uuid('source_base_widget_id').nullable()
                table.text('source_content_hash').nullable()
                table.text('local_content_hash').nullable()

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
                table.index(['layout_id', 'is_active'], 'idx_app_widgets_layout_active')
            })
            console.log(`[SchemaGenerator] _app_widgets created`)
        }

        if (capabilities.includeWidgets) {
            await knex.raw(`
                ALTER TABLE "${schemaName}"."_app_widgets"
                ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true,
                ADD COLUMN IF NOT EXISTS "source_widget_id" UUID NULL,
                ADD COLUMN IF NOT EXISTS "source_base_widget_id" UUID NULL,
                ADD COLUMN IF NOT EXISTS "source_content_hash" TEXT NULL,
                ADD COLUMN IF NOT EXISTS "local_content_hash" TEXT NULL
            `)
            await knex.raw(`
                CREATE INDEX IF NOT EXISTS idx_app_widgets_layout_active
                ON "${schemaName}"._app_widgets (layout_id, is_active)
            `)
            if (SINGLE_INSTANCE_DASHBOARD_WIDGET_KEYS.length > 0) {
                const singleInstanceWidgetKeysSql = `ARRAY[${SINGLE_INSTANCE_DASHBOARD_WIDGET_KEYS.map(quoteSqlStringLiteral).join(
                    ', '
                )}]::text[]`
                await knex.raw(`
                    CREATE UNIQUE INDEX IF NOT EXISTS idx_app_widgets_single_instance_active
                    ON "${schemaName}"._app_widgets (layout_id, zone, widget_key)
                    WHERE is_active = true
                      AND _upl_deleted = false
                      AND _app_deleted = false
                      AND widget_key = ANY (${singleInstanceWidgetKeysSql})
                `)
            }
            await knex.raw(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_app_widgets_layout_source_base_active
                ON "${schemaName}"._app_widgets (layout_id, source_base_widget_id)
                WHERE source_base_widget_id IS NOT NULL
                  AND _upl_deleted = false
                  AND _app_deleted = false
            `)
        }

        const hasEnumValues = capabilities.includeValues ? await knex.schema.withSchema(schemaName).hasTable('_app_values') : true
        console.log(`[SchemaGenerator] _app_values enabled=${capabilities.includeValues} exists: ${hasEnumValues}`)
        if (capabilities.includeValues && !hasEnumValues) {
            console.log(`[SchemaGenerator] Creating _app_values...`)
            await knex.schema.withSchema(schemaName).createTable('_app_values', (table) => {
                table.uuid('id').primary().defaultTo(knex.raw('public.uuid_generate_v7()'))
                table.uuid('object_id').notNullable().references('id').inTable(`${schemaName}._app_objects`).onDelete('CASCADE')
                table.jsonb('codename').notNullable()
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

        if (capabilities.includeValues) {
            await this.normalizeAppEnumValueDefaults(schemaName, knex)
            await knex.raw(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_app_values_object_codename_active
                ON "${schemaName}"._app_values (object_id, ${SchemaGenerator.runtimeCodenameTextSql('codename')})
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
        }

        const hasScripts = await knex.schema.withSchema(schemaName).hasTable('_app_scripts')
        console.log(`[SchemaGenerator] _app_scripts exists: ${hasScripts}`)

        if (!hasScripts) {
            console.log(`[SchemaGenerator] Creating _app_scripts...`)
            await knex.schema.withSchema(schemaName).createTable('_app_scripts', (table) => {
                table.uuid('id').primary()
                table.string('codename', 100).notNullable()
                table.jsonb('presentation').notNullable().defaultTo('{}')
                table.string('attached_to_kind', ENTITY_KIND_DB_LENGTH).notNullable()
                table.uuid('attached_to_id').nullable()
                table.string('module_role', 40).notNullable()
                table.string('source_kind', 40).notNullable()
                table.string('sdk_api_version', 40).notNullable()
                table.jsonb('manifest').notNullable().defaultTo('{}')
                table.text('server_bundle').nullable()
                table.text('client_bundle').nullable()
                table.string('checksum', 128).notNullable()
                table.boolean('is_active').notNullable().defaultTo(true)
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

                table.index(['attached_to_kind', 'attached_to_id'], 'idx_app_scripts_attachment')
                table.index(['module_role'], 'idx_app_scripts_module_role')
                table.index(['checksum'], 'idx_app_scripts_checksum')
            })

            await knex.raw(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_app_scripts_codename_active
                ON "${schemaName}"._app_scripts (
                    attached_to_kind,
                    COALESCE(attached_to_id, '00000000-0000-0000-0000-000000000000'::uuid),
                    module_role,
                    codename
                )
                WHERE _upl_deleted = false AND _app_deleted = false
            `)
            console.log(`[SchemaGenerator] _app_scripts created`)
        }

        await knex.raw(`
            ALTER TABLE "${schemaName}"."_app_scripts"
            ALTER COLUMN "attached_to_kind" TYPE VARCHAR(${ENTITY_KIND_DB_LENGTH})
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
            systemTableCapabilities?: SystemTableCapabilityOptions
        }
    ): Promise<void> {
        const knex = options?.trx ?? this.knex
        const userId = options?.userId ?? null
        await this.ensureSystemTables(schemaName, options?.trx, options?.systemTableCapabilities)

        if (options?.removeMissing) {
            const entityIds = entities.map((entity) => entity.id)
            const componentIds = entities.flatMap((entity) => entity.fields.map((field) => field.id))

            const objectsTable = knex.withSchema(schemaName).table('_app_objects')
            if (entityIds.length > 0) {
                await objectsTable.whereNotIn('id', entityIds).del()
            } else {
                await objectsTable.del()
            }

            const componentsTable = knex.withSchema(schemaName).table('_app_components')
            if (componentIds.length > 0) {
                await componentsTable.whereNotIn('id', componentIds).del()
            } else {
                await componentsTable.del()
            }
        }

        const objectRows = entities.map((entity) => ({
            id: entity.id,
            kind: entity.kind,
            codename: createCodenameVLC('en', entity.codename),
            table_name: hasPhysicalRuntimeTable(entity) ? resolveEntityTableName(entity) : null,
            presentation: entity.presentation,
            config: SchemaGenerator.buildRuntimeObjectConfig(entity),
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

        const componentRows = entities.flatMap((entity) => {
            return entity.fields.map((field) => {
                // For TABLE fields, column_name stores the tabular table name
                // For child fields, column_name is the physical column in the tabular table
                const columnName =
                    field.dataType === ComponentDefinitionDataType.TABLE && !field.parentComponentId
                        ? generateChildTableName(field.id)
                        : resolveFieldColumnName(field)
                const baseUiConfig = ((field.uiConfig as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>
                const setTargetConstantId =
                    isStandardSetKind(field.targetEntityKind) && typeof field.targetConstantId === 'string' ? field.targetConstantId : null
                const normalizedUiConfig = setTargetConstantId
                    ? {
                          ...baseUiConfig,
                          targetConstantId: setTargetConstantId,
                          setConstantRef:
                              baseUiConfig.setConstantRef && typeof baseUiConfig.setConstantRef === 'object'
                                  ? baseUiConfig.setConstantRef
                                  : { id: setTargetConstantId }
                      }
                    : baseUiConfig

                return {
                    id: field.id,
                    object_id: entity.id,
                    codename: createCodenameVLC('en', field.codename),
                    sort_order: typeof (field as any)?.sortOrder === 'number' ? (field as any).sortOrder : 0,
                    column_name: columnName,
                    data_type: field.dataType,
                    is_required: field.isRequired,
                    is_display_component: field.isDisplayComponent ?? false,
                    target_object_id: field.targetEntityId ?? null,
                    target_object_kind: field.targetEntityKind ?? null,
                    parent_component_id: field.parentComponentId ?? null,
                    presentation: field.presentation,
                    validation_rules: field.validationRules ?? {},
                    ui_config: normalizedUiConfig,
                    _upl_created_at: knex.fn.now(),
                    _upl_created_by: userId,
                    _upl_updated_at: knex.fn.now(),
                    _upl_updated_by: userId
                }
            })
        })

        if (componentRows.length > 0) {
            await knex
                .withSchema(schemaName)
                .table('_app_components')
                .insert(componentRows)
                .onConflict('id')
                .merge([
                    'object_id',
                    'codename',
                    'sort_order',
                    'column_name',
                    'data_type',
                    'is_required',
                    'is_display_component',
                    'target_object_id',
                    'target_object_kind',
                    'parent_component_id',
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
