// Hooks exports
export { default as useConfirm } from './useConfirm'
export { useDebouncedSearch } from './useDebouncedSearch'
export { usePaginated } from './usePaginated'
export { useUserSettings, resetUserSettingsCache, getShowAllItemsSetting } from './useUserSettings'
export type { UserSettingsData } from './useUserSettings'

// Breadcrumb hooks with React Query (using generic factory)
export {
    // Factory functions for custom entity types
    createEntityNameHook,
    createTruncateFunction,
    // Pre-configured hooks
    useMetaverseName,
    useOrganizationName,
    useClusterName,
    useProjectName,
    useCampaignName,
    useUnikName,
    useStorageName,
    // Pre-configured truncate functions
    truncateMetaverseName,
    truncateOrganizationName,
    truncateClusterName,
    truncateProjectName,
    truncateCampaignName,
    truncateUnikName,
    truncateStorageName
} from './useBreadcrumbName'
export type { EntityNameHookConfig, EntityNameFetcher } from './useBreadcrumbName'
