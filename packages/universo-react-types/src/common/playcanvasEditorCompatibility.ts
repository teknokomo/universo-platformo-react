import { z } from 'zod'
import {
    PLAYCANVAS_PROJECT_FILE_MAX_BYTES,
    PLAYCANVAS_PROJECT_JSON_MAX_DEPTH,
    PLAYCANVAS_PROJECT_JSON_MAX_NODES,
    isBoundedPlayCanvasProjectJsonValue,
    playCanvasProjectJsonValueSchema,
    playCanvasProjectMetadataSchema,
    playCanvasProjectSettingsSchema,
    PLAYCANVAS_PROJECT_JSON_MIME_TYPES,
    PLAYCANVAS_PROJECT_SCHEMA_VERSION
} from './playcanvasProjects'

export const PLAYCANVAS_EDITOR_COMPATIBILITY_MODE = 'universo-bridge-minimal' as const
export const PLAYCANVAS_EDITOR_COMPATIBILITY_VERSION = '1' as const
export const PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE = 'universo-compatibility-rest-minimal' as const
export const PLAYCANVAS_EDITOR_FULL_BOOT_MODE = 'universo-full-upstream-ui' as const
export const PLAYCANVAS_EDITOR_UPSTREAM_MINIMUM_TAG = 'v2.30.4' as const
export const PLAYCANVAS_EDITOR_SCHEMA_CATALOG_VERSION = 1
export const PLAYCANVAS_EDITOR_COMPATIBILITY_MAX_SCENE_ENTITIES = 5000
export const PLAYCANVAS_EDITOR_COMPATIBILITY_MAX_SCENE_ASSETS = 2000
export const PLAYCANVAS_EDITOR_COMPATIBILITY_MAX_ASSET_DELETE_IDS = 256
export const PLAYCANVAS_EDITOR_COMPATIBILITY_MAX_ASSET_DOCUMENT_KEYS = 256
export const PLAYCANVAS_EDITOR_COMPATIBILITY_MAX_SCRIPT_ATTRIBUTES = 128
export const PLAYCANVAS_EDITOR_COMPATIBILITY_MAX_JSON_DEPTH = PLAYCANVAS_PROJECT_JSON_MAX_DEPTH
export const PLAYCANVAS_EDITOR_COMPATIBILITY_MAX_JSON_NODES = PLAYCANVAS_PROJECT_JSON_MAX_NODES
export const PLAYCANVAS_EDITOR_COMPATIBILITY_TOKEN_TTL_MS = 5 * 60 * 1000

const uuidSchema = z.string().uuid()
const requestIdSchema = uuidSchema
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i)
type JsonValue = z.infer<typeof playCanvasProjectJsonValueSchema>

const unsafeJsonKeys = new Set(['__proto__', 'prototype', 'constructor'])

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
        return false
    }
    try {
        const prototype = Object.getPrototypeOf(value)
        return prototype === Object.prototype || prototype === null
    } catch {
        return false
    }
}

/**
 * Validates editor JSON iteratively so attacker-controlled nesting cannot
 * exhaust the JavaScript call stack before Zod gets a chance to reject it.
 */
export const isBoundedPlayCanvasEditorJsonValue = isBoundedPlayCanvasProjectJsonValue

const calculateJsonDepth = (value: unknown): number => {
    const pending: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }]
    const visited = new WeakSet<object>()
    let maxDepth = 0

    while (pending.length > 0) {
        const current = pending.pop() as { value: unknown; depth: number }
        maxDepth = Math.max(maxDepth, current.depth)
        if (current.value == null || typeof current.value !== 'object') continue
        if (visited.has(current.value)) continue
        visited.add(current.value)
        if (Array.isArray(current.value)) {
            try {
                for (const child of current.value) pending.push({ value: child, depth: current.depth + 1 })
            } catch {
                return current.depth + 1
            }
            continue
        }
        if (!isPlainObject(current.value)) {
            maxDepth = Math.max(maxDepth, current.depth + 1)
            continue
        }
        try {
            for (const child of Object.values(current.value)) pending.push({ value: child, depth: current.depth + 1 })
        } catch {
            return current.depth + 1
        }
    }

    return maxDepth
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

const jsonValueSchema: z.ZodType<JsonValue> = playCanvasProjectJsonValueSchema

