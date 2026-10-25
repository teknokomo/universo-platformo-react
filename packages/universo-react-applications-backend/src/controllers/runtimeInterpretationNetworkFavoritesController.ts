import type { Request, Response } from 'express'
import { uuidV7Schema } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import { z } from 'zod'
import { createQueryHelper, resolveRuntimeSchema } from '../shared/runtimeHelpers'
import { InterpretationNetworkCommandError } from '../services/interpretationNetwork/runtimeInterpretationNetworkCore'
import {
    addInterpretationNetworkFavorite,
    InterpretationNetworkFavoriteError,
    listInterpretationNetworkFavorites,
    removeInterpretationNetworkFavorite
} from '../services/interpretationNetwork/runtimeInterpretationNetworkFavorites'
import { resolveInterpretationNetworkRuntimeSurface } from '../services/interpretationNetwork/runtimeInterpretationNetworkSurface'

const routeParamsSchema = z.object({ applicationId: uuidV7Schema }).strict()

const favoriteTargetSchema = z
    .object({
        interpretationId: uuidV7Schema,
        cellId: uuidV7Schema
    })
    .strict()

const favoriteIdentitySchema = z.object({ favoriteId: uuidV7Schema }).strict()

const listQuerySchema = z
    .object({
        locale: z.string().trim().min(2).max(16).default('en'),
        limit: z.coerce.number().int().positive().max(200).default(100),
        offset: z.coerce.number().int().min(0).max(10000).default(0),
        // Workspace selection is accepted only through the existing authenticated
        // resolver, which verifies the actor's membership before creating the context.
        workspaceId: uuidV7Schema.optional()
    })
    .strict()

const sendFavoriteError = (res: Response, error: unknown) => {
    if (error instanceof InterpretationNetworkFavoriteError) {
        return res.status(error.statusCode).json({ error: error.message, code: error.code })
    }
    if (error instanceof InterpretationNetworkCommandError) {
        return res.status(error.statusCode).json({
            error: error.message,
            code: error.code,
            ...(error.details === undefined ? {} : { details: error.details })
        })
    }
    throw error
}

export function createRuntimeInterpretationNetworkFavoritesController(getDbExecutor: () => DbExecutor) {
    const query = createQueryHelper(getDbExecutor)

    const resolveContext = async (req: Request, res: Response) => {
        const params = routeParamsSchema.safeParse(req.params)
        if (!params.success) {
            res.status(400).json({ error: 'Invalid application route parameters', code: 'INVALID_ROUTE_PARAMETERS' })
            return null
        }
        return resolveRuntimeSchema(getDbExecutor, query, req, res, params.data.applicationId)
    }

    const resolveSurface = async (ctx: NonNullable<Awaited<ReturnType<typeof resolveContext>>>, applicationId: string, res: Response) => {
        const surface = await resolveInterpretationNetworkRuntimeSurface(ctx.manager, {
            applicationId,
            schemaName: ctx.schemaName,
            workspaceId: ctx.currentWorkspaceId
        })
        if (surface.featureState !== 'ready') {
            res.status(409).json({
                error: 'Interpretation Network is not available in the current Workspace.',
                code: 'INTERPRETATION_NETWORK_FEATURE_NOT_READY'
            })
            return null
        }
        return surface
    }

    const list = async (req: Request, res: Response) => {
        const queryResult = listQuerySchema.safeParse(req.query ?? {})
        if (!queryResult.success) {
            return res.status(400).json({ error: 'Invalid Favorites query', code: 'INVALID_QUERY', details: queryResult.error.flatten() })
        }
        const ctx = await resolveContext(req, res)
        if (!ctx) return
        const surface = await resolveSurface(ctx, req.params.applicationId, res)
        if (!surface) return
        try {
            return res.json(await listInterpretationNetworkFavorites(ctx, surface, queryResult.data))
        } catch (error) {
            return sendFavoriteError(res, error)
        }
    }

    const add = async (req: Request, res: Response) => {
        const target = favoriteTargetSchema.safeParse(req.body)
        if (!target.success) {
            return res
                .status(400)
                .json({ error: 'Invalid Favorite target', code: 'INVALID_FAVORITE_TARGET', details: target.error.flatten() })
        }
        const ctx = await resolveContext(req, res)
        if (!ctx) return
        const surface = await resolveSurface(ctx, req.params.applicationId, res)
        if (!surface) return
        try {
            const result = await addInterpretationNetworkFavorite(ctx, surface, target.data)
            return res.status(result.created ? 201 : 200).json({ ...result, status: result.created ? 'created' : 'alreadyPresent' })
        } catch (error) {
            return sendFavoriteError(res, error)
        }
    }

    const remove = async (req: Request, res: Response) => {
        const favorite = favoriteIdentitySchema.safeParse(req.body)
        if (!favorite.success) {
            return res
                .status(400)
                .json({ error: 'Invalid Favorite identity', code: 'INVALID_FAVORITE_IDENTITY', details: favorite.error.flatten() })
        }
        const ctx = await resolveContext(req, res)
        if (!ctx) return
        try {
            const result = await removeInterpretationNetworkFavorite(ctx, favorite.data.favoriteId)
            return res.json({ ...result, status: result.removed ? 'removed' : 'alreadyAbsent' })
        } catch (error) {
            return sendFavoriteError(res, error)
        }
    }

    return { list, add, remove }
}
