import { Router } from 'express'
import type { Router as ExpressRouter } from 'express'
import { DataSource } from 'typeorm'
import { SpacesController } from '../controllers/spacesController'
import { SpacesService } from '../services/spacesService'
import {
    CanvasLegacyController,
    RateLimiterManagerLike,
    CanvasLegacyControllerOptions
} from '../controllers/canvasLegacyController'
import { createCanvasService, CanvasServiceFactoryOptions } from '../services/canvasServiceFactory'

export interface CreateSpacesRoutesOptions {
    canvasService: Omit<CanvasServiceFactoryOptions, 'getDataSource'>
    rateLimiterManager?: RateLimiterManagerLike
    apiKeyService?: CanvasLegacyControllerOptions['apiKeyService']
    membership?: CanvasLegacyControllerOptions['membership']
}

export function createSpacesRoutes(
    getDataSourceFn: () => DataSource,
    options: CreateSpacesRoutesOptions
): ExpressRouter {
    // Enable access to parent route params like :unikId
    const router: ExpressRouter = Router({ mergeParams: true })

    // Initialize service and controller with DataSource function
    const spacesService = new SpacesService(getDataSourceFn)
    const spacesController = new SpacesController(spacesService)
    const canvasService = createCanvasService({
        getDataSource: getDataSourceFn,
        entities: options.canvasService.entities,
        dependencies: options.canvasService.dependencies
    })
    const canvasLegacyController = new CanvasLegacyController(canvasService, options.rateLimiterManager, {
        apiKeyService: options.apiKeyService,
        membership: options.membership
    })

    // NOTE: This router is mounted at /api/v1/unik/:id
    // Spaces CRUD
    router.get('/spaces', (req, res) => spacesController.getSpaces(req, res))
    router.post('/spaces', (req, res) => spacesController.createSpace(req, res))
    router.get('/spaces/:spaceId', (req, res) => spacesController.getSpaceDetails(req, res))
    router.put('/spaces/:spaceId', (req, res) => spacesController.updateSpace(req, res))
    router.delete('/spaces/:spaceId', (req, res) => spacesController.deleteSpace(req, res))

    // Canvases within Space
    router.get('/spaces/:spaceId/canvases', (req, res, next) => canvasLegacyController.getAllCanvases(req, res, next))
    router.post('/spaces/:spaceId/canvases', (req, res, next) => canvasLegacyController.saveCanvas(req, res, next))
    router.post('/spaces/:spaceId/canvases/import', (req, res, next) => canvasLegacyController.importCanvases(req, res, next))
    router.get('/spaces/:spaceId/canvases/:canvasId', (req, res, next) => canvasLegacyController.getCanvasById(req, res, next))
    router.put('/spaces/:spaceId/canvases/:canvasId', (req, res, next) => canvasLegacyController.updateCanvas(req, res, next))
    router.delete('/spaces/:spaceId/canvases/:canvasId', (req, res, next) => canvasLegacyController.deleteCanvas(req, res, next))
    router.put('/spaces/:spaceId/canvases/reorder', (req, res) => spacesController.reorderCanvases(req, res))
    router.get('/spaces/:spaceId/canvases/:canvasId/versions', (req, res) => spacesController.getCanvasVersions(req, res))
    router.post('/spaces/:spaceId/canvases/:canvasId/versions', (req, res) => spacesController.createCanvasVersion(req, res))
    router.put('/spaces/:spaceId/canvases/:canvasId/versions/:versionId', (req, res) =>
        spacesController.updateCanvasVersion(req, res)
    )
    router.post(
        '/spaces/:spaceId/canvases/:canvasId/versions/:versionId/activate',
        (req, res) => spacesController.activateCanvasVersion(req, res)
    )
    router.delete(
        '/spaces/:spaceId/canvases/:canvasId/versions/:versionId',
        (req, res) => spacesController.deleteCanvasVersion(req, res)
    )

    router.get(
        '/spaces/:spaceId/canvases/:canvasId/streaming',
        (req, res, next) => canvasLegacyController.checkIfCanvasIsValidForStreaming(req, res, next)
    )
    router.get(
        '/spaces/:spaceId/canvases/:canvasId/uploads',
        (req, res, next) => canvasLegacyController.checkIfCanvasIsValidForUploads(req, res, next)
    )

    router.get(
        '/canvases/:canvasId/streaming',
        (req, res, next) => canvasLegacyController.checkIfCanvasIsValidForStreaming(req, res, next)
    )
    router.get(
        '/canvases/:canvasId/uploads',
        (req, res, next) => canvasLegacyController.checkIfCanvasIsValidForUploads(req, res, next)
    )

    // Single Canvas operations (path expected by UI)
    router.get('/canvases/:canvasId', (req, res, next) => canvasLegacyController.getCanvasById(req, res, next))
    router.put('/canvases/:canvasId', (req, res, next) => canvasLegacyController.updateCanvas(req, res, next))
    router.delete('/canvases/:canvasId', (req, res, next) => canvasLegacyController.deleteCanvas(req, res, next))
    router.get('/canvases/apikey/:apikey', (req, res, next) => canvasLegacyController.getCanvasByApiKey(req, res, next))

    // Legacy chatflows aliases
    router.get('/chatflows', (req, res, next) => canvasLegacyController.getAllCanvases(req, res, next))
    router.post('/chatflows', (req, res, next) => canvasLegacyController.saveCanvas(req, res, next))
    router.post('/chatflows/importchatflows', (req, res, next) => canvasLegacyController.importCanvases(req, res, next))
    router.get('/chatflows/apikey/:apikey', (req, res, next) => canvasLegacyController.getCanvasByApiKey(req, res, next))
    router.get('/chatflows/:id', (req, res, next) => canvasLegacyController.getCanvasById(req, res, next))
    router.put('/chatflows/:id', (req, res, next) => canvasLegacyController.updateCanvas(req, res, next))
    router.delete('/chatflows/:id', (req, res, next) => canvasLegacyController.deleteCanvas(req, res, next))
    router.get('/chatflows-uploads/:canvasId', (req, res, next) => canvasLegacyController.checkIfCanvasIsValidForUploads(req, res, next))
    router.get(
        '/chatflows-streaming/:canvasId',
        (req, res, next) => canvasLegacyController.checkIfCanvasIsValidForStreaming(req, res, next)
    )

    return router
}
