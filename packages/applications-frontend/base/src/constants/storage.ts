/**
 * Centralized localStorage keys for Applications frontend
 * Using constants prevents typos and enables easier refactoring
 */
export const STORAGE_KEYS = {
    /** Display style for Applications list (card/table) */
    APPLICATION_DISPLAY_STYLE: 'applicationsApplicationDisplayStyle',
    /** Display style for Connectors list (card/table) */
    CONNECTOR_DISPLAY_STYLE: 'applicationsConnectorDisplayStyle',
    /** Display style for Members list (card/table) */
    MEMBERS_DISPLAY_STYLE: 'applicationsMembersDisplayStyle'
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

/** Default view style for list pages */
export const DEFAULT_VIEW_STYLE = 'card' as const
export type ViewStyle = 'card' | 'table'
