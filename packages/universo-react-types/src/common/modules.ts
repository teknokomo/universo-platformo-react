import type { VersionedLocalizedContent } from './admin'

export const MODULE_ATTACHMENT_KINDS = ['metahub', 'object', 'hub', 'set', 'enumeration', 'page', 'ledger', 'component', 'general'] as const
export type KnownModuleAttachmentKind = (typeof MODULE_ATTACHMENT_KINDS)[number]
export type ModuleAttachmentKind = KnownModuleAttachmentKind | (string & {})

export const MODULE_ATTACHMENT_KIND_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/

export const isKnownModuleAttachmentKind = (value: unknown): value is KnownModuleAttachmentKind =>
    typeof value === 'string' && MODULE_ATTACHMENT_KINDS.includes(value as KnownModuleAttachmentKind)

export const isModuleAttachmentKind = (value: unknown): value is ModuleAttachmentKind =>
    typeof value === 'string' && MODULE_ATTACHMENT_KIND_PATTERN.test(value.trim())

export const normalizeModuleAttachmentKind = (value: unknown): ModuleAttachmentKind | null => {
    if (typeof value !== 'string') {
        return null
    }

    const normalized = value.trim()
    return MODULE_ATTACHMENT_KIND_PATTERN.test(normalized) ? (normalized as ModuleAttachmentKind) : null
}

export const MODULE_ROLES = ['module', 'lifecycle', 'widget', 'library'] as const
export type ModuleRole = (typeof MODULE_ROLES)[number]

export const MODULE_SOURCE_KINDS = ['embedded', 'external', 'visual'] as const
export type ModuleSourceKind = (typeof MODULE_SOURCE_KINDS)[number]

export const MODULE_AUTHORING_SOURCE_KINDS = ['embedded'] as const
export type ModuleAuthoringSourceKind = (typeof MODULE_AUTHORING_SOURCE_KINDS)[number]

export const MODULE_CAPABILITIES = [
    'records.read',
    'records.write',
    'metadata.read',
    'rpc.client',
    'lifecycle',
    'posting',
    'ledger.read',
    'ledger.write'
] as const
export type ModuleCapability = (typeof MODULE_CAPABILITIES)[number]

export const MODULE_METHOD_TARGETS = ['server', 'client', 'server_and_client'] as const
export type ModuleMethodTarget = (typeof MODULE_METHOD_TARGETS)[number]

export const isServerModuleMethodTarget = (target: ModuleMethodTarget): boolean => target === 'server' || target === 'server_and_client'

export const isClientModuleMethodTarget = (target: ModuleMethodTarget): boolean => target === 'client' || target === 'server_and_client'

export const MODULE_LIFECYCLE_EVENTS = [
    'beforeCreate',
    'afterCreate',
    'beforeUpdate',
    'afterUpdate',
    'beforeDelete',
    'afterDelete',
    'beforeCopy',
    'afterCopy',
    'beforePost',
    'afterPost',
    'beforeUnpost',
    'afterUnpost',
    'beforeVoid',
    'afterVoid'
] as const
export type ModuleLifecycleEvent = (typeof MODULE_LIFECYCLE_EVENTS)[number]
export type ModuleEventName = ModuleLifecycleEvent | (string & {})

export const DEFAULT_MODULE_SDK_API_VERSION = '1.0.0'
export const SUPPORTED_MODULE_SDK_API_VERSIONS = [DEFAULT_MODULE_SDK_API_VERSION] as const
export type SupportedModuleSdkApiVersion = (typeof SUPPORTED_MODULE_SDK_API_VERSIONS)[number]
export const DEFAULT_MODULE_SOURCE_KIND: ModuleSourceKind = 'embedded'
export const DEFAULT_MODULE_ROLE: ModuleRole = 'module'

const SUPPORTED_MODULE_SDK_API_VERSION_SET = new Set<string>(SUPPORTED_MODULE_SDK_API_VERSIONS)

