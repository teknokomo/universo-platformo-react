/**
 * Centralized localStorage keys for Organizations frontend
 * Using constants prevents typos and enables easier refactoring
 */
export const STORAGE_KEYS = {
    /** Display style for Organizations list (card/table) */
    ORGANIZATION_DISPLAY_STYLE: 'organizationsOrganizationDisplayStyle',
    /** Display style for Departments list (card/table) */
    DEPARTMENT_DISPLAY_STYLE: 'organizationsDepartmentDisplayStyle',
    /** Display style for Positions list (card/table) */
    POSITION_DISPLAY_STYLE: 'organizationsPositionDisplayStyle',
    /** Display style for Members list (card/table) */
    MEMBERS_DISPLAY_STYLE: 'organizationMembersDisplayStyle'
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

/** Default view style for list pages */
export const DEFAULT_VIEW_STYLE = 'card' as const
export type ViewStyle = 'card' | 'table'
