import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo/utils'
import { asyncHandler } from '../shared/asyncHandler'
import { createApplicationsController } from '../controllers/applicationsController'
import { createRuntimeRowsController } from '../controllers/runtimeRowsController'
import { createRuntimeChildRowsController } from '../controllers/runtimeChildRowsController'
import { createRuntimeScriptsController } from '../controllers/runtimeScriptsController'

export function createApplicationsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const app = createApplicationsController(getDbExecutor)
    const runtime = createRuntimeRowsController(getDbExecutor)
    const childRows = createRuntimeChildRowsController(getDbExecutor)
    const runtimeScripts = createRuntimeScriptsController(getDbExecutor)

    // ── Application CRUD ──
    router.get('/', readLimiter, asyncHandler(app.list))
    router.get('/:applicationId', readLimiter, asyncHandler(app.get))
    router.post('/', writeLimiter, asyncHandler(app.create))
    router.post('/:applicationId/copy', writeLimiter, asyncHandler(app.copy))
    router.patch('/:applicationId', writeLimiter, asyncHandler(app.update))
    router.delete('/:applicationId', writeLimiter, asyncHandler(app.remove))

    // ── Membership ──
    router.post('/:applicationId/join', writeLimiter, asyncHandler(app.join))
    router.post('/:applicationId/leave', writeLimiter, asyncHandler(app.leave))

    // ── Settings ──
    router.get('/:applicationId/settings/limits', readLimiter, asyncHandler(app.getLimits))
    router.put('/:applicationId/settings/limits', writeLimiter, asyncHandler(app.updateLimits))

    // ── Members ──
    router.get('/:applicationId/members', readLimiter, asyncHandler(app.listMembers))
    router.post('/:applicationId/members', writeLimiter, asyncHandler(app.addMember))
    router.patch('/:applicationId/members/:memberId', writeLimiter, asyncHandler(app.updateMember))
    router.delete('/:applicationId/members/:memberId', writeLimiter, asyncHandler(app.removeMember))

    // ── Runtime rows ──
    router.get('/:applicationId/runtime', readLimiter, asyncHandler(runtime.getRuntime))
    router.get('/:applicationId/runtime/rows/:rowId', readLimiter, asyncHandler(runtime.getRow))
    router.post('/:applicationId/runtime/rows', writeLimiter, asyncHandler(runtime.createRow))
    router.post('/:applicationId/runtime/rows/reorder', writeLimiter, asyncHandler(runtime.reorderRows))
    router.post('/:applicationId/runtime/rows/:rowId/copy', writeLimiter, asyncHandler(runtime.copyRow))
    router.patch('/:applicationId/runtime/rows/:rowId', writeLimiter, asyncHandler(runtime.bulkUpdateRow))
    router.patch('/:applicationId/runtime/:rowId', writeLimiter, asyncHandler(runtime.updateCell))
    router.delete('/:applicationId/runtime/rows/:rowId', writeLimiter, asyncHandler(runtime.deleteRow))
    router.get('/:applicationId/runtime/scripts', readLimiter, asyncHandler(runtimeScripts.listScripts))
    router.get('/:applicationId/runtime/scripts/:scriptId/client', readLimiter, asyncHandler(runtimeScripts.getClientBundle))
    router.post('/:applicationId/runtime/scripts/:scriptId/call', writeLimiter, asyncHandler(runtimeScripts.callMethod))

    // ── Runtime child rows (tabular) ──
    router.get('/:applicationId/runtime/rows/:recordId/tabular/:attributeId', readLimiter, asyncHandler(childRows.listChildRows))
    router.post('/:applicationId/runtime/rows/:recordId/tabular/:attributeId', writeLimiter, asyncHandler(childRows.createChildRow))
    router.patch(
        '/:applicationId/runtime/rows/:recordId/tabular/:attributeId/:childRowId',
        writeLimiter,
        asyncHandler(childRows.updateChildRow)
    )
    router.post(
        '/:applicationId/runtime/rows/:recordId/tabular/:attributeId/:childRowId/copy',
        writeLimiter,
        asyncHandler(childRows.copyChildRow)
    )
    router.delete(
        '/:applicationId/runtime/rows/:recordId/tabular/:attributeId/:childRowId',
        writeLimiter,
        asyncHandler(childRows.deleteChildRow)
    )

    return router
}
