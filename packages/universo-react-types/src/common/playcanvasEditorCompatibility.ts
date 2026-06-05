import { z } from 'zod'
import {
    PLAYCANVAS_PROJECT_FILE_MAX_BYTES,
    PLAYCANVAS_PROJECT_JSON_MIME_TYPES,
    PLAYCANVAS_PROJECT_SCHEMA_VERSION
} from './playcanvasProjects'

export const PLAYCANVAS_EDITOR_COMPATIBILITY_MODE = 'universo-bridge-minimal' as const
export const PLAYCANVAS_EDITOR_COMPATIBILITY_VERSION = '1' as const
export const PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE = 'universo-compatibility-rest-minimal' as const
export const PLAYCANVAS_EDITOR_COMPATIBILITY_MAX_SCENE_ENTITIES = 5000
export const PLAYCANVAS_EDITOR_COMPATIBILITY_MAX_SCENE_ASSETS = 2000
export const PLAYCANVAS_EDITOR_COMPATIBILITY_MAX_JSON_DEPTH = 24
export const PLAYCANVAS_EDITOR_COMPATIBILITY_TOKEN_TTL_MS = 5 * 60 * 1000

const uuidSchema = z.string().uuid()
const requestIdSchema = uuidSchema
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i)
const jsonPrimitiveSchema = z.union([z.string().max(4096), z.number().finite(), z.boolean(), z.null()])
type JsonValue = z.infer<typeof jsonPrimitiveSchema> | JsonValue[] | { [key: string]: JsonValue }

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
        return false
    }
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
}

const calculateJsonDepth = (value: unknown, depth = 0): number => {
    if (value == null || typeof value !== 'object') {
        return depth
    }
    if (Array.isArray(value)) {
        return value.reduce((maxDepth, item) => Math.max(maxDepth, calculateJsonDepth(item, depth + 1)), depth)
    }
    if (!isPlainObject(value)) {
        return depth + 1
    }
    return Object.values(value).reduce((maxDepth, item) => Math.max(maxDepth, calculateJsonDepth(item, depth + 1)), depth)
}

const serializedSizeIsWithinLimit = (value: unknown): boolean => {
    try {
        const serialized = JSON.stringify(value)
        const bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(serialized).byteLength : serialized.length
        return bytes <= PLAYCANVAS_PROJECT_FILE_MAX_BYTES
    } catch {
        return false
    }
}

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
    z.union([jsonPrimitiveSchema, z.array(jsonValueSchema).max(5000), z.record(z.string().max(160), jsonValueSchema)])
)

const sceneEntitySchema = z
    .object({
        id: z.string().min(1).max(160),
        name: z.string().max(255).optional(),
        parentId: z.string().min(1).max(160).nullable().optional(),
        enabled: z.boolean().optional(),
        components: z.record(z.string().max(80), jsonValueSchema).optional(),
        children: z.array(z.string().min(1).max(160)).max(512).optional()
    })
    .strict()

const sceneAssetReferenceSchema = z
    .object({
        id: z.string().min(1).max(160),
        name: z.string().max(255).optional(),
        type: z.string().min(1).max(80),
        stableAssetId: z.string().min(1).max(160).optional(),
        fileId: uuidSchema.nullable().optional(),
        mime: z.enum(PLAYCANVAS_PROJECT_JSON_MIME_TYPES).nullable().optional(),
        metadata: z.record(z.string().max(120), jsonValueSchema).optional()
    })
    .strict()

export const playCanvasEditorCompatibilityScenePayloadSchema = z
    .object({
        schemaVersion: z.string().min(1).max(40).default(PLAYCANVAS_PROJECT_SCHEMA_VERSION),
        settings: z.record(z.string().max(120), jsonValueSchema).optional(),
        entities: z.array(sceneEntitySchema).max(PLAYCANVAS_EDITOR_COMPATIBILITY_MAX_SCENE_ENTITIES).default([]),
        assets: z.array(sceneAssetReferenceSchema).max(PLAYCANVAS_EDITOR_COMPATIBILITY_MAX_SCENE_ASSETS).optional(),
        metadata: z.record(z.string().max(120), jsonValueSchema).optional()
    })
    .strict()
    .superRefine((value, ctx) => {
        if (!serializedSizeIsWithinLimit(value)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [],
                message: 'Scene payload exceeds the PlayCanvas project file size limit'
            })
        }
        if (calculateJsonDepth(value) > PLAYCANVAS_EDITOR_COMPATIBILITY_MAX_JSON_DEPTH) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [],
                message: 'Scene payload is too deeply nested'
            })
        }
    })

