import { Router } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { asyncHandler } from '../shared/asyncHandler'
import { createRuntimeInterpretationNetworkFavoritesController } from '../controllers/runtimeInterpretationNetworkFavoritesController'

export const createRuntimeInterpretationNetworkFavoritesRoutes = (
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router => {
    const router = Router({ mergeParams: true })
    const favorites = createRuntimeInterpretationNetworkFavoritesController(getDbExecutor)

    router.get('/', readLimiter, asyncHandler(favorites.list))
    router.post('/', writeLimiter, asyncHandler(favorites.add))
    router.delete('/', writeLimiter, asyncHandler(favorites.remove))

    return router
}
