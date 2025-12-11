/**
 * @universo/core-infrastructure - Core Database Infrastructure
 *
 * This package provides essential database infrastructure migrations
 * and functions required by the entire Universo Platformo system.
 *
 * Current infrastructure:
 * - UUID v7 generation function (RFC 9562 compliant)
 *
 * Usage:
 * Import and spread the migrations into your main migration registry:
 * ```
 * import { infrastructureMigrations } from '@universo/core-infrastructure'
 * export const postgresMigrations = [
 *     ...infrastructureMigrations,
 *     ...otherMigrations
 * ]
 * ```
 */

// Database migrations
export { infrastructureMigrations } from './database/migrations/postgres'

// Re-export migration classes for direct access if needed
export { InitializeUuidV7Function1500000000000 } from './database/migrations/postgres/1500000000000-InitializeUuidV7Function'
