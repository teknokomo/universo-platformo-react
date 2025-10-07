// Routes
export { createSpacesRoutes, type CreateSpacesRoutesOptions } from './routes/spacesRoutes'
export { createCanvasPublicRoutes } from './routes/canvasPublicRoutes'

// Controllers
export { SpacesController } from './controllers/spacesController'

// Services
export { SpacesService } from './services/spacesService'
export { purgeSpacesForUnik, cleanupCanvasStorage } from './services/purgeUnikSpaces'
export {
    CanvasService,
    type CanvasServiceDependencies,
    type CanvasServiceEntities,
    type CanvasServiceMetricsConfig,
    type PublicCanvasResponse
} from './services/canvasService'
export {
    createCanvasService,
    type CanvasServiceFactoryOptions,
    type CanvasServiceAdapter,
    type CanvasFlowResult
} from './services/canvasServiceFactory'

// Types
export * from './types'

// Database
export { spacesMigrations } from './database/migrations/postgres'
export * from './database/entities'
