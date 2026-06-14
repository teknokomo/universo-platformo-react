import { z } from 'zod'
import {
    PLAYCANVAS_PROJECT_FILE_MAX_BYTES,
    PLAYCANVAS_PROJECT_JSON_MIME_TYPES,
    PLAYCANVAS_PROJECT_SCHEMA_VERSION
} from './playcanvasProjects'

export const PLAYCANVAS_EDITOR_COMPATIBILITY_MODE = 'universo-bridge-minimal' as const
export const PLAYCANVAS_EDITOR_COMPATIBILITY_VERSION = '1' as const
export const PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE = 'universo-compatibility-rest-minimal' as const
export const PLAYCANVAS_EDITOR_FULL_BOOT_MODE = 'universo-full-upstream-ui' as const
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

const sceneEntityVector3Schema = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()])

const sceneEntitySchema = z
    .object({
        id: z.string().min(1).max(160),
        name: z.string().max(255).optional(),
        parentId: z.string().min(1).max(160).nullable().optional(),
        enabled: z.boolean().optional(),
        position: sceneEntityVector3Schema.optional(),
        rotation: sceneEntityVector3Schema.optional(),
        scale: sceneEntityVector3Schema.optional(),
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
        sceneId: uuidSchema.optional(),
        userId: z.string().min(1).max(256),
        packageSlug: z.literal('playcanvas-editor'),
        mode: z.union([z.literal(PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE), z.literal(PLAYCANVAS_EDITOR_FULL_BOOT_MODE)]),
        origin: z.string().url().optional(),
        sessionId: z.string().min(1).max(160).optional(),
        nonce: z.string().min(1).max(160).optional(),
        assetDocumentIds: z.array(z.number().int().positive().max(2_147_483_647)).max(1000).optional(),
        expiresAt: z.number().int().positive()
    })
    .strict()

export type PlayCanvasEditorCompatibilityTokenClaims = z.infer<typeof playCanvasEditorCompatibilityTokenClaimsSchema>

