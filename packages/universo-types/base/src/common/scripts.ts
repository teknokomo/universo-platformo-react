import type { VersionedLocalizedContent } from './admin'

export const SCRIPT_ATTACHMENT_KINDS = ['metahub', 'catalog', 'hub', 'set', 'enumeration', 'attribute', 'general'] as const
export type KnownScriptAttachmentKind = (typeof SCRIPT_ATTACHMENT_KINDS)[number]
export type ScriptAttachmentKind = KnownScriptAttachmentKind | (string & {})

export const SCRIPT_ATTACHMENT_KIND_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/

export const isKnownScriptAttachmentKind = (value: unknown): value is KnownScriptAttachmentKind =>
    typeof value === 'string' && SCRIPT_ATTACHMENT_KINDS.includes(value as KnownScriptAttachmentKind)

export const isScriptAttachmentKind = (value: unknown): value is ScriptAttachmentKind =>
    typeof value === 'string' && SCRIPT_ATTACHMENT_KIND_PATTERN.test(value.trim())

export const normalizeScriptAttachmentKind = (value: unknown): ScriptAttachmentKind | null => {
    if (typeof value !== 'string') {
        return null
    }

    const normalized = value.trim()
    return SCRIPT_ATTACHMENT_KIND_PATTERN.test(normalized) ? (normalized as ScriptAttachmentKind) : null
}

export const SCRIPT_MODULE_ROLES = ['module', 'lifecycle', 'widget', 'library'] as const
export type ScriptModuleRole = (typeof SCRIPT_MODULE_ROLES)[number]

export const SCRIPT_SOURCE_KINDS = ['embedded', 'external', 'visual'] as const
export type ScriptSourceKind = (typeof SCRIPT_SOURCE_KINDS)[number]

export const SCRIPT_AUTHORING_SOURCE_KINDS = ['embedded'] as const
export type ScriptAuthoringSourceKind = (typeof SCRIPT_AUTHORING_SOURCE_KINDS)[number]

export const SCRIPT_CAPABILITIES = ['records.read', 'records.write', 'metadata.read', 'rpc.client', 'lifecycle'] as const
export type ScriptCapability = (typeof SCRIPT_CAPABILITIES)[number]

export const SCRIPT_METHOD_TARGETS = ['server', 'client', 'server_and_client'] as const
export type ScriptMethodTarget = (typeof SCRIPT_METHOD_TARGETS)[number]

export const isServerScriptMethodTarget = (target: ScriptMethodTarget): boolean => target === 'server' || target === 'server_and_client'

export const isClientScriptMethodTarget = (target: ScriptMethodTarget): boolean => target === 'client' || target === 'server_and_client'

export const SCRIPT_LIFECYCLE_EVENTS = [
    'beforeCreate',
    'afterCreate',
    'beforeUpdate',
    'afterUpdate',
    'beforeDelete',
    'afterDelete',
    'beforeCopy',
    'afterCopy'
] as const
export type ScriptLifecycleEvent = (typeof SCRIPT_LIFECYCLE_EVENTS)[number]
export type ScriptEventName = ScriptLifecycleEvent | (string & {})

export const DEFAULT_SCRIPT_SDK_API_VERSION = '1.0.0'
export const SUPPORTED_SCRIPT_SDK_API_VERSIONS = [DEFAULT_SCRIPT_SDK_API_VERSION] as const
export type SupportedScriptSdkApiVersion = (typeof SUPPORTED_SCRIPT_SDK_API_VERSIONS)[number]
export const DEFAULT_SCRIPT_SOURCE_KIND: ScriptSourceKind = 'embedded'
export const DEFAULT_SCRIPT_MODULE_ROLE: ScriptModuleRole = 'module'

const SUPPORTED_SCRIPT_SDK_API_VERSION_SET = new Set<string>(SUPPORTED_SCRIPT_SDK_API_VERSIONS)

const SCRIPT_ALLOWED_CAPABILITIES_BY_ROLE: Record<ScriptModuleRole, readonly ScriptCapability[]> = {
    module: ['records.read', 'records.write', 'metadata.read', 'lifecycle'],
    lifecycle: ['records.read', 'records.write', 'metadata.read', 'lifecycle'],
    widget: ['metadata.read', 'rpc.client'],
    library: ['metadata.read']
}

