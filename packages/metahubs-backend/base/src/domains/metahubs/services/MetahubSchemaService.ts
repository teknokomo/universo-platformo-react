import { DataSource } from 'typeorm'
import type { MetahubTemplateManifest } from '@universo/types'
import { Metahub } from '../../../database/entities/Metahub'
import { MetahubBranch } from '../../../database/entities/MetahubBranch'
import { MetahubUser } from '../../../database/entities/MetahubUser'
import { TemplateVersion } from '../../../database/entities/TemplateVersion'
import { getDDLServices, KnexClient, uuidToLockKey, acquireAdvisoryLock, releaseAdvisoryLock } from '../../ddl'
import { getStructureVersion, CURRENT_STRUCTURE_VERSION } from './structureVersions'
import { SystemTableMigrator } from './SystemTableMigrator'
import { TemplateSeedExecutor } from '../../templates/services/TemplateSeedExecutor'
import { TemplateSeedMigrator } from '../../templates/services/TemplateSeedMigrator'
import { validateTemplateManifest } from '../../templates/services/TemplateManifestValidator'
import { builtinTemplates, DEFAULT_TEMPLATE_CODENAME } from '../../templates/data'

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
            let manifest: MetahubTemplateManifest | undefined
            if (!tablesInitCache.has(resolved.schemaName)) {
                manifest = await this.loadManifest(metahubId)
                await this.initSystemTables(resolved.schemaName, manifest)
                tablesInitCache.add(resolved.schemaName)
            }

            // Auto-migrate if branch structure version is behind current
            if (resolved.structureVersion < CURRENT_STRUCTURE_VERSION) {
                manifest ??= await this.loadManifest(metahubId)
                await this.migrateStructure(resolved.schemaName, resolved.branchId, resolved.structureVersion, manifest)
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
     * Optionally accepts a template manifest; falls back to default built-in template.
     */
    async initializeSchema(schemaName: string, manifest?: MetahubTemplateManifest): Promise<void> {
        await this.createEmptySchemaIfNeeded(schemaName)
        if (!tablesInitCache.has(schemaName)) {
            const resolvedManifest = manifest ?? this.getDefaultManifest()
            await this.initSystemTables(schemaName, resolvedManifest)
            tablesInitCache.add(schemaName)
        }
    }

    private async resolveBranchSchema(
        metahubId: string,
        userId?: string
    ): Promise<{ branchId: string; schemaName: string; structureVersion: number }> {
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
        return { branchId, schemaName: branch.schemaName, structureVersion: branch.structureVersion ?? 1 }
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
     * Loads the template manifest for a metahub.
     * If the metahub has a templateVersionId, loads from the DB with runtime validation.
     * Falls back to the default built-in template.
     */
    private async loadManifest(metahubId: string): Promise<MetahubTemplateManifest> {
        const metahub = await this.dataSource.getRepository(Metahub).findOneByOrFail({ id: metahubId })

        if (metahub.templateVersionId) {
            const version = await this.dataSource.getRepository(TemplateVersion).findOneBy({ id: metahub.templateVersionId })
            if (version?.manifestJson) {
                try {
                    return validateTemplateManifest(version.manifestJson)
                } catch (error) {
                    console.warn(
                        `[MetahubSchemaService] Invalid manifest in template version ${version.id}, falling back to default:`,
                        error
                    )
                }
            }
        }

        return this.getDefaultManifest()
    }

    /**
     * Returns the default built-in template manifest.
     */
    private getDefaultManifest(): MetahubTemplateManifest {
        const defaultTemplate = builtinTemplates.find((t) => t.codename === DEFAULT_TEMPLATE_CODENAME)
        if (!defaultTemplate) {
            throw new Error(`Default template '${DEFAULT_TEMPLATE_CODENAME}' not found in built-in templates`)
        }
        return defaultTemplate
    }

    /**
     * Initialize system tables in the isolated schema.
     *
     * Delegates DDL creation to structure version registry and
     * seed data population to TemplateSeedExecutor.
     */
    private async initSystemTables(schemaName: string, manifest: MetahubTemplateManifest): Promise<void> {
        // 1. Create DDL structure (tables + indexes) based on structure version
        const structureVersion = manifest.minStructureVersion ?? CURRENT_STRUCTURE_VERSION
        const versionHandler = getStructureVersion(structureVersion)
        await versionHandler.init(this.knex, schemaName)

        // 2. Seed data from template manifest
        const executor = new TemplateSeedExecutor(this.knex, schemaName)
        await executor.apply(manifest.seed)
    }

    /**
     * Migrate system tables from an older structure version to CURRENT_STRUCTURE_VERSION.
     * Also applies incremental seed data from the template manifest.
     * Updates the branch record after successful migration.
     */
    private async migrateStructure(
        schemaName: string,
        branchId: string,
        fromVersion: number,
        manifest: MetahubTemplateManifest
    ): Promise<void> {
        // 1. DDL migration (tables, columns, indexes, FKs)
        const migrator = new SystemTableMigrator(this.knex, schemaName)
        const result = await migrator.migrate(fromVersion, CURRENT_STRUCTURE_VERSION)

        if (!result.success) {
            console.error(`[MetahubSchemaService] Structure migration failed for ${schemaName}:`, result.error)
            throw new Error(`Structure migration V${fromVersion}→V${CURRENT_STRUCTURE_VERSION} failed: ${result.error}`)
        }

        if (result.applied.length > 0) {
            console.info(
                `[MetahubSchemaService] Migrated ${schemaName} V${fromVersion}→V${CURRENT_STRUCTURE_VERSION}: ${result.applied.length} changes applied`
            )
        }

        if (result.skippedDestructive.length > 0) {
            console.warn(`[MetahubSchemaService] ${result.skippedDestructive.length} destructive changes skipped for ${schemaName}`)
        }

        // 2. Seed data migration (new layouts, settings, entities, elements from template)
        const seedMigrator = new TemplateSeedMigrator(this.knex, schemaName)
        const seedResult = await seedMigrator.migrateSeed(manifest.seed)

        const hasChanges =
            seedResult.layoutsAdded > 0 ||
            seedResult.zoneWidgetsAdded > 0 ||
            seedResult.settingsAdded > 0 ||
            seedResult.entitiesAdded > 0 ||
            seedResult.elementsAdded > 0

        if (hasChanges) {
            console.info(
                `[MetahubSchemaService] Seed migration for ${schemaName}: ` +
                    `+${seedResult.layoutsAdded} layouts, +${seedResult.zoneWidgetsAdded} zoneWidgets, ` +
                    `+${seedResult.settingsAdded} settings, +${seedResult.entitiesAdded} entities, ` +
                    `+${seedResult.attributesAdded} attributes, +${seedResult.elementsAdded} elements`
            )
        }

        // 3. Update branch structure version in DB
        const branchRepo = this.dataSource.getRepository(MetahubBranch)
        await branchRepo.update({ id: branchId }, { structureVersion: CURRENT_STRUCTURE_VERSION })
    }
}
