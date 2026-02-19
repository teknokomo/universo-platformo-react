import type { DataSource, EntityManager } from 'typeorm'
import { randomBytes } from 'crypto'
import type { MetahubTemplateManifest } from '@universo/types'
import { Metahub } from '../../../database/entities/Metahub'
import { MetahubBranch } from '../../../database/entities/MetahubBranch'
import { MetahubUser } from '../../../database/entities/MetahubUser'
import { TemplateVersion } from '../../../database/entities/TemplateVersion'
import { getDDLServices, KnexClient, uuidToLockKey, acquireAdvisoryLock, releaseAdvisoryLock } from '../../ddl'
import { getStructureVersion, CURRENT_STRUCTURE_VERSION } from './structureVersions'
import { SystemTableMigrator } from './SystemTableMigrator'
import { buildSystemStructureSnapshot } from './systemTableDefinitions'
import { buildBaselineMigrationMeta, buildTemplateSeedMigrationMeta } from './metahubMigrationMeta'
import { TemplateSeedExecutor } from '../../templates/services/TemplateSeedExecutor'
import { TemplateSeedMigrator } from '../../templates/services/TemplateSeedMigrator'
import { clearWidgetTableResolverCache } from '../../templates/services/widgetTableResolver'
import { validateTemplateManifest } from '../../templates/services/TemplateManifestValidator'
import { builtinTemplates, DEFAULT_TEMPLATE_CODENAME } from '../../templates/data'
import {
    MetahubMigrationRequiredError,
    MetahubPoolExhaustedError,
    MetahubSchemaLockTimeoutError,
    isKnexPoolTimeoutError
} from '../../shared/domainErrors'

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
const ensureSchemaInFlight = new Map<string, Promise<string>>()

/**
 * Cache for user active branch resolution.
 * Key: metahubId:userId, Value: { branchId, ts }
 *
 * Short TTL to avoid stale branch selection after user switches branch.
 */
const userBranchCache = new Map<string, { branchId: string; ts: number }>()

const setCachedUserBranchId = (metahubId: string, userId: string, branchId: string) => {
    userBranchCache.set(`${metahubId}:${userId}`, { branchId, ts: Date.now() })
}

const clearCachedUserBranchId = (metahubId: string, userId?: string) => {
    if (userId) {
        userBranchCache.delete(`${metahubId}:${userId}`)
        return
    }
    const prefix = `${metahubId}:`
    for (const key of userBranchCache.keys()) {
        if (key.startsWith(prefix)) {
            userBranchCache.delete(key)
        }
    }
}

interface EnsureSchemaOptions {
    mode?: 'read_only' | 'initialize' | 'apply_migrations'
    manifestOverride?: MetahubTemplateManifest
    templateVersionId?: string | null
    templateVersionLabel?: string | null
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
    constructor(private dataSource: DataSource, private branchIdOverride?: string, private managerOverride?: EntityManager) {}

    private get knex() {
        return KnexClient.getInstance()
    }

    private get repoManager(): EntityManager {
        return this.managerOverride ?? this.dataSource.manager
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
        for (const key of ensureSchemaInFlight.keys()) {
            if (key.startsWith(`${metahubId}:`)) {
                ensureSchemaInFlight.delete(key)
            }
        }
        clearCachedUserBranchId(metahubId)
        clearWidgetTableResolverCache()
    }

    /**
     * Updates active branch cache for a specific user.
     * Call after explicit branch switching to keep schema resolution consistent.
     */
    static setUserBranchCache(metahubId: string, userId: string, branchId: string): void {
        setCachedUserBranchId(metahubId, userId, branchId)
    }

    /**
     * Clears user branch cache for a specific user or all users in metahub.
     */
    static clearUserBranchCache(metahubId: string, userId?: string): void {
        clearCachedUserBranchId(metahubId, userId)
    }

    /**
     * Clears entire cache (for testing or server restart scenarios).
     */
    static clearAllCaches(): void {
        schemaCache.clear()
        tablesInitCache.clear()
        ensureSchemaInFlight.clear()
        userBranchCache.clear()
        clearWidgetTableResolverCache()
    }

