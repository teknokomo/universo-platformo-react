import stableStringify from 'json-stable-stringify'
import { qSchemaTable, qTable } from '@universo-react/database'
import {
    assertSupportedModuleSdkApiVersion,
    DEFAULT_MODULE_ROLE,
    DEFAULT_MODULE_SOURCE_KIND,
    normalizeModuleCapabilities,
    normalizeModulePackageImports,
    normalizeModuleRole,
    normalizeModuleSourceKind,
    resolveModuleSdkApiVersion,
    type ApplicationModuleDefinition,
    type ModuleAttachmentKind,
    type ModuleManifest,
    type ModuleRole,
    type ModuleSourceKind
} from '@universo-react/types'
import { createLocalizedContent, getCodenamePrimary } from '@universo-react/utils'
import type { PublishedApplicationSnapshot, SnapshotModuleDefinition } from '../../services/applicationSyncContracts'
import { type ApplicationSyncTransaction, getApplicationSyncDdlServices, getApplicationSyncKnex } from '../../ddl'

type PersistedAppModuleRowDb = {
    id: string
    codename: string
    presentation?: unknown
    attached_to_kind: ModuleAttachmentKind
    attached_to_id?: string | null
    module_role: ModuleRole
    source_kind: ModuleSourceKind
    sdk_api_version: string
    manifest?: unknown
    server_bundle?: string | null
    client_bundle?: string | null
    checksum: string
    is_active: boolean
    config?: unknown
}

const APP_MODULE_SCOPE_NULL_ATTACHMENT_UUID = '00000000-0000-0000-0000-000000000000'
const APP_MODULES_SCOPE_INDEX_NAME = 'idx_app_modules_codename_active'

