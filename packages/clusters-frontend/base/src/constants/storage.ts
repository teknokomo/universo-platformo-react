/**
 * Centralized localStorage keys for Clusters frontend
 * Using constants prevents typos and enables easier refactoring
 */
export const STORAGE_KEYS = {
    /** Display style for Clusters list (card/table) */
    CLUSTER_DISPLAY_STYLE: 'clustersClusterDisplayStyle',
    /** Display style for Resources list (card/table) */
    RESOURCE_DISPLAY_STYLE: 'clustersResourceDisplayStyle',
    /** Display style for Domains list (card/table) */
    DOMAIN_DISPLAY_STYLE: 'clustersDomainDisplayStyle',
    /** Display style for Members list (card/table) */
    MEMBERS_DISPLAY_STYLE: 'clusterMembersDisplayStyle'
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

/** Default view style for list pages */
export const DEFAULT_VIEW_STYLE = 'card' as const
export type ViewStyle = 'card' | 'table'
