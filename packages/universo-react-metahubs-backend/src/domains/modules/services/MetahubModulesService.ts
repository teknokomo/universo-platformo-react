import { qSchemaTable } from '@universo-react/database'
import { compileModuleSource, extractSharedModuleImports } from '@universo-react/modules-engine'
import {
    assertSupportedModuleSdkApiVersion,
    DEFAULT_MODULE_ROLE,
    DEFAULT_MODULE_SDK_API_VERSION,
    DEFAULT_MODULE_STORAGE_MODE,
    DEFAULT_MODULE_SOURCE_KIND,
    MODULE_AUTHORING_SOURCE_KINDS,
    type ModuleCapability,
    type MetahubModuleRecord,
    type ModuleAttachmentKind,
    type ModuleCompilationLibraryInput,
    findDisallowedModuleCapabilities,
    type ModuleManifest,
    type ModulePackageImport,
    type ModuleRole,
    type ModulePresentation,
    type ModuleSourceCompileStatus,
    type ModuleSourceKind,
    type ModuleStorageMode,
    isModuleAttachmentKind,
    normalizeModuleCapabilities,
    normalizeModulePackageImports,
    normalizeModuleRole,
    normalizeModuleSourceKind,
    normalizeModuleStorageMode,
    normalizeModuleSourceCompileStatus,
    resolveModuleSdkApiVersion
} from '@universo-react/types'
import { queryOne, withAdvisoryLock, type DbExecutor, type SqlQueryable } from '@universo-react/utils/database'
import { OptimisticLockError } from '@universo-react/utils'
import { isValidCodenameForStyle, normalizeCodenameForStyle } from '@universo-react/utils/validation/codename'
import { incrementVersion, updateWithVersionCheck } from '../../../utils/optimisticLock'
import { getCodenameText } from '../../shared/codename'
import { MetahubConflictError, MetahubNotFoundError, MetahubValidationError } from '../../shared/domainErrors'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { EntityTypeService } from '../../entities/services/EntityTypeService'
import {
    deleteStoredMetahubModuleById,
    findStoredMetahubModuleByScope,
    findStoredMetahubModuleById,
    findStoredMetahubModuleBySourcePath,
    insertStoredMetahubModule,
    listStoredMetahubModules,
    metahubModulesStorageColumnsAvailable,
    METAHUB_MODULES_TABLE,
    type StoredMetahubModuleRow
} from './modulesStore'
import { createCodenameVLC, createLocalizedContent, ensureCodenameVLC } from '@universo-react/utils'
import { listMetahubPackages } from '../../../persistence'
import {
    assertSafeRelativeModulePath,
    computeModuleSourceChecksum,
    ModuleSourceFileService,
    type ModuleSourceReadResult
} from './ModuleSourceFileService'
import { createLogger } from '../../../utils/logger'

const log = createLogger('MetahubModulesService')

export interface ListMetahubModulesOptions {
    attachedToKind?: ModuleAttachmentKind
    attachedToId?: string | null
    onlyActive?: boolean
}

export interface UpsertMetahubModuleInput {
    codename: string
    presentation: ModulePresentation
    attachedToKind: ModuleAttachmentKind
    attachedToId?: string | null
    moduleRole?: ModuleRole
    sourceKind?: ModuleSourceKind
    sdkApiVersion?: string
    sourceCode?: string
    storageMode?: ModuleStorageMode
    sourcePath?: string | null
    isActive?: boolean
    capabilities?: string[]
    config?: Record<string, unknown>
    expectedSourceChecksum?: string
}

export interface UpdateMetahubModuleInput {
    codename?: string
    presentation?: ModulePresentation
    attachedToKind?: ModuleAttachmentKind
    attachedToId?: string | null
    moduleRole?: ModuleRole
    sourceKind?: ModuleSourceKind
    sdkApiVersion?: string
    sourceCode?: string
    storageMode?: ModuleStorageMode
    sourcePath?: string | null
    isActive?: boolean
    capabilities?: string[]
    config?: Record<string, unknown>
    expectedVersion?: number
    expectedSourceChecksum?: string
}

interface DeleteMetahubModuleOptions {
    expectedVersion?: number
    expectedSourceChecksum?: string
}

const ACTIVE_ATTACHMENT_CLAUSE = '_upl_deleted = false AND _mhb_deleted = false'
const OBJECT_COMPATIBLE_KIND_KEY = 'object'

const isGeneralAttachmentScope = (attachedToKind: ModuleAttachmentKind, attachedToId: string | null): boolean =>
    attachedToKind === 'general' && attachedToId === null

const isLibraryModuleRole = (moduleRole: ModuleRole | string | undefined): boolean => normalizeModuleRole(moduleRole) === 'library'

const assertScopeModuleRoleCompatibility = (
    attachedToKind: ModuleAttachmentKind,
    attachedToId: string | null,
    moduleRole: ModuleRole
): void => {
    if (isGeneralAttachmentScope(attachedToKind, attachedToId) && moduleRole !== 'library') {
        throw new MetahubValidationError('General modules must use the library module role', {
            attachedToKind,
            attachedToId,
            moduleRole
        })
    }

    if (moduleRole === 'library' && !isGeneralAttachmentScope(attachedToKind, attachedToId)) {
        throw new MetahubValidationError('Library modules must use the general attachment scope', {
            attachedToId,
            moduleRole
        })
    }
}

const normalizeModuleCodename = (value: string): string => {
    const normalized = normalizeCodenameForStyle(value, 'kebab-case', 'en')
    if (!normalized || !isValidCodenameForStyle(normalized, 'kebab-case', 'en')) {
        throw new MetahubValidationError('Module codename must be a valid kebab-case English identifier')
    }
    return normalized
}

const assertSupportedSourceKind = (value: unknown): ModuleSourceKind => {
    const sourceKind = normalizeModuleSourceKind(value)
    if (!MODULE_AUTHORING_SOURCE_KINDS.some((kind) => kind === sourceKind)) {
        throw new MetahubValidationError('Only embedded module sources are supported in v1')
    }

    return sourceKind
}

const assertInlineSourceCode = (value: string | null | undefined): string => {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new MetahubValidationError('Module source code is required for inline storage', {
            messageCode: 'modules.source.inlineRequired'
        })
    }
    return value
}

const resolveModuleCapabilities = (moduleRole: ModuleRole, capabilities?: string[]): ModuleCapability[] => {
    const invalidCapabilities = findDisallowedModuleCapabilities(moduleRole, capabilities)
    if (invalidCapabilities.length > 0) {
        throw new MetahubValidationError('Module capabilities are not allowed for the selected module role', {
            moduleRole,
            invalidCapabilities
        })
    }

    return normalizeModuleCapabilities(moduleRole, capabilities)
}

