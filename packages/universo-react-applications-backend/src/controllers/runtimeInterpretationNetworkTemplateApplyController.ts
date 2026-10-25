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
import {
    buildInterpretationNetworkRuntimeSurfaceContext,
    parseInterpretationNetworkRuntimeSurfaceQuery
} from '../services/interpretationNetwork/runtimeInterpretationNetworkSurfaceRequest'
import { WorkspaceSettingsError, WORKSPACE_SETTINGS_ERROR_CODES } from '../services/workspaceSettingsService'

const routeParamsSchema = z
    .object({
        applicationId: z.string().min(1),
        templateId: uuidV7Schema
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

        const parsedSurfaceQuery = parseInterpretationNetworkRuntimeSurfaceQuery(req.query)
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

        const surfaceContext = buildInterpretationNetworkRuntimeSurfaceContext(
            ctx,
            parsedParams.data.applicationId,
            parsedSurfaceQuery.data
        )
        if (!surfaceContext.ok) {
            const details = surfaceContext.reason === 'invalid-runtime-target' ? surfaceContext.details : undefined
            const message =
                surfaceContext.reason === 'missing-instance-key'
                    ? 'A semantic Matrix placement is required for workspace mutations'
                    : 'Invalid semantic Matrix runtime target'
            return sendError(res, 400, message, 'INTERPRETATION_NETWORK_INVALID_RUNTIME_CONTEXT', details)
        }

        try {
            const surface = await resolveInterpretationNetworkRuntimeSurface(ctx.manager, surfaceContext.params)
            const result = await applyTableTemplateToMatrix(
                ctx,
                surface,
                parsedParams.data.templateId,
                parsedBody.data,
                surfaceContext.params
            )
            return res.status(201).json(interpretationNetworkTemplateApplyResponseSchema.parse(result))
        } catch (error) {
            if (error instanceof InterpretationNetworkCommandError) {
                return sendError(res, error.statusCode, error.message, error.code, error.details)
            }
            if (error instanceof WorkspaceSettingsError) {
                const status = error.code === WORKSPACE_SETTINGS_ERROR_CODES.settingValueInvalid ? 409 : 404
                return sendError(res, status, 'Workspace settings could not be resolved for the active Matrix placement', error.code)
            }
            throw error
        }
    }

    return { applyTemplate }
}
