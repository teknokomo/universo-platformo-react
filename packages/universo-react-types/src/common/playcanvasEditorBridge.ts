import { z } from 'zod'
import {
    PLAYCANVAS_PROJECT_FILE_MAX_BYTES,
    PLAYCANVAS_PROJECT_JSON_MIME_TYPES,
    PLAYCANVAS_PROJECT_SCHEMA_VERSION,
    type PlayCanvasAsset,
    type PlayCanvasProjectSummary,
    type PlayCanvasScene
} from './playcanvasProjects'
import type { PlayCanvasEditorCompatibilityProtocolDescriptor } from './playcanvasEditorCompatibility'

export {
    PLAYCANVAS_EDITOR_COMPATIBILITY_MODE,
    PLAYCANVAS_EDITOR_COMPATIBILITY_VERSION,
    playCanvasEditorCompatibilityIdentityDescriptorSchema,
    playCanvasEditorCompatibilityProtocolDescriptorSchema,
    type PlayCanvasEditorCompatibilityIdentityDescriptor,
    type PlayCanvasEditorCompatibilityProtocolDescriptor,
    type PlayCanvasEditorCompatibilitySurfaceDescriptor
} from './playcanvasEditorCompatibility'

export const PLAYCANVAS_EDITOR_BRIDGE_VERSION = '1' as const
export const PLAYCANVAS_EDITOR_BRIDGE_SESSION_TTL_MS = 5 * 60 * 1000
export const PLAYCANVAS_EDITOR_BRIDGE_MAX_CAPABILITIES = 32
export const PLAYCANVAS_EDITOR_BRIDGE_MAX_SCENE_ENTITIES = 5000
export const PLAYCANVAS_EDITOR_BRIDGE_MAX_SCENE_ASSETS = 2000
export const PLAYCANVAS_EDITOR_BRIDGE_MAX_JSON_DEPTH = 24

export const PLAYCANVAS_EDITOR_BRIDGE_CAPABILITIES = [
    'protocol.describe',
    'project.loadSelected',
    'scene.list',
    'scene.read',
    'scene.save',
    'scene.saveStatus',
    'asset.listMinimalForScene',
    'bridge.capabilities',
    'bridge.close',
    'bridge.dirtyState'
] as const
export type PlayCanvasEditorBridgeCapability = (typeof PLAYCANVAS_EDITOR_BRIDGE_CAPABILITIES)[number]

export const PLAYCANVAS_EDITOR_BRIDGE_ERROR_CODES = [
    'invalidCommand',
    'unsupportedVersion',
    'unauthorized',
    'forbidden',
    'csrfRequired',
    'sessionExpired',
    'replayRejected',
    'projectUnavailable',
    'sceneUnavailable',
    'assetUnavailable',
    'payloadTooLarge',
    'saveConflict',
    'storageUnavailable',
    'artifactUnavailable',
    'unsupportedCapability',
    'internalError'
] as const
export type PlayCanvasEditorBridgeErrorCode = (typeof PLAYCANVAS_EDITOR_BRIDGE_ERROR_CODES)[number]

export const playCanvasEditorUuidV7Schema = z
    .string()
    .uuid()
    .refine((value) => value[14] === '7', {
        message: 'Expected UUID v7'
    })
const persistedUuidSchema = z.string().uuid()

export const playCanvasEditorBridgeSessionClaimsSchema = z
    .object({
        sessionId: playCanvasEditorUuidV7Schema,
        metahubId: z.string().min(1).max(128),
        packageSlug: z.string().min(1).max(128),
        projectId: persistedUuidSchema.nullable(),
        defaultSceneId: persistedUuidSchema.nullable().optional(),
        userId: z.string().min(1).max(256),
        nonce: z.string().min(32).max(256),
        expiresAt: z.number().int().positive(),
        bridgeVersion: z.literal(PLAYCANVAS_EDITOR_BRIDGE_VERSION),
        capabilities: z.array(z.enum(PLAYCANVAS_EDITOR_BRIDGE_CAPABILITIES)).max(PLAYCANVAS_EDITOR_BRIDGE_MAX_CAPABILITIES)
    })
    .strict()

export type PlayCanvasEditorBridgeSessionClaims = z.infer<typeof playCanvasEditorBridgeSessionClaimsSchema>

export const playCanvasEditorSha256Schema = z.string().regex(/^[a-f0-9]{64}$/i)

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
        fileId: persistedUuidSchema.nullable().optional(),
        mime: z.enum(PLAYCANVAS_PROJECT_JSON_MIME_TYPES).nullable().optional(),
        metadata: z.record(z.string().max(120), jsonValueSchema).optional()
    })
    .strict()

const serializedSizeIsWithinLimit = (value: unknown): boolean => {
    try {
        const serialized = JSON.stringify(value)
        const bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(serialized).byteLength : serialized.length
        return bytes <= PLAYCANVAS_PROJECT_FILE_MAX_BYTES
    } catch {
        return false
    }
}

export const playCanvasEditorScenePayloadSchema = z
    .object({
        schemaVersion: z.string().min(1).max(40).default(PLAYCANVAS_PROJECT_SCHEMA_VERSION),
        settings: z.record(z.string().max(120), jsonValueSchema).optional(),
        entities: z.array(sceneEntitySchema).max(PLAYCANVAS_EDITOR_BRIDGE_MAX_SCENE_ENTITIES).default([]),
        assets: z.array(sceneAssetReferenceSchema).max(PLAYCANVAS_EDITOR_BRIDGE_MAX_SCENE_ASSETS).optional(),
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
        if (calculateJsonDepth(value) > PLAYCANVAS_EDITOR_BRIDGE_MAX_JSON_DEPTH) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [],
                message: 'Scene payload is too deeply nested'
            })
        }
    })

