/**
 * Centralized localStorage keys for Metahubs frontend
 * Using constants prevents typos and enables easier refactoring
 */
export const STORAGE_KEYS = {
    /** Display style for Metahubs list (card/table) */
    METAHUB_DISPLAY_STYLE: 'metahubsMetahubDisplayStyle',
    /** Display style for Hubs list (card/table) */
    HUB_DISPLAY_STYLE: 'metahubsHubDisplayStyle',
    /** Display style for Branches list (card/table) */
    BRANCH_DISPLAY_STYLE: 'metahubsBranchDisplayStyle',
    /** Display style for Publications (Information Bases) list (card/table) */
    PUBLICATION_DISPLAY_STYLE: 'metahubsPublicationDisplayStyle',
    /** Display style for Catalogs list within a hub (card/table) */
    CATALOG_DISPLAY_STYLE: 'metahubsCatalogDisplayStyle',
    /** Display style for All Catalogs list (card/table) */
    ALL_CATALOGS_DISPLAY_STYLE: 'metahubsAllCatalogsDisplayStyle',
    /** Display style for Sections list (card/table) */
    SECTION_DISPLAY_STYLE: 'metahubsSectionDisplayStyle',
    /** Display style for Entities list (card/table) */
    ENTITY_DISPLAY_STYLE: 'metahubsEntityDisplayStyle',
    /** Display style for Members list (card/table) */
    MEMBERS_DISPLAY_STYLE: 'metahubsMembersDisplayStyle'
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

/** Default view style for list pages */
export const DEFAULT_VIEW_STYLE = 'card' as const
export type ViewStyle = 'card' | 'table'
