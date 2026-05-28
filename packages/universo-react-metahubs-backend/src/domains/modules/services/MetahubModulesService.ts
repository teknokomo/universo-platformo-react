import { qSchemaTable } from '@universo-react/database'
import { compileModuleSource, extractSharedModuleImports } from '@universo-react/modules-engine'
import {
    assertSupportedModuleSdkApiVersion,
    DEFAULT_MODULE_ROLE,
    DEFAULT_MODULE_SDK_API_VERSION,
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
    type ModuleSourceKind,
    isModuleAttachmentKind,
    normalizeModuleCapabilities,
    normalizeModulePackageImports,
    normalizeModuleRole,
    normalizeModuleSourceKind,
    resolveModuleSdkApiVersion
} from '@universo-react/types'
import { queryOne, type DbExecutor, type SqlQueryable } from '@universo-react/utils/database'
import { isValidCodenameForStyle, normalizeCodenameForStyle } from '@universo-react/utils/validation/codename'
import { incrementVersion } from '../../../utils/optimisticLock'
import { getCodenameText } from '../../shared/codename'
import { MetahubConflictError, MetahubNotFoundError, MetahubValidationError } from '../../shared/domainErrors'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { EntityTypeService } from '../../entities/services/EntityTypeService'
import {
    findStoredMetahubModuleByScope,
    findStoredMetahubModuleById,
    insertStoredMetahubModule,
    listStoredMetahubModules,
    METAHUB_MODULES_TABLE,
    type StoredMetahubModuleRow
} from './modulesStore'
import { createCodenameVLC, createLocalizedContent, ensureCodenameVLC } from '@universo-react/utils'
import { listMetahubPackages } from '../../../persistence'

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
    sourceCode: string
    isActive?: boolean
    capabilities?: string[]
    config?: Record<string, unknown>
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
    isActive?: boolean
    capabilities?: string[]
    config?: Record<string, unknown>
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

const buildSharedLibraryCompilationMap = (entries: PublishedModuleEntry[]): Record<string, ModuleCompilationLibraryInput> => {
    const libraries: Record<string, ModuleCompilationLibraryInput> = {}

    for (const { module } of entries) {
        if (!isSharedLibraryScope(module.attachedToKind, module.attachedToId, module.moduleRole)) {
            continue
        }

        const codename = getCodenameText(module.codename)
        libraries[codename] = {
            codename,
            sourceCode: module.sourceCode
        }
    }

    return libraries
}

