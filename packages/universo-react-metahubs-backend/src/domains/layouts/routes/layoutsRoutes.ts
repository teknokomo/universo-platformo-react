import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '../../../utils'
import { asyncHandler } from '../../shared'
import { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { createLayoutsController } from '../controllers/layoutsController'
import { createWidgetBindingsController } from '../controllers/widgetBindingsController'
import { createMarketingWidgetRecordDuplicateController } from '../controllers/marketingWidgetRecordDuplicateController'

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
    const bindingCtrl = createWidgetBindingsController(createHandler)
    const recordDuplicateCtrl = createMarketingWidgetRecordDuplicateController(createHandler)

    router.get('/metahub/:metahubId/layouts', readLimiter, asyncHandler(ctrl.list))
    router.post('/metahub/:metahubId/layouts', writeLimiter, asyncHandler(ctrl.create))
    router.get('/metahub/:metahubId/layout/:layoutId', readLimiter, asyncHandler(ctrl.getById))
    router.post('/metahub/:metahubId/layout/:layoutId/copy', writeLimiter, asyncHandler(ctrl.copy))
    router.patch('/metahub/:metahubId/layout/:layoutId', writeLimiter, asyncHandler(ctrl.update))
    router.delete('/metahub/:metahubId/layout/:layoutId', writeLimiter, asyncHandler(ctrl.remove))
    router.patch('/metahub/:metahubId/layout/:layoutId/zone-settings/:zone/:settingKey', writeLimiter, asyncHandler(ctrl.updateZoneSetting))
    router.post(
        '/metahub/:metahubId/layout/:layoutId/zone-settings/:zone/:settingKey/reset',
        writeLimiter,
        asyncHandler(ctrl.resetZoneSetting)
    )
    router.get('/metahub/:metahubId/layout/:layoutId/zone-widgets/object', readLimiter, asyncHandler(ctrl.widgetsObject))
    router.get('/metahub/:metahubId/layout/:layoutId/zone-widgets', readLimiter, asyncHandler(ctrl.listZoneWidgets))
    router.get(
        '/metahub/:metahubId/layout/:layoutId/zone-widget/:widgetId/binding',
        readLimiter,
        asyncHandler(bindingCtrl.getZoneWidgetBinding)
    )
    router.get(
        '/metahub/:metahubId/layout/:layoutId/widget-binding-sources/:widgetKey/:slotKey',
        readLimiter,
        asyncHandler(bindingCtrl.getWidgetBindingSources)
    )
    router.post(
        '/metahub/:metahubId/layout/:layoutId/widget-binding-sources/:widgetKey/:slotKey',
        writeLimiter,
        asyncHandler(bindingCtrl.provisionWidgetBindingSource)
    )
    router.get(
        '/metahub/:metahubId/layout/:layoutId/zone-widget/:widgetId/binding-records/:slotKey',
        readLimiter,
        asyncHandler(bindingCtrl.getWidgetBindingRecords)
    )
    router.get(
        '/metahub/:metahubId/layout/:layoutId/widget-binding-records/:widgetKey/:slotKey',
        readLimiter,
        asyncHandler(bindingCtrl.getWidgetBindingRecords)
    )
    router.get('/metahub/:metahubId/layout/:layoutId/widget-binding-usage', readLimiter, asyncHandler(bindingCtrl.getWidgetBindingUsage))
    router.put('/metahub/:metahubId/layout/:layoutId/zone-widget', writeLimiter, asyncHandler(ctrl.assignZoneWidget))
    router.post(
        '/metahub/:metahubId/layout/:layoutId/zone-widget/duplicate',
        writeLimiter,
        asyncHandler(recordDuplicateCtrl.duplicateZoneWidget)
    )
    router.patch(
        '/metahub/:metahubId/layout/:layoutId/zone-widget/:widgetId/binding',
        writeLimiter,
        asyncHandler(bindingCtrl.updateZoneWidgetBinding)
    )
    router.patch('/metahub/:metahubId/layout/:layoutId/zone-widgets/move', writeLimiter, asyncHandler(ctrl.moveZoneWidget))
    router.delete('/metahub/:metahubId/layout/:layoutId/zone-widget/:widgetId', writeLimiter, asyncHandler(ctrl.removeZoneWidget))
    router.post(
        '/metahub/:metahubId/layout/:layoutId/zone-widget/:widgetId/reset',
        writeLimiter,
        asyncHandler(ctrl.resetZoneWidgetOverride)
    )
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
