// Minimal baseline exports for @universo/template-mui after reset
// Intentionally exporting ONLY config to keep API surface tiny.
// Raw MUI templates will be added under ./views (not yet exported here).

export { templateConfig as config } from './config'
export { default as Dashboard } from './views/dashboard/Dashboard'
export type { DashboardLayoutConfig, DashboardDetailsSlot } from './components/dashboard/runtimeTypes'

// New exports for universal MUI routing system
export { default as MainLayoutMUI } from './layout/MainLayoutMUI'
export { default as MainRoutesMUI } from './routes/MainRoutesMUI'

// Route types will be added later if needed

// Backward compatibility alias
export { default as UnikLayout } from './layout/MainLayoutMUI'
// export { default as UnikLayout } from './layout/MainLayoutMUI'

// Placeholder type to avoid consumer breakage if they expect a TemplateProvider symbol.
// Will be replaced by real implementation in later integration phase.
export const TemplateProvider = ({ children }: { children?: any }) => children as any

// Utilities
export { isAccessDeniedError } from './utils/httpErrors'

// Components
export {
    ErrorBoundary,
    MarketplaceTable,
    FlowListTable,
    CompactListTable,
    TableViewOnly,
    ToolsTable,
    ToolbarControls,
    FilterToolbar,
    ViewHeaderMUI,
    TemplateMainCard,
    EmptyListState,
    SkeletonGrid,
    Loader,
    Loadable,
    AuthGuard,
    AdminGuard,
    ResourceGuard,
    TooltipWithParser,
    BaseEntityMenu,
    CollapsibleSection
} from './components'
export type {
    CollapsibleSectionProps,
    BaseEntityMenuProps,
    ActionDescriptor,
    ActionContext,
    TriggerProps,
    AuthGuardProps,
    AdminGuardProps,
    ResourceGuardProps,
    TooltipWithParserProps,
    TableColumn,
    FlowListTableData,
    FlowListTableProps,
    CompactListTableProps,
    CompactListTableLinkMode,
    FilterType,
    FilterOption,
    FilterConfig,
    FilterValues,
    FilterToolbarProps
} from './components'

// Re-export dialogs (EntityFormDialog, ConfirmDialog, etc.) so consumers can import from '@universo/template-mui'
export * from './components/dialogs'

// Forms
export { LocalizedFieldEditor } from './components/forms/LocalizedFieldEditor'
export { LocalizedInlineField } from './components/forms/LocalizedInlineField'
export { CodenameField } from './components/forms/CodenameField'
export type { CodenameFieldProps } from './components/forms/CodenameField'

// Chips
export { RoleChip } from './components/chips'
export type { RoleChipProps } from './components/chips'

// Selection components
export { EntitySelectionPanel } from './components/selection'
export type { EntitySelectionPanelProps, EntitySelectionLabels, SelectableEntity } from './components/selection'

// Confirm system (imperative confirmation dialogs)
export { ConfirmContext, ConfirmContextProvider } from './contexts'
export { useConfirm } from './hooks/useConfirm'
export type { ConfirmPayload } from './store/actions'

// User settings system
export { useUserSettings, resetUserSettingsCache, getShowAllItemsSetting } from './hooks/useUserSettings'
export type { UserSettingsData } from './hooks/useUserSettings'

// Constants
export { gridSpacing } from './constants'

// Pagination system
export { usePaginated } from './hooks/usePaginated'
export type { UsePaginatedParams, UsePaginatedReturn } from './hooks/usePaginated'

export { useDebouncedSearch } from './hooks/useDebouncedSearch'
export type { UseDebouncedSearchOptions, UseDebouncedSearchReturn } from './hooks/useDebouncedSearch'

export { useCodenameAutoFill } from './hooks/useCodenameAutoFill'
export type { UseCodenameAutoFillOptions } from './hooks/useCodenameAutoFill'

// View preference system (localStorage-backed view modes)
export { useViewPreference, DEFAULT_VIEW_STYLE } from './hooks/useViewPreference'
export type { ViewStyle } from './hooks/useViewPreference'

export { PaginationControls } from './components/pagination'
export type { PaginationControlsProps } from './components/pagination'

// Pagination types
export type { PaginationParams, PaginationMeta, PaginatedResponse, PaginationState, PaginationActions } from './types/pagination'

// Assets - explicit named exports for SVG defaults
export {
    APIEmptySVG,
    AgentsEmptySVG,
    AssistantEmptySVG,
    ChunksEmptySVG,
    CredentialEmptySVG,
    DocStoreEmptySVG,
    DocStoreDetailsEmptySVG,
    LeadsEmptySVG,
    MessageEmptySVG,
    PromptEmptySVG,
    ToolsEmptySVG,
    UpsertHistoryEmptySVG,
    VariablesEmptySVG,
    WorkflowEmptySVG
} from './assets'

// Card components
export { ItemCard } from './components/cards/ItemCard'
export type { ItemCardProps, ItemCardData } from './components/cards/ItemCard'
export { default } from './components/cards/ItemCard'

// Navigation system exports
export * from './navigation'

// Factories for creating reusable action descriptors
export { createEntityActions, notifyError } from './factories'
export type { EntityActionsConfig } from './factories'
export { createMemberActions, notifyMemberError } from './factories/createMemberActions'
export type { MemberActionsConfig, MemberFormData } from './factories/createMemberActions'

// Dashboard components
export { default as StatCard } from './components/dashboard/StatCard'
export type { StatCardProps } from './components/dashboard/StatCard'
export { default as HighlightedCard } from './components/dashboard/HighlightedCard'
export type { HighlightedCardProps } from './components/dashboard/HighlightedCard'
export { default as SessionsChart } from './components/dashboard/SessionsChart'
export type { SessionsChartProps } from './components/dashboard/SessionsChart'
export { default as PageViewsBarChart } from './components/dashboard/PageViewsBarChart'
export type { PageViewsBarChartProps } from './components/dashboard/PageViewsBarChart'
