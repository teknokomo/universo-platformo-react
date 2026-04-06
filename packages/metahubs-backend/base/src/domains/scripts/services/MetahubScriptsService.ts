import { qSchemaTable } from '@universo/database'
import { compileScriptSource } from '@universo/scripting-engine'
import {
    assertSupportedScriptSdkApiVersion,
    DEFAULT_SCRIPT_MODULE_ROLE,
    DEFAULT_SCRIPT_SDK_API_VERSION,
    DEFAULT_SCRIPT_SOURCE_KIND,
    SCRIPT_AUTHORING_SOURCE_KINDS,
    SCRIPT_ATTACHMENT_KINDS,
    type ApplicationScriptDefinition,
    type ScriptCapability,
    type MetahubScriptRecord,
    type ScriptAttachmentKind,
    findDisallowedScriptCapabilities,
    type ScriptManifest,
    type ScriptModuleRole,
    type ScriptPresentation,
    type ScriptSourceKind,
    normalizeScriptCapabilities,
    normalizeScriptModuleRole,
    normalizeScriptSourceKind,
    resolveScriptSdkApiVersion
} from '@universo/types'
import { queryOne, type DbExecutor } from '@universo/utils/database'
import { isValidCodenameForStyle, normalizeCodenameForStyle } from '@universo/utils/validation/codename'
import { incrementVersion } from '../../../utils/optimisticLock'
import { getCodenameText } from '../../shared/codename'
import { MetahubConflictError, MetahubNotFoundError, MetahubValidationError } from '../../shared/domainErrors'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import {
    findStoredMetahubScriptByScope,
    findStoredMetahubScriptById,
    insertStoredMetahubScript,
    listStoredMetahubScripts,
    METAHUB_SCRIPTS_TABLE,
    type StoredMetahubScriptRow
} from './scriptsStore'
import { createCodenameVLC, createLocalizedContent, ensureCodenameVLC } from '@universo/utils'

export interface ListMetahubScriptsOptions {
    attachedToKind?: ScriptAttachmentKind
    attachedToId?: string | null
    onlyActive?: boolean
}

export interface UpsertMetahubScriptInput {
    codename: string
    presentation: ScriptPresentation
    attachedToKind: ScriptAttachmentKind
    attachedToId?: string | null
    moduleRole?: ScriptModuleRole
    sourceKind?: ScriptSourceKind
    sdkApiVersion?: string
    sourceCode: string
    isActive?: boolean
    capabilities?: string[]
    config?: Record<string, unknown>
}

export interface UpdateMetahubScriptInput {
    codename?: string
    presentation?: ScriptPresentation
    attachedToKind?: ScriptAttachmentKind
    attachedToId?: string | null
    moduleRole?: ScriptModuleRole
    sourceKind?: ScriptSourceKind
    sdkApiVersion?: string
    sourceCode?: string
    isActive?: boolean
    capabilities?: string[]
    config?: Record<string, unknown>
}

const ACTIVE_ATTACHMENT_CLAUSE = '_upl_deleted = false AND _mhb_deleted = false'

const normalizeScriptCodename = (value: string): string => {
    const normalized = normalizeCodenameForStyle(value, 'kebab-case', 'en')
    if (!normalized || !isValidCodenameForStyle(normalized, 'kebab-case', 'en')) {
        throw new MetahubValidationError('Script codename must be a valid kebab-case English identifier')
    }
    return normalized
}

const assertSupportedSourceKind = (value: unknown): ScriptSourceKind => {
    const sourceKind = normalizeScriptSourceKind(value)
    if (!SCRIPT_AUTHORING_SOURCE_KINDS.some((kind) => kind === sourceKind)) {
        throw new MetahubValidationError('Only embedded script sources are supported in v1')
    }

    return sourceKind
}

const resolveScriptCapabilities = (moduleRole: ScriptModuleRole, capabilities?: string[]): ScriptCapability[] => {
    const invalidCapabilities = findDisallowedScriptCapabilities(moduleRole, capabilities)
    if (invalidCapabilities.length > 0) {
        throw new MetahubValidationError('Script capabilities are not allowed for the selected module role', {
            moduleRole,
            invalidCapabilities
        })
    }

    return normalizeScriptCapabilities(moduleRole, capabilities)
}

