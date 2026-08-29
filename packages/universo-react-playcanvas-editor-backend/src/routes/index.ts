import { Router, type NextFunction, type Request, type Response, type RequestHandler } from 'express'
import Busboy from 'busboy'
import type {
    PlayCanvasEditorCompatibilityNoOpResponse,
    PlayCanvasEditorCompatibilityProtocolDescriptor,
    PlayCanvasProjectSummary,
    PlayCanvasScene,
    PlayCanvasEditorScenePayload,
    PlayCanvasEditorCompatibilitySettingsDocument,
    PlayCanvasEditorCompatibilitySourceFileDocument,
    PlayCanvasEditorCompatibilitySourceFileSummary
} from '@universo-react/types'
import { PLAYCANVAS_PROJECT_FILE_MAX_BYTES, isBoundedPlayCanvasEditorJsonValue } from '@universo-react/types'
import { generateUuidV7 } from '@universo-react/utils'
import { PlayCanvasEditorCompatibilityTokenService } from '../tokens/index.js'

import {
    PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE,
    PLAYCANVAS_EDITOR_FULL_BOOT_MODE,
    playCanvasEditorCompatibilityCloudSurfaceSchema,
    playCanvasEditorCompatibilityNoOpResponseSchema
} from '@universo-react/types'
import { resolvePlatformApiOrigin, resolveRequestOrigin } from '../middleware/index.js'

import {
    parseCanonicalPlayCanvasEditorDocumentId,
    resolveCompatibilityToken,
    validateCompatibilityToken,
    validateFullBootClaims,
    validateCompatibilityCsrfToken
} from '../tokens/index.js'
import { registerPlayCanvasProjectRoutes } from './projectRoutes.js'
import { registerPlayCanvasAssetRoutes } from './assetRoutes.js'
import { registerPlayCanvasSourceFileRoutes } from './sourceFileRoutes.js'
import { registerPlayCanvasSettingsRoutes } from './settingsRoutes.js'

export const validateParams = <T>(
    schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
    value: unknown
): T | null => {
    const parsed = schema.safeParse(value)
    return parsed.success ? parsed.data : null
}

type CompatibilityRequestUser = {
    id?: unknown
    sub?: unknown
    user_id?: unknown
    userId?: unknown
}

const readCompatibilityUserId = (value: unknown): string | null => {
    if (!value || typeof value !== 'object') return null
    const user = value as CompatibilityRequestUser
    for (const candidate of [user.id, user.sub, user.user_id, user.userId]) {
        if (typeof candidate === 'string' && candidate.length > 0) return candidate
    }
    return null
}

/**
 * Resolves the identity authenticated by the browser session, not merely the
 * current bearer/request user. A request may carry an explicit Authorization
 * header for another account while still presenting a CSRF token from its
 * session cookie; Passport's serialized identity is the authoritative binding
 * in that case. Test/embedded hosts without express-session retain the
 * request-user fallback used by the existing route contract.
 */
const resolveSessionUserId = (req: Request): string | null => {
    const session = (req as Request & { session?: { passport?: { user?: unknown } } }).session
    if (session) return readCompatibilityUserId(session.passport?.user)
    return readCompatibilityUserId((req as Request & { user?: unknown }).user)
}

/**
 * Write guard for Editor compatibility routes. A write must carry a valid
 * compatibility token (HMAC-signed, expiry-checked, origin-bound) and either
 * the refreshed session CSRF pair or the short-lived, separately signed
 * compatibility CSRF proof issued in the REST config. The editor token alone
 * is never accepted as a CSRF proof.
 */
