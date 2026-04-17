import { randomBytes } from 'crypto'
import type { EntityTypePresetManifest, MetahubCreateOptions, MetahubTemplateManifest, MetahubTemplateSeed } from '@universo/types'
import type { SqlQueryable } from '../../../persistence/types'
import {
    findMetahubById,
    findBranchByIdAndMetahub,
    findBranchesByMetahub,
    findMetahubMembership,
    findTemplateByCodename,
    findTemplateVersionById,
    updateBranch
} from '../../../persistence'
import { getDDLServices, uuidToLockKey, acquireAdvisoryLock, releaseAdvisoryLock } from '../../ddl'
import { getKnex } from '@universo/database'
import {
    getStructureVersion,
    CURRENT_STRUCTURE_VERSION,
    semverToStructureVersion,
    structureVersionToSemver,
    normalizeStoredStructureVersion
} from './structureVersions'
import { SystemTableMigrator } from './SystemTableMigrator'
import { buildSystemStructureSnapshot } from './systemTableDefinitions'
import { buildBaselineMigrationMeta, buildTemplateSeedMigrationMeta } from './metahubMigrationMeta'
import { TemplateSeedExecutor } from '../../templates/services/TemplateSeedExecutor'
import { TemplateSeedMigrator } from '../../templates/services/TemplateSeedMigrator'
import { mirrorToGlobalCatalog } from '@universo/migrations-catalog'
import { hasRuntimeHistoryTable, quoteIdentifier } from '@universo/migrations-core'
import { clearWidgetTableResolverCache } from '../../templates/services/widgetTableResolver'
import { validateEntityTypePresetManifest, validateTemplateManifest } from '../../templates/services/TemplateManifestValidator'
import { builtinEntityTypePresets, builtinTemplates, DEFAULT_TEMPLATE_CODENAME } from '../../templates/data'
import {
    MetahubMigrationRequiredError,
    MetahubPoolExhaustedError,
    MetahubSchemaLockTimeoutError,
    isKnexPoolTimeoutError,
    MetahubNotFoundError,
    MetahubValidationError,
    MetahubSchemaSyncError
} from '../../shared/domainErrors'
import { isGlobalMigrationCatalogEnabled } from '@universo/utils'
import { ensureCodenameValue } from '../../shared/codename'
import { createLogger } from '../../../utils/logger'

const log = createLogger('MetahubSchemaService')
const PUBLIC_BASELINE_STRUCTURE_VERSION = 1
const TEMPLATE_PRESET_TOGGLES_SETTING_KEY = 'system.templatePresetToggles'
const ENTITY_TYPE_PRESET_REGISTRY = new Map(builtinEntityTypePresets.map((manifest) => [manifest.codename, manifest]))

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

type TemplatePresetToggleMap = Record<string, boolean>

type TemplateBootstrapBundle = {
    seed: MetahubTemplateSeed
    entityTypePresets: EntityTypePresetManifest[]
    effectivePresetToggles: TemplatePresetToggleMap
}

const hasNonEmptyObject = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value as Record<string, unknown>).length > 0)

const toPresetToggleMap = (value: unknown): TemplatePresetToggleMap => {
    if (!hasNonEmptyObject(value)) {
        return {}
    }

    const normalized: TemplatePresetToggleMap = {}
    for (const [key, entry] of Object.entries(value)) {
        if (typeof key === 'string' && typeof entry === 'boolean') {
            normalized[key] = entry
        }
    }
    return normalized
}

