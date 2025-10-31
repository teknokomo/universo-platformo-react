/**
 * Unik role definitions and utilities
 * 
 * Provides strict typing for workspace roles and validation functions
 * to prevent authorization bypass through typos.
 */

import { UnikRole, ROLE_HIERARCHY, getRoleLevel, hasRequiredRole as baseHasRequiredRole } from '@universo/types'

// Re-export for convenience
export type { UnikRole }
export { ROLE_HIERARCHY, getRoleLevel }

export const UNIK_ROLES = ['owner', 'admin', 'editor', 'member'] as const

/**
 * Check if actual role meets one of the allowed roles
 * 
 * @param actual - User's current role in the workspace
 * @param allowed - List of roles that are permitted for this operation
 * @returns true if access should be granted
 */
export function hasRequiredRole(actual: UnikRole, allowed: UnikRole[] = []): boolean {
    return baseHasRequiredRole(actual, allowed)
}

/**
 * Validate that a string is a valid UnikRole
 * 
 * @param role - String to validate
 * @returns true if role is valid
 */
export function isValidUnikRole(role: string): role is UnikRole {
    return UNIK_ROLES.includes(role as UnikRole)
}

/**
 * Get role hierarchy level for comparison
 * 
 * @param role - Role to get level for
 * @returns Numeric level (higher = more permissions)
 */
// Exported via re-export at top of file