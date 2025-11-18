// Register i18n namespace (side-effect import must come first)
import './i18n'

// Main page exports
export { default as ClusterList } from './pages/ClusterList'
export { default as ClusterBoard } from './pages/ClusterBoard'
export { default as DomainList } from './pages/DomainList'
export { default as ResourceList } from './pages/ResourceList'
export { default as ClusterMembers } from './pages/ClusterMembers'

// Removed exports (files deleted during cleanup - 2025-01-18):
// - ClusterDetail (old implementation, will be recreated with new architecture)
// - ClusterAccess (old access control pattern)
// - DomainDetail (old implementation, will be recreated as part of new architecture)
// - DomainsList (replaced by old ResourceList pattern, recreated as DomainList)
// - ResourceDetail (old implementation, will be recreated as part of new architecture)
// - Old ResourceList (replaced by new ClusterList pattern, recreated with new architecture)

export { default as clustersDashboard } from './menu-items/clusterDashboard'
export { clustersTranslations } from './i18n'
