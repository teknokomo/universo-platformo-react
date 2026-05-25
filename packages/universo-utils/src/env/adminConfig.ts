// Universo Platformo | Admin feature flags configuration
// Centralized configuration for admin panel and super user privileges

/**
 * Admin panel and privilege configuration interface
 * Used by both backend and frontend to control feature availability
 *
 * Three-tier privilege system:
 * 1. ADMIN_PANEL_ENABLED - Controls UI/API access to /admin/*
 * 2. GLOBAL_ROLES_ENABLED - Controls global editor/moderator roles (platform-wide permissions)
 * 3. SUPERUSER_ENABLED - Controls superuser RLS bypass (see all data, root access)
 */
export interface AdminConfig {
    /** Whether admin panel UI and API endpoints are accessible */
    adminPanelEnabled: boolean
    /** Whether global roles (editors, moderators) are enabled for platform-wide access */
    globalRolesEnabled: boolean
    /** Whether superuser privileges (RLS bypass, see all data) are active */
    superuserEnabled: boolean
}

/**
 * Parse boolean from environment variable value
 * @param value - Environment variable value
 * @param defaultValue - Default if value is undefined/empty
 */
const parseEnvBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
    if (value === undefined || value === '') {
        return defaultValue
    }
    return value.toLowerCase() === 'true' || value === '1'
}

/**
 * Get ADMIN_PANEL_ENABLED environment variable
 * Controls access to admin panel UI and API endpoints
 * @returns true if admin panel is enabled (default: true)
 */
export const isAdminPanelEnabled = (): boolean => {
    const value = typeof process !== 'undefined' ? process.env.ADMIN_PANEL_ENABLED : undefined
    return parseEnvBoolean(value, true)
}

/**
 * Get GLOBAL_ROLES_ENABLED environment variable
 * Controls global roles (editors, moderators) with platform-wide permissions
 * These roles can access resources across all users but WITHOUT RLS bypass
 * @returns true if global roles are enabled (default: true)
 */
export const isGlobalRolesEnabled = (): boolean => {
    const value = typeof process !== 'undefined' ? process.env.GLOBAL_ROLES_ENABLED : undefined
    return parseEnvBoolean(value, true)
}

/**
 * Get SUPERUSER_ENABLED environment variable
 * Controls superuser privileges (RLS bypass, ability to see ALL users' data)
 * This is the highest privilege level - use with caution
 * @returns true if superuser privileges are enabled (default: true)
 */
export const isSuperuserEnabled = (): boolean => {
    const value = typeof process !== 'undefined' ? process.env.SUPERUSER_ENABLED : undefined
    return parseEnvBoolean(value, true)
}

/**
 * @deprecated This function is provided for backward compatibility only.
 * Use isGlobalRolesEnabled() for global editor/moderator roles,
 * or isSuperuserEnabled() for superuser privileges.
 * This legacy function returns true if EITHER is enabled.
 * Will be removed in a future version.
 */
export const isGlobalAdminEnabled = (): boolean => {
    console.warn('isGlobalAdminEnabled() is deprecated. ' + 'Use isGlobalRolesEnabled() or isSuperuserEnabled() instead.')
    // Backwards compatibility: true if EITHER global roles OR superuser is enabled
    return isGlobalRolesEnabled() || isSuperuserEnabled()
}

/**
 * Get full admin configuration object
 * Use this for sending config to frontend via API
 */
export const getAdminConfig = (): AdminConfig => ({
    adminPanelEnabled: isAdminPanelEnabled(),
    globalRolesEnabled: isGlobalRolesEnabled(),
    superuserEnabled: isSuperuserEnabled()
})
