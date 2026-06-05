import type { VersionedLocalizedContent } from './admin'
import type { PlayCanvasEditorHostBridgeDescriptor } from './playcanvasEditorBridge'

export const METAHUB_PACKAGE_SOURCE_KINDS = ['workspace'] as const
export type MetahubPackageSourceKind = (typeof METAHUB_PACKAGE_SOURCE_KINDS)[number]

export const METAHUB_PACKAGE_RUNTIME_TARGETS = ['server', 'client'] as const
export type MetahubPackageRuntimeTarget = (typeof METAHUB_PACKAGE_RUNTIME_TARGETS)[number]

export const PACKAGE_AUTHORING_SURFACE_KINDS = ['none', 'playcanvasEditor'] as const
export type PackageAuthoringSurfaceKind = (typeof PACKAGE_AUTHORING_SURFACE_KINDS)[number]

export const PACKAGE_DISPLAY_MODES = ['disabled', 'embeddedIframe', 'openSeparately', 'developmentUrl'] as const
export type PackageDisplayMode = (typeof PACKAGE_DISPLAY_MODES)[number]

export const PLAYCANVAS_EDITOR_ARTIFACT_MODES = ['artifact-only', 'universo-hosted'] as const
export type PlayCanvasEditorArtifactMode = (typeof PLAYCANVAS_EDITOR_ARTIFACT_MODES)[number]

export interface PackageAttachmentEmptyConfig {
    schemaVersion: '1'
    kind: 'none'
}

export interface PackageAttachmentDisplayConfig {
    schemaVersion: '1'
    kind: 'display'
    display: {
        mode: PackageDisplayMode
        developmentUrl?: string | null
        showArtifactOnlyNotice: boolean
    }
    playcanvasProject?: {
        defaultProjectId?: string | null
    }
}

export type PackageAttachmentConfig = PackageAttachmentEmptyConfig | PackageAttachmentDisplayConfig

export interface PackageAuthoringSurfaceNoneDescriptor {
    schemaVersion: '1'
    kind: 'none'
    supportedDisplayModes: readonly []
    defaultConfig: PackageAttachmentEmptyConfig
}

export interface PlayCanvasEditorAuthoringSurfaceDescriptor {
    schemaVersion: '1'
    kind: 'playcanvasEditor'
    packageSlug: string
    supportedDisplayModes: readonly PackageDisplayMode[]
    defaultConfig: PackageAttachmentDisplayConfig
    artifact?: {
        packageName: '@universo-react/playcanvas-editor-frontend'
        manifestFileName: 'universo-artifact-manifest.json'
        outputRoot: 'dist/editor'
        smokeMode: PlayCanvasEditorArtifactMode
        mode?: PlayCanvasEditorArtifactMode
    }
}

export type PackageAuthoringSurfaceDescriptor = PackageAuthoringSurfaceNoneDescriptor | PlayCanvasEditorAuthoringSurfaceDescriptor

export type PackageArtifactStatus = 'available' | 'missing' | 'disabled' | 'blocked' | 'misconfigured'

export interface PackageAuthoringHostDescriptor {
    metahubId: string
    packageSlug: string
    packageName: string
    version: string
    displayName: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string> | null
    attachmentConfig: PackageAttachmentConfig
    authoringSurface: PackageAuthoringSurfaceDescriptor
    allowedDisplayModes: readonly PackageDisplayMode[]
    artifactStatus: PackageArtifactStatus
    artifactUrl?: string | null
    playcanvasEditor?: PlayCanvasEditorHostBridgeDescriptor | null
}

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
    authoringSurface: PackageAuthoringSurfaceDescriptor
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
    authoringSurface: PackageAuthoringSurfaceDescriptor
    config: PackageAttachmentConfig
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
    resetConfig?: boolean
}

export interface UpdateMetahubPackageConfigRequest {
    config: PackageAttachmentConfig
}

export interface MetahubSnapshotPackage {
    packageName: string
    version: string
    source: PackageSourceDescriptor
    config?: PackageAttachmentConfig
}

export interface ApplicationPackageDefinition extends Omit<MetahubSnapshotPackage, 'config'> {
    isActive: boolean
}
