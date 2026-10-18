import { Router } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo-react/utils'
import { asyncHandler } from '../shared/asyncHandler'
import { createRuntimeGuestController } from '../controllers/runtimeGuestController'

export function createPublicApplicationsRoutes(
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler,
    guestRuntime: ReturnType<typeof createRuntimeGuestController> = createRuntimeGuestController(getDbExecutor)
): Router {
    const router = Router({ mergeParams: true })
    const guest = guestRuntime

    router.get('/public/a/:applicationId/links/:slug', readLimiter, asyncHandler(guest.resolveLink))
    router.post('/public/a/:applicationId/guest-session', writeLimiter, asyncHandler(guest.createGuestSession))
    router.get('/public/a/:applicationId/runtime', readLimiter, asyncHandler(guest.getRuntime))
    router.post('/public/a/:applicationId/runtime/attempts/start', writeLimiter, asyncHandler(guest.startGuestAssessmentAttempt))
    router.get('/public/a/:applicationId/runtime/attempts/:attemptId', readLimiter, asyncHandler(guest.getGuestAssessmentAttempt))
    router.post(
        '/public/a/:applicationId/runtime/attempts/:attemptId/continue',
        writeLimiter,
        asyncHandler(guest.continueGuestAssessmentAttempt)
    )
    router.put('/public/a/:applicationId/runtime/attempts/:attemptId/answers', writeLimiter, asyncHandler(guest.saveGuestAssessmentAnswer))
    router.post(
        '/public/a/:applicationId/runtime/attempts/:attemptId/finalize',
        writeLimiter,
        asyncHandler(guest.finalizeGuestAssessmentAttempt)
    )
    router.post('/public/a/:applicationId/runtime/guest-progress', writeLimiter, asyncHandler(guest.updateGuestProgress))
    router.get('/public/a/:applicationId/runtime/modules', readLimiter, asyncHandler(guest.listPublicModules))
    router.get('/public/a/:applicationId/runtime/modules/:moduleId/client', readLimiter, asyncHandler(guest.getPublicClientBundle))

    return router
}
