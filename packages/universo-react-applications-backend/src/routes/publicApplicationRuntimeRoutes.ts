import { Router } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo-react/utils'
import { asyncHandler } from '../shared/asyncHandler'
import { createPublicApplicationRuntimeController } from '../controllers/publicApplicationRuntimeController'

export function createPublicApplicationRuntimeRoutes(
    getDbExecutor: () => DbExecutor,
    publicRuntimeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    const controller = createPublicApplicationRuntimeController(getDbExecutor)

    // Anonymous published-read bootstrap is the most expensive read endpoint
    // (one full readiness transaction per request), so it uses its own stricter
    // limiter instead of sharing the authenticated read budget.
    router.get('/public/applications/:applicationRef/runtime', publicRuntimeLimiter, asyncHandler(controller.getRuntime))

    return router
}
