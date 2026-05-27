import type { VersionedLocalizedContent } from './admin'

export const METAHUB_PACKAGE_SOURCE_KINDS = ['workspace'] as const
export type MetahubPackageSourceKind = (typeof METAHUB_PACKAGE_SOURCE_KINDS)[number]

export const METAHUB_PACKAGE_RUNTIME_TARGETS = ['server', 'client'] as const
export type MetahubPackageRuntimeTarget = (typeof METAHUB_PACKAGE_RUNTIME_TARGETS)[number]

export interface PackageSourceDescriptor {
    kind: MetahubPackageSourceKind
    packageName: string
    importName: string
    upstreamPackageName: string
    upstreamVersion: string
    runtimeTargets: readonly MetahubPackageRuntimeTarget[]
}

export interface MetahubPackageRegistryItem {
    id: string
    packageName: string
    version: string
    displayName: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string> | null
    source: PackageSourceDescriptor
    isActive: boolean
}

export interface MetahubPackageAttachment {
    id: string
    metahubId: string
    packageId: string
    packageName: string
    version: string
    displayName: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string> | null
    source: PackageSourceDescriptor
    attachedAt: string
    isActive: boolean
}

export interface MetahubPackageCatalogItem extends MetahubPackageRegistryItem {
    attached: boolean
    attachedPackageId?: string | null
    attachedVersion?: string | null
    attachmentId?: string | null
}

export interface AttachMetahubPackageRequest {
    packageName: string
    version: string
}

export interface ChangeMetahubPackageVersionRequest {
    version: string
}

export interface MetahubSnapshotPackage {
    packageName: string
    version: string
    source: PackageSourceDescriptor
}

export interface ApplicationPackageDefinition extends MetahubSnapshotPackage {
    isActive: boolean
}
