export { default as AppsDashboard } from './dashboard/Dashboard'
export type {
    DashboardDetailsSlot,
    DashboardLayoutConfig,
    DashboardMenuItem,
    DashboardMenuSlot,
    DashboardMenusMap,
    DashboardProps,
    ZoneWidgetItem,
    ZoneWidgets
} from './dashboard/Dashboard'

// Layout
export { default as AppMainLayout } from './layouts/AppMainLayout'
export type { AppMainLayoutProps } from './layouts/AppMainLayout'

// i18n side-effect registration
export { appsTranslations } from './i18n'

// Standalone app
export { default as DashboardApp } from './standalone/DashboardApp'
export type { DashboardAppProps } from './standalone/DashboardApp'

// Dialogs
export { FormDialog } from './components/dialogs/FormDialog'
export type { FieldConfig, FieldType, FieldValidationRules, FormDialogProps } from './components/dialogs/FormDialog'
export { ConfirmDeleteDialog } from './components/dialogs/ConfirmDeleteDialog'
export type { ConfirmDeleteDialogProps } from './components/dialogs/ConfirmDeleteDialog'

// Shared CRUD UI components
export { CrudDialogs } from './components/CrudDialogs'
export type { CrudDialogsProps, CrudDialogsLabels } from './components/CrudDialogs'
export { RowActionsMenu } from './components/RowActionsMenu'
export type { RowActionsMenuProps, RowActionsMenuLabels } from './components/RowActionsMenu'

// Headless controller hook
export { useCrudDashboard } from './hooks/useCrudDashboard'
export type { UseCrudDashboardOptions, CrudDashboardState } from './hooks/useCrudDashboard'

// Column / field utilities
export { toGridColumns, toFieldConfigs } from './utils/columns'
export type { ToGridColumnsOptions } from './utils/columns'

// Components
export { default as LanguageSwitcher } from './components/LanguageSwitcher'

// Utils
export { getDataGridLocaleText } from './utils/getDataGridLocale'

// API — adapter pattern
export type { CrudDataAdapter, CellRendererOverrides } from './api/types'
export { createStandaloneAdapter } from './api/adapters'

// Tabular part (TABLE attribute) adapter & components
/** @deprecated Use direct API helpers with RuntimeInlineTabularEditor instead */
export { createTabularPartAdapter } from './api/TabularPartAdapter'
/** @deprecated Use direct API helpers with RuntimeInlineTabularEditor instead */
export type { TabularPartAdapterParams } from './api/TabularPartAdapter'
/** @deprecated Use RuntimeInlineTabularEditor instead */
export { RuntimeTabularPartView } from './components/RuntimeTabularPartView'
/** @deprecated Use RuntimeInlineTabularEditorProps instead */
export type { RuntimeTabularPartViewProps } from './components/RuntimeTabularPartView'
export { RuntimeInlineTabularEditor } from './components/RuntimeInlineTabularEditor'
export type { RuntimeInlineTabularEditorProps } from './components/RuntimeInlineTabularEditor'
export { TabularPartEditor } from './components/TabularPartEditor'
export type { TabularPartEditorProps } from './components/TabularPartEditor'

// API — query keys & low-level hooks (still useful for custom scenarios)
export { appQueryKeys } from './api/mutations'
/** @deprecated Use appQueryKeys instead */
export { runtimeKeys } from './api/mutations'

// Route factory
export { createAppRuntimeRoute } from './routes/createAppRoutes'
export type { AppRouteObject, AppRuntimeRouteConfig } from './routes/createAppRoutes'

// --- Backward-compatible aliases (deprecated) ---
// These re-exports keep existing consumers working without code changes.
// Migrate to new names when convenient.

/** @deprecated Use DashboardApp instead */
export { default as RuntimeDashboardApp } from './standalone/DashboardApp'

/** @deprecated Use FormDialog instead */
export { FormDialog as RuntimeFormDialog } from './components/dialogs/FormDialog'

/** @deprecated Use FieldConfig instead */
export type { FieldConfig as RuntimeFieldConfig } from './components/dialogs/FormDialog'

/** @deprecated Use FieldType instead */
export type { FieldType as RuntimeFieldType } from './components/dialogs/FormDialog'

/** @deprecated Use FieldValidationRules instead */
export type { FieldValidationRules as RuntimeFieldValidationRules } from './components/dialogs/FormDialog'

/** @deprecated Use FormDialogProps instead */
export type { FormDialogProps as RuntimeFormDialogProps } from './components/dialogs/FormDialog'
