/**
 * Unik role definitions and utilities
 * 
 * Provides strict typing for workspace roles and validation functions
 * to prevent authorization bypass through typos.
 */

export const UNIK_ROLES = ['owner', 'admin', 'editor', 'member'] as const
export type UnikRole = typeof UNIK_ROLES[number]

/**
 * Role hierarchy for comparison (higher number = more permissions)
 */
export const ROLE_HIERARCHY: Record<UnikRole, number> = {
    owner: 4,
    admin: 3,
    editor: 2,
    member: 1
}

/**
 * Check if actual role meets one of the allowed roles
 * 
 * @param actual - User's current role in the workspace
 * @param allowed - List of roles that are permitted for this operation
 * @returns true if access should be granted
 */
export function hasRequiredRole(actual: UnikRole, allowed: UnikRole[] = []): boolean {
    if (!allowed.length) return true // No role restrictions
    
    // Check if user has one of the explicitly allowed roles
    if (allowed.includes(actual)) return true
    
    // Check if user has a higher role than any of the allowed roles (role hierarchy)
    const actualLevel = ROLE_HIERARCHY[actual]
    return allowed.some(allowedRole => actualLevel > ROLE_HIERARCHY[allowedRole])
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
export function getRoleLevel(role: UnikRole): number {
    return ROLE_HIERARCHY[role]
}