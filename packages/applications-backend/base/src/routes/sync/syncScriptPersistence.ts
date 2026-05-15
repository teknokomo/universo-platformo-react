import stableStringify from 'json-stable-stringify'
import { qSchemaTable, qTable } from '@universo/database'
import {
    assertSupportedScriptSdkApiVersion,
    DEFAULT_SCRIPT_MODULE_ROLE,
    DEFAULT_SCRIPT_SOURCE_KIND,
    normalizeScriptCapabilities,
    normalizeScriptModuleRole,
    normalizeScriptSourceKind,
    resolveScriptSdkApiVersion,
    type ApplicationScriptDefinition,
    type ScriptAttachmentKind,
    type ScriptManifest,
    type ScriptModuleRole,
    type ScriptSourceKind
} from '@universo/types'
import { createLocalizedContent, getCodenamePrimary } from '@universo/utils'
import type { PublishedApplicationSnapshot, SnapshotScriptDefinition } from '../../services/applicationSyncContracts'
import { type ApplicationSyncTransaction, getApplicationSyncDdlServices, getApplicationSyncKnex } from '../../ddl'

type PersistedAppScriptRowDb = {
    id: string
    codename: string
    presentation?: unknown
    attached_to_kind: ScriptAttachmentKind
    attached_to_id?: string | null
    module_role: ScriptModuleRole
    source_kind: ScriptSourceKind
    sdk_api_version: string
    manifest?: unknown
    server_bundle?: string | null
    client_bundle?: string | null
    checksum: string
    is_active: boolean
    config?: unknown
}

const APP_SCRIPT_SCOPE_NULL_ATTACHMENT_UUID = '00000000-0000-0000-0000-000000000000'
const APP_SCRIPTS_SCOPE_INDEX_NAME = 'idx_app_scripts_codename_active'