export const isSafePlayCanvasEditorScriptAttributeName = (value: string): boolean =>
    value.length > 0 && value.length <= 128 && !unsafeJsonKeys.has(value) && /^[A-Za-z_$][A-Za-z0-9_$.-]*$/.test(value)

/**
 * Shared validation for asset documents arriving through REST, ShareDB, or
 * the host bridge. The editor adds version-specific fields, so the top-level
 * shape remains open while every value and script attribute name is bounded.
 */
export const playCanvasEditorCompatibilityAssetDocumentSchema = z
    .record(z.string().min(1).max(160), jsonValueSchema)
    .superRefine((value, context) => {
        const keys = Object.keys(value)
        if (keys.length > PLAYCANVAS_EDITOR_COMPATIBILITY_MAX_ASSET_DOCUMENT_KEYS) {
            context.addIssue({
                code: z.ZodIssueCode.too_big,
                maximum: PLAYCANVAS_EDITOR_COMPATIBILITY_MAX_ASSET_DOCUMENT_KEYS,
                type: 'object',
                inclusive: true,
                message: 'Asset document contains too many fields'
            })
        }
        if (!serializedSizeIsWithinLimit(value)) {
            context.addIssue({ code: z.ZodIssueCode.custom, message: 'Asset document exceeds the PlayCanvas project file size limit' })
        }

        const scripts = value.scripts
        if (scripts === undefined) return
        if (!isPlainObject(scripts)) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['scripts'], message: 'Asset scripts must be a JSON object' })
            return
        }
        const scriptNames = Object.keys(scripts)
        if (scriptNames.length > PLAYCANVAS_EDITOR_COMPATIBILITY_MAX_SCRIPT_ATTRIBUTES) {
            context.addIssue({
                code: z.ZodIssueCode.too_big,
                path: ['scripts'],
                maximum: PLAYCANVAS_EDITOR_COMPATIBILITY_MAX_SCRIPT_ATTRIBUTES,
                type: 'object',
                inclusive: true,
                message: 'Asset contains too many script attributes'
            })
        }
        for (const scriptName of scriptNames) {
            if (!isSafePlayCanvasEditorScriptAttributeName(scriptName)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['scripts', scriptName],
                    message: 'Asset script attribute name is not safe'
                })
            }
        }
    })

export type PlayCanvasEditorCompatibilityAssetDocument = z.infer<typeof playCanvasEditorCompatibilityAssetDocumentSchema>

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
        metadata: playCanvasProjectMetadataSchema.optional(),
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
        data: jsonValueSchema.optional(),
        meta: jsonValueSchema.optional(),
        metadata: playCanvasProjectMetadataSchema.optional()
    })
    .strict()

export const playCanvasEditorCompatibilityScenePayloadSchema = z
    .object({
        schemaVersion: z.string().min(1).max(40).default(PLAYCANVAS_PROJECT_SCHEMA_VERSION),
        settings: playCanvasProjectSettingsSchema.optional(),
        entities: z.array(sceneEntitySchema).max(PLAYCANVAS_EDITOR_COMPATIBILITY_MAX_SCENE_ENTITIES).default([]),
        assets: z.array(sceneAssetReferenceSchema).max(PLAYCANVAS_EDITOR_COMPATIBILITY_MAX_SCENE_ASSETS).optional(),
        metadata: playCanvasProjectMetadataSchema.optional()
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
        // Every signed compatibility token is bound to the canonical HTTP(S)
        // origin that is allowed to use it. The token service performs the
        // stricter path/query/fragment normalization before signing.
        origin: z.string().url(),
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
                minimumTag: z.literal(PLAYCANVAS_EDITOR_UPSTREAM_MINIMUM_TAG)
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
        id: z.string().min(1).max(160),
        stableAssetId: z.string().min(1).max(160),
        type: z.string().min(1).max(80),
        name: z.string().min(1).max(255),
        virtualPath: z.string().min(1).max(512),
        mime: z.string().min(1).max(120).nullable(),
        hash: z.string().min(1).max(160).nullable(),
        size: z.number().int().nonnegative().nullable(),
        metadata: z.record(z.string().max(120), jsonValueSchema).optional(),
        editorDocumentId: z.number().int().positive().max(2_147_483_647),
        editorParentDocumentId: z.number().int().positive().max(2_147_483_647).nullable(),
        editorPathDocumentIds: z.array(z.number().int().positive().max(2_147_483_647)).max(64),
        createdAt: z.string().datetime().nullable()
    })
    .strict()