const SCRIPT_DEFAULT_CAPABILITIES_BY_ROLE: Record<ScriptModuleRole, readonly ScriptCapability[]> = {
    module: ['records.read', 'metadata.read'],
    lifecycle: ['records.read', 'records.write', 'metadata.read', 'lifecycle'],
    widget: ['metadata.read', 'rpc.client'],
    library: ['metadata.read']
}

export const normalizeScriptModuleRole = (value: unknown): ScriptModuleRole =>
    value === 'global' || value === 'library'
        ? 'library'
        : SCRIPT_MODULE_ROLES.includes(value as ScriptModuleRole)
        ? (value as ScriptModuleRole)
        : DEFAULT_SCRIPT_MODULE_ROLE

export const normalizeScriptSourceKind = (value: unknown): ScriptSourceKind =>
    SCRIPT_SOURCE_KINDS.includes(value as ScriptSourceKind) ? (value as ScriptSourceKind) : DEFAULT_SCRIPT_SOURCE_KIND

export const normalizeScriptSdkApiVersion = (value: unknown): string => {
    if (typeof value !== 'string') {
        return DEFAULT_SCRIPT_SDK_API_VERSION
    }

    const normalized = value.trim()
    return normalized.length > 0 ? normalized : DEFAULT_SCRIPT_SDK_API_VERSION
}

export const isSupportedScriptSdkApiVersion = (value: unknown): value is SupportedScriptSdkApiVersion => {
    if (typeof value !== 'string') {
        return false
    }

    return SUPPORTED_SCRIPT_SDK_API_VERSION_SET.has(normalizeScriptSdkApiVersion(value))
}

export const assertSupportedScriptSdkApiVersion = (value: unknown): SupportedScriptSdkApiVersion => {
    const sdkApiVersion = normalizeScriptSdkApiVersion(value)

    if (!SUPPORTED_SCRIPT_SDK_API_VERSION_SET.has(sdkApiVersion)) {
        throw new Error(
            `Unsupported script sdkApiVersion "${sdkApiVersion}". Supported versions: ${SUPPORTED_SCRIPT_SDK_API_VERSIONS.join(', ')}`
        )
    }

    return sdkApiVersion as SupportedScriptSdkApiVersion
}

export const resolveScriptSdkApiVersion = (params: {
    sdkApiVersion?: unknown
    manifestSdkApiVersion?: unknown
}): SupportedScriptSdkApiVersion => {
    const sdkApiVersion = assertSupportedScriptSdkApiVersion(params.sdkApiVersion)
    const manifestSdkApiVersion = assertSupportedScriptSdkApiVersion(params.manifestSdkApiVersion ?? sdkApiVersion)

    if (manifestSdkApiVersion !== sdkApiVersion) {
        throw new Error(`Script sdkApiVersion mismatch between record and manifest: ${sdkApiVersion} !== ${manifestSdkApiVersion}`)
    }

    return sdkApiVersion
}

export const resolveAllowedScriptCapabilities = (moduleRole: unknown): ScriptCapability[] => [
    ...SCRIPT_ALLOWED_CAPABILITIES_BY_ROLE[normalizeScriptModuleRole(moduleRole)]
]

export const resolveDefaultScriptCapabilities = (moduleRole: unknown): ScriptCapability[] => [
    ...SCRIPT_DEFAULT_CAPABILITIES_BY_ROLE[normalizeScriptModuleRole(moduleRole)]
]

export const findDisallowedScriptCapabilities = (moduleRole: unknown, capabilities: unknown): string[] => {
    if (!Array.isArray(capabilities)) {
        return []
    }

    const allowedCapabilities = new Set(resolveAllowedScriptCapabilities(moduleRole))
    return capabilities.filter((item): item is string => typeof item === 'string' && !allowedCapabilities.has(item as ScriptCapability))
}