export type PlayCanvasEditorScenePayload = z.infer<typeof playCanvasEditorScenePayloadSchema>

export interface PlayCanvasEditorBridgeSessionDescriptor {
    sessionId: string
    sessionToken: string
    nonce: string
    expiresAt: string
    bridgeVersion: typeof PLAYCANVAS_EDITOR_BRIDGE_VERSION
    writeMode: 'manager'
    capabilities: PlayCanvasEditorBridgeCapability[]
}

export interface PlayCanvasEditorSelectedProjectDescriptor {
    project: PlayCanvasProjectSummary
    defaultSceneId?: string | null
}

export interface PlayCanvasEditorHostBridgeDescriptor {
    schemaVersion: typeof PLAYCANVAS_EDITOR_BRIDGE_VERSION
    bridge: PlayCanvasEditorBridgeSessionDescriptor
    selectedProject?: PlayCanvasEditorSelectedProjectDescriptor | null
    compatibilityStatus: 'ready' | 'artifactUnavailable' | 'projectUnavailable' | 'blocked'
}

export interface PlayCanvasEditorMinimalAssetMetadata {
    id: PlayCanvasAsset['id']
    stableAssetId: PlayCanvasAsset['stableAssetId']
    type: PlayCanvasAsset['type']
    name: PlayCanvasAsset['name']
    virtualPath: PlayCanvasAsset['virtualPath']
    mime?: string | null
    hash?: string | null
    size?: number | null
}

const commandBaseSchema = z
    .object({
        requestId: playCanvasEditorUuidV7Schema,
        sessionId: playCanvasEditorUuidV7Schema,
        nonce: z.string().min(32).max(256)
    })
    .strict()

export const playCanvasEditorBridgeCommandSchema = z.discriminatedUnion('type', [
    commandBaseSchema.extend({
        type: z.literal('editor.ready'),
        bridgeVersion: z.literal(PLAYCANVAS_EDITOR_BRIDGE_VERSION),
        capabilities: z.array(z.enum(PLAYCANVAS_EDITOR_BRIDGE_CAPABILITIES)).max(PLAYCANVAS_EDITOR_BRIDGE_MAX_CAPABILITIES)
    }),
    commandBaseSchema.extend({
        type: z.literal('protocol.describe')
    }),
    commandBaseSchema.extend({
        type: z.literal('project.loadSelected')
    }),
    commandBaseSchema.extend({
        type: z.literal('scene.list'),
        projectId: persistedUuidSchema
    }),
    commandBaseSchema.extend({
        type: z.literal('scene.read'),
        projectId: persistedUuidSchema,
        sceneId: persistedUuidSchema
    }),
    commandBaseSchema.extend({
        type: z.literal('scene.save'),
        projectId: persistedUuidSchema,
        sceneId: persistedUuidSchema,
        expectedCurrentChecksum: playCanvasEditorSha256Schema.nullable(),
        payload: playCanvasEditorScenePayloadSchema
    }),
    commandBaseSchema.extend({
        type: z.literal('scene.saveStatus'),
        projectId: persistedUuidSchema,
        sceneId: persistedUuidSchema
    }),
    commandBaseSchema.extend({
        type: z.literal('asset.listMinimalForScene'),
        projectId: persistedUuidSchema,
        sceneId: persistedUuidSchema
    }),
    commandBaseSchema.extend({
        type: z.literal('bridge.capabilities')
    }),
    commandBaseSchema.extend({
        type: z.literal('bridge.close'),
        dirty: z.boolean().optional()
    }),
    commandBaseSchema.extend({
        type: z.literal('bridge.dirtyState'),
        dirty: z.boolean()
    })
])

export type PlayCanvasEditorBridgeCommand = z.infer<typeof playCanvasEditorBridgeCommandSchema>

export type PlayCanvasEditorBridgeResultData =
    | { protocol: PlayCanvasEditorCompatibilityProtocolDescriptor }
    | { project: PlayCanvasProjectSummary | null }
    | { scenes: Pick<PlayCanvasScene, 'id' | 'displayName' | 'codename' | 'checksum' | 'sortOrder' | 'publish'>[] }
    | { scene: PlayCanvasScene; payload: PlayCanvasEditorScenePayload | null }
    | { scene: PlayCanvasScene; checksum: string | null }
    | { assets: PlayCanvasEditorMinimalAssetMetadata[] }
    | { capabilities: PlayCanvasEditorBridgeCapability[] }
    | { dirty: boolean }
    | Record<string, never>

export const playCanvasEditorBridgeSuccessSchema = z
    .object({
        ok: z.literal(true),
        requestId: playCanvasEditorUuidV7Schema,
        data: z.unknown()
    })
    .strict()

export const playCanvasEditorBridgeErrorSchema = z
    .object({
        ok: z.literal(false),
        requestId: playCanvasEditorUuidV7Schema.optional(),
        code: z.enum(PLAYCANVAS_EDITOR_BRIDGE_ERROR_CODES),
        status: z.number().int().min(400).max(599),
        safeDetails: z.record(z.string().max(80), z.string().max(240)).optional()
    })
    .strict()

export const playCanvasEditorBridgeResponseSchema = z.discriminatedUnion('ok', [
    playCanvasEditorBridgeSuccessSchema,
    playCanvasEditorBridgeErrorSchema
])

export type PlayCanvasEditorBridgeSuccess = {
    ok: true
    requestId: string
    data: PlayCanvasEditorBridgeResultData
}
export type PlayCanvasEditorBridgeError = z.infer<typeof playCanvasEditorBridgeErrorSchema>
export type PlayCanvasEditorBridgeResponse = PlayCanvasEditorBridgeSuccess | PlayCanvasEditorBridgeError