const cloneSeed = (seed: MetahubTemplateSeed): MetahubTemplateSeed => ({
    ...seed,
    layouts: [...seed.layouts],
    layoutZoneWidgets: Object.fromEntries(Object.entries(seed.layoutZoneWidgets).map(([key, widgets]) => [key, [...widgets]])),
    settings: seed.settings ? [...seed.settings] : undefined,
    entities: seed.entities ? [...seed.entities] : undefined,
    elements: seed.elements ? Object.fromEntries(Object.entries(seed.elements).map(([key, items]) => [key, [...items]])) : undefined,
    optionValues: seed.optionValues
        ? Object.fromEntries(Object.entries(seed.optionValues).map(([key, items]) => [key, [...items]]))
        : undefined
})

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
    constructor(private exec: SqlQueryable, private branchIdOverride?: string) {}

    query<T = unknown>(sql: string, parameters?: unknown[]): Promise<T[]> {
        return this.exec.query<T>(sql, parameters)
    }

    async resolvePublicStructureVersion(schemaName: string, fallbackVersion: string | number | null | undefined): Promise<string> {
        const baselineVersion = await this.readBaselineMigrationVersion(schemaName)
        return structureVersionToSemver(baselineVersion ?? fallbackVersion)
    }

    async rewriteBaselineMigrationVersion(schemaName: string, version: string | number | null | undefined): Promise<void> {
        const normalizedVersion = this.parseExplicitStructureVersion(version)
        if (normalizedVersion == null) return

        const baselineRow = await this.readBaselineMigrationRow(schemaName)
        if (!baselineRow?.id) return

        const baselineName = `baseline_structure_v${normalizedVersion}`
        const schemaIdent = quoteIdentifier(schemaName)
        await this.exec.query(
            `UPDATE ${schemaIdent}._mhb_migrations
             SET name = $1, from_version = $2, to_version = $3
             WHERE id = $4`,
            [baselineName, normalizedVersion, normalizedVersion, baselineRow.id]
        )
    }

    private get knex() {
        return getKnex()
    }

    private parseExplicitStructureVersion(version: string | number | null | undefined): number | null {
        if (typeof version === 'number') {
            if (!Number.isInteger(version) || version < 1 || version > CURRENT_STRUCTURE_VERSION) return null
            return version
        }

        if (typeof version !== 'string') {
            return null
        }

        const trimmed = version.trim()
        if (!trimmed) return null

        if (/^\d+$/.test(trimmed)) {
            const numeric = Number(trimmed)
            if (!Number.isInteger(numeric) || numeric < 1 || numeric > CURRENT_STRUCTURE_VERSION) return null
            return numeric
        }

        if (!/^\d+\.\d+\.\d+$/.test(trimmed)) {
            return null
        }

        const normalized = semverToStructureVersion(trimmed)
        if (normalized < 1 || normalized > CURRENT_STRUCTURE_VERSION) return null
        return normalized
    }

    private async readBaselineMigrationVersion(schemaName: string): Promise<number | null> {
        const baselineRow = await this.readBaselineMigrationRow(schemaName)
        if (!baselineRow) return null

        const versionFromColumn = this.parseExplicitStructureVersion(baselineRow.toVersion)
        if (versionFromColumn != null) {
            return versionFromColumn
        }

        const nameMatch = /^baseline_structure_v(\d+)$/.exec(baselineRow.name)
        if (!nameMatch) return null

        const versionFromName = Number(nameMatch[1])
        if (!Number.isInteger(versionFromName) || versionFromName < 1 || versionFromName > CURRENT_STRUCTURE_VERSION) {
            return null
        }

        return versionFromName
    }

    private async readBaselineMigrationRow(
        schemaName: string
    ): Promise<{ id: string; name: string; toVersion: string | number | null } | null> {
        const hasMigrationTable = await this.hasLocalMigrationTable(schemaName)
        if (!hasMigrationTable) return null

        const schemaIdent = quoteIdentifier(schemaName)
        const rows = await this.exec.query<{ id: string; name: string; toVersion: string | number | null }>(
            `SELECT id, name, to_version AS "toVersion"
             FROM ${schemaIdent}._mhb_migrations
             WHERE name LIKE 'baseline_structure_v%'
             ORDER BY applied_at ASC, name ASC
             LIMIT 1`
        )

        const baselineRow = rows[0]
        if (!baselineRow) return null

        return {
            id: baselineRow.id,
            name: baselineRow.name,
            toVersion: baselineRow.toVersion ?? null
        }
    }

    private async hasLocalMigrationTable(schemaName: string): Promise<boolean> {
        const rows = await this.exec.query<{ exists: boolean | string | number }>(
            `SELECT EXISTS (
                 SELECT 1
                 FROM information_schema.tables
                 WHERE table_schema = $1 AND table_name = $2
             ) AS "exists"`,
            [schemaName, '_mhb_migrations']
        )

        const exists = rows[0]?.exists
        return exists === true || exists === 't' || exists === 'true' || exists === 1
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
                    fromVersion: structureVersionToSemver(resolved.structureVersion),
                    toVersion: structureVersionToSemver(CURRENT_STRUCTURE_VERSION)
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
                    effectiveStructureVersion = CURRENT_STRUCTURE_VERSION
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
    async initializeSchema(schemaName: string, manifest?: MetahubTemplateManifest, createOptions?: MetahubCreateOptions): Promise<void> {
        const schemaState = await this.inspectSchemaState(schemaName, CURRENT_STRUCTURE_VERSION)
        const schemaInitializedInDb = schemaState.initialized
        if (schemaInitializedInDb) {
            tablesInitCache.add(schemaName)
            return
        }
        await this.createEmptySchemaIfNeeded(schemaName)
        if (!tablesInitCache.has(schemaName)) {
            const resolvedManifest = manifest ?? this.getDefaultManifest()
            await this.initSystemTables(schemaName, resolvedManifest, createOptions)
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
        const metahub = await findMetahubById(this.exec, metahubId)
        if (!metahub) {
            throw new MetahubNotFoundError('Metahub', metahubId)
        }
        const defaultBranchId = metahub.defaultBranchId
        if (!defaultBranchId) {
            throw new MetahubValidationError('Default branch is not configured for this metahub')
        }

        let branchId = this.branchIdOverride ?? defaultBranchId
        if (!this.branchIdOverride && userId) {
            const membership = await findMetahubMembership(this.exec, metahubId, userId)
            if (membership?.activeBranchId) {
                branchId = membership.activeBranchId
            }
        }

        const branch = await findBranchByIdAndMetahub(this.exec, branchId, metahubId)
        if (!branch) {
            throw new MetahubNotFoundError('Branch', branchId)
        }
        return {
            branchId,
            schemaName: branch.schemaName,
            structureVersion: semverToStructureVersion(branch.structureVersion),
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
        const branches = await findBranchesByMetahub(this.exec, metahubId)
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
        const metahub = await findMetahubById(this.exec, metahubId)
        if (!metahub) {
            throw new MetahubNotFoundError('Metahub', metahubId)
        }

        if (metahub.templateVersionId) {
            const version = await findTemplateVersionById(this.exec, metahub.templateVersionId)
            if (version?.manifestJson) {
                try {
                    return validateTemplateManifest(version.manifestJson)
                } catch (error) {
                    log.warn(`Invalid manifest in template version ${version.id}, falling back to default:`, error)
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

    private async loadEntityTypePresetManifest(presetCodename: string): Promise<EntityTypePresetManifest> {
        const builtinPreset = ENTITY_TYPE_PRESET_REGISTRY.get(presetCodename)
        if (builtinPreset) {
            return validateEntityTypePresetManifest(builtinPreset)
        }

        const template = await findTemplateByCodename(this.exec, presetCodename)
        if (!template || template.definitionType !== 'entity_type_preset' || !template.isActive || !template.activeVersionId) {
            throw new MetahubValidationError(`Entity type preset '${presetCodename}' not found or inactive`, { presetCodename })
        }

        const version = await findTemplateVersionById(this.exec, template.activeVersionId)
        if (!version?.manifestJson) {
            throw new MetahubValidationError(`Entity type preset '${presetCodename}' has no active manifest`, { presetCodename })
        }

        return validateEntityTypePresetManifest(version.manifestJson)
    }

    private async readPersistedPresetToggles(schemaName: string): Promise<TemplatePresetToggleMap> {
        const schemaIdent = quoteIdentifier(schemaName)
        const rows = await this.exec.query<{ value?: { _value?: unknown } | null }>(
            `SELECT value
             FROM ${schemaIdent}._mhb_settings
             WHERE key = $1
             LIMIT 1`,
            [TEMPLATE_PRESET_TOGGLES_SETTING_KEY]
        )

        const rawValue = rows[0]?.value
        return toPresetToggleMap(rawValue?._value ?? rawValue)
    }

    private static buildEffectivePresetToggles(
        manifest: MetahubTemplateManifest,
        createOptions?: MetahubCreateOptions,
        persistedToggles?: TemplatePresetToggleMap
    ): TemplatePresetToggleMap {
        const toggles: TemplatePresetToggleMap = {}
        for (const preset of manifest.presets ?? []) {
            const requestedToggle = createOptions?.presetToggles?.[preset.presetCodename]
            const persistedToggle = persistedToggles?.[preset.presetCodename]
            toggles[preset.presetCodename] = requestedToggle ?? persistedToggle ?? preset.includedByDefault !== false
        }
        return toggles
    }

    private static buildSeedFromPresetDefaults(presets: EntityTypePresetManifest[]): MetahubTemplateSeed {
        const entities: NonNullable<MetahubTemplateSeed['entities']> = []
        const elements: NonNullable<MetahubTemplateSeed['elements']> = {}
        const optionValues: NonNullable<MetahubTemplateSeed['optionValues']> = {}

        for (const preset of presets) {
            for (const instance of preset.defaultInstances ?? []) {
                entities.push({
                    codename: instance.codename,
                    kind: preset.entityType.kindKey,
                    name: instance.name,
                    description: instance.description,
                    config: instance.config,
                    attributes: instance.attributes,
                    fixedValues: instance.fixedValues,
                    hubs: instance.hubs
                })

                if (instance.elements?.length) {
                    elements[instance.codename] = [...instance.elements]
                }

                if (instance.optionValues?.length) {
                    optionValues[instance.codename] = [...instance.optionValues]
                }
            }
        }

        return {
            layouts: [],
            layoutZoneWidgets: {},
            entities: entities.length > 0 ? entities : undefined,
            elements: Object.keys(elements).length > 0 ? elements : undefined,
            optionValues: Object.keys(optionValues).length > 0 ? optionValues : undefined
        }
    }

    private static mergePresetSeedIntoTemplateSeed(
        seed: MetahubTemplateSeed,
        presetSeed: MetahubTemplateSeed,
        presetToggles: TemplatePresetToggleMap,
        includePresetSettings: boolean
    ): MetahubTemplateSeed {
        const merged = cloneSeed(seed)
        const presetEntities = presetSeed.entities ?? []
        const templateEntities = merged.entities ?? []
        const entityIdentitySet = new Set<string>()

        for (const entity of [...presetEntities, ...templateEntities]) {
            const identity = `${entity.kind}:${entity.codename}`
            if (entityIdentitySet.has(identity)) {
                throw new MetahubValidationError('Template seed duplicates a preset default instance', { identity })
            }
            entityIdentitySet.add(identity)
        }

        const mergedElements: NonNullable<MetahubTemplateSeed['elements']> = {
            ...(presetSeed.elements ?? {})
        }
        for (const [codename, items] of Object.entries(merged.elements ?? {})) {
            if (mergedElements[codename]) {
                throw new MetahubValidationError('Template seed elements duplicate a preset default instance', { codename })
            }
            mergedElements[codename] = [...items]
        }

        const mergedEnumerationValues: NonNullable<MetahubTemplateSeed['optionValues']> = {
            ...(presetSeed.optionValues ?? {})
        }
        for (const [codename, items] of Object.entries(merged.optionValues ?? {})) {
            if (mergedEnumerationValues[codename]) {
                throw new MetahubValidationError('Template seed optionValues duplicate a preset default instance', { codename })
            }
            mergedEnumerationValues[codename] = [...items]
        }

        const nextSettings = merged.settings ? [...merged.settings] : []
        if (includePresetSettings) {
            const existingSettingIndex = nextSettings.findIndex((setting) => setting.key === TEMPLATE_PRESET_TOGGLES_SETTING_KEY)
            const presetToggleSetting = {
                key: TEMPLATE_PRESET_TOGGLES_SETTING_KEY,
                value: {
                    _value: presetToggles
                }
            }
            if (existingSettingIndex >= 0) {
                nextSettings[existingSettingIndex] = presetToggleSetting
            } else {
                nextSettings.push(presetToggleSetting)
            }
        }

        return {
            ...merged,
            settings: nextSettings.length > 0 ? nextSettings : undefined,
            entities: [...presetEntities, ...templateEntities],
            elements: Object.keys(mergedElements).length > 0 ? mergedElements : undefined,
            optionValues: Object.keys(mergedEnumerationValues).length > 0 ? mergedEnumerationValues : undefined
        }
    }

    private async buildTemplateBootstrapBundle(
        manifest: MetahubTemplateManifest,
        options?: { schemaName?: string; createOptions?: MetahubCreateOptions }
    ): Promise<TemplateBootstrapBundle> {
        const presetRefs = manifest.presets ?? []
        if (presetRefs.length === 0) {
            return {
                seed: cloneSeed(manifest.seed),
                entityTypePresets: [],
                effectivePresetToggles: {}
            }
        }

        const persistedToggles = options?.schemaName ? await this.readPersistedPresetToggles(options.schemaName) : undefined
        const effectivePresetToggles = MetahubSchemaService.buildEffectivePresetToggles(manifest, options?.createOptions, persistedToggles)

        const enabledPresets = presetRefs.filter((preset) => effectivePresetToggles[preset.presetCodename] !== false)
        const entityTypePresets = await Promise.all(
            enabledPresets.map((preset) => this.loadEntityTypePresetManifest(preset.presetCodename))
        )

        const presetSeed = MetahubSchemaService.buildSeedFromPresetDefaults(entityTypePresets)
        const seed = MetahubSchemaService.mergePresetSeedIntoTemplateSeed(manifest.seed, presetSeed, effectivePresetToggles, true)

        return {
            seed,
            entityTypePresets,
            effectivePresetToggles
        }
    }

    private async syncEntityTypePresets(schemaName: string, presets: EntityTypePresetManifest[]): Promise<number> {
        if (presets.length === 0) {
            return 0
        }

        let synced = 0
        for (const preset of presets) {
            const now = new Date()
            const codename = ensureCodenameValue(preset.entityType.codename ?? preset.codename)
            const presentation = preset.entityType.presentation ?? {}
            const config = preset.entityType.config ?? {}
            const existing = await this.knex
                .withSchema(schemaName)
                .from('_mhb_entity_type_definitions')
                .where({ kind_key: preset.entityType.kindKey, _upl_deleted: false, _mhb_deleted: false })
                .first<{
                    id: string
                    codename: unknown
                    presentation: unknown
                    components: unknown
                    ui_config: unknown
                    config: unknown
                }>()

            const shouldUpdate =
                !existing ||
                JSON.stringify(existing.codename ?? null) !== JSON.stringify(codename) ||
                JSON.stringify(existing.presentation ?? {}) !== JSON.stringify(presentation) ||
                JSON.stringify(existing.components ?? {}) !== JSON.stringify(preset.entityType.components) ||
                JSON.stringify(existing.ui_config ?? {}) !== JSON.stringify(preset.entityType.ui) ||
                JSON.stringify(existing.config ?? {}) !== JSON.stringify(config)

            if (!shouldUpdate) {
                continue
            }

            synced += 1
            if (!existing) {
                await this.knex.withSchema(schemaName).into('_mhb_entity_type_definitions').insert({
                    kind_key: preset.entityType.kindKey,
                    codename,
                    presentation,
                    components: preset.entityType.components,
                    ui_config: preset.entityType.ui,
                    config,
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
                continue
            }

            await this.knex
                .withSchema(schemaName)
                .from('_mhb_entity_type_definitions')
                .where({ id: existing.id })
                .update({
                    codename,
                    presentation,
                    components: preset.entityType.components,
                    ui_config: preset.entityType.ui,
                    config,
                    _mhb_published: true,
                    _upl_updated_at: now,
                    _upl_updated_by: null,
                    _upl_version: this.knex.raw('_upl_version + 1')
                })
        }

        return synced
    }

    /**
     * Initialize system tables in the isolated schema.
     *
     * Delegates DDL creation to structure version registry and
     * seed data population to TemplateSeedExecutor.
     */
    private async initSystemTables(
        schemaName: string,
        manifest: MetahubTemplateManifest,
        createOptions?: MetahubCreateOptions
    ): Promise<void> {
        // 1. Create DDL structure (tables + indexes) using current structure version
        const versionHandler = getStructureVersion(CURRENT_STRUCTURE_VERSION)
        await versionHandler.init(this.knex, schemaName)

        // 2. Resolve preset-backed entity type definitions and the effective template seed.
        const bootstrap = await this.buildTemplateBootstrapBundle(manifest, { schemaName, createOptions })
        await this.syncEntityTypePresets(schemaName, bootstrap.entityTypePresets)

        // 3. Apply seed data, including default instances synthesized from enabled presets.
        const executor = new TemplateSeedExecutor(this.knex, schemaName)
        await executor.apply(bootstrap.seed)

        // 4. Record baseline migration for fresh schemas
        await this.recordBaselineMigration(schemaName, CURRENT_STRUCTURE_VERSION, manifest.version)
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
            log.error(`Structure migration failed for ${schemaName}:`, result.error)
            throw new MetahubSchemaSyncError(`Structure migration V${fromVersion}→V${CURRENT_STRUCTURE_VERSION}`, result.error)
        }

        if (result.applied.length > 0) {
            log.info(`Migrated ${schemaName} V${fromVersion}→V${CURRENT_STRUCTURE_VERSION}: ${result.applied.length} changes applied`)
        }

        if (result.skippedDestructive.length > 0) {
            log.warn(`${result.skippedDestructive.length} destructive changes skipped for ${schemaName}`)
        }
        // 2. Keep seed data in sync after structure migration
        const seedSynced = await this.syncTemplateSeed(schemaName, manifest, CURRENT_STRUCTURE_VERSION, templateVersionInfo)

        // 3. Update branch structure version only after successful structure + seed sync
        await updateBranch(this.exec, branchId, {
            structureVersion: normalizeStoredStructureVersion(CURRENT_STRUCTURE_VERSION)
        })

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
        const hasMigrationTable = await hasRuntimeHistoryTable(this.knex, schemaName, '_mhb_migrations')
        if (!hasMigrationTable) return

        const baselineName = `baseline_structure_v${PUBLIC_BASELINE_STRUCTURE_VERSION}`
        const snapshotAfter = buildSystemStructureSnapshot(structureVersion)

        await this.knex.transaction(async (trx) => {
            const insertResult = await trx
                .withSchema(schemaName)
                .into('_mhb_migrations')
                .insert({
                    name: baselineName,
                    from_version: PUBLIC_BASELINE_STRUCTURE_VERSION,
                    to_version: PUBLIC_BASELINE_STRUCTURE_VERSION,
                    meta: buildBaselineMigrationMeta(snapshotAfter, templateVersionLabel)
                })
                .onConflict('name')
                .ignore()
                .returning('id')

            const localMigrationId = insertResult[0]?.id ?? insertResult[0]
            if (!localMigrationId) {
                return
            }

            const globalRunId = await mirrorToGlobalCatalog({
                knex: trx,
                globalCatalogEnabled: isGlobalMigrationCatalogEnabled(),
                scopeKind: 'runtime_schema',
                scopeKey: schemaName,
                sourceKind: 'system_sync',
                migrationName: baselineName,
                migrationVersion: String(PUBLIC_BASELINE_STRUCTURE_VERSION),
                localHistoryTable: '_mhb_migrations',
                summary: `Metahub baseline structure v${PUBLIC_BASELINE_STRUCTURE_VERSION}`,
                transactionMode: 'single',
                lockMode: 'session_advisory',
                checksumPayload: {
                    schemaName,
                    structureVersion,
                    publicBaselineStructureVersion: PUBLIC_BASELINE_STRUCTURE_VERSION,
                    templateVersionLabel: templateVersionLabel ?? null
                },
                meta: {
                    migrationKind: 'baseline',
                    templateVersionLabel: templateVersionLabel ?? null
                },
                snapshotBefore: null,
                snapshotAfter: snapshotAfter as unknown as Record<string, unknown>,
                plan: {
                    structureVersion,
                    publicBaselineStructureVersion: PUBLIC_BASELINE_STRUCTURE_VERSION
                }
            })

            await trx
                .withSchema(schemaName)
                .into('_mhb_migrations')
                .where({ id: localMigrationId })
                .update({
                    meta: buildBaselineMigrationMeta(snapshotAfter, templateVersionLabel, globalRunId ?? undefined)
                })
        })
    }

    private async syncTemplateSeed(
        schemaName: string,
        manifest: MetahubTemplateManifest,
        structureVersion: number,
        templateVersionInfo?: { templateVersionId?: string | null; templateVersionLabel?: string | null }
    ): Promise<boolean> {
        // Refresh widget table resolver cache to avoid stale table-name mapping after structure renames.
        clearWidgetTableResolverCache()
        const bootstrap = await this.buildTemplateBootstrapBundle(manifest, { schemaName })
        const entityTypesSynced = await this.syncEntityTypePresets(schemaName, bootstrap.entityTypePresets)
        const seedMigrator = new TemplateSeedMigrator(this.knex, schemaName)
        const seedResult = await seedMigrator.migrateSeed(bootstrap.seed)

        const hasChanges =
            entityTypesSynced > 0 ||
            seedResult.layoutsAdded > 0 ||
            seedResult.zoneWidgetsAdded > 0 ||
            seedResult.settingsAdded > 0 ||
            seedResult.entitiesAdded > 0 ||
            seedResult.fixedValuesAdded > 0 ||
            seedResult.attributesAdded > 0 ||
            seedResult.enumValuesAdded > 0 ||
            seedResult.elementsAdded > 0

        if (!hasChanges) return false

        await this.recordTemplateSeedMigration(schemaName, structureVersion, { ...seedResult, entityTypesSynced }, templateVersionInfo)

        log.info(
            `Seed sync for ${schemaName}: ` +
                `+${entityTypesSynced} entity types, +${seedResult.layoutsAdded} layouts, +${seedResult.zoneWidgetsAdded} zoneWidgets, ` +
                `+${seedResult.settingsAdded} settings, +${seedResult.entitiesAdded} entities, ` +
                `+${seedResult.fixedValuesAdded} constants, +${seedResult.attributesAdded} attributes, ` +
                `+${seedResult.enumValuesAdded} enum values, +${seedResult.elementsAdded} elements`
        )
        return true
    }

    private async recordTemplateSeedMigration(
        schemaName: string,
        structureVersion: number,
        seedResult: {
            entityTypesSynced: number
            layoutsAdded: number
            zoneWidgetsAdded: number
            settingsAdded: number
            entitiesAdded: number
            fixedValuesAdded: number
            attributesAdded: number
            enumValuesAdded: number
            elementsAdded: number
            skipped: string[]
        },
        templateVersionInfo?: { templateVersionId?: string | null; templateVersionLabel?: string | null }
    ): Promise<void> {
        const hasMigrationTable = await hasRuntimeHistoryTable(this.knex, schemaName, '_mhb_migrations')
        if (!hasMigrationTable) return

        const name = `template_seed_${Date.now()}_${randomBytes(4).toString('hex')}`
        const counts = {
            entityTypesSynced: seedResult.entityTypesSynced,
            layoutsAdded: seedResult.layoutsAdded,
            zoneWidgetsAdded: seedResult.zoneWidgetsAdded,
            settingsAdded: seedResult.settingsAdded,
            entitiesAdded: seedResult.entitiesAdded,
            fixedValuesAdded: seedResult.fixedValuesAdded,
            attributesAdded: seedResult.attributesAdded,
            enumValuesAdded: seedResult.enumValuesAdded,
            elementsAdded: seedResult.elementsAdded
        }

        await this.knex.transaction(async (trx) => {
            const globalRunId = await mirrorToGlobalCatalog({
                knex: trx,
                globalCatalogEnabled: isGlobalMigrationCatalogEnabled(),
                scopeKind: 'runtime_schema',
                scopeKey: schemaName,
                sourceKind: 'template_seed',
                migrationName: name,
                migrationVersion: String(structureVersion),
                localHistoryTable: '_mhb_migrations',
                summary: `Metahub template seed sync for structure v${structureVersion}`,
                transactionMode: 'single',
                lockMode: 'session_advisory',
                checksumPayload: {
                    schemaName,
                    structureVersion,
                    counts,
                    skipped: seedResult.skipped,
                    templateVersionId: templateVersionInfo?.templateVersionId ?? null,
                    templateVersionLabel: templateVersionInfo?.templateVersionLabel ?? null
                },
                meta: {
                    migrationKind: 'template_seed',
                    templateVersionId: templateVersionInfo?.templateVersionId ?? null,
                    templateVersionLabel: templateVersionInfo?.templateVersionLabel ?? null
                },
                snapshotBefore: null,
                snapshotAfter: null,
                plan: {
                    counts,
                    skipped: seedResult.skipped
                }
            })

            const meta = buildTemplateSeedMigrationMeta({
                counts,
                skipped: seedResult.skipped,
                templateVersionId: templateVersionInfo?.templateVersionId ?? null,
                templateVersionLabel: templateVersionInfo?.templateVersionLabel ?? null,
                globalRunId: globalRunId ?? undefined
            })

            await trx.withSchema(schemaName).into('_mhb_migrations').insert({
                name,
                from_version: structureVersion,
                to_version: structureVersion,
                meta
            })
        })
    }

    private async loadTemplateVersionInfo(
        metahubId: string
    ): Promise<{ templateVersionId: string | null; templateVersionLabel: string | null }> {
        const metahub = await findMetahubById(this.exec, metahubId)
        if (!metahub) {
            throw new MetahubNotFoundError('Metahub', metahubId)
        }
        if (!metahub.templateVersionId) {
            return { templateVersionId: null, templateVersionLabel: null }
        }

        const version = await findTemplateVersionById(this.exec, metahub.templateVersionId)
        return {
            templateVersionId: metahub.templateVersionId,
            templateVersionLabel: version?.versionLabel ?? null
        }
    }

    private async updateBranchTemplateSyncInfo(
        branchId: string,
        templateVersionInfo: { templateVersionId?: string | null; templateVersionLabel?: string | null }
    ): Promise<void> {
        await updateBranch(this.exec, branchId, {
            lastTemplateVersionId: templateVersionInfo.templateVersionId ?? null,
            lastTemplateVersionLabel: templateVersionInfo.templateVersionLabel ?? null,
            lastTemplateSyncedAt: templateVersionInfo.templateVersionId || templateVersionInfo.templateVersionLabel ? new Date() : null
        })
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
        const rows = await this.exec.query<{ table_name: string }>(
            `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = ANY($2)`,
            [schemaName, expectedTables]
        )
        const existingTables = new Set(rows.map((r) => r.table_name))

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
