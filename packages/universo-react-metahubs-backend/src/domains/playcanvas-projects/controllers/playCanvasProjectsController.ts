import { z } from 'zod'
import { createHash } from 'node:crypto'
import stableStringify from 'json-stable-stringify'
import {
    CodenameVLCSchema,
    LocalizedStringAllowEmptySchema,
    LocalizedStringSchema,
    PLAYCANVAS_PROJECT_FILE_BASE64_MAX_CHARS,
    playCanvasEditorBridgeCommandSchema,
    type PlayCanvasEditorBridgeErrorCode,
    playCanvasAssetSchema,
    playCanvasGeneratedArtifactSchema,
    playCanvasSceneSchema,
    playCanvasSceneScriptBindingSchema,
    playCanvasScriptAssetSchema
} from '@universo-react/types'
import type { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { PlayCanvasProjectsService } from '../services/PlayCanvasProjectsService'
import { PlayCanvasEditorBridgeSessionService } from '../services/PlayCanvasEditorBridgeSessionService'
import { isMetahubDomainError, MetahubDomainError } from '../../shared/domainErrors'
import { ensureMetahubAccess } from '../../shared/guards'
import { OptimisticLockError } from '@universo-react/utils'
import { listMetahubPackages } from '../../../persistence'
import { resolvePackageAttachmentConfig } from '../../packages/services/packageConfigValidation'

const createProjectSchema = z
    .object({
        codename: CodenameVLCSchema.optional(),
        displayName: LocalizedStringSchema,
        description: LocalizedStringAllowEmptySchema.nullable().optional(),
        packageVersion: z.string().min(1).max(80).nullable().optional()
    })
    .strict()

const updateProjectSchema = z
    .object({
        displayName: LocalizedStringSchema.optional(),
        description: LocalizedStringAllowEmptySchema.nullable().optional(),
        settings: z.record(z.unknown()).optional(),
        defaultSceneId: z.string().uuid().nullable().optional(),
        expectedVersion: z.number().int().positive().optional()
    })
    .strict()

const deleteProjectQuerySchema = z.object({
    expectedVersion: z.coerce.number().int().positive()
})

const projectFileQuerySchema = z.object({
    sourcePath: z.string().min(1).max(512)
})

const deleteProjectFileQuerySchema = projectFileQuerySchema.extend({
    expectedCurrentChecksum: z.string().regex(/^[a-f0-9]{64}$/i)
})

const writeProjectFileSchema = z
    .object({
        sourcePath: z.string().min(1).max(512),
        contentBase64: z
            .string()
            .min(1)
            .max(PLAYCANVAS_PROJECT_FILE_BASE64_MAX_CHARS)
            .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
        expectedChecksum: z
            .string()
            .regex(/^[a-f0-9]{64}$/i)
            .nullable()
            .optional(),
        expectedCurrentChecksum: z
            .string()
            .regex(/^[a-f0-9]{64}$/i)
            .nullable(),
        mime: z.enum(['application/json', 'text/javascript', 'application/javascript']).nullable().optional()
    })
    .strict()

const sceneBodySchema = playCanvasSceneSchema
    .omit({ id: true, projectId: true })
    .extend({ expectedVersion: z.number().int().positive().optional() })
const assetBodySchema = playCanvasAssetSchema
    .omit({ id: true, projectId: true })
    .extend({ expectedVersion: z.number().int().positive().optional() })
const scriptAssetBodySchema = playCanvasScriptAssetSchema
    .omit({ id: true })
    .extend({ expectedVersion: z.number().int().positive().optional() })
const bindingBodySchema = playCanvasSceneScriptBindingSchema
    .omit({ id: true })
    .extend({ expectedVersion: z.number().int().positive().optional() })
const generatedArtifactBodySchema = playCanvasGeneratedArtifactSchema
    .omit({ id: true })
    .extend({ expectedVersion: z.number().int().positive().optional() })

const bridgeCommandBodySchema = z
    .object({
        sessionToken: z.string().min(32).max(4096),
        command: playCanvasEditorBridgeCommandSchema
    })
    .strict()
const replayGuardedBridgeCommands = new Set(['project.loadSelected', 'scene.save'])

const hashBridgeCommand = (value: unknown): string =>
    createHash('sha256')
        .update(stableStringify(value) ?? JSON.stringify(value))
        .digest('hex')

const completeReplayAfterSuccess = async (
    sessionService: PlayCanvasEditorBridgeSessionService,
    exec: Parameters<PlayCanvasEditorBridgeSessionService['completeReplay']>[0],
    replayClaim: {
        schemaName: string
        input: {
            sessionId: string
            metahubId: string
            projectId: string | null
            requestId: string
            commandType: string
            fingerprint: string
        }
    } | null,
    response: unknown,
    userId: string
): Promise<void> => {
    if (!replayClaim) {
        return
    }
    const completed = await sessionService
        .completeReplay(exec, replayClaim.schemaName, {
            ...replayClaim.input,
            response,
            userId
        })
        .catch(() => false)
    if (!completed) {
        throw new MetahubDomainError({
            message: 'PlayCanvas Editor bridge replay response could not be recorded',
            statusCode: 503,
            code: 'SCHEMA_SYNC_FAILED',
            details: {
                messageCode: 'playcanvas.editorBridge.replayCompletionFailed'
            }
        })
    }
}

const releaseReplayClaim = async (
    sessionService: PlayCanvasEditorBridgeSessionService,
    exec: Parameters<PlayCanvasEditorBridgeSessionService['releaseReplay']>[0],
    replayClaim: {
        schemaName: string
        input: {
            sessionId: string
            metahubId: string
            projectId: string | null
            requestId: string
            commandType: string
            fingerprint: string
            userId: string
        }
    } | null
): Promise<void> => {
    if (replayClaim) {
        await sessionService.releaseReplay(exec, replayClaim.schemaName, replayClaim.input).catch(() => undefined)
    }
}

const isCurrentBridgeAttachmentEnabled = async (
    exec: Parameters<typeof listMetahubPackages>[0],
    metahubId: string,
    packageSlug: string,
    projectId: string | null
): Promise<boolean> => {
    const packages = await listMetahubPackages(exec, metahubId)
    const matches = packages.filter(
        (item) => item.authoringSurface.kind === 'playcanvasEditor' && item.authoringSurface.packageSlug === packageSlug
    )
    if (matches.length !== 1) {
        return false
    }
    const item = matches[0]
    if (item.authoringSurface.kind !== 'playcanvasEditor' || !item.authoringSurface.artifact) {
        return false
    }
    try {
        const config = resolvePackageAttachmentConfig(item.config, item.authoringSurface)
        if (config.kind !== 'display' || (config.display.mode !== 'embeddedIframe' && config.display.mode !== 'openSeparately')) {
            return false
        }
        // A bridge session is bound to a concrete project by a signed token
        // minted by the authoring-host endpoint after it resolves that project
        // inside the current metahub. This gate only verifies that the Editor
        // artifact attachment is still enabled. Requiring the project to remain
        // the package default breaks non-destructive `?projectId=` sessions for
        // secondary Projects entries such as MMOOMM Visual Linkup Lab.
        return projectId !== null
    } catch {
        return false
    }
}

const sendBridgeError = (
    res: import('express').Response,
    input: { requestId?: string; code: PlayCanvasEditorBridgeErrorCode; status: number; safeDetails?: Record<string, string> }
) => res.status(input.status).json({ ok: false, ...input })

export function createPlayCanvasProjectsController(createHandler: ReturnType<typeof createMetahubHandlerFactory>) {
    const list = createHandler(
        async ({ res, metahubId, userId, exec, schemaService }) => {
            const service = new PlayCanvasProjectsService(exec, schemaService)
            const items = await service.listProjects(metahubId, userId)
            return res.json({ items })
        },
        { permission: 'manageMetahub' }
    )

    const getById = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const service = new PlayCanvasProjectsService(exec, schemaService)
            const project = await service.getProject(metahubId, req.params.projectId, userId)
            return res.json({ item: project })
        },
        { permission: 'manageMetahub' }
    )

    const create = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const parsed = createProjectSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }
            const service = new PlayCanvasProjectsService(exec, schemaService)
            const created = await service.createProject(metahubId, parsed.data, userId)
            return res.status(201).json({ item: created })
        },
        { permission: 'manageMetahub' }
    )

    const update = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const parsed = updateProjectSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }
            const service = new PlayCanvasProjectsService(exec, schemaService)
            const updated = await service.updateProjectSettings(metahubId, req.params.projectId, parsed.data, userId)
            return res.json({ item: updated })
        },
        { permission: 'manageMetahub' }
    )

    const listScenes = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const service = new PlayCanvasProjectsService(exec, schemaService)
            const items = await service.listScenes(metahubId, req.params.projectId, userId)
            res.setHeader('Cache-Control', 'no-store')
            return res.json({ items })
        },
        { permission: 'manageMetahub' }
    )

    const getScene = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const service = new PlayCanvasProjectsService(exec, schemaService)
            const item = await service.getScene(metahubId, req.params.projectId, req.params.sceneId, userId)
            res.setHeader('Cache-Control', 'no-store')
            return res.json({ item })
        },
        { permission: 'manageMetahub' }
    )

    const writeScene = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const parsed = sceneBodySchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }
            const service = new PlayCanvasProjectsService(exec, schemaService)
            const item = await service.writeScene(metahubId, req.params.projectId, { ...parsed.data, id: req.params.sceneId }, userId)
            res.setHeader('Cache-Control', 'no-store')
            return res.json({ item })
        },
        { permission: 'manageMetahub' }
    )

    const listAssets = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const service = new PlayCanvasProjectsService(exec, schemaService)
            const items = await service.listAssets(metahubId, req.params.projectId, userId)
            res.setHeader('Cache-Control', 'no-store')
            return res.json({ items })
        },
        { permission: 'manageMetahub' }
    )

    const getAsset = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const service = new PlayCanvasProjectsService(exec, schemaService)
            const items = await service.listAssets(metahubId, req.params.projectId, userId)
            const item = items.find((asset) => asset.id === req.params.assetId)
            if (!item) return res.status(404).json({ error: 'Not found' })
            res.setHeader('Cache-Control', 'no-store')
            return res.json({ item })
        },
        { permission: 'manageMetahub' }
    )

    const writeAsset = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const parsed = assetBodySchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }
            const service = new PlayCanvasProjectsService(exec, schemaService)
            const item = await service.writeAssetMetadata(
                metahubId,
                req.params.projectId,
                { ...parsed.data, id: req.params.assetId },
                userId
            )
            res.setHeader('Cache-Control', 'no-store')
            return res.json({ item })
        },
        { permission: 'manageMetahub' }
    )

    const writeScriptAsset = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const parsed = scriptAssetBodySchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }
            const service = new PlayCanvasProjectsService(exec, schemaService)
            const item = await service.resolveScriptAsset(
                metahubId,
                req.params.projectId,
                { ...parsed.data, id: req.params.scriptAssetId },
                userId
            )
            res.setHeader('Cache-Control', 'no-store')
            return res.json({ item })
        },
        { permission: 'manageMetahub' }
    )

    const writeBinding = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const parsed = bindingBodySchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }
            const service = new PlayCanvasProjectsService(exec, schemaService)
            const item = await service.writeSceneScriptBinding(
                metahubId,
                req.params.projectId,
                { ...parsed.data, id: req.params.bindingId },
                userId
            )
            res.setHeader('Cache-Control', 'no-store')
            return res.json({ item })
        },
        { permission: 'manageMetahub' }
    )

    const writeGeneratedArtifact = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const parsed = generatedArtifactBodySchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }
            const service = new PlayCanvasProjectsService(exec, schemaService)
            const item = await service.upsertGeneratedArtifact(
                metahubId,
                req.params.projectId,
                { ...parsed.data, id: req.params.artifactId },
                userId
            )
            res.setHeader('Cache-Control', 'no-store')
            return res.json({ item })
        },
        { permission: 'manageMetahub' }
    )

    const publishProjectState = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const service = new PlayCanvasProjectsService(exec, schemaService)
            const items = await service.publishProjectState(metahubId, req.params.projectId, userId)
            res.setHeader('Cache-Control', 'no-store')
            return res.json({ items })
        },
        { permission: 'manageMetahub' }
    )

    const listPublishedRuntimeManifests = createHandler(
        async ({ res, metahubId, exec, schemaService }) => {
            const service = new PlayCanvasProjectsService(exec, schemaService)
            const items = await service.listPublishedRuntimeManifests(metahubId)
            res.setHeader('Cache-Control', 'no-store')
            return res.json({ items })
        },
        { permission: 'manageMetahub' }
    )

    const exportProjectState = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const service = new PlayCanvasProjectsService(exec, schemaService)
            const item = await service.exportProjectState(metahubId, req.params.projectId, userId)
            res.setHeader('Cache-Control', 'no-store')
            return res.json({ item })
        },
        { permission: 'manageMetahub' }
    )

    const editorBridgeCommand = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const parsed = bridgeCommandBodySchema.safeParse(req.body)
        if (!parsed.success) {
            res.setHeader('Cache-Control', 'no-store')
            return sendBridgeError(res, { code: 'invalidCommand', status: 400 })
        }

        const sessionService = new PlayCanvasEditorBridgeSessionService()
        const session = sessionService.read(parsed.data.sessionToken)
        const command = parsed.data.command
        res.setHeader('Cache-Control', 'no-store')

        if (!session) {
            return sendBridgeError(res, { requestId: command.requestId, code: 'sessionExpired', status: 401 })
        }
        if (
            session.metahubId !== metahubId ||
            session.userId !== userId ||
            session.sessionId !== command.sessionId ||
            session.nonce !== command.nonce
        ) {
            return sendBridgeError(res, { requestId: command.requestId, code: 'forbidden', status: 403 })
        }
        try {
            await ensureMetahubAccess(exec, userId, metahubId, 'manageMetahub')
        } catch (error) {
            const status = (error as { status?: number; statusCode?: number }).status ?? (error as { statusCode?: number }).statusCode
            if (status === 403) {
                return sendBridgeError(res, { requestId: command.requestId, code: 'forbidden', status: 403 })
            }
            throw error
        }
        const isAttachmentEnabled = await isCurrentBridgeAttachmentEnabled(exec, metahubId, session.packageSlug, session.projectId)
        if (!isAttachmentEnabled) {
            return sendBridgeError(res, { requestId: command.requestId, code: 'artifactUnavailable', status: 404 })
        }
        if ('projectId' in command && session.projectId && command.projectId !== session.projectId) {
            return sendBridgeError(res, { requestId: command.requestId, code: 'projectUnavailable', status: 404 })
        }
        if (
            command.type !== 'editor.ready' &&
            !session.capabilities.includes(command.type as import('@universo-react/types').PlayCanvasEditorBridgeCapability)
        ) {
            return sendBridgeError(res, { requestId: command.requestId, code: 'unsupportedCapability', status: 403 })
        }
        let replayClaim: {
            schemaName: string
            input: {
                sessionId: string
                metahubId: string
                projectId: string | null
                requestId: string
                commandType: string
                fingerprint: string
                expiresAt: number
                userId: string
            }
        } | null = null
        if (replayGuardedBridgeCommands.has(command.type)) {
            const replaySchemaName = await schemaService.ensureSchema(metahubId, userId)
            replayClaim = {
                schemaName: replaySchemaName,
                input: {
                    sessionId: session.sessionId,
                    metahubId: session.metahubId,
                    projectId: session.projectId,
                    requestId: command.requestId,
                    commandType: command.type,
                    fingerprint: hashBridgeCommand(command),
                    expiresAt: session.expiresAt,
                    userId
                }
            }
            const claimed = await sessionService.claimReplay(exec, replaySchemaName, {
                ...replayClaim.input
            })
            if (!claimed) {
                const storedResponse = await sessionService.readReplayResponse(exec, replaySchemaName, replayClaim.input)
                if (storedResponse?.status === 'completed') {
                    return res.json(storedResponse.response)
                }
                return sendBridgeError(res, { requestId: command.requestId, code: 'replayRejected', status: 409 })
            }
        }

        const service = new PlayCanvasProjectsService(exec, schemaService)
        let completedSuccessfulBridgeOperation = false
        try {
            switch (command.type) {
                case 'protocol.describe': {
                    if (!session.projectId) {
                        return sendBridgeError(res, { requestId: command.requestId, code: 'projectUnavailable', status: 404 })
                    }
                    const protocol = await service.describeEditorCompatibilityProtocol(metahubId, session.projectId, userId)
                    return res.json({ ok: true, requestId: command.requestId, data: { protocol } })
                }
                case 'project.loadSelected': {
                    const project = session.projectId
                        ? await service.loadSelectedProjectForEditor(metahubId, session.projectId, userId)
                        : null
                    const response = { ok: true, requestId: command.requestId, data: { project } }
                    completedSuccessfulBridgeOperation = true
                    await completeReplayAfterSuccess(sessionService, exec, replayClaim, response, userId)
                    return res.json(response)
                }
                case 'scene.list': {
                    const scenes = await service.listScenes(metahubId, command.projectId, userId)
                    return res.json({ ok: true, requestId: command.requestId, data: { scenes } })
                }
                case 'scene.read': {
                    const item = await service.readEditorScene(metahubId, command.projectId, command.sceneId, userId)
                    return res.json({ ok: true, requestId: command.requestId, data: item })
                }
                case 'scene.save': {
                    const defaultSceneId =
                        session.defaultSceneId ?? (await service.getProject(metahubId, command.projectId, userId)).defaultSceneId ?? null
                    if (!defaultSceneId || command.sceneId !== defaultSceneId) {
                        await releaseReplayClaim(sessionService, exec, replayClaim)
                        return sendBridgeError(res, { requestId: command.requestId, code: 'unsupportedCapability', status: 403 })
                    }
                    const item = await service.saveEditorScene(
                        metahubId,
                        command.projectId,
                        command.sceneId,
                        {
                            payload: command.payload,
                            expectedCurrentChecksum: command.expectedCurrentChecksum
                        },
                        userId
                    )
                    const response = { ok: true, requestId: command.requestId, data: item }
                    completedSuccessfulBridgeOperation = true
                    await completeReplayAfterSuccess(sessionService, exec, replayClaim, response, userId)
                    return res.json(response)
                }
                case 'scene.saveStatus': {
                    const scene = await service.getScene(metahubId, command.projectId, command.sceneId, userId)
                    return res.json({ ok: true, requestId: command.requestId, data: { scene, checksum: scene.checksum ?? null } })
                }
                case 'asset.listMinimalForScene': {
                    const assets = await service.listMinimalAssetsForEditorScene(metahubId, command.projectId, command.sceneId, userId)
                    return res.json({ ok: true, requestId: command.requestId, data: { assets } })
                }
                case 'bridge.capabilities':
                    return res.json({ ok: true, requestId: command.requestId, data: { capabilities: session.capabilities } })
                case 'bridge.close':
                case 'bridge.dirtyState':
                    return res.json({ ok: true, requestId: command.requestId, data: { dirty: command.dirty ?? false } })
                case 'editor.ready':
                    return res.json({ ok: true, requestId: command.requestId, data: { capabilities: session.capabilities } })
            }
        } catch (error) {
            if (replayClaim && !completedSuccessfulBridgeOperation) {
                await releaseReplayClaim(sessionService, exec, replayClaim)
            }
            if (error instanceof OptimisticLockError) {
                return sendBridgeError(res, { requestId: command.requestId, code: 'saveConflict', status: 409 })
            }
            if (isMetahubDomainError(error)) {
                if (error.details?.messageCode === 'playcanvas.files.path.currentChecksumMismatch') {
                    return sendBridgeError(res, { requestId: command.requestId, code: 'saveConflict', status: 409 })
                }
                const status = error.statusCode >= 400 && error.statusCode <= 599 ? error.statusCode : 500
                const code: PlayCanvasEditorBridgeErrorCode =
                    status === 404 ? 'sceneUnavailable' : status === 409 ? 'saveConflict' : 'storageUnavailable'
                return sendBridgeError(res, { requestId: command.requestId, code, status })
            }
            throw error
        }
    }, undefined)

    const editorCompatibleProtocol = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const service = new PlayCanvasProjectsService(exec, schemaService)
            const protocol = await service.describeEditorCompatibilityProtocol(metahubId, req.params.projectId, userId)
            res.setHeader('Cache-Control', 'no-store')
            return res.json({ item: protocol })
        },
        { permission: 'manageMetahub' }
    )

    const remove = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const parsed = deleteProjectQuerySchema.safeParse(req.query)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })
            }
            const service = new PlayCanvasProjectsService(exec, schemaService)
            const deleted = await service.deleteProject(metahubId, req.params.projectId, parsed.data, userId)
            return res.json({ item: deleted })
        },
        { permission: 'manageMetahub' }
    )

    const readFile = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const parsed = projectFileQuerySchema.safeParse(req.query)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })
            }
            const service = new PlayCanvasProjectsService(exec, schemaService)
            const file = req.params.assetId
                ? await service.readAssetFile(metahubId, req.params.projectId, req.params.assetId, parsed.data.sourcePath, userId)
                : await service.readProjectFile(metahubId, req.params.projectId, parsed.data.sourcePath, userId)
            res.setHeader('Cache-Control', 'no-store')
            return res.json({ item: file })
        },
        { permission: 'manageMetahub' }
    )

    const writeFile = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const parsed = writeProjectFileSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }
            const service = new PlayCanvasProjectsService(exec, schemaService)
            const file = req.params.assetId
                ? await service.writeAssetFile(metahubId, req.params.projectId, req.params.assetId, parsed.data, userId)
                : await service.writeProjectFile(metahubId, req.params.projectId, parsed.data, userId)
            res.setHeader('Cache-Control', 'no-store')
            return res.status(201).json({ item: file })
        },
        { permission: 'manageMetahub' }
    )

    const deleteFile = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const parsed = deleteProjectFileQuerySchema.safeParse(req.query)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })
            }
            const service = new PlayCanvasProjectsService(exec, schemaService)
            if (req.params.assetId) {
                await service.deleteAssetFile(
                    metahubId,
                    req.params.projectId,
                    req.params.assetId,
                    parsed.data.sourcePath,
                    parsed.data.expectedCurrentChecksum,
                    userId
                )
            } else {
                await service.deleteProjectFile(
                    metahubId,
                    req.params.projectId,
                    parsed.data.sourcePath,
                    parsed.data.expectedCurrentChecksum,
                    userId
                )
            }
            res.setHeader('Cache-Control', 'no-store')
            return res.status(204).send()
        },
        { permission: 'manageMetahub' }
    )

    return {
        list,
        getById,
        create,
        update,
        remove,
        listScenes,
        getScene,
        writeScene,
        listAssets,
        getAsset,
        writeAsset,
        writeScriptAsset,
        writeBinding,
        writeGeneratedArtifact,
        publishProjectState,
        listPublishedRuntimeManifests,
        exportProjectState,
        editorBridgeCommand,
        editorCompatibleProtocol,
        readFile,
        writeFile,
        deleteFile
    }
}
