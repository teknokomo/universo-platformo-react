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

const PLAYCANVAS_RUNTIME_DATA_URL_HEADER_PATTERN =
    /^data:[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+(?:;[A-Za-z0-9!#$&^_.+-]+(?:=[A-Za-z0-9!#$&^_.+/%-]*)?)*;base64$/i
const PLAYCANVAS_RUNTIME_BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

/**
 * Runtime artifacts and binary assets are embedded as bounded base64 data URLs
 * so a published manifest never causes a browser to fetch an arbitrary origin.
 */
export const isPortablePlayCanvasRuntimeDataUrl = (value: string): boolean => {
    const separatorIndex = value.indexOf(',')
    if (separatorIndex < 0) return false
    const header = value.slice(0, separatorIndex)
    const payload = value.slice(separatorIndex + 1)
    return (
        PLAYCANVAS_RUNTIME_DATA_URL_HEADER_PATTERN.test(header) &&
        payload.length > 0 &&
        payload.length <= PLAYCANVAS_PROJECT_FILE_BASE64_MAX_CHARS &&
        PLAYCANVAS_RUNTIME_BASE64_PATTERN.test(payload)
    )
}

/** Script artifacts are imported as ESM and therefore require a JavaScript MIME. */
export const isPortablePlayCanvasScriptDataUrl = (value: string): boolean => {
    if (!isPortablePlayCanvasRuntimeDataUrl(value)) return false
    const separatorIndex = value.indexOf(',')
    const header = value.slice(0, separatorIndex)
    return /^data:text\/(?:javascript|ecmascript)(?:;[A-Za-z0-9!#$&^_.+-]+(?:=[A-Za-z0-9!#$&^_.+/%-]*)?)*;base64$/i.test(header)
}
/**
 * JSON limits shared by every persisted PlayCanvas project document. These
 * bounds apply before data reaches JSONB or the editor bridge, so a caller
 * cannot use one of the generic metadata fields to bypass the compatibility
 * request limits.
 */
export const PLAYCANVAS_PROJECT_JSON_MAX_DEPTH = 24
export const PLAYCANVAS_PROJECT_JSON_MAX_NODES = 20_000
export const PLAYCANVAS_PROJECT_JSON_MAX_STRING_LENGTH = 4096
export const PLAYCANVAS_PROJECT_JSON_MAX_ARRAY_LENGTH = 5000
export const PLAYCANVAS_PROJECT_JSON_MAX_OBJECT_KEYS = 160
export const PLAYCANVAS_PROJECT_METADATA_MAX_BYTES = 512 * 1024
export const PLAYCANVAS_PROJECT_SETTINGS_MAX_BYTES = 512 * 1024
export const PLAYCANVAS_PROJECT_PAYLOAD_MAX_BYTES = PLAYCANVAS_PROJECT_FILE_MAX_BYTES
export const PLAYCANVAS_PROJECT_PARSED_ATTRIBUTES_MAX_BYTES = 512 * 1024
export const PLAYCANVAS_ASSET_LIFECYCLE_METADATA_KEYS = ['editorDocumentId', 'editorDocumentKey'] as const
export const PLAYCANVAS_PROJECT_ALLOWED_MIME_TYPES = [
    'application/json',
    'text/javascript',
    'application/javascript',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/css',
    'text/html',
    'text/plain'
] as const
export const PLAYCANVAS_PROJECT_JSON_MIME_TYPES = ['application/json'] as const
export const PLAYCANVAS_PROJECT_SCRIPT_MIME_TYPES = ['text/javascript', 'application/javascript'] as const
export const PLAYCANVAS_PROJECT_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const PLAYCANVAS_PROJECT_STYLE_MIME_TYPES = ['text/css'] as const
export const PLAYCANVAS_PROJECT_HTML_MIME_TYPES = ['text/html'] as const
export const PLAYCANVAS_PROJECT_TEXT_MIME_TYPES = ['text/plain'] as const
export const PLAYCANVAS_PROJECT_JSON_EXTENSIONS = ['.json'] as const
export const PLAYCANVAS_PROJECT_SCRIPT_EXTENSIONS = ['.js', '.mjs'] as const
export const PLAYCANVAS_PROJECT_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'] as const
export const PLAYCANVAS_PROJECT_STYLE_EXTENSIONS = ['.css'] as const
export const PLAYCANVAS_PROJECT_HTML_EXTENSIONS = ['.html'] as const
export const PLAYCANVAS_PROJECT_TEXT_EXTENSIONS = ['.txt', '.shader', '.glsl'] as const
export const PLAYCANVAS_PROJECT_SCENE_PATH_SEGMENT = '/scenes/' as const
export const PLAYCANVAS_PROJECT_ASSET_PATH_SEGMENT = '/assets/' as const
export const PLAYCANVAS_PROJECT_GENERATED_PATH_SEGMENT = '/generated/' as const
export const PLAYCANVAS_PROJECT_SOURCEFILES_PATH_SEGMENT = '/sourcefiles/' as const

export type PlayCanvasProjectJsonPrimitive = string | number | boolean | null
export type PlayCanvasProjectJsonValue =
    | PlayCanvasProjectJsonPrimitive
    | PlayCanvasProjectJsonValue[]
    | { [key: string]: PlayCanvasProjectJsonValue }

const unsafePlayCanvasProjectJsonKeys = new Set(['__proto__', 'prototype', 'constructor'])

const isPlainPlayCanvasProjectObject = (value: unknown): value is Record<string, unknown> => {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) return false
    try {
        const prototype = Object.getPrototypeOf(value)
        return prototype === Object.prototype || prototype === null
    } catch {
        return false
    }
}

/**
 * Iteratively validates JSON values so attacker-controlled nesting cannot
 * exhaust the JavaScript call stack before the value is persisted or parsed.
 */
export const isBoundedPlayCanvasProjectJsonValue = (value: unknown): value is PlayCanvasProjectJsonValue => {
    const pending: Array<{ value: unknown; depth: number; exit?: boolean }> = [{ value, depth: 0 }]
    // Track only the current traversal path. The same object may legitimately
    // be referenced by multiple fields before JSON serialization (for example,
    // an asset payload reused in both `data` and `metadata`); rejecting every
    // repeated reference would incorrectly reject otherwise valid snapshots.
    const active = new WeakSet<object>()
    let nodes = 0

    while (pending.length > 0) {
        const current = pending.pop() as { value: unknown; depth: number; exit?: boolean }
        nodes += 1
        if (nodes > PLAYCANVAS_PROJECT_JSON_MAX_NODES || current.depth > PLAYCANVAS_PROJECT_JSON_MAX_DEPTH) return false

        if (current.exit) {
            if (current.value && typeof current.value === 'object') {
                active.delete(current.value)
            }
            continue
        }

        if (current.value === null || typeof current.value === 'boolean') continue
        if (typeof current.value === 'string') {
            if (current.value.length > PLAYCANVAS_PROJECT_JSON_MAX_STRING_LENGTH) return false
            continue
        }
        if (typeof current.value === 'number') {
            if (!Number.isFinite(current.value)) return false
            continue
        }
        if (typeof current.value !== 'object') return false
        if (active.has(current.value)) return false
        active.add(current.value)

        if (Array.isArray(current.value)) {
            if (current.value.length > PLAYCANVAS_PROJECT_JSON_MAX_ARRAY_LENGTH) return false
            pending.push({ value: current.value, depth: current.depth, exit: true })
            for (let index = current.value.length - 1; index >= 0; index -= 1) {
                pending.push({ value: current.value[index], depth: current.depth + 1 })
            }
            continue
        }

        if (!isPlainPlayCanvasProjectObject(current.value)) return false
        let entries: Array<[string, unknown]>
        try {
            entries = Object.entries(current.value)
        } catch {
            return false
        }
        if (entries.length > PLAYCANVAS_PROJECT_JSON_MAX_OBJECT_KEYS) return false
        pending.push({ value: current.value, depth: current.depth, exit: true })
        for (let index = entries.length - 1; index >= 0; index -= 1) {
            const [key, child] = entries[index]
            if (unsafePlayCanvasProjectJsonKeys.has(key) || key.length > 160) return false
            pending.push({ value: child, depth: current.depth + 1 })
        }
    }

    return true
}

const playCanvasProjectJsonBytes = (value: unknown): number | null => {
    try {
        const serialized = JSON.stringify(value)
        if (serialized === undefined) return null
        return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(serialized).byteLength : serialized.length
    } catch {
        return null
    }
}

const createBoundedPlayCanvasProjectJsonObjectSchema = (maxBytes: number, fieldName: string) =>
    z
        .preprocess((value) => {
            // Zod's record parser materializes into a normal object and
            // therefore treats an own `__proto__` key as a prototype
            // setter before refinements run. Reject unsafe top-level keys
            // on the raw input first so they cannot be silently dropped.
            if (!isPlainPlayCanvasProjectObject(value)) return value
            try {
                return Object.keys(value).some((key) => unsafePlayCanvasProjectJsonKeys.has(key)) ? undefined : value
            } catch {
                return undefined
            }
        }, z.record(z.string().min(1).max(160), z.custom<PlayCanvasProjectJsonValue>(isBoundedPlayCanvasProjectJsonValue)))
        .superRefine((value, context) => {
            const keys = Object.keys(value)
            if (keys.length > PLAYCANVAS_PROJECT_JSON_MAX_OBJECT_KEYS) {
                context.addIssue({
                    code: z.ZodIssueCode.too_big,
                    maximum: PLAYCANVAS_PROJECT_JSON_MAX_OBJECT_KEYS,
                    type: 'object',
                    inclusive: true,
                    message: `${fieldName} contains too many fields`
                })
            }
            for (const key of keys) {
                if (unsafePlayCanvasProjectJsonKeys.has(key)) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: [key],
                        message: `${fieldName} contains a reserved key`
                    })
                }
            }
            const bytes = playCanvasProjectJsonBytes(value)
            if (bytes === null || bytes > maxBytes) {
                context.addIssue({ code: z.ZodIssueCode.custom, message: `${fieldName} exceeds its JSON size limit` })
            }
        })

export const playCanvasProjectJsonValueSchema: z.ZodType<PlayCanvasProjectJsonValue> = z.custom<PlayCanvasProjectJsonValue>(
    isBoundedPlayCanvasProjectJsonValue,
    { message: 'Value is not a bounded PlayCanvas JSON value' }
)

export const playCanvasProjectMetadataSchema = createBoundedPlayCanvasProjectJsonObjectSchema(
    PLAYCANVAS_PROJECT_METADATA_MAX_BYTES,
    'PlayCanvas project metadata'
)
export const playCanvasProjectSettingsSchema = createBoundedPlayCanvasProjectJsonObjectSchema(
    PLAYCANVAS_PROJECT_SETTINGS_MAX_BYTES,
    'PlayCanvas project settings'
)
export const playCanvasProjectPayloadSchema = createBoundedPlayCanvasProjectJsonObjectSchema(
    PLAYCANVAS_PROJECT_PAYLOAD_MAX_BYTES,
    'PlayCanvas project payload'
)
export const playCanvasProjectParsedAttributesSchema = createBoundedPlayCanvasProjectJsonObjectSchema(
    PLAYCANVAS_PROJECT_PARSED_ATTRIBUTES_MAX_BYTES,
    'PlayCanvas parsed attributes'
)

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

export const PLAYCANVAS_ASSET_TYPES = [
    'scene',
    'script',
    'generatedScript',
    'texture',
    'cubemap',
    'material',
    'model',
    'audio',
    'json',
    'text',
    'css',
    'html',
    'shader',
    'folder',
    'other'
] as const
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

export const MMOOMM_VISUAL_LAB_MAX_OBJECTS = 128
export const MMOOMM_VISUAL_LAB_MAX_LOW_POLY_BANDS = 16

const mmoommRuntimeVector3Schema = z
    .object({
        x: z.number().finite(),
        y: z.number().finite(),
        z: z.number().finite()
    })
    .strict()

const mmoommRuntimeSceneObjectSchema = z
    .object({
        id: z.string().min(1).max(128),
        role: z.enum(['camera', 'mesh']).optional(),
        position: mmoommRuntimeVector3Schema,
        scale: mmoommRuntimeVector3Schema,
        selectable: z.boolean().optional(),
        guard: z.boolean().optional()
    })
    .strict()

export const mmoommRuntimeSceneSchema = z
    .object({
        objects: z.array(mmoommRuntimeSceneObjectSchema).max(64).optional(),
        controlledObjectId: z.string().min(1).max(128).optional(),
        targetObjectId: z.string().min(1).max(128).optional()
    })
    .strip()

export type MmoommRuntimeScene = z.infer<typeof mmoommRuntimeSceneSchema>

const mmoommVisualLabColorSchema = z
    .object({
        r: z.number().finite().min(0).max(1),
        g: z.number().finite().min(0).max(1),
        b: z.number().finite().min(0).max(1)
    })
    .strict()

const mmoommVisualLabMaterialEvidenceSchema = z
    .object({
        role: z.enum(['core', 'glow', 'variantMarker']),
        diffuse: z.tuple([z.number().finite().min(0).max(1), z.number().finite().min(0).max(1), z.number().finite().min(0).max(1)]),
        opacity: z.number().finite().min(0.02).max(1),
        emissive: z
            .tuple([z.number().finite().min(0).max(1), z.number().finite().min(0).max(1), z.number().finite().min(0).max(1)])
            .optional(),
        emissiveIntensity: z.number().finite().min(0).max(8).optional(),
        blendType: z.enum(['normal', 'additive']),
        depthWrite: z.boolean().optional(),
        useFog: z.boolean().optional()
    })
    .strip()

const mmoommVisualLabObjectSchema = z
    .object({
        id: z.string().min(1).max(128),
        name: z.string().min(1).max(160),
        variant: z.string().min(1).max(80),
        family: z.string().min(1).max(80),
        objectType: z.enum(['ship', 'station', 'rockAsteroid', 'iceAsteroid']),
        primitive: z.enum(['box', 'sphere']),
        position: mmoommRuntimeVector3Schema,
        scale: mmoommRuntimeVector3Schema,
        coreOpacity: z.number().finite().min(0.05).max(1),
        glowColor: mmoommVisualLabColorSchema,
        glowOpacity: z.number().finite().min(0.02).max(1),
        shellScale: z.number().finite().min(1).max(2),
        lowPolyBands: z.number().int().min(3).max(MMOOMM_VISUAL_LAB_MAX_LOW_POLY_BANDS).nullable().optional(),
        material: z
            .object({
                core: mmoommVisualLabMaterialEvidenceSchema,
                glow: mmoommVisualLabMaterialEvidenceSchema
            })
            .strip()
            .optional()
    })
    .strip()

export type MmoommVisualLabObject = z.infer<typeof mmoommVisualLabObjectSchema>

const mmoommVisualLabVariantSchema = z
    .object({
        index: z.number().int().min(1).max(64),
        slug: z.string().min(1).max(80),
        title: z.string().min(1).max(120),
        family: z.string().min(1).max(80),
        fogDensity: z.number().finite().min(0).max(1),
        coreOpacity: z.number().finite().min(0.05).max(1),
        glowOpacity: z.number().finite().min(0.02).max(1),
        shellScale: z.number().finite().min(1).max(2),
        lowPolyBands: z.number().int().min(3).max(MMOOMM_VISUAL_LAB_MAX_LOW_POLY_BANDS).optional()
    })
    .strip()

export const mmoommVisualLabSceneSchema = z
    .object({
        version: z.number().int().min(1).max(1).optional(),
        projectRole: z.literal('visual-linkup-lab'),
        variantCount: z.number().int().min(1).max(64),
        objectTypes: z.array(z.enum(['ship', 'station', 'rockAsteroid', 'iceAsteroid'])).max(8),
        variants: z.array(mmoommVisualLabVariantSchema).max(64).optional(),
        sceneFog: z
            .object({
                type: z.enum(['none', 'linear', 'exp', 'exp2']),
                color: z.tuple([z.number().finite().min(0).max(1), z.number().finite().min(0).max(1), z.number().finite().min(0).max(1)]),
                density: z.number().finite().min(0).max(1)
            })
            .strip()
            .optional(),
        objects: z.array(mmoommVisualLabObjectSchema).min(1).max(MMOOMM_VISUAL_LAB_MAX_OBJECTS)
    })
    .strip()

export type MmoommVisualLabScene = z.infer<typeof mmoommVisualLabSceneSchema>

export const mmoommRuntimeMetadataSchema = z
    .object({
        scene: mmoommRuntimeSceneSchema.optional(),
        visualLab: mmoommVisualLabSceneSchema.optional(),
        provenance: z.record(z.string(), z.unknown()).optional()
    })
    .strip()

export type MmoommRuntimeMetadata = z.infer<typeof mmoommRuntimeMetadataSchema>

export const normalizeMmoommRuntimeMetadata = (value: unknown): MmoommRuntimeMetadata | null => {
    const parsed = mmoommRuntimeMetadataSchema.safeParse(value)
    if (!parsed.success) return null
    const normalized: MmoommRuntimeMetadata = {}
    if (parsed.data.scene) normalized.scene = parsed.data.scene
    if (parsed.data.visualLab) normalized.visualLab = parsed.data.visualLab
    if (parsed.data.provenance) normalized.provenance = parsed.data.provenance
    return Object.keys(normalized).length > 0 ? normalized : null
}

export const normalizePlayCanvasRuntimeManifestMetadata = (value: unknown): Record<string, unknown> | undefined => {
    const metadata = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
    if (!metadata) return undefined
    const normalized: Record<string, unknown> = { ...metadata }
    const mmoomm = normalizeMmoommRuntimeMetadata(metadata.mmoomm)
    if (mmoomm) {
        normalized.mmoomm = mmoomm
    } else {
        delete normalized.mmoomm
    }
    return Object.keys(normalized).length > 0 ? normalized : undefined
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
        compatibilityNotes: playCanvasProjectMetadataSchema.optional()
    }),
    settings: playCanvasProjectSettingsSchema,
    defaultSceneId: z.string().uuid().nullable().optional(),
    publicationConfig: playCanvasProjectMetadataSchema
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
            attributes: playCanvasProjectParsedAttributesSchema,
            attributeValues: playCanvasProjectParsedAttributesSchema.optional(),
            sceneEntityStableId: z.string().min(1).nullable().optional()
        })
    ),
    metadata: playCanvasProjectMetadataSchema.optional()
})

