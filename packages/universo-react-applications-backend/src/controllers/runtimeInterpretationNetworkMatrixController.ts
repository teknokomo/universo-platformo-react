import type { Request, Response } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import { layoutInstanceKeySchema, runtimeTargetSchema, uuidV7Schema } from '@universo-react/types'
import { z } from 'zod'
import { createQueryHelper, resolveRuntimeSchema } from '../shared/runtimeHelpers'
import {
    InterpretationNetworkCommandError,
    interpretationNetworkMatrixCellDeleteRequestSchema,
    interpretationNetworkMatrixCellUpdateRequestSchema,
    interpretationNetworkMatrixCellCreateRequestSchema,
    interpretationNetworkMatrixCellsMoveRequestSchema
} from '../services/interpretationNetwork/runtimeInterpretationNetworkCore'
import {
    createInterpretationNetworkMatrixCell,
    deleteInterpretationNetworkMatrixCell,
    moveInterpretationNetworkMatrixCells,
    updateInterpretationNetworkMatrixCell
} from '../services/interpretationNetwork/runtimeInterpretationNetworkMatrixCommands'
import { resolveInterpretationNetworkRuntimeSurface } from '../services/interpretationNetwork/runtimeInterpretationNetworkSurface'
import type { InterpretationNetworkMatrixMutationContext } from '../services/interpretationNetwork/runtimeInterpretationNetworkMatrixPolicy'
import { WorkspaceSettingsError, WORKSPACE_SETTINGS_ERROR_CODES } from '../services/workspaceSettingsService'

const sendCommandError = (res: Response, error: InterpretationNetworkCommandError) =>
    res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        ...(error.details === undefined ? {} : { details: error.details })
    })

const runtimeSurfaceQuerySchema = z
    .object({
        widgetId: z.string().uuid().optional(),
        layoutId: z.string().uuid().optional(),
        instanceKey: layoutInstanceKeySchema.optional(),
        targetKind: z.enum(['page', 'object']).optional(),
        entityTypeId: uuidV7Schema.optional(),
        locale: z.string().trim().min(1).max(32).default('en'),
        themeVariant: z.enum(['light', 'dark', 'system']).optional()
    })
    .strict()
    .superRefine((value, context) => {
        if ((value.targetKind && !value.entityTypeId) || (!value.targetKind && value.entityTypeId)) {
            context.addIssue({ code: z.ZodIssueCode.custom, message: 'A page or object runtime target requires an entity type ID' })
        }
    })

