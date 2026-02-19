// Hooks exports
export { default as useConfirm } from './useConfirm'
export { useCodenameAutoFill } from './useCodenameAutoFill'
export type { UseCodenameAutoFillOptions } from './useCodenameAutoFill'
export { useDebouncedSearch } from './useDebouncedSearch'
export { usePaginated } from './usePaginated'
export { useUserSettings, resetUserSettingsCache, getShowAllItemsSetting } from './useUserSettings'
export type { UserSettingsData } from './useUserSettings'
export { useViewPreference, DEFAULT_VIEW_STYLE } from './useViewPreference'
export type { ViewStyle } from './useViewPreference'

// Breadcrumb hooks with React Query (using generic factory)
export {
    // Factory functions for custom entity types
    createEntityNameHook,
    createTruncateFunction,
    // Pre-configured hooks
    useMetaverseName,
    useMetahubName,
    useOrganizationName,
    useClusterName,
    useProjectName,
    useCampaignName,
    useUnikName,
    useStorageName,
    useApplicationName,
    useMetahubApplicationName,
    useMetahubPublicationName,
    useLayoutName,
    useHubName,
    useCatalogName,
    useCatalogNameStandalone,
    useEnumerationName,
    useAttributeName,
    useConnectorName,
    // Pre-configured truncate functions
    truncateMetaverseName,
    truncateMetahubName,
    truncateOrganizationName,
    truncateClusterName,
    truncateProjectName,
    truncateCampaignName,
    truncateUnikName,
    truncateStorageName,
    truncateApplicationName,
    truncatePublicationName,
    truncateHubName,
    truncateCatalogName,
    truncateEnumerationName,
    truncateAttributeName,
    truncateConnectorName,
    truncateLayoutName
} from './useBreadcrumbName'
export type { EntityNameHookConfig, EntityNameFetcher } from './useBreadcrumbName'
