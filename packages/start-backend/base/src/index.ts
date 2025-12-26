/**
 * Universo Platformo | Start Backend
 *
 * Provides onboarding functionality for new users:
 * - Fetching available items (Projects, Campaigns, Clusters) from system admin
 * - Allowing users to join selected items as members
 */

export { initializeRateLimiters, getRateLimiters, createStartServiceRoutes } from './routes/index'