export function createRuntimeInterpretationNetworkMatrixController(getDbExecutor: () => DbExecutor) {
    const query = createQueryHelper(getDbExecutor)

    const resolveSurface = async (req: Request, res: Response) => {
        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, req.params.applicationId)
        if (!ctx) return null
        const requestQuery = req.query ?? {}
        const parsedSurfaceQuery = runtimeSurfaceQuerySchema.safeParse({
            ...(typeof requestQuery.widgetId === 'string' ? { widgetId: requestQuery.widgetId } : {}),
            ...(typeof requestQuery.layoutId === 'string' ? { layoutId: requestQuery.layoutId } : {}),
            ...(typeof requestQuery.instanceKey === 'string' ? { instanceKey: requestQuery.instanceKey } : {}),
            ...(typeof requestQuery.targetKind === 'string' ? { targetKind: requestQuery.targetKind } : {}),
            ...(typeof requestQuery.entityTypeId === 'string' ? { entityTypeId: requestQuery.entityTypeId } : {}),
            ...(typeof requestQuery.locale === 'string' ? { locale: requestQuery.locale } : {}),
            ...(typeof requestQuery.themeVariant === 'string' ? { themeVariant: requestQuery.themeVariant } : {})
        })
        if (!parsedSurfaceQuery.success) {
            res.status(400).json({ error: 'Invalid runtime widget context', details: parsedSurfaceQuery.error.flatten() })
            return null
        }
        const { targetKind, entityTypeId, instanceKey, locale, themeVariant, ...physicalScope } = parsedSurfaceQuery.data
        let workspaceSettings: Parameters<typeof resolveInterpretationNetworkRuntimeSurface>[1]['workspaceSettings']
        if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
            if (!instanceKey) {
                res.status(400).json({ error: 'A semantic Matrix placement is required for workspace mutations' })
                return null
            }
            const runtimeTarget = runtimeTargetSchema.safeParse({
                applicationId: req.params.applicationId,
                targetKind: targetKind ?? null,
                ...(entityTypeId ? { entityTypeId } : {}),
                workspaceId: ctx.currentWorkspaceId,
                locale,
                ...(themeVariant ? { themeVariant } : {})
            })
            if (!runtimeTarget.success) {
                res.status(400).json({ error: 'Invalid semantic Matrix runtime target', details: runtimeTarget.error.flatten() })
                return null
            }
            workspaceSettings = {
                applicationSettings: ctx.baseApplicationSettings,
                authContext: { applicationId: req.params.applicationId, userId: ctx.userId, role: ctx.role },
                runtimeTarget: runtimeTarget.data,
                instanceKey
            }
        }

        let surface
        try {
            surface = await resolveInterpretationNetworkRuntimeSurface(ctx.manager, {
                applicationId: req.params.applicationId,
                schemaName: ctx.schemaName,
                workspaceId: ctx.currentWorkspaceId,
                scopeEntityId: entityTypeId ?? null,
                ...physicalScope,
                ...(workspaceSettings ? { workspaceSettings } : {})
            })
        } catch (error) {
            if (!(error instanceof WorkspaceSettingsError)) throw error
            const status = error.code === WORKSPACE_SETTINGS_ERROR_CODES.settingValueInvalid ? 409 : 404
            res.status(status).json({ error: 'Workspace settings could not be resolved for the active Matrix placement', code: error.code })
            return null
        }
        const mutationContext: InterpretationNetworkMatrixMutationContext = {
            applicationId: req.params.applicationId,
            schemaName: ctx.schemaName,
            workspaceId: ctx.currentWorkspaceId,
            scopeEntityId: entityTypeId ?? null,
            ...physicalScope,
            ...(workspaceSettings ? { workspaceSettings } : {})
        }
        return { ctx, surface, mutationContext }
    }

    const createCell = async (req: Request, res: Response) => {
        const parsed = interpretationNetworkMatrixCellCreateRequestSchema.safeParse(req.body)
        if (!parsed.success) return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() })
        const resolved = await resolveSurface(req, res)
        if (!resolved) return
        try {
            return res
                .status(201)
                .json(await createInterpretationNetworkMatrixCell(resolved.ctx, resolved.surface, parsed.data, resolved.mutationContext))
        } catch (error) {
            if (error instanceof InterpretationNetworkCommandError) return sendCommandError(res, error)
            throw error
        }
    }

    const moveCells = async (req: Request, res: Response) => {
        const parsed = interpretationNetworkMatrixCellsMoveRequestSchema.safeParse(req.body)
        if (!parsed.success) return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() })
        const resolved = await resolveSurface(req, res)
        if (!resolved) return
        try {
            return res.json(
                await moveInterpretationNetworkMatrixCells(resolved.ctx, resolved.surface, parsed.data, resolved.mutationContext)
            )
        } catch (error) {
            if (error instanceof InterpretationNetworkCommandError) return sendCommandError(res, error)
            throw error
        }
    }

    const updateCell = async (req: Request, res: Response) => {
        const parsedId = uuidV7Schema.safeParse(req.params.cellId)
        const parsed = interpretationNetworkMatrixCellUpdateRequestSchema.safeParse(req.body)
        if (!parsedId.success || !parsed.success) {
            return res.status(400).json({ error: 'Invalid request', details: parsed.success ? undefined : parsed.error.flatten() })
        }
        const resolved = await resolveSurface(req, res)
        if (!resolved) return
        try {
            return res.json(
                await updateInterpretationNetworkMatrixCell(
                    resolved.ctx,
                    resolved.surface,
                    {
                        ...parsed.data,
                        cellId: parsedId.data
                    },
                    resolved.mutationContext
                )
            )
        } catch (error) {
            if (error instanceof InterpretationNetworkCommandError) return sendCommandError(res, error)
            throw error
        }
    }

    const deleteCell = async (req: Request, res: Response) => {
        const parsedId = uuidV7Schema.safeParse(req.params.cellId)
        const parsed = interpretationNetworkMatrixCellDeleteRequestSchema.safeParse(req.body)
        if (!parsedId.success || !parsed.success) {
            return res.status(400).json({ error: 'Invalid request', details: parsed.success ? undefined : parsed.error.flatten() })
        }
        const resolved = await resolveSurface(req, res)
        if (!resolved) return
        try {
            return res.json(
                await deleteInterpretationNetworkMatrixCell(resolved.ctx, resolved.surface, {
                    ...parsed.data,
                    cellId: parsedId.data
                })
            )
        } catch (error) {
            if (error instanceof InterpretationNetworkCommandError) return sendCommandError(res, error)
            throw error
        }
    }

    return { createCell, moveCells, updateCell, deleteCell }
}