const ensureManifest = (value: unknown): ModuleManifest => {
    if (!value || typeof value !== 'object') {
        return {
            className: 'ExtensionModuleModule',
            sdkApiVersion: DEFAULT_MODULE_SDK_API_VERSION,
            moduleRole: DEFAULT_MODULE_ROLE,
            sourceKind: DEFAULT_MODULE_SOURCE_KIND,
            capabilities: [],
            methods: []
        }
    }

    const manifest = value as Partial<ModuleManifest>
    const moduleRole = normalizeModuleRole(manifest.moduleRole)
    const sdkApiVersion = resolveModuleSdkApiVersion({
        sdkApiVersion: DEFAULT_MODULE_SDK_API_VERSION,
        manifestSdkApiVersion: manifest.sdkApiVersion
    })
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

const createFallbackModulePresentation = (): ModulePresentation => ({
    name: createLocalizedContent('en', '')
})

const normalizeModuleRow = (row: StoredMetahubModuleRow): MetahubModuleRecord => {
    const manifest = ensureManifest(row.manifest)
    const sdkApiVersion = resolveModuleSdkApiVersion({
        sdkApiVersion: row.sdk_api_version,
        manifestSdkApiVersion: manifest.sdkApiVersion
    })
    const moduleRole = normalizeModuleRole(row.module_role)
    const storageMode = normalizeModuleStorageMode(row.storage_mode)
    const sourceLastReadAt = normalizeDateString(row.source_last_read_at)
    const sourceLastCompileAt = normalizeDateString(row.source_last_compile_at)
    const sourceLastCompileStatus =
        normalizeModuleSourceCompileStatus(row.source_last_compile_status) ?? (storageMode === 'file' ? 'never' : null)
    const sourceStatus = storageMode === 'inline' ? 'inline' : row.source_path ? 'modified' : 'missing'

    return {
        id: row.id,
        codename: ensureCodenameVLC(row.codename, 'en') ?? createCodenameVLC('en', ''),
        presentation:
            row.presentation && typeof row.presentation === 'object'
                ? (row.presentation as ModulePresentation)
                : createFallbackModulePresentation(),
        attachedToKind: row.attached_to_kind,
        attachedToId: row.attached_to_id,
        moduleRole,
        sourceKind: row.source_kind,
        sdkApiVersion,
        sourceCode: row.source_code,
        storageMode,
        sourcePath: row.source_path ?? null,
        sourceChecksum: row.source_checksum ?? null,
        sourceStatus,
        sourceLastReadAt,
        sourceLastCompileAt,
        sourceLastCompileStatus,
        sourceLastCompileMessageCode: row.source_last_compile_message_code ?? null,
        sourceStorage: {
            mode: storageMode,
            path: row.source_path ?? null,
            checksum: row.source_checksum ?? null,
            status: sourceStatus,
            lastReadAt: sourceLastReadAt,
            lastCompileAt: sourceLastCompileAt,
            lastCompileStatus: sourceLastCompileStatus,
            lastCompileMessageCode: row.source_last_compile_message_code ?? null
        },
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
        updatedAt: normalizeDateString(row._upl_updated_at)
    }
}

const normalizeDateString = (value: string | Date | null | undefined): string | null =>
    value instanceof Date ? value.toISOString() : typeof value === 'string' ? value : null

const isSharedLibraryScope = (
    attachedToKind: ModuleAttachmentKind,
    attachedToId: string | null,
    moduleRole: ModuleRole | string | undefined
): boolean => isGeneralAttachmentScope(attachedToKind, attachedToId) && isLibraryModuleRole(moduleRole)

const isObjectCompatibleEntityType = (entityType: { kindKey: string; config?: Record<string, unknown> | null }): boolean =>
    entityType.kindKey === OBJECT_COMPATIBLE_KIND_KEY

const toSharedLibraryDependency = (module: MetahubModuleRecord) => ({
    id: module.id,
    codename: getCodenameText(module.codename),
    attachedToKind: module.attachedToKind,
    attachedToId: module.attachedToId,
    moduleRole: module.moduleRole
})

type PublishedModuleEntry = {
    row: StoredMetahubModuleRow
    module: MetahubModuleRecord
}

const buildPublishedModuleSortKey = (module: MetahubModuleRecord): string =>
    `${module.attachedToKind}:${module.attachedToId ?? ''}:${module.moduleRole}:${getCodenameText(module.codename)}:${module.id}`

const sortPublishedModuleEntries = (entries: PublishedModuleEntry[]): PublishedModuleEntry[] =>
    [...entries].sort((left, right) => buildPublishedModuleSortKey(left.module).localeCompare(buildPublishedModuleSortKey(right.module)))

const buildSharedLibraryCompilationMap = (
    entries: PublishedModuleEntry[],
    sourceByModuleId: Map<string, string>
): Record<string, ModuleCompilationLibraryInput> => {
    const libraries: Record<string, ModuleCompilationLibraryInput> = {}

    for (const { module } of entries) {
        if (!isSharedLibraryScope(module.attachedToKind, module.attachedToId, module.moduleRole)) {
            continue
        }

        const codename = getCodenameText(module.codename)
        libraries[codename] = {
            codename,
            sourceCode: sourceByModuleId.get(module.id) ?? module.sourceCode ?? '',
            diagnosticFileName: module.sourcePath ?? undefined
        }
    }

    return libraries
}

const resolveSharedLibraryPublicationOrder = (
    entries: PublishedModuleEntry[],
    sourceByModuleId: Map<string, string>
): PublishedModuleEntry[] => {
    const libraryEntries = entries.filter(({ module }) =>
        isSharedLibraryScope(module.attachedToKind, module.attachedToId, module.moduleRole)
    )
    const libraryEntryByCodename = new Map(libraryEntries.map((entry) => [getCodenameText(entry.module.codename), entry]))
    const visited = new Set<string>()
    const visiting: string[] = []
    const ordered: PublishedModuleEntry[] = []

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
        for (const dependency of extractSharedModuleImports(sourceByModuleId.get(entry.module.id) ?? entry.module.sourceCode ?? '')) {
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

interface PreparedModuleSource {
    storageMode: ModuleStorageMode
    sourceCode: string
    sourcePath: string | null
    sourceChecksum: string | null
    sourceLastReadAt: Date | null
    diagnosticFileName?: string
    existingFileGuard?: {
        sourcePath: string
        expectedSourceChecksum: string
        currentSourceChecksum: string
    }
    pendingWrite?: {
        metahubId: string
        schemaName: string
        sourcePath: string
        sourceCode: string
        expectedSourceChecksum?: string
        requireMissingSource?: boolean
    }
}

interface SourceFileRollback {
    previousPath: string | null
    previousSourceCode: string | null
}

interface SourceWriteCommit {
    sourcePath: string
    checksum: string
}

export class MetahubModulesService {
    private static readonly sourcePathLocks = new Map<string, Promise<void>>()

    constructor(
        private readonly exec: DbExecutor,
        private readonly schemaService: MetahubSchemaService,
        private readonly sourceFileService = new ModuleSourceFileService()
    ) {}

    private async listAllowedPackageImports(metahubId: string): Promise<ModulePackageImport[]> {
        const packages = await listMetahubPackages(this.exec, metahubId)
        return packages
            .filter((item) => (item.source?.runtimeTargets ?? []).length > 0)
            .map((item) => ({
                packageName: item.packageName,
                version: item.version,
                targets: item.source.runtimeTargets
            }))
    }

    async listModules(metahubId: string, options: ListMetahubModulesOptions = {}, userId?: string): Promise<MetahubModuleRecord[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const rows = await listStoredMetahubModules(this.exec, schemaName, options)
        return Promise.all(rows.map((row) => this.hydrateModuleRecord(metahubId, schemaName, row)))
    }

    async listPublishedModules(metahubId: string, userId?: string): Promise<MetahubModuleRecord[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const allowedPackageImports = await this.listAllowedPackageImports(metahubId)
        const storedModules = await listStoredMetahubModules(this.exec, schemaName, { onlyActive: true })
        const modules = sortPublishedModuleEntries(
            storedModules.map((row) => ({ row, module: normalizeModuleRow(row) })).filter(({ module }) => module.isActive)
        )
        const sourceByModuleId = new Map<string, { sourceCode: string; checksum: string | null }>()
        for (const entry of modules) {
            sourceByModuleId.set(entry.module.id, await this.resolveSourceForRow(metahubId, schemaName, entry.row))
        }
        const sourceCodeByModuleId = new Map(
            Array.from(sourceByModuleId.entries()).map(([moduleId, source]) => [moduleId, source.sourceCode])
        )
        const publishedModules: MetahubModuleRecord[] = []
        const sharedLibraries = buildSharedLibraryCompilationMap(modules, sourceCodeByModuleId)
        const orderedSharedLibraryModules = (() => {
            try {
                return resolveSharedLibraryPublicationOrder(modules, sourceCodeByModuleId)
            } catch (error) {
                throw new MetahubValidationError('Module compilation failed', buildCompilationErrorDetails(error))
            }
        })()

        const buildPublishedModule = (
            module: MetahubModuleRecord,
            resolvedSource: { sourceCode: string; checksum: string | null } | undefined,
            compiled: Awaited<ReturnType<typeof compileModuleSource>>,
            includeBundles: boolean
        ): MetahubModuleRecord => ({
            ...module,
            sourceCode: resolvedSource?.sourceCode ?? module.sourceCode ?? null,
            sourceStorage: {
                mode: module.storageMode,
                path: module.sourcePath ?? null,
                checksum: module.storageMode === 'file' ? resolvedSource?.checksum ?? null : module.sourceChecksum ?? null,
                status: module.sourceStatus,
                lastReadAt: module.sourceLastReadAt ?? null,
                lastCompileAt: module.sourceLastCompileAt ?? null,
                lastCompileStatus: module.sourceLastCompileStatus ?? null,
                lastCompileMessageCode: module.sourceLastCompileMessageCode ?? null,
                content: module.storageMode === 'file' ? resolvedSource?.sourceCode ?? null : undefined
            },
            manifest: compiled.manifest,
            serverBundle: includeBundles ? compiled.serverBundle : null,
            clientBundle: includeBundles ? compiled.clientBundle : null,
            checksum: compiled.checksum
        })

        for (const { module } of orderedSharedLibraryModules) {
            const compiled = await this.compileSource(
                metahubId,
                schemaName,
                {
                    codename: getCodenameText(module.codename),
                    sourceCode: sourceByModuleId.get(module.id)?.sourceCode ?? module.sourceCode ?? '',
                    diagnosticFileName: module.sourcePath ?? undefined,
                    sdkApiVersion: module.sdkApiVersion,
                    moduleRole: module.moduleRole,
                    sourceKind: module.sourceKind,
                    capabilities: module.manifest.capabilities
                },
                {
                    currentModuleId: module.id,
                    attachedToKind: module.attachedToKind,
                    attachedToId: module.attachedToId,
                    sharedLibraries,
                    allowedPackageImports
                }
            )
            const resolvedSource = sourceByModuleId.get(module.id)
            publishedModules.push(buildPublishedModule(module, resolvedSource, compiled, false))
        }

        for (const { module } of modules) {
            if (isSharedLibraryScope(module.attachedToKind, module.attachedToId, module.moduleRole)) {
                continue
            }

            const compiled = await this.compileSource(
                metahubId,
                schemaName,
                {
                    codename: getCodenameText(module.codename),
                    sourceCode: sourceByModuleId.get(module.id)?.sourceCode ?? module.sourceCode ?? '',
                    diagnosticFileName: module.sourcePath ?? undefined,
                    sdkApiVersion: module.sdkApiVersion,
                    moduleRole: module.moduleRole,
                    sourceKind: module.sourceKind,
                    capabilities: module.manifest.capabilities
                },
                {
                    currentModuleId: module.id,
                    attachedToKind: module.attachedToKind,
                    attachedToId: module.attachedToId,
                    sharedLibraries,
                    allowedPackageImports
                }
            )
            const resolvedSource = sourceByModuleId.get(module.id)
            publishedModules.push(buildPublishedModule(module, resolvedSource, compiled, true))
        }

        return publishedModules
    }

    async getModuleById(metahubId: string, moduleId: string, userId?: string): Promise<MetahubModuleRecord | null> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const row = await findStoredMetahubModuleById(this.exec, schemaName, moduleId)
        return row ? this.hydrateModuleRecord(metahubId, schemaName, row) : null
    }

    async getModuleByIdInSchema(
        schemaName: string,
        moduleId: string,
        executor: SqlQueryable = this.exec,
        metahubId?: string
    ): Promise<MetahubModuleRecord | null> {
        const row = await findStoredMetahubModuleById(executor, schemaName, moduleId)
        if (!row) {
            return null
        }

        return metahubId ? this.hydrateModuleRecord(metahubId, schemaName, row) : normalizeModuleRow(row)
    }

    private async hydrateModuleRecord(metahubId: string, schemaName: string, row: StoredMetahubModuleRow): Promise<MetahubModuleRecord> {
        const module = normalizeModuleRow(row)
        if (module.storageMode !== 'file' || !module.sourcePath) {
            return module
        }

        try {
            const read = await this.sourceFileService.read({ metahubId, branchSlug: schemaName }, module.sourcePath)
            const sourceStatus = read.checksum === module.sourceChecksum ? 'ready' : 'modified'
            return {
                ...module,
                sourceCode: read.sourceCode,
                sourceChecksum: read.checksum,
                sourceStatus,
                sourceStorage: {
                    mode: module.storageMode,
                    path: module.sourcePath,
                    ...module.sourceStorage,
                    absolutePath: read.absolutePath,
                    checksum: read.checksum,
                    status: sourceStatus,
                    content: read.sourceCode
                }
            }
        } catch (error) {
            const sourceStatus = (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : 'unreadable'
            const absolutePath =
                typeof this.sourceFileService.resolveSourcePath === 'function'
                    ? this.sourceFileService.resolveSourcePath({ metahubId, branchSlug: schemaName }, module.sourcePath)
                    : null
            return {
                ...module,
                sourceStatus,
                sourceStorage: {
                    mode: module.storageMode,
                    path: module.sourcePath,
                    ...module.sourceStorage,
                    absolutePath,
                    status: sourceStatus
                }
            }
        }
    }

    async createModule(metahubId: string, input: UpsertMetahubModuleInput, userId?: string): Promise<MetahubModuleRecord> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const allowedPackageImports = await this.listAllowedPackageImports(metahubId)
        const codename = normalizeModuleCodename(input.codename)
        const attachment = await this.validateAttachment(schemaName, metahubId, input.attachedToKind, input.attachedToId ?? null)
        const moduleRole = normalizeModuleRole(input.moduleRole ?? DEFAULT_MODULE_ROLE)
        assertScopeModuleRoleCompatibility(input.attachedToKind, attachment, moduleRole)
        const sourceKind = assertSupportedSourceKind(input.sourceKind ?? DEFAULT_MODULE_SOURCE_KIND)
        const sdkApiVersion = assertSupportedModuleSdkApiVersion(input.sdkApiVersion ?? DEFAULT_MODULE_SDK_API_VERSION)
        const capabilities = resolveModuleCapabilities(moduleRole, input.capabilities)
        const sourceStorage = await this.prepareModuleSourceForCreate(metahubId, schemaName, {
            codename,
            attachedToKind: input.attachedToKind,
            attachedToId: attachment,
            moduleRole,
            storageMode: input.storageMode,
            sourcePath: input.sourcePath,
            sourceCode: input.sourceCode,
            expectedSourceChecksum: input.expectedSourceChecksum
        })
        await this.ensureUniqueCodename(schemaName, {
            codename,
            attachedToKind: input.attachedToKind,
            attachedToId: attachment,
            moduleRole
        })
        const compiled = await this.compileSource(
            metahubId,
            schemaName,
            {
                codename,
                sourceCode: sourceStorage.sourceCode,
                diagnosticFileName: sourceStorage.diagnosticFileName,
                sdkApiVersion,
                moduleRole,
                sourceKind,
                capabilities
            },
            {
                attachedToKind: input.attachedToKind,
                attachedToId: attachment,
                allowedPackageImports
            }
        )

        let createSourceRollback: SourceFileRollback | null = null
        let createWriteCommit: SourceWriteCommit | null = null
        let createdModuleId: string | undefined
        const createWork = async (activeExec: SqlQueryable): Promise<MetahubModuleRecord> => {
            if (sourceStorage.sourcePath) {
                await this.ensureSourcePathAvailable(schemaName, sourceStorage.sourcePath, undefined, activeExec)
                await this.assertResolvedFileSourceStillCurrent(metahubId, schemaName, sourceStorage)
            }
            createSourceRollback = await this.captureCreateSourceRollback(metahubId, schemaName, sourceStorage)
            let created: StoredMetahubModuleRow | null = null
            try {
                createWriteCommit = await this.commitPendingSourceWrite(sourceStorage)
                created = await insertStoredMetahubModule(activeExec, schemaName, {
                    codename: createCodenameVLC('en', codename),
                    presentation: input.presentation,
                    attachedToKind: input.attachedToKind,
                    attachedToId: attachment,
                    moduleRole,
                    sourceKind,
                    sdkApiVersion,
                    sourceCode: sourceStorage.storageMode === 'inline' ? sourceStorage.sourceCode : null,
                    storageMode: sourceStorage.storageMode,
                    sourcePath: sourceStorage.sourcePath,
                    sourceChecksum: sourceStorage.sourceChecksum,
                    sourceLastReadAt: sourceStorage.sourceLastReadAt,
                    sourceLastCompileAt: new Date(),
                    sourceLastCompileStatus: 'success',
                    sourceLastCompileMessageCode: null,
                    manifest: compiled.manifest,
                    serverBundle: compiled.serverBundle,
                    clientBundle: compiled.clientBundle,
                    checksum: compiled.checksum,
                    isActive: input.isActive ?? true,
                    config: input.config ?? {},
                    userId
                })
                createdModuleId = created.id
                return this.hydrateModuleRecord(metahubId, schemaName, created)
            } catch (error) {
                if (created) {
                    await deleteStoredMetahubModuleById(activeExec, schemaName, created.id)
                }
                await this.restoreCreateSourceRollback(
                    metahubId,
                    schemaName,
                    sourceStorage,
                    createSourceRollback,
                    createWriteCommit,
                    created?.id,
                    activeExec
                )
                createWriteCommit = null
                throw error
            }
        }

        if (sourceStorage.storageMode === 'file' && sourceStorage.sourcePath) {
            try {
                return await this.runWithSourcePathLock(metahubId, schemaName, sourceStorage.sourcePath, createWork)
            } catch (error) {
                await this.restoreCreateSourceRollback(
                    metahubId,
                    schemaName,
                    sourceStorage,
                    createSourceRollback,
                    createWriteCommit,
                    createdModuleId,
                    this.exec
                )
                throw error
            }
        }

        const created = await insertStoredMetahubModule(this.exec, schemaName, {
            codename: createCodenameVLC('en', codename),
            presentation: input.presentation,
            attachedToKind: input.attachedToKind,
            attachedToId: attachment,
            moduleRole,
            sourceKind,
            sdkApiVersion,
            sourceCode: sourceStorage.storageMode === 'inline' ? sourceStorage.sourceCode : null,
            storageMode: sourceStorage.storageMode,
            sourcePath: sourceStorage.sourcePath,
            sourceChecksum: sourceStorage.sourceChecksum,
            sourceLastReadAt: sourceStorage.sourceLastReadAt,
            sourceLastCompileAt: new Date(),
            sourceLastCompileStatus: 'success',
            sourceLastCompileMessageCode: null,
            manifest: compiled.manifest,
            serverBundle: compiled.serverBundle,
            clientBundle: compiled.clientBundle,
            checksum: compiled.checksum,
            isActive: input.isActive ?? true,
            config: input.config ?? {},
            userId
        })
        return this.hydrateModuleRecord(metahubId, schemaName, created)
    }

    async updateModule(
        metahubId: string,
        moduleId: string,
        input: UpdateMetahubModuleInput,
        userId?: string
    ): Promise<MetahubModuleRecord> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const allowedPackageImports = await this.listAllowedPackageImports(metahubId)
        const existing = await findStoredMetahubModuleById(this.exec, schemaName, moduleId)
        if (!existing) {
            throw new MetahubNotFoundError('Module', moduleId)
        }
        this.assertExpectedVersionRequiredForFileBackedUpdate(existing, input)
        this.assertExpectedVersion(existing, input.expectedVersion)

        const nextCodename = input.codename ? normalizeModuleCodename(input.codename) : getCodenameText(existing.codename)
        const nextAttachmentKind = input.attachedToKind ?? existing.attached_to_kind
        const attachmentInput = input.attachedToKind || Object.prototype.hasOwnProperty.call(input, 'attachedToId')
        const requestedAttachmentId = attachmentInput ? input.attachedToId ?? null : existing.attached_to_id
        const nextAttachmentId = await this.validateAttachment(schemaName, metahubId, nextAttachmentKind, requestedAttachmentId)

        const nextModuleRole = normalizeModuleRole(input.moduleRole ?? existing.module_role)
        assertScopeModuleRoleCompatibility(nextAttachmentKind, nextAttachmentId, nextModuleRole)
        const existingCodename = getCodenameText(existing.codename)
        const existingIsSharedLibrary = isSharedLibraryScope(
            existing.attached_to_kind,
            existing.attached_to_id ?? null,
            existing.module_role
        )
        const nextIsSharedLibrary = isSharedLibraryScope(nextAttachmentKind, nextAttachmentId, nextModuleRole)

        if (existingIsSharedLibrary && (!nextIsSharedLibrary || nextCodename !== existingCodename)) {
            const dependents = await this.findSharedLibraryDependents(metahubId, schemaName, existingCodename, moduleId)
            if (dependents.length > 0) {
                throw new MetahubConflictError('Shared library codename is still used by dependent modules', {
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
            moduleId
        )
        const nextSourceKind = assertSupportedSourceKind(input.sourceKind ?? existing.source_kind)
        const nextSdkApiVersion = assertSupportedModuleSdkApiVersion(input.sdkApiVersion ?? existing.sdk_api_version)
        const sourceStorage = await this.prepareModuleSourceForUpdate(metahubId, schemaName, existing, {
            codename: nextCodename,
            attachedToKind: nextAttachmentKind,
            attachedToId: nextAttachmentId,
            moduleRole: nextModuleRole,
            storageMode: input.storageMode,
            sourcePath: input.sourcePath,
            sourceCode: input.sourceCode,
            expectedSourceChecksum: input.expectedSourceChecksum
        })
        const nextSourceCode = sourceStorage.sourceCode
        const existingManifest = ensureManifest(existing.manifest)
        const nextCapabilities =
            input.capabilities !== undefined
                ? resolveModuleCapabilities(nextModuleRole, input.capabilities)
                : existingManifest.capabilities ?? resolveModuleCapabilities(nextModuleRole)

        const fileBackedSourceChanged =
            sourceStorage.storageMode === 'file' &&
            sourceStorage.sourceChecksum !== null &&
            sourceStorage.sourceChecksum !== (existing.source_checksum ?? null)

        const needsRecompile =
            fileBackedSourceChanged ||
            input.sourceCode !== undefined ||
            input.storageMode !== undefined ||
            input.sourcePath !== undefined ||
            input.moduleRole !== undefined ||
            input.sourceKind !== undefined ||
            input.sdkApiVersion !== undefined ||
            input.capabilities !== undefined

        const compiled = needsRecompile
            ? await this.compileSource(
                  metahubId,
                  schemaName,
                  {
                      codename: nextCodename,
                      sourceCode: nextSourceCode,
                      diagnosticFileName: sourceStorage.diagnosticFileName,
                      sdkApiVersion: nextSdkApiVersion,
                      moduleRole: nextModuleRole,
                      sourceKind: nextSourceKind,
                      capabilities: nextCapabilities
                  },
                  {
                      currentModuleId: moduleId,
                      attachedToKind: nextAttachmentKind,
                      attachedToId: nextAttachmentId,
                      allowedPackageImports
                  }
              )
            : null

        const storageColumnsAvailable = await metahubModulesStorageColumnsAvailable(this.exec, schemaName)
        const storagePatch = storageColumnsAvailable
            ? {
                  storage_mode: needsRecompile ? sourceStorage.storageMode : existing.storage_mode ?? sourceStorage.storageMode,
                  source_path: needsRecompile ? sourceStorage.sourcePath : existing.source_path ?? null,
                  source_checksum: needsRecompile ? sourceStorage.sourceChecksum : existing.source_checksum ?? null,
                  source_last_read_at: needsRecompile ? sourceStorage.sourceLastReadAt : existing.source_last_read_at ?? null,
                  source_last_compile_at: needsRecompile ? new Date() : existing.source_last_compile_at ?? null,
                  source_last_compile_status: needsRecompile
                      ? ('success' as ModuleSourceCompileStatus)
                      : existing.source_last_compile_status ?? null,
                  source_last_compile_message_code: needsRecompile ? null : existing.source_last_compile_message_code ?? null
              }
            : {}

        const buildUpdateData = (): Record<string, unknown> => ({
            codename: JSON.stringify(createCodenameVLC('en', nextCodename)),
            presentation: JSON.stringify(input.presentation ?? existing.presentation ?? {}),
            attached_to_kind: nextAttachmentKind,
            attached_to_id: nextAttachmentId,
            module_role: nextModuleRole,
            source_kind: nextSourceKind,
            sdk_api_version: nextSdkApiVersion,
            source_code: sourceStorage.storageMode === 'inline' ? nextSourceCode : null,
            ...storagePatch,
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

        const persistModuleUpdate = async (activeExec: SqlQueryable): Promise<StoredMetahubModuleRow> => {
            const updateData = buildUpdateData()
            const updated =
                input.expectedVersion !== undefined
                    ? await updateWithVersionCheck({
                          executor: activeExec,
                          schemaName,
                          tableName: METAHUB_MODULES_TABLE,
                          entityId: moduleId,
                          entityType: 'module',
                          expectedVersion: input.expectedVersion,
                          updateData,
                          wrapInTransaction: false
                      })
                    : await incrementVersion(activeExec, schemaName, METAHUB_MODULES_TABLE, moduleId, updateData)

            return updated as unknown as StoredMetahubModuleRow
        }

        let updateSourceRollback: SourceFileRollback | null = null
        let updateWriteCommit: SourceWriteCommit | null = null
        const updateWork = async (activeExec: SqlQueryable): Promise<MetahubModuleRecord> => {
            await this.assertExistingFileSourceGuard(metahubId, schemaName, sourceStorage)
            if (sourceStorage.sourcePath) {
                await this.ensureSourcePathAvailable(schemaName, sourceStorage.sourcePath, moduleId, activeExec)
                await this.assertResolvedFileSourceStillCurrent(metahubId, schemaName, sourceStorage)
            }
            updateSourceRollback = await this.captureSourceRollback(metahubId, schemaName, sourceStorage)
            try {
                updateWriteCommit = await this.commitPendingSourceWrite(sourceStorage)
                const updated = await persistModuleUpdate(activeExec)
                return this.hydrateModuleRecord(metahubId, schemaName, updated)
            } catch (error) {
                await this.restoreSourceRollback(
                    metahubId,
                    schemaName,
                    moduleId,
                    sourceStorage,
                    updateSourceRollback,
                    updateWriteCommit,
                    activeExec
                )
                updateWriteCommit = null
                throw error
            }
        }

        const lockedUpdateSourcePath =
            sourceStorage.storageMode === 'file' && sourceStorage.sourcePath
                ? sourceStorage.sourcePath
                : sourceStorage.existingFileGuard?.sourcePath ?? null
        const updatedModule = lockedUpdateSourcePath
            ? await (async () => {
                  try {
                      return await this.runWithSourcePathLock(metahubId, schemaName, lockedUpdateSourcePath, updateWork)
                  } catch (error) {
                      await this.restoreSourceRollback(
                          metahubId,
                          schemaName,
                          moduleId,
                          sourceStorage,
                          updateSourceRollback,
                          updateWriteCommit,
                          this.exec
                      )
                      throw error
                  }
              })()
            : await (async () => {
                  await this.commitPendingSourceWrite(sourceStorage)
                  const updated = await persistModuleUpdate(this.exec)
                  return this.hydrateModuleRecord(metahubId, schemaName, updated)
              })()

        try {
            await this.deletePreviousSourceFileIfOrphaned(metahubId, schemaName, existing, sourceStorage)
        } catch (error) {
            log.warn('Failed to clean up previous file-backed module source after module update', {
                metahubId,
                schemaName,
                moduleId,
                sourcePath: existing.source_path ?? null,
                error
            })
        }
        return updatedModule
    }

    async deleteModule(metahubId: string, moduleId: string, userId?: string, options: DeleteMetahubModuleOptions = {}): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const existing = await findStoredMetahubModuleById(this.exec, schemaName, moduleId)
        if (!existing) {
            throw new MetahubNotFoundError('Module', moduleId)
        }
        this.assertDestructiveFileBackedSourceGuard(existing, options)
        this.assertExpectedVersion(existing, options.expectedVersion)
        const sourcePath = normalizeModuleStorageMode(existing.storage_mode) === 'file' ? existing.source_path : null

        if (isSharedLibraryScope(existing.attached_to_kind, existing.attached_to_id ?? null, existing.module_role)) {
            const dependents = await this.findSharedLibraryDependents(metahubId, schemaName, getCodenameText(existing.codename), moduleId)
            if (dependents.length > 0) {
                throw new MetahubConflictError('Shared library is still imported by other modules', {
                    codename: getCodenameText(existing.codename),
                    dependents
                })
            }
        }

        const deleteData = {
            _mhb_deleted: true,
            _mhb_deleted_at: new Date(),
            _mhb_deleted_by: userId ?? null,
            _upl_updated_at: new Date(),
            _upl_updated_by: userId ?? null
        }

        const softDeleteModule = async (activeExec: SqlQueryable): Promise<void> => {
            if (sourcePath) {
                await this.assertLiveSourceChecksumForDelete(metahubId, schemaName, existing, options)
            }

            if (options.expectedVersion !== undefined) {
                await updateWithVersionCheck({
                    executor: activeExec,
                    schemaName,
                    tableName: METAHUB_MODULES_TABLE,
                    entityId: moduleId,
                    entityType: 'module',
                    expectedVersion: options.expectedVersion,
                    updateData: deleteData,
                    wrapInTransaction: false
                })
            } else {
                await incrementVersion(activeExec, schemaName, METAHUB_MODULES_TABLE, moduleId, deleteData)
            }
        }

        if (sourcePath) {
            await this.runWithSourcePathLock(metahubId, schemaName, sourcePath, softDeleteModule)
            try {
                await this.runWithSourcePathLock(metahubId, schemaName, sourcePath, async (activeExec) => {
                    const activeOwner = await findStoredMetahubModuleBySourcePath(activeExec, schemaName, sourcePath)
                    if (!activeOwner) {
                        await this.deleteSourceFileIfUnchanged(metahubId, schemaName, sourcePath, existing.source_checksum ?? null)
                    }
                })
            } catch (error) {
                log.warn('Failed to clean up file-backed module source after module delete', {
                    metahubId,
                    schemaName,
                    moduleId,
                    sourcePath,
                    error
                })
            }
            return
        }

        await softDeleteModule(this.exec)
    }

    private async assertLiveSourceChecksumForDelete(
        metahubId: string,
        schemaName: string,
        row: StoredMetahubModuleRow,
        options: DeleteMetahubModuleOptions
    ): Promise<void> {
        if (!row.source_path) {
            return
        }

        const current = await this.readFileBackedSourceOrThrow(metahubId, schemaName, row.source_path)
        this.assertExpectedSourceChecksum(current.sourcePath, current.checksum, options.expectedSourceChecksum)
    }

    private async commitPendingSourceWrite(sourceStorage: PreparedModuleSource): Promise<SourceWriteCommit | null> {
        if (!sourceStorage.pendingWrite) {
            return null
        }

        if (sourceStorage.pendingWrite.expectedSourceChecksum) {
            const current = await this.sourceFileService.read(
                { metahubId: sourceStorage.pendingWrite.metahubId, branchSlug: sourceStorage.pendingWrite.schemaName },
                sourceStorage.pendingWrite.sourcePath
            )
            if (current.checksum !== sourceStorage.pendingWrite.expectedSourceChecksum) {
                throw new MetahubConflictError('File-backed module source was changed by another writer', {
                    sourcePath: sourceStorage.pendingWrite.sourcePath,
                    expectedSourceChecksum: sourceStorage.pendingWrite.expectedSourceChecksum,
                    actualSourceChecksum: current.checksum,
                    messageCode: 'modules.sourcePath.checksumConflict'
                })
            }
        } else if (sourceStorage.pendingWrite.requireMissingSource) {
            try {
                const current = await this.sourceFileService.read(
                    { metahubId: sourceStorage.pendingWrite.metahubId, branchSlug: sourceStorage.pendingWrite.schemaName },
                    sourceStorage.pendingWrite.sourcePath
                )
                throw new MetahubConflictError('File-backed module source was created by another writer', {
                    sourcePath: sourceStorage.pendingWrite.sourcePath,
                    actualSourceChecksum: current.checksum,
                    messageCode: 'modules.sourcePath.checksumConflict'
                })
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                    throw error
                }
            }
        }

        await this.sourceFileService.write(
            { metahubId: sourceStorage.pendingWrite.metahubId, branchSlug: sourceStorage.pendingWrite.schemaName },
            sourceStorage.pendingWrite.sourcePath,
            sourceStorage.pendingWrite.sourceCode
        )
        return {
            sourcePath: sourceStorage.pendingWrite.sourcePath,
            checksum: computeModuleSourceChecksum(sourceStorage.pendingWrite.sourceCode)
        }
    }

    private async runWithSourcePathLock<T>(
        metahubId: string,
        schemaName: string,
        sourcePath: string,
        work: (executor: SqlQueryable) => Promise<T>
    ): Promise<T> {
        const lockKey = `${metahubId}:${schemaName}:${sourcePath}`
        const runLocalLock = async (executor: SqlQueryable): Promise<T> => {
            const previous = MetahubModulesService.sourcePathLocks.get(lockKey) ?? Promise.resolve()
            let release!: () => void
            const current = new Promise<void>((resolve) => {
                release = resolve
            })
            const chained = previous.then(() => current)
            MetahubModulesService.sourcePathLocks.set(lockKey, chained)

            await previous
            try {
                return await work(executor)
            } finally {
                release()
                if (MetahubModulesService.sourcePathLocks.get(lockKey) === chained) {
                    MetahubModulesService.sourcePathLocks.delete(lockKey)
                }
            }
        }

        if ('transaction' in this.exec && typeof this.exec.transaction === 'function') {
            return withAdvisoryLock(this.exec, `metahub-module-source:${lockKey}`, (tx) => runLocalLock(tx))
        }

        return runLocalLock(this.exec)
    }

    private async captureSourceRollback(
        metahubId: string,
        schemaName: string,
        sourceStorage: PreparedModuleSource
    ): Promise<SourceFileRollback | null> {
        if (!sourceStorage.pendingWrite || !sourceStorage.sourcePath) {
            return null
        }

        try {
            const previous = await this.sourceFileService.read({ metahubId, branchSlug: schemaName }, sourceStorage.sourcePath)
            return { previousPath: previous.sourcePath, previousSourceCode: previous.sourceCode }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return { previousPath: null, previousSourceCode: null }
            }
            throw error
        }
    }

    private async captureCreateSourceRollback(
        metahubId: string,
        schemaName: string,
        sourceStorage: PreparedModuleSource
    ): Promise<SourceFileRollback | null> {
        if (!sourceStorage.pendingWrite || !sourceStorage.sourcePath) {
            return null
        }

        try {
            const previous = await this.sourceFileService.read({ metahubId, branchSlug: schemaName }, sourceStorage.sourcePath)
            return { previousPath: previous.sourcePath, previousSourceCode: previous.sourceCode }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return { previousPath: null, previousSourceCode: null }
            }
            throw error
        }
    }

    private async restoreCreateSourceRollback(
        metahubId: string,
        schemaName: string,
        sourceStorage: PreparedModuleSource,
        rollback: SourceFileRollback | null,
        writeCommit: SourceWriteCommit | null,
        createdModuleId?: string,
        activeExec: SqlQueryable = this.exec
    ): Promise<void> {
        if (!sourceStorage.pendingWrite || !sourceStorage.sourcePath) {
            return
        }
        if (!(await this.isCurrentSourceWrite(metahubId, schemaName, sourceStorage.sourcePath, writeCommit))) {
            return
        }

        const owner = await findStoredMetahubModuleBySourcePath(activeExec, schemaName, sourceStorage.sourcePath)
        if (owner && owner.id !== createdModuleId) {
            return
        }

        if (rollback?.previousSourceCode !== null && rollback?.previousPath) {
            await this.sourceFileService.write({ metahubId, branchSlug: schemaName }, rollback.previousPath, rollback.previousSourceCode)
            return
        }

        await this.sourceFileService.delete({ metahubId, branchSlug: schemaName }, sourceStorage.sourcePath)
    }

    private async restoreSourceRollback(
        metahubId: string,
        schemaName: string,
        moduleId: string,
        sourceStorage: PreparedModuleSource,
        rollback: SourceFileRollback | null,
        writeCommit: SourceWriteCommit | null,
        activeExec: SqlQueryable = this.exec
    ): Promise<void> {
        if (!sourceStorage.pendingWrite || !sourceStorage.sourcePath) {
            return
        }
        if (!(await this.isCurrentSourceWrite(metahubId, schemaName, sourceStorage.sourcePath, writeCommit))) {
            return
        }

        const owner = await findStoredMetahubModuleBySourcePath(activeExec, schemaName, sourceStorage.sourcePath)
        if (owner && owner.id !== moduleId) {
            return
        }

        if (rollback?.previousPath && rollback.previousSourceCode !== null) {
            await this.sourceFileService.write({ metahubId, branchSlug: schemaName }, rollback.previousPath, rollback.previousSourceCode)
            if (rollback.previousPath !== sourceStorage.sourcePath) {
                await this.sourceFileService.delete({ metahubId, branchSlug: schemaName }, sourceStorage.sourcePath)
            }
        } else {
            await this.sourceFileService.delete({ metahubId, branchSlug: schemaName }, sourceStorage.sourcePath)
        }
    }

    private async deletePreviousSourceFileIfOrphaned(
        metahubId: string,
        schemaName: string,
        existing: StoredMetahubModuleRow,
        sourceStorage: PreparedModuleSource
    ): Promise<void> {
        const previousSourcePath = normalizeModuleStorageMode(existing.storage_mode) === 'file' ? existing.source_path : null
        if (!previousSourcePath) {
            return
        }

        const nextSourcePath = sourceStorage.storageMode === 'file' ? sourceStorage.sourcePath : null
        if (previousSourcePath === nextSourcePath) {
            return
        }

        await this.runWithSourcePathLock(metahubId, schemaName, previousSourcePath, async (activeExec) => {
            const activeOwner = await findStoredMetahubModuleBySourcePath(activeExec, schemaName, previousSourcePath)
            if (!activeOwner) {
                const expectedSourceChecksum =
                    sourceStorage.existingFileGuard?.sourcePath === previousSourcePath
                        ? sourceStorage.existingFileGuard.currentSourceChecksum
                        : existing.source_checksum ?? null
                await this.deleteSourceFileIfUnchanged(metahubId, schemaName, previousSourcePath, expectedSourceChecksum)
            }
        })
    }

    private async deleteSourceFileIfUnchanged(
        metahubId: string,
        schemaName: string,
        sourcePath: string,
        expectedSourceChecksum: string | null
    ): Promise<boolean> {
        if (!expectedSourceChecksum) {
            log.warn('Skipped file-backed module source cleanup because the stored source checksum is missing', {
                metahubId,
                schemaName,
                sourcePath
            })
            return false
        }

        try {
            const current = await this.sourceFileService.read({ metahubId, branchSlug: schemaName }, sourcePath)
            if (current.checksum !== expectedSourceChecksum) {
                log.warn('Skipped file-backed module source cleanup because the external source changed', {
                    metahubId,
                    schemaName,
                    sourcePath,
                    expectedSourceChecksum,
                    actualSourceChecksum: current.checksum
                })
                return false
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return false
            }
            throw error
        }

        await this.sourceFileService.delete({ metahubId, branchSlug: schemaName }, sourcePath)
        return true
    }

    private async isCurrentSourceWrite(
        metahubId: string,
        schemaName: string,
        sourcePath: string,
        writeCommit: SourceWriteCommit | null
    ): Promise<boolean> {
        if (!writeCommit || writeCommit.sourcePath !== sourcePath) {
            return false
        }

        try {
            const current = await this.sourceFileService.read({ metahubId, branchSlug: schemaName }, sourcePath)
            return current.checksum === writeCommit.checksum
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return false
            }
            throw error
        }
    }

    private assertExpectedVersion(row: StoredMetahubModuleRow, expectedVersion?: number): void {
        if (expectedVersion === undefined) {
            return
        }

        const actualVersion = Number(row._upl_version ?? 1)
        if (actualVersion !== expectedVersion) {
            throw new OptimisticLockError({
                entityId: row.id,
                entityType: 'module',
                expectedVersion,
                actualVersion,
                updatedAt: new Date(row._upl_updated_at ?? Date.now()),
                updatedBy: row._upl_updated_by ?? null
            })
        }
    }

    private assertExpectedVersionRequiredForFileBackedUpdate(existing: StoredMetahubModuleRow, input: UpdateMetahubModuleInput): void {
        if (input.expectedVersion !== undefined) {
            return
        }

        const existingStorageMode = normalizeModuleStorageMode(existing.storage_mode)
        const requestedStorageMode = input.storageMode !== undefined ? normalizeModuleStorageMode(input.storageMode) : existingStorageMode
        if (existingStorageMode !== 'file' && requestedStorageMode !== 'file') {
            return
        }

        throw new MetahubConflictError('File-backed module updates require an expected module version', {
            moduleId: existing.id,
            messageCode: 'modules.expectedVersion.required'
        })
    }

    private assertDestructiveFileBackedSourceGuard(row: StoredMetahubModuleRow, options: DeleteMetahubModuleOptions): void {
        if (normalizeModuleStorageMode(row.storage_mode) !== 'file') {
            return
        }

        if (options.expectedVersion === undefined) {
            throw new MetahubConflictError('File-backed module deletes require an expected module version', {
                moduleId: row.id,
                messageCode: 'modules.expectedVersion.required'
            })
        }

        if (!row.source_path) {
            return
        }

        const actualSourceChecksum = row.source_checksum ?? null
        if (!actualSourceChecksum || !options.expectedSourceChecksum) {
            throw new MetahubConflictError('File-backed module deletes require an expected source checksum', {
                moduleId: row.id,
                sourcePath: row.source_path,
                messageCode: 'modules.sourcePath.expectedChecksumRequired'
            })
        }

        if (actualSourceChecksum !== options.expectedSourceChecksum) {
            throw new MetahubConflictError('File-backed module source was changed by another writer', {
                moduleId: row.id,
                sourcePath: row.source_path,
                expectedSourceChecksum: options.expectedSourceChecksum,
                actualSourceChecksum,
                messageCode: 'modules.sourcePath.checksumConflict'
            })
        }
    }

    private async assertResolvedFileSourceStillCurrent(
        metahubId: string,
        schemaName: string,
        sourceStorage: PreparedModuleSource
    ): Promise<void> {
        if (sourceStorage.storageMode !== 'file' || !sourceStorage.sourcePath || sourceStorage.pendingWrite) {
            return
        }

        const current = await this.readFileBackedSourceOrThrow(metahubId, schemaName, sourceStorage.sourcePath)
        if (current.checksum !== sourceStorage.sourceChecksum) {
            throw new MetahubConflictError('File-backed module source was changed by another writer', {
                sourcePath: sourceStorage.sourcePath,
                expectedSourceChecksum: sourceStorage.sourceChecksum,
                actualSourceChecksum: current.checksum,
                messageCode: 'modules.sourcePath.checksumConflict'
            })
        }
    }

    private assertExpectedSourceChecksum(sourcePath: string, actualSourceChecksum: string, expectedSourceChecksum?: string): string {
        if (!expectedSourceChecksum) {
            throw new MetahubConflictError('File-backed module source updates require an expected source checksum', {
                sourcePath,
                messageCode: 'modules.sourcePath.expectedChecksumRequired'
            })
        }

        if (actualSourceChecksum !== expectedSourceChecksum) {
            throw new MetahubConflictError('File-backed module source was changed by another writer', {
                sourcePath,
                expectedSourceChecksum,
                actualSourceChecksum,
                messageCode: 'modules.sourcePath.checksumConflict'
            })
        }

        return expectedSourceChecksum
    }

    private async assertExistingFileSourceGuard(metahubId: string, schemaName: string, sourceStorage: PreparedModuleSource): Promise<void> {
        if (!sourceStorage.existingFileGuard) {
            return
        }

        const current = await this.readFileBackedSourceOrThrow(metahubId, schemaName, sourceStorage.existingFileGuard.sourcePath)
        this.assertExpectedSourceChecksum(current.sourcePath, current.checksum, sourceStorage.existingFileGuard.expectedSourceChecksum)
    }

    private async prepareModuleSourceForCreate(
        metahubId: string,
        schemaName: string,
        input: {
            codename: string
            attachedToKind: ModuleAttachmentKind
            attachedToId: string | null
            moduleRole: ModuleRole
            storageMode?: ModuleStorageMode
            sourcePath?: string | null
            sourceCode?: string
            expectedSourceChecksum?: string
        }
    ): Promise<PreparedModuleSource> {
        const storageMode = normalizeModuleStorageMode(input.storageMode)
        if (storageMode === 'inline') {
            const sourceCode = assertInlineSourceCode(input.sourceCode)
            return {
                storageMode,
                sourceCode,
                sourcePath: null,
                sourceChecksum: computeModuleSourceChecksum(sourceCode),
                sourceLastReadAt: null
            }
        }

        await this.ensureFileModeSchemaSupported(schemaName)
        const sourcePath =
            input.sourcePath ??
            this.sourceFileService.buildDefaultSourcePath({
                codename: input.codename,
                attachedToKind: input.attachedToKind,
                attachedToId: input.attachedToId,
                moduleRole: input.moduleRole
            })

        const safeSourcePath = await this.ensureSourcePathAvailable(schemaName, sourcePath)

        if (typeof input.sourceCode === 'string' && input.sourceCode.length > 0) {
            let expectedSourceChecksum: string | undefined
            let requireMissingSource = false
            try {
                const current = await this.sourceFileService.read({ metahubId, branchSlug: schemaName }, safeSourcePath)
                if (!input.expectedSourceChecksum) {
                    throw new MetahubConflictError('File-backed module source creates require an expected source checksum', {
                        sourcePath: safeSourcePath,
                        messageCode: 'modules.sourcePath.expectedChecksumRequired'
                    })
                }
                if (current.checksum !== input.expectedSourceChecksum) {
                    throw new MetahubConflictError('File-backed module source was changed by another writer', {
                        sourcePath: safeSourcePath,
                        expectedSourceChecksum: input.expectedSourceChecksum,
                        actualSourceChecksum: current.checksum,
                        messageCode: 'modules.sourcePath.checksumConflict'
                    })
                }
                expectedSourceChecksum = input.expectedSourceChecksum
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                    throw error
                }
                requireMissingSource = true
            }
            return {
                storageMode,
                sourceCode: input.sourceCode,
                sourcePath: safeSourcePath,
                sourceChecksum: computeModuleSourceChecksum(input.sourceCode),
                sourceLastReadAt: new Date(),
                diagnosticFileName: safeSourcePath,
                pendingWrite: {
                    metahubId,
                    schemaName,
                    sourcePath: safeSourcePath,
                    sourceCode: input.sourceCode,
                    expectedSourceChecksum,
                    requireMissingSource
                }
            }
        }

        const read = await this.readFileBackedSourceOrThrow(metahubId, schemaName, safeSourcePath)
        return {
            storageMode,
            sourceCode: read.sourceCode,
            sourcePath: read.sourcePath,
            sourceChecksum: read.checksum,
            sourceLastReadAt: new Date(),
            diagnosticFileName: read.sourcePath
        }
    }

    private async prepareModuleSourceForUpdate(
        metahubId: string,
        schemaName: string,
        existing: StoredMetahubModuleRow,
        input: {
            codename: string
            attachedToKind: ModuleAttachmentKind
            attachedToId: string | null
            moduleRole: ModuleRole
            storageMode?: ModuleStorageMode
            sourcePath?: string | null
            sourceCode?: string
            expectedSourceChecksum?: string
        }
    ): Promise<PreparedModuleSource> {
        const storageMode =
            input.storageMode !== undefined
                ? normalizeModuleStorageMode(input.storageMode)
                : normalizeModuleStorageMode(existing.storage_mode)

        if (storageMode === 'inline') {
            if (normalizeModuleStorageMode(existing.storage_mode) === 'file') {
                if (!existing.source_path) {
                    throw new MetahubValidationError('File-backed module source path is missing', {
                        moduleId: existing.id,
                        messageCode: 'modules.sourcePath.missing'
                    })
                }

                const read = await this.readFileBackedSourceOrThrow(metahubId, schemaName, existing.source_path)
                const expectedSourceChecksum = this.assertExpectedSourceChecksum(
                    read.sourcePath,
                    read.checksum,
                    input.expectedSourceChecksum
                )
                return {
                    storageMode,
                    sourceCode: read.sourceCode,
                    sourcePath: null,
                    sourceChecksum: read.checksum,
                    sourceLastReadAt: null,
                    existingFileGuard: {
                        sourcePath: read.sourcePath,
                        expectedSourceChecksum,
                        currentSourceChecksum: read.checksum
                    }
                }
            }

            const sourceCode = assertInlineSourceCode(input.sourceCode ?? existing.source_code)
            return {
                storageMode,
                sourceCode,
                sourcePath: null,
                sourceChecksum: computeModuleSourceChecksum(sourceCode),
                sourceLastReadAt: null
            }
        }

        await this.ensureFileModeSchemaSupported(schemaName)
        const sourcePath =
            input.sourcePath ??
            existing.source_path ??
            this.sourceFileService.buildDefaultSourcePath({
                codename: input.codename,
                attachedToKind: input.attachedToKind,
                attachedToId: input.attachedToId,
                moduleRole: input.moduleRole
            })

        const safeSourcePath = await this.ensureSourcePathAvailable(schemaName, sourcePath, existing.id)

        if (typeof input.sourceCode === 'string' && input.sourceCode.length > 0) {
            let expectedSourceChecksum: string | undefined
            let requireMissingSource = false
            try {
                const current = await this.sourceFileService.read({ metahubId, branchSlug: schemaName }, safeSourcePath)
                this.assertExpectedSourceChecksum(current.sourcePath, current.checksum, input.expectedSourceChecksum)
                expectedSourceChecksum = input.expectedSourceChecksum
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                    throw error
                }
                requireMissingSource = true
            }
            return {
                storageMode,
                sourceCode: input.sourceCode,
                sourcePath: safeSourcePath,
                sourceChecksum: computeModuleSourceChecksum(input.sourceCode),
                sourceLastReadAt: new Date(),
                diagnosticFileName: safeSourcePath,
                pendingWrite: {
                    metahubId,
                    schemaName,
                    sourcePath: safeSourcePath,
                    sourceCode: input.sourceCode,
                    expectedSourceChecksum,
                    requireMissingSource
                }
            }
        }

        const read = await this.readFileBackedSourceOrThrow(metahubId, schemaName, safeSourcePath)
        let existingFileGuard: PreparedModuleSource['existingFileGuard'] = undefined
        if (normalizeModuleStorageMode(existing.storage_mode) === 'file' && existing.source_path) {
            if (existing.source_path === read.sourcePath) {
                const expectedSourceChecksum = this.assertExpectedSourceChecksum(
                    read.sourcePath,
                    read.checksum,
                    input.expectedSourceChecksum
                )
                existingFileGuard = {
                    sourcePath: read.sourcePath,
                    expectedSourceChecksum,
                    currentSourceChecksum: read.checksum
                }
            } else {
                const previous = await this.readFileBackedSourceOrThrow(metahubId, schemaName, existing.source_path)
                const expectedSourceChecksum = this.assertExpectedSourceChecksum(
                    previous.sourcePath,
                    previous.checksum,
                    input.expectedSourceChecksum
                )
                existingFileGuard = {
                    sourcePath: previous.sourcePath,
                    expectedSourceChecksum,
                    currentSourceChecksum: previous.checksum
                }
            }
        }
        return {
            storageMode,
            sourceCode: read.sourceCode,
            sourcePath: read.sourcePath,
            sourceChecksum: read.checksum,
            sourceLastReadAt: new Date(),
            diagnosticFileName: read.sourcePath,
            existingFileGuard
        }
    }

    private async resolveSourceCodeForRow(metahubId: string, schemaName: string, row: StoredMetahubModuleRow): Promise<string> {
        return (await this.resolveSourceForRow(metahubId, schemaName, row)).sourceCode
    }

    private async resolveSourceForRow(
        metahubId: string,
        schemaName: string,
        row: StoredMetahubModuleRow
    ): Promise<{ sourceCode: string; checksum: string | null }> {
        const storageMode = normalizeModuleStorageMode(row.storage_mode)
        if (storageMode === 'inline') {
            const sourceCode = assertInlineSourceCode(row.source_code)
            return { sourceCode, checksum: computeModuleSourceChecksum(sourceCode) }
        }
        await this.ensureFileModeSchemaSupported(schemaName)
        if (!row.source_path) {
            throw new MetahubValidationError('File-backed module source path is missing', {
                moduleId: row.id,
                messageCode: 'modules.sourcePath.missing'
            })
        }
        const read = await this.readFileBackedSourceOrThrow(metahubId, schemaName, row.source_path)
        return { sourceCode: read.sourceCode, checksum: read.checksum }
    }

    private async readFileBackedSourceOrThrow(metahubId: string, schemaName: string, sourcePath: string): Promise<ModuleSourceReadResult> {
        try {
            return await this.sourceFileService.read({ metahubId, branchSlug: schemaName }, sourcePath)
        } catch (error) {
            if (error instanceof MetahubValidationError) {
                throw error
            }

            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                throw new MetahubValidationError('File-backed module source file is missing', {
                    sourcePath,
                    messageCode: 'modules.sourcePath.missing'
                })
            }

            throw new MetahubValidationError('File-backed module source file is unreadable', {
                sourcePath,
                messageCode: 'modules.sourcePath.unreadable'
            })
        }
    }

    private async ensureFileModeSchemaSupported(schemaName: string): Promise<void> {
        const supported = await metahubModulesStorageColumnsAvailable(this.exec, schemaName)
        if (!supported) {
            throw new MetahubValidationError('File-backed module sources require the current metahub module schema', {
                messageCode: 'modules.sourcePath.schemaUnsupported'
            })
        }
    }

    private async ensureUniqueCodename(
        schemaName: string,
        scope: {
            codename: string
            attachedToKind: ModuleAttachmentKind
            attachedToId: string | null
            moduleRole: ModuleRole
        },
        excludeId?: string
    ): Promise<void> {
        const existing = await findStoredMetahubModuleByScope(this.exec, schemaName, scope)
        if (existing && existing.id !== excludeId) {
            throw new MetahubConflictError('Module codename already exists in this attachment scope', scope)
        }
    }

    private async ensureSourcePathAvailable(
        schemaName: string,
        sourcePath: string,
        excludeId?: string,
        executor: SqlQueryable = this.exec
    ): Promise<string> {
        const safeSourcePath = assertSafeRelativeModulePath(sourcePath)
        const existing = await findStoredMetahubModuleBySourcePath(executor, schemaName, safeSourcePath)
        if (existing && existing.id !== excludeId) {
            throw new MetahubConflictError('Module source path is already used by another module', {
                sourcePath: safeSourcePath,
                ownerModuleId: existing.id
            })
        }
        return safeSourcePath
    }

    private async validateAttachment(
        schemaName: string,
        metahubId: string,
        attachedToKind: ModuleAttachmentKind,
        attachedToId: string | null
    ): Promise<string | null> {
        if (!isModuleAttachmentKind(attachedToKind)) {
            throw new MetahubValidationError('Unsupported module attachment kind')
        }

        if (attachedToKind === 'metahub' || attachedToKind === 'general') {
            if (attachedToId && attachedToId !== metahubId) {
                throw new MetahubValidationError(
                    attachedToKind === 'general'
                        ? 'General library modules cannot target a concrete attachment id'
                        : 'Metahub-level modules cannot target a different metahub id'
                )
            }
            return null
        }

        if (!attachedToId) {
            throw new MetahubValidationError('attachedToId is required for object-attached modules')
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
        } else if (attachedToKind === 'component') {
            row = await queryOne<{ id: string }>(
                this.exec,
                `SELECT id FROM ${qSchemaTable(schemaName, '_mhb_components')}
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
            throw new MetahubValidationError('Module attachment target was not found', {
                attachedToKind,
                attachedToId
            })
        }

        return attachedToId
    }

    private async resolveAttachmentObjectKinds(metahubId: string, attachedToKind: ModuleAttachmentKind): Promise<string[]> {
        if (attachedToKind !== 'object') {
            return [attachedToKind]
        }

        const entityTypeService = new EntityTypeService(this.exec, this.schemaService)
        const customTypes = await entityTypeService.listEditableTypes(metahubId)
        const compatibleKinds = customTypes.filter(isObjectCompatibleEntityType).map((entityType) => entityType.kindKey)

        return Array.from(new Set([attachedToKind, ...compatibleKinds]))
    }

    private async findSharedLibraryDependents(
        metahubId: string,
        schemaName: string,
        codename: string,
        excludeModuleId?: string
    ): Promise<
        Array<{
            id: string
            codename: string
            attachedToKind: ModuleAttachmentKind
            attachedToId: string | null
            moduleRole: ModuleRole
        }>
    > {
        const storedModules = await listStoredMetahubModules(this.exec, schemaName)
        const dependents: Array<{
            id: string
            codename: string
            attachedToKind: ModuleAttachmentKind
            attachedToId: string | null
            moduleRole: ModuleRole
        }> = []

        for (const row of storedModules) {
            if (row.id === excludeModuleId) {
                continue
            }
            const module = normalizeModuleRow(row)
            const sourceCode = await this.resolveSourceCodeForRow(metahubId, schemaName, row)
            if (extractSharedModuleImports(sourceCode).includes(codename)) {
                dependents.push(toSharedLibraryDependency(module))
            }
        }

        return dependents
    }

    private async loadSharedLibraries(
        metahubId: string,
        schemaName: string,
        options: {
            currentModuleId?: string
            currentLibrary?: ModuleCompilationLibraryInput
        } = {}
    ): Promise<Record<string, ModuleCompilationLibraryInput>> {
        const libraryRows = await listStoredMetahubModules(this.exec, schemaName, {
            attachedToKind: 'general',
            attachedToId: null,
            onlyActive: true
        })

        const libraries: Record<string, ModuleCompilationLibraryInput> = {}

        for (const row of libraryRows) {
            if (row.id === options.currentModuleId) {
                continue
            }

            const normalized = normalizeModuleRow(row)
            if (!isSharedLibraryScope(normalized.attachedToKind, normalized.attachedToId, normalized.moduleRole)) {
                continue
            }

            const codename = getCodenameText(normalized.codename)
            const sourceCode = await this.resolveSourceCodeForRow(metahubId, schemaName, row)
            libraries[codename] = {
                codename,
                sourceCode,
                diagnosticFileName: normalized.sourcePath ?? undefined
            }
        }

        if (options.currentLibrary) {
            libraries[options.currentLibrary.codename] = options.currentLibrary
        }

        return libraries
    }

    private async compileSource(
        metahubId: string,
        schemaName: string,
        input: {
            codename: string
            sourceCode: string
            diagnosticFileName?: string
            sdkApiVersion?: string
            moduleRole?: ModuleRole
            sourceKind?: ModuleSourceKind
            capabilities?: ModuleCapability[]
        },
        options?: {
            currentModuleId?: string
            attachedToKind?: ModuleAttachmentKind
            attachedToId?: string | null
            sharedLibraries?: Record<string, ModuleCompilationLibraryInput>
            allowedPackageImports?: readonly ModulePackageImport[]
        }
    ) {
        try {
            const moduleRole = normalizeModuleRole(input.moduleRole ?? DEFAULT_MODULE_ROLE)
            const sharedLibraries =
                options?.sharedLibraries ??
                (await this.loadSharedLibraries(metahubId, schemaName, {
                    currentModuleId: options?.currentModuleId,
                    currentLibrary:
                        options?.attachedToKind && isSharedLibraryScope(options.attachedToKind, options.attachedToId ?? null, moduleRole)
                            ? {
                                  codename: input.codename,
                                  sourceCode: input.sourceCode,
                                  diagnosticFileName: input.diagnosticFileName
                              }
                            : undefined
                }))

            return await compileModuleSource({
                codename: input.codename,
                sourceCode: input.sourceCode,
                diagnosticFileName: input.diagnosticFileName,
                sdkApiVersion: input.sdkApiVersion,
                moduleRole,
                sourceKind: input.sourceKind,
                capabilities: input.capabilities,
                sharedLibraries,
                allowedPackageImports: options?.allowedPackageImports
            })
        } catch (error) {
            throw new MetahubValidationError('Module compilation failed', buildCompilationErrorDetails(error))
        }
    }
}