const normalizeIndexDefinition = (indexDef: string): string => indexDef.toLowerCase().replace(/"/g, '').replace(/\s+/g, ' ').trim()

const hasRequiredScopedAppModuleIndexShape = (indexDef: string): boolean => {
    const normalized = normalizeIndexDefinition(indexDef)

    return (
        normalized.includes('attached_to_kind') &&
        normalized.includes(`coalesce(attached_to_id, '${APP_MODULE_SCOPE_NULL_ATTACHMENT_UUID}'::uuid)`) &&
        normalized.includes('module_role') &&
        normalized.includes('codename') &&
        normalized.includes('_upl_deleted = false') &&
        normalized.includes('_app_deleted = false')
    )
}

const buildModuleSortKey = (module: ApplicationModuleDefinition): string =>
    `${module.attachedToKind}:${module.attachedToId ?? ''}:${module.moduleRole}:${module.codename}:${module.id}`

const buildScopedAppModuleIndexSql = (schemaName: string): string => `
    CREATE UNIQUE INDEX IF NOT EXISTS ${qTable(APP_MODULES_SCOPE_INDEX_NAME)}
    ON ${qSchemaTable(schemaName, '_app_modules')} (
        attached_to_kind,
        COALESCE(attached_to_id, '${APP_MODULE_SCOPE_NULL_ATTACHMENT_UUID}'::uuid),
        module_role,
        codename
    )
    WHERE _upl_deleted = false AND _app_deleted = false
`

const ensureScopedAppModuleCodenameIndex = async (executor: ApplicationSyncTransaction, schemaName: string): Promise<void> => {
    const indexLookup = await executor.raw<{ rows?: Array<{ indexdef?: string }> }>(
        `
          SELECT indexdef
          FROM pg_indexes
          WHERE schemaname = ?
            AND tablename = '_app_modules'
            AND indexname = ?
          LIMIT 1
        `,
        [schemaName, APP_MODULES_SCOPE_INDEX_NAME]
    )

    const indexDef = indexLookup.rows?.[0]?.indexdef ?? ''
    if (hasRequiredScopedAppModuleIndexShape(indexDef)) {
        return
    }

    await executor.raw(`DROP INDEX IF EXISTS ${qSchemaTable(schemaName, APP_MODULES_SCOPE_INDEX_NAME)}`)
    await executor.raw(buildScopedAppModuleIndexSql(schemaName))
}

const createFallbackModulePresentation = (): ApplicationModuleDefinition['presentation'] => ({
    name: createLocalizedContent('en', '')
})

const normalizeManifest = (value: unknown): ModuleManifest => {
    if (!value || typeof value !== 'object') {
        return {
            className: 'ExtensionModuleModule',
            sdkApiVersion: '1.0.0',
            moduleRole: DEFAULT_MODULE_ROLE,
            sourceKind: DEFAULT_MODULE_SOURCE_KIND,
            capabilities: [],
            methods: []
        }
    }

    const manifest = value as Partial<ModuleManifest>
    const moduleRole = normalizeModuleRole(manifest.moduleRole ?? DEFAULT_MODULE_ROLE)
    const sdkApiVersion = assertSupportedModuleSdkApiVersion(manifest.sdkApiVersion)
    return {
        className: typeof manifest.className === 'string' ? manifest.className : 'ExtensionModuleModule',
        sdkApiVersion,
        moduleRole,
        sourceKind: normalizeModuleSourceKind(manifest.sourceKind ?? DEFAULT_MODULE_SOURCE_KIND),
        capabilities: normalizeModuleCapabilities(moduleRole, manifest.capabilities),
        methods: Array.isArray(manifest.methods) ? manifest.methods : [],
        packageImports: normalizeModulePackageImports(manifest.packageImports),
        checksum: typeof manifest.checksum === 'string' ? manifest.checksum : undefined
    }
}

const resolveSnapshotModuleCodename = (codename: SnapshotModuleDefinition['codename']): string => {
    const text = getCodenamePrimary(codename).trim()
    if (text.length === 0) {
        throw new Error('[SchemaSync] Invalid runtime module codename in snapshot')
    }

    return text
}

const normalizeSnapshotModules = (snapshot: PublishedApplicationSnapshot): ApplicationModuleDefinition[] => {
    const rawModules = Array.isArray(snapshot.modules) ? snapshot.modules : []

    return rawModules
        .filter((module): module is SnapshotModuleDefinition =>
            Boolean(module && typeof module === 'object' && typeof module.id === 'string')
        )
        .map((module) => {
            const manifest = normalizeManifest(module.manifest)
            const sdkApiVersion = resolveModuleSdkApiVersion({
                sdkApiVersion: module.sdkApiVersion,
                manifestSdkApiVersion: manifest.sdkApiVersion
            })

            return {
                ...module,
                codename: resolveSnapshotModuleCodename(module.codename),
                attachedToId: module.attachedToId ?? null,
                moduleRole: module.moduleRole ?? DEFAULT_MODULE_ROLE,
                sourceKind: module.sourceKind ?? DEFAULT_MODULE_SOURCE_KIND,
                sdkApiVersion,
                manifest: {
                    ...manifest,
                    sdkApiVersion
                },
                serverBundle: module.serverBundle ?? null,
                clientBundle: module.clientBundle ?? null,
                checksum: String(module.checksum ?? ''),
                isActive: module.isActive !== false,
                config: (module.config ?? {}) as Record<string, unknown>
            }
        })
        .sort((left, right) => buildModuleSortKey(left).localeCompare(buildModuleSortKey(right)))
}

const normalizePersistedModules = (rows: PersistedAppModuleRowDb[]): ApplicationModuleDefinition[] => {
    return rows
        .map((row) => {
            const manifest = normalizeManifest(row.manifest)
            const sdkApiVersion = resolveModuleSdkApiVersion({
                sdkApiVersion: row.sdk_api_version,
                manifestSdkApiVersion: manifest.sdkApiVersion
            })

            return {
                id: row.id,
                codename: row.codename,
                presentation:
                    row.presentation && typeof row.presentation === 'object'
                        ? (row.presentation as ApplicationModuleDefinition['presentation'])
                        : createFallbackModulePresentation(),
                attachedToKind: row.attached_to_kind,
                attachedToId: row.attached_to_id ?? null,
                moduleRole: row.module_role,
                sourceKind: row.source_kind,
                sdkApiVersion,
                manifest: {
                    ...manifest,
                    sdkApiVersion
                },
                serverBundle: row.server_bundle ?? null,
                clientBundle: row.client_bundle ?? null,
                checksum: row.checksum,
                isActive: row.is_active,
                config: row.config && typeof row.config === 'object' ? (row.config as Record<string, unknown>) : {}
            }
        })
        .sort((left, right) => buildModuleSortKey(left).localeCompare(buildModuleSortKey(right)))
}

const assertUniqueSnapshotModules = (modules: ApplicationModuleDefinition[]): void => {
    const ids = new Set<string>()
    const scopes = new Set<string>()

    for (const module of modules) {
        if (ids.has(module.id)) {
            throw new Error(`[SchemaSync] Duplicate runtime module id in snapshot: ${module.id}`)
        }
        ids.add(module.id)

        const scopeKey = [
            module.attachedToKind,
            module.attachedToId ?? APP_MODULE_SCOPE_NULL_ATTACHMENT_UUID,
            module.moduleRole,
            module.codename
        ].join(':')
        if (scopes.has(scopeKey)) {
            throw new Error(`[SchemaSync] Duplicate runtime module scope in snapshot: ${module.codename}`)
        }
        scopes.add(scopeKey)
    }
}

export async function persistPublishedModules(options: {
    schemaName: string
    snapshot: PublishedApplicationSnapshot
    userId?: string | null
    trx?: ApplicationSyncTransaction
}): Promise<void> {
    const { schemaName, snapshot, userId, trx } = options
    const knex = getApplicationSyncKnex()
    const executor = trx ?? knex
    const nextRows = normalizeSnapshotModules(snapshot)
    assertUniqueSnapshotModules(nextRows)

    const { generator } = getApplicationSyncDdlServices()
    await generator.ensureSystemTables(schemaName, trx)

    const hasModules = await executor.schema.withSchema(schemaName).hasTable('_app_modules')
    if (!hasModules) {
        throw new Error('Runtime modules table is unavailable after system table bootstrap')
    }

    const now = new Date()

    const applyPersist = async (activeTrx: ApplicationSyncTransaction) => {
        await ensureScopedAppModuleCodenameIndex(activeTrx, schemaName)

        const existingRows = (await activeTrx
            .withSchema(schemaName)
            .from('_app_modules')
            .where({ _upl_deleted: false, _app_deleted: false })
            .select(['id'])) as Array<{ id: string }>
        const existingIds = new Set(existingRows.map((row) => String(row.id)))

        for (const module of nextRows) {
            const payload = {
                codename: module.codename,
                presentation: module.presentation,
                attached_to_kind: module.attachedToKind,
                attached_to_id: module.attachedToId,
                module_role: module.moduleRole,
                source_kind: module.sourceKind,
                sdk_api_version: module.sdkApiVersion,
                manifest: module.manifest,
                server_bundle: module.serverBundle,
                client_bundle: module.clientBundle,
                checksum: module.checksum,
                is_active: module.isActive,
                config: module.config ?? {}
            }

            if (existingIds.has(module.id)) {
                await activeTrx
                    .withSchema(schemaName)
                    .from('_app_modules')
                    .where({ id: module.id, _upl_deleted: false, _app_deleted: false })
                    .update({
                        ...payload,
                        _upl_updated_at: now,
                        _upl_updated_by: userId ?? null,
                        _upl_version: activeTrx.raw('_upl_version + 1')
                    })
            } else {
                await activeTrx
                    .withSchema(schemaName)
                    .into('_app_modules')
                    .insert({
                        id: module.id,
                        ...payload,
                        _upl_created_at: now,
                        _upl_created_by: userId ?? null,
                        _upl_updated_at: now,
                        _upl_updated_by: userId ?? null,
                        _upl_version: 1,
                        _upl_archived: false,
                        _upl_deleted: false,
                        _upl_locked: false,
                        _app_published: true,
                        _app_archived: false,
                        _app_deleted: false
                    })
            }
        }

        const nextIds = nextRows.map((row) => row.id)
        if (nextIds.length > 0) {
            await activeTrx
                .withSchema(schemaName)
                .from('_app_modules')
                .where({ _upl_deleted: false, _app_deleted: false })
                .whereNotIn('id', nextIds)
                .del()
        } else {
            await activeTrx.withSchema(schemaName).from('_app_modules').where({ _upl_deleted: false, _app_deleted: false }).del()
        }
    }

    if (trx) {
        await applyPersist(trx)
    } else {
        await knex.transaction(applyPersist)
    }
}

export async function hasPublishedModulesChanges(options: {
    schemaName: string
    snapshot: PublishedApplicationSnapshot
}): Promise<boolean> {
    const { schemaName, snapshot } = options
    const knex = getApplicationSyncKnex()
    const hasModules = await knex.schema.withSchema(schemaName).hasTable('_app_modules')
    const nextRows = normalizeSnapshotModules(snapshot)
    if (!hasModules) {
        return nextRows.length > 0
    }

    const persistedRows = (await knex
        .withSchema(schemaName)
        .from('_app_modules')
        .where({ _upl_deleted: false, _app_deleted: false })
        .select([
            'id',
            'codename',
            'presentation',
            'attached_to_kind',
            'attached_to_id',
            'module_role',
            'source_kind',
            'sdk_api_version',
            'manifest',
            'server_bundle',
            'client_bundle',
            'checksum',
            'is_active',
            'config'
        ])) as PersistedAppModuleRowDb[]

    return stableStringify(normalizePersistedModules(persistedRows)) !== stableStringify(nextRows)
}
