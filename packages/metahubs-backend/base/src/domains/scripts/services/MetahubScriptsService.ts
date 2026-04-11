import { qSchemaTable } from '@universo/database'
import { compileScriptSource, extractSharedScriptImports } from '@universo/scripting-engine'
import {
    assertSupportedScriptSdkApiVersion,
    DEFAULT_SCRIPT_MODULE_ROLE,
    DEFAULT_SCRIPT_SDK_API_VERSION,
    DEFAULT_SCRIPT_SOURCE_KIND,
    SCRIPT_AUTHORING_SOURCE_KINDS,
    type ScriptCapability,
    type MetahubScriptRecord,
    type ScriptAttachmentKind,
    type ScriptCompilationLibraryInput,
    findDisallowedScriptCapabilities,
    type ScriptManifest,
    type ScriptModuleRole,
    type ScriptPresentation,
    type ScriptSourceKind,
    isLegacyCompatibleObjectKind,
    isScriptAttachmentKind,
    normalizeScriptCapabilities,
    normalizeScriptModuleRole,
    normalizeScriptSourceKind,
    resolveScriptSdkApiVersion
} from '@universo/types'
import { queryOne, type DbExecutor, type SqlQueryable } from '@universo/utils/database'
import { isValidCodenameForStyle, normalizeCodenameForStyle } from '@universo/utils/validation/codename'
import { incrementVersion } from '../../../utils/optimisticLock'
import { getCodenameText } from '../../shared/codename'
import { MetahubConflictError, MetahubNotFoundError, MetahubValidationError } from '../../shared/domainErrors'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { EntityTypeService } from '../../entities/services/EntityTypeService'
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
const LEGACY_GLOBAL_SCRIPT_ROLE = 'global'
const CATALOG_COMPATIBLE_KIND_KEY = 'custom.catalog-v2'

const isGeneralAttachmentScope = (attachedToKind: ScriptAttachmentKind, attachedToId: string | null): boolean =>
    attachedToKind === 'general' && attachedToId === null

const isLibraryModuleRole = (moduleRole: ScriptModuleRole | string | undefined): boolean =>
    normalizeScriptModuleRole(moduleRole) === 'library'

const isOutOfScopeLibrary = (
    attachedToKind: ScriptAttachmentKind,
    attachedToId: string | null,
    moduleRole: ScriptModuleRole | string | undefined
): boolean => isLibraryModuleRole(moduleRole) && !isGeneralAttachmentScope(attachedToKind, attachedToId)