export const normalizeScriptCapabilities = (moduleRole: unknown, capabilities?: unknown): ScriptCapability[] => {
    const requested =
        capabilities === undefined
            ? resolveDefaultScriptCapabilities(moduleRole)
            : Array.isArray(capabilities)
            ? capabilities.filter((item): item is string => typeof item === 'string')
            : []

    const knownCapabilities = new Set<ScriptCapability>(SCRIPT_CAPABILITIES)
    const allowedCapabilities = new Set(resolveAllowedScriptCapabilities(moduleRole))
    const normalized: ScriptCapability[] = []

    for (const capability of requested) {
        if (!knownCapabilities.has(capability as ScriptCapability)) {
            continue
        }

        const normalizedCapability = capability as ScriptCapability
        if (!allowedCapabilities.has(normalizedCapability) || normalized.includes(normalizedCapability)) {
            continue
        }

        normalized.push(normalizedCapability)
    }

    return normalized
}

export const hasScriptCapability = (
    manifest: { moduleRole?: unknown; capabilities?: unknown } | null | undefined,
    capability: ScriptCapability
): boolean => normalizeScriptCapabilities(manifest?.moduleRole, manifest?.capabilities).includes(capability)

export interface ScriptMethodManifest {
    name: string
    target: ScriptMethodTarget
    eventName?: string | null
}

export const canCallScriptMethodOverPublicRpc = (
    manifest: { moduleRole?: unknown; capabilities?: unknown } | null | undefined,
    method: Pick<ScriptMethodManifest, 'target' | 'eventName'> | null | undefined
): boolean =>
    Boolean(method) && isServerScriptMethodTarget(method.target) && !method.eventName && hasScriptCapability(manifest, 'rpc.client')

export interface ScriptManifest {
    className: string
    sdkApiVersion: string
    moduleRole: ScriptModuleRole
    sourceKind: ScriptSourceKind
    capabilities: ScriptCapability[]
    methods: ScriptMethodManifest[]
    checksum?: string
}

export interface ScriptCompilationInput {
    codename: string
    sourceCode: string
    sdkApiVersion?: string
    moduleRole?: ScriptModuleRole
    sourceKind?: ScriptSourceKind
    capabilities?: ScriptCapability[]
    sharedLibraries?: Record<string, ScriptCompilationLibraryInput>
}

export interface ScriptCompilationLibraryInput {
    codename: string
    sourceCode: string
}

export interface CompiledScriptArtifact {
    manifest: ScriptManifest
    serverBundle: string
    clientBundle: string
    checksum: string
}

export interface ScriptPresentation {
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string> | null
}

export interface MetahubScriptDefinition {
    id: string
    codename: VersionedLocalizedContent<string>
    presentation: ScriptPresentation
    attachedToKind: ScriptAttachmentKind
    attachedToId: string | null
    moduleRole: ScriptModuleRole
    sourceKind: ScriptSourceKind
    sdkApiVersion: string
    sourceCode: string
    manifest: ScriptManifest
    serverBundle: string | null
    clientBundle: string | null
    checksum: string
    isActive: boolean
    config?: Record<string, unknown>
}

export interface MetahubScriptRecord extends MetahubScriptDefinition {
    version: number
    updatedAt?: string | null
}

export interface ApplicationScriptDefinition {
    id: string
    codename: string
    presentation: ScriptPresentation
    attachedToKind: ScriptAttachmentKind
    attachedToId: string | null
    moduleRole: ScriptModuleRole
    sourceKind: ScriptSourceKind
    sdkApiVersion: string
    manifest: ScriptManifest
    serverBundle: string | null
    clientBundle: string | null
    checksum: string
    isActive: boolean
    config?: Record<string, unknown>
}

export interface ScriptLifecyclePayload {
    eventName: ScriptLifecycleEvent
    entityCodename: string
    row?: Record<string, unknown> | null
    previousRow?: Record<string, unknown> | null
    patch?: Record<string, unknown> | null
    metadata?: Record<string, unknown>
}

export interface RuntimeScriptCallRequest {
    methodName: string
    args: unknown[]
}

export interface RuntimeScriptCallResponse {
    result: unknown
}
