import { z } from 'zod'
import type { VersionedLocalizedContent } from './admin'
import { CodenameVLCSchema, LocalizedStringOptionalSchema, LocalizedStringSchema } from '../validation/vlc'

export const PLAYCANVAS_PROJECT_SCHEMA_VERSION = '1' as const
export const PLAYCANVAS_RUNTIME_MANIFEST_SCHEMA_VERSION = '1' as const
export const PLAYCANVAS_PROJECT_SNAPSHOT_SCHEMA_VERSION = 1 as const
export const PLAYCANVAS_EDITOR_PACKAGE_NAME = '@universo-react/playcanvas-editor-frontend' as const
export const PLAYCANVAS_PROJECT_FILE_ROOT = 'playcanvas-projects' as const
export const PLAYCANVAS_PROJECT_FILE_MAX_BYTES = 5 * 1024 * 1024
export const PLAYCANVAS_PROJECT_FILE_BASE64_MAX_CHARS = Math.ceil((PLAYCANVAS_PROJECT_FILE_MAX_BYTES * 4) / 3) + 4
export const PLAYCANVAS_PROJECT_ALLOWED_MIME_TYPES = [
    'application/json',
    'text/javascript',
    'application/javascript',
    'image/png',
    'image/jpeg',
    'image/webp'
] as const
export const PLAYCANVAS_PROJECT_JSON_MIME_TYPES = ['application/json'] as const
export const PLAYCANVAS_PROJECT_SCRIPT_MIME_TYPES = ['text/javascript', 'application/javascript'] as const
export const PLAYCANVAS_PROJECT_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const PLAYCANVAS_PROJECT_JSON_EXTENSIONS = ['.json'] as const
export const PLAYCANVAS_PROJECT_SCRIPT_EXTENSIONS = ['.js', '.mjs'] as const
export const PLAYCANVAS_PROJECT_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'] as const
export const PLAYCANVAS_PROJECT_SCENE_PATH_SEGMENT = '/scenes/' as const
export const PLAYCANVAS_PROJECT_ASSET_PATH_SEGMENT = '/assets/' as const
export const PLAYCANVAS_PROJECT_GENERATED_PATH_SEGMENT = '/generated/' as const
export const PLAYCANVAS_PROJECT_SOURCEFILES_PATH_SEGMENT = '/sourcefiles/' as const

export const PLAYCANVAS_PROJECT_COMPATIBILITY_STATUSES = ['compatible', 'needsMigration', 'unsupported', 'blocked'] as const
export type PlayCanvasProjectCompatibilityStatus = (typeof PLAYCANVAS_PROJECT_COMPATIBILITY_STATUSES)[number]

export const PLAYCANVAS_FILE_RECOVERY_STATUSES = [
    'ready',
    'missing',
    'checksumMismatch',
    'unsupportedType',
    'deferredProvider',
    'regenerable',
    'publishBlocking'
] as const
export type PlayCanvasFileRecoveryStatus = (typeof PLAYCANVAS_FILE_RECOVERY_STATUSES)[number]

export const PLAYCANVAS_ASSET_TYPES = ['scene', 'script', 'generatedScript', 'texture', 'model', 'audio', 'json', 'other'] as const
export type PlayCanvasAssetType = (typeof PLAYCANVAS_ASSET_TYPES)[number]

export const PLAYCANVAS_SCRIPT_KINDS = ['esm', 'classic'] as const
export type PlayCanvasScriptKind = (typeof PLAYCANVAS_SCRIPT_KINDS)[number]

export interface PlayCanvasFileReference {
    provider: 'local' | 's3' | (string & {})
    root: typeof PLAYCANVAS_PROJECT_FILE_ROOT
    path: string
    hash?: string | null
    size?: number | null
    mime?: string | null
    storageClass?: string | null
    status?: PlayCanvasFileRecoveryStatus
    snapshotContentBase64?: string | null
}

type PlayCanvasFileReferenceShape = Pick<PlayCanvasFileReference, 'path' | 'mime'>

const lowerPlayCanvasPath = (path: string): string => path.trim().toLowerCase()

const hasPlayCanvasExtension = (file: PlayCanvasFileReferenceShape, extensions: readonly string[]): boolean => {
    const path = lowerPlayCanvasPath(file.path)
    return extensions.some((extension) => path.endsWith(extension))
}

