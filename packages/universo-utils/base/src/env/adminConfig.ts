// Universo Platformo | Admin feature flags configuration
// Centralized configuration for admin panel and super user privileges

/**
 * Admin panel and super user configuration interface
 * Used by both backend and frontend to control feature availability
 */
export interface AdminConfig {
    /** Whether admin panel UI and API endpoints are accessible */
    adminPanelEnabled: boolean
    /** Whether super user privileges (RLS bypass, see all data) are active */
    globalAdminEnabled: boolean
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
 * Get GLOBAL_ADMIN_ENABLED environment variable
 * Controls super user privileges (RLS bypass, ability to see all users' data)
 * @returns true if global admin privileges are enabled (default: true)
 */
export const isGlobalAdminEnabled = (): boolean => {
    const value = typeof process !== 'undefined' ? process.env.GLOBAL_ADMIN_ENABLED : undefined
    return parseEnvBoolean(value, true)
}

/**
 * Get full admin configuration object
 * Use this for sending config to frontend via API
 */
export const getAdminConfig = (): AdminConfig => ({
    adminPanelEnabled: isAdminPanelEnabled(),
    globalAdminEnabled: isGlobalAdminEnabled()
})
