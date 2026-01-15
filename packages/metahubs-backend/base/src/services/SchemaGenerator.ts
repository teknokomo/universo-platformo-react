import { Knex } from 'knex'
import { KnexClient } from './KnexClient'
import { AttributeDataType } from '../database/entities/Attribute'

/**
 * Catalog structure from Metahub configuration
 */
export interface CatalogDefinition {
    id: string
    codename: string
    attributes: AttributeDefinition[]
}

/**
 * Attribute structure from Metahub configuration
 */
export interface AttributeDefinition {
    id: string
    codename: string
    dataType: AttributeDataType
    isRequired: boolean
    targetCatalogId?: string | null
}

/**
 * Result of schema generation
 */
export interface SchemaGenerationResult {
    success: boolean
    schemaName: string
    tablesCreated: string[]
    errors: string[]
}

/**
 * Snapshot of schema structure for diff calculation
 */
export interface SchemaSnapshot {
    version: number
    generatedAt: string
    catalogs: {
        [catalogId: string]: {
            codename: string
            tableName: string
            attributes: {
                [attributeId: string]: {
                    codename: string
                    columnName: string
                    dataType: AttributeDataType
                    isRequired: boolean
                    targetCatalogId?: string | null
                }
            }
        }
    }
}

/**
 * SchemaGenerator - Creates PostgreSQL schemas and tables from Metahub configuration
 *
 * Key design decisions (following 1C:Enterprise pattern for physical naming):
 * 1. Schema naming: app_{uuid_without_hyphens} - guaranteed unique per Application
 * 2. Table naming: cat_{uuid_without_hyphens} - guaranteed unique per Catalog
 *    Using UUID ensures table name stays stable when catalog codename is renamed
 * 3. Column naming: attr_{uuid_without_hyphens} - guaranteed unique per Attribute
 *    Using UUID ensures column name stays stable when attribute codename is renamed
 * 4. System columns: id (PK), created_at, updated_at added to every table
 * 5. References: REF type attributes become UUID columns with FK constraints
 */
export class SchemaGenerator {
    private knex: Knex

    constructor() {
        this.knex = KnexClient.getInstance()
    }

    /**
     * Generate schema name from Application UUID
     * Format: app_{uuid_without_hyphens}
     */
    public static generateSchemaName(applicationId: string): string {
        const cleanId = applicationId.replace(/-/g, '')
        return `app_${cleanId}`
    }

    /**
     * Generate table name from Catalog UUID
     * Format: cat_{uuid_without_hyphens}
     * Using UUID ensures table name stays stable when catalog codename is renamed
     * Following 1C:Enterprise pattern where physical table names use internal IDs
     */
    public static generateTableName(catalogId: string): string {
        const cleanId = catalogId.replace(/-/g, '')
        return `cat_${cleanId}`
    }

    /**
     * Generate column name from Attribute UUID
     * Format: attr_{uuid_without_hyphens}
     * Using UUID ensures column name stays stable when attribute codename is renamed
     */
    public static generateColumnName(attributeId: string): string {
        const cleanId = attributeId.replace(/-/g, '')
        return `attr_${cleanId}`
    }

