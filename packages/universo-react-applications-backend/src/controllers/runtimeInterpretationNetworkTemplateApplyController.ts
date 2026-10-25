import type { Request, Response } from 'express'
import { uuidV7Schema } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import { z } from 'zod'
import { ensureRuntimePermission, createQueryHelper, resolveRuntimeSchema } from '../shared/runtimeHelpers'
import {
    InterpretationNetworkCommandError,
    applyTableTemplateToMatrix,
    interpretationNetworkTemplateApplyRequestSchema,
    interpretationNetworkTemplateApplyResponseSchema,
    resolveInterpretationNetworkRuntimeSurface
} from '../services/interpretationNetwork/runtimeInterpretationNetworkService'

const routeParamsSchema = z
    .object({
        applicationId: z.string().min(1),
        templateId: uuidV7Schema
    })
    .strict()

const surfaceQuerySchema = z
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

export const createRuntimeInterpretationNetworkTemplateApplyController = (getDbExecutor: () => DbExecutor) => {
    const query = createQueryHelper(getDbExecutor)

    const applyTemplate = async (req: Request, res: Response) => {
        const parsedParams = routeParamsSchema.safeParse(req.params)
        if (!parsedParams.success) {
            return sendValidationError(
                res,
                parsedParams.error,
                'INTERPRETATION_NETWORK_INVALID_ROUTE_PARAMETERS',
                'Invalid route parameters'
            )
        }

        const parsedBody = interpretationNetworkTemplateApplyRequestSchema.safeParse(req.body)
        if (!parsedBody.success) {
            return sendValidationError(res, parsedBody.error, 'INTERPRETATION_NETWORK_INVALID_REQUEST_BODY', 'Invalid request body')
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, parsedParams.data.applicationId)
        if (!ctx) return

        const parsedSurfaceQuery = surfaceQuerySchema.safeParse({
            ...(typeof req.query?.widgetId === 'string' ? { widgetId: req.query.widgetId } : {}),
            ...(typeof req.query?.layoutId === 'string' ? { layoutId: req.query.layoutId } : {})
        })
        if (!parsedSurfaceQuery.success) {
            return sendValidationError(
                res,
                parsedSurfaceQuery.error,
                'INTERPRETATION_NETWORK_INVALID_ROUTE_PARAMETERS',
                'Invalid runtime widget context'
            )
        }

        if (!ensureRuntimePermission(res, ctx, 'createContent')) return
        if (!ensureRuntimePermission(res, ctx, 'editContent')) return

        try {
            const surface = await resolveInterpretationNetworkRuntimeSurface(ctx.manager, {
                applicationId: parsedParams.data.applicationId,
                schemaName: ctx.schemaName,
                workspaceId: ctx.currentWorkspaceId,
                ...parsedSurfaceQuery.data
            })
            const result = await applyTableTemplateToMatrix(ctx, surface, parsedParams.data.templateId, parsedBody.data)
            return res.status(201).json(interpretationNetworkTemplateApplyResponseSchema.parse(result))
        } catch (error) {
            if (error instanceof InterpretationNetworkCommandError) {
                return sendError(res, error.statusCode, error.message, error.code, error.details)
            }
            throw error
        }
    }

    return { applyTemplate }
}