const MODULE_ALLOWED_CAPABILITIES_BY_ROLE: Record<ModuleRole, readonly ModuleCapability[]> = {
    module: ['records.read', 'records.write', 'metadata.read', 'lifecycle', 'posting', 'ledger.read', 'ledger.write'],
    lifecycle: ['records.read', 'records.write', 'metadata.read', 'lifecycle', 'posting', 'ledger.read', 'ledger.write'],
    widget: ['metadata.read', 'rpc.client'],
    library: ['metadata.read']
}

const MODULE_DEFAULT_CAPABILITIES_BY_ROLE: Record<ModuleRole, readonly ModuleCapability[]> = {
    module: ['records.read', 'metadata.read'],
    lifecycle: ['records.read', 'records.write', 'metadata.read', 'lifecycle'],
    widget: ['metadata.read', 'rpc.client'],
    library: ['metadata.read']
}

export const normalizeModuleRole = (value: unknown): ModuleRole =>
    MODULE_ROLES.includes(value as ModuleRole) ? (value as ModuleRole) : DEFAULT_MODULE_ROLE

export const normalizeModuleSourceKind = (value: unknown): ModuleSourceKind =>
    MODULE_SOURCE_KINDS.includes(value as ModuleSourceKind) ? (value as ModuleSourceKind) : DEFAULT_MODULE_SOURCE_KIND

export const normalizeModuleSdkApiVersion = (value: unknown): string => {
    if (typeof value !== 'string') {
        return DEFAULT_MODULE_SDK_API_VERSION
    }

    const normalized = value.trim()
    return normalized.length > 0 ? normalized : DEFAULT_MODULE_SDK_API_VERSION
}

export const isSupportedModuleSdkApiVersion = (value: unknown): value is SupportedModuleSdkApiVersion => {
    if (typeof value !== 'string') {
        return false
    }

    return SUPPORTED_MODULE_SDK_API_VERSION_SET.has(normalizeModuleSdkApiVersion(value))
}

export const assertSupportedModuleSdkApiVersion = (value: unknown): SupportedModuleSdkApiVersion => {
    const sdkApiVersion = normalizeModuleSdkApiVersion(value)

    if (!SUPPORTED_MODULE_SDK_API_VERSION_SET.has(sdkApiVersion)) {
        throw new Error(
            `Unsupported module sdkApiVersion "${sdkApiVersion}". Supported versions: ${SUPPORTED_MODULE_SDK_API_VERSIONS.join(', ')}`
        )
    }

    return sdkApiVersion as SupportedModuleSdkApiVersion
}

export const resolveModuleSdkApiVersion = (params: {
    sdkApiVersion?: unknown
    manifestSdkApiVersion?: unknown
}): SupportedModuleSdkApiVersion => {
    const sdkApiVersion = assertSupportedModuleSdkApiVersion(params.sdkApiVersion)
    const manifestSdkApiVersion = assertSupportedModuleSdkApiVersion(params.manifestSdkApiVersion ?? sdkApiVersion)

    if (manifestSdkApiVersion !== sdkApiVersion) {
        throw new Error(`Module sdkApiVersion mismatch between record and manifest: ${sdkApiVersion} !== ${manifestSdkApiVersion}`)
    }

    return sdkApiVersion
}

export const resolveAllowedModuleCapabilities = (moduleRole: unknown): ModuleCapability[] => [
    ...MODULE_ALLOWED_CAPABILITIES_BY_ROLE[normalizeModuleRole(moduleRole)]
]

export const resolveDefaultModuleCapabilities = (moduleRole: unknown): ModuleCapability[] => [
    ...MODULE_DEFAULT_CAPABILITIES_BY_ROLE[normalizeModuleRole(moduleRole)]
]

export const findDisallowedModuleCapabilities = (moduleRole: unknown, capabilities: unknown): string[] => {
    if (!Array.isArray(capabilities)) {
        return []
    }

    const allowedCapabilities = new Set(resolveAllowedModuleCapabilities(moduleRole))
    return capabilities.filter((item): item is string => typeof item === 'string' && !allowedCapabilities.has(item as ModuleCapability))
}

