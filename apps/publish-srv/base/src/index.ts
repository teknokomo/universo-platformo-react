// Universo Platformo | Publish Server Module
// REFACTORED: Now exports route factory instead of static routes

export { createPublishRoutes } from './routes/createPublishRoutes'
export * from './types/publication.types'
export { FlowDataService } from './services/FlowDataService'
export { PublishController } from './controllers/publishController'

// Legacy exports removed - old publishRoutes.ts deleted
