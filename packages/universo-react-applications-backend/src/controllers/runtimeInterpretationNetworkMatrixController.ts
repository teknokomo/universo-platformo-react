import type { Request, Response } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import { uuidV7Schema } from '@universo-react/types'
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
import {
    buildInterpretationNetworkRuntimeSurfaceContext,
    parseInterpretationNetworkRuntimeSurfaceQuery
} from '../services/interpretationNetwork/runtimeInterpretationNetworkSurfaceRequest'
import { WorkspaceSettingsError, WORKSPACE_SETTINGS_ERROR_CODES } from '../services/workspaceSettingsService'

const sendCommandError = (res: Response, error: InterpretationNetworkCommandError) =>
    res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        ...(error.details === undefined ? {} : { details: error.details })
    })

export function createRuntimeInterpretationNetworkMatrixController(getDbExecutor: () => DbExecutor) {
    const query = createQueryHelper(getDbExecutor)

    const resolveSurface = async (req: Request, res: Response) => {
        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, req.params.applicationId)
        if (!ctx) return null
        const parsedSurfaceQuery = parseInterpretationNetworkRuntimeSurfaceQuery(req.query)
        if (!parsedSurfaceQuery.success) {
            res.status(400).json({ error: 'Invalid runtime widget context', details: parsedSurfaceQuery.error.flatten() })
            return null
        }
        const surfaceContext = buildInterpretationNetworkRuntimeSurfaceContext(ctx, req.params.applicationId, parsedSurfaceQuery.data)
        if (!surfaceContext.ok) {
            const details = surfaceContext.reason === 'invalid-runtime-target' ? surfaceContext.details : undefined
            const error =
                surfaceContext.reason === 'missing-instance-key'
                    ? 'A semantic Matrix placement is required for workspace mutations'
                    : 'Invalid semantic Matrix runtime target'
            res.status(400).json({ error, ...(details === undefined ? {} : { details }) })
            return null
        }

        let surface
        try {
            surface = await resolveInterpretationNetworkRuntimeSurface(ctx.manager, surfaceContext.params)
        } catch (error) {
            if (!(error instanceof WorkspaceSettingsError)) throw error
            const status = error.code === WORKSPACE_SETTINGS_ERROR_CODES.settingValueInvalid ? 409 : 404
            res.status(status).json({ error: 'Workspace settings could not be resolved for the active Matrix placement', code: error.code })
            return null
        }
        const mutationContext: InterpretationNetworkMatrixMutationContext = surfaceContext.params
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