export const createEditorCompatibilityWriteGuard = (
    deps: Pick<PlayCanvasEditorCompatibilityRouteDeps, 'tokenService' | 'csrfProtection'>
): RequestHandler =>
    function editorCompatibilityWriteGuard(req: Request, res: Response, next: NextFunction) {
        const metahubId = typeof req.params.metahubId === 'string' ? req.params.metahubId : ''
        const projectId = typeof req.params.projectId === 'string' ? req.params.projectId : ''
        const token = resolveCompatibilityToken(req)
        const requestOrigin = resolveRequestOrigin(req) ?? resolvePlatformApiOrigin(req)
        let validatedTokenUserId: string | null = null
        if (metahubId && projectId && token) {
            const readClaims = deps.tokenService.read(token)
            const claims =
                readClaims?.mode === PLAYCANVAS_EDITOR_FULL_BOOT_MODE
                    ? validateFullBootClaims(deps.tokenService, token, {
                          metahubId,
                          projectId,
                          origin: requestOrigin
                      })
                    : null
            if (readClaims && !claims && readClaims.mode === PLAYCANVAS_EDITOR_FULL_BOOT_MODE) {
                // A present but invalid editor token fails closed. Do not fall
                // back to a session-only write because the vendored Editor has
                // already selected the compatibility surface.
                console.warn('[PlayCanvasEditorCompatibility] asset write rejected: invalid editor token', {
                    metahubId,
                    projectId,
                    path: req.path,
                    requestOrigin,
                    readFailed: readClaims === null,
                    now: new Date().toISOString()
                })
                return sendUnauthorized(res)
            }

            // A sandboxed artifact has a distinct host and therefore cannot
            // send the platform's host-only session cookie. Accept only the
            // separate compatibility proof bound to this exact full-boot
            // token and artifact origin; a bare editor token is insufficient.
            const fullBootCompatibilityCsrfValid =
                claims !== null &&
                validateCompatibilityCsrfToken(req.get('x-csrf-token'), {
                    metahubId,
                    projectId,
                    userId: claims.userId,
                    accessToken: token,
                    origin: requestOrigin
                })
            if (fullBootCompatibilityCsrfValid) {
                return next()
            }

            if (claims) validatedTokenUserId = claims.userId

            if (readClaims === null) return sendUnauthorized(res)

            if (readClaims.mode === PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE) {
                // REST tokens are origin-bound as well. Validate the claim
                // before handing control to the platform CSRF middleware;
                // otherwise an origin-mismatched editor header could be
                // mistaken for a session-backed request.
                const compatibilityClaims = validateCompatibilityToken(req, deps.tokenService, {
                    metahubId,
                    projectId,
                    userId: readClaims.userId
                })
                if (!compatibilityClaims) return sendUnauthorized(res)
                validatedTokenUserId = compatibilityClaims.userId
            } else if (readClaims.mode !== PLAYCANVAS_EDITOR_FULL_BOOT_MODE) {
                return sendUnauthorized(res)
            }

            // A compatibility header selects the editor write surface. If its
            // signed token is malformed, expired, origin-mismatched, or uses
            // an unsupported mode, never fall back to a session-only write.
            // This also rejects pre-origin REST tokens before the core CSRF
            // middleware can treat the header as a compatibility exemption.
        }

        // REST compatibility writes may also use the signed proof. Resolve the
        // token user from its claims, then require the token's own origin and
        // project/user binding before bypassing the session middleware.
        if (metahubId && projectId && token && requestOrigin) {
            const readClaims = deps.tokenService.read(token)
            const compatibilityClaims = readClaims
                ? validateCompatibilityToken(req, deps.tokenService, {
                      metahubId,
                      projectId,
                      userId: readClaims.userId
                  })
                : null
            if (
                compatibilityClaims &&
                validateCompatibilityCsrfToken(req.get('x-csrf-token'), {
                    metahubId,
                    projectId,
                    userId: compatibilityClaims.userId,
                    accessToken: token,
                    origin: requestOrigin
                })
            ) {
                return next()
            }
        }

        // If a signed editor token is present but its separate compatibility
        // proof is missing/invalid, the only remaining path is the platform's
        // session-backed CSRF check. Bind both credentials to the same user;
        // otherwise a bearer token for user A could be combined with a valid
        // CSRF cookie/session for user B (or vice versa).
        if (validatedTokenUserId !== null && resolveSessionUserId(req) !== validatedTokenUserId) {
            return sendUnauthorized(res)
        }

        // Preserve the platform session-backed CSRF contract for same-origin
        // callers. The global CSRF middleware has already seen the editor
        // header and intentionally deferred this narrowly scoped request when
        // a CSRF header was present. Hide that header for the second check so
        // an invalid compatibility proof cannot trigger the same bypass again;
        // the platform middleware must verify the session-backed token here.
        // Use a shallow request facade instead of mutating the live Express
        // request: the middleware may call `next()` synchronously, and the
        // downstream route must still validate the original editor token.
        const csrfRequest = Object.create(req) as Request
        csrfRequest.headers = { ...req.headers }
        for (const key of Object.keys(csrfRequest.headers)) {
            if (key.toLowerCase() === 'x-playcanvas-editor-token') delete csrfRequest.headers[key]
        }
        const originalGet = req.get.bind(req)
        csrfRequest.get = (name: string) => {
            if (name.toLowerCase() === 'x-playcanvas-editor-token') return undefined
            return originalGet(name)
        }
        return deps.csrfProtection(csrfRequest, res, next)
    }

