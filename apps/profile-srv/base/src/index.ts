// Profile Service Entry Point
// Directly export routes for integration with core Flowise

export { default as createProfileRoutes } from './routes/profileRoutes'

// Additional exports for standalone usage
export * from './database/entities/Profile'
export * from './services/profileService'
export * from './controllers/profileController'
export * from './types'
