import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '../../../utils'
import { asyncHandler } from '../../shared'
import { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { createLayoutsController } from '../controllers/layoutsController'

export function createLayoutsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const createHandler = createMetahubHandlerFactory(getDbExecutor)
    const ctrl = createLayoutsController(createHandler)

    router.get('/metahub/:metahubId/layouts', readLimiter, asyncHandler(ctrl.list))
    router.post('/metahub/:metahubId/layouts', writeLimiter, asyncHandler(ctrl.create))
    router.get('/metahub/:metahubId/layout/:layoutId', readLimiter, asyncHandler(ctrl.getById))
    router.post('/metahub/:metahubId/layout/:layoutId/copy', writeLimiter, asyncHandler(ctrl.copy))
    router.patch('/metahub/:metahubId/layout/:layoutId', writeLimiter, asyncHandler(ctrl.update))
    router.delete('/metahub/:metahubId/layout/:layoutId', writeLimiter, asyncHandler(ctrl.remove))
    router.get('/metahub/:metahubId/layout/:layoutId/zone-widgets/catalog', readLimiter, asyncHandler(ctrl.widgetsCatalog))
    router.get('/metahub/:metahubId/layout/:layoutId/zone-widgets', readLimiter, asyncHandler(ctrl.listZoneWidgets))
    router.put('/metahub/:metahubId/layout/:layoutId/zone-widget', writeLimiter, asyncHandler(ctrl.assignZoneWidget))
    router.patch('/metahub/:metahubId/layout/:layoutId/zone-widgets/move', writeLimiter, asyncHandler(ctrl.moveZoneWidget))
    router.delete('/metahub/:metahubId/layout/:layoutId/zone-widget/:widgetId', writeLimiter, asyncHandler(ctrl.removeZoneWidget))
    router.patch(
        '/metahub/:metahubId/layout/:layoutId/zone-widget/:widgetId/config',
        writeLimiter,
        asyncHandler(ctrl.updateZoneWidgetConfig)
    )
    router.patch(
        '/metahub/:metahubId/layout/:layoutId/zone-widget/:widgetId/toggle-active',
        writeLimiter,
        asyncHandler(ctrl.toggleZoneWidgetActive)
    )
    router.get(
        '/metahub/:metahubId/layout/:layoutId/zone-widget/:widgetId/scope-visibility',
        readLimiter,
        asyncHandler(ctrl.listWidgetScopeVisibility)
    )
    router.patch(
        '/metahub/:metahubId/layout/:layoutId/zone-widget/:widgetId/scope-visibility/:scopeEntityId',
        writeLimiter,
        asyncHandler(ctrl.updateWidgetScopeVisibility)
    )

    return router
}
