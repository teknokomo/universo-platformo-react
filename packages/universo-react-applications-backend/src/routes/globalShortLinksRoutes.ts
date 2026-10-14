import { Router, type Request, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo-react/utils'
import { createGlobalShortLinksController, type GlobalShortLinksGuestRuntime } from '../controllers/globalShortLinksController'
import { asyncHandler } from '../shared/asyncHandler'

export function createGlobalShortLinksRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler,
    getRequestDbExecutor: (req: Request) => DbExecutor,
    guestRuntime: GlobalShortLinksGuestRuntime
): Router {
    const router = Router({ mergeParams: true })
    const controller = createGlobalShortLinksController(getDbExecutor, getRequestDbExecutor, guestRuntime)

    // This resolver returns a typed target and never treats stored data as a redirect URL.
    router.get('/public/l/:slug', readLimiter, asyncHandler(controller.resolve))

    router.get('/global-short-links', ensureAuth, readLimiter, asyncHandler(controller.list))
    router.get(
        '/global-short-links/applications/:applicationId/quiz-access-options',
        ensureAuth,
        readLimiter,
        asyncHandler(controller.listQuizAccessOptions)
    )
    router.get(
        '/global-short-links/applications/:applicationId/application-resource-options',
        ensureAuth,
        readLimiter,
        asyncHandler(controller.listApplicationResourceOptions)
    )
    router.post('/global-short-links', ensureAuth, writeLimiter, asyncHandler(controller.create))
    router.post('/global-short-links/:id/release', ensureAuth, writeLimiter, asyncHandler(controller.release))

    return router
}