const hasPlayCanvasMime = (file: PlayCanvasFileReferenceShape, mimes: readonly string[]): boolean =>
    file.mime != null && mimes.includes(file.mime)

const hasPlayCanvasExtensionMimePair = (
    file: PlayCanvasFileReferenceShape,
    pairs: Readonly<Record<string, readonly string[]>>
): boolean => {
    const path = lowerPlayCanvasPath(file.path)
    const extension = Object.keys(pairs).find((candidate) => path.endsWith(candidate))
    return extension != null && file.mime != null && pairs[extension]?.includes(file.mime)
}

const PLAYCANVAS_PROJECT_IMAGE_EXTENSION_MIME_PAIRS = {
    '.png': ['image/png'],
    '.jpg': ['image/jpeg'],
    '.jpeg': ['image/jpeg'],
    '.webp': ['image/webp']
} as const

export const isPlayCanvasJsonFileReference = (file: PlayCanvasFileReferenceShape): boolean =>
    hasPlayCanvasExtension(file, PLAYCANVAS_PROJECT_JSON_EXTENSIONS) && hasPlayCanvasMime(file, PLAYCANVAS_PROJECT_JSON_MIME_TYPES)

export const isPlayCanvasScriptFileReference = (file: PlayCanvasFileReferenceShape): boolean =>
    hasPlayCanvasExtension(file, PLAYCANVAS_PROJECT_SCRIPT_EXTENSIONS) && hasPlayCanvasMime(file, PLAYCANVAS_PROJECT_SCRIPT_MIME_TYPES)

export const isPlayCanvasImageFileReference = (file: PlayCanvasFileReferenceShape): boolean =>
    hasPlayCanvasExtensionMimePair(file, PLAYCANVAS_PROJECT_IMAGE_EXTENSION_MIME_PAIRS)

export const isPlayCanvasScenePayloadFileReference = (file: PlayCanvasFileReferenceShape): boolean =>
    lowerPlayCanvasPath(file.path).includes(PLAYCANVAS_PROJECT_SCENE_PATH_SEGMENT) && isPlayCanvasJsonFileReference(file)

export const isPlayCanvasAssetFileReference = (file: PlayCanvasFileReferenceShape): boolean =>
    lowerPlayCanvasPath(file.path).includes(PLAYCANVAS_PROJECT_ASSET_PATH_SEGMENT)

export const isPlayCanvasGeneratedArtifactFileReference = (file: PlayCanvasFileReferenceShape): boolean =>
    lowerPlayCanvasPath(file.path).includes(PLAYCANVAS_PROJECT_GENERATED_PATH_SEGMENT) && isPlayCanvasScriptFileReference(file)

export const isPlayCanvasSourceFileReference = (file: PlayCanvasFileReferenceShape): boolean =>
    lowerPlayCanvasPath(file.path).includes(PLAYCANVAS_PROJECT_SOURCEFILES_PATH_SEGMENT) && isPlayCanvasScriptFileReference(file)

export interface PlayCanvasProjectPackageRef {
    packageName: typeof PLAYCANVAS_EDITOR_PACKAGE_NAME
    version: string | null
    compatibilityStatus: PlayCanvasProjectCompatibilityStatus
    compatibilityNotes?: Record<string, unknown>
}

export interface PlayCanvasProject {
    schemaVersion: typeof PLAYCANVAS_PROJECT_SCHEMA_VERSION
    id: string
    codename: VersionedLocalizedContent<string>
    displayName: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string> | null
    packageRef: PlayCanvasProjectPackageRef
    settings: Record<string, unknown>
    defaultSceneId?: string | null
    publicationConfig: Record<string, unknown>
}

export interface PlayCanvasScene {
    id: string
    projectId: string
    codename: VersionedLocalizedContent<string>
    displayName: VersionedLocalizedContent<string>
    payloadSchemaVersion: string
    payload?: Record<string, unknown> | null
    payloadFile?: PlayCanvasFileReference | null
    checksum?: string | null
    sortOrder: number
    publish: boolean
}

export interface PlayCanvasAsset {
    id: string
    projectId: string
    stableAssetId: string
    type: PlayCanvasAssetType
    name: string
    virtualPath: string[]
    file?: PlayCanvasFileReference | null
    metadata: Record<string, unknown>
    publish: boolean
}

