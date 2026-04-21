import { Router } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo/utils'
import { asyncHandler } from '../shared/asyncHandler'
import { createRuntimeGuestController } from '../controllers/runtimeGuestController'

export function createPublicApplicationsRoutes(
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    const guest = createRuntimeGuestController(getDbExecutor)

    router.get('/public/a/:applicationId/links/:slug', readLimiter, asyncHandler(guest.resolveLink))
    router.post('/public/a/:applicationId/guest-session', writeLimiter, asyncHandler(guest.createGuestSession))
    router.get('/public/a/:applicationId/runtime', readLimiter, asyncHandler(guest.getRuntime))
    router.post('/public/a/:applicationId/runtime/guest-submit', writeLimiter, asyncHandler(guest.submitGuestQuiz))
    router.post('/public/a/:applicationId/runtime/guest-progress', writeLimiter, asyncHandler(guest.updateGuestProgress))
    router.get('/public/a/:applicationId/runtime/scripts', readLimiter, asyncHandler(guest.listPublicScripts))
    router.get('/public/a/:applicationId/runtime/scripts/:scriptId/client', readLimiter, asyncHandler(guest.getPublicClientBundle))

    return router
}