export const sendInvalid = (res: Response, requestId?: string) =>
    res.status(400).json({
        ok: false,
        requestId,
        code: 'playcanvasEditor.compatibility.invalidRequest'
    })

export const sendUnauthorized = (res: Response, requestId?: string) =>
    res.status(401).json({
        ok: false,
        requestId,
        code: 'playcanvasEditor.compatibility.invalidToken'
    })

export const sendUnsupported = (res: Response, requestId?: string) =>
    res.status(501).json({
        ok: false,
        requestId,
        code: 'playcanvasEditor.compatibility.unsupported'
    })

export const sendNotFound = (res: Response, requestId?: string) =>
    res.status(404).json({
        ok: false,
        requestId,
        code: 'playcanvasEditor.compatibility.notFound'
    })

export const createCloudOnlyNoOp = (surface: unknown): PlayCanvasEditorCompatibilityNoOpResponse | null => {
    const parsed = playCanvasEditorCompatibilityCloudSurfaceSchema.safeParse(surface)
    if (!parsed.success) return null
    return playCanvasEditorCompatibilityNoOpResponseSchema.parse({
        ok: true,
        surface: parsed.data,
        status: 'stubbed',
        reason: 'cloudOnlySurfaceOutsideFirstSlice'
    })
}

const normalizeSourceFilePath = (value: string): string => value.replace(/\\/g, '/').split('/').filter(Boolean).join('/')

const sourceFileBasename = (value: string): string => normalizeSourceFilePath(value).split('/').filter(Boolean).pop() ?? value

export const findMatchingSourceFile = (
    sourceFiles: PlayCanvasEditorCompatibilitySourceFileSummary[],
    filename: string
): PlayCanvasEditorCompatibilitySourceFileSummary | undefined => {
    const normalizedFilename = normalizeSourceFilePath(filename)
    const exactMatch = sourceFiles.find(
        (sourceFile) => sourceFile.id === filename || normalizeSourceFilePath(sourceFile.path) === normalizedFilename
    )
    if (exactMatch) return exactMatch
    if (normalizedFilename.includes('/')) return undefined

    const expected = sourceFileBasename(filename)
    const basenameMatches = sourceFiles.filter(
        (sourceFile) =>
            sourceFileBasename(sourceFile.path) === expected || sourceFileBasename(sourceFile.filename ?? sourceFile.name) === expected
    )
    return basenameMatches.length === 1 ? basenameMatches[0] : undefined
}

export const sourceFileDeleteRequestId = (req: Request): string => {
    const bodyRequestId = typeof req.body?.requestId === 'string' ? req.body.requestId.trim() : ''
    if (bodyRequestId) return bodyRequestId
    const queryRequestId = typeof req.query.requestId === 'string' ? req.query.requestId.trim() : ''
    if (queryRequestId) return queryRequestId
    const headerRequestId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'].trim() : ''
    return headerRequestId || generateUuidV7()
}

export const wrapAsync =
    (handler: RequestHandler): RequestHandler =>
    (req, res, next) => {
        Promise.resolve(handler(req, res, next)).catch(next)
    }

