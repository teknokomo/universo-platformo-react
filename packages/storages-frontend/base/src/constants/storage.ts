/**
 * Centralized localStorage keys for Storages frontend
 * Using constants prevents typos and enables easier refactoring
 */
export const STORAGE_KEYS = {
    /** Display style for Storages list (card/table) */
    STORAGE_DISPLAY_STYLE: 'storagesStorageDisplayStyle',
    /** Display style for Slots list (card/table) */
    SLOT_DISPLAY_STYLE: 'storagesSlotDisplayStyle',
    /** Display style for Containers list (card/table) */
    CONTAINER_DISPLAY_STYLE: 'storagesContainerDisplayStyle',
    /** Display style for Members list (card/table) */
    MEMBERS_DISPLAY_STYLE: 'storagesMembersDisplayStyle'
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

/** Default view style for list pages */
export const DEFAULT_VIEW_STYLE = 'card' as const
export type ViewStyle = 'card' | 'table'