const ensureManifest = (value: unknown): ScriptManifest => {
    if (!value || typeof value !== 'object') {
        return {
            className: 'ExtensionScriptModule',
            sdkApiVersion: DEFAULT_SCRIPT_SDK_API_VERSION,
            moduleRole: DEFAULT_SCRIPT_MODULE_ROLE,
            sourceKind: DEFAULT_SCRIPT_SOURCE_KIND,
            capabilities: [],
            methods: []
        }
    }

    const manifest = value as Partial<ScriptManifest>
    const moduleRole = normalizeScriptModuleRole(manifest.moduleRole)
    const sdkApiVersion = resolveScriptSdkApiVersion({
        sdkApiVersion: DEFAULT_SCRIPT_SDK_API_VERSION,
        manifestSdkApiVersion: manifest.sdkApiVersion
    })
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

const createFallbackScriptPresentation = (): ScriptPresentation => ({
    name: createLocalizedContent('en', '')
})

const normalizeScriptRow = (row: StoredMetahubScriptRow): MetahubScriptRecord => {
    const manifest = ensureManifest(row.manifest)
    const sdkApiVersion = resolveScriptSdkApiVersion({
        sdkApiVersion: row.sdk_api_version,
        manifestSdkApiVersion: manifest.sdkApiVersion
    })

    return {
        id: row.id,
        codename: ensureCodenameVLC(row.codename, 'en') ?? createCodenameVLC('en', ''),
        presentation:
            row.presentation && typeof row.presentation === 'object'
                ? (row.presentation as ScriptPresentation)
                : createFallbackScriptPresentation(),
        attachedToKind: row.attached_to_kind,
        attachedToId: row.attached_to_id,
        moduleRole: row.module_role,
        sourceKind: row.source_kind,
        sdkApiVersion,
        sourceCode: row.source_code,
        manifest: {
            ...manifest,
            sdkApiVersion
        },
        serverBundle: row.server_bundle,
        clientBundle: row.client_bundle,
        checksum: row.checksum,
        isActive: row.is_active,
        config: (row.config ?? {}) as Record<string, unknown>,
        version: Number(row._upl_version ?? 1),
        updatedAt:
            row._upl_updated_at instanceof Date
                ? row._upl_updated_at.toISOString()
                : typeof row._upl_updated_at === 'string'
                ? row._upl_updated_at
                : null
    }
}

const toApplicationScriptDefinition = (script: MetahubScriptRecord): ApplicationScriptDefinition => ({
    id: script.id,
    codename: getCodenameText(script.codename),
    presentation: script.presentation,
    attachedToKind: script.attachedToKind,
    attachedToId: script.attachedToId,
    moduleRole: script.moduleRole,
    sourceKind: script.sourceKind,
    sdkApiVersion: script.sdkApiVersion,
    manifest: script.manifest,
    serverBundle: script.serverBundle,
    clientBundle: script.clientBundle,
    checksum: script.checksum,
    isActive: script.isActive,
    config: script.config
})

export class MetahubScriptsService {
    constructor(private readonly exec: DbExecutor, private readonly schemaService: MetahubSchemaService) {}

    async listScripts(metahubId: string, options: ListMetahubScriptsOptions = {}, userId?: string): Promise<MetahubScriptRecord[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const rows = await listStoredMetahubScripts(this.exec, schemaName, options)
        return rows.map(normalizeScriptRow)
    }

    async listPublishedScripts(metahubId: string, userId?: string): Promise<ApplicationScriptDefinition[]> {
        const scripts = await this.listScripts(metahubId, { onlyActive: true }, userId)
        return scripts.filter((script) => script.isActive).map(toApplicationScriptDefinition)
    }

    async getScriptById(metahubId: string, scriptId: string, userId?: string): Promise<MetahubScriptRecord | null> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const row = await findStoredMetahubScriptById(this.exec, schemaName, scriptId)
        return row ? normalizeScriptRow(row) : null
    }

    async createScript(metahubId: string, input: UpsertMetahubScriptInput, userId?: string): Promise<MetahubScriptRecord> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const codename = normalizeScriptCodename(input.codename)
        const attachment = await this.validateAttachment(schemaName, metahubId, input.attachedToKind, input.attachedToId ?? null)
        const moduleRole = normalizeScriptModuleRole(input.moduleRole ?? DEFAULT_SCRIPT_MODULE_ROLE)
        const sourceKind = assertSupportedSourceKind(input.sourceKind ?? DEFAULT_SCRIPT_SOURCE_KIND)
        const sdkApiVersion = assertSupportedScriptSdkApiVersion(input.sdkApiVersion ?? DEFAULT_SCRIPT_SDK_API_VERSION)
        const capabilities = resolveScriptCapabilities(moduleRole, input.capabilities)
        await this.ensureUniqueCodename(schemaName, {
            codename,
            attachedToKind: input.attachedToKind,
            attachedToId: attachment,
            moduleRole
        })
        const compiled = await this.compileSource({
            codename,
            sourceCode: input.sourceCode,
            sdkApiVersion,
            moduleRole,
            sourceKind,
            capabilities
        })

        const created = await insertStoredMetahubScript(this.exec, schemaName, {
            codename: createCodenameVLC('en', codename),
            presentation: input.presentation,
            attachedToKind: input.attachedToKind,
            attachedToId: attachment,
            moduleRole,
            sourceKind,
            sdkApiVersion,
            sourceCode: input.sourceCode,
            manifest: compiled.manifest,
            serverBundle: compiled.serverBundle,
            clientBundle: compiled.clientBundle,
            checksum: compiled.checksum,
            isActive: input.isActive ?? true,
            config: input.config ?? {},
            userId
        })

        return normalizeScriptRow(created)
    }

    async updateScript(
        metahubId: string,
        scriptId: string,
        input: UpdateMetahubScriptInput,
        userId?: string
    ): Promise<MetahubScriptRecord> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const existing = await findStoredMetahubScriptById(this.exec, schemaName, scriptId)
        if (!existing) {
            throw new MetahubNotFoundError('Script', scriptId)
        }

        const nextCodename = input.codename ? normalizeScriptCodename(input.codename) : getCodenameText(existing.codename)
        const nextAttachmentKind = input.attachedToKind ?? existing.attached_to_kind
        const attachmentInput = input.attachedToKind || Object.prototype.hasOwnProperty.call(input, 'attachedToId')
        const requestedAttachmentId = attachmentInput ? input.attachedToId ?? null : existing.attached_to_id
        const nextAttachmentId = await this.validateAttachment(schemaName, metahubId, nextAttachmentKind, requestedAttachmentId)

        const nextModuleRole = normalizeScriptModuleRole(input.moduleRole ?? existing.module_role)
        await this.ensureUniqueCodename(
            schemaName,
            {
                codename: nextCodename,
                attachedToKind: nextAttachmentKind,
                attachedToId: nextAttachmentId,
                moduleRole: nextModuleRole
            },
            scriptId
        )
        const nextSourceKind = assertSupportedSourceKind(input.sourceKind ?? existing.source_kind)
        const nextSdkApiVersion = assertSupportedScriptSdkApiVersion(input.sdkApiVersion ?? existing.sdk_api_version)
        const nextSourceCode = input.sourceCode ?? existing.source_code
        const existingManifest = ensureManifest(existing.manifest)
        const nextCapabilities =
            input.capabilities !== undefined
                ? resolveScriptCapabilities(nextModuleRole, input.capabilities)
                : existingManifest.capabilities ?? resolveScriptCapabilities(nextModuleRole)

        const needsRecompile =
            input.sourceCode !== undefined ||
            input.moduleRole !== undefined ||
            input.sourceKind !== undefined ||
            input.sdkApiVersion !== undefined ||
            input.capabilities !== undefined

        const compiled = needsRecompile
            ? await this.compileSource({
                  codename: nextCodename,
                  sourceCode: nextSourceCode,
                  sdkApiVersion: nextSdkApiVersion,
                  moduleRole: nextModuleRole,
                  sourceKind: nextSourceKind,
                  capabilities: nextCapabilities
              })
            : null

        const updated = await incrementVersion(this.exec, schemaName, METAHUB_SCRIPTS_TABLE, scriptId, {
            codename: JSON.stringify(createCodenameVLC('en', nextCodename)),
            presentation: JSON.stringify(input.presentation ?? existing.presentation ?? {}),
            attached_to_kind: nextAttachmentKind,
            attached_to_id: nextAttachmentId,
            module_role: nextModuleRole,
            source_kind: nextSourceKind,
            sdk_api_version: nextSdkApiVersion,
            source_code: nextSourceCode,
            manifest: JSON.stringify(compiled?.manifest ?? existing.manifest ?? {}),
            server_bundle: compiled?.serverBundle ?? existing.server_bundle,
            client_bundle: compiled?.clientBundle ?? existing.client_bundle,
            checksum: compiled?.checksum ?? existing.checksum,
            is_active: input.isActive ?? existing.is_active,
            config: JSON.stringify(input.config ?? ((existing.config ?? {}) as Record<string, unknown>)),
            _upl_updated_at: new Date(),
            _upl_updated_by: userId ?? null,
            _mhb_deleted: false,
            _mhb_deleted_at: null,
            _mhb_deleted_by: null,
            _upl_deleted: false,
            _upl_deleted_at: null,
            _upl_deleted_by: null
        })

        return normalizeScriptRow(updated as unknown as StoredMetahubScriptRow)
    }

    async deleteScript(metahubId: string, scriptId: string, userId?: string): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const existing = await findStoredMetahubScriptById(this.exec, schemaName, scriptId)
        if (!existing) {
            throw new MetahubNotFoundError('Script', scriptId)
        }

        await incrementVersion(this.exec, schemaName, METAHUB_SCRIPTS_TABLE, scriptId, {
            _mhb_deleted: true,
            _mhb_deleted_at: new Date(),
            _mhb_deleted_by: userId ?? null,
            _upl_updated_at: new Date(),
            _upl_updated_by: userId ?? null
        })
    }

    private async ensureUniqueCodename(
        schemaName: string,
        scope: {
            codename: string
            attachedToKind: ScriptAttachmentKind
            attachedToId: string | null
            moduleRole: ScriptModuleRole
        },
        excludeId?: string
    ): Promise<void> {
        const existing = await findStoredMetahubScriptByScope(this.exec, schemaName, scope)
        if (existing && existing.id !== excludeId) {
            throw new MetahubConflictError('Script codename already exists in this attachment scope', scope)
        }
    }

    private async validateAttachment(
        schemaName: string,
        metahubId: string,
        attachedToKind: ScriptAttachmentKind,
        attachedToId: string | null
    ): Promise<string | null> {
        if (!SCRIPT_ATTACHMENT_KINDS.includes(attachedToKind)) {
            throw new MetahubValidationError('Unsupported script attachment kind')
        }

        if (attachedToKind === 'metahub') {
            if (attachedToId && attachedToId !== metahubId) {
                throw new MetahubValidationError('Metahub-level scripts cannot target a different metahub id')
            }
            return null
        }

        if (!attachedToId) {
            throw new MetahubValidationError('attachedToId is required for non-metahub scripts')
        }

        let row: { id: string } | null = null

        if (attachedToKind === 'hub') {
            row = await queryOne<{ id: string }>(
                this.exec,
                `SELECT id FROM ${qSchemaTable(schemaName, '_mhb_hubs')}
                 WHERE id = $1 AND ${ACTIVE_ATTACHMENT_CLAUSE}
                 LIMIT 1`,
                [attachedToId]
            )
        } else if (attachedToKind === 'attribute') {
            row = await queryOne<{ id: string }>(
                this.exec,
                `SELECT id FROM ${qSchemaTable(schemaName, '_mhb_attributes')}
                 WHERE id = $1 AND ${ACTIVE_ATTACHMENT_CLAUSE}
                 LIMIT 1`,
                [attachedToId]
            )
        } else {
            row = await queryOne<{ id: string }>(
                this.exec,
                `SELECT id FROM ${qSchemaTable(schemaName, '_mhb_objects')}
                 WHERE id = $1 AND kind = $2 AND ${ACTIVE_ATTACHMENT_CLAUSE}
                 LIMIT 1`,
                [attachedToId, attachedToKind]
            )
        }

        if (!row) {
            throw new MetahubValidationError('Script attachment target was not found', {
                attachedToKind,
                attachedToId
            })
        }

        return attachedToId
    }

    private async compileSource(input: {
        codename: string
        sourceCode: string
        sdkApiVersion?: string
        moduleRole?: ScriptModuleRole
        sourceKind?: ScriptSourceKind
        capabilities?: ScriptCapability[]
    }) {
        try {
            return await compileScriptSource(input)
        } catch (error) {
            throw new MetahubValidationError('Script compilation failed', {
                message: error instanceof Error ? error.message : String(error)
            })
        }
    }
}