export const playCanvasEditorCompatibilityTokenClaimsSchema = z
    .object({
        metahubId: z.string().min(1).max(128),
        projectId: uuidSchema,
        userId: z.string().min(1).max(256),
        packageSlug: z.literal('playcanvas-editor'),
        mode: z.literal(PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE),
        origin: z.string().url().optional(),
        expiresAt: z.number().int().positive()
    })
    .strict()

export type PlayCanvasEditorCompatibilityTokenClaims = z.infer<typeof playCanvasEditorCompatibilityTokenClaimsSchema>

const compatibilitySurfaceDescriptorSchema = z
    .object({
        status: z.enum(['stubbed', 'disabled', 'unsupported']),
        reason: z.string().min(1).max(160)
    })
    .strict()

export type PlayCanvasEditorCompatibilitySurfaceDescriptor = z.infer<typeof compatibilitySurfaceDescriptorSchema>

const compatibilityProjectSummarySchema = z
    .object({
        id: z.string().uuid(),
        displayName: z.unknown(),
        codename: z.unknown(),
        version: z.number().int().positive().optional(),
        defaultSceneId: z.string().uuid().nullable().optional(),
        compatibilityStatus: z.string().min(1).optional(),
        status: z.string().min(1).optional(),
        sceneCount: z.number().int().nonnegative().optional(),
        assetCount: z.number().int().nonnegative().optional(),
        scriptCount: z.number().int().nonnegative().optional(),
        generatedArtifactCount: z.number().int().nonnegative().optional(),
        publishable: z.boolean().optional()
    })
    .passthrough()

export const playCanvasEditorCompatibilityIdentityDescriptorSchema = z
    .object({
        self: z
            .object({
                id: z.string().min(1),
                role: z.literal('designer')
            })
            .strict(),
        owner: z
            .object({
                id: z.string().min(1),
                type: z.enum(['user', 'metahub'])
            })
            .strict(),
        permissions: z
            .object({
                read: z.literal(true),
                write: z.literal(true),
                admin: z.literal(false)
            })
            .strict(),
        branch: z
            .object({
                id: z.string().min(1),
                name: z.string().min(1),
                active: z.literal(true)
            })
            .strict(),
        teams: z.tuple([]),
        organizations: z.tuple([])
    })
    .strict()

export type PlayCanvasEditorCompatibilityIdentityDescriptor = z.infer<typeof playCanvasEditorCompatibilityIdentityDescriptorSchema>

export const playCanvasEditorCompatibilityProtocolDescriptorSchema = z
    .object({
        schemaVersion: z.literal(PLAYCANVAS_EDITOR_COMPATIBILITY_VERSION),
        mode: z.literal(PLAYCANVAS_EDITOR_COMPATIBILITY_MODE),
        upstream: z
            .object({
                repository: z.literal('https://github.com/playcanvas/editor'),
                minimumTag: z.literal('v2.23.4')
            })
            .strict(),
        project: compatibilityProjectSummarySchema.nullable(),
        defaultSceneId: z.string().uuid().nullable(),
        identity: playCanvasEditorCompatibilityIdentityDescriptorSchema,
        endpoints: z
            .object({
                rest: compatibilitySurfaceDescriptorSchema,
                realtime: compatibilitySurfaceDescriptorSchema,
                messenger: compatibilitySurfaceDescriptorSchema
            })
            .strict(),
        shareDb: z
            .object({
                requiredCollections: z.tuple([z.literal('scenes'), z.literal('assets'), z.literal('settings')]),
                persisted: z.literal(false),
                persistence: z.literal('not-implemented'),
                sceneStorage: z.literal('metahub-playcanvas-project-storage')
            })
            .strict(),
        cloudOnly: z
            .object({
                store: compatibilitySurfaceDescriptorSchema,
                jobs: compatibilitySurfaceDescriptorSchema,
                branchesCheckpoints: compatibilitySurfaceDescriptorSchema,
                sourcefiles: compatibilitySurfaceDescriptorSchema,
                publishing: compatibilitySurfaceDescriptorSchema,
                usersCollaboration: compatibilitySurfaceDescriptorSchema,
                assetPipeline: compatibilitySurfaceDescriptorSchema
            })
            .strict(),
        documents: z
            .object({
                codeEditorSourcefiles: compatibilitySurfaceDescriptorSchema
            })
            .strict(),
        settingsDocuments: z
            .object({
                user: z.string().min(1).max(256),
                projectUser: z.string().min(1).max(512),
                projectPrivate: z.string().min(1).max(256)
            })
            .strict()
    })
    .strict()

export type PlayCanvasEditorCompatibilityProtocolDescriptor = z.infer<typeof playCanvasEditorCompatibilityProtocolDescriptorSchema>

export const playCanvasEditorCompatibilityParamsSchema = z
    .object({
        metahubId: z.string().min(1).max(128),
        projectId: uuidSchema
    })
    .strict()

