import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo/utils'
import { asyncHandler } from '../shared/asyncHandler'
import { createApplicationsController } from '../controllers/applicationsController'
import { createRuntimeRowsController } from '../controllers/runtimeRowsController'
import { createRuntimeChildRowsController } from '../controllers/runtimeChildRowsController'
import { createRuntimeLedgersController } from '../controllers/runtimeLedgersController'
import { createRuntimeScriptsController } from '../controllers/runtimeScriptsController'
import { createRuntimeWorkspaceController } from '../controllers/runtimeWorkspaceController'
import { createApplicationLayoutsController } from '../controllers/applicationLayoutsController'

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
    const ledgers = createRuntimeLedgersController(getDbExecutor)
    const runtimeScripts = createRuntimeScriptsController(getDbExecutor)
    const workspace = createRuntimeWorkspaceController(getDbExecutor)
    const layouts = createApplicationLayoutsController(getDbExecutor)

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

    // ── Application layouts ──
    router.get('/:applicationId/layout-scopes', readLimiter, asyncHandler(layouts.listScopes))
    router.get('/:applicationId/layouts', readLimiter, asyncHandler(layouts.list))
    router.post('/:applicationId/layouts', writeLimiter, asyncHandler(layouts.create))
    router.get('/:applicationId/layouts/:layoutId', readLimiter, asyncHandler(layouts.detail))
    router.patch('/:applicationId/layouts/:layoutId', writeLimiter, asyncHandler(layouts.update))
    router.delete('/:applicationId/layouts/:layoutId', writeLimiter, asyncHandler(layouts.remove))
    router.post('/:applicationId/layouts/:layoutId/copy', writeLimiter, asyncHandler(layouts.copy))
    router.get('/:applicationId/layouts/:layoutId/zone-widgets', readLimiter, asyncHandler(layouts.listWidgets))
    router.get('/:applicationId/layouts/:layoutId/zone-widgets/catalog', readLimiter, asyncHandler(layouts.listWidgetCatalog))
    router.put('/:applicationId/layouts/:layoutId/zone-widget', writeLimiter, asyncHandler(layouts.upsertWidget))
    router.patch('/:applicationId/layouts/:layoutId/zone-widgets/move', writeLimiter, asyncHandler(layouts.moveWidget))
    router.patch('/:applicationId/layouts/:layoutId/zone-widget/:widgetId/config', writeLimiter, asyncHandler(layouts.updateWidgetConfig))
    router.patch('/:applicationId/layouts/:layoutId/zone-widget/:widgetId/toggle-active', writeLimiter, asyncHandler(layouts.toggleWidget))
    router.delete('/:applicationId/layouts/:layoutId/zone-widget/:widgetId', writeLimiter, asyncHandler(layouts.removeWidget))

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
    router.post('/:applicationId/runtime/rows/:rowId/post', writeLimiter, asyncHandler(runtime.postRow))
    router.post('/:applicationId/runtime/rows/:rowId/unpost', writeLimiter, asyncHandler(runtime.unpostRow))
    router.post('/:applicationId/runtime/rows/:rowId/void', writeLimiter, asyncHandler(runtime.voidRow))
    router.patch('/:applicationId/runtime/rows/:rowId', writeLimiter, asyncHandler(runtime.bulkUpdateRow))
    router.patch('/:applicationId/runtime/:rowId', writeLimiter, asyncHandler(runtime.updateCell))
    router.delete('/:applicationId/runtime/rows/:rowId', writeLimiter, asyncHandler(runtime.deleteRow))
    router.get('/:applicationId/runtime/scripts', readLimiter, asyncHandler(runtimeScripts.listScripts))
    router.get('/:applicationId/runtime/scripts/:scriptId/client', readLimiter, asyncHandler(runtimeScripts.getClientBundle))
    router.post('/:applicationId/runtime/scripts/:scriptId/call', writeLimiter, asyncHandler(runtimeScripts.callMethod))
    router.get('/:applicationId/runtime/ledgers', readLimiter, asyncHandler(ledgers.listLedgers))
    router.get('/:applicationId/runtime/ledgers/:ledgerId/facts', readLimiter, asyncHandler(ledgers.listFacts))
    router.patch('/:applicationId/runtime/ledgers/:ledgerId/facts/:factId', writeLimiter, asyncHandler(ledgers.updateFact))
    router.delete('/:applicationId/runtime/ledgers/:ledgerId/facts/:factId', writeLimiter, asyncHandler(ledgers.deleteFact))
    router.post('/:applicationId/runtime/ledgers/:ledgerId/facts/reverse', writeLimiter, asyncHandler(ledgers.reverseFacts))
    router.post('/:applicationId/runtime/ledgers/:ledgerId/facts', writeLimiter, asyncHandler(ledgers.appendFacts))
    router.post('/:applicationId/runtime/ledgers/:ledgerId/query', writeLimiter, asyncHandler(ledgers.queryProjection))
    router.get(
        '/:applicationId/runtime/ledgers/:ledgerId/projections/:projectionCodename',
        readLimiter,
        asyncHandler(ledgers.getProjection)
    )

    // ── Runtime workspaces ──
    router.get('/:applicationId/runtime/workspaces', readLimiter, asyncHandler(workspace.listWorkspaces))
    router.post('/:applicationId/runtime/workspaces', writeLimiter, asyncHandler(workspace.createWorkspace))
    router.get('/:applicationId/runtime/workspaces/:workspaceId', readLimiter, asyncHandler(workspace.getWorkspace))
    router.patch('/:applicationId/runtime/workspaces/:workspaceId', writeLimiter, asyncHandler(workspace.updateWorkspaceDetails))
    router.post('/:applicationId/runtime/workspaces/:workspaceId/copy', writeLimiter, asyncHandler(workspace.copyWorkspaceDetails))
    router.delete('/:applicationId/runtime/workspaces/:workspaceId', writeLimiter, asyncHandler(workspace.deleteWorkspaceDetails))
    router.patch('/:applicationId/runtime/workspaces/:workspaceId/default', writeLimiter, asyncHandler(workspace.updateDefaultWorkspace))
    router.get('/:applicationId/runtime/workspaces/:workspaceId/members', readLimiter, asyncHandler(workspace.getMembers))
    router.post('/:applicationId/runtime/workspaces/:workspaceId/members', writeLimiter, asyncHandler(workspace.inviteMember))
    router.delete('/:applicationId/runtime/workspaces/:workspaceId/members/:userId', writeLimiter, asyncHandler(workspace.deleteMember))

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