    /**
     * Map AttributeDataType to PostgreSQL column type
     */
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
                return 'UUID' // FK to another table
            case AttributeDataType.JSON:
                return 'JSONB'
            default:
                return 'TEXT'
        }
    }

    /**
     * Create a new schema for an Application
     *
     * @param schemaName - Schema name (use generateSchemaName)
     */
    public async createSchema(schemaName: string): Promise<void> {
        console.log(`[SchemaGenerator] Creating schema: ${schemaName}`)

        // Validate schema name to prevent SQL injection
        if (!/^app_[a-f0-9]+$/.test(schemaName)) {
            throw new Error(`Invalid schema name format: ${schemaName}`)
        }

        await this.knex.raw(`CREATE SCHEMA IF NOT EXISTS ??`, [schemaName])
        console.log(`[SchemaGenerator] Schema ${schemaName} created`)
    }

    /**
     * Drop a schema and all its contents
     * WARNING: This is destructive and irreversible!
     */
    public async dropSchema(schemaName: string): Promise<void> {
        console.log(`[SchemaGenerator] Dropping schema: ${schemaName}`)

        // Validate schema name
        if (!/^app_[a-f0-9]+$/.test(schemaName)) {
            throw new Error(`Invalid schema name format: ${schemaName}`)
        }

        await this.knex.raw(`DROP SCHEMA IF EXISTS ?? CASCADE`, [schemaName])
        console.log(`[SchemaGenerator] Schema ${schemaName} dropped`)
    }

    /**
     * Generate full schema from Metahub catalogs
     *
     * @param schemaName - Target schema name
     * @param catalogs - Array of catalog definitions from Metahub
     * @returns Generation result with status and created tables
     */
    public async generateFullSchema(
        schemaName: string,
        catalogs: CatalogDefinition[]
    ): Promise<SchemaGenerationResult> {
        const result: SchemaGenerationResult = {
            success: false,
            schemaName,
            tablesCreated: [],
            errors: [],
        }

        try {
            // 1. Create schema
            await this.createSchema(schemaName)

            // 2. Create tables for each catalog (without FKs first)
            for (const catalog of catalogs) {
                try {
                    await this.createTable(schemaName, catalog, false)
                    result.tablesCreated.push(catalog.codename)
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    result.errors.push(`Failed to create table ${catalog.codename}: ${message}`)
                }
            }

            // 3. Add FK constraints for REF columns (after all tables exist)
            for (const catalog of catalogs) {
                const refAttrs = catalog.attributes.filter(
                    (a) => a.dataType === AttributeDataType.REF && a.targetCatalogId
                )
                for (const attr of refAttrs) {
                    try {
                        await this.addForeignKey(schemaName, catalog, attr, catalogs)
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error)
                        result.errors.push(
                            `Failed to add FK for ${catalog.codename}.${attr.codename}: ${message}`
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

    /**
     * Create a table for a Catalog
     *
     * @param schemaName - Target schema
     * @param catalog - Catalog definition
     * @param addForeignKeys - Whether to add FK constraints (false for first pass)
     */
    private async createTable(
        schemaName: string,
        catalog: CatalogDefinition,
        addForeignKeys: boolean
    ): Promise<void> {
        const tableName = SchemaGenerator.generateTableName(catalog.id)

        // Validate table name format (cat_{32 hex chars})
        if (!/^cat_[a-f0-9]{32}$/i.test(tableName)) {
            throw new Error(`Invalid table name format: ${tableName}`)
        }

        console.log(`[SchemaGenerator] Creating table: ${schemaName}.${tableName} (catalog: ${catalog.codename})`)

        await this.knex.schema.withSchema(schemaName).createTable(tableName, (table: Knex.CreateTableBuilder) => {
            // System columns
            table.uuid('id').primary().defaultTo(this.knex.raw('public.uuid_generate_v7()'))
            table.timestamp('created_at').notNullable().defaultTo(this.knex.fn.now())
            table.timestamp('updated_at').notNullable().defaultTo(this.knex.fn.now())

            // Add columns for each attribute
            for (const attr of catalog.attributes) {
                const columnName = SchemaGenerator.generateColumnName(attr.id)
                const pgType = SchemaGenerator.mapDataType(attr.dataType)

                // Use raw SQL for proper type specification
                if (attr.isRequired) {
                    table.specificType(columnName, pgType).notNullable()
                } else {
                    table.specificType(columnName, pgType).nullable()
                }
            }
        })

        console.log(`[SchemaGenerator] Table ${schemaName}.${tableName} created`)
    }

    /**
     * Add foreign key constraint for a REF attribute
     */
    private async addForeignKey(
        schemaName: string,
        catalog: CatalogDefinition,
        attr: AttributeDefinition,
        allCatalogs: CatalogDefinition[]
    ): Promise<void> {
        if (!attr.targetCatalogId) return

        const targetCatalog = allCatalogs.find((c) => c.id === attr.targetCatalogId)
        if (!targetCatalog) {
            console.warn(
                `[SchemaGenerator] Target catalog ${attr.targetCatalogId} not found for REF attribute ${attr.id}`
            )
            return
        }

        const sourceTableName = SchemaGenerator.generateTableName(catalog.id)
        const targetTableName = SchemaGenerator.generateTableName(targetCatalog.id)
        const columnName = SchemaGenerator.generateColumnName(attr.id)
        // Use short hash for constraint name to stay under PostgreSQL's 63-char limit
        const constraintName = `fk_${sourceTableName}_${columnName}`.substring(0, 63)

        console.log(
            `[SchemaGenerator] Adding FK: ${sourceTableName}.${columnName} -> ${targetTableName}.id (${catalog.codename} -> ${targetCatalog.codename})`
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

    /**
     * Generate a snapshot of the schema for diff calculation
     */
    public generateSnapshot(catalogs: CatalogDefinition[]): SchemaSnapshot {
        const snapshot: SchemaSnapshot = {
            version: 1,
            generatedAt: new Date().toISOString(),
            catalogs: {},
        }

        for (const catalog of catalogs) {
            snapshot.catalogs[catalog.id] = {
                codename: catalog.codename,
                tableName: SchemaGenerator.generateTableName(catalog.id),
                attributes: {},
            }

            for (const attr of catalog.attributes) {
                snapshot.catalogs[catalog.id].attributes[attr.id] = {
                    codename: attr.codename,
                    columnName: SchemaGenerator.generateColumnName(attr.id),
                    dataType: attr.dataType,
                    isRequired: attr.isRequired,
                    targetCatalogId: attr.targetCatalogId,
                }
            }
        }

        return snapshot
    }

    /**
     * Check if a schema exists
     */
    public async schemaExists(schemaName: string): Promise<boolean> {
        const result = await this.knex.raw<{ rows: { exists: boolean }[] }>(
            `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = ?)`,
            [schemaName]
        )
        return result.rows[0]?.exists === true
    }
}

export default SchemaGenerator
