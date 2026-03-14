// Profile Service Entry Point
// Directly export routes for integration with the core backend shell

export { default as createProfileRoutes } from './routes/profileRoutes'
export type { ProfileRouteDeps } from './routes/profileRoutes'

// Persistence store for cross-package consumers
export * from './persistence'

// Additional exports for standalone usage
export * from './platform/migrations'
export { profileSystemAppDefinition } from './platform/systemAppDefinition'
export * from './services/profileService'
export * from './controllers/profileController'
export * from './types'
