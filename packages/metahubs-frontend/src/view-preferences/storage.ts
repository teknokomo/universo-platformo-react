/**
 * Centralized localStorage keys for Metahubs frontend
 * Using fixedValues prevents typos and enables easier refactoring
 */
export const STORAGE_KEYS = {
    /** Display style for Metahubs list (card/table) */
    METAHUB_DISPLAY_STYLE: 'metahubsMetahubDisplayStyle',
    /** Display style for tree-entity list views (card/table) */
    TREE_ENTITY_DISPLAY_STYLE: 'metahubsTreeEntityDisplayStyle',
    /** Display style for Layouts list (card/table) */
    LAYOUT_DISPLAY_STYLE: 'metahubsLayoutDisplayStyle',
    /** Display style for Branches list (card/table) */
    BRANCH_DISPLAY_STYLE: 'metahubsBranchDisplayStyle',
    /** Display style for Publications (Information Bases) list (card/table) */
    PUBLICATION_DISPLAY_STYLE: 'metahubsPublicationDisplayStyle',
    /** Display style for object-collection lists inside a tree-entity scope (card/table) */
    LINKED_COLLECTION_DISPLAY_STYLE: 'metahubsObjectCollectionDisplayStyle',
    /** Display style for object-collection lists across all scopes (card/table) */
    ALL_LINKED_COLLECTIONS_DISPLAY_STYLE: 'metahubsAllObjectCollectionsDisplayStyle',
    /** Display style for value-group lists inside a tree-entity scope (card/table) */
    VALUE_GROUP_DISPLAY_STYLE: 'metahubsValueGroupDisplayStyle',
    /** Display style for value-group lists across all scopes (card/table) */
    ALL_VALUE_GROUPS_DISPLAY_STYLE: 'metahubsAllValueGroupsDisplayStyle',
    /** Display style for option-list lists inside a tree-entity scope (card/table) */
    OPTION_LIST_DISPLAY_STYLE: 'metahubsOptionListDisplayStyle',
    /** Display style for option-list lists across all scopes (card/table) */
    ALL_OPTION_LISTS_DISPLAY_STYLE: 'metahubsAllOptionListsDisplayStyle',
    /** Display style for Sections list (card/table) */
    SECTION_DISPLAY_STYLE: 'metahubsSectionDisplayStyle',
    /** Display style for Entities list (card/table) */
    ENTITY_DISPLAY_STYLE: 'metahubsEntityDisplayStyle',
    /** Display style for generic entity instances list (card/table) */
    ENTITY_INSTANCE_DISPLAY_STYLE: 'metahubsEntityInstanceDisplayStyle',
    /** Display style for Members list (card/table) */
    MEMBERS_DISPLAY_STYLE: 'metahubsMembersDisplayStyle'
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

const LEGACY_STORAGE_KEY_ALIASES: Record<string, readonly string[]> = {
    [STORAGE_KEYS.TREE_ENTITY_DISPLAY_STYLE]: ['metahubsHubDisplayStyle'],
    [STORAGE_KEYS.VALUE_GROUP_DISPLAY_STYLE]: ['metahubsSetDisplayStyle'],
    [STORAGE_KEYS.ALL_VALUE_GROUPS_DISPLAY_STYLE]: ['metahubsAllSetsDisplayStyle'],
    [STORAGE_KEYS.OPTION_LIST_DISPLAY_STYLE]: ['metahubsEnumerationDisplayStyle'],
    [STORAGE_KEYS.ALL_OPTION_LISTS_DISPLAY_STYLE]: ['metahubsAllEnumerationsDisplayStyle']
}

export const getStorageKeyReadCandidates = (storageKey: string): readonly string[] => [
    storageKey,
    ...(LEGACY_STORAGE_KEY_ALIASES[storageKey] ?? [])
]

export const getLegacyStorageKeyAliases = (storageKey: string): readonly string[] => LEGACY_STORAGE_KEY_ALIASES[storageKey] ?? []

/** Default view style for list pages */
export const DEFAULT_VIEW_STYLE = 'card' as const
export type ViewStyle = 'card' | 'table'
