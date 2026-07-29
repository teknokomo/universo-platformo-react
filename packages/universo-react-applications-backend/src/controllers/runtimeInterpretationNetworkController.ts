import type { Request, Response } from 'express'
import { z } from 'zod'
import type { DbExecutor } from '@universo-react/utils'
import { ensureRuntimePermission, createQueryHelper, resolveRuntimeSchema } from '../shared/runtimeHelpers'
import {
    interpretationNetworkEnsureSystemStructureRequestSchema,
    interpretationNetworkMaterialCreateRequestSchema,
    interpretationNetworkStructureDeleteRequestSchema,
    interpretationNetworkStructureCreateRequestSchema,
    interpretationNetworkStructureRouteParamsSchema,
    interpretationNetworkTemplateDeleteRequestSchema,
    interpretationNetworkTemplateInstantiateRequestSchema,
    interpretationNetworkTemplateSaveRequestSchema,
    interpretationNetworkTemplateUpdateRequestSchema,
    InterpretationNetworkCommandError,
    createMaterialForCell,
    createStructureAggregate,
    deleteStructureAggregate,
    deleteInterpretationNetworkTemplate,
    ensureSingleSystemStructure,
    getInterpretationNetworkTemplateDetail,
    getSingleSystemStructure,
    instantiateStructureFromTemplate,
    listInterpretationNetworkTemplates,
    resolveInterpretationNetworkRuntimeSurface,
    saveStructureAsTemplate,
    updateInterpretationNetworkTemplate
} from '../services/interpretationNetwork/runtimeInterpretationNetworkService'

const interpretationNetworkControllerErrorCodes = {
    invalidRouteParameters: 'INTERPRETATION_NETWORK_INVALID_ROUTE_PARAMETERS',
    invalidRequestBody: 'INTERPRETATION_NETWORK_INVALID_REQUEST_BODY'
} as const

const interpretationNetworkTemplateRouteParamsSchema = z
    .object({
        applicationId: z.string().min(1),
        templateId: z.string().uuid()
    })
    .strict()

const interpretationNetworkRuntimeSurfaceQuerySchema = z
    .object({
        widgetId: z.string().uuid().optional(),
        layoutId: z.string().uuid().optional()
    })
    .strict()

const sendError = (res: Response, status: number, error: string, code: string, details?: unknown) =>
    res.status(status).json({
        error,
        code,
        ...(details === undefined ? {} : { details })
    })

const sendValidationError = (res: Response, error: z.ZodError, code: string, message: string) =>
    sendError(res, 400, message, code, error.flatten())

const sendCommandError = (res: Response, error: InterpretationNetworkCommandError) =>
    sendError(res, error.statusCode, error.message, error.code, error.details)

const toRuntimeSurfaceResponse = (surface: Awaited<ReturnType<typeof resolveInterpretationNetworkRuntimeSurface>>) => ({
    applicationId: surface.applicationId,
    workspaceId: surface.workspaceId,
    featureState: surface.featureState,
    missing: surface.missing,
    structureMode: surface.structureMode,
    widgetKey: surface.widgetKey
})

