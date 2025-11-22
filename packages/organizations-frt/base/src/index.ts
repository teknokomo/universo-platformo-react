// Register i18n namespace (side-effect import must come first)
import './i18n'

// Main page exports
export { default as OrganizationList } from './pages/OrganizationList'
export { default as OrganizationBoard } from './pages/OrganizationBoard'
export { default as DepartmentList } from './pages/DepartmentList'
export { default as PositionList } from './pages/PositionList'
export { default as OrganizationMembers } from './pages/OrganizationMembers'

// Removed exports (files deleted during cleanup - 2025-01-18):
// - OrganizationDetail (old implementation, will be recreated with new architecture)
// - OrganizationAccess (old access control pattern)
// - DepartmentDetail (old implementation, will be recreated as part of new architecture)
// - DepartmentsList (replaced by old PositionList pattern, recreated as DepartmentList)
// - PositionDetail (old implementation, will be recreated as part of new architecture)
// - Old PositionList (replaced by new OrganizationList pattern, recreated with new architecture)

export { default as organizationsDashboard } from './menu-items/organizationDashboard'
export { organizationsTranslations } from './i18n'