export interface PlayCanvasScriptAsset {
    id: string
    assetId: string
    moduleId?: string | null
    moduleCodename?: string | null
    moduleSourcePath?: string | null
    scriptName: string
    scriptKind: PlayCanvasScriptKind
    parsedAttributes: Record<string, unknown>
    parseStatus: PlayCanvasFileRecoveryStatus
    parseDiagnostics?: Record<string, unknown> | null
}

export interface PlayCanvasSceneScriptBinding {
    id: string
    sceneId: string
    sceneEntityStableId: string
    scriptAssetId: string
    scriptName: string
    attributeValues: Record<string, unknown>
    bindingSchemaVersion: string
    platformoEntityId?: string | null
    sortOrder: number
    enabled: boolean
}

export interface PlayCanvasGeneratedArtifact {
    id: string
    scriptAssetId: string
    sourceModuleId?: string | null
    sourceModuleCodename?: string | null
    sourceModulePath?: string | null
    sourceChecksum?: string | null
    outputFile: PlayCanvasFileReference
    scriptName: string
    moduleExportName?: string | null
    scriptKind: PlayCanvasScriptKind
    parseStatus: PlayCanvasFileRecoveryStatus
    generatedAt?: string | null
    parsedAt?: string | null
}

export interface PlayCanvasSourceFile {
    id: string
    projectId: string
    stableSourceFileId: string
    name: string
    virtualPath: string[]
    file: PlayCanvasFileReference
    scriptKind: PlayCanvasScriptKind
    checksum?: string | null
    parsedAttributes: Record<string, unknown>
    parseStatus: PlayCanvasFileRecoveryStatus
    parseDiagnostics?: Record<string, unknown> | null
    publish: boolean
}

export interface PlayCanvasRuntimeAssetManifest {
    id: string
    type: PlayCanvasAssetType
    name: string
    url?: string | null
    hash?: string | null
    mime?: string | null
    size?: number | null
}

export interface PlayCanvasRuntimeScriptManifest {
    id: string
    scriptName: string
    scriptKind: PlayCanvasScriptKind
    artifactUrl?: string | null
    artifactHash?: string | null
    moduleId?: string | null
    moduleCodename?: string | null
    attributes: Record<string, unknown>
    attributeValues?: Record<string, unknown>
    sceneEntityStableId?: string | null
}

export interface PlayCanvasRuntimeManifest {
    schemaVersion: typeof PLAYCANVAS_RUNTIME_MANIFEST_SCHEMA_VERSION
    projectId: string
    sceneId?: string | null
    checksum: string
    assets: PlayCanvasRuntimeAssetManifest[]
    scripts: PlayCanvasRuntimeScriptManifest[]
    metadata?: Record<string, unknown>
}

export interface PlayCanvasPublishedRuntimeManifestSummary {
    projectId: string
    sceneId?: string | null
    checksum: string
    runtimeManifest: PlayCanvasRuntimeManifest
    publishedAt?: string | null
}

export interface PlayCanvasProjectSnapshotSection {
    schemaVersion: typeof PLAYCANVAS_PROJECT_SNAPSHOT_SCHEMA_VERSION
    projects: PlayCanvasProject[]
    scenes: PlayCanvasScene[]
    assets: PlayCanvasAsset[]
    scriptAssets: PlayCanvasScriptAsset[]
    sceneScriptBindings: PlayCanvasSceneScriptBinding[]
    generatedArtifacts: PlayCanvasGeneratedArtifact[]
    sourceFiles?: PlayCanvasSourceFile[]
    runtimeManifests?: PlayCanvasRuntimeManifest[]
}

export interface PlayCanvasProjectSummary {
    id: string
    displayName: VersionedLocalizedContent<string>
    codename: VersionedLocalizedContent<string>
    version: number
    defaultSceneId?: string | null
    compatibilityStatus: PlayCanvasProjectCompatibilityStatus
    status: PlayCanvasFileRecoveryStatus
    sceneCount: number
    assetCount: number
    scriptCount: number
    generatedArtifactCount: number
    publishable: boolean
}

export interface CreatePlayCanvasProjectRequest {
    codename?: VersionedLocalizedContent<string>
    displayName: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string> | null
    packageVersion?: string | null
}