export interface ParsedEditorAssetUpload {
    fields: Record<string, string>
    file: { buffer: Buffer; filename: string } | null
}

const unsafeMultipartKeys = new Set(['__proto__', 'prototype', 'constructor'])
// These fields are transport metadata added by the upstream editor upload
// helper. They identify the project/branch or source asset already represented
// by the compatibility URL and must not be forwarded into the strict domain
// create schema.
const editorAssetTransportKeys = new Set(['branchId', 'projectId', 'source_asset_id'])

const parseMultipartJsonRecord = (value: string): Record<string, unknown> | null => {
    try {
        const parsed: unknown = JSON.parse(value)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !isBoundedPlayCanvasEditorJsonValue(parsed)) return null
        return parsed as Record<string, unknown>
    } catch {
        return null
    }
}

/** Converts Busboy string fields into the typed upstream asset-create shape. */
export const normalizeEditorAssetCreateFields = (fields: Record<string, string>): Record<string, unknown> | null => {
    const normalized: Record<string, unknown> = Object.create(null) as Record<string, unknown>
    for (const [key, value] of Object.entries(fields)) {
        if (unsafeMultipartKeys.has(key)) return null
        if (editorAssetTransportKeys.has(key)) continue
        if (key === 'parent') {
            const parent = parseCanonicalPlayCanvasEditorDocumentId(value)
            if (parent === null) return null
            normalized[key] = parent
            continue
        }
        if (key === 'data' || key === 'meta') {
            const record = parseMultipartJsonRecord(value)
            if (!record) return null
            normalized[key] = record
            continue
        }
        normalized[key] = value
    }
    return normalized
}

export const normalizeEditorAssetUpdateFields = (fields: Record<string, string>): { name?: string; parent?: number } | null => {
    const normalized: { name?: string; parent?: number } = {}
    for (const [key, value] of Object.entries(fields)) {
        if (unsafeMultipartKeys.has(key)) return null
        if (editorAssetTransportKeys.has(key)) continue
        if (key === 'name') {
            if (!value.trim() || value.length > 255) return null
            normalized.name = value
            continue
        }
        if (key === 'parent') {
            const parent = parseCanonicalPlayCanvasEditorDocumentId(value)
            if (parent === null) return null
            normalized.parent = parent
            continue
        }
        return null
    }
    return Object.keys(normalized).length > 0 ? normalized : null
}

/**
 * Streams a single multipart/form-data body (the vendored editor asset upload)
 * through busboy with hard limits: exactly one file, bounded field sizes, and the
 * platform file-size cap. Rejects (never truncates) on any limit breach.
 */
export const parseEditorAssetUpload = (req: Request): Promise<ParsedEditorAssetUpload> =>
    new Promise((resolve, reject) => {
        let busboy: Busboy.Busboy
        try {
            busboy = Busboy({
                headers: req.headers,
                limits: { fileSize: PLAYCANVAS_PROJECT_FILE_MAX_BYTES, files: 1, fields: 24, parts: 25, fieldSize: 64 * 1024 }
            })
        } catch (error) {
            reject(error)
            return
        }
        const fields: Record<string, string> = {}
        let file: { buffer: Buffer; filename: string } | null = null
        let settled = false
        const finish = (error?: Error): void => {
            if (settled) return
            settled = true
            if (error) {
                req.unpipe(busboy)
                req.resume()
                reject(error)
                return
            }
            resolve({ fields, file })
        }
        busboy.on('field', (name, value, info) => {
            if (
                info.nameTruncated ||
                info.valueTruncated ||
                unsafeMultipartKeys.has(name) ||
                Object.prototype.hasOwnProperty.call(fields, name)
            ) {
                finish(new Error('playcanvasEditor.compatibility.invalidMultipartField'))
                return
            }
            fields[name] = value
        })
        busboy.on('file', (_name, stream, info) => {
            if (file) {
                stream.resume()
                finish(new Error('playcanvasEditor.compatibility.multipleFiles'))
                return
            }
            if (!info.filename || info.filename.length > 255) {
                stream.resume()
                finish(new Error('playcanvasEditor.compatibility.invalidFilename'))
                return
            }
            const chunks: Buffer[] = []
            stream.on('data', (chunk: Buffer) => chunks.push(chunk))
            stream.on('limit', () => finish(new Error('playcanvasEditor.compatibility.fileTooLarge')))
            stream.on('end', () => {
                file = { buffer: Buffer.concat(chunks), filename: info.filename }
            })
        })
        busboy.on('filesLimit', () => finish(new Error('playcanvasEditor.compatibility.multipleFiles')))
        busboy.on('fieldsLimit', () => finish(new Error('playcanvasEditor.compatibility.tooManyFields')))
        busboy.on('partsLimit', () => finish(new Error('playcanvasEditor.compatibility.tooManyParts')))
        busboy.on('error', () => finish(new Error('playcanvasEditor.compatibility.multipartError')))
        busboy.on('finish', () => finish())
        req.pipe(busboy)
    })

