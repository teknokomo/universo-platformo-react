import { z } from 'zod'
import {
    CodenameVLCSchema,
    LocalizedStringAllowEmptySchema,
    LocalizedStringSchema,
    PLAYCANVAS_PROJECT_FILE_BASE64_MAX_CHARS,
    playCanvasAssetSchema,
    playCanvasGeneratedArtifactSchema,
    playCanvasSceneSchema,
    playCanvasSceneScriptBindingSchema,
    playCanvasScriptAssetSchema
} from '@universo-react/types'
import type { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { PlayCanvasProjectsService } from '../services/PlayCanvasProjectsService'

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

    const exportProjectState = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const service = new PlayCanvasProjectsService(exec, schemaService)
            const item = await service.exportProjectState(metahubId, req.params.projectId, userId)
            res.setHeader('Cache-Control', 'no-store')
            return res.json({ item })
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
            const parsed = projectFileQuerySchema.safeParse(req.query)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })
            }
            const service = new PlayCanvasProjectsService(exec, schemaService)
            if (req.params.assetId) {
                await service.deleteAssetFile(metahubId, req.params.projectId, req.params.assetId, parsed.data.sourcePath, userId)
            } else {
                await service.deleteProjectFile(metahubId, req.params.projectId, parsed.data.sourcePath, userId)
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
        exportProjectState,
        readFile,
        writeFile,
        deleteFile
    }
}
