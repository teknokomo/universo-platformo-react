import {
    assertSupportedModuleSdkApiVersion,
    DEFAULT_MODULE_ROLE,
    DEFAULT_MODULE_SDK_API_VERSION,
    DEFAULT_MODULE_SOURCE_KIND,
    normalizeModuleCapabilities,
    normalizeModuleRole,
    normalizeModuleSourceKind,
    type ModuleCapability,
    type ModuleRole,
    type ModuleSourceKind,
    type SupportedModuleSdkApiVersion
} from '@universo/types'
import type { ExtensionModuleMetadata } from './types'

export const EXTENSION_SDK_API_VERSION = DEFAULT_MODULE_SDK_API_VERSION
export const EXTENSION_MODULE_METADATA = Symbol.for('@universo/extension-sdk/metadata')

export interface ResolvedExtensionModuleMetadata {
    sdkApiVersion: SupportedModuleSdkApiVersion
    moduleRole: ModuleRole
    sourceKind: ModuleSourceKind
    capabilities: ModuleCapability[]
}

type ExtensionModuleConstructor = abstract new (...args: never[]) => object

export const resolveExtensionModuleMetadata = (metadata: ExtensionModuleMetadata = {}): ResolvedExtensionModuleMetadata => {
    const moduleRole = normalizeModuleRole(metadata.moduleRole ?? DEFAULT_MODULE_ROLE)
    const sourceKind = normalizeModuleSourceKind(metadata.sourceKind ?? DEFAULT_MODULE_SOURCE_KIND)

    return {
        sdkApiVersion: assertSupportedModuleSdkApiVersion(metadata.sdkApiVersion ?? EXTENSION_SDK_API_VERSION),
        moduleRole,
        sourceKind,
        capabilities: normalizeModuleCapabilities(moduleRole, metadata.capabilities)
    }
}

export const bindExtensionModuleMetadata = <TClass extends ExtensionModuleConstructor>(
    moduleClass: TClass,
    metadata: ExtensionModuleMetadata = {}
): TClass => {
    Object.defineProperty(moduleClass, EXTENSION_MODULE_METADATA, {
        configurable: true,
        enumerable: false,
        writable: false,
        value: resolveExtensionModuleMetadata(metadata)
    })

    return moduleClass
}

export const getBoundExtensionModuleMetadata = (value: unknown): ResolvedExtensionModuleMetadata | null => {
    if (!value || (typeof value !== 'function' && typeof value !== 'object')) {
        return null
    }

    return (value as Record<PropertyKey, unknown>)[EXTENSION_MODULE_METADATA] as ResolvedExtensionModuleMetadata | null
}
