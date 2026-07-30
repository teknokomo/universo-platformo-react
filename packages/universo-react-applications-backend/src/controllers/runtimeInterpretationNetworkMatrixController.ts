import type { Request, Response } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import { z } from 'zod'
import { createQueryHelper, resolveRuntimeSchema } from '../shared/runtimeHelpers'
import {
    InterpretationNetworkCommandError,
    interpretationNetworkMatrixCellCreateRequestSchema,
    interpretationNetworkMatrixCellsMoveRequestSchema
} from '../services/interpretationNetwork/runtimeInterpretationNetworkCore'
import {
    createInterpretationNetworkMatrixCell,
    moveInterpretationNetworkMatrixCells
} from '../services/interpretationNetwork/runtimeInterpretationNetworkMatrixCommands'
import { resolveInterpretationNetworkRuntimeSurface } from '../services/interpretationNetwork/runtimeInterpretationNetworkSurface'

const sendCommandError = (res: Response, error: InterpretationNetworkCommandError) =>
    res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        ...(error.details === undefined ? {} : { details: error.details })
    })

const runtimeSurfaceQuerySchema = z
    .object({
        widgetId: z.string().uuid().optional(),
        layoutId: z.string().uuid().optional()
    })
    .strict()

export function createRuntimeInterpretationNetworkMatrixController(getDbExecutor: () => DbExecutor) {
    const query = createQueryHelper(getDbExecutor)

    const resolveSurface = async (req: Request, res: Response) => {
        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, req.params.applicationId)
        if (!ctx) return null
        const requestQuery = req.query ?? {}
        const parsedSurfaceQuery = runtimeSurfaceQuerySchema.safeParse({
            ...(typeof requestQuery.widgetId === 'string' ? { widgetId: requestQuery.widgetId } : {}),
            ...(typeof requestQuery.layoutId === 'string' ? { layoutId: requestQuery.layoutId } : {})
        })
        if (!parsedSurfaceQuery.success) {
            res.status(400).json({ error: 'Invalid runtime widget context', details: parsedSurfaceQuery.error.flatten() })
            return null
        }
        const surface = await resolveInterpretationNetworkRuntimeSurface(ctx.manager, {
            applicationId: req.params.applicationId,
            schemaName: ctx.schemaName,
            workspaceId: ctx.currentWorkspaceId,
            ...parsedSurfaceQuery.data
        })
        return { ctx, surface }
    }

    const createCell = async (req: Request, res: Response) => {
        const parsed = interpretationNetworkMatrixCellCreateRequestSchema.safeParse(req.body)
        if (!parsed.success) return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() })
        const resolved = await resolveSurface(req, res)
        if (!resolved) return
        try {
            return res.status(201).json(await createInterpretationNetworkMatrixCell(resolved.ctx, resolved.surface, parsed.data))
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
            return res.json(await moveInterpretationNetworkMatrixCells(resolved.ctx, resolved.surface, parsed.data))
        } catch (error) {
            if (error instanceof InterpretationNetworkCommandError) return sendCommandError(res, error)
            throw error
        }
    }

    return { createCell, moveCells }
}