export interface UpdatePlayCanvasProjectSettingsRequest {
    displayName?: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string> | null
    settings?: Record<string, unknown>
    defaultSceneId?: string | null
}

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i)
const strictBase64Schema = z
    .string()
    .min(1)
    .max(PLAYCANVAS_PROJECT_FILE_BASE64_MAX_CHARS)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)
const playCanvasMimeSchema = z.enum(PLAYCANVAS_PROJECT_ALLOWED_MIME_TYPES)

export const playCanvasFileReferenceSchema = z.object({
    provider: z.string().min(1),
    root: z.literal(PLAYCANVAS_PROJECT_FILE_ROOT),
    path: z.string().min(1),
    hash: sha256Schema.nullable().optional(),
    size: z.number().int().nonnegative().max(PLAYCANVAS_PROJECT_FILE_MAX_BYTES).nullable().optional(),
    mime: playCanvasMimeSchema.nullable().optional(),
    storageClass: z.string().min(1).nullable().optional(),
    status: z.enum(PLAYCANVAS_FILE_RECOVERY_STATUSES).optional(),
    snapshotContentBase64: strictBase64Schema.nullable().optional()
})

export const playCanvasProjectSchema = z.object({
    schemaVersion: z.literal(PLAYCANVAS_PROJECT_SCHEMA_VERSION),
    id: z.string().uuid(),
    codename: CodenameVLCSchema,
    displayName: LocalizedStringSchema,
    description: LocalizedStringOptionalSchema,
    packageRef: z.object({
        packageName: z.literal(PLAYCANVAS_EDITOR_PACKAGE_NAME),
        version: z.string().min(1).nullable(),
        compatibilityStatus: z.enum(PLAYCANVAS_PROJECT_COMPATIBILITY_STATUSES),
        compatibilityNotes: z.record(z.string(), z.unknown()).optional()
    }),
    settings: z.record(z.string(), z.unknown()),
    defaultSceneId: z.string().uuid().nullable().optional(),
    publicationConfig: z.record(z.string(), z.unknown())
})

export const playCanvasRuntimeManifestSchema = z.object({
    schemaVersion: z.literal(PLAYCANVAS_RUNTIME_MANIFEST_SCHEMA_VERSION),
    projectId: z.string().uuid(),
    sceneId: z.string().uuid().nullable().optional(),
    checksum: z.string().min(1),
    assets: z.array(
        z.object({
            id: z.string().min(1),
            type: z.enum(PLAYCANVAS_ASSET_TYPES),
            name: z.string().min(1),
            url: z.string().min(1).nullable().optional(),
            hash: z.string().min(1).nullable().optional(),
            mime: z.string().min(1).nullable().optional(),
            size: z.number().int().nonnegative().nullable().optional()
        })
    ),
    scripts: z.array(
        z.object({
            id: z.string().min(1),
            scriptName: z.string().min(1),
            scriptKind: z.enum(PLAYCANVAS_SCRIPT_KINDS),
            artifactUrl: z.string().min(1).nullable().optional(),
            artifactHash: sha256Schema.nullable().optional(),
            moduleId: z.string().uuid().nullable().optional(),
            moduleCodename: z.string().min(1).nullable().optional(),
            attributes: z.record(z.string(), z.unknown()),
            attributeValues: z.record(z.string(), z.unknown()).optional(),
            sceneEntityStableId: z.string().min(1).nullable().optional()
        })
    ),
    metadata: z.record(z.string(), z.unknown()).optional()
})

export const playCanvasSceneSchema = z.object({
    id: z.string().uuid(),
    projectId: z.string().uuid(),
    codename: CodenameVLCSchema,
    displayName: LocalizedStringSchema,
    payloadSchemaVersion: z.string().min(1).max(40),
    payload: z.record(z.string(), z.unknown()).nullable().optional(),
    payloadFile: playCanvasFileReferenceSchema.nullable().optional(),
    checksum: sha256Schema.nullable().optional(),
    sortOrder: z.number().int(),
    publish: z.boolean()
})

