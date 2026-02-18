/**
 * Universo Platformo | Migration Guard Shared
 *
 * Shared utilities and components for migration guard features
 * used by both metahub and application frontends.
 */

// Pure utilities (safe for backend import)
export { determineSeverity } from './determineSeverity'
export type { DetermineSeverityOptions } from './determineSeverity'

export { MIGRATION_STATUS_QUERY_OPTIONS } from './migrationStatusQueryOptions'

// React components (frontend only)
export { MigrationGuardShell } from './MigrationGuardShell'
export type { BaseMigrationStatus, GuardRenderContext, MigrationGuardShellProps } from './MigrationGuardShell'
