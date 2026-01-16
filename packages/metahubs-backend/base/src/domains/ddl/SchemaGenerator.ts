import type { Knex } from 'knex'
import { AttributeDataType } from '@universo/types'
import { KnexClient } from './KnexClient'
import { buildSchemaSnapshot } from './snapshot'
import {
    buildFkConstraintName,
    generateColumnName,
    generateSchemaName,
    generateTableName,
    isValidSchemaName,
} from './naming'
import type { EntityDefinition, FieldDefinition, SchemaGenerationResult, SchemaSnapshot } from './types'

/**
 * SchemaGenerator - Creates PostgreSQL schemas and tables from Metahub configuration.
 */
export class SchemaGenerator {
    private knex: Knex

    constructor() {
        this.knex = KnexClient.getInstance()
    }

    public static generateSchemaName(applicationId: string): string {
        return generateSchemaName(applicationId)
    }

    public static generateTableName(entityId: string, kind: EntityDefinition['kind']): string {
        return generateTableName(entityId, kind)
    }

    public static generateColumnName(fieldId: string): string {
        return generateColumnName(fieldId)
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

    public async createSchema(schemaName: string): Promise<void> {
        console.log(`[SchemaGenerator] Creating schema: ${schemaName}`)

        if (!isValidSchemaName(schemaName)) {
            throw new Error(`Invalid schema name format: ${schemaName}`)
        }

        await this.knex.raw(`CREATE SCHEMA IF NOT EXISTS ??`, [schemaName])
        console.log(`[SchemaGenerator] Schema ${schemaName} created`)
    }

    public async dropSchema(schemaName: string): Promise<void> {
        console.log(`[SchemaGenerator] Dropping schema: ${schemaName}`)

        if (!isValidSchemaName(schemaName)) {
            throw new Error(`Invalid schema name format: ${schemaName}`)
        }

        await this.knex.raw(`DROP SCHEMA IF EXISTS ?? CASCADE`, [schemaName])
        console.log(`[SchemaGenerator] Schema ${schemaName} dropped`)
    }

    public async generateFullSchema(
        schemaName: string,
        entities: EntityDefinition[]
    ): Promise<SchemaGenerationResult> {
        const result: SchemaGenerationResult = {
            success: false,
            schemaName,
            tablesCreated: [],
            errors: [],
        }

        try {
            await this.createSchema(schemaName)

            for (const entity of entities) {
                try {
                    await this.createEntityTable(schemaName, entity)
                    result.tablesCreated.push(entity.codename)
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    result.errors.push(`Failed to create table ${entity.codename}: ${message}`)
                }
            }

            for (const entity of entities) {
                const refFields = entity.fields.filter(
                    (field) => field.dataType === AttributeDataType.REF && field.targetEntityId
                )
                for (const field of refFields) {
                    try {
                        await this.addForeignKey(schemaName, entity, field, entities)
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error)
                        result.errors.push(
                            `Failed to add FK for ${entity.codename}.${field.codename}: ${message}`
                        )
                    }
                }
            }

            result.success = result.errors.length === 0
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            result.errors.push(`Schema generation failed: ${message}`)
        }

        return result
    }

    public async createEntityTable(schemaName: string, entity: EntityDefinition): Promise<void> {
        const tableName = generateTableName(entity.id, entity.kind)
        console.log(`[SchemaGenerator] Creating table: ${schemaName}.${tableName} (entity: ${entity.codename})`)

        await this.knex.schema.withSchema(schemaName).createTable(tableName, (table: Knex.CreateTableBuilder) => {
            table.uuid('id').primary().defaultTo(this.knex.raw('public.uuid_generate_v7()'))
            table.timestamp('created_at').notNullable().defaultTo(this.knex.fn.now())
            table.timestamp('updated_at').notNullable().defaultTo(this.knex.fn.now())

            for (const field of entity.fields) {
                const columnName = generateColumnName(field.id)
                const pgType = SchemaGenerator.mapDataType(field.dataType)
                if (field.isRequired) {
                    table.specificType(columnName, pgType).notNullable()
                } else {
                    table.specificType(columnName, pgType).nullable()
                }
            }
        })

        console.log(`[SchemaGenerator] Table ${schemaName}.${tableName} created`)
    }

    public async addForeignKey(
        schemaName: string,
        entity: EntityDefinition,
        field: FieldDefinition,
        entities: EntityDefinition[]
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

        await this.knex.raw(
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