const assertScopeModuleRoleCompatibility = (
    attachedToKind: ScriptAttachmentKind,
    attachedToId: string | null,
    moduleRole: ScriptModuleRole,
    options: {
        allowOutOfScopeLibrary?: boolean
    } = {}
): void => {
    if (isGeneralAttachmentScope(attachedToKind, attachedToId) && moduleRole !== 'library') {
        throw new MetahubValidationError('General scripts must use the library module role', {
            attachedToKind,
            attachedToId,
            moduleRole
        })
    }

    if (isOutOfScopeLibrary(attachedToKind, attachedToId, moduleRole) && !options.allowOutOfScopeLibrary) {
        throw new MetahubValidationError('Library scripts must use the general attachment scope', {
            attachedToKind,
            attachedToId,
            moduleRole
        })
    }
}

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
    const moduleRole = normalizeScriptModuleRole(row.module_role)

    return {
        id: row.id,
        codename: ensureCodenameVLC(row.codename, 'en') ?? createCodenameVLC('en', ''),
        presentation:
            row.presentation && typeof row.presentation === 'object'
                ? (row.presentation as ScriptPresentation)
                : createFallbackScriptPresentation(),
        attachedToKind: row.attached_to_kind,
        attachedToId: row.attached_to_id,
        moduleRole,
        sourceKind: row.source_kind,
        sdkApiVersion,
        sourceCode: row.source_code,
        manifest: {
            ...manifest,
            sdkApiVersion,
            moduleRole
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

const isSharedLibraryScope = (
    attachedToKind: ScriptAttachmentKind,
    attachedToId: string | null,
    moduleRole: ScriptModuleRole | string | undefined
): boolean => isGeneralAttachmentScope(attachedToKind, attachedToId) && isLibraryModuleRole(moduleRole)

const isLegacyGlobalScript = (row: Pick<StoredMetahubScriptRow, 'module_role'>): boolean =>
    String(row.module_role) === LEGACY_GLOBAL_SCRIPT_ROLE

const isCatalogCompatibleEntityType = (entityType: { kindKey: string; config?: Record<string, unknown> | null }): boolean =>
    entityType.kindKey === CATALOG_COMPATIBLE_KIND_KEY || isLegacyCompatibleObjectKind(entityType.config, 'catalog')

const toSharedLibraryDependency = (script: MetahubScriptRecord) => ({
    id: script.id,
    codename: getCodenameText(script.codename),
    attachedToKind: script.attachedToKind,
    attachedToId: script.attachedToId,
    moduleRole: script.moduleRole
})

type PublishedScriptEntry = {
    row: StoredMetahubScriptRow
    script: MetahubScriptRecord
}

const buildPublishedScriptSortKey = (script: MetahubScriptRecord): string =>
    `${script.attachedToKind}:${script.attachedToId ?? ''}:${script.moduleRole}:${getCodenameText(script.codename)}:${script.id}`

const sortPublishedScriptEntries = (entries: PublishedScriptEntry[]): PublishedScriptEntry[] =>
    [...entries].sort((left, right) => buildPublishedScriptSortKey(left.script).localeCompare(buildPublishedScriptSortKey(right.script)))

const buildSharedLibraryCompilationMap = (entries: PublishedScriptEntry[]): Record<string, ScriptCompilationLibraryInput> => {
    const libraries: Record<string, ScriptCompilationLibraryInput> = {}

    for (const { script } of entries) {
        if (!isSharedLibraryScope(script.attachedToKind, script.attachedToId, script.moduleRole)) {
            continue
        }

        const codename = getCodenameText(script.codename)
        libraries[codename] = {
            codename,
            sourceCode: script.sourceCode
        }
    }

    return libraries
}

const resolveSharedLibraryPublicationOrder = (entries: PublishedScriptEntry[]): PublishedScriptEntry[] => {
    const libraryEntries = entries.filter(({ script }) =>
        isSharedLibraryScope(script.attachedToKind, script.attachedToId, script.moduleRole)
    )
    const libraryEntryByCodename = new Map(libraryEntries.map((entry) => [getCodenameText(entry.script.codename), entry]))
    const visited = new Set<string>()
    const visiting: string[] = []
    const ordered: PublishedScriptEntry[] = []

    const visit = (codename: string): void => {
        if (visited.has(codename)) {
            return
        }

        const cycleStartIndex = visiting.indexOf(codename)
        if (cycleStartIndex >= 0) {
            const cycle = [...visiting.slice(cycleStartIndex), codename]
            throw new Error(`Circular @shared imports detected: ${cycle.join(' -> ')}`)
        }

        const entry = libraryEntryByCodename.get(codename)
        if (!entry) {
            throw new Error(`Shared library "@shared/${codename}" not found in metahub`)
        }

        visiting.push(codename)
        for (const dependency of extractSharedScriptImports(entry.script.sourceCode)) {
            if (!libraryEntryByCodename.has(dependency)) {
                throw new Error(`Shared library "@shared/${dependency}" not found in metahub`)
            }
            visit(dependency)
        }
        visiting.pop()

        visited.add(codename)
        ordered.push(entry)
    }

    for (const codename of [...libraryEntryByCodename.keys()].sort()) {
        visit(codename)
    }

    return ordered
}

const buildCompilationErrorDetails = (error: unknown): { message: string } => ({
    message: error instanceof Error ? error.message : String(error)
})

export class MetahubScriptsService {
    constructor(private readonly exec: DbExecutor, private readonly schemaService: MetahubSchemaService) {}

    async listScripts(metahubId: string, options: ListMetahubScriptsOptions = {}, userId?: string): Promise<MetahubScriptRecord[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const rows = await listStoredMetahubScripts(this.exec, schemaName, options)
        return rows.map(normalizeScriptRow)
    }

    async listPublishedScripts(metahubId: string, userId?: string): Promise<MetahubScriptRecord[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const storedScripts = await listStoredMetahubScripts(this.exec, schemaName, { onlyActive: true })
        const scripts = sortPublishedScriptEntries(
            storedScripts.map((row) => ({ row, script: normalizeScriptRow(row) })).filter(({ script }) => script.isActive)
        )
        const publishedScripts: MetahubScriptRecord[] = []
        const sharedLibraries = buildSharedLibraryCompilationMap(scripts)
        const orderedSharedLibraryScripts = (() => {
            try {
                return resolveSharedLibraryPublicationOrder(scripts)
            } catch (error) {
                throw new MetahubValidationError('Script compilation failed', buildCompilationErrorDetails(error))
            }
        })()

        for (const { script } of orderedSharedLibraryScripts) {
            await this.compileSource(
                schemaName,
                {
                    codename: getCodenameText(script.codename),
                    sourceCode: script.sourceCode,
                    sdkApiVersion: script.sdkApiVersion,
                    moduleRole: script.moduleRole,
                    sourceKind: script.sourceKind,
                    capabilities: script.manifest.capabilities
                },
                {
                    currentScriptId: script.id,
                    attachedToKind: script.attachedToKind,
                    attachedToId: script.attachedToId,
                    sharedLibraries
                }
            )
        }

        for (const { row: storedScript, script } of scripts) {
            if (isSharedLibraryScope(script.attachedToKind, script.attachedToId, script.moduleRole)) {
                continue
            }

            if (isLegacyGlobalScript(storedScript) || extractSharedScriptImports(script.sourceCode).length === 0) {
                publishedScripts.push(script)
                continue
            }

            const compiled = await this.compileSource(
                schemaName,
                {
                    codename: getCodenameText(script.codename),
                    sourceCode: script.sourceCode,
                    sdkApiVersion: script.sdkApiVersion,
                    moduleRole: script.moduleRole,
                    sourceKind: script.sourceKind,
                    capabilities: script.manifest.capabilities
                },
                {
                    currentScriptId: script.id,
                    attachedToKind: script.attachedToKind,
                    attachedToId: script.attachedToId,
                    sharedLibraries
                }
            )

            publishedScripts.push({
                ...script,
                manifest: compiled.manifest,
                serverBundle: compiled.serverBundle,
                clientBundle: compiled.clientBundle,
                checksum: compiled.checksum
            })
        }

        return publishedScripts
    }

    async getScriptById(metahubId: string, scriptId: string, userId?: string): Promise<MetahubScriptRecord | null> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        return this.getScriptByIdInSchema(schemaName, scriptId)
    }

    async getScriptByIdInSchema(
        schemaName: string,
        scriptId: string,
        executor: SqlQueryable = this.exec
    ): Promise<MetahubScriptRecord | null> {
        const row = await findStoredMetahubScriptById(executor, schemaName, scriptId)
        return row ? normalizeScriptRow(row) : null
    }

    async createScript(metahubId: string, input: UpsertMetahubScriptInput, userId?: string): Promise<MetahubScriptRecord> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const codename = normalizeScriptCodename(input.codename)
        const attachment = await this.validateAttachment(schemaName, metahubId, input.attachedToKind, input.attachedToId ?? null)
        const moduleRole = normalizeScriptModuleRole(input.moduleRole ?? DEFAULT_SCRIPT_MODULE_ROLE)
        assertScopeModuleRoleCompatibility(input.attachedToKind, attachment, moduleRole)
        const sourceKind = assertSupportedSourceKind(input.sourceKind ?? DEFAULT_SCRIPT_SOURCE_KIND)
        const sdkApiVersion = assertSupportedScriptSdkApiVersion(input.sdkApiVersion ?? DEFAULT_SCRIPT_SDK_API_VERSION)
        const capabilities = resolveScriptCapabilities(moduleRole, input.capabilities)
        await this.ensureUniqueCodename(schemaName, {
            codename,
            attachedToKind: input.attachedToKind,
            attachedToId: attachment,
            moduleRole
        })
        const compiled = await this.compileSource(
            schemaName,
            {
                codename,
                sourceCode: input.sourceCode,
                sdkApiVersion,
                moduleRole,
                sourceKind,
                capabilities
            },
            {
                attachedToKind: input.attachedToKind,
                attachedToId: attachment
            }
        )

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
        const preservesExistingOutOfScopeLibrary =
            isOutOfScopeLibrary(existing.attached_to_kind, existing.attached_to_id ?? null, existing.module_role) &&
            input.attachedToKind === undefined &&
            !Object.prototype.hasOwnProperty.call(input, 'attachedToId') &&
            (input.moduleRole === undefined || (isLegacyGlobalScript(existing) && isLibraryModuleRole(input.moduleRole)))
        assertScopeModuleRoleCompatibility(nextAttachmentKind, nextAttachmentId, nextModuleRole, {
            allowOutOfScopeLibrary: preservesExistingOutOfScopeLibrary
        })
        const existingCodename = getCodenameText(existing.codename)
        const existingIsSharedLibrary = isSharedLibraryScope(
            existing.attached_to_kind,
            existing.attached_to_id ?? null,
            existing.module_role
        )
        const nextIsSharedLibrary = isSharedLibraryScope(nextAttachmentKind, nextAttachmentId, nextModuleRole)
        const persistedModuleRole = preservesExistingOutOfScopeLibrary ? String(existing.module_role) : nextModuleRole

        if (existingIsSharedLibrary && (!nextIsSharedLibrary || nextCodename !== existingCodename)) {
            const dependents = await this.findSharedLibraryDependents(schemaName, existingCodename, scriptId)
            if (dependents.length > 0) {
                throw new MetahubConflictError('Shared library codename is still used by dependent scripts', {
                    codename: existingCodename,
                    dependents
                })
            }
        }

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
            ? await this.compileSource(
                  schemaName,
                  {
                      codename: nextCodename,
                      sourceCode: nextSourceCode,
                      sdkApiVersion: nextSdkApiVersion,
                      moduleRole: nextModuleRole,
                      sourceKind: nextSourceKind,
                      capabilities: nextCapabilities
                  },
                  {
                      currentScriptId: scriptId,
                      attachedToKind: nextAttachmentKind,
                      attachedToId: nextAttachmentId
                  }
              )
            : null

        const updated = await incrementVersion(this.exec, schemaName, METAHUB_SCRIPTS_TABLE, scriptId, {
            codename: JSON.stringify(createCodenameVLC('en', nextCodename)),
            presentation: JSON.stringify(input.presentation ?? existing.presentation ?? {}),
            attached_to_kind: nextAttachmentKind,
            attached_to_id: nextAttachmentId,
            module_role: persistedModuleRole,
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

        if (isSharedLibraryScope(existing.attached_to_kind, existing.attached_to_id ?? null, existing.module_role)) {
            const dependents = await this.findSharedLibraryDependents(schemaName, getCodenameText(existing.codename), scriptId)
            if (dependents.length > 0) {
                throw new MetahubConflictError('Shared library is still imported by other scripts', {
                    codename: getCodenameText(existing.codename),
                    dependents
                })
            }
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

        if (scope.attachedToKind === 'general' && scope.attachedToId === null && scope.moduleRole === 'library') {
            const legacyScope = {
                codename: scope.codename,
                attachedToKind: 'metahub' as ScriptAttachmentKind,
                attachedToId: null,
                moduleRole: LEGACY_GLOBAL_SCRIPT_ROLE as unknown as ScriptModuleRole
            }
            const legacyExisting = await findStoredMetahubScriptByScope(this.exec, schemaName, legacyScope)
            if (legacyExisting && legacyExisting.id !== excludeId) {
                throw new MetahubConflictError('Script codename already exists in this attachment scope', {
                    ...scope,
                    legacyScriptId: legacyExisting.id
                })
            }
        }
    }

    private async validateAttachment(
        schemaName: string,
        metahubId: string,
        attachedToKind: ScriptAttachmentKind,
        attachedToId: string | null
    ): Promise<string | null> {
        if (!isScriptAttachmentKind(attachedToKind)) {
            throw new MetahubValidationError('Unsupported script attachment kind')
        }

        if (attachedToKind === 'metahub' || attachedToKind === 'general') {
            if (attachedToId && attachedToId !== metahubId) {
                throw new MetahubValidationError(
                    attachedToKind === 'general'
                        ? 'General library scripts cannot target a concrete attachment id'
                        : 'Metahub-level scripts cannot target a different metahub id'
                )
            }
            return null
        }

        if (!attachedToId) {
            throw new MetahubValidationError('attachedToId is required for object-attached scripts')
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
            const attachmentKinds = await this.resolveAttachmentObjectKinds(metahubId, attachedToKind)
            row = await queryOne<{ id: string }>(
                this.exec,
                `SELECT id FROM ${qSchemaTable(schemaName, '_mhb_objects')}
                 WHERE id = $1 AND kind = ANY($2::text[]) AND ${ACTIVE_ATTACHMENT_CLAUSE}
                 LIMIT 1`,
                [attachedToId, attachmentKinds]
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

    private async resolveAttachmentObjectKinds(metahubId: string, attachedToKind: ScriptAttachmentKind): Promise<string[]> {
        if (attachedToKind !== 'catalog') {
            return [attachedToKind]
        }

        const entityTypeService = new EntityTypeService(this.exec, this.schemaService)
        const customTypes = await entityTypeService.listCustomTypes(metahubId)

        return [attachedToKind, ...customTypes.filter(isCatalogCompatibleEntityType).map((entityType) => entityType.kindKey)]
    }

    private async findSharedLibraryDependents(
        schemaName: string,
        codename: string,
        excludeScriptId?: string
    ): Promise<
        Array<{
            id: string
            codename: string
            attachedToKind: ScriptAttachmentKind
            attachedToId: string | null
            moduleRole: ScriptModuleRole
        }>
    > {
        const storedScripts = await listStoredMetahubScripts(this.exec, schemaName)

        return storedScripts
            .filter((row) => row.id !== excludeScriptId)
            .map(normalizeScriptRow)
            .filter((script) => extractSharedScriptImports(script.sourceCode).includes(codename))
            .map(toSharedLibraryDependency)
    }

    private async loadSharedLibraries(
        schemaName: string,
        options: {
            currentScriptId?: string
            currentLibrary?: ScriptCompilationLibraryInput
        } = {}
    ): Promise<Record<string, ScriptCompilationLibraryInput>> {
        const libraryRows = await listStoredMetahubScripts(this.exec, schemaName, {
            attachedToKind: 'general',
            attachedToId: null,
            onlyActive: true
        })

        const libraries: Record<string, ScriptCompilationLibraryInput> = {}

        for (const row of libraryRows) {
            if (row.id === options.currentScriptId) {
                continue
            }

            const normalized = normalizeScriptRow(row)
            if (!isSharedLibraryScope(normalized.attachedToKind, normalized.attachedToId, normalized.moduleRole)) {
                continue
            }

            const codename = getCodenameText(normalized.codename)
            libraries[codename] = {
                codename,
                sourceCode: normalized.sourceCode
            }
        }

        if (options.currentLibrary) {
            libraries[options.currentLibrary.codename] = options.currentLibrary
        }

        return libraries
    }

    private async compileSource(
        schemaName: string,
        input: {
            codename: string
            sourceCode: string
            sdkApiVersion?: string
            moduleRole?: ScriptModuleRole
            sourceKind?: ScriptSourceKind
            capabilities?: ScriptCapability[]
        },
        options?: {
            currentScriptId?: string
            attachedToKind?: ScriptAttachmentKind
            attachedToId?: string | null
            sharedLibraries?: Record<string, ScriptCompilationLibraryInput>
        }
    ) {
        try {
            const moduleRole = normalizeScriptModuleRole(input.moduleRole ?? DEFAULT_SCRIPT_MODULE_ROLE)
            const sharedLibraries =
                options?.sharedLibraries ??
                (await this.loadSharedLibraries(schemaName, {
                    currentScriptId: options?.currentScriptId,
                    currentLibrary:
                        options?.attachedToKind && isSharedLibraryScope(options.attachedToKind, options.attachedToId ?? null, moduleRole)
                            ? {
                                  codename: input.codename,
                                  sourceCode: input.sourceCode
                              }
                            : undefined
                }))

            return await compileScriptSource({
                codename: input.codename,
                sourceCode: input.sourceCode,
                sdkApiVersion: input.sdkApiVersion,
                moduleRole,
                sourceKind: input.sourceKind,
                capabilities: input.capabilities,
                sharedLibraries
            })
        } catch (error) {
            throw new MetahubValidationError('Script compilation failed', buildCompilationErrorDetails(error))
        }
    }
}