    /**
     * Ensures that the isolated schema for the Metahub exists.
     * Creates system tables if they don't exist.
     *
     * Uses caching to avoid repeated DB checks and advisory locking
     * to prevent race conditions during schema creation.
     */
    async ensureSchema(metahubId: string, userId?: string, options?: EnsureSchemaOptions): Promise<string> {
        const mode = options?.mode ?? 'read_only'
        let resolved = await this.resolveBranchSchema(metahubId, userId)
        if (userId && !this.branchIdOverride) {
            setCachedUserBranchId(metahubId, userId, resolved.branchId)
        }
        const initialCacheKey = `${metahubId}:${resolved.branchId}`

        // Fast-path for already initialized and fully synced schemas.
        // Safe only for read-only mode.
        if (
            mode === 'read_only' &&
            tablesInitCache.has(resolved.schemaName) &&
            resolved.structureVersion >= CURRENT_STRUCTURE_VERSION &&
            resolved.lastTemplateVersionId === resolved.metahubTemplateVersionId
        ) {
            schemaCache.set(initialCacheKey, resolved.schemaName)
            return resolved.schemaName
        }

        if (mode === 'read_only') {
            const schemaState = await this.inspectSchemaState(resolved.schemaName, resolved.structureVersion)
            if (!schemaState.initialized) {
                throw new MetahubMigrationRequiredError('Metahub schema is not initialized. Open migrations and apply updates.', {
                    metahubId,
                    branchId: resolved.branchId,
                    schemaName: resolved.schemaName,
                    expectedTables: schemaState.expectedTables,
                    missingTables: schemaState.missingTables,
                    hasAnyExpectedTables: schemaState.hasAnyExpectedTables
                })
            }

            tablesInitCache.add(resolved.schemaName)
            schemaCache.set(initialCacheKey, resolved.schemaName)

            if (resolved.structureVersion < CURRENT_STRUCTURE_VERSION) {
                throw new MetahubMigrationRequiredError('Metahub structure upgrade is required before using this branch.', {
                    metahubId,
                    branchId: resolved.branchId,
                    schemaName: resolved.schemaName,
                    fromVersion: resolved.structureVersion,
                    toVersion: CURRENT_STRUCTURE_VERSION
                })
            }

            if (resolved.lastTemplateVersionId !== resolved.metahubTemplateVersionId) {
                throw new MetahubMigrationRequiredError('Metahub template upgrade is required before using this branch.', {
                    metahubId,
                    branchId: resolved.branchId,
                    schemaName: resolved.schemaName,
                    currentTemplateVersionId: resolved.lastTemplateVersionId,
                    targetTemplateVersionId: resolved.metahubTemplateVersionId
                })
            }

            return resolved.schemaName
        }

        if (mode === 'initialize') {
            const inFlight = ensureSchemaInFlight.get(initialCacheKey)
            if (inFlight) {
                return inFlight
            }
        }

        const runEnsure = async (): Promise<string> => {
            let cacheKey = initialCacheKey

            const lockKey = uuidToLockKey(metahubId)
            const acquired = await acquireAdvisoryLock(this.knex, lockKey)

            if (!acquired) {
                throw new MetahubSchemaLockTimeoutError('Could not acquire lock for schema creation', {
                    metahubId,
                    branchId: resolved.branchId
                })
            }

            try {
                // Resolve again under lock to avoid stale branch context after branch switch.
                resolved = await this.resolveBranchSchema(metahubId, userId)
                if (userId && !this.branchIdOverride) {
                    setCachedUserBranchId(metahubId, userId, resolved.branchId)
                }
                cacheKey = `${metahubId}:${resolved.branchId}`
                if (!resolved.schemaName) {
                    throw new Error('Branch schema name is missing')
                }

                let manifest: MetahubTemplateManifest | undefined = options?.manifestOverride
                let effectiveStructureVersion = resolved.structureVersion
                let templateVersionInfo = {
                    templateVersionId: options?.templateVersionId ?? null,
                    templateVersionLabel: options?.templateVersionLabel ?? null
                }
                let initializedNow = false
                let seedSyncedDuringStructureMigration = false
                let seedChangesApplied = false

                const schemaState = await this.inspectSchemaState(resolved.schemaName, resolved.structureVersion)
                const schemaInitializedInDb = schemaState.initialized
                if (schemaInitializedInDb) {
                    tablesInitCache.add(resolved.schemaName)
                }

                if (!schemaInitializedInDb) {
                    if (schemaState.hasAnyExpectedTables) {
                        throw new MetahubMigrationRequiredError(
                            'Metahub schema is partially initialized and requires controlled migration/repair.',
                            {
                                metahubId,
                                branchId: resolved.branchId,
                                schemaName: resolved.schemaName,
                                expectedTables: schemaState.expectedTables,
                                missingTables: schemaState.missingTables
                            }
                        )
                    }

                    await this.createEmptySchemaIfNeeded(resolved.schemaName)
                    manifest ??= await this.loadManifest(metahubId)
                    await this.initSystemTables(resolved.schemaName, manifest)
                    tablesInitCache.add(resolved.schemaName)
                    initializedNow = true
                    effectiveStructureVersion = manifest.minStructureVersion ?? CURRENT_STRUCTURE_VERSION
                }

                if (mode === 'apply_migrations' && !initializedNow && resolved.structureVersion < CURRENT_STRUCTURE_VERSION) {
                    manifest ??= await this.loadManifest(metahubId)
                    if (!templateVersionInfo.templateVersionId && !templateVersionInfo.templateVersionLabel) {
                        templateVersionInfo = await this.loadTemplateVersionInfo(metahubId)
                    }
                    seedChangesApplied = await this.migrateStructure(
                        resolved.schemaName,
                        resolved.branchId,
                        resolved.structureVersion,
                        manifest,
                        templateVersionInfo
                    )
                    effectiveStructureVersion = CURRENT_STRUCTURE_VERSION
                    seedSyncedDuringStructureMigration = true
                }

                if (mode === 'apply_migrations' && !initializedNow && !seedSyncedDuringStructureMigration) {
                    manifest ??= await this.loadManifest(metahubId)
                    if (!templateVersionInfo.templateVersionId && !templateVersionInfo.templateVersionLabel) {
                        templateVersionInfo = await this.loadTemplateVersionInfo(metahubId)
                    }
                    seedChangesApplied = await this.syncTemplateSeed(
                        resolved.schemaName,
                        manifest,
                        effectiveStructureVersion,
                        templateVersionInfo
                    )
                }

                schemaCache.set(cacheKey, resolved.schemaName)
                const templateSyncChanged =
                    resolved.lastTemplateVersionId !== (templateVersionInfo.templateVersionId ?? null) ||
                    resolved.lastTemplateVersionLabel !== (templateVersionInfo.templateVersionLabel ?? null)
                const needsTemplateSyncUpdate =
                    mode === 'apply_migrations' &&
                    (initializedNow || seedSyncedDuringStructureMigration || seedChangesApplied || templateSyncChanged)

                if (needsTemplateSyncUpdate) {
                    await this.updateBranchTemplateSyncInfo(resolved.branchId, templateVersionInfo)
                }

                return resolved.schemaName
            } catch (error) {
                if (isKnexPoolTimeoutError(error)) {
                    throw new MetahubPoolExhaustedError('Database connection pool is exhausted during metahub schema operation', {
                        metahubId
                    })
                }
                throw error
            } finally {
                await releaseAdvisoryLock(this.knex, lockKey)
            }
        }

        if (mode === 'initialize') {
            const inFlight = runEnsure()
            ensureSchemaInFlight.set(initialCacheKey, inFlight)
            try {
                return await inFlight
            } finally {
                if (ensureSchemaInFlight.get(initialCacheKey) === inFlight) {
                    ensureSchemaInFlight.delete(initialCacheKey)
                }
            }
        }

        return runEnsure()
    }

