import { Router, type Request, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo-react/utils'
import { createApplicationAliasesController } from '../controllers/applicationAliasesController'
import { asyncHandler } from '../shared/asyncHandler'

export function createApplicationAliasesRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler,
    getRequestDbExecutor?: (req: Request) => DbExecutor
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const controller = createApplicationAliasesController(getDbExecutor, getRequestDbExecutor)

    router.get('/application-aliases/application-options', readLimiter, asyncHandler(controller.applicationOptions))
    router.get('/application-aliases', readLimiter, asyncHandler(controller.list))
    router.post('/application-aliases', writeLimiter, asyncHandler(controller.create))
    router.patch('/application-aliases/:id', writeLimiter, asyncHandler(controller.rename))
    router.post('/application-aliases/:id/primary', writeLimiter, asyncHandler(controller.setPrimary))
    router.delete('/application-aliases/:id', writeLimiter, asyncHandler(controller.release))

    // Current management frontend uses the explicit Release action endpoint.
    // Keep DELETE as the canonical REST mutation while accepting this equivalent route.
    router.post('/application-aliases/:id/release', writeLimiter, asyncHandler(controller.release))

    router.get('/applications/:applicationId/aliases', readLimiter, asyncHandler(controller.listByApplication))
    router.get('/applications/:applicationId/aliases/policy', readLimiter, asyncHandler(controller.getPolicy))
    router.patch('/applications/:applicationId/aliases/policy', writeLimiter, asyncHandler(controller.updatePolicy))

    return router
}