export function createRuntimeInterpretationNetworkController(getDbExecutor: () => DbExecutor) {
    const query = createQueryHelper(getDbExecutor)

    const resolveRuntimeSurface = async (req: Request, res: Response, applicationId: string) => {
        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) {
            return null
        }

        const requestQuery = req.query ?? {}
        const parsedSurfaceQuery = interpretationNetworkRuntimeSurfaceQuerySchema.safeParse({
            ...(typeof requestQuery.widgetId === 'string' ? { widgetId: requestQuery.widgetId } : {}),
            ...(typeof requestQuery.layoutId === 'string' ? { layoutId: requestQuery.layoutId } : {})
        })
        if (!parsedSurfaceQuery.success) {
            sendValidationError(
                res,
                parsedSurfaceQuery.error,
                interpretationNetworkControllerErrorCodes.invalidRouteParameters,
                'Invalid runtime widget context'
            )
            return null
        }

        const surface = await resolveInterpretationNetworkRuntimeSurface(ctx.manager, {
            applicationId,
            schemaName: ctx.schemaName,
            workspaceId: ctx.currentWorkspaceId,
            ...parsedSurfaceQuery.data
        })

        return { ctx, surface }
    }

    const ensureSystemStructure = async (req: Request, res: Response) => {
        const parsedBody = interpretationNetworkEnsureSystemStructureRequestSchema.safeParse(req.body)
        if (!parsedBody.success) {
            return sendValidationError(
                res,
                parsedBody.error,
                interpretationNetworkControllerErrorCodes.invalidRequestBody,
                'Invalid request body'
            )
        }

        const { applicationId } = req.params
        const resolved = await resolveRuntimeSurface(req, res, applicationId)
        if (!resolved) {
            return
        }

        try {
            const existing = await getSingleSystemStructure(resolved.ctx, resolved.surface)
            if (existing) {
                return res.status(200).json({
                    ...existing,
                    canCreate: resolved.ctx.permissions.createContent === true && resolved.ctx.permissions.editContent === true
                })
            }

            const result = await ensureSingleSystemStructure(resolved.ctx, resolved.surface, parsedBody.data)
            return res.status(result.created ? 201 : 200).json({
                ...result,
                canCreate: resolved.ctx.permissions.createContent === true && resolved.ctx.permissions.editContent === true
            })
        } catch (error) {
            if (error instanceof InterpretationNetworkCommandError) return sendCommandError(res, error)
            throw error
        }
    }

    const createStructure = async (req: Request, res: Response) => {
        const parsedBody = interpretationNetworkStructureCreateRequestSchema.safeParse(req.body)
        if (!parsedBody.success) {
            return sendValidationError(
                res,
                parsedBody.error,
                interpretationNetworkControllerErrorCodes.invalidRequestBody,
                'Invalid request body'
            )
        }
        const { applicationId } = req.params
        const resolved = await resolveRuntimeSurface(req, res, applicationId)
        if (!resolved) return
        if (!ensureRuntimePermission(res, resolved.ctx, 'createContent')) return
        if (!ensureRuntimePermission(res, resolved.ctx, 'editContent')) return
        try {
            return res.status(201).json(await createStructureAggregate(resolved.ctx, resolved.surface, parsedBody.data))
        } catch (error) {
            if (error instanceof InterpretationNetworkCommandError) return sendCommandError(res, error)
            throw error
        }
    }

    const getRuntime = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const resolved = await resolveRuntimeSurface(req, res, applicationId)
        if (!resolved) {
            return
        }

        return res.json(toRuntimeSurfaceResponse(resolved.surface))
    }

    const listTemplates = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const resolved = await resolveRuntimeSurface(req, res, applicationId)
        if (!resolved) {
            return
        }

        try {
            return res.json({ items: await listInterpretationNetworkTemplates(resolved.ctx, resolved.surface) })
        } catch (error) {
            if (error instanceof InterpretationNetworkCommandError) return sendCommandError(res, error)
            throw error
        }
    }

    const getTemplateDetail = async (req: Request, res: Response) => {
        const params = interpretationNetworkTemplateRouteParamsSchema.safeParse(req.params)
        if (!params.success) {
            return sendValidationError(
                res,
                params.error,
                interpretationNetworkControllerErrorCodes.invalidRouteParameters,
                'Invalid route parameters'
            )
        }

        const resolved = await resolveRuntimeSurface(req, res, req.params.applicationId)
        if (!resolved) {
            return
        }

        try {
            return res.json(await getInterpretationNetworkTemplateDetail(resolved.ctx, resolved.surface, params.data.templateId))
        } catch (error) {
            if (error instanceof InterpretationNetworkCommandError) return sendCommandError(res, error)
            throw error
        }
    }

    const saveTemplate = async (req: Request, res: Response) => {
        const parsedBody = interpretationNetworkTemplateSaveRequestSchema.safeParse(req.body)
        if (!parsedBody.success) {
            return sendValidationError(
                res,
                parsedBody.error,
                interpretationNetworkControllerErrorCodes.invalidRequestBody,
                'Invalid request body'
            )
        }

        const { applicationId } = req.params
        const resolved = await resolveRuntimeSurface(req, res, applicationId)
        if (!resolved) {
            return
        }

        if (!ensureRuntimePermission(res, resolved.ctx, 'createContent')) return
        if (!ensureRuntimePermission(res, resolved.ctx, 'editContent')) return

        try {
            const result = await saveStructureAsTemplate(resolved.ctx, resolved.surface, parsedBody.data)
            return res.status(201).json(result)
        } catch (error) {
            if (error instanceof InterpretationNetworkCommandError) return sendCommandError(res, error)
            throw error
        }
    }

    const updateTemplate = async (req: Request, res: Response) => {
        const params = interpretationNetworkTemplateRouteParamsSchema.safeParse(req.params)
        if (!params.success) {
            return sendValidationError(
                res,
                params.error,
                interpretationNetworkControllerErrorCodes.invalidRouteParameters,
                'Invalid route parameters'
            )
        }

        const parsedBody = interpretationNetworkTemplateUpdateRequestSchema.safeParse(req.body)
        if (!parsedBody.success) {
            return sendValidationError(
                res,
                parsedBody.error,
                interpretationNetworkControllerErrorCodes.invalidRequestBody,
                'Invalid request body'
            )
        }

        const resolved = await resolveRuntimeSurface(req, res, req.params.applicationId)
        if (!resolved) {
            return
        }

        if (!ensureRuntimePermission(res, resolved.ctx, 'editContent')) return

        try {
            const result = await updateInterpretationNetworkTemplate(resolved.ctx, resolved.surface, {
                ...parsedBody.data,
                templateId: params.data.templateId
            })
            return res.json(result)
        } catch (error) {
            if (error instanceof InterpretationNetworkCommandError) return sendCommandError(res, error)
            throw error
        }
    }

    const deleteTemplate = async (req: Request, res: Response) => {
        const params = interpretationNetworkTemplateRouteParamsSchema.safeParse(req.params)
        if (!params.success) {
            return sendValidationError(
                res,
                params.error,
                interpretationNetworkControllerErrorCodes.invalidRouteParameters,
                'Invalid route parameters'
            )
        }

        const parsedBody = interpretationNetworkTemplateDeleteRequestSchema.safeParse(req.body ?? {})
        if (!parsedBody.success) {
            return sendValidationError(
                res,
                parsedBody.error,
                interpretationNetworkControllerErrorCodes.invalidRequestBody,
                'Invalid request body'
            )
        }

        const resolved = await resolveRuntimeSurface(req, res, req.params.applicationId)
        if (!resolved) {
            return
        }

        if (!ensureRuntimePermission(res, resolved.ctx, 'deleteContent')) return

        try {
            await deleteInterpretationNetworkTemplate(resolved.ctx, resolved.surface, {
                ...parsedBody.data,
                templateId: params.data.templateId
            })
            return res.status(204).send()
        } catch (error) {
            if (error instanceof InterpretationNetworkCommandError) return sendCommandError(res, error)
            throw error
        }
    }

    const instantiateTemplate = async (req: Request, res: Response) => {
        const params = interpretationNetworkTemplateRouteParamsSchema.safeParse(req.params)
        if (!params.success) {
            return sendValidationError(
                res,
                params.error,
                interpretationNetworkControllerErrorCodes.invalidRouteParameters,
                'Invalid route parameters'
            )
        }

        const parsedBody = interpretationNetworkTemplateInstantiateRequestSchema.safeParse(req.body)
        if (!parsedBody.success) {
            return sendValidationError(
                res,
                parsedBody.error,
                interpretationNetworkControllerErrorCodes.invalidRequestBody,
                'Invalid request body'
            )
        }

        const resolved = await resolveRuntimeSurface(req, res, req.params.applicationId)
        if (!resolved) {
            return
        }

        if (!ensureRuntimePermission(res, resolved.ctx, 'createContent')) return
        if (!ensureRuntimePermission(res, resolved.ctx, 'editContent')) return

        try {
            const result = await instantiateStructureFromTemplate(resolved.ctx, resolved.surface, {
                ...parsedBody.data,
                templateId: params.data.templateId
            })
            return res.status(201).json(result)
        } catch (error) {
            if (error instanceof InterpretationNetworkCommandError) return sendCommandError(res, error)
            throw error
        }
    }

    const createMaterial = async (req: Request, res: Response) => {
        const parsedBody = interpretationNetworkMaterialCreateRequestSchema.safeParse(req.body)
        if (!parsedBody.success) {
            return sendValidationError(
                res,
                parsedBody.error,
                interpretationNetworkControllerErrorCodes.invalidRequestBody,
                'Invalid request body'
            )
        }

        const { applicationId } = req.params
        const resolved = await resolveRuntimeSurface(req, res, applicationId)
        if (!resolved) {
            return
        }

        if (!ensureRuntimePermission(res, resolved.ctx, 'createContent')) return
        if (!ensureRuntimePermission(res, resolved.ctx, 'editContent')) return

        try {
            const result = await createMaterialForCell(resolved.ctx, resolved.surface, parsedBody.data)
            return res.status(201).json(result)
        } catch (error) {
            if (error instanceof InterpretationNetworkCommandError) return sendCommandError(res, error)
            throw error
        }
    }

    const deleteStructure = async (req: Request, res: Response) => {
        const params = interpretationNetworkStructureRouteParamsSchema.safeParse(req.params)
        if (!params.success) {
            return sendValidationError(
                res,
                params.error,
                interpretationNetworkControllerErrorCodes.invalidRouteParameters,
                'Invalid route parameters'
            )
        }
        const parsedBody = interpretationNetworkStructureDeleteRequestSchema.safeParse(req.body ?? {})
        if (!parsedBody.success) {
            return sendValidationError(
                res,
                parsedBody.error,
                interpretationNetworkControllerErrorCodes.invalidRequestBody,
                'Invalid request body'
            )
        }
        const resolved = await resolveRuntimeSurface(req, res, params.data.applicationId)
        if (!resolved) return
        if (!ensureRuntimePermission(res, resolved.ctx, 'deleteContent')) return

        try {
            await deleteStructureAggregate(resolved.ctx, resolved.surface, params.data.structureId, parsedBody.data)
            return res.status(204).send()
        } catch (error) {
            if (error instanceof InterpretationNetworkCommandError) return sendCommandError(res, error)
            throw error
        }
    }

    return {
        getRuntime,
        createStructure,
        ensureSystemStructure,
        listTemplates,
        getTemplateDetail,
        saveTemplate,
        updateTemplate,
        deleteTemplate,
        instantiateTemplate,
        deleteStructure,
        createMaterial
    }
}