export type PlayCanvasEditorCompatibilityAssetSummary = z.infer<typeof playCanvasEditorCompatibilityAssetSummarySchema>

const editorAssetCreateNameSchema = z.string().min(1).max(255)
const editorAssetDataSchema = playCanvasProjectMetadataSchema

export const playCanvasEditorCompatibilityAssetCreateRequestSchema = z
    .object({
        name: editorAssetCreateNameSchema,
        type: z.string().min(1).max(80),
        parent: z.number().int().positive().max(2_147_483_647).nullable().optional(),
        filename: z.string().min(1).max(255).optional(),
        data: editorAssetDataSchema.optional(),
        meta: editorAssetDataSchema.optional(),
        tags: z.string().max(1024).optional(),
        preload: z.enum(['true', 'false']).optional()
    })
    .strict()

export type PlayCanvasEditorCompatibilityAssetCreateRequest = z.infer<typeof playCanvasEditorCompatibilityAssetCreateRequestSchema>

const editorAssetDocumentIdsSchema = z
    .array(z.number().int().positive().max(2_147_483_647))
    .min(1)
    .max(PLAYCANVAS_EDITOR_COMPATIBILITY_MAX_ASSET_DELETE_IDS)
    .superRefine((ids, context) => {
        if (new Set(ids).size !== ids.length) {
            context.addIssue({ code: z.ZodIssueCode.custom, message: 'Asset document ids must be unique' })
        }
    })

export const playCanvasEditorCompatibilityAssetDeleteRequestSchema = z
    .object({ assets: editorAssetDocumentIdsSchema })
    // The upstream DELETE payload also carries branch metadata; validate the
    // bounded asset list while preserving compatibility with those fields.
    .passthrough()

export type PlayCanvasEditorCompatibilityAssetDeleteRequest = z.infer<typeof playCanvasEditorCompatibilityAssetDeleteRequestSchema>

export const playCanvasEditorCompatibilityAssetDeleteFrameSchema = z
    .object({ op: z.literal('delete'), ids: editorAssetDocumentIdsSchema })
    .strict()

export type PlayCanvasEditorCompatibilityAssetDeleteFrame = z.infer<typeof playCanvasEditorCompatibilityAssetDeleteFrameSchema>

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
                headerName: z.literal('X-CSRF-Token'),
                // Cross-origin sandboxed Editor frames cannot send the
                // host-only session cookie. The optional signed proof is
                // origin/project/user bound and is accepted only by the
                // compatibility write guard; session-backed CSRF remains the
                // default for same-origin callers.
                token: z.string().min(32).optional()
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

// Internal sentinel path used for vendor navigation targets whose surfaces are
// unavailable in Universo-hosted projects (capability decision D4). It must
// never contain the literal '/disabled' so the existing full-boot URL rule and
// the artifact bootstrap guard stay intact; the bridge and host recognize this
// prefix and fail closed with localized messaging instead of raw navigation.
export const PLAYCANVAS_EDITOR_SURFACE_UNAVAILABLE_PATH = '/universo-surface-unavailable' as const

export const playCanvasEditorUnavailablePageSurfaceSchema = z.enum(['blankProjectPicker', 'codeEditor', 'launchPage', 'fontImport'])

export type PlayCanvasEditorUnavailablePageSurface = z.infer<typeof playCanvasEditorUnavailablePageSurfaceSchema>

// Canonical D4 reason keys per unavailable surface; the pages descriptor refuses
// any other value so backend, host, and artifact stay aligned without hidden
// knowledge.
export const PLAYCANVAS_EDITOR_PAGE_UNAVAILABLE_REASONS = {
    blankProjectPicker: 'sessionsAreProjectPinned',
    codeEditor: 'shareDbDocumentsCollectionNotImplemented',
    launchPage: 'launchSurfaceDeferred',
    fontImport: 'fontGenerationWorkerStubbed'
} as const satisfies Record<PlayCanvasEditorUnavailablePageSurface, string>

export const playCanvasEditorPageVariantSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('fullEditor') }).strict(),
    z
        .object({
            kind: z.literal('unavailable'),
            surface: playCanvasEditorUnavailablePageSurfaceSchema,
            reasonKey: z.string().min(1).max(120)
        })
        .strict()
])

export type PlayCanvasEditorPageVariant = z.infer<typeof playCanvasEditorPageVariantSchema>

export const playCanvasEditorFullBootPagesDescriptorSchema = z
    .object({
        fullEditor: playCanvasEditorPageVariantSchema,
        codeEditor: playCanvasEditorPageVariantSchema,
        launchPage: playCanvasEditorPageVariantSchema,
        blankProjectPicker: playCanvasEditorPageVariantSchema,
        fontImport: playCanvasEditorPageVariantSchema
    })
    .strict()
    .superRefine((pages, ctx) => {
        const expectUnavailable = (key: Exclude<keyof typeof pages, 'fullEditor'>, surface: PlayCanvasEditorUnavailablePageSurface) => {
            const entry = pages[key]
            if (entry.kind !== 'unavailable') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: [key],
                    message: `Full-boot page ${key} must be marked unavailable`
                })
                return
            }
            if (entry.surface !== surface || entry.reasonKey !== PLAYCANVAS_EDITOR_PAGE_UNAVAILABLE_REASONS[surface]) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: [key],
                    message: `Full-boot page ${key} has an unexpected surface or reason`
                })
            }
        }
        if (pages.fullEditor.kind !== 'fullEditor') {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['fullEditor'],
                message: 'Full-boot page fullEditor must be the active editor variant'
            })
        }
        expectUnavailable('codeEditor', 'codeEditor')
        expectUnavailable('launchPage', 'launchPage')
        expectUnavailable('blankProjectPicker', 'blankProjectPicker')
        expectUnavailable('fontImport', 'fontImport')
    })

export type PlayCanvasEditorFullBootPagesDescriptor = z.infer<typeof playCanvasEditorFullBootPagesDescriptorSchema>

export type PlayCanvasEditorSchemaCatalogValue =
    | string
    | number
    | boolean
    | null
    | PlayCanvasEditorSchemaCatalogValue[]
    | { [key: string]: PlayCanvasEditorSchemaCatalogValue }

export const playCanvasEditorSchemaCatalogValueSchema: z.ZodType<PlayCanvasEditorSchemaCatalogValue> = z.lazy(() =>
    z.union([
        z.string(),
        z.number().finite(),
        z.boolean(),
        z.null(),
        z.array(playCanvasEditorSchemaCatalogValueSchema),
        z.record(z.string(), playCanvasEditorSchemaCatalogValueSchema)
    ])
)

export const playCanvasEditorSchemaCatalogSchema = z
    .object({
        version: z.literal(PLAYCANVAS_EDITOR_SCHEMA_CATALOG_VERSION),
        documents: z.record(z.string(), playCanvasEditorSchemaCatalogValueSchema),
        assetData: z.record(z.string(), playCanvasEditorSchemaCatalogValueSchema)
    })
    .strict()

export type PlayCanvasEditorSchemaCatalog = z.infer<typeof playCanvasEditorSchemaCatalogSchema>

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
                launch: fullBootUrlSchema,
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
        pages: playCanvasEditorFullBootPagesDescriptorSchema,
        schema: playCanvasEditorSchemaCatalogSchema,
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
                tokenRefreshUrl: fullBootUrlSchema,
                // Full-boot asset mutations originate in the sandboxed
                // artifact and therefore use the full-boot access token. The
                // proof is issued for that exact token and origin; REST mode
                // carries its own proof in the compatibility config.
                compatibilityCsrfToken: z
                    .object({
                        token: z.string().min(32),
                        headerName: z.literal('X-CSRF-Token')
                    })
                    .strict()
                    .optional()
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
        data: playCanvasProjectSettingsSchema.default({}),
        revision: z.string().min(1).max(120)
    })
    .strict()

export type PlayCanvasEditorCompatibilitySettingsDocument = z.infer<typeof playCanvasEditorCompatibilitySettingsDocumentSchema>

export const playCanvasEditorCompatibilitySettingsWriteRequestSchema = z
    .object({
        requestId: requestIdSchema,
        data: playCanvasProjectSettingsSchema.default({}),
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
