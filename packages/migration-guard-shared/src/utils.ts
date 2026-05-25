/**
 * Universo Platformo | Migration Guard Shared — Backend-safe utilities
 *
 * This entry point exports only pure utility functions and constants
 * that have NO React or MUI dependencies. It is safe to import
 * from Node.js / Express backend code.
 *
 * Usage (backend):
 *   import { determineSeverity } from '@universo/migration-guard-shared/utils'
 */

export { determineSeverity } from './determineSeverity'
export type { DetermineSeverityOptions } from './determineSeverity'
