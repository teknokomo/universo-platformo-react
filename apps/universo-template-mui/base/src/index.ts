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

// Placeholder type to avoid consumer breakage if they expect a TemplateProvider symbol.
// Will be replaced by real implementation in later integration phase.
export const TemplateProvider = ({ children }: { children?: any }) => children as any

// Components
export { ErrorBoundary, MarketplaceTable, TableViewOnly, ToolsTable } from './components'
export * from './i18n'

// Card components
export { default as ItemCard } from './components/cards/ItemCard'

// Navigation system exports
export * from './navigation'