export const playCanvasEditorCompatibilitySceneParamsSchema = playCanvasEditorCompatibilityParamsSchema
    .extend({
        sceneId: uuidSchema
    })
    .strict()

export const playCanvasEditorCompatibilitySettingsKindSchema = z.enum(['user', 'projectUser', 'projectPrivate'])

export const playCanvasEditorCompatibilitySettingsParamsSchema = playCanvasEditorCompatibilityParamsSchema
    .extend({
        kind: playCanvasEditorCompatibilitySettingsKindSchema
    })
    .strict()

export const playCanvasEditorCompatibilityAssetSummarySchema = z
    .object({
        id: uuidSchema,
        stableAssetId: z.string().min(1).max(160),
        type: z.string().min(1).max(80),
        name: z.string().min(1).max(255),
        virtualPath: z.string().min(1).max(512),
        mime: z.string().min(1).max(120).nullable(),
        hash: z.string().min(1).max(160).nullable(),
        size: z.number().int().nonnegative().nullable()
    })
    .strict()

export const playCanvasEditorCompatibilitySceneSummarySchema = z
    .object({
        id: uuidSchema,
        displayName: z.unknown(),
        codename: z.unknown(),
        checksum: sha256Schema.nullable().optional(),
        sortOrder: z.number().int().optional(),
        publish: z.boolean().optional(),
        version: z.number().int().positive().optional()
    })
    .passthrough()

export const playCanvasEditorCompatibilityConfigSchema = z
    .object({
        schemaVersion: z.literal(PLAYCANVAS_EDITOR_COMPATIBILITY_VERSION),
        mode: z.literal(PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE),
        protocol: playCanvasEditorCompatibilityProtocolDescriptorSchema,
        projectId: uuidSchema,
        defaultSceneId: uuidSchema.nullable(),
        userId: z.string().min(1).max(256),
        permissions: z
            .object({
                read: z.literal(true),
                write: z.literal(true),
                admin: z.literal(false)
            })
            .strict(),
        endpoints: z
            .object({
                scenes: z.string().min(1),
                assets: z.string().min(1),
                settings: z.string().min(1),
                cloudOnly: z.string().min(1)
            })
            .strict(),
        auth: z
            .object({
                scheme: z.literal('signed-header'),
                headerName: z.literal('X-PlayCanvas-Editor-Token'),
                accessToken: z.string().min(32),
                expiresAt: z.string().datetime()
            })
            .strict(),
        csrf: z
            .object({
                tokenUrl: z.string().min(1),
                headerName: z.literal('X-CSRF-Token')
            })
            .strict()
    })
    .strict()

export type PlayCanvasEditorCompatibilityConfig = z.infer<typeof playCanvasEditorCompatibilityConfigSchema>

export const playCanvasEditorCompatibilitySceneSaveRequestSchema = z
    .object({
        requestId: requestIdSchema,
        payload: playCanvasEditorCompatibilityScenePayloadSchema,
        expectedCurrentChecksum: sha256Schema.nullable().optional()
    })
    .strict()

export type PlayCanvasEditorCompatibilitySceneSaveRequest = z.infer<typeof playCanvasEditorCompatibilitySceneSaveRequestSchema>

export const playCanvasEditorCompatibilitySettingsDocumentSchema = z
    .object({
        kind: playCanvasEditorCompatibilitySettingsKindSchema,
        documentId: z.string().min(1).max(512),
        data: z.record(z.string().max(120), jsonValueSchema).default({}),
        revision: z.string().min(1).max(120)
    })
    .strict()

export type PlayCanvasEditorCompatibilitySettingsDocument = z.infer<typeof playCanvasEditorCompatibilitySettingsDocumentSchema>

export const playCanvasEditorCompatibilitySettingsWriteRequestSchema = z
    .object({
        requestId: requestIdSchema,
        data: z.record(z.string().max(120), jsonValueSchema).default({}),
        expectedRevision: z.string().min(1).max(120).optional()
    })
    .strict()

export type PlayCanvasEditorCompatibilitySettingsWriteRequest = z.infer<typeof playCanvasEditorCompatibilitySettingsWriteRequestSchema>

export const playCanvasEditorCompatibilityCloudSurfaceSchema = z.enum([
    'store',
    'jobs',
    'branchesCheckpoints',
    'sourcefiles',
    'publishing',
    'usersCollaboration',
    'assetPipeline'
])

export const playCanvasEditorCompatibilityNoOpResponseSchema = z
    .object({
        ok: z.literal(true),
        surface: playCanvasEditorCompatibilityCloudSurfaceSchema,
        status: z.literal('stubbed'),
        reason: z.literal('cloudOnlySurfaceOutsideFirstSlice')
    })
    .strict()

export type PlayCanvasEditorCompatibilityNoOpResponse = z.infer<typeof playCanvasEditorCompatibilityNoOpResponseSchema>