export const normalizeModuleCapabilities = (moduleRole: unknown, capabilities?: unknown): ModuleCapability[] => {
    const requested =
        capabilities === undefined
            ? resolveDefaultModuleCapabilities(moduleRole)
            : Array.isArray(capabilities)
            ? capabilities.filter((item): item is string => typeof item === 'string')
            : []

    const knownCapabilities = new Set<ModuleCapability>(MODULE_CAPABILITIES)
    const allowedCapabilities = new Set(resolveAllowedModuleCapabilities(moduleRole))
    const normalized: ModuleCapability[] = []

    for (const capability of requested) {
        if (!knownCapabilities.has(capability as ModuleCapability)) {
            continue
        }

        const normalizedCapability = capability as ModuleCapability
        if (!allowedCapabilities.has(normalizedCapability) || normalized.includes(normalizedCapability)) {
            continue
        }

        normalized.push(normalizedCapability)
    }

    return normalized
}

export const hasModuleCapability = (
    manifest: { moduleRole?: unknown; capabilities?: unknown } | null | undefined,
    capability: ModuleCapability
): boolean => normalizeModuleCapabilities(manifest?.moduleRole, manifest?.capabilities).includes(capability)

export interface ModuleMethodManifest {
    name: string
    target: ModuleMethodTarget
    eventName?: string | null
}

export const canCallModuleMethodOverPublicRpc = (
    manifest: { moduleRole?: unknown; capabilities?: unknown } | null | undefined,
    method: Pick<ModuleMethodManifest, 'target' | 'eventName'> | null | undefined
): boolean =>
    Boolean(method) && isServerModuleMethodTarget(method.target) && !method.eventName && hasModuleCapability(manifest, 'rpc.client')

export interface ModuleManifest {
    className: string
    sdkApiVersion: string
    moduleRole: ModuleRole
    sourceKind: ModuleSourceKind
    capabilities: ModuleCapability[]
    methods: ModuleMethodManifest[]
    checksum?: string
}

export interface ModuleCompilationInput {
    codename: string
    sourceCode: string
    sdkApiVersion?: string
    moduleRole?: ModuleRole
    sourceKind?: ModuleSourceKind
    capabilities?: ModuleCapability[]
    sharedLibraries?: Record<string, ModuleCompilationLibraryInput>
}

export interface ModuleCompilationLibraryInput {
    codename: string
    sourceCode: string
}

export interface CompiledModuleArtifact {
    manifest: ModuleManifest
    serverBundle: string
    clientBundle: string
    checksum: string
}

export interface ModulePresentation {
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string> | null
}

export interface MetahubModuleDefinition {
    id: string
    codename: VersionedLocalizedContent<string>
    presentation: ModulePresentation
    attachedToKind: ModuleAttachmentKind
    attachedToId: string | null
    moduleRole: ModuleRole
    sourceKind: ModuleSourceKind
    sdkApiVersion: string
    sourceCode: string
    manifest: ModuleManifest
    serverBundle: string | null
    clientBundle: string | null
    checksum: string
    isActive: boolean
    config?: Record<string, unknown>
}

export interface MetahubModuleRecord extends MetahubModuleDefinition {
    version: number
    updatedAt?: string | null
}

export interface ApplicationModuleDefinition {
    id: string
    codename: string
    presentation: ModulePresentation
    attachedToKind: ModuleAttachmentKind
    attachedToId: string | null
    moduleRole: ModuleRole
    sourceKind: ModuleSourceKind
    sdkApiVersion: string
    manifest: ModuleManifest
    serverBundle: string | null
    clientBundle: string | null
    checksum: string
    isActive: boolean
    config?: Record<string, unknown>
}

export interface ModuleLifecyclePayload {
    eventName: ModuleLifecycleEvent
    entityCodename: string
    row?: Record<string, unknown> | null
    previousRow?: Record<string, unknown> | null
    patch?: Record<string, unknown> | null
    metadata?: Record<string, unknown>
}

export interface ModulePostingMovementFact {
    data: Record<string, unknown>
}

export interface ModulePostingMovement {
    ledgerCodename: string
    facts: ModulePostingMovementFact[]
}

export interface ModulePostingMovementResult {
    movements: ModulePostingMovement[]
}

export interface RuntimeModuleCallRequest {
    methodName: string
    args: unknown[]
}

export interface RuntimeModuleCallResponse {
    result: unknown
}
