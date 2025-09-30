import { Router } from 'express'
import type { Router as ExpressRouter } from 'express'
import { DataSource } from 'typeorm'
import { CanvasLegacyController } from '../controllers/canvasLegacyController'
import { createCanvasService, CanvasServiceFactoryOptions } from '../services/canvasServiceFactory'

export function createCanvasPublicRoutes(
    getDataSourceFn: () => DataSource,
    options: Omit<CanvasServiceFactoryOptions, 'getDataSource'>
): ExpressRouter {
    const router: ExpressRouter = Router({ mergeParams: true })
    const canvasService = createCanvasService({
        getDataSource: getDataSourceFn,
        entities: options.entities,
        dependencies: options.dependencies
    })
    const canvasController = new CanvasLegacyController(canvasService)

    router.get('/canvases/:canvasId', (req, res, next) => canvasController.getSinglePublicCanvas(req, res, next))

    return router
}

export default createCanvasPublicRoutes
