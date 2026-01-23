import { DataSource } from 'typeorm'
import { Metahub } from '../../../database/entities/Metahub'
import {
    getDDLServices,
    generateMetahubSchemaName,
    KnexClient,
    uuidToLockKey,
    acquireAdvisoryLock,
    releaseAdvisoryLock
} from '../../ddl'

/**
 * In-memory cache for schema existence.
 * Key: metahubId, Value: schemaName
 *
 * Schema names are immutable once created, so caching is safe.
 */
const schemaCache = new Map<string, string>()

/**
 * Cache for tables initialization status.
 * Key: schemaName, Value: true (tables exist)
 */
const tablesInitCache = new Set<string>()

/**
 * MetahubSchemaService - Manages isolated schemas for Metahubs.
 *
 * Each Metahub has its own PostgreSQL schema (mhb_<uuid>) containing:
 * - _mhb_objects: Registry of all objects (Catalogs, Hubs, Documents, etc.)
 * - _mhb_attributes: Attribute definitions for objects
 * - _mhb_records: Predefined data for catalogs
 *
 * Note: This is Design-Time storage. Physical data tables (cat_*, doc_*)
 * are only created in Application schemas (app_*) during publication.
 */
export class MetahubSchemaService {
    constructor(private dataSource: DataSource) { }

    private get knex() {
        return KnexClient.getInstance()
    }

    /**
     * Clears cache for a specific metahub (call on metahub deletion).
     */
    static clearCache(metahubId: string): void {
        const schemaName = schemaCache.get(metahubId)
        if (schemaName) {
            tablesInitCache.delete(schemaName)
        }
        schemaCache.delete(metahubId)
    }

    /**
     * Clears entire cache (for testing or server restart scenarios).
     */
    static clearAllCaches(): void {
        schemaCache.clear()
        tablesInitCache.clear()
    }

    /**
     * Ensures that the isolated schema for the Metahub exists.
     * Creates system tables if they don't exist.
     *
     * Uses caching to avoid repeated DB checks and advisory locking
     * to prevent race conditions during schema creation.
     */
    async ensureSchema(metahubId: string): Promise<string> {
        // Check cache first (no DB query)
        const cached = schemaCache.get(metahubId)
        if (cached && tablesInitCache.has(cached)) {
            return cached
        }

        const lockKey = uuidToLockKey(metahubId)
        const acquired = await acquireAdvisoryLock(this.knex, lockKey)

        if (!acquired) {
            throw new Error('Could not acquire lock for schema creation')
        }

        try {
            // Double-check cache after acquiring lock
            const cachedAfterLock = schemaCache.get(metahubId)
            if (cachedAfterLock && tablesInitCache.has(cachedAfterLock)) {
                return cachedAfterLock
            }

            const metaRepo = this.dataSource.getRepository(Metahub)
            const metahub = await metaRepo.findOneByOrFail({ id: metahubId })

            let schemaName = metahub.schemaName
            if (!schemaName) {
                schemaName = generateMetahubSchemaName(metahubId)
                const { generator } = getDDLServices()
                await generator.createSchema(schemaName)
                await metaRepo.update({ id: metahubId }, { schemaName })
            }

            // Cache schema name
            schemaCache.set(metahubId, schemaName)

            // Initialize tables only once per schema
            if (!tablesInitCache.has(schemaName)) {
                await this.initSystemTables(schemaName)
                tablesInitCache.add(schemaName)
            }

            return schemaName
        } finally {
            await releaseAdvisoryLock(this.knex, lockKey)
        }
    }

    /**
     * Drops the isolated schema for a metahub.
     * Uses centralized DDL services with proper validation.
     * WARNING: destructive operation.
     */
    async dropSchema(metahubId: string): Promise<void> {
        const metaRepo = this.dataSource.getRepository(Metahub)
        const metahub = await metaRepo.findOneBy({ id: metahubId })

        const schemaName = metahub?.schemaName || generateMetahubSchemaName(metahubId)

        const { generator } = getDDLServices()
        await generator.dropSchema(schemaName)

        // Clear cache after dropping
        MetahubSchemaService.clearCache(metahubId)
    }

    /**
     * Initialize system tables in the isolated schema.
     * Uses UUID v7 for better indexing performance.
     */
    private async initSystemTables(schemaName: string): Promise<void> {
        // _mhb_objects: Unified registry for all object types (Catalogs, Hubs, Documents, etc.)
        const hasObjects = await this.knex.schema.withSchema(schemaName).hasTable('_mhb_objects')
        if (!hasObjects) {
            await this.knex.schema.withSchema(schemaName).createTable('_mhb_objects', (t) => {
                t.uuid('id').primary().defaultTo(this.knex.raw('public.uuid_generate_v7()'))
                t.string('kind').notNullable().index() // 'CATALOG', 'HUB', 'DOCUMENT', etc.
                t.string('codename').notNullable()
                t.string('table_name').nullable() // Only for data-bearing objects (Catalogs, Documents)
                t.jsonb('presentation').defaultTo('{}')
                t.jsonb('config').defaultTo('{}')
                t.timestamps(true, true)
                t.unique(['kind', 'codename'])
            })
        }

        // _mhb_attributes: Field definitions for objects
        const hasAttributes = await this.knex.schema.withSchema(schemaName).hasTable('_mhb_attributes')
        if (!hasAttributes) {
            await this.knex.schema.withSchema(schemaName).createTable('_mhb_attributes', (t) => {
                t.uuid('id').primary().defaultTo(this.knex.raw('public.uuid_generate_v7()'))
                t.uuid('object_id').notNullable().references('id').inTable(`${schemaName}._mhb_objects`).onDelete('CASCADE')
                t.string('codename').notNullable()
                t.string('data_type').notNullable()
                t.jsonb('presentation').defaultTo('{}')
                t.jsonb('validation_rules').defaultTo('{}')
                t.jsonb('ui_config').defaultTo('{}')
                t.integer('sort_order').defaultTo(0)
                t.boolean('is_required').defaultTo(false)
                t.string('target_object_id').nullable()
                t.timestamps(true, true)
                t.unique(['object_id', 'codename'])
                // Performance indexes
                t.index(['object_id'], 'idx_mhb_attributes_object_id')
                t.index(['target_object_id'], 'idx_mhb_attributes_target_object_id')
            })
        }

        // _mhb_records: Predefined data for catalogs (synced to publications/versions)
        const hasRecords = await this.knex.schema.withSchema(schemaName).hasTable('_mhb_records')
        if (!hasRecords) {
            await this.knex.schema.withSchema(schemaName).createTable('_mhb_records', (t) => {
                t.uuid('id').primary().defaultTo(this.knex.raw('public.uuid_generate_v7()'))
                t.uuid('object_id').notNullable().references('id').inTable(`${schemaName}._mhb_objects`).onDelete('CASCADE')
                t.jsonb('data').notNullable().defaultTo('{}')
                t.integer('sort_order').defaultTo(0)
                t.uuid('owner_id').nullable()
                t.timestamps(true, true)
                // Performance indexes
                t.index(['object_id'], 'idx_mhb_records_object_id')
                t.index(['object_id', 'sort_order'], 'idx_mhb_records_object_sort')
                t.index(['owner_id'], 'idx_mhb_records_owner_id')
            })

            // GIN index for JSONB search (requires raw SQL)
            await this.knex.raw(`
                CREATE INDEX IF NOT EXISTS idx_mhb_records_data_gin
                ON "${schemaName}"._mhb_records USING GIN(data)
            `)
        }
    }
}