export interface PlayCanvasEditorCompatibilityContext {
    req: Request
    res: Response
    metahubId: string
    userId: string
    [key: string]: unknown
}

export type PlayCanvasEditorCompatibilityHandler = (
    handler: (context: PlayCanvasEditorCompatibilityContext) => Promise<Response | void>,
    options?: { permission?: 'manageMetahub' }
) => RequestHandler

export interface PlayCanvasEditorCompatibilityProjectPort {
    describeProtocol(input: {
        metahubId: string
        projectId: string
        userId: string
    }): Promise<PlayCanvasEditorCompatibilityProtocolDescriptor>
    resolveProject(input: { metahubId: string; projectId: string; userId: string }): Promise<PlayCanvasProjectSummary>
    listScenes(input: {
        metahubId: string
        projectId: string
        userId: string
    }): Promise<
        Array<Pick<PlayCanvasScene, 'id' | 'displayName' | 'codename' | 'checksum' | 'sortOrder' | 'publish'> & { version?: number }>
    >
    readScene(input: {
        metahubId: string
        projectId: string
        sceneId: string
        userId: string
    }): Promise<{ scene: PlayCanvasScene; payload: PlayCanvasEditorScenePayload | null }>
    saveScene(input: {
        metahubId: string
        projectId: string
        sceneId: string
        userId: string
        requestId: string
        payload: PlayCanvasEditorScenePayload
        expectedCurrentChecksum?: string | null
    }): Promise<{ scene: PlayCanvasScene; payload: PlayCanvasEditorScenePayload | null; checksum: string | null }>
    listAssets(input: { metahubId: string; projectId: string; userId: string; sceneId?: string | null }): Promise<unknown[]>
    readAsset?(input: {
        metahubId: string
        projectId: string
        userId: string
        documentId: number
        sceneId?: string | null
    }): Promise<Record<string, unknown> | null>
    createAsset?(input: {
        metahubId: string
        projectId: string
        userId: string
        fields: Record<string, unknown>
        file: { buffer: Buffer; filename: string } | null
    }): Promise<{ id: number; name: string; type: string; createdAt: string }>
    updateAsset?(input: {
        metahubId: string
        projectId: string
        userId: string
        documentId: number
        fields: { name?: string; parent?: number }
    }): Promise<{ id: number; name: string; type: string; filename?: string }>
    deleteAssets?(input: {
        metahubId: string
        projectId: string
        userId: string
        documentIds: readonly number[]
    }): Promise<{ deletedDocumentIds: number[] }>
    readAssetFile?(input: {
        metahubId: string
        projectId: string
        userId: string
        assetId: string
    }): Promise<{ content: Buffer; mime: string | null; hash: string | null; filename: string } | null>
    listSourceFiles?(input: {
        metahubId: string
        projectId: string
        userId: string
    }): Promise<PlayCanvasEditorCompatibilitySourceFileSummary[]>
    readSourceFile?(input: {
        metahubId: string
        projectId: string
        sourceFileId: string
        userId: string
    }): Promise<PlayCanvasEditorCompatibilitySourceFileDocument>
    writeSourceFile?(input: {
        metahubId: string
        projectId: string
        sourceFileId: string
        userId: string
        requestId: string
        path: string
        name?: string
        content: string
        expectedCurrentChecksum?: string | null
    }): Promise<PlayCanvasEditorCompatibilitySourceFileDocument>
    deleteSourceFile?(input: {
        metahubId: string
        projectId: string
        sourceFileId: string
        userId: string
        requestId: string
        expectedCurrentChecksum?: string | null
    }): Promise<{ id: string; deleted: true }>
    readSettings(input: {
        metahubId: string
        projectId: string
        userId: string
        kind: PlayCanvasEditorCompatibilitySettingsDocument['kind']
    }): Promise<PlayCanvasEditorCompatibilitySettingsDocument>
    writeSettings(input: {
        metahubId: string
        projectId: string
        userId: string
        kind: PlayCanvasEditorCompatibilitySettingsDocument['kind']
        requestId: string
        data: PlayCanvasEditorCompatibilitySettingsDocument['data']
        expectedRevision?: string
    }): Promise<PlayCanvasEditorCompatibilitySettingsDocument>
    ensureOpenedProjectBackup?(input: {
        metahubId: string
        projectId: string
        userId: string
        sceneId: string
        sessionId: string
        assetDocumentIds?: number[]
    }): Promise<void>
    /**
     * Validates a bridge session before a full-boot token refresh is allowed to
     * reuse its backup scope. The callback must check the signed/durable
     * session binding (metahub, project, user, scene, and origin); an omitted
     * callback deliberately fails closed for every supplied session id.
     */
    validateBridgeSession?(input: {
        metahubId: string
        projectId: string
        sceneId: string
        userId: string
        sessionId: string
        origin: string
    }): Promise<boolean> | boolean
}

