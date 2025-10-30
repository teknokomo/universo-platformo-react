// Minimal baseline exports for @universo/template-mui after reset
// Intentionally exporting ONLY config to keep API surface tiny.
// Raw MUI templates will be added under ./views (not yet exported here).

export { templateConfig as config } from './config'
export { default as Dashboard } from './views/dashboard/Dashboard'

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

// Components
export {
    ErrorBoundary,
    MarketplaceTable,
    FlowListTable,
    TableViewOnly,
    ToolsTable,
    ToolbarControls,
    ViewHeaderMUI,
    TemplateMainCard,
    EmptyListState,
    SkeletonGrid,
    BaseEntityMenu
} from './components'
export type { BaseEntityMenuProps, ActionDescriptor, ActionContext, TriggerProps } from './components'
// Re-export dialogs (EntityFormDialog, ConfirmDialog, etc.) so consumers can import from '@universo/template-mui'
export * from './components/dialogs'

// Confirm system (imperative confirmation dialogs)
export { ConfirmContext, ConfirmContextProvider } from './contexts'
export { useConfirm } from './hooks/useConfirm'
export type { ConfirmPayload } from './store/actions'

// Constants
export { gridSpacing } from './constants'

// Pagination system
export { usePaginated } from './hooks/usePaginated'
export type { UsePaginatedParams, UsePaginatedReturn } from './hooks/usePaginated'

export { useDebouncedSearch } from './hooks/useDebouncedSearch'
export type { UseDebouncedSearchOptions, UseDebouncedSearchReturn } from './hooks/useDebouncedSearch'

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
export { default as ItemCard } from './components/cards/ItemCard'

// Navigation system exports
export * from './navigation'
