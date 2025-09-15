import { Router } from 'express'
import type { Router as ExpressRouter } from 'express'
import { DataSource } from 'typeorm'
import { SpacesController } from '../controllers/spacesController'
import { SpacesService } from '../services/spacesService'

export function createSpacesRoutes(getDataSourceFn: () => DataSource): ExpressRouter {
    // Enable access to parent route params like :unikId
    const router: ExpressRouter = Router({ mergeParams: true })

    // Initialize service and controller with DataSource function
    const spacesService = new SpacesService(getDataSourceFn)
    const spacesController = new SpacesController(spacesService)

    // NOTE: This router is mounted at /api/v1/unik/:id
    // Spaces CRUD
    router.get('/spaces', (req, res) => spacesController.getSpaces(req, res))
    router.post('/spaces', (req, res) => spacesController.createSpace(req, res))
    router.get('/spaces/:spaceId', (req, res) => spacesController.getSpaceDetails(req, res))
    router.put('/spaces/:spaceId', (req, res) => spacesController.updateSpace(req, res))
    router.delete('/spaces/:spaceId', (req, res) => spacesController.deleteSpace(req, res))

    // Canvases within Space
    router.get('/spaces/:spaceId/canvases', (req, res) => spacesController.getCanvases(req, res))
    router.post('/spaces/:spaceId/canvases', (req, res) => spacesController.createCanvas(req, res))
    router.put('/spaces/:spaceId/canvases/reorder', (req, res) => spacesController.reorderCanvases(req, res))

    // Single Canvas operations (path expected by UI)
    router.get('/canvases/:canvasId', (req, res) => spacesController.getCanvasById(req, res))
    router.put('/canvases/:canvasId', (req, res) => spacesController.updateCanvas(req, res))
    router.delete('/canvases/:canvasId', (req, res) => spacesController.deleteCanvas(req, res))

    return router
}
