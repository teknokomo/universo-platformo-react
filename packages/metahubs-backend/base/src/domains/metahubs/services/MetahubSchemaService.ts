import { DataSource } from 'typeorm'
import { Metahub } from '../../../database/entities/Metahub'
import { MetahubBranch } from '../../../database/entities/MetahubBranch'
import { MetahubUser } from '../../../database/entities/MetahubUser'
import { buildLocalizedContent } from '@universo/utils/vlc'
import { getDDLServices, KnexClient, uuidToLockKey, acquireAdvisoryLock, releaseAdvisoryLock } from '../../ddl'
import { DEFAULT_DASHBOARD_ZONE_WIDGETS, buildDashboardLayoutConfig } from '../../shared'

/**
 * In-memory cache for schema existence.
 * Key: metahubId:branchId, Value: schemaName
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
 * Cache for user active branch resolution.
 * Key: metahubId:userId, Value: { branchId, ts }
 *
 * Short TTL to avoid stale branch selection after user switches branch.
 */
const userBranchCache = new Map<string, { branchId: string; ts: number }>()
const USER_BRANCH_TTL_MS = 30_000

const getCachedUserBranchId = (metahubId: string, userId: string): string | null => {
    const key = `${metahubId}:${userId}`
    const entry = userBranchCache.get(key)
    if (!entry) return null
    if (Date.now() - entry.ts > USER_BRANCH_TTL_MS) {
        userBranchCache.delete(key)
        return null
    }
    return entry.branchId
}

const setCachedUserBranchId = (metahubId: string, userId: string, branchId: string) => {
    userBranchCache.set(`${metahubId}:${userId}`, { branchId, ts: Date.now() })
}

/**
 * MetahubSchemaService - Manages isolated schemas for Metahubs.
 *
 * Each Metahub has its own PostgreSQL schema (mhb_<uuid>) containing:
 * - _mhb_objects: Registry of all objects (Catalogs, Hubs, Documents, etc.)
 * - _mhb_attributes: Attribute definitions for objects
 * - _mhb_elements: Predefined data for catalogs
 *
 * Note: This is Design-Time storage. Physical data tables (cat_*, doc_*)
 * are only created in Application schemas (app_*) during publication.
 */
export class MetahubSchemaService {
    constructor(private dataSource: DataSource, private branchIdOverride?: string) {}

    private get knex() {
        return KnexClient.getInstance()
    }

    /**
     * Clears cache for a specific metahub (call on metahub deletion).
     */
    static clearCache(metahubId: string): void {
        for (const [key, schemaName] of schemaCache.entries()) {
            if (key.startsWith(`${metahubId}:`)) {
                tablesInitCache.delete(schemaName)
                schemaCache.delete(key)
            }
        }
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
    async ensureSchema(metahubId: string, userId?: string): Promise<string> {
        const cachedBranchId = this.branchIdOverride ?? (userId ? getCachedUserBranchId(metahubId, userId) : null)
        if (cachedBranchId) {
            const cacheKey = `${metahubId}:${cachedBranchId}`
            const cachedSchema = schemaCache.get(cacheKey)
            if (cachedSchema && tablesInitCache.has(cachedSchema)) {
                return cachedSchema
            }
        }

        const resolvedInitial = await this.resolveBranchSchema(metahubId, userId)
        if (userId && !this.branchIdOverride) {
            setCachedUserBranchId(metahubId, userId, resolvedInitial.branchId)
        }
        const cacheKey = `${metahubId}:${resolvedInitial.branchId}`
        const cached = schemaCache.get(cacheKey)
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
            const cachedAfterLock = schemaCache.get(cacheKey)
            if (cachedAfterLock && tablesInitCache.has(cachedAfterLock)) {
                return cachedAfterLock
            }
            const resolved = await this.resolveBranchSchema(metahubId, userId)
            if (!resolved.schemaName) {
                throw new Error('Branch schema name is missing')
            }

            // Ensure schema exists and tables are initialized
            await this.createEmptySchemaIfNeeded(resolved.schemaName)

            // Cache schema name
            schemaCache.set(cacheKey, resolved.schemaName)

            // Initialize tables only once per schema
            if (!tablesInitCache.has(resolved.schemaName)) {
                await this.initSystemTables(resolved.schemaName)
                tablesInitCache.add(resolved.schemaName)
            }

            return resolved.schemaName
        } finally {
            await releaseAdvisoryLock(this.knex, lockKey)
        }
    }

