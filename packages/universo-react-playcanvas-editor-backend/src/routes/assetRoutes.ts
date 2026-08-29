import type { Router, RequestHandler } from 'express'

import {
    playCanvasEditorCompatibilityAssetCreateRequestSchema,
    playCanvasEditorCompatibilityParamsSchema,
    playCanvasEditorCompatibilityAssetSummarySchema,
    playCanvasEditorCompatibilityAssetDeleteRequestSchema
} from '@universo-react/types'
import {
    captureRealtimeAssetDocumentGrantVersions,
    grantRealtimeAssetDocuments,
    isRealtimeAssetDocumentGranted,
    isRealtimeAssetDocumentRevoked,
    revokeRealtimeAssetDocuments,
    sendMessengerEvent
} from '../realtime/index.js'
import { createPlayCanvasEditorNumericIds } from '../config/index.js'
import { resolvePlatformApiOrigin, resolveRequestOrigin } from '../middleware/index.js'
import {
    parseCanonicalPlayCanvasEditorDocumentId,
    resolveCompatibilityToken,
    validateCompatibilityToken,
    validateFullBootClaims
} from '../tokens/index.js'
import {
    validateParams,
    sendInvalid,
    sendUnauthorized,
    sendUnsupported,
    sendNotFound,
    parseEditorAssetUpload,
    normalizeEditorAssetCreateFields,
    normalizeEditorAssetUpdateFields,
    type ParsedEditorAssetUpload,
    type PlayCanvasEditorCompatibilityRouteDeps,
    wrapAsync
} from './index.js'

