/**
 * Current baseline version for application system tables (_app_*).
 * Bump when new system table structures are introduced.
 *
 * Used by:
 * - @universo/applications-backend runtime sync — sets this value on successful sync
 * - applicationMigrationsRoutes — compares against current app version
 */
export const TARGET_APP_STRUCTURE_VERSION = 1
