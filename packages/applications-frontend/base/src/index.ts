// Register i18n namespace (side-effect import must come first)
import './i18n'

// Main page exports
export { default as ApplicationList } from './pages/ApplicationList'
export { default as ApplicationBoard } from './pages/ApplicationBoard'
export { default as ApplicationMembers } from './pages/ApplicationMembers'
export { default as ApplicationMigrations } from './pages/ApplicationMigrations'
export { default as ApplicationActions } from './pages/ApplicationActions'
export { default as ApplicationMemberActions } from './pages/ApplicationMemberActions'

// Connector pages
export { default as ConnectorList } from './pages/ConnectorList'
export { default as ConnectorActions } from './pages/ConnectorActions'

// Menu items
export { default as applicationsDashboard } from './menu-items/applicationDashboard'

// i18n
export { applicationsTranslations } from './i18n'

// Components
export { ApplicationGuard } from './components/ApplicationGuard'
export { ConnectorDeleteDialog } from './components/ConnectorDeleteDialog'

// Types
export type {
    Connector,
    ConnectorDisplay,
    Application,
    ApplicationDisplay,
    VersatileLocalizedContent,
    SimpleLocalizedInput,
    ApplicationLocalizedPayload,
    PaginationParams,
    PaginationMeta,
    PaginatedResponse
} from './types'
export { toApplicationDisplay, toConnectorDisplay, getVLCString } from './types'