export const registerPlayCanvasAssetRoutes = (
    router: Router,
    deps: PlayCanvasEditorCompatibilityRouteDeps,
    editorCompatibilityWriteGuard: RequestHandler
): void => {
    router.get(
        '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/assets',
        deps.readLimiter,
        wrapAsync(
            deps.createHandler(
                async (context) => {
                    const { req, res, metahubId, userId } = context
                    const projectPort = deps.createProjectPort(context)
                    const params = validateParams(playCanvasEditorCompatibilityParamsSchema, {
                        ...req.params,
                        metahubId
                    })
                    if (!params) return sendInvalid(res)
                    const claims = validateCompatibilityToken(req, deps.tokenService, { metahubId, projectId: params.projectId, userId })
                    const fullBootClaims = claims
                        ? null
                        : validateFullBootClaims(deps.tokenService, resolveCompatibilityToken(req) ?? '', {
                              metahubId,
                              projectId: params.projectId,
                              origin: resolveRequestOrigin(req) ?? resolvePlatformApiOrigin(req)
                          })
                    if (!claims && !fullBootClaims) {
                        return sendUnauthorized(res)
                    }
                    const assets = await projectPort.listAssets({
                        metahubId,
                        projectId: params.projectId,
                        userId,
                        sceneId: claims?.sceneId ?? fullBootClaims?.sceneId
                    })
                    const allowedFullBootAssetIds = new Set(fullBootClaims?.assetDocumentIds ?? [])
                    const visibleAssets = fullBootClaims
                        ? assets.filter((asset) => {
                              const documentId =
                                  asset && typeof asset === 'object' && 'editorDocumentId' in asset
                                      ? (asset as { editorDocumentId?: unknown }).editorDocumentId
                                      : null
                              const numericDocumentId = parseCanonicalPlayCanvasEditorDocumentId(documentId)
                              return (
                                  numericDocumentId !== null &&
                                  !isRealtimeAssetDocumentRevoked(metahubId, params.projectId, numericDocumentId) &&
                                  (allowedFullBootAssetIds.has(numericDocumentId) ||
                                      isRealtimeAssetDocumentGranted(metahubId, params.projectId, numericDocumentId))
                              )
                          })
                        : assets
                    res.setHeader('Cache-Control', 'no-store')
                    return res.json({ items: visibleAssets.map((asset) => playCanvasEditorCompatibilityAssetSummarySchema.parse(asset)) })
                },
                { permission: 'manageMetahub' }
            )
        )
    )

    // Upstream-compatible asset create ("+" menu): multipart POST whose response
    // body is consumed field-by-field by the vendored editor — only `id` is read
    // (vendor upload.ts parses `JSON.parse(xhr.responseText).id`), so this route
    // intentionally returns the bare upstream shape instead of the internal
    // `{ok, requestId, item}` envelope.
    router.post(
        '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/assets',
        deps.writeLimiter,
        editorCompatibilityWriteGuard,
        wrapAsync(
            deps.createHandler(
                async (context) => {
                    const { req, res, metahubId, userId } = context
                    const projectPort = deps.createProjectPort(context)
                    // The file route has additional `assetId`/`filename` params;
                    // validate only the compatibility scope here because the
                    // scope schema is intentionally strict.
                    const params = validateParams(playCanvasEditorCompatibilityParamsSchema, {
                        metahubId,
                        projectId: req.params.projectId
                    })
                    if (!params) return sendInvalid(res)
                    const fullBootClaims = validateFullBootClaims(deps.tokenService, resolveCompatibilityToken(req) ?? '', {
                        metahubId,
                        projectId: params.projectId,
                        origin: resolveRequestOrigin(req) ?? resolvePlatformApiOrigin(req)
                    })
                    if (!fullBootClaims) return sendUnauthorized(res)
                    if (!projectPort.createAsset) return sendUnsupported(res)
                    let upload: ParsedEditorAssetUpload
                    try {
                        upload = await parseEditorAssetUpload(req)
                    } catch {
                        return sendInvalid(res)
                    }
                    const normalizedFields = normalizeEditorAssetCreateFields(upload.fields)
                    if (!normalizedFields) return sendInvalid(res)
                    const parsedFields = playCanvasEditorCompatibilityAssetCreateRequestSchema.safeParse(normalizedFields)
                    if (!parsedFields.success) return sendInvalid(res)
                    const result = await projectPort.createAsset({
                        metahubId,
                        projectId: params.projectId,
                        userId,
                        fields: parsedFields.data,
                        file: upload.file
                    })
                    const grantedDocumentIds = await grantRealtimeAssetDocuments(metahubId, params.projectId, [result.id], {
                        validateDocumentIds: async (documentIds) => {
                            const currentAssets = await projectPort.listAssets({
                                metahubId,
                                projectId: params.projectId,
                                userId,
                                sceneId: fullBootClaims.sceneId
                            })
                            const currentIds = new Set(
                                currentAssets
                                    .map((asset) =>
                                        asset && typeof asset === 'object' && 'editorDocumentId' in asset
                                            ? parseCanonicalPlayCanvasEditorDocumentId(
                                                  (asset as { editorDocumentId?: unknown }).editorDocumentId
                                              )
                                            : null
                                    )
                                    .filter((documentId): documentId is number => documentId !== null)
                            )
                            return documentIds.filter((documentId) => currentIds.has(documentId))
                        }
                    })
                    if (grantedDocumentIds.includes(result.id)) {
                        sendMessengerEvent(metahubId, params.projectId, 'asset.new', {
                            asset: {
                                // The editor filters pushes by branchId against its numeric
                                // scene id; full-boot tokens carry the scene context.
                                branchId: createPlayCanvasEditorNumericIds({
                                    metahubId,
                                    projectId: params.projectId,
                                    sceneId: fullBootClaims.sceneId ?? params.projectId,
                                    userId
                                }).sceneId,
                                id: String(result.id),
                                source: false,
                                status: 'complete',
                                type: result.type,
                                source_asset_id: '0',
                                createdAt: result.createdAt
                            }
                        })
                    }
                    res.setHeader('Cache-Control', 'no-store')
                    return res.status(201).json({ id: result.id })
                },
                { permission: 'manageMetahub' }
            )
        )
    )

    // Upstream-compatible asset metadata read. The vendored editor requests
    // this immediately after receiving an `asset.new` messenger push. Keep it
    // separate from the raw file route: metadata is JSON and is subject to the
    // full-boot document allow-list, while file bytes use the storage reader.
    router.get(
        '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/assets/:assetId',
        deps.readLimiter,
        wrapAsync(
            deps.createHandler(
                async (context) => {
                    const { req, res, metahubId, userId } = context
                    const projectPort = deps.createProjectPort(context)
                    const params = validateParams(playCanvasEditorCompatibilityParamsSchema, {
                        metahubId,
                        projectId: req.params.projectId
                    })
                    if (!params) return sendInvalid(res)
                    const assetId = typeof req.params.assetId === 'string' ? req.params.assetId : ''
                    const documentId = parseCanonicalPlayCanvasEditorDocumentId(assetId)
                    if (documentId === null) return sendInvalid(res)
                    const claims = validateCompatibilityToken(req, deps.tokenService, {
                        metahubId,
                        projectId: params.projectId,
                        userId
                    })
                    const fullBootClaims = claims
                        ? null
                        : validateFullBootClaims(deps.tokenService, resolveCompatibilityToken(req) ?? '', {
                              metahubId,
                              projectId: params.projectId,
                              origin: resolveRequestOrigin(req) ?? resolvePlatformApiOrigin(req)
                          })
                    if (!claims && !fullBootClaims) return sendUnauthorized(res)
                    if (
                        fullBootClaims &&
                        (isRealtimeAssetDocumentRevoked(metahubId, params.projectId, documentId) ||
                            (!fullBootClaims.assetDocumentIds?.includes(documentId) &&
                                !isRealtimeAssetDocumentGranted(metahubId, params.projectId, documentId)))
                    ) {
                        return sendNotFound(res)
                    }
                    if (!projectPort.readAsset) return sendUnsupported(res)
                    const item = await projectPort.readAsset({
                        metahubId,
                        projectId: params.projectId,
                        userId,
                        documentId,
                        sceneId: claims?.sceneId ?? fullBootClaims?.sceneId
                    })
                    if (!item) return sendNotFound(res)
                    // Asset.load() uses `id` to construct the file URL, while
                    // realtime documents intentionally retain upstream
                    // `item_id`; expose both contracts without changing the
                    // persisted document shape.
                    const responseItem = Object.prototype.hasOwnProperty.call(item, 'id') ? item : { ...item, id: documentId }
                    res.setHeader('Cache-Control', 'no-store')
                    return res.json(responseItem)
                },
                { permission: 'manageMetahub' }
            )
        )
    )

    // Raw asset file content for the vendored editor (script parsing, realPath,
    // code-editor dirty checks). Streams bytes with the stored MIME type; errors
    // are JSON, never the SPA fallback.
    router.get(
        '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/assets/:assetId/file/:filename',
        deps.readLimiter,
        wrapAsync(
            deps.createHandler(
                async (context) => {
                    const { req, res, metahubId, userId } = context
                    const projectPort = deps.createProjectPort(context)
                    // `assetId` and `filename` are route-local parameters; do not
                    // pass them to the strict compatibility-scope schema.
                    const params = validateParams(playCanvasEditorCompatibilityParamsSchema, {
                        metahubId,
                        projectId: req.params.projectId
                    })
                    if (!params) return sendInvalid(res)
                    if (!projectPort.readAssetFile) return sendUnsupported(res)
                    const claims = validateCompatibilityToken(req, deps.tokenService, {
                        metahubId,
                        projectId: params.projectId,
                        userId
                    })
                    const fullBootClaims = validateFullBootClaims(deps.tokenService, resolveCompatibilityToken(req) ?? '', {
                        metahubId,
                        projectId: params.projectId,
                        origin: resolveRequestOrigin(req) ?? resolvePlatformApiOrigin(req)
                    })
                    if (!claims && !fullBootClaims) {
                        return sendUnauthorized(res)
                    }
                    const assetId = typeof req.params.assetId === 'string' ? req.params.assetId : ''
                    const documentId = parseCanonicalPlayCanvasEditorDocumentId(assetId)
                    if (documentId === null) return sendInvalid(res)
                    if (
                        fullBootClaims &&
                        (isRealtimeAssetDocumentRevoked(metahubId, params.projectId, documentId) ||
                            (!fullBootClaims.assetDocumentIds?.includes(documentId) &&
                                !isRealtimeAssetDocumentGranted(metahubId, params.projectId, documentId)))
                    ) {
                        return sendNotFound(res)
                    }
                    const file = await projectPort.readAssetFile({
                        metahubId,
                        projectId: params.projectId,
                        userId,
                        assetId: String(documentId)
                    })
                    if (!file) return sendNotFound(res)
                    res.setHeader('Cache-Control', 'no-store')
                    if (file.mime) res.setHeader('Content-Type', file.mime)
                    if (file.hash) res.setHeader('ETag', `"${file.hash}"`)
                    return res.status(200).send(file.content)
                },
                { permission: 'manageMetahub' }
            )
        )
    )

    // Upstream-compatible asset delete (REST path; the realtime `fs{op:'delete'}` frame
    // is handled in the realtime runtime). Responds 204 with the per-asset messenger
    // pushes emitted server-side.
    router.delete(
        '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/assets',
        deps.writeLimiter,
        editorCompatibilityWriteGuard,
        wrapAsync(
            deps.createHandler(
                async (context) => {
                    const { req, res, metahubId, userId } = context
                    const projectPort = deps.createProjectPort(context)
                    const params = validateParams(playCanvasEditorCompatibilityParamsSchema, { ...req.params, metahubId })
                    if (!params) return sendInvalid(res)
                    if (!projectPort.deleteAssets) return sendUnsupported(res)
                    const claims = validateCompatibilityToken(req, deps.tokenService, {
                        metahubId,
                        projectId: params.projectId,
                        userId
                    })
                    const fullBootClaims = claims
                        ? null
                        : validateFullBootClaims(deps.tokenService, resolveCompatibilityToken(req) ?? '', {
                              metahubId,
                              projectId: params.projectId,
                              origin: resolveRequestOrigin(req) ?? resolvePlatformApiOrigin(req)
                          })
                    if (!claims && !fullBootClaims) {
                        return sendUnauthorized(res)
                    }
                    const body = playCanvasEditorCompatibilityAssetDeleteRequestSchema.safeParse(req.body)
                    if (!body.success) return sendInvalid(res)
                    const documentIds = body.data.assets
                    if (
                        fullBootClaims &&
                        documentIds.some(
                            (documentId) =>
                                isRealtimeAssetDocumentRevoked(metahubId, params.projectId, documentId) ||
                                (!fullBootClaims.assetDocumentIds?.includes(documentId) &&
                                    !isRealtimeAssetDocumentGranted(metahubId, params.projectId, documentId))
                        )
                    ) {
                        return sendNotFound(res)
                    }
                    // Folder deletes expand to descendant ids inside the
                    // storage transaction. Snapshot every current grant before
                    // awaiting that transaction so a concurrent recreate is
                    // never revoked by this stale delete completion.
                    const grantVersions = captureRealtimeAssetDocumentGrantVersions(metahubId, params.projectId)
                    const result = await projectPort.deleteAssets({
                        metahubId,
                        projectId: params.projectId,
                        userId,
                        documentIds
                    })
                    revokeRealtimeAssetDocuments(metahubId, params.projectId, result.deletedDocumentIds, grantVersions)
                    for (const documentId of result.deletedDocumentIds) {
                        sendMessengerEvent(metahubId, params.projectId, 'asset.delete', { asset: { id: documentId } })
                    }
                    return res.status(204).send()
                },
                { permission: 'manageMetahub' }
            )
        )
    )

    // Upstream asset metadata updates are multipart FormData requests. The
    // integrated Editor currently needs rename and folder moves; binary file
    // replacement remains fail-closed until the conversion pipeline is wired.
    router.put(
        '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/assets/:assetId',
        deps.writeLimiter,
        editorCompatibilityWriteGuard,
        wrapAsync(
            deps.createHandler(
                async (context) => {
                    const { req, res, metahubId, userId } = context
                    const projectPort = deps.createProjectPort(context)
                    if (!projectPort.updateAsset) return sendUnsupported(res)
                    const params = validateParams(playCanvasEditorCompatibilityParamsSchema, {
                        metahubId,
                        projectId: req.params.projectId
                    })
                    if (!params) return sendInvalid(res)
                    const assetId = typeof req.params.assetId === 'string' ? req.params.assetId : ''
                    const documentId = parseCanonicalPlayCanvasEditorDocumentId(assetId)
                    if (documentId === null) return sendInvalid(res)
                    const fullBootClaims = validateFullBootClaims(deps.tokenService, resolveCompatibilityToken(req) ?? '', {
                        metahubId,
                        projectId: params.projectId,
                        origin: resolveRequestOrigin(req) ?? resolvePlatformApiOrigin(req)
                    })
                    if (!fullBootClaims) return sendUnauthorized(res)
                    if (
                        isRealtimeAssetDocumentRevoked(metahubId, params.projectId, documentId) ||
                        (!fullBootClaims.assetDocumentIds?.includes(documentId) &&
                            !isRealtimeAssetDocumentGranted(metahubId, params.projectId, documentId))
                    ) {
                        return sendNotFound(res)
                    }
                    if (
                        !String(req.headers['content-type'] ?? '')
                            .toLowerCase()
                            .includes('multipart/form-data')
                    ) {
                        return sendUnsupported(res)
                    }
                    let upload: ParsedEditorAssetUpload
                    try {
                        upload = await parseEditorAssetUpload(req)
                    } catch {
                        return sendInvalid(res)
                    }
                    if (upload.file) return sendUnsupported(res)
                    const fields = normalizeEditorAssetUpdateFields(upload.fields)
                    if (!fields) return sendInvalid(res)
                    const result = await projectPort.updateAsset({
                        metahubId,
                        projectId: params.projectId,
                        userId,
                        documentId,
                        fields
                    })
                    sendMessengerEvent(metahubId, params.projectId, 'asset.update', {
                        asset: {
                            branchId: createPlayCanvasEditorNumericIds({
                                metahubId,
                                projectId: params.projectId,
                                sceneId: fullBootClaims.sceneId ?? params.projectId,
                                userId
                            }).sceneId,
                            id: String(result.id),
                            source: false,
                            status: 'complete',
                            type: result.type,
                            name: result.name,
                            fileFilename: result.filename ?? result.name
                        }
                    })
                    res.setHeader('Cache-Control', 'no-store')
                    return res.json({ id: result.id, name: result.name, type: result.type })
                },
                { permission: 'manageMetahub' }
            )
        )
    )
}