export const playCanvasSceneSchema = z.object({
    id: z.string().uuid(),
    projectId: z.string().uuid(),
    codename: CodenameVLCSchema,
    displayName: LocalizedStringSchema,
    payloadSchemaVersion: z.string().min(1).max(40),
    payload: playCanvasProjectPayloadSchema.nullable().optional(),
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
    metadata: playCanvasProjectMetadataSchema,
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
    parsedAttributes: playCanvasProjectParsedAttributesSchema,
    parseStatus: z.enum(PLAYCANVAS_FILE_RECOVERY_STATUSES),
    parseDiagnostics: playCanvasProjectMetadataSchema.nullable().optional()
})

export const playCanvasSceneScriptBindingSchema = z.object({
    id: z.string().uuid(),
    sceneId: z.string().uuid(),
    sceneEntityStableId: z.string().min(1).max(255),
    scriptAssetId: z.string().uuid(),
    scriptName: z.string().min(1).max(160),
    attributeValues: playCanvasProjectParsedAttributesSchema,
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
    parsedAttributes: playCanvasProjectParsedAttributesSchema,
    parseStatus: z.enum(PLAYCANVAS_FILE_RECOVERY_STATUSES),
    parseDiagnostics: playCanvasProjectMetadataSchema.nullable().optional(),
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