const compatibilitySurfaceDescriptorSchema = z
    .object({
        status: z.enum(['enabled', 'stubbed', 'disabled', 'unsupported']),
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

export const playCanvasEditorNumericIdMappingSchema = z
    .object({
        selfId: z.number().int().positive(),
        ownerId: z.number().int().positive(),
        projectId: z.number().int().positive(),
        sceneId: z.number().int().positive(),
        settingsId: z.string().min(1).max(256),
        storage: z
            .object({
                metahubId: z.string().min(1).max(128),
                projectId: uuidSchema,
                sceneId: uuidSchema
            })
            .strict()
    })
    .strict()

export type PlayCanvasEditorNumericIdMapping = z.infer<typeof playCanvasEditorNumericIdMappingSchema>

const playCanvasEditorProtocolBaseSchema = z
    .object({
        schemaVersion: z.literal(PLAYCANVAS_EDITOR_COMPATIBILITY_VERSION),
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
                requiredCollections: z.tuple([z.literal('scenes'), z.literal('assets'), z.literal('settings'), z.literal('user_data')]),
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

export const playCanvasEditorBridgeMinimalProtocolDescriptorSchema = playCanvasEditorProtocolBaseSchema.extend({
    mode: z.literal(PLAYCANVAS_EDITOR_COMPATIBILITY_MODE)
})

export const playCanvasEditorFullBootProtocolDescriptorSchema = playCanvasEditorProtocolBaseSchema.extend({
    mode: z.literal(PLAYCANVAS_EDITOR_FULL_BOOT_MODE),
    numericIds: playCanvasEditorNumericIdMappingSchema,
    endpoints: z
        .object({
            rest: compatibilitySurfaceDescriptorSchema.extend({ status: z.literal('enabled') }),
            realtime: compatibilitySurfaceDescriptorSchema.extend({ status: z.literal('enabled') }),
            messenger: compatibilitySurfaceDescriptorSchema.extend({ status: z.literal('enabled') }),
            relay: compatibilitySurfaceDescriptorSchema.extend({ status: z.literal('enabled') })
        })
        .strict(),
    shareDb: z
        .object({
            requiredCollections: z.tuple([z.literal('scenes'), z.literal('assets'), z.literal('settings'), z.literal('user_data')]),
            persisted: z.literal(true),
            persistence: z.enum(['snapshot-port', 'document-op-store']),
            sceneStorage: z.literal('metahub-playcanvas-project-storage')
        })
        .strict()
})

export const playCanvasEditorCompatibilityProtocolDescriptorSchema = z.discriminatedUnion('mode', [
    playCanvasEditorBridgeMinimalProtocolDescriptorSchema,
    playCanvasEditorFullBootProtocolDescriptorSchema
])

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
        size: z.number().int().nonnegative().nullable(),
        editorDocumentId: z.number().int().positive().max(2_147_483_647)
    })
    .strict()

export const playCanvasEditorCompatibilitySourceFileSummarySchema = z
    .object({
        id: z.string().min(1).max(160),
        path: z.string().min(1).max(512),
        filename: z.string().min(1).max(512).optional(),
        name: z.string().min(1).max(255),
        hash: sha256Schema.nullable().optional(),
        size: z.number().int().nonnegative().max(PLAYCANVAS_PROJECT_FILE_MAX_BYTES).nullable().optional(),
        mime: z.string().min(1).max(120).nullable().optional(),
        updatedAt: z.string().datetime().nullable().optional()
    })
    .strict()

export type PlayCanvasEditorCompatibilitySourceFileSummary = z.infer<typeof playCanvasEditorCompatibilitySourceFileSummarySchema>

export const playCanvasEditorCompatibilitySourceFileParamsSchema = playCanvasEditorCompatibilityParamsSchema
    .extend({
        sourceFileId: z.string().min(1).max(160)
    })
    .strict()

export const playCanvasEditorCompatibilitySourceFileDocumentSchema = playCanvasEditorCompatibilitySourceFileSummarySchema
    .extend({
        content: z.string().max(PLAYCANVAS_PROJECT_FILE_MAX_BYTES)
    })
    .strict()

export type PlayCanvasEditorCompatibilitySourceFileDocument = z.infer<typeof playCanvasEditorCompatibilitySourceFileDocumentSchema>

export const playCanvasEditorCompatibilitySourceFileWriteRequestSchema = z
    .object({
        requestId: requestIdSchema,
        path: z.string().min(1).max(512),
        name: z.string().min(1).max(255).optional(),
        content: z.string().max(PLAYCANVAS_PROJECT_FILE_MAX_BYTES),
        expectedCurrentChecksum: sha256Schema.nullable().optional()
    })
    .strict()

export type PlayCanvasEditorCompatibilitySourceFileWriteRequest = z.infer<typeof playCanvasEditorCompatibilitySourceFileWriteRequestSchema>

export const playCanvasEditorCompatibilitySourceFileDeleteRequestSchema = z
    .object({
        requestId: requestIdSchema,
        expectedCurrentChecksum: sha256Schema.nullable().optional()
    })
    .strict()

export type PlayCanvasEditorCompatibilitySourceFileDeleteRequest = z.infer<
    typeof playCanvasEditorCompatibilitySourceFileDeleteRequestSchema
>

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
                sourcefiles: z.string().min(1),
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

export const playCanvasEditorFullBootEndpointDescriptorSchema = z
    .object({
        restBaseUrl: z.string().min(1),
        realtimeWsUrl: z.string().min(1),
        messengerWsUrl: z.string().min(1),
        relayWsUrl: z.string().min(1)
    })
    .strict()

export type PlayCanvasEditorFullBootEndpointDescriptor = z.infer<typeof playCanvasEditorFullBootEndpointDescriptorSchema>

const fullBootUrlSchema = z
    .string()
    .min(1)
    .refine((value) => !value.includes('/disabled'), {
        message: 'Full-boot URL must not point to a disabled endpoint'
    })

const numericIdSchema = z.number().int().positive()

export const playCanvasEditorFullBootConfigSchema = z
    .object({
        mode: z.literal(PLAYCANVAS_EDITOR_FULL_BOOT_MODE),
        accessToken: z.string().min(32),
        project: z
            .object({
                id: numericIdSchema,
                name: z.string().min(1),
                private: z.boolean(),
                privateAssets: z.boolean(),
                hasPrivateSettings: z.boolean(),
                masterBranch: numericIdSchema,
                permissions: z
                    .object({
                        read: z.array(numericIdSchema).min(1),
                        write: z.array(numericIdSchema).min(1),
                        admin: z.tuple([])
                    })
                    .strict(),
                settings: z
                    .object({
                        id: z.string().min(1),
                        engineV2: z.literal(true),
                        width: z.number().int().positive(),
                        height: z.number().int().positive(),
                        scripts: z.array(z.unknown()),
                        useLegacyScripts: z.literal(false)
                    })
                    .passthrough()
            })
            .passthrough(),
        scene: z.object({ id: numericIdSchema, uniqueId: numericIdSchema }).strict(),
        self: z
            .object({
                id: numericIdSchema,
                username: z.string().min(1),
                branch: z.object({ id: numericIdSchema, name: z.string().min(1) }).passthrough(),
                flags: z.object({ superUser: z.literal(false) }).passthrough()
            })
            .passthrough(),
        owner: z.object({ id: numericIdSchema, username: z.string().min(1) }).passthrough(),
        branch: z.object({ id: numericIdSchema, name: z.string().min(1) }).passthrough(),
        url: z
            .object({
                api: fullBootUrlSchema,
                home: fullBootUrlSchema,
                frontend: fullBootUrlSchema,
                engine: fullBootUrlSchema,
                images: fullBootUrlSchema,
                static: fullBootUrlSchema,
                store: fullBootUrlSchema,
                howdoi: fullBootUrlSchema,
                realtime: z.object({ http: fullBootUrlSchema }).strict(),
                messenger: z.object({ ws: fullBootUrlSchema, http: fullBootUrlSchema }).passthrough(),
                relay: z.object({ ws: fullBootUrlSchema, http: fullBootUrlSchema }).passthrough()
            })
            .passthrough(),
        schema: z
            .object({
                asset: z.record(z.unknown()),
                scene: z.record(z.unknown()),
                settings: z.record(z.unknown())
            })
            .passthrough(),
        engineVersions: z
            .object({
                force: z.object({ version: z.string().min(1) }).passthrough(),
                current: z.object({ version: z.string().min(1) }).passthrough()
            })
            .passthrough(),
        store: z.record(z.unknown()),
        aws: z.record(z.unknown()),
        wasmModules: z.array(
            z
                .object({
                    moduleName: z.string().min(1),
                    glueUrl: z.string().min(1),
                    wasmUrl: z.string().min(1),
                    fallbackUrl: z.string().min(1)
                })
                .strict()
        ),
        sentry: z.record(z.unknown()),
        metrics: z.record(z.unknown()),
        selfHosted: z.literal(true),
        universoHosted: z.literal(true),
        universoBridge: z
            .object({
                compatibilityRestBaseUrl: fullBootUrlSchema,
                tokenRefreshUrl: fullBootUrlSchema
            })
            .strict()
    })
    .passthrough()

export type PlayCanvasEditorFullBootConfig = z.infer<typeof playCanvasEditorFullBootConfigSchema>

export const playCanvasEditorAnyCompatibilityConfigSchema = z.discriminatedUnion('mode', [
    playCanvasEditorCompatibilityConfigSchema,
    playCanvasEditorFullBootConfigSchema
])

export type PlayCanvasEditorAnyCompatibilityConfig = z.infer<typeof playCanvasEditorAnyCompatibilityConfigSchema>

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
