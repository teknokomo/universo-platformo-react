import { Router, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo/utils'
import { asyncHandler } from '../shared/asyncHandler'
import { createConnectorsController } from '../controllers/connectorsController'

export function createConnectorsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)
    const ctrl = createConnectorsController(getDbExecutor)

    // Connector CRUD
    router.get('/applications/:applicationId/connectors', readLimiter, asyncHandler(ctrl.listConnectors))
    router.get('/applications/:applicationId/connectors/:connectorId', readLimiter, asyncHandler(ctrl.getConnector))
    router.post('/applications/:applicationId/connectors', writeLimiter, asyncHandler(ctrl.createConnector))
    router.patch('/applications/:applicationId/connectors/:connectorId', writeLimiter, asyncHandler(ctrl.updateConnector))
    router.delete('/applications/:applicationId/connectors/:connectorId', writeLimiter, asyncHandler(ctrl.deleteConnector))

    // Connector ↔ Publication link management
    router.get('/applications/:applicationId/connectors/:connectorId/publications', readLimiter, asyncHandler(ctrl.listPublicationLinks))
    router.post('/applications/:applicationId/connectors/:connectorId/publications', writeLimiter, asyncHandler(ctrl.createPublicationLink))
    router.delete(
        '/applications/:applicationId/connectors/:connectorId/publications/:linkId',
        writeLimiter,
        asyncHandler(ctrl.deletePublicationLink)
    )

    return router
}