const normalizeIndexDefinition = (indexDef: string): string => indexDef.toLowerCase().replace(/"/g, '').replace(/\s+/g, ' ').trim()

const hasRequiredScopedAppScriptIndexShape = (indexDef: string): boolean => {
    const normalized = normalizeIndexDefinition(indexDef)

    return (
        normalized.includes('attached_to_kind') &&
        normalized.includes(`coalesce(attached_to_id, '${APP_SCRIPT_SCOPE_NULL_ATTACHMENT_UUID}'::uuid)`) &&
        normalized.includes('module_role') &&
        normalized.includes('codename') &&
        normalized.includes('_upl_deleted = false') &&
        normalized.includes('_app_deleted = false')
    )
}

const buildScriptSortKey = (script: ApplicationScriptDefinition): string =>
    `${script.attachedToKind}:${script.attachedToId ?? ''}:${script.moduleRole}:${script.codename}:${script.id}`

const buildScopedAppScriptIndexSql = (schemaName: string): string => `
    CREATE UNIQUE INDEX IF NOT EXISTS ${qTable(APP_SCRIPTS_SCOPE_INDEX_NAME)}
    ON ${qSchemaTable(schemaName, '_app_scripts')} (
        attached_to_kind,
        COALESCE(attached_to_id, '${APP_SCRIPT_SCOPE_NULL_ATTACHMENT_UUID}'::uuid),
        module_role,
        codename
    )
    WHERE _upl_deleted = false AND _app_deleted = false
`

const ensureScopedAppScriptCodenameIndex = async (executor: ApplicationSyncTransaction, schemaName: string): Promise<void> => {
    const indexLookup = await executor.raw<{ rows?: Array<{ indexdef?: string }> }>(
        `
          SELECT indexdef
          FROM pg_indexes
          WHERE schemaname = ?
            AND tablename = '_app_scripts'
            AND indexname = ?
          LIMIT 1
        `,
        [schemaName, APP_SCRIPTS_SCOPE_INDEX_NAME]
    )

    const indexDef = indexLookup.rows?.[0]?.indexdef ?? ''
    if (hasRequiredScopedAppScriptIndexShape(indexDef)) {
        return
    }

    await executor.raw(`DROP INDEX IF EXISTS ${qSchemaTable(schemaName, APP_SCRIPTS_SCOPE_INDEX_NAME)}`)
    await executor.raw(buildScopedAppScriptIndexSql(schemaName))
}

const createFallbackScriptPresentation = (): ApplicationScriptDefinition['presentation'] => ({
    name: createLocalizedContent('en', '')
})

const normalizeManifest = (value: unknown): ScriptManifest => {
    if (!value || typeof value !== 'object') {
        return {
            className: 'ExtensionScriptModule',
            sdkApiVersion: '1.0.0',
            moduleRole: DEFAULT_SCRIPT_MODULE_ROLE,
            sourceKind: DEFAULT_SCRIPT_SOURCE_KIND,
            capabilities: [],
            methods: []
        }
    }

    const manifest = value as Partial<ScriptManifest>
    const moduleRole = normalizeScriptModuleRole(manifest.moduleRole ?? DEFAULT_SCRIPT_MODULE_ROLE)
    const sdkApiVersion = assertSupportedScriptSdkApiVersion(manifest.sdkApiVersion)
    return {
        className: typeof manifest.className === 'string' ? manifest.className : 'ExtensionScriptModule',
        sdkApiVersion,
        moduleRole,
        sourceKind: normalizeScriptSourceKind(manifest.sourceKind ?? DEFAULT_SCRIPT_SOURCE_KIND),
        capabilities: normalizeScriptCapabilities(moduleRole, manifest.capabilities),
        methods: Array.isArray(manifest.methods) ? manifest.methods : [],
        checksum: typeof manifest.checksum === 'string' ? manifest.checksum : undefined
    }
}

const resolveSnapshotScriptCodename = (codename: SnapshotScriptDefinition['codename']): string => {
    const text = getCodenamePrimary(codename).trim()
    if (text.length === 0) {
        throw new Error('[SchemaSync] Invalid runtime script codename in snapshot')
    }

    return text
}

const normalizeSnapshotScripts = (snapshot: PublishedApplicationSnapshot): ApplicationScriptDefinition[] => {
    const rawScripts = Array.isArray(snapshot.scripts) ? snapshot.scripts : []

    return rawScripts
        .filter((script): script is SnapshotScriptDefinition =>
            Boolean(script && typeof script === 'object' && typeof script.id === 'string')
        )
        .map((script) => {
            const manifest = normalizeManifest(script.manifest)
            const sdkApiVersion = resolveScriptSdkApiVersion({
                sdkApiVersion: script.sdkApiVersion,
                manifestSdkApiVersion: manifest.sdkApiVersion
            })

            return {
                ...script,
                codename: resolveSnapshotScriptCodename(script.codename),
                attachedToId: script.attachedToId ?? null,
                moduleRole: script.moduleRole ?? DEFAULT_SCRIPT_MODULE_ROLE,
                sourceKind: script.sourceKind ?? DEFAULT_SCRIPT_SOURCE_KIND,
                sdkApiVersion,
                manifest: {
                    ...manifest,
                    sdkApiVersion
                },
                serverBundle: script.serverBundle ?? null,
                clientBundle: script.clientBundle ?? null,
                checksum: String(script.checksum ?? ''),
                isActive: script.isActive !== false,
                config: (script.config ?? {}) as Record<string, unknown>
            }
        })
        .sort((left, right) => buildScriptSortKey(left).localeCompare(buildScriptSortKey(right)))
}

const normalizePersistedScripts = (rows: PersistedAppScriptRowDb[]): ApplicationScriptDefinition[] => {
    return rows
        .map((row) => {
            const manifest = normalizeManifest(row.manifest)
            const sdkApiVersion = resolveScriptSdkApiVersion({
                sdkApiVersion: row.sdk_api_version,
                manifestSdkApiVersion: manifest.sdkApiVersion
            })

            return {
                id: row.id,
                codename: row.codename,
                presentation:
                    row.presentation && typeof row.presentation === 'object'
                        ? (row.presentation as ApplicationScriptDefinition['presentation'])
                        : createFallbackScriptPresentation(),
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
        .sort((left, right) => buildScriptSortKey(left).localeCompare(buildScriptSortKey(right)))
}

export async function persistPublishedScripts(options: {
    schemaName: string
    snapshot: PublishedApplicationSnapshot
    userId?: string | null
    trx?: ApplicationSyncTransaction
}): Promise<void> {
    const { schemaName, snapshot, userId, trx } = options
    const knex = getApplicationSyncKnex()
    const executor = trx ?? knex
    const nextRows = normalizeSnapshotScripts(snapshot)

    const { generator } = getApplicationSyncDdlServices()
    await generator.ensureSystemTables(schemaName, trx)

    const hasScripts = await executor.schema.withSchema(schemaName).hasTable('_app_scripts')
    if (!hasScripts) {
        throw new Error('Runtime scripts table is unavailable after system table bootstrap')
    }

    const now = new Date()

    const applyPersist = async (activeTrx: ApplicationSyncTransaction) => {
        await ensureScopedAppScriptCodenameIndex(activeTrx, schemaName)

        const existingRows = (await activeTrx
            .withSchema(schemaName)
            .from('_app_scripts')
            .where({ _upl_deleted: false, _app_deleted: false })
            .select(['id'])) as Array<{ id: string }>
        const existingIds = new Set(existingRows.map((row) => String(row.id)))

        for (const script of nextRows) {
            const payload = {
                codename: script.codename,
                presentation: script.presentation,
                attached_to_kind: script.attachedToKind,
                attached_to_id: script.attachedToId,
                module_role: script.moduleRole,
                source_kind: script.sourceKind,
                sdk_api_version: script.sdkApiVersion,
                manifest: script.manifest,
                server_bundle: script.serverBundle,
                client_bundle: script.clientBundle,
                checksum: script.checksum,
                is_active: script.isActive,
                config: script.config ?? {}
            }

            if (existingIds.has(script.id)) {
                await activeTrx
                    .withSchema(schemaName)
                    .from('_app_scripts')
                    .where({ id: script.id, _upl_deleted: false, _app_deleted: false })
                    .update({
                        ...payload,
                        _upl_updated_at: now,
                        _upl_updated_by: userId ?? null,
                        _upl_version: activeTrx.raw('_upl_version + 1')
                    })
            } else {
                await activeTrx
                    .withSchema(schemaName)
                    .into('_app_scripts')
                    .insert({
                        id: script.id,
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
                .from('_app_scripts')
                .where({ _upl_deleted: false, _app_deleted: false })
                .whereNotIn('id', nextIds)
                .del()
        } else {
            await activeTrx.withSchema(schemaName).from('_app_scripts').where({ _upl_deleted: false, _app_deleted: false }).del()
        }
    }

    if (trx) {
        await applyPersist(trx)
    } else {
        await knex.transaction(applyPersist)
    }
}

export async function hasPublishedScriptsChanges(options: {
    schemaName: string
    snapshot: PublishedApplicationSnapshot
}): Promise<boolean> {
    const { schemaName, snapshot } = options
    const knex = getApplicationSyncKnex()
    const hasScripts = await knex.schema.withSchema(schemaName).hasTable('_app_scripts')
    const nextRows = normalizeSnapshotScripts(snapshot)
    if (!hasScripts) {
        return nextRows.length > 0
    }

    const persistedRows = (await knex
        .withSchema(schemaName)
        .from('_app_scripts')
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
        ])) as PersistedAppScriptRowDb[]

    return stableStringify(normalizePersistedScripts(persistedRows)) !== stableStringify(nextRows)
}
