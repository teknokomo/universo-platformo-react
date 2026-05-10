import {
    assertSupportedScriptSdkApiVersion,
    DEFAULT_SCRIPT_MODULE_ROLE,
    DEFAULT_SCRIPT_SDK_API_VERSION,
    DEFAULT_SCRIPT_SOURCE_KIND,
    normalizeScriptCapabilities,
    normalizeScriptModuleRole,
    normalizeScriptSourceKind,
    type ScriptCapability,
    type ScriptModuleRole,
    type ScriptSourceKind,
    type SupportedScriptSdkApiVersion
} from '@universo/types'
import type { ExtensionScriptMetadata } from './types'

export const EXTENSION_SDK_API_VERSION = DEFAULT_SCRIPT_SDK_API_VERSION
export const EXTENSION_SCRIPT_METADATA = Symbol.for('@universo/extension-sdk/metadata')

export interface ResolvedExtensionScriptMetadata {
    sdkApiVersion: SupportedScriptSdkApiVersion
    moduleRole: ScriptModuleRole
    sourceKind: ScriptSourceKind
    capabilities: ScriptCapability[]
}

type ExtensionScriptConstructor = abstract new (...args: never[]) => object

export const resolveExtensionScriptMetadata = (metadata: ExtensionScriptMetadata = {}): ResolvedExtensionScriptMetadata => {
    const moduleRole = normalizeScriptModuleRole(metadata.moduleRole ?? DEFAULT_SCRIPT_MODULE_ROLE)
    const sourceKind = normalizeScriptSourceKind(metadata.sourceKind ?? DEFAULT_SCRIPT_SOURCE_KIND)

    return {
        sdkApiVersion: assertSupportedScriptSdkApiVersion(metadata.sdkApiVersion ?? EXTENSION_SDK_API_VERSION),
        moduleRole,
        sourceKind,
        capabilities: normalizeScriptCapabilities(moduleRole, metadata.capabilities)
    }
}

export const bindExtensionScriptMetadata = <TClass extends ExtensionScriptConstructor>(
    scriptClass: TClass,
    metadata: ExtensionScriptMetadata = {}
): TClass => {
    Object.defineProperty(scriptClass, EXTENSION_SCRIPT_METADATA, {
        configurable: true,
        enumerable: false,
        writable: false,
        value: resolveExtensionScriptMetadata(metadata)
    })

    return scriptClass
}

export const getBoundExtensionScriptMetadata = (value: unknown): ResolvedExtensionScriptMetadata | null => {
    if (!value || (typeof value !== 'function' && typeof value !== 'object')) {
        return null
    }

    return (value as Record<PropertyKey, unknown>)[EXTENSION_SCRIPT_METADATA] as ResolvedExtensionScriptMetadata | null
}