    /**
     * Create empty schema and system tables when schema does not exist yet.
     */
    async createEmptySchemaIfNeeded(schemaName: string): Promise<void> {
        const { generator } = getDDLServices()
        try {
            await generator.createSchema(schemaName)
        } catch (error) {
            if (isKnexPoolTimeoutError(error)) {
                throw new MetahubPoolExhaustedError('Database connection pool is exhausted during schema creation', { schemaName })
            }
            throw error
        }
    }

    /**
     * Ensures schema and system tables exist for a known schema name.
     * Does not resolve branches or cache keys.
     * Optionally accepts a template manifest; falls back to default built-in template.
     */
    async initializeSchema(schemaName: string, manifest?: MetahubTemplateManifest): Promise<void> {
        const targetStructureVersion = manifest?.minStructureVersion ?? CURRENT_STRUCTURE_VERSION
        const schemaState = await this.inspectSchemaState(schemaName, targetStructureVersion)
        const schemaInitializedInDb = schemaState.initialized
        if (schemaInitializedInDb) {
            tablesInitCache.add(schemaName)
            return
        }
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
    ): Promise<{
        branchId: string
        schemaName: string
        structureVersion: number
        metahubTemplateVersionId: string | null
        lastTemplateVersionId: string | null
        lastTemplateVersionLabel: string | null
    }> {
        const metaRepo = this.repoManager.getRepository(Metahub)
        const branchRepo = this.repoManager.getRepository(MetahubBranch)
        const memberRepo = this.repoManager.getRepository(MetahubUser)

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
        return {
            branchId,
            schemaName: branch.schemaName,
            structureVersion: branch.structureVersion ?? 1,
            metahubTemplateVersionId: metahub.templateVersionId ?? null,
            lastTemplateVersionId: branch.lastTemplateVersionId ?? null,
            lastTemplateVersionLabel: branch.lastTemplateVersionLabel ?? null
        }
    }

