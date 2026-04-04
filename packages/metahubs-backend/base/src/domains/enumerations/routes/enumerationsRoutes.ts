import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '../../../utils'
import { asyncHandler } from '../../shared'
import { createEnumerationsController } from '../controllers/enumerationsController'

export function createEnumerationsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const ctrl = createEnumerationsController(getDbExecutor)

    // ─── Enumerations CRUD ──────────────────────────────────────────────────────
    router.get('/metahub/:metahubId/enumerations', readLimiter, asyncHandler(ctrl.list))
    router.post('/metahub/:metahubId/enumerations', writeLimiter, asyncHandler(ctrl.create))
    router.post('/metahub/:metahubId/enumeration/:enumerationId/copy', writeLimiter, asyncHandler(ctrl.copy))
    router.patch('/metahub/:metahubId/enumeration/:enumerationId', writeLimiter, asyncHandler(ctrl.update))

    // ─── Hub-scoped enumerations ────────────────────────────────────────────────
    router.get('/metahub/:metahubId/hub/:hubId/enumerations', readLimiter, asyncHandler(ctrl.listByHub))
    router.patch(
        ['/metahub/:metahubId/enumerations/reorder', '/metahub/:metahubId/hub/:hubId/enumerations/reorder'],
        writeLimiter,
        asyncHandler(ctrl.reorder)
    )
    router.get(
        ['/metahub/:metahubId/hub/:hubId/enumeration/:enumerationId', '/metahub/:metahubId/enumeration/:enumerationId'],
        readLimiter,
        asyncHandler(ctrl.getById)
    )
    router.post('/metahub/:metahubId/hub/:hubId/enumerations', writeLimiter, asyncHandler(ctrl.createInHub))
    router.patch('/metahub/:metahubId/hub/:hubId/enumeration/:enumerationId', writeLimiter, asyncHandler(ctrl.updateInHub))

    // ─── Blocking references ────────────────────────────────────────────────────
    router.get(
        [
            '/metahub/:metahubId/enumeration/:enumerationId/blocking-references',
            '/metahub/:metahubId/enumerations/:enumerationId/blocking-references'
        ],
        readLimiter,
        asyncHandler(ctrl.blockingReferences)
    )

    // ─── Delete ─────────────────────────────────────────────────────────────────
    router.delete('/metahub/:metahubId/hub/:hubId/enumeration/:enumerationId', writeLimiter, asyncHandler(ctrl.deleteFromHub))
    router.delete('/metahub/:metahubId/enumeration/:enumerationId', writeLimiter, asyncHandler(ctrl.remove))

    // ─── Trash / Restore / Permanent delete ─────────────────────────────────────
    router.get('/metahub/:metahubId/enumerations/trash', readLimiter, asyncHandler(ctrl.listTrash))
    router.post('/metahub/:metahubId/enumeration/:enumerationId/restore', writeLimiter, asyncHandler(ctrl.restore))
    router.delete('/metahub/:metahubId/enumeration/:enumerationId/permanent', writeLimiter, asyncHandler(ctrl.permanentDelete))

    // ─── Values CRUD ────────────────────────────────────────────────────────────
    router.get('/metahub/:metahubId/enumeration/:enumerationId/values', readLimiter, asyncHandler(ctrl.listValues))
    router.get('/metahub/:metahubId/enumeration/:enumerationId/value/:valueId', readLimiter, asyncHandler(ctrl.getValueById))
    router.get(
        '/metahub/:metahubId/enumeration/:enumerationId/value/:valueId/blocking-references',
        readLimiter,
        asyncHandler(ctrl.valueBlockingReferences)
    )
    router.post('/metahub/:metahubId/enumeration/:enumerationId/values', writeLimiter, asyncHandler(ctrl.createValue))
    router.patch('/metahub/:metahubId/enumeration/:enumerationId/value/:valueId', writeLimiter, asyncHandler(ctrl.updateValue))
    router.patch('/metahub/:metahubId/enumeration/:enumerationId/value/:valueId/move', writeLimiter, asyncHandler(ctrl.moveValue))
    router.patch('/metahub/:metahubId/enumeration/:enumerationId/values/reorder', writeLimiter, asyncHandler(ctrl.reorderValue))
    router.post('/metahub/:metahubId/enumeration/:enumerationId/value/:valueId/copy', writeLimiter, asyncHandler(ctrl.copyValue))
    router.delete('/metahub/:metahubId/enumeration/:enumerationId/value/:valueId', writeLimiter, asyncHandler(ctrl.deleteValue))

    return router
}