    /**
     * Create empty schema and system tables when schema does not exist yet.
     */
    async createEmptySchemaIfNeeded(schemaName: string): Promise<void> {
        const { generator } = getDDLServices()
        await generator.createSchema(schemaName)
    }

    /**
     * Ensures schema and system tables exist for a known schema name.
     * Does not resolve branches or cache keys.
     */
    async initializeSchema(schemaName: string): Promise<void> {
        await this.createEmptySchemaIfNeeded(schemaName)
        if (!tablesInitCache.has(schemaName)) {
            await this.initSystemTables(schemaName)
            tablesInitCache.add(schemaName)
        }
    }

    private async resolveBranchSchema(metahubId: string, userId?: string): Promise<{ branchId: string; schemaName: string }> {
        const metaRepo = this.dataSource.getRepository(Metahub)
        const branchRepo = this.dataSource.getRepository(MetahubBranch)
        const memberRepo = this.dataSource.getRepository(MetahubUser)

        const metahub = await metaRepo.findOneByOrFail({ id: metahubId })
        const defaultBranchId = metahub.defaultBranchId
        if (!defaultBranchId) {
            throw new Error('Default branch is not configured for this metahub')
        }

        let branchId = this.branchIdOverride ?? defaultBranchId
        if (!this.branchIdOverride && userId) {
            const membership = await memberRepo.findOne({ where: { metahubId, userId } })
            if (membership?.activeBranchId) {
                branchId = membership.activeBranchId
            }
        }

        const branch = await branchRepo.findOne({ where: { id: branchId, metahubId } })
        if (!branch) {
            throw new Error('Branch not found')
        }
        return { branchId, schemaName: branch.schemaName }
    }

    /**
     * Drops the isolated schema for a metahub.
     * Uses centralized DDL services with proper validation.
     * WARNING: destructive operation.
     */
    async dropSchema(metahubId: string): Promise<void> {
        const branchRepo = this.dataSource.getRepository(MetahubBranch)
        const branches = await branchRepo.find({ where: { metahubId } })
        const { generator } = getDDLServices()
        for (const branch of branches) {
            await generator.dropSchema(branch.schemaName)
        }

        // Clear cache after dropping
        MetahubSchemaService.clearCache(metahubId)
    }

