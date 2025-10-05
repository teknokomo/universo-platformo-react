// Universo Platformo | Publish Server Module
// REFACTORED: Now exports route factory instead of static routes

export { createPublishRoutes } from './routes/createPublishRoutes'
export * from './types/publication.types'
export { FlowDataService } from './services/FlowDataService'
export { PublishController } from './controllers/publishController'
export { PublishLinkService, sanitizeCustomSlug } from './services/PublishLinkService'
export * from './database/entities'
export { publishMigrations } from './database/migrations/postgres'