export interface PlayCanvasEditorCompatibilityRouteDeps {
    createHandler: PlayCanvasEditorCompatibilityHandler
    createProjectPort: (context: PlayCanvasEditorCompatibilityContext) => PlayCanvasEditorCompatibilityProjectPort
    tokenService: PlayCanvasEditorCompatibilityTokenService
    readLimiter: RequestHandler
    writeLimiter: RequestHandler
    csrfProtection: RequestHandler
    /**
     * Server-side binding check for full-boot token refreshes. A supplied
     * bridgeSessionId is accepted only when it belongs to the same user,
     * project, scene and origin; otherwise the route runs no renewal path.
     */
    validateBridgeSession?: (input: {
        metahubId: string
        projectId: string
        sceneId: string
        userId: string
        sessionId: string
        origin: string
    }) => Promise<boolean> | boolean
    // Optional platform-provided issuer for sliding session-bound editor
    // artifact tokens. It must fail closed: returning null simply omits the
    // artifactToken field so clients fall back to their reload flow.
    issueRenewalArtifactToken?: (input: {
        req: Request
        metahubId: string
        userId: string
        tokenOrigin: string | null | undefined
    }) => Promise<string | null> | string | null
}

export const createPlayCanvasEditorCompatibilityRoutes = (deps: PlayCanvasEditorCompatibilityRouteDeps): Router => {
    const router = Router({ mergeParams: true })
    const editorCompatibilityWriteGuard = createEditorCompatibilityWriteGuard(deps)

    registerPlayCanvasProjectRoutes(router, deps, editorCompatibilityWriteGuard)
    registerPlayCanvasAssetRoutes(router, deps, editorCompatibilityWriteGuard)
    registerPlayCanvasSourceFileRoutes(router, deps, editorCompatibilityWriteGuard)
    registerPlayCanvasSettingsRoutes(router, deps, editorCompatibilityWriteGuard)

    // Terminal fail-closed answer for any unmatched editor compatibility path
    // (including the bridge unsupported asset rewrite target). Guarantees
    // the vendored editor never receives the SPA fallback HTML on this surface.
    router.all('/metahub/:metahubId/playcanvas/editor-compatible/*', (req, res) => {
        void req
        return sendNotFound(res)
    })

    return router
}