const resolveSharedLibraryPublicationOrder = (entries: PublishedModuleEntry[]): PublishedModuleEntry[] => {
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
        for (const dependency of extractSharedModuleImports(entry.module.sourceCode)) {
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

export class MetahubModulesService {
    constructor(private readonly exec: DbExecutor, private readonly schemaService: MetahubSchemaService) {}

    private async listAllowedPackageImports(metahubId: string): Promise<ModulePackageImport[]> {
        const packages = await listMetahubPackages(this.exec, metahubId)
        return packages.map((item) => ({
            packageName: item.packageName,
            version: item.version,
            targets: item.source.runtimeTargets
        }))
    }

    async listModules(metahubId: string, options: ListMetahubModulesOptions = {}, userId?: string): Promise<MetahubModuleRecord[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const rows = await listStoredMetahubModules(this.exec, schemaName, options)
        return rows.map(normalizeModuleRow)
    }

    async listPublishedModules(metahubId: string, userId?: string): Promise<MetahubModuleRecord[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const allowedPackageImports = await this.listAllowedPackageImports(metahubId)
        const storedModules = await listStoredMetahubModules(this.exec, schemaName, { onlyActive: true })
        const modules = sortPublishedModuleEntries(
            storedModules.map((row) => ({ row, module: normalizeModuleRow(row) })).filter(({ module }) => module.isActive)
        )
        const publishedModules: MetahubModuleRecord[] = []
        const sharedLibraries = buildSharedLibraryCompilationMap(modules)
        const orderedSharedLibraryModules = (() => {
            try {
                return resolveSharedLibraryPublicationOrder(modules)
            } catch (error) {
                throw new MetahubValidationError('Module compilation failed', buildCompilationErrorDetails(error))
            }
        })()

        for (const { module } of orderedSharedLibraryModules) {
            await this.compileSource(
                schemaName,
                {
                    codename: getCodenameText(module.codename),
                    sourceCode: module.sourceCode,
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
        }

        for (const { module } of modules) {
            if (isSharedLibraryScope(module.attachedToKind, module.attachedToId, module.moduleRole)) {
                continue
            }

            const compiled = await this.compileSource(
                schemaName,
                {
                    codename: getCodenameText(module.codename),
                    sourceCode: module.sourceCode,
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

            publishedModules.push({
                ...module,
                manifest: compiled.manifest,
                serverBundle: compiled.serverBundle,
                clientBundle: compiled.clientBundle,
                checksum: compiled.checksum
            })
        }

        return publishedModules
    }

    async getModuleById(metahubId: string, moduleId: string, userId?: string): Promise<MetahubModuleRecord | null> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        return this.getModuleByIdInSchema(schemaName, moduleId)
    }

    async getModuleByIdInSchema(
        schemaName: string,
        moduleId: string,
        executor: SqlQueryable = this.exec
    ): Promise<MetahubModuleRecord | null> {
        const row = await findStoredMetahubModuleById(executor, schemaName, moduleId)
        return row ? normalizeModuleRow(row) : null
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
                attachedToId: attachment,
                allowedPackageImports
            }
        )

        const created = await insertStoredMetahubModule(this.exec, schemaName, {
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

        return normalizeModuleRow(created)
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
            const dependents = await this.findSharedLibraryDependents(schemaName, existingCodename, moduleId)
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
        const nextSourceCode = input.sourceCode ?? existing.source_code
        const existingManifest = ensureManifest(existing.manifest)
        const nextCapabilities =
            input.capabilities !== undefined
                ? resolveModuleCapabilities(nextModuleRole, input.capabilities)
                : existingManifest.capabilities ?? resolveModuleCapabilities(nextModuleRole)

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
                      currentModuleId: moduleId,
                      attachedToKind: nextAttachmentKind,
                      attachedToId: nextAttachmentId,
                      allowedPackageImports
                  }
              )
            : null

        const updated = await incrementVersion(this.exec, schemaName, METAHUB_MODULES_TABLE, moduleId, {
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

        return normalizeModuleRow(updated as unknown as StoredMetahubModuleRow)
    }

    async deleteModule(metahubId: string, moduleId: string, userId?: string): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const existing = await findStoredMetahubModuleById(this.exec, schemaName, moduleId)
        if (!existing) {
            throw new MetahubNotFoundError('Module', moduleId)
        }

        if (isSharedLibraryScope(existing.attached_to_kind, existing.attached_to_id ?? null, existing.module_role)) {
            const dependents = await this.findSharedLibraryDependents(schemaName, getCodenameText(existing.codename), moduleId)
            if (dependents.length > 0) {
                throw new MetahubConflictError('Shared library is still imported by other modules', {
                    codename: getCodenameText(existing.codename),
                    dependents
                })
            }
        }

        await incrementVersion(this.exec, schemaName, METAHUB_MODULES_TABLE, moduleId, {
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

        return storedModules
            .filter((row) => row.id !== excludeModuleId)
            .map(normalizeModuleRow)
            .filter((module) => extractSharedModuleImports(module.sourceCode).includes(codename))
            .map(toSharedLibraryDependency)
    }

    private async loadSharedLibraries(
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
                (await this.loadSharedLibraries(schemaName, {
                    currentModuleId: options?.currentModuleId,
                    currentLibrary:
                        options?.attachedToKind && isSharedLibraryScope(options.attachedToKind, options.attachedToId ?? null, moduleRole)
                            ? {
                                  codename: input.codename,
                                  sourceCode: input.sourceCode
                              }
                            : undefined
                }))

            return await compileModuleSource({
                codename: input.codename,
                sourceCode: input.sourceCode,
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