export const playCanvasAssetSchema = z.object({
    id: z.string().uuid(),
    projectId: z.string().uuid(),
    stableAssetId: z.string().min(1).max(160),
    type: z.enum(PLAYCANVAS_ASSET_TYPES),
    name: z.string().min(1).max(255),
    virtualPath: z.array(z.string().min(1).max(160)).max(32),
    file: playCanvasFileReferenceSchema.nullable().optional(),
    metadata: z.record(z.string(), z.unknown()),
    publish: z.boolean()
})

export const playCanvasScriptAssetSchema = z.object({
    id: z.string().uuid(),
    assetId: z.string().uuid(),
    moduleId: z.string().uuid().nullable().optional(),
    moduleCodename: z.string().min(1).max(160).nullable().optional(),
    moduleSourcePath: z.string().min(1).max(512).nullable().optional(),
    scriptName: z.string().min(1).max(160),
    scriptKind: z.enum(PLAYCANVAS_SCRIPT_KINDS),
    parsedAttributes: z.record(z.string(), z.unknown()),
    parseStatus: z.enum(PLAYCANVAS_FILE_RECOVERY_STATUSES),
    parseDiagnostics: z.record(z.string(), z.unknown()).nullable().optional()
})

export const playCanvasSceneScriptBindingSchema = z.object({
    id: z.string().uuid(),
    sceneId: z.string().uuid(),
    sceneEntityStableId: z.string().min(1).max(255),
    scriptAssetId: z.string().uuid(),
    scriptName: z.string().min(1).max(160),
    attributeValues: z.record(z.string(), z.unknown()),
    bindingSchemaVersion: z.string().min(1).max(40),
    platformoEntityId: z.string().uuid().nullable().optional(),
    sortOrder: z.number().int(),
    enabled: z.boolean()
})

export const playCanvasGeneratedArtifactSchema = z.object({
    id: z.string().uuid(),
    scriptAssetId: z.string().uuid(),
    sourceModuleId: z.string().uuid().nullable().optional(),
    sourceModuleCodename: z.string().min(1).max(160).nullable().optional(),
    sourceModulePath: z.string().min(1).max(512).nullable().optional(),
    sourceChecksum: sha256Schema.nullable().optional(),
    outputFile: playCanvasFileReferenceSchema,
    scriptName: z.string().min(1).max(160),
    moduleExportName: z.string().min(1).max(160).nullable().optional(),
    scriptKind: z.enum(PLAYCANVAS_SCRIPT_KINDS),
    parseStatus: z.enum(PLAYCANVAS_FILE_RECOVERY_STATUSES),
    generatedAt: z.string().datetime().nullable().optional(),
    parsedAt: z.string().datetime().nullable().optional()
})

export const playCanvasSourceFileSchema = z.object({
    id: z.string().uuid(),
    projectId: z.string().uuid(),
    stableSourceFileId: z.string().min(1).max(160),
    name: z.string().min(1).max(255),
    virtualPath: z.array(z.string().min(1).max(160)).max(32),
    file: playCanvasFileReferenceSchema.refine(
        (file) => isPlayCanvasSourceFileReference({ path: file.path, mime: file.mime }),
        'PlayCanvas source files must be JavaScript files under the sourcefiles namespace'
    ),
    scriptKind: z.enum(PLAYCANVAS_SCRIPT_KINDS),
    checksum: sha256Schema.nullable().optional(),
    parsedAttributes: z.record(z.string(), z.unknown()),
    parseStatus: z.enum(PLAYCANVAS_FILE_RECOVERY_STATUSES),
    parseDiagnostics: z.record(z.string(), z.unknown()).nullable().optional(),
    publish: z.boolean()
})

export const playCanvasProjectSnapshotSectionSchema = z.object({
    schemaVersion: z.literal(PLAYCANVAS_PROJECT_SNAPSHOT_SCHEMA_VERSION),
    projects: z.array(playCanvasProjectSchema),
    scenes: z.array(playCanvasSceneSchema),
    assets: z.array(playCanvasAssetSchema),
    scriptAssets: z.array(playCanvasScriptAssetSchema),
    sceneScriptBindings: z.array(playCanvasSceneScriptBindingSchema),
    generatedArtifacts: z.array(playCanvasGeneratedArtifactSchema),
    sourceFiles: z.array(playCanvasSourceFileSchema).optional(),
    runtimeManifests: z.array(playCanvasRuntimeManifestSchema).optional()
})