    /**
     * Drops the isolated schema for a metahub.
     * Uses centralized DDL services with proper validation.
     * WARNING: destructive operation.
     */
    async dropSchema(metahubId: string): Promise<void> {
        const branchRepo = this.repoManager.getRepository(MetahubBranch)
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
        const metahub = await this.repoManager.getRepository(Metahub).findOneByOrFail({ id: metahubId })

        if (metahub.templateVersionId) {
            const version = await this.repoManager.getRepository(TemplateVersion).findOneBy({ id: metahub.templateVersionId })
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

        // 3. Record baseline migration for fresh schemas
        await this.recordBaselineMigration(schemaName, structureVersion, manifest.version)
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
        manifest: MetahubTemplateManifest,
        templateVersionInfo?: { templateVersionId?: string | null; templateVersionLabel?: string | null }
    ): Promise<boolean> {
        // 1. DDL migration (tables, columns, indexes, FKs)
        const migrator = new SystemTableMigrator(this.knex, schemaName)
        const result = await migrator.migrate(fromVersion, CURRENT_STRUCTURE_VERSION)

        if (!result.success) {
            if (result.skippedDestructive.length > 0) {
                throw new MetahubMigrationRequiredError('Metahub structure migration requires manual review before apply', {
                    schemaName,
                    branchId,
                    fromVersion,
                    toVersion: CURRENT_STRUCTURE_VERSION,
                    blockers: result.skippedDestructive
                })
            }
            if (isKnexPoolTimeoutError(result.error)) {
                throw new MetahubPoolExhaustedError('Database connection pool is exhausted during structure migration', {
                    schemaName,
                    branchId,
                    fromVersion,
                    toVersion: CURRENT_STRUCTURE_VERSION
                })
            }
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
        // 2. Keep seed data in sync after structure migration
        const seedSynced = await this.syncTemplateSeed(schemaName, manifest, CURRENT_STRUCTURE_VERSION, templateVersionInfo)

        // 3. Update branch structure version only after successful structure + seed sync
        const branchRepo = this.repoManager.getRepository(MetahubBranch)
        await branchRepo.update({ id: branchId }, { structureVersion: CURRENT_STRUCTURE_VERSION })

        return seedSynced
    }

    /**
     * Records baseline structure migration for a freshly initialized schema.
     * Idempotent: does nothing if baseline already exists.
     */
    private async recordBaselineMigration(
        schemaName: string,
        structureVersion: number,
        templateVersionLabel?: string | null
    ): Promise<void> {
        const hasMigrationTable = await this.knex.schema.withSchema(schemaName).hasTable('_mhb_migrations')
        if (!hasMigrationTable) return

        const baselineName = `baseline_structure_v${structureVersion}`
        const meta = buildBaselineMigrationMeta(buildSystemStructureSnapshot(structureVersion), templateVersionLabel)
        await this.knex
            .withSchema(schemaName)
            .into('_mhb_migrations')
            .insert({
                name: baselineName,
                from_version: structureVersion,
                to_version: structureVersion,
                meta
            })
            .onConflict('name')
            .ignore()
    }

    private async syncTemplateSeed(
        schemaName: string,
        manifest: MetahubTemplateManifest,
        structureVersion: number,
        templateVersionInfo?: { templateVersionId?: string | null; templateVersionLabel?: string | null }
    ): Promise<boolean> {
        // Refresh widget table resolver cache to avoid stale table-name mapping after structure renames.
        clearWidgetTableResolverCache()
        const seedMigrator = new TemplateSeedMigrator(this.knex, schemaName)
        const seedResult = await seedMigrator.migrateSeed(manifest.seed)

        const hasChanges =
            seedResult.layoutsAdded > 0 ||
            seedResult.zoneWidgetsAdded > 0 ||
            seedResult.settingsAdded > 0 ||
            seedResult.entitiesAdded > 0 ||
            seedResult.attributesAdded > 0 ||
            seedResult.elementsAdded > 0

        if (!hasChanges) return false

        await this.recordTemplateSeedMigration(schemaName, structureVersion, seedResult, templateVersionInfo)

        console.info(
            `[MetahubSchemaService] Seed sync for ${schemaName}: ` +
                `+${seedResult.layoutsAdded} layouts, +${seedResult.zoneWidgetsAdded} zoneWidgets, ` +
                `+${seedResult.settingsAdded} settings, +${seedResult.entitiesAdded} entities, ` +
                `+${seedResult.attributesAdded} attributes, +${seedResult.enumValuesAdded} enum values, +${seedResult.elementsAdded} elements`
        )
        return true
    }

    private async recordTemplateSeedMigration(
        schemaName: string,
        structureVersion: number,
        seedResult: {
            layoutsAdded: number
            zoneWidgetsAdded: number
            settingsAdded: number
            entitiesAdded: number
            attributesAdded: number
            enumValuesAdded: number
            elementsAdded: number
            skipped: string[]
        },
        templateVersionInfo?: { templateVersionId?: string | null; templateVersionLabel?: string | null }
    ): Promise<void> {
        const hasMigrationTable = await this.knex.schema.withSchema(schemaName).hasTable('_mhb_migrations')
        if (!hasMigrationTable) return

        const name = `template_seed_${Date.now()}_${randomBytes(4).toString('hex')}`
        const meta = buildTemplateSeedMigrationMeta({
            counts: {
                layoutsAdded: seedResult.layoutsAdded,
                zoneWidgetsAdded: seedResult.zoneWidgetsAdded,
                settingsAdded: seedResult.settingsAdded,
                entitiesAdded: seedResult.entitiesAdded,
                attributesAdded: seedResult.attributesAdded,
                enumValuesAdded: seedResult.enumValuesAdded,
                elementsAdded: seedResult.elementsAdded
            },
            skipped: seedResult.skipped,
            templateVersionId: templateVersionInfo?.templateVersionId ?? null,
            templateVersionLabel: templateVersionInfo?.templateVersionLabel ?? null
        })

        await this.knex.withSchema(schemaName).into('_mhb_migrations').insert({
            name,
            from_version: structureVersion,
            to_version: structureVersion,
            meta
        })
    }

    private async loadTemplateVersionInfo(
        metahubId: string
    ): Promise<{ templateVersionId: string | null; templateVersionLabel: string | null }> {
        const metahub = await this.repoManager.getRepository(Metahub).findOneByOrFail({ id: metahubId })
        if (!metahub.templateVersionId) {
            return { templateVersionId: null, templateVersionLabel: null }
        }

        const version = await this.repoManager.getRepository(TemplateVersion).findOneBy({ id: metahub.templateVersionId })
        return {
            templateVersionId: metahub.templateVersionId,
            templateVersionLabel: version?.versionLabel ?? null
        }
    }

    private async updateBranchTemplateSyncInfo(
        branchId: string,
        templateVersionInfo: { templateVersionId?: string | null; templateVersionLabel?: string | null }
    ): Promise<void> {
        const branchRepo = this.repoManager.getRepository(MetahubBranch)
        await branchRepo.update(
            { id: branchId },
            {
                lastTemplateVersionId: templateVersionInfo.templateVersionId ?? null,
                lastTemplateVersionLabel: templateVersionInfo.templateVersionLabel ?? null,
                lastTemplateSyncedAt: templateVersionInfo.templateVersionId || templateVersionInfo.templateVersionLabel ? new Date() : null
            }
        )
    }

    private normalizeStructureVersion(version: number | null | undefined): number {
        if (!Number.isInteger(version) || (version ?? 0) <= 0) {
            return 1
        }
        return Math.min(version as number, CURRENT_STRUCTURE_VERSION)
    }

    private getExpectedSystemTables(structureVersion: number): string[] {
        const normalizedVersion = this.normalizeStructureVersion(structureVersion)
        return [...getStructureVersion(normalizedVersion).tables]
    }

    private async inspectSchemaState(
        schemaName: string,
        structureVersion: number
    ): Promise<{ initialized: boolean; hasAnyExpectedTables: boolean; expectedTables: string[]; missingTables: string[] }> {
        const expectedTables = this.getExpectedSystemTables(structureVersion)

        // Single query instead of N parallel hasTable() calls to avoid pool starvation.
        // Each hasTable() acquires its own connection from the Knex pool; under advisory locks
        // this can exhaust all available connections and cause a deadlock/timeout.
        const result = await this.knex.raw<{ rows: Array<{ table_name: string }> }>(
            `SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name = ANY(?)`,
            [schemaName, expectedTables]
        )
        const existingTables = new Set(result.rows.map((r) => r.table_name))

        const missingTables = expectedTables.filter((t) => !existingTables.has(t))
        const hasAnyExpectedTables = existingTables.size > 0

        return {
            initialized: missingTables.length === 0,
            hasAnyExpectedTables,
            expectedTables,
            missingTables
        }
    }
}
