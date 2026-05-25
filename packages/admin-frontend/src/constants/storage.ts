/**
 * Centralized localStorage keys for Admin frontend
 * Using constants prevents typos and enables easier refactoring
 */
export const STORAGE_KEYS = {
    /** Display style for Role Users list (list/card) */
    ROLE_USERS_DISPLAY_STYLE: 'roleUsersDisplayStyle',
    /** Display style for Admin Access list (card/table) */
    ADMIN_ACCESS_DISPLAY_STYLE: 'adminAccessDisplayStyle',
    /** Display style for Instance Users list (card/table) */
    INSTANCE_USERS_DISPLAY_STYLE: 'adminUsersDisplayStyle',
    /** Display style for Instance list (card/table) */
    INSTANCE_DISPLAY_STYLE: 'adminInstanceDisplayStyle',
    /** Display style for Roles list (card/table) */
    ROLES_DISPLAY_STYLE: 'adminRolesDisplayStyle'
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

/** Default view style for list pages */
export const DEFAULT_VIEW_STYLE = 'card' as const
export type ViewStyle = 'card' | 'table' | 'list'
