import { Router } from 'express'
import type { Router as ExpressRouter } from 'express'
import { DataSource } from 'typeorm'
import { SpacesController } from '../controllers/spacesController'
import { SpacesService } from '../services/spacesService'
import { CanvasController, RateLimiterManagerLike, CanvasControllerOptions } from '../controllers/canvasController'
import { createCanvasService, CanvasServiceFactoryOptions } from '../services/canvasServiceFactory'

export interface CreateSpacesRoutesOptions {
    canvasService: Omit<CanvasServiceFactoryOptions, 'getDataSource'>
    rateLimiterManager?: RateLimiterManagerLike
    apiKeyService?: CanvasControllerOptions['apiKeyService']
    membership?: CanvasControllerOptions['membership']
    executionsRouter?: ExpressRouter
    validationRouter?: ExpressRouter
}

export function createSpacesRoutes(getDataSourceFn: () => DataSource, options: CreateSpacesRoutesOptions): ExpressRouter {
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
    const canvasController = new CanvasController(canvasService, options.rateLimiterManager, {
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
    router.get('/spaces/:spaceId/canvases', (req, res, next) => canvasController.getAllCanvases(req, res, next))
    router.post('/spaces/:spaceId/canvases', (req, res, next) => canvasController.saveCanvas(req, res, next))
    router.post('/spaces/:spaceId/canvases/import', (req, res, next) => canvasController.importCanvases(req, res, next))
    router.get('/spaces/:spaceId/canvases/:canvasId', (req, res, next) => canvasController.getCanvasById(req, res, next))
    router.put('/spaces/:spaceId/canvases/:canvasId', (req, res, next) => canvasController.updateCanvas(req, res, next))
    router.delete('/spaces/:spaceId/canvases/:canvasId', (req, res, next) => canvasController.deleteCanvas(req, res, next))
    router.put('/spaces/:spaceId/canvases/reorder', (req, res) => spacesController.reorderCanvases(req, res))
    router.get('/spaces/:spaceId/canvases/:canvasId/versions', (req, res) => spacesController.getCanvasVersions(req, res))
    router.post('/spaces/:spaceId/canvases/:canvasId/versions', (req, res) => spacesController.createCanvasVersion(req, res))
    router.put('/spaces/:spaceId/canvases/:canvasId/versions/:versionId', (req, res) => spacesController.updateCanvasVersion(req, res))
    router.post('/spaces/:spaceId/canvases/:canvasId/versions/:versionId/activate', (req, res) =>
        spacesController.activateCanvasVersion(req, res)
    )
    router.delete('/spaces/:spaceId/canvases/:canvasId/versions/:versionId', (req, res) => spacesController.deleteCanvasVersion(req, res))

    router.get('/spaces/:spaceId/canvases/:canvasId/streaming', (req, res, next) =>
        canvasController.checkIfCanvasIsValidForStreaming(req, res, next)
    )
    router.get('/spaces/:spaceId/canvases/:canvasId/uploads', (req, res, next) =>
        canvasController.checkIfCanvasIsValidForUploads(req, res, next)
    )

    router.get('/canvases/:canvasId/streaming', (req, res, next) => canvasController.checkIfCanvasIsValidForStreaming(req, res, next))
    router.get('/canvases/:canvasId/uploads', (req, res, next) => canvasController.checkIfCanvasIsValidForUploads(req, res, next))

    // Single Canvas operations (path expected by UI)
    router.get('/canvases/:canvasId', (req, res, next) => canvasController.getCanvasById(req, res, next))
    router.put('/canvases/:canvasId', (req, res, next) => canvasController.updateCanvas(req, res, next))
    router.delete('/canvases/:canvasId', (req, res, next) => canvasController.deleteCanvas(req, res, next))
    router.get('/canvases/apikey/:apikey', (req, res, next) => canvasController.getCanvasByApiKey(req, res, next))

    // Executions for canvases (if provided)
    if (options.executionsRouter) {
        const ensureMembership = async (req: any, res: any, next: any) => {
            try {
                const unikId = (req.params.unikId || (req.params as any).id) as string | undefined

                if (unikId && options.membership?.ensureUnikMembershipResponse) {
                    await options.membership.ensureUnikMembershipResponse(req, res, unikId, {
                        errorMessage:
                            options.membership.accessDeniedMessage ?? 'Access denied: You do not have permission to access this Unik'
                    })
                }

                next()
            } catch (error) {
                next(error)
            }
        }

        router.use('/spaces/:spaceId/canvases/:canvasId/executions', ensureMembership, options.executionsRouter)
        router.use('/canvases/:canvasId/executions', ensureMembership, options.executionsRouter)
    }

    // Validation for canvases (if provided) - AgentFlow validation checklist
    if (options.validationRouter) {
        router.use(
            '/validation',
            async (req, res, next) => {
                try {
                    const unikId = (req.params.unikId || (req.params as any).id) as string | undefined

                    if (unikId && options.membership?.ensureUnikMembershipResponse) {
                        await options.membership.ensureUnikMembershipResponse(req, res, unikId, {
                            errorMessage:
                                options.membership.accessDeniedMessage ?? 'Access denied: You do not have permission to access this Unik'
                        })
                    }

                    next()
                } catch (error) {
                    next(error)
                }
            },
            options.validationRouter
        )
    }

    return router
}
