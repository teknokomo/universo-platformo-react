// Hooks exports
export { default as useConfirm } from './useConfirm'
export { useListDialogs } from './useListDialogs'
export type { UseListDialogsReturn } from './useListDialogs'
export { useCodenameAutoFill } from './useCodenameAutoFill'
export type { UseCodenameAutoFillOptions } from './useCodenameAutoFill'
export { useCodenameAutoFillVlc } from './useCodenameAutoFillVlc'
export type { UseCodenameAutoFillVlcOptions } from './useCodenameAutoFillVlc'
export { useDebouncedSearch } from './useDebouncedSearch'
export { usePaginated } from './usePaginated'
export { useUserSettings, resetUserSettingsCache, getShowAllItemsSetting } from './useUserSettings'
export type { UserSettingsData } from './useUserSettings'
export { useViewPreference, DEFAULT_VIEW_STYLE } from './useViewPreference'
export type { ViewStyle } from './useViewPreference'
export { applyOptimisticReorder, rollbackReorderSnapshots, reorderItemsBySortOrder } from './optimisticReorder'
export type { ReorderQuerySnapshot } from './optimisticReorder'

// Breadcrumb hooks with React Query (using generic factory)
export {
    // Factory functions for custom entity types
    createEntityNameHook,
    createTruncateFunction,
    // Pre-configured hooks
    useMetahubName,
    useApplicationName,
    useMetahubApplicationName,
    useMetahubPublicationName,
    useLayoutName,
    useHubName,
    useCatalogName,
    useCatalogNameStandalone,
    useSetNameStandalone,
    useEnumerationName,
    useAttributeName,
    useConnectorName,
    // Pre-configured truncate functions
    truncateMetahubName,
    truncateApplicationName,
    truncatePublicationName,
    truncateHubName,
    truncateCatalogName,
    truncateSetName,
    truncateEnumerationName,
    truncateAttributeName,
    truncateConnectorName,
    truncateLayoutName
} from './useBreadcrumbName'
export type { EntityNameHookConfig, EntityNameFetcher } from './useBreadcrumbName'