    /**
     * Initialize system tables in the isolated schema.
     * Uses UUID v7 for better indexing performance.
     *
     * System fields follow the three-level architecture:
     * - _upl_* (Platform level): audit trail, optimistic locking, archive, soft delete, lock
     * - _mhb_* (Metahub level): design-time soft delete and publication status
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

                // ═══════════════════════════════════════════════════════════════════════
                // Platform-level system fields (_upl_*)
                // ═══════════════════════════════════════════════════════════════════════
                t.timestamp('_upl_created_at', { useTz: true }).notNullable().defaultTo(this.knex.fn.now())
                t.uuid('_upl_created_by').nullable()
                t.timestamp('_upl_updated_at', { useTz: true }).notNullable().defaultTo(this.knex.fn.now())
                t.uuid('_upl_updated_by').nullable()
                t.integer('_upl_version').notNullable().defaultTo(1)
                // Archive fields
                t.boolean('_upl_archived').notNullable().defaultTo(false)
                t.timestamp('_upl_archived_at', { useTz: true }).nullable()
                t.uuid('_upl_archived_by').nullable()
                // Soft delete fields
                t.boolean('_upl_deleted').notNullable().defaultTo(false)
                t.timestamp('_upl_deleted_at', { useTz: true }).nullable()
                t.uuid('_upl_deleted_by').nullable()
                t.timestamp('_upl_purge_after', { useTz: true }).nullable()
                // Lock fields
                t.boolean('_upl_locked').notNullable().defaultTo(false)
                t.timestamp('_upl_locked_at', { useTz: true }).nullable()
                t.uuid('_upl_locked_by').nullable()
                t.text('_upl_locked_reason').nullable()

                // ═══════════════════════════════════════════════════════════════════════
                // Metahub-level system fields (_mhb_*)
                // ═══════════════════════════════════════════════════════════════════════
                // Publication status
                t.boolean('_mhb_published').notNullable().defaultTo(true)
                t.timestamp('_mhb_published_at', { useTz: true }).nullable()
                t.uuid('_mhb_published_by').nullable()
                // Archive fields (design-time)
                t.boolean('_mhb_archived').notNullable().defaultTo(false)
                t.timestamp('_mhb_archived_at', { useTz: true }).nullable()
                t.uuid('_mhb_archived_by').nullable()
                // Soft delete fields (design-time)
                t.boolean('_mhb_deleted').notNullable().defaultTo(false)
                t.timestamp('_mhb_deleted_at', { useTz: true }).nullable()
                t.uuid('_mhb_deleted_by').nullable()
            })

            // Partial unique index (exclude soft-deleted records at both levels)
            await this.knex.raw(`
                CREATE UNIQUE INDEX idx_mhb_objects_kind_codename_active
                ON "${schemaName}"._mhb_objects (kind, codename)
                WHERE _upl_deleted = false AND _mhb_deleted = false
            `)

            // Index for trash queries (metahub-level)
            await this.knex.raw(`
                CREATE INDEX idx_mhb_objects_mhb_deleted
                ON "${schemaName}"._mhb_objects (_mhb_deleted_at)
                WHERE _mhb_deleted = true
            `)

            // Index for platform-level trash queries
            await this.knex.raw(`
                CREATE INDEX idx_mhb_objects_upl_deleted
                ON "${schemaName}"._mhb_objects (_upl_deleted_at)
                WHERE _upl_deleted = true
            `)
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
                t.boolean('is_display_attribute').defaultTo(false)
                // Polymorphic reference: target entity ID and kind
                t.uuid('target_object_id').nullable()
                t.string('target_object_kind', 20).nullable() // 'catalog', 'document', 'hub', etc.

                // ═══════════════════════════════════════════════════════════════════════
                // Platform-level system fields (_upl_*)
                // ═══════════════════════════════════════════════════════════════════════
                t.timestamp('_upl_created_at', { useTz: true }).notNullable().defaultTo(this.knex.fn.now())
                t.uuid('_upl_created_by').nullable()
                t.timestamp('_upl_updated_at', { useTz: true }).notNullable().defaultTo(this.knex.fn.now())
                t.uuid('_upl_updated_by').nullable()
                t.integer('_upl_version').notNullable().defaultTo(1)
                // Archive fields
                t.boolean('_upl_archived').notNullable().defaultTo(false)
                t.timestamp('_upl_archived_at', { useTz: true }).nullable()
                t.uuid('_upl_archived_by').nullable()
                // Soft delete fields
                t.boolean('_upl_deleted').notNullable().defaultTo(false)
                t.timestamp('_upl_deleted_at', { useTz: true }).nullable()
                t.uuid('_upl_deleted_by').nullable()
                t.timestamp('_upl_purge_after', { useTz: true }).nullable()
                // Lock fields
                t.boolean('_upl_locked').notNullable().defaultTo(false)
                t.timestamp('_upl_locked_at', { useTz: true }).nullable()
                t.uuid('_upl_locked_by').nullable()
                t.text('_upl_locked_reason').nullable()

                // ═══════════════════════════════════════════════════════════════════════
                // Metahub-level system fields (_mhb_*)
                // ═══════════════════════════════════════════════════════════════════════
                // Publication status
                t.boolean('_mhb_published').notNullable().defaultTo(true)
                t.timestamp('_mhb_published_at', { useTz: true }).nullable()
                t.uuid('_mhb_published_by').nullable()
                // Archive fields (design-time)
                t.boolean('_mhb_archived').notNullable().defaultTo(false)
                t.timestamp('_mhb_archived_at', { useTz: true }).nullable()
                t.uuid('_mhb_archived_by').nullable()
                // Soft delete fields (design-time)
                t.boolean('_mhb_deleted').notNullable().defaultTo(false)
                t.timestamp('_mhb_deleted_at', { useTz: true }).nullable()
                t.uuid('_mhb_deleted_by').nullable()

                // Performance indexes
                t.index(['object_id'], 'idx_mhb_attributes_object_id')
                t.index(['target_object_id'], 'idx_mhb_attributes_target_object_id')
            })

            // Partial unique index (exclude soft-deleted records at both levels)
            await this.knex.raw(`
                CREATE UNIQUE INDEX idx_mhb_attributes_object_codename_active
                ON "${schemaName}"._mhb_attributes (object_id, codename)
                WHERE _upl_deleted = false AND _mhb_deleted = false
            `)
        }

        // _mhb_elements: Predefined data for catalogs (synced to publications/versions)
        const hasElements = await this.knex.schema.withSchema(schemaName).hasTable('_mhb_elements')
        if (!hasElements) {
            await this.knex.schema.withSchema(schemaName).createTable('_mhb_elements', (t) => {
                t.uuid('id').primary().defaultTo(this.knex.raw('public.uuid_generate_v7()'))
                t.uuid('object_id').notNullable().references('id').inTable(`${schemaName}._mhb_objects`).onDelete('CASCADE')
                t.jsonb('data').notNullable().defaultTo('{}')
                t.integer('sort_order').defaultTo(0)
                t.uuid('owner_id').nullable()

                // ═══════════════════════════════════════════════════════════════════════
                // Platform-level system fields (_upl_*)
                // ═══════════════════════════════════════════════════════════════════════
                t.timestamp('_upl_created_at', { useTz: true }).notNullable().defaultTo(this.knex.fn.now())
                t.uuid('_upl_created_by').nullable()
                t.timestamp('_upl_updated_at', { useTz: true }).notNullable().defaultTo(this.knex.fn.now())
                t.uuid('_upl_updated_by').nullable()
                t.integer('_upl_version').notNullable().defaultTo(1)
                // Archive fields
                t.boolean('_upl_archived').notNullable().defaultTo(false)
                t.timestamp('_upl_archived_at', { useTz: true }).nullable()
                t.uuid('_upl_archived_by').nullable()
                // Soft delete fields
                t.boolean('_upl_deleted').notNullable().defaultTo(false)
                t.timestamp('_upl_deleted_at', { useTz: true }).nullable()
                t.uuid('_upl_deleted_by').nullable()
                t.timestamp('_upl_purge_after', { useTz: true }).nullable()
                // Lock fields
                t.boolean('_upl_locked').notNullable().defaultTo(false)
                t.timestamp('_upl_locked_at', { useTz: true }).nullable()
                t.uuid('_upl_locked_by').nullable()
                t.text('_upl_locked_reason').nullable()

                // ═══════════════════════════════════════════════════════════════════════
                // Metahub-level system fields (_mhb_*)
                // ═══════════════════════════════════════════════════════════════════════
                // Publication status
                t.boolean('_mhb_published').notNullable().defaultTo(true)
                t.timestamp('_mhb_published_at', { useTz: true }).nullable()
                t.uuid('_mhb_published_by').nullable()
                // Archive fields (design-time)
                t.boolean('_mhb_archived').notNullable().defaultTo(false)
                t.timestamp('_mhb_archived_at', { useTz: true }).nullable()
                t.uuid('_mhb_archived_by').nullable()
                // Soft delete fields (design-time)
                t.boolean('_mhb_deleted').notNullable().defaultTo(false)
                t.timestamp('_mhb_deleted_at', { useTz: true }).nullable()
                t.uuid('_mhb_deleted_by').nullable()

                // Performance indexes
                t.index(['object_id'], 'idx_mhb_elements_object_id')
                t.index(['object_id', 'sort_order'], 'idx_mhb_elements_object_sort')
                t.index(['owner_id'], 'idx_mhb_elements_owner_id')
            })

            // GIN index for JSONB search (requires raw SQL)
            await this.knex.raw(`
                CREATE INDEX IF NOT EXISTS idx_mhb_elements_data_gin
                ON "${schemaName}"._mhb_elements USING GIN(data)
            `)

            // Index for trash queries (metahub-level)
            await this.knex.raw(`
                CREATE INDEX idx_mhb_elements_mhb_deleted
                ON "${schemaName}"._mhb_elements (_mhb_deleted_at)
                WHERE _mhb_deleted = true
            `)

            // Index for platform-level trash queries
            await this.knex.raw(`
                CREATE INDEX idx_mhb_elements_upl_deleted
                ON "${schemaName}"._mhb_elements (_upl_deleted_at)
                WHERE _upl_deleted = true
            `)
        }

        // _mhb_settings: Metahub branch settings (UI and other settings that must be published to Applications).
        const hasSettings = await this.knex.schema.withSchema(schemaName).hasTable('_mhb_settings')
        if (!hasSettings) {
            await this.knex.schema.withSchema(schemaName).createTable('_mhb_settings', (t) => {
                t.uuid('id').primary().defaultTo(this.knex.raw('public.uuid_generate_v7()'))
                t.string('key', 100).notNullable()
                t.jsonb('value').notNullable().defaultTo('{}')

                // ═══════════════════════════════════════════════════════════════════════
                // Platform-level system fields (_upl_*)
                // ═══════════════════════════════════════════════════════════════════════
                t.timestamp('_upl_created_at', { useTz: true }).notNullable().defaultTo(this.knex.fn.now())
                t.uuid('_upl_created_by').nullable()
                t.timestamp('_upl_updated_at', { useTz: true }).notNullable().defaultTo(this.knex.fn.now())
                t.uuid('_upl_updated_by').nullable()
                t.integer('_upl_version').notNullable().defaultTo(1)
                // Archive fields
                t.boolean('_upl_archived').notNullable().defaultTo(false)
                t.timestamp('_upl_archived_at', { useTz: true }).nullable()
                t.uuid('_upl_archived_by').nullable()
                // Soft delete fields
                t.boolean('_upl_deleted').notNullable().defaultTo(false)
                t.timestamp('_upl_deleted_at', { useTz: true }).nullable()
                t.uuid('_upl_deleted_by').nullable()
                t.timestamp('_upl_purge_after', { useTz: true }).nullable()
                // Lock fields
                t.boolean('_upl_locked').notNullable().defaultTo(false)
                t.timestamp('_upl_locked_at', { useTz: true }).nullable()
                t.uuid('_upl_locked_by').nullable()
                t.text('_upl_locked_reason').nullable()

                // ═══════════════════════════════════════════════════════════════════════
                // Metahub-level system fields (_mhb_*)
                // ═══════════════════════════════════════════════════════════════════════
                // Publication status
                t.boolean('_mhb_published').notNullable().defaultTo(true)
                t.timestamp('_mhb_published_at', { useTz: true }).nullable()
                t.uuid('_mhb_published_by').nullable()
                // Archive fields (design-time)
                t.boolean('_mhb_archived').notNullable().defaultTo(false)
                t.timestamp('_mhb_archived_at', { useTz: true }).nullable()
                t.uuid('_mhb_archived_by').nullable()
                // Soft delete fields (design-time)
                t.boolean('_mhb_deleted').notNullable().defaultTo(false)
                t.timestamp('_mhb_deleted_at', { useTz: true }).nullable()
                t.uuid('_mhb_deleted_by').nullable()

                t.unique(['key'])
            })
        }

        // _mhb_layouts: UI layouts/templates for published Applications.
        const hasLayouts = await this.knex.schema.withSchema(schemaName).hasTable('_mhb_layouts')
        if (!hasLayouts) {
            await this.knex.schema.withSchema(schemaName).createTable('_mhb_layouts', (t) => {
                t.uuid('id').primary().defaultTo(this.knex.raw('public.uuid_generate_v7()'))
                t.string('template_key', 100).notNullable().defaultTo('dashboard')
                t.jsonb('name').notNullable().defaultTo('{}')
                t.jsonb('description').nullable()
                t.jsonb('config').notNullable().defaultTo('{}')
                t.boolean('is_active').notNullable().defaultTo(true)
                t.boolean('is_default').notNullable().defaultTo(false)
                t.integer('sort_order').notNullable().defaultTo(0)
                t.uuid('owner_id').nullable()

                t.timestamp('_upl_created_at', { useTz: true }).notNullable().defaultTo(this.knex.fn.now())
                t.uuid('_upl_created_by').nullable()
                t.timestamp('_upl_updated_at', { useTz: true }).notNullable().defaultTo(this.knex.fn.now())
                t.uuid('_upl_updated_by').nullable()
                t.integer('_upl_version').notNullable().defaultTo(1)
                t.boolean('_upl_archived').notNullable().defaultTo(false)
                t.timestamp('_upl_archived_at', { useTz: true }).nullable()
                t.uuid('_upl_archived_by').nullable()
                t.boolean('_upl_deleted').notNullable().defaultTo(false)
                t.timestamp('_upl_deleted_at', { useTz: true }).nullable()
                t.uuid('_upl_deleted_by').nullable()
                t.timestamp('_upl_purge_after', { useTz: true }).nullable()
                t.boolean('_upl_locked').notNullable().defaultTo(false)
                t.timestamp('_upl_locked_at', { useTz: true }).nullable()
                t.uuid('_upl_locked_by').nullable()
                t.text('_upl_locked_reason').nullable()

                t.boolean('_mhb_published').notNullable().defaultTo(true)
                t.timestamp('_mhb_published_at', { useTz: true }).nullable()
                t.uuid('_mhb_published_by').nullable()
                t.boolean('_mhb_archived').notNullable().defaultTo(false)
                t.timestamp('_mhb_archived_at', { useTz: true }).nullable()
                t.uuid('_mhb_archived_by').nullable()
                t.boolean('_mhb_deleted').notNullable().defaultTo(false)
                t.timestamp('_mhb_deleted_at', { useTz: true }).nullable()
                t.uuid('_mhb_deleted_by').nullable()

                t.index(['template_key'], 'idx_mhb_layouts_template_key')
                t.index(['is_active'], 'idx_mhb_layouts_is_active')
                t.index(['is_default'], 'idx_mhb_layouts_is_default')
                t.index(['sort_order'], 'idx_mhb_layouts_sort_order')
            })

            await this.knex.raw(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_mhb_layouts_default_active
                ON "${schemaName}"._mhb_layouts (is_default)
                WHERE is_default = true AND _upl_deleted = false AND _mhb_deleted = false
            `)
        }

        const layoutsCountRow = await this.knex
            .withSchema(schemaName)
            .from('_mhb_layouts')
            .where({ _upl_deleted: false, _mhb_deleted: false })
            .count<{ count: string }[]>('* as count')
            .first()
        const layoutsCount = layoutsCountRow ? Number(layoutsCountRow.count) : 0
        if (Number.isFinite(layoutsCount) && layoutsCount === 0) {
            const now = new Date()
            const defaultName = buildLocalizedContent({ en: 'Dashboard', ru: 'Дашборд' }, 'en', 'en') ?? {}
            const defaultDescription =
                buildLocalizedContent(
                    { en: 'Default layout for published applications', ru: 'Макет по умолчанию для опубликованных приложений' },
                    'en',
                    'en'
                ) ?? null
            const defaultConfig = buildDashboardLayoutConfig(DEFAULT_DASHBOARD_ZONE_WIDGETS)

            await this.knex.withSchema(schemaName).into('_mhb_layouts').insert({
                template_key: 'dashboard',
                name: defaultName,
                description: defaultDescription,
                config: defaultConfig,
                is_active: true,
                is_default: true,
                sort_order: 0,
                owner_id: null,
                _upl_created_at: now,
                _upl_created_by: null,
                _upl_updated_at: now,
                _upl_updated_by: null,
                _upl_version: 1,
                _upl_archived: false,
                _upl_deleted: false,
                _upl_locked: false,
                _mhb_published: true,
                _mhb_archived: false,
                _mhb_deleted: false
            })
        }

        // _mhb_layout_zone_widgets: assigned dashboard widgets by layout zone.
        const hasLayoutZoneWidgets = await this.knex.schema.withSchema(schemaName).hasTable('_mhb_layout_zone_widgets')
        if (!hasLayoutZoneWidgets) {
            await this.knex.schema.withSchema(schemaName).createTable('_mhb_layout_zone_widgets', (t) => {
                t.uuid('id').primary().defaultTo(this.knex.raw('public.uuid_generate_v7()'))
                t.uuid('layout_id').notNullable().references('id').inTable(`${schemaName}._mhb_layouts`).onDelete('CASCADE')
                t.string('zone', 20).notNullable()
                t.string('widget_key', 100).notNullable()
                t.integer('sort_order').notNullable().defaultTo(1)
                t.jsonb('config').notNullable().defaultTo('{}')

                t.timestamp('_upl_created_at', { useTz: true }).notNullable().defaultTo(this.knex.fn.now())
                t.uuid('_upl_created_by').nullable()
                t.timestamp('_upl_updated_at', { useTz: true }).notNullable().defaultTo(this.knex.fn.now())
                t.uuid('_upl_updated_by').nullable()
                t.integer('_upl_version').notNullable().defaultTo(1)
                t.boolean('_upl_archived').notNullable().defaultTo(false)
                t.timestamp('_upl_archived_at', { useTz: true }).nullable()
                t.uuid('_upl_archived_by').nullable()
                t.boolean('_upl_deleted').notNullable().defaultTo(false)
                t.timestamp('_upl_deleted_at', { useTz: true }).nullable()
                t.uuid('_upl_deleted_by').nullable()
                t.timestamp('_upl_purge_after', { useTz: true }).nullable()
                t.boolean('_upl_locked').notNullable().defaultTo(false)
                t.timestamp('_upl_locked_at', { useTz: true }).nullable()
                t.uuid('_upl_locked_by').nullable()
                t.text('_upl_locked_reason').nullable()

                t.boolean('_mhb_published').notNullable().defaultTo(true)
                t.timestamp('_mhb_published_at', { useTz: true }).nullable()
                t.uuid('_mhb_published_by').nullable()
                t.boolean('_mhb_archived').notNullable().defaultTo(false)
                t.timestamp('_mhb_archived_at', { useTz: true }).nullable()
                t.uuid('_mhb_archived_by').nullable()
                t.boolean('_mhb_deleted').notNullable().defaultTo(false)
                t.timestamp('_mhb_deleted_at', { useTz: true }).nullable()
                t.uuid('_mhb_deleted_by').nullable()

                t.index(['layout_id'], 'idx_mhb_layout_zone_widgets_layout_id')
                t.index(['layout_id', 'zone', 'sort_order'], 'idx_mhb_layout_zone_widgets_layout_zone_sort')
            })
        }

        const defaultLayout = await this.knex
            .withSchema(schemaName)
            .from('_mhb_layouts')
            .where({ _upl_deleted: false, _mhb_deleted: false, is_default: true })
            .orderBy('sort_order', 'asc')
            .first()
        const fallbackLayout =
            defaultLayout ??
            (await this.knex
                .withSchema(schemaName)
                .from('_mhb_layouts')
                .where({ _upl_deleted: false, _mhb_deleted: false })
                .orderBy('sort_order', 'asc')
                .first())

        if (fallbackLayout) {
            const existingZoneWidgetCountRow = await this.knex
                .withSchema(schemaName)
                .from('_mhb_layout_zone_widgets')
                .where({
                    layout_id: fallbackLayout.id,
                    _upl_deleted: false,
                    _mhb_deleted: false
                })
                .count<{ count: string }[]>('* as count')
                .first()

            const existingZoneWidgetCount = existingZoneWidgetCountRow ? Number(existingZoneWidgetCountRow.count) : 0
            if (Number.isFinite(existingZoneWidgetCount) && existingZoneWidgetCount === 0) {
                const now = new Date()
                await this.knex
                    .withSchema(schemaName)
                    .into('_mhb_layout_zone_widgets')
                    .insert(
                        DEFAULT_DASHBOARD_ZONE_WIDGETS.map((item) => ({
                            layout_id: fallbackLayout.id,
                            zone: item.zone,
                            widget_key: item.widgetKey,
                            sort_order: item.sortOrder,
                            config: item.config ?? {},
                            _upl_created_at: now,
                            _upl_created_by: null,
                            _upl_updated_at: now,
                            _upl_updated_by: null,
                            _upl_version: 1,
                            _upl_archived: false,
                            _upl_deleted: false,
                            _upl_locked: false,
                            _mhb_published: true,
                            _mhb_archived: false,
                            _mhb_deleted: false
                        }))
                    )
            }
        }
    }
}
