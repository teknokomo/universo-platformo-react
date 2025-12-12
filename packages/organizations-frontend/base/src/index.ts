// Register i18n namespace (side-effect import must come first)
import './i18n'

// Main page exports
export { default as OrganizationList } from './pages/OrganizationList'
export { default as OrganizationBoard } from './pages/OrganizationBoard'
export { default as DepartmentList } from './pages/DepartmentList'
export { default as PositionList } from './pages/PositionList'
export { default as OrganizationMembers } from './pages/OrganizationMembers'

export { default as organizationsDashboard } from './menu-items/organizationDashboard'
export { organizationsTranslations } from './i18n'
